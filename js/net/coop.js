/* ============ coop.js — partida cooperativa (hasta 8 jugadores) ============
 *
 * Quién manda en qué:
 *   ANFITRIÓN   enemigos (aparición, IA, vida, muerte), objetos del suelo,
 *               experiencia y nivel del equipo, reloj, fin de la partida.
 *   CADA UNO    su propio Pokémon: posición, vida, ataques y lo que le golpea.
 *               Sus golpes a enemigos se mandan al anfitrión, que los aplica.
 *
 * Los invitados ven COPIAS de los enemigos del anfitrión (enemy.remote) y los
 * ataques de los compañeros como "fantasmas" que no hacen daño (ver combat.js).
 *
 * Quién está eligiendo (objeto o vínculo) y quién ha elegido carta de nivel va
 * además en CADA envío (no sólo en un aviso suelto): si un aviso se pierde
 * porque la conexión parpadea, el siguiente envío lo arregla y nadie se queda
 * esperando a otro para siempre (pasaba en 2026-10).
 *
 * Mensajes (por net.js, unas 15 veces por segundo; 5 si va por el relé):
 *   invitado -> anfitrión  { k:'f', p:[estado], ev:[eventos] }
 *   anfitrión -> invitado  { k:'f', t, lv, xp, xn, ki, bo, co, p:{uid:[estado]},
 *                            e:[[id,x,y,vida,anim,dir,estados]], ev:[eventos] }
 *   anfitrión -> todos     { k:'start', seed, host, members:[{uid,name,dex,shiny}] }
 */
G.Coop = (() => {
  const ANIMS = ['Idle', 'Walk', 'Attack', 'Shoot', 'Charge', 'Hurt', 'Faint'];
  const COLORS = ['#ffcb3d', '#5fc8ff', '#7ee07a', '#ff8ad8', '#ff9a3c', '#c47bff', '#7fe0e0', '#ff6b6b'];
  // Mensajes por segundo: 15 directo, 4 por el TURN de Cloudflare (se paga por
  // GB: era 7 y se iban unos 110 GB al día, el 12-10-2026) y 3 por el relé de
  // la Realtime Database (1 $ el GB: sólo si todo lo demás falla).
  const RATE_FAST = 1 / 15, RATE_TURN = 1 / 4, RATE_SLOW = 1 / 3;
  const rateFor = u => (G.Net.slow(u) ? RATE_SLOW : G.Net.viaTurn(u) ? RATE_TURN : RATE_FAST);
  const NEAR = 950;                     // radio de enemigos que se mandan a cada uno

  let active = false, host = false, me = null, hostUid = null;
  let local = null;                     // tu Player
  const mates = new Map();              // uid -> { uid, name, color, pl, connected, q:[], flushT, xpMul }
  let outEv = [];                       // invitado: eventos para el anfitrión
  let flushT = 0;
  let hitFrom = null;                   // invitado cuyo golpe se está aplicando (no repetirle el número)
  let api = {};                         // callbacks del juego (game.js)
  let waiting = new Set();              // subida de nivel: quién falta por elegir
  let holds = new Set();                // quién está eligiendo una fusión (la partida se para para todos)
  let offers = new Map();               // uid -> cartas que le salieron (para votar si no elige)
  let levelSince = 0;                   // cuándo se abrió la subida de nivel
  let cardVote = null;                  // { uid, cards, votes:Map, need:Set }
  let kickVote = null;                  // { uid, name, votes:Map, need:Set }
  // El anfitrión mueve a los enemigos: si cambia de pestaña (o se le congela),
  // todo se para para todos. Antes los enemigos se quedaban quietos y los demás
  // seguían jugando con una ventaja enorme.
  let hostAway = false, stalled = false, lastHostAt = 0;
  // Cartas de nivel: número de la ronda (anfitrión), la última que te ha llegado
  // y la última que has elegido (invitado). Y el último "quién elige" aplicado.
  let levelSeq = 0, levelNow = 1, seenSeq = 0, doneSeq = 0, lastHo = '';
  const STALL_MS = 2500;
  let members = [];

  // ---------------- escalado de dificultad ----------------

  const scaleRate = n => 1 + 0.75 * Math.max(0, n - 1);
  const scaleHp = n => 1 + 0.3 * Math.max(0, n - 1);

  // ---------------- arranque / fin ----------------

  /**
   * @param cfg   { seed, host, members }
   * @param pl    tu Player (ya creado)
   * @param cb    { levelStart(lv), resume(), waiting(names), over(data), lost(msg), team(t), shiny(dex) }
   */
  function begin(cfg, pl, cb) {
    active = true;
    me = G.Net.uid; hostUid = cfg.host;
    host = me === hostUid;
    local = pl;
    api = cb;
    members = cfg.members;
    mates.clear();
    outEv = []; flushT = 0; waiting = new Set(); holds = new Set();
    offers = new Map(); levelSince = 0; cardVote = null; kickVote = null;
    hostAway = false; stalled = false; lastHostAt = performance.now();
    levelSeq = 0; levelNow = 1; seenSeq = 0; doneSeq = 0; lastHo = '';
    cfg.members.forEach((m, i) => {
      const x = (i - (cfg.members.length - 1) / 2) * 34, y = 0;
      if (m.uid === me) { pl.x = x; pl.y = y; pl.uid = me; pl.coopHost = host; pl.tagColor = COLORS[i]; pl.role = G.Roles.norm(m.role || pl.role); return; }
      const mon = G.DEX_BY[m.dex] || G.DEX_BY[25];
      const p = new G.Player(mon, { role: G.Roles.norm(m.role) }, !!m.shiny);
      p.remote = true; p.uid = m.uid; p.tag = m.name; p.tagColor = COLORS[i]; p.revLabel = 'Quédate a su lado';
      p.x = x; p.y = y;
      p.net = { x, y, ang: Math.PI / 2, walk: 0, hp: p.maxHp, maxHp: p.maxHp, dead: 0, mv: G.startMoveOf(mon.dex), ml: 1, mag: 78, aim: Math.PI / 2, rev: 0 };
      G.Sprites.preload([mon.dex], 8000, p.shiny);
      mates.set(m.uid, { uid: m.uid, name: m.name, color: COLORS[i], pl: p, connected: true, q: [], flushT: 0, xpMul: 1 });
    });
  }

  function end() {
    active = false; host = false; local = null;
    mates.clear(); outEv = []; waiting = new Set(); holds = new Set();
    offers = new Map(); cardVote = null; kickVote = null;
  }

  /** Te vas de la partida (los demás siguen). */
  function leave() {
    if (!active) return;
    if (host) {
      // Si se va el anfitrión, la partida termina para todos.
      emit(['ov', Object.assign(api.summary ? api.summary() : {}, { why: 'host' })]);
      flushAll();
    } else {
      outEv.push(['bye']);
      flushClient(true);
    }
    end();
  }

  // ---------------- lista de jugadores ----------------

  function players() {
    const out = [local];
    for (const m of mates.values()) if (m.connected) out.push(m.pl);
    return out;
  }
  function puppets() { const out = []; for (const m of mates.values()) if (m.connected) out.push(m.pl); return out; }

  /**
   * Multiplicador de la experiencia del equipo: la media de los bonus de
   * cada uno, y repartida entre los que sois (en grupo cae mucho más, y si no
   * se subiría de nivel el triple de rápido que en solitario).
   */
  function xpFactor() {
    let s = local.xpMul, n = 1;
    for (const m of mates.values()) if (m.connected) { s += m.xpMul || 1; n++; }
    return (s / n) / local.xpMul / (1 + 0.6 * (n - 1));
  }

  // ---------------- estado de un jugador ----------------

  const r1 = v => Math.round(v), r2 = v => Math.round(v * 100) / 100;

  function myState() {
    // Con un vínculo se manda la órbita si la hay (es lo único que los demás no ven por los 'c').
    const g = local.activeGroup();
    const m = g.find(x => x.kind === 'orbit') || g[0];
    return [r1(local.x), r1(local.y), r2(local.moveAngle), local.walking ? 1 : 0, r1(local.hp), r1(local.maxHp),
            local.dead ? 1 : 0, m ? m.id : '', m ? m.lvl : 1, r1(local.magnet), r2(local.aim), r2(local.xpMul),
            r2(local.reviveT || 0), local.item || '',
            api.choosing && api.choosing() ? 1 : 0, doneSeq];
  }

  function readState(a) {
    return { x: a[0], y: a[1], ang: a[2], walk: a[3], hp: a[4], maxHp: a[5], dead: a[6], mv: a[7], ml: a[8],
             mag: a[9], aim: a[10], xpMul: a[11], rev: a[12], item: a[13] || '',
             ch: a[14], ld: a[15] };
  }

  // ---------------- envío ----------------

  /** Anfitrión: evento para todos los invitados (menos `except`). */
  function emit(ev, except) {
    if (!host) return;
    for (const m of mates.values()) if (m.connected && m.uid !== except) m.q.push(ev);
  }

  /** Anfitrión: evento sólo para los que están cerca (números de daño). */
  function emitNear(ev, x, y, except) {
    for (const m of mates.values()) {
      if (!m.connected || m.uid === except) continue;
      if (G.U.dist2(m.pl.x, m.pl.y, x, y) > 700 * 700) continue;
      if (m.q.length > 400) continue;
      m.q.push(ev);
    }
  }

  function enemyList(near) {
    const out = [];
    const r2n = NEAR * NEAR;
    for (const e of G.EnemyMgr.all()) {
      if (e.dead || G.U.dist2(e.x, e.y, near.x, near.y) > r2n) continue;
      const a = ANIMS.indexOf(e.anim.cur);
      out.push([e.id, r1(e.x), r1(e.y), Math.ceil(e.hp), a < 0 ? 0 : a, e.anim.dir,
                (e.burn > 0 ? 1 : 0) | (e.poison > 0 ? 2 : 0) | (e.shield > 0 ? 4 : 0),
                Math.ceil(e.shield || 0)]);
    }
    return out;
  }

  function hostFrame(m) {
    const st = api.team();
    const p = { [me]: myState() };
    for (const o of mates.values()) {
      if (o.connected && o.uid !== m.uid && o.state) p[o.uid] = o.state;
    }
    const ev = m.q; m.q = [];
    const f = { k: 'f', t: r2(st.time), lv: st.level, xp: r2(st.xp), xn: st.xpNext, ki: st.kills, bo: st.bosses, co: st.coins, tk: [st.t1, st.t10, st.tb, st.tg],
             p, e: enemyList(m.pl), ev };
    // Siempre: quién está eligiendo y, si hay cartas de nivel, cuáles (ver arriba).
    f.ho = holdNames();
    if (waiting.size) f.lu = [levelSeq, levelNow];
    return f;
  }

  function flushAll() { for (const m of mates.values()) if (m.connected) G.Net.send(m.uid, hostFrame(m)); }

  function flushClient(force) {
    if (!force && !outEv.length && flushT > 0) return;
    G.Net.toHost({ k: 'f', p: myState(), ev: outEv });
    outEv = [];
  }

  /** Cada fotograma (también en la pantalla de subida de nivel). */
  function tick(dt) {
    if (!active) return;
    if (host) {
      for (const m of mates.values()) {
        if (!m.connected) continue;
        m.flushT -= dt;
        if (m.flushT > 0) continue;
        m.flushT = rateFor(m.uid);
        G.Net.send(m.uid, hostFrame(m));
      }
    } else {
      if (!stalled && performance.now() - lastHostAt > STALL_MS) { stalled = true; updateAway(); }
      flushT -= dt;
      if (flushT <= 0) {
        flushT = rateFor(hostUid);
        G.Net.toHost({ k: 'f', p: myState(), ev: outEv });
        outEv = [];
      }
    }
    if (host) maybeCardVote();
  }

  // ---------------- recepción ----------------

  G.Net.on((from, msg) => {
    if (!msg) return;
    if (msg.k === 'start') { if (G.Flow.startCoop) G.Flow.startCoop(msg); return; }
    if (!active || msg.k !== 'f') return;
    if (host) onClientFrame(from, msg); else if (from === hostUid) onHostFrame(msg);
  });

  G.Net.onPeer((u, mode) => {
    if (!active || (mode !== 'closed' && mode !== 'failed')) return;
    if (host) mateGone(u);
    else if (u === hostUid) { const cb = api.lost; end(); if (cb) cb('Se ha perdido la conexión con el anfitrión.'); }
  });

  function mateGone(u, quiet) {
    const m = mates.get(u);
    if (!m || !m.connected) return;
    m.connected = false;
    G.Projectiles.clearOrbs(m.pl);
    if (!quiet) G.Spawner.say(m.name + ' ha dejado la partida', 2.6);
    if (waiting.has(u)) picked(u);
    if (holds.has(u)) holdOff(u);
    dropFromVotes(u);
    // Si seguía la pantalla de cartas abierta y ya no falta nadie, sigue la partida.
    if (!waiting.size && api.inLevelUp && api.inLevelUp()) {
      emit(['lr']);
      flushAll();
      api.resume();
    }
    if (api.mateLeft) api.mateLeft(m);
  }

  // --- en el anfitrión ---

  function onClientFrame(from, msg) {
    const m = mates.get(from);
    if (!m || !m.connected) return;
    if (msg.p) {
      m.state = msg.p; m.pl.net = readState(msg.p); m.xpMul = m.pl.net.xpMul || 1;
      m.pl.item = m.pl.net.item || null;
      reconcile(from, m.pl.net);
    }
    for (const ev of msg.ev || []) {
      switch (ev[0]) {
        case 'h': {
          const e = G.EnemyMgr.get(ev[1]);
          if (!e || e.dead || e.remote) break;
          hitFrom = from;
          e.hurt(ev[2], ev[3], ev[4], ev[5], ev[6]);
          hitFrom = null;
          break;
        }
        case 's': {
          const e = G.EnemyMgr.get(ev[1]);
          if (!e || e.dead) break;
          if (ev[2] === 'b') e.applyBurn(ev[3]);
          else if (ev[2] === 'p') e.applyPoison(ev[3]);
          else if (ev[2] === 's') e.applySlow(ev[3]);
          break;
        }
        case 'c':
          G.Combat.ghostCast(m.pl, ev[1], ev[2], ev[3], ev[4]);
          emit(['c', from, ev[1], ev[2], ev[3], ev[4]], from);
          break;
        case 'pb':
          G.World.breakAt(ev[1], ev[2]);
          emit(['pb', ev[1], ev[2]], from);
          break;
        case 'lp': picked(from); break;
        case 'of':
          if (!(cardVote && cardVote.uid === from)) offers.set(from, ev[1]);
          break;
        case 'vp': noteCardVote(from, ev[1]); break;
        case 'ks': openKick(ev[1]); break;
        case 'ky': noteKickVote(from, !!ev[1]); break;
        case 'hs': holdOn(from); break;
        case 'he': holdOff(from); break;
        case 're': G.Rift.enterRequest(); break;
        case 'rere': {
          emit(['ec']);
          for (const e of G.EnemyMgr.all()) if (!e.dead && !e.remote) enemyAdded(e);
          break;
        }
        case 'evo': m.pl.become(ev[1], true); emit(['evo', from, ev[1]], from); break;
        case 'bye': mateGone(from); break;
      }
    }
  }

  /** Anfitrión: lo que dice cada envío del invitado manda sobre avisos que se hayan perdido. */
  function reconcile(from, n) {
    if (n.ch === undefined) return; // versión vieja del juego
    if (n.ch && !holds.has(from)) holdOn(from);
    else if (!n.ch && holds.has(from)) holdOff(from);
    if (waiting.has(from) && n.ld >= levelSeq) picked(from);
  }

  // --- en el invitado ---

  /** Invitado: se para (o sigue) según si el anfitrión está. */
  function updateAway() { if (api.away) api.away(hostAway || stalled ? nameOf(hostUid) : null); }

  // Anfitrión: al irse de la pestaña avisa a todos al momento (después ya no
  // podrá mandar nada) y al volver, que sigue.
  document.addEventListener('visibilitychange', () => {
    if (!active || !host) return;
    emit(['ha', document.hidden ? 1 : 0]);
    flushAll();
  });

  function onHostFrame(msg) {
    lastHostAt = performance.now();
    if (stalled) { stalled = false; updateAway(); }
    for (const ev of msg.ev || []) applyHostEvent(ev);
    // Quién elige y las cartas de nivel, aunque se haya perdido algún aviso.
    if (msg.ho) {
      const k = msg.ho.join('|');
      if (k !== lastHo) { lastHo = k; api.hold && api.hold(msg.ho); }
      if (msg.lu && msg.lu[0] > seenSeq) { seenSeq = msg.lu[0]; api.levelStart(msg.lu[1]); }
      else if (!msg.lu && api.inLevelUp && api.inLevelUp()) api.resume();
    }
    api.syncTeam({ time: msg.t, level: msg.lv, xp: msg.xp, xpNext: msg.xn, kills: msg.ki, bosses: msg.bo, coins: msg.co,
                   t1: (msg.tk || [])[0], t10: (msg.tk || [])[1], tb: (msg.tk || [])[2], tg: (msg.tk || [])[3] });
    for (const u in msg.p || {}) {
      const m = mates.get(u);
      if (m) { m.pl.net = readState(msg.p[u]); m.pl.item = m.pl.net.item || null; }
    }
    const now = performance.now();
    for (const a of msg.e || []) {
      const e = G.EnemyMgr.get(a[0]);
      if (!e || !e.remote || e.dead) continue;
      const n = e.net;
      const dts = (now - (n.last || now)) / 1000;
      if (dts > 0.02 && dts < 1) {
        n.vx = G.U.clamp((a[1] - n.x) / dts, -600, 600);
        n.vy = G.U.clamp((a[2] - n.y) / dts, -600, 600);
      } else { n.vx = 0; n.vy = 0; }
      n.x = a[1]; n.y = a[2]; n.age = 0; n.last = now;
      e.hp = Math.min(e.maxHp, a[3]);
      n.anim = a[4]; n.dir = a[5]; n.st = a[6];
      if (a.length > 7 && e.maxShield) e.shield = a[7];
    }
  }

  function applyHostEvent(ev) {
    switch (ev[0]) {
      case 'ne':
        G.EnemyMgr.addRemote({ id: ev[1], dex: ev[2], x: ev[3], y: ev[4], boss: !!ev[5], shiny: !!ev[6], hp: ev[7], dmg: ev[8], beh: ev[9], phase: ev[10] || 0 });
        break;
      case 'ed': G.EnemyMgr.removeRemote(ev[1], true); break;
      case 'eg': G.EnemyMgr.removeRemote(ev[1], false); break;
      case 'ec': G.EnemyMgr.clearRemote(); break;
      case 'hn': { const e = G.EnemyMgr.get(ev[1]); if (e && !e.dead) e.showHurt(ev[2], ev[3]); break; }
      case 'es':
        G.Projectiles.spawn({ x: ev[1], y: ev[2], vx: ev[3], vy: ev[4], dmg: ev[5], r: ev[6], life: ev[7],
                              friendly: false, color: '#ff7a9e', vis: G.VFX.forType(ev[8]), mtype: ev[8], boss: !!ev[9] });
        break;
      case 'c': { const m = mates.get(ev[1]); if (m) G.Combat.ghostCast(m.pl, ev[2], ev[3], ev[4], ev[5]); break; }
      case 'item': api.item(ev[1]); break;
      case 'stone': api.stone(); break;
      case 'pk': G.Pickups.addRemote(ev[1], ev[2], ev[3], ev[4], ev[5], ev[6]); break;
      case 'pc': G.Pickups.removeId(ev[1]); break;
      case 'mag': G.Pickups.pullAll(); G.FX.ring(local.x, local.y, 10, 420, '#ff9ed8', 0.6, 4); break;
      case 'bomb':
        G.FX.ring(ev[1], ev[2], 20, G.Camera.outerRadius(), '#ff7b3d', 0.5, 6);
        if (G.U.dist2(ev[1], ev[2], local.x, local.y) < 500 * 500) G.Camera.kick(0.8);
        G.Audio.sfx('break');
        break;
      case 'pb': G.World.breakAt(ev[1], ev[2]); break;
      case 'say': G.Spawner.say(ev[1], ev[2]); break;
      case 'heal': if (!local.dead) { local.heal(local.maxHp * ev[1]); G.FX.ring(local.x, local.y, 6, 60, '#5fe08a', 0.4, 3); } break;
      case 'lu': if (!ev[2] || ev[2] > seenSeq) { seenSeq = ev[2] || seenSeq; api.levelStart(ev[1]); } break;
      case 'lw': api.waiting(ev[1]); break;
      case 'lr': api.resume(); break;
      case 'hp': lastHo = (ev[1] || []).join('|'); api.hold && api.hold(ev[1]); break;
      case 'ha': hostAway = !!ev[1]; updateAway(); break;
      case 'sh': api.shiny(ev[1]); break;
      case 'ov': { const cb = api.over; const d = ev[1]; end(); cb(d); break; }
      case 'rift': case 'riftx': case 'arena': case 'aw': case 'al': G.Rift.onEvent(ev); break;
      case 'evo': { const mate = mates.get(ev[1]); if (mate) mate.pl.become(ev[2], true); break; }
      case 'wx': G.Weather.onEvent(ev); break;
      case 'ev': G.Events.onNet(ev); break;
      case 'hz': G.Hazards.add(ev[1], true); break;
      case 'fxr': G.FX.ring(ev[1], ev[2], 8, ev[3], ev[4], 0.5, 3); break;
      case 'tw': G.Towers.onNet(ev); break;
      case 'tk': api.grantTicket && api.grantTicket(ev[1], ev[2]); break;
      case 'gw': api.wheel && api.wheel(ev[1], ev[2], ev[3], ev[4]); break;
      case 'cv': api.cardVote && api.cardVote(ev[1], ev[2], ev[3]); break;
      case 'cf': api.forceCard && api.forceCard(ev[1]); break;
      case 'cx': G.RunUI.closeVote(); break;
      case 'kv': api.kickVote && api.kickVote(ev[1], ev[2]); break;
      case 'kx': G.RunUI.closeVote(); if (api.kickDone) api.kickDone(!!ev[1], ev[2]); break;
      case 'out': api.kicked && api.kicked(); break;
      case 'gone': { const m = mates.get(ev[1]); if (m) m.connected = false; break; }
    }
  }

  // ---------------- ganchos que llaman los módulos del juego ----------------

  /** Tu ataque: los demás lo repiten como fantasma. */
  function cast(pl, m) {
    if (!active || pl !== local) return;
    if (host) emit(['c', me, m.id, m.lvl, r2(pl.aim), m.evolved ? 1 : 0]);
    else outEv.push(['c', m.id, m.lvl, r2(pl.aim), m.evolved ? 1 : 0]);
  }

  // invitado
  function hit(e, d, color, dx, dy, knock) { outEv.push(['h', e.id, d, color, r1(dx), r1(dy), knock || 0]); }
  function status(e, kind, val) { outEv.push(['s', e.id, kind, val]); }

  // anfitrión
  function hurtShown(e, d, color) { emitNear(['hn', e.id, d, color], e.x, e.y, hitFrom); }
  function enemyAdded(e) {
    emit(['ne', e.id, e.dex, r1(e.x), r1(e.y), e.boss ? 1 : 0, e.shiny ? 1 : 0, Math.ceil(e.maxHp), r2(e.dmg), e.behavior, e.towerPhase || 0]);
  }
  function enemyGone(e, died) { emit([died ? 'ed' : 'eg', e.id]); }
  function enemyShot(p, type) { emit(['es', r1(p.x), r1(p.y), r1(p.vx), r1(p.vy), r2(p.dmg), p.r, p.life, type, p.boss ? 1 : 0]); }
  function pickupAdded(o) { emit(['pk', o.id, o.kind, r1(o.x), r1(o.y), o.value, o.noMag ? 1 : 0]); }
  function pickupGone(id) { emit(['pc', id]); }
  function say(text, secs) { emit(['say', text, secs]); }

  function propBroken(p) {
    if (host) emit(['pb', p.tx, p.ty]);
    else outEv.push(['pb', p.tx, p.ty]);
  }

  /** Anfitrión: alguien ha cogido un objeto. Devuelve true si es para ti. */
  function collected(p, who) {
    emit(['pc', p.id]);
    if (p.kind === 'magnet') emit(['mag']);
    if (p.kind === 'bomb') emit(['bomb', r1(who.x), r1(who.y)]);
    if ((p.kind === 'heal' || p.kind === 'item' || p.kind === 'evostone') && who !== local) {
      const m = mates.get(who.uid);
      if (m) m.q.push(p.kind === 'heal' ? ['heal', 0.3] : p.kind === 'evostone' ? ['stone'] : ['item', p.value]);
    }
  }

  function shinyCaught(e) { emit(['sh', e.dex]); }

  // ---------------- subida de nivel compartida ----------------

  function levelStart(level) {
    waiting = new Set([me]);
    for (const m of mates.values()) if (m.connected) waiting.add(m.uid);
    offers = new Map();
    levelSince = performance.now();
    cardVote = null;
    levelSeq++; levelNow = level;
    emit(['lu', level, levelSeq]);
    flushAll();
    api.levelStart(level);
    sendWaiting();
  }

  function nameOf(u) { return u === me ? (G.Social.me ? G.Social.me.name : 'Tú') : (mates.get(u) || {}).name || '?'; }

  function sendWaiting() {
    const names = [...waiting].map(nameOf);
    emit(['lw', names]);
    api.waiting(names);
  }

  /** Alguien ha elegido carta (anfitrión). */
  function picked(u) {
    if (cardVote && cardVote.uid === u) { cardVote = null; emit(['cx']); G.RunUI.closeVote(); }
    if (!waiting.delete(u)) return;
    if (waiting.size) { sendWaiting(); return; }
    emit(['lr']);
    flushAll();
    api.resume();
  }

  // ---------------- fusiones: pausa para todos ----------------
  // Mientras alguien elige qué movimientos fusiona (vínculo de un legendario),
  // la partida se para para todos, como con las cartas de nivel.

  function holdNames() { return [...holds].map(nameOf); }

  /** Anfitrión: `u` empieza a elegir. */
  function holdOn(u) {
    holds.add(u);
    emit(['hp', holdNames()]); flushAll();
    api.hold && api.hold(holdNames());
  }

  /** Anfitrión: `u` ha terminado (o se ha ido). */
  function holdOff(u) {
    if (!holds.delete(u)) return;
    emit(['hp', holdNames()]); flushAll();
    api.hold && api.hold(holdNames());
  }

  /** Tú empiezas / terminas de elegir fusión. */
  function holdStart() { if (host) holdOn(me); else { outEv.push(['hs']); flushClient(true); } }
  function holdEnd() { if (host) holdOff(me); else { outEv.push(['he']); flushClient(true); } }

  /** Has elegido tu carta. */
  function localPicked() {
    if (host) picked(me);
    else { doneSeq = seenSeq; outEv.push(['lp']); flushClient(true); }
  }

  function dropFromVotes(u) {
    if (cardVote && cardVote.uid === u) { cardVote = null; emit(['cx']); flushAll(); }
    else if (cardVote && cardVote.need.delete(u)) finishCardVote();
    if (kickVote && kickVote.uid === u) {
      kickVote = null;
      emit(['kx', 0, '']);
      flushAll();
      api.pauseForVote && api.pauseForVote(false);
      G.RunUI.closeVote();
    } else if (kickVote && kickVote.need.delete(u)) finishKickVote();
  }

  function roster() {
    const out = [{ uid: me, name: nameOf(me), host: me === hostUid }];
    for (const m of mates.values()) if (m.connected) out.push({ uid: m.uid, name: m.name, host: false });
    return out;
  }

  /** El anfitrión apunta las cartas de cada uno (para votarlas si no elige). */
  function reportCards(list) {
    if (!active || !list) return;
    if (host) { if (!(cardVote && cardVote.uid === me)) offers.set(me, list); return; }
    outEv.push(['of', list]);
    flushClient(true);
  }

  function voteTarget() { return cardVote ? cardVote.uid : null; }

  function maybeCardVote() {
    if (!host || cardVote || !waiting.size || !levelSince) return;
    if (performance.now() - levelSince < 30000) return;
    let uid = null, cards = null;
    for (const id of waiting) {
      const c = offers.get(id);
      if (c && c.length) { uid = id; cards = c; break; }
    }
    if (!uid) {
      if (performance.now() - levelSince > 45000) picked([...waiting][0]);
      return;
    }
    const need = new Set();
    if (uid !== me) need.add(me);
    for (const m of mates.values()) if (m.connected && m.uid !== uid) need.add(m.uid);
    if (!need.size) return;
    cardVote = { uid, cards, votes: new Map(), need };
    emit(['cv', uid, nameOf(uid), cards]);
    flushAll();
    if (need.has(me)) api.cardVote && api.cardVote(uid, nameOf(uid), cards);
  }

  function noteCardVote(from, index) {
    if (!cardVote || from === cardVote.uid || !cardVote.need.has(from)) return;
    cardVote.votes.set(from, index | 0);
    cardVote.need.delete(from);
    finishCardVote();
  }

  function voteCard(index) {
    // La votación vive en el anfitrión. Quien no lo es igual tiene que poder
    // mandar su voto: si no, la partida se queda esperando al que no elige.
    if (host) {
      if (!cardVote) return;
      noteCardVote(me, index);
    } else {
      outEv.push(['vp', index | 0]);
      flushClient(true);
    }
  }

  function finishCardVote() {
    if (!cardVote || cardVote.need.size) return;
    const counts = new Map();
    for (const v of cardVote.votes.values()) counts.set(v, (counts.get(v) || 0) + 1);
    let best = 0, opts = [];
    for (const [k, n] of counts) {
      if (n > best) { best = n; opts = [k]; }
      else if (n === best) opts.push(k);
    }
    const index = opts[Math.floor(Math.random() * opts.length)] || 0;
    const uid = cardVote.uid;
    cardVote = null;
    emit(['cx']);
    G.RunUI.closeVote();
    if (uid === me) api.forceCard && api.forceCard(index);
    else {
      const m = mates.get(uid);
      if (m && m.connected) m.q.push(['cf', index]);
      flushAll();
      picked(uid);
    }
  }

  function askKick(uid) {
    if (!active || !uid || uid === hostUid || kickVote) return;
    if (host) openKick(uid);
    else { outEv.push(['ks', uid]); flushClient(true); }
  }

  function openKick(uid) {
    if (!host || kickVote || !uid || uid === hostUid) return;
    const m = mates.get(uid);
    if (!m || !m.connected) return;
    const need = new Set();
    if (uid !== me) need.add(me);
    for (const o of mates.values()) if (o.connected && o.uid !== uid) need.add(o.uid);
    if (!need.size) return;
    kickVote = { uid, name: m.name, votes: new Map(), need };
    emit(['kv', uid, m.name]);
    flushAll();
    api.pauseForVote && api.pauseForVote(true);
    if (need.has(me)) api.kickVote && api.kickVote(uid, m.name);
  }

  function noteKickVote(from, yes) {
    if (!kickVote || from === kickVote.uid || !kickVote.need.has(from)) return;
    kickVote.votes.set(from, yes);
    kickVote.need.delete(from);
    finishKickVote();
  }

  function voteKick(yes) {
    if (host) {
      if (!kickVote) return;
      noteKickVote(me, !!yes);
    } else {
      outEv.push(['ky', yes ? 1 : 0]);
      flushClient(true);
    }
  }

  function finishKickVote() {
    if (!kickVote || kickVote.need.size) return;
    let yes = 0, no = 0;
    for (const v of kickVote.votes.values()) { if (v) yes++; else no++; }
    const pass = yes > no;
    const uid = kickVote.uid, name = kickVote.name;
    kickVote = null;
    // Primero se saca (limpia cartas/pausas). Si el aviso de fin va antes,
    // la partida se queda en "kickvote" o con las cartas abiertas.
    if (pass) kickNow(uid);
    emit(['kx', pass ? 1 : 0, name]);
    flushAll();
    api.kickDone && api.kickDone(pass, name);
    api.pauseForVote && api.pauseForVote(false);
  }

  function kickNow(uid) {
    const m = mates.get(uid);
    if (!m || !m.connected) return;
    m.q.push(['out']);
    G.Net.send(m.uid, hostFrame(m));
    mateGone(uid, true);
    emit(['gone', uid]);
    flushAll();
  }

  /** El ticket se lo queda quien lo recogió (o quien ganó la rueda). */
  function giveTicket(uid, key, n) {
    if (!active) return;
    if (uid === me) { api.grantTicket && api.grantTicket(key, n); return; }
    const m = mates.get(uid);
    if (m && m.connected) m.q.push(['tk', key, n]);
  }

  /** Anfitrión: se acabó para todos. */
  function over(data) {
    emit(['ov', data]);
    flushAll();
    end();
  }

  return {
    ANIMS, COLORS, begin, end, leave, tick, players, puppets, xpFactor, scaleRate, scaleHp,
    cast, hit, status, hurtShown, enemyAdded, enemyGone, enemyShot, pickupAdded, pickupGone, say,
    propBroken, collected, shinyCaught, levelStart, localPicked, over, holdStart, holdEnd,
    roster, reportCards, voteTarget, voteCard, askKick, voteKick, giveTicket,
    /** Anfitrión: evento para todos. Invitado: evento para el anfitrión. */
    broadcast(ev) { emit(ev); },
    toHost(ev) { if (active && !host) { outEv.push(ev); flushClient(true); } },
    tellEvo(dex) {
      if (!active) return;
      if (host) emit(['evo', me, dex]);
      else { outEv.push(['evo', dex]); flushClient(true); }
    },
    mate(u) { return mates.get(u); },
    get mates() { return [...mates.values()]; },
    get members() { return members; },
    get active() { return active; },
    get isHost() { return active && host; },
    get local() { return local; }
  };
})();
