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
 *   anfitrión -> todos     { k:'start', seed, host, members:[{uid,name,dex,shiny}], tower? }
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

  const RECONNECT_MS = 45000;
  const CLIENT_STALL_MS = 7000;
  const SNAPSHOT_INTERVAL = 5;
  const SNAPSHOT_KEY = 'ps.coop.snapshot.v1';
  const reconnecting = new Map();
  const pingSent = new Map();
  const pingByUid = new Map();
  const incomingSnapshots = new Map();

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
  let hostDisconnected = false, hostReconnectUntil = 0, hostReconnectTimer = 0;
  // Cartas de nivel: número de la ronda (anfitrión), la última que te ha llegado
  // y la última que has elegido (invitado). Y el último "quién elige" aplicado.
  let levelSeq = 0, levelNow = 1, seenSeq = 0, doneSeq = 0, lastHo = '';
  const STALL_MS = 2500;
  let members = [];
  let lastBoard = null;            // daño y tiempo muerto al cerrar la partida en grupo
  let runConfig = null;
  let recoveryPaused = false;
  let resumeSync = null;
  let resumeSyncError = '';
  let resumeSeq = 0;
  let countdownId = 0;
  let countdownUntil = 0;
  let countdownTimer = 0;
  let pingElapsed = 0;
  let remoteRoster = [];
  let snapshotElapsed = 0;
  let snapshotPublishedAt = 0;
  let snapshotBroadcastAt = 0;
  let migrationStarted = false;

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
    for (const pending of reconnecting.values()) {
      clearTimeout(pending.timer);
    }
    reconnecting.clear();
    pingSent.clear();
    pingByUid.clear();
    recoveryPaused = false;
    resumeSync = null;
    resumeSyncError = '';
    countdownId = 0;
    countdownUntil = 0;
    clearTimeout(countdownTimer);
    countdownTimer = 0;
    pingElapsed = 0;
    snapshotElapsed = 0;
    snapshotPublishedAt = 0;
    snapshotBroadcastAt = 0;
    for (const transfer of incomingSnapshots.values()) clearTimeout(transfer.timer);
    incomingSnapshots.clear();
    migrationStarted = false;
    remoteRoster = [];
    clearTimeout(hostReconnectTimer);
    hostReconnectTimer = 0;
    active = true;
    me = G.Net.uid; hostUid = cfg.host;
    host = me === hostUid;
    local = pl;
    api = cb;
    members = cfg.members;
    runConfig = Object.assign({}, cfg, { roomId: G.Social.room && G.Social.room.id });
    delete runConfig.authoritySnapshot;
    mates.clear();
    outEv = cfg.resume ? [['rere']] : [];
    flushT = 0; waiting = new Set(); holds = new Set();
    offers = new Map(); levelSince = 0; cardVote = null; kickVote = null;
    hostAway = false; stalled = false; hostDisconnected = false; hostReconnectUntil = 0;
    lastHostAt = performance.now();
    levelSeq = 0; levelNow = 1; seenSeq = 0; doneSeq = 0; lastHo = '';
    lastBoard = null;
    cfg.members.forEach((m, i) => {
      const x = (i - (cfg.members.length - 1) / 2) * 34, y = 0;
      if (m.uid === me) { pl.x = x; pl.y = y; pl.uid = me; pl.coopHost = host; pl.tagColor = COLORS[i]; return; }
      const mon = G.DEX_BY[m.dex] || G.DEX_BY[25];
      const p = new G.Player(mon, {}, !!m.shiny);
      p.remote = true; p.uid = m.uid; p.tag = m.name; p.tagColor = COLORS[i]; p.revLabel = 'Quédate a su lado';
      p.x = x; p.y = y;
      p.net = { x, y, ang: Math.PI / 2, walk: 0, hp: p.maxHp, maxHp: p.maxHp, dead: 0, mv: G.startMoveOf(mon.dex), ml: 1, mag: 78, aim: Math.PI / 2, rev: 0 };
      G.Sprites.preload([mon.dex], 8000, p.shiny);
      const mate = { uid: m.uid, name: m.name, color: COLORS[i], pl: p, connected: true, left: false,
        awaitingResumeStart: false, resumeReady: true, lastSeenAt: performance.now(), q: [], flushT: 0, xpMul: 1 };
      const savedState = cfg.authoritySnapshot && cfg.authoritySnapshot.frame
        && cfg.authoritySnapshot.frame.p && cfg.authoritySnapshot.frame.p[m.uid];
      if (savedState) {
        mate.state = savedState;
        p.net = readState(savedState);
        p.x = Number(savedState[0]) || p.x;
        p.y = Number(savedState[1]) || p.y;
      }
      mates.set(m.uid, mate);
    });
    if (cfg.resume && cfg.resumeState && cfg.resumeTo === me) {
      const s = cfg.resumeState;
      const hp = Number(s[4]);
      pl.x = Number(s[0]) || pl.x;
      pl.y = Number(s[1]) || pl.y;
      pl.moveAngle = Number(s[2]) || pl.moveAngle;
      if (Number.isFinite(hp)) pl.hp = G.U.clamp(hp, 0, pl.maxHp);
      pl.dead = !!s[6] || pl.hp <= 0;
      pl.magnet = Number(s[9]) || pl.magnet;
      pl.aim = Number(s[10]) || pl.aim;
      pl.reviveT = Number(s[12]) || 0;
      pl.item = s[13] || null;
      if (pl.dead) pl.anim.play('Faint', { hold: true });
    }
    if (cfg.authoritySnapshot && host) {
      recoveryPaused = true;
      if (api.connectionPause) api.connectionPause(true);
      if (G.ConnectionUI) G.ConnectionUI.open();
      for (const mate of mates.values()) if (!mate.left) startReconnectWindow(mate.uid);
    }
    if (cfg.resume && !host) {
      recoveryPaused = true;
      if (api.connectionPause) api.connectionPause(true);
      if (G.ConnectionUI) G.ConnectionUI.open();
    }
  }

  /** Daño y segundos caído de cada uno, para la pestaña Equipo del resumen. */
  function takeBoard() {
    if (!local) return null;
    const mine = (G.Social && G.Social.me && G.Social.me.name) || 'Tú';
    const rows = [{ name: mine, dex: local.dex, shiny: !!local.shiny, dmg: Math.round(local.dmgDealt || 0), down: Math.round(local.deadTime || 0) }];
    for (const m of mates.values()) {
      if (!m.connected || !m.pl) continue;
      rows.push({ name: m.name || '—', dex: m.pl.dex, shiny: !!m.pl.shiny, dmg: Math.round(m.pl.dmgDealt || 0), down: Math.round(m.pl.deadTime || 0) });
    }
    return rows.length > 1 ? rows : null;
  }

  function scoreboard() { return active && local ? takeBoard() : lastBoard; }

  function end() {
    if (!active) return;
    lastBoard = takeBoard();
  function end(preserveSnapshot = false) {
    for (const pending of reconnecting.values()) {
      clearTimeout(pending.timer);
    }
    reconnecting.clear();
    clearTimeout(hostReconnectTimer);
    hostReconnectTimer = 0;
    if (recoveryPaused) {
      recoveryPaused = false;
      if (api.connectionPause) api.connectionPause(false);
    }
    if (resumeSync && resumeSync.timer) clearTimeout(resumeSync.timer);
    resumeSync = null;
    countdownId = 0;
    countdownUntil = 0;
    clearTimeout(countdownTimer);
    countdownTimer = 0;
    pingSent.clear();
    pingByUid.clear();
    hostDisconnected = false;
    const roomId = runConfig && runConfig.roomId;
    const runId = runConfig && runConfig.runId;
    if (!preserveSnapshot && roomId && runId) {
      try { localStorage.removeItem(snapshotStorageKey(roomId, runId)); }
      catch (e) { console.warn('[Coop] No se pudo borrar la copia local:', e); }
    }
    active = false; host = false; local = null;
    runConfig = null;
    mates.clear(); outEv = []; waiting = new Set(); holds = new Set();
    offers = new Map(); cardVote = null; kickVote = null;
    if (G.ConnectionUI && G.ConnectionUI.isOpen()) G.ConnectionUI.close(true);
  }

  /** Te vas de la partida (los demás siguen). */
  function leave() {
    if (!active) return Promise.resolve();
    const wasHost = host;
    if (host) {
      const snapshot = createAuthoritySnapshot();
      const saved = snapshot && storeAuthoritySnapshot(snapshot);
      if (snapshot) {
        recoveryPaused = true;
        if (api.connectionPause) api.connectionPause(true);
      }
      return (async () => {
        if (snapshot && saved) await sendAuthoritySnapshot(snapshot);
        try {
          await G.Social.departHost();
        } finally {
          end(wasHost);
        }
      })();
    } else {
      outEv.push(['bye']);
      flushClient(true);
      G.Social.setMemberState('left').catch(e => console.warn('[Coop] No se pudo marcar la salida:', e));
    }
    end(wasHost);
    return Promise.resolve();
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
            api.choosing && api.choosing() ? 1 : 0, doneSeq,
            r1(local.dmgDealt || 0), r1(local.deadTime || 0), local.angelLeft > 0 ? 1 : 0];
  }

  function readState(a) {
    return { x: a[0], y: a[1], ang: a[2], walk: a[3], hp: a[4], maxHp: a[5], dead: a[6], mv: a[7], ml: a[8],
             mag: a[9], aim: a[10], xpMul: a[11], rev: a[12], item: a[13] || '',
             ch: a[14], ld: a[15], dmg: a[16] || 0, down: a[17] || 0, angel: a[18] ? 1 : 0 };
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

  function enemyListAll() {
    const out = [];
    for (const e of G.EnemyMgr.all()) {
      if (e.dead) continue;
      const a = ANIMS.indexOf(e.anim.cur);
      out.push([e.id, r1(e.x), r1(e.y), Math.ceil(e.hp), a < 0 ? 0 : a, e.anim.dir,
        (e.burn > 0 ? 1 : 0) | (e.poison > 0 ? 2 : 0) | (e.shield > 0 ? 4 : 0),
        Math.ceil(e.shield || 0)]);
    }
    return out;
  }

  function hostFrame(m, includeEvents = true) {
    const st = api.team();
    const p = { [me]: myState() };
    for (const o of mates.values()) {
      if (o.connected && o.uid !== m.uid && o.state) p[o.uid] = o.state;
    }
    const ev = includeEvents ? m.q : [];
    if (includeEvents) m.q = [];
    const f = { k: 'f', t: r2(st.time), lv: st.level, xp: r2(st.xp), xn: st.xpNext, ki: st.kills, bo: st.bosses, co: st.coins, tk: [st.t1, st.t10, st.tb, st.tg],
             p, e: enemyList(m.pl), ev };
    f.rp = recoveryPaused ? 1 : 0;
    f.rs = hostRoster();
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

  function hostRoster() {
    return members.map(member => {
      const pending = reconnecting.get(member.uid);
      const mate = mates.get(member.uid);
      const mode = member.uid === me ? 'direct' : G.Net.mode(member.uid);
      const offline = member.uid !== me && (mate && (mate.left || !mate.connected) || mode === 'closed' || mode === 'failed');
      const status = member.uid === me ? 'online'
        : pending || mate && mate.awaitingResumeStart || mode === 'connecting' ? 'reconnecting'
          : offline ? 'offline' : 'online';
      return {
        uid: member.uid,
        name: member.name,
        status,
        left: pending ? Math.max(0, Math.ceil((pending.until - Date.now()) / 1000)) : 0,
        ping: status === 'online' && pingByUid.has(member.uid) ? pingByUid.get(member.uid) : null
      };
    });
  }

  function pingPeers() {
    for (const [key, sent] of pingSent) {
      if (performance.now() - sent > 10000) pingSent.delete(key);
    }
    const targets = host ? [...mates.values()].filter(m => m.connected && !m.left).map(m => m.uid) : [hostUid];
    for (const uid of targets) {
      if (!uid) continue;
      const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      pingSent.set(uid + ':' + id, performance.now());
      G.Net.send(uid, { k: 'netPing', id });
    }
  }

  function snapshotStorageKey(roomId, runId) {
    return SNAPSHOT_KEY + ':' + roomId + ':' + runId;
  }

  function storeAuthoritySnapshot(snapshot) {
    if (!snapshot || !snapshot.roomId || !snapshot.runId) return false;
    try {
      localStorage.setItem(snapshotStorageKey(snapshot.roomId, snapshot.runId), JSON.stringify(snapshot));
    } catch (e) {
      console.warn('[Coop] No se pudo guardar la copia local de la partida:', e);
      return false;
    }
    if (Date.now() - snapshotPublishedAt >= 20000) {
      snapshotPublishedAt = Date.now();
      G.Social.publishSnapshot(snapshot.runId);
    }
    return true;
  }

  function sendAuthoritySnapshot(snapshot, to = null) {
    if (!snapshot) return Promise.resolve();
    const text = JSON.stringify(snapshot);
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const size = 8000;
    const count = Math.ceil(text.length / size);
    const send = msg => to ? G.Net.send(to, msg) : G.Net.broadcast(msg);
    send({ k: 'authoritySnapshotStart', id, count, runId: snapshot.runId, length: text.length });
    return new Promise(resolve => {
      let index = 0;
      const sendNext = () => {
        send({ k: 'authoritySnapshotPart', id, index, data: text.slice(index * size, (index + 1) * size) });
        index++;
        if (index < count) setTimeout(sendNext, 12);
        else setTimeout(resolve, 300);
      };
      sendNext();
    });
  }

  function receiveAuthoritySnapshotPart(from, msg) {
    const key = from + ':' + msg.id;
    const transfer = incomingSnapshots.get(key);
    if (!transfer || !Number.isInteger(msg.index) || msg.index < 0 || msg.index >= transfer.count
      || typeof msg.data !== 'string') return;
    if (transfer.parts[msg.index] === undefined) {
      transfer.parts[msg.index] = msg.data;
      transfer.received++;
      transfer.size += msg.data.length;
    }
    if (transfer.size > transfer.length || transfer.size > 4 * 1024 * 1024) {
      clearTimeout(transfer.timer);
      incomingSnapshots.delete(key);
      return;
    }
    if (transfer.received !== transfer.count) return;
    clearTimeout(transfer.timer);
    incomingSnapshots.delete(key);
    try {
      const snapshot = JSON.parse(transfer.parts.join(''));
      if (snapshot.runId === transfer.runId && snapshot.roomId === runConfig.roomId) {
        storeAuthoritySnapshot(snapshot);
      }
    } catch (e) {
      console.warn('[Coop] No se pudo reconstruir la copia recibida:', e);
    }
  }

  function readAuthoritySnapshot(roomId, runId) {
    try {
      const snapshot = JSON.parse(localStorage.getItem(snapshotStorageKey(roomId, runId)) || 'null');
      if (!snapshot || snapshot.version !== 1 || snapshot.roomId !== roomId || snapshot.runId !== runId) return null;
      return snapshot;
    } catch (e) {
      console.warn('[Coop] No se pudo leer la copia local de la partida:', e);
      return null;
    }
  }

  function createAuthoritySnapshot() {
    if (!host || !runConfig || runConfig.tower || G.Towers.active() || G.Rift.inArena || G.Rift.rift) return null;
    const frame = hostFrame({ uid: me, pl: local }, false);
    frame.e = enemyListAll();
    return {
      version: 1,
      roomId: G.Social.room && G.Social.room.id,
      runId: runConfig.runId,
      savedAt: Date.now(),
      runConfig,
      frame,
      world: G.World.snapshot(),
      enemies: G.EnemyMgr.snapshot(),
      pickups: G.Pickups.snapshot()
    };
  }

  /** Cada fotograma (también en la pantalla de subida de nivel). */
  function tick(dt) {
    if (!active) return;
    pingElapsed -= dt;
    if (pingElapsed <= 0) {
      pingElapsed = 2;
      pingPeers();
    }
    if (host) {
      snapshotElapsed -= dt;
      if (snapshotElapsed <= 0) {
        snapshotElapsed = SNAPSHOT_INTERVAL;
        const snapshot = createAuthoritySnapshot();
        if (snapshot && storeAuthoritySnapshot(snapshot) && Date.now() - snapshotBroadcastAt >= 15000) {
          snapshotBroadcastAt = Date.now();
          sendAuthoritySnapshot(snapshot);
        }
      }
      for (const m of mates.values()) {
        if (!m.left && m.connected && performance.now() - m.lastSeenAt > CLIENT_STALL_MS) {
          startReconnectWindow(m.uid);
        }
        if (!m.connected) continue;
        m.flushT -= dt;
        if (m.flushT > 0) continue;
        m.flushT = rateFor(m.uid);
        G.Net.send(m.uid, hostFrame(m));
      }
    } else {
      if (!stalled && performance.now() - lastHostAt > STALL_MS) {
        stalled = true;
        startHostReconnectWindow();
        updateAway();
      }
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
    if (host) {
      const mate = mates.get(from);
      if (mate && !mate.left) mate.lastSeenAt = performance.now();
    }
    if (msg.k === 'netPing') {
      G.Net.send(from, { k: 'netPong', id: msg.id });
      return;
    }
    if (msg.k === 'netPong') {
      const key = from + ':' + msg.id;
      const sent = pingSent.get(key);
      if (sent !== undefined) {
        pingByUid.set(from, Math.max(0, Math.round(performance.now() - sent)));
        pingSent.delete(key);
        if (G.ConnectionUI && G.ConnectionUI.isOpen()) G.ConnectionUI.render();
      }
      return;
    }
    if (msg.k === 'start') { if (G.Flow.startCoop) G.Flow.startCoop(msg); return; }
    if (msg.k === 'resumeError') {
      G.Social.finishRecovery();
      if (active && !host) {
        const lost = api.lost;
        end();
        if (lost) lost(msg.message || 'Ya no puedes volver a esta partida.');
        return;
      }
      G.UI.toast(msg.message || 'No se pudo reanudar la partida.', 4000);
      return;
    }
    if (!active) return;
    if (msg.k === 'authoritySnapshot' && !host && from === hostUid
      && msg.snapshot && msg.snapshot.runId === runConfig.runId) {
      storeAuthoritySnapshot(msg.snapshot);
      return;
    }
    if (!host && from === hostUid && msg.k === 'authoritySnapshotStart'
      && msg.runId === runConfig.runId && Number.isInteger(msg.count) && msg.count > 0
      && msg.count <= 512 && Number.isInteger(msg.length) && msg.length > 0
      && msg.length <= 4 * 1024 * 1024) {
      const key = from + ':' + msg.id;
      const old = incomingSnapshots.get(key);
      if (old) clearTimeout(old.timer);
      const transfer = {
        runId: msg.runId,
        count: msg.count,
        length: msg.length,
        parts: new Array(msg.count),
        received: 0,
        size: 0,
        timer: setTimeout(() => incomingSnapshots.delete(key), 30000)
      };
      incomingSnapshots.set(key, transfer);
      return;
    }
    if (!host && from === hostUid && msg.k === 'authoritySnapshotPart') {
      receiveAuthoritySnapshotPart(from, msg);
      return;
    }
    if (host && msg.k === 'resumeReq') {
      const mate = mates.get(from);
      if (mate && !mate.left && runConfig && msg.runId === runConfig.runId) {
        if (!reconnecting.has(from)) {
          startReconnectWindow(from);
        }
        restoreMate(from, true);
      }
      sendResumeStart(from, msg);
      return;
    }
    if (host && msg.k === 'resumeReady') {
      const mate = mates.get(from);
      if (mate && mate.awaitingResumeStart && runConfig && msg.runId === runConfig.runId) {
        restoreMate(from);
        mate.resumeReady = true;
        mate.awaitingResumeStart = false;
        mate.wasHost = false;
      }
      if (G.ConnectionUI && G.ConnectionUI.isOpen()) G.ConnectionUI.render();
      return;
    }
    if (host && msg.k === 'syncAck') { receiveSyncAck(from, msg); return; }
    if (!host && from === hostUid && msg.k === 'syncRun') {
      if (restoreRemoteWorld(msg)) G.Net.toHost({ k: 'syncAck', id: msg.id });
      return;
    }
    if (msg.k === 'resumeCountdown' && from === hostUid) {
      beginCountdown(msg.id, msg.seconds || 3);
      return;
    }
    if (msg.k === 'resumeGo' && from === hostUid) {
      finishCountdown(msg.id);
      return;
    }
    if (msg.k === 'resumeCancel' && from === hostUid) {
      cancelCountdown(msg.id);
      return;
    }
    if (!host && from === hostUid && msg.k === 'resumeWorld') {
      const ok = restoreRemoteWorld(msg);
      const ticket = G.Social.recoveryTicket();
      if (ok && ticket) G.Net.toHost({ k: 'resumeReady', runId: ticket.runId });
      return;
    }
    if (msg.k !== 'f') return;
    if (host) {
      const mate = mates.get(from);
      if (mate && reconnecting.has(from)) restoreMate(from);
      onClientFrame(from, msg);
    } else if (from === hostUid) onHostFrame(msg);
  });

  function sendResumeStart(uid, msg) {
    const mate = mates.get(uid);
    if (!host || !mate) return;
    if (!runConfig || msg.runId !== runConfig.runId || !mate.connected) {
      G.Net.send(uid, { k: 'resumeError', message: 'La partida ya terminó o tu plaza ya no puede reconectarse.' });
      return;
    }
    if (runConfig.tower || G.Towers.active() || G.Rift.inArena || G.Rift.rift || G.Events.current || G.Weather.current) {
      G.Net.send(uid, { k: 'resumeError', message: 'Por ahora sólo se puede reanudar una run normal fuera de torres, grietas, eventos y climas especiales.' });
      return;
    }
    mate.awaitingResumeStart = true;
    mate.resumeReady = false;
    G.Net.send(uid, Object.assign({}, runConfig, { resume: true, resumeTo: uid, resumeState: mate.state || null }));
  }

  function sendResumeWorld(uid) {
    const mate = mates.get(uid);
    if (!host || !mate || !mate.connected) return;
    const frame = hostFrame(mate, false);
    frame.e = enemyListAll();
    frame.ev = [];
    const entities = [];
    for (const e of G.EnemyMgr.all()) {
      if (e.dead) continue;
      entities.push(['ne', e.id, e.dex, r1(e.x), r1(e.y), e.boss ? 1 : 0, e.shiny ? 1 : 0,
        Math.ceil(e.maxHp), r2(e.dmg), e.behavior, e.towerPhase || 0]);
    }
    for (const p of G.Pickups.all()) {
      entities.push(['pk', p.id, p.kind, r1(p.x), r1(p.y), p.value, p.noMag ? 1 : 0]);
    }
    G.Net.send(uid, { k: 'resumeWorld', frame, world: G.World.snapshot(), entities });
  }

  function runSnapshot(uid) {
    const mate = mates.get(uid);
    if (!host || !mate) return null;
    const frame = hostFrame(mate, false);
    frame.e = enemyListAll();
    frame.ev = [];
    const entities = [];
    for (const e of G.EnemyMgr.all()) {
      if (e.dead) continue;
      entities.push(['ne', e.id, e.dex, r1(e.x), r1(e.y), e.boss ? 1 : 0, e.shiny ? 1 : 0,
        Math.ceil(e.maxHp), r2(e.dmg), e.behavior, e.towerPhase || 0]);
    }
    for (const p of G.Pickups.all()) {
      entities.push(['pk', p.id, p.kind, r1(p.x), r1(p.y), p.value, p.noMag ? 1 : 0]);
    }
    return { frame, world: G.World.snapshot(), entities };
  }

  function restoreRemoteWorld(msg) {
    if (msg.world && !G.World.restore(msg.world)) {
      G.UI.toast('No se pudo restaurar el terreno del anfitrión.', 3500);
      return false;
    }
    G.EnemyMgr.clearRemote();
    G.Pickups.clear();
    for (const ev of msg.entities || []) applyHostEvent(ev);
    if (msg.frame) onHostFrame(msg.frame);
    return true;
  }

  function resumeRun() {
    if (!host || !recoveryPaused || reconnecting.size || resumeSync || countdownId
      || [...mates.values()].some(mate => (!mate.connected || mate.awaitingResumeStart || !mate.resumeReady) && !mate.left)) return false;
    const connected = [...mates.values()].filter(m => m.connected && !m.left);
    const id = ++resumeSeq;
    const awaiting = new Set(connected.map(m => m.uid));
    resumeSyncError = '';
    resumeSync = { id, awaiting, timer: 0 };
    resumeSync.timer = setTimeout(() => {
      if (!resumeSync || resumeSync.id !== id) return;
      resumeSync = null;
      resumeSyncError = 'La sincronización no terminó. Pulsa Reanudar para volver a intentarlo.';
      if (G.ConnectionUI) G.ConnectionUI.render();
    }, 12000);
    if (!awaiting.size) {
      clearTimeout(resumeSync.timer);
      resumeSync = null;
      startResumeCountdown(id);
      return true;
    }
    for (const uid of awaiting) {
      const snapshot = runSnapshot(uid);
      if (!snapshot) continue;
      G.Net.send(uid, Object.assign({ k: 'syncRun', id }, snapshot));
    }
    if (G.ConnectionUI) G.ConnectionUI.render();
    return true;
  }

  function receiveSyncAck(uid, msg) {
    if (!resumeSync || msg.id !== resumeSync.id || !resumeSync.awaiting.has(uid)) return;
    resumeSync.awaiting.delete(uid);
    if (resumeSync.awaiting.size) {
      if (G.ConnectionUI) G.ConnectionUI.render();
      return;
    }
    clearTimeout(resumeSync.timer);
    resumeSync = null;
    startResumeCountdown(msg.id);
  }

  function startResumeCountdown(id) {
    countdownId = id;
    countdownUntil = Date.now() + 3000;
    if (G.ConnectionUI) {
      G.ConnectionUI.open();
      G.ConnectionUI.render();
    }
    for (const mate of mates.values()) {
      if (mate.connected && !mate.left) G.Net.send(mate.uid, { k: 'resumeCountdown', id, seconds: 3 });
    }
    clearTimeout(countdownTimer);
    countdownTimer = setTimeout(() => {
      countdownTimer = 0;
      if (countdownId !== id || !active || !host) return;
      for (const mate of mates.values()) {
        if (mate.connected && !mate.left) G.Net.send(mate.uid, { k: 'resumeGo', id });
      }
      finishCountdown(id);
    }, 3000);
  }

  function beginCountdown(id, seconds) {
    countdownId = id;
    countdownUntil = Date.now() + Math.max(1, seconds) * 1000;
    recoveryPaused = true;
    if (api.connectionPause) api.connectionPause(true);
    if (G.ConnectionUI) {
      G.ConnectionUI.open();
      G.ConnectionUI.render();
    }
  }

  function finishCountdown(id) {
    if (countdownId !== id) return;
    clearTimeout(countdownTimer);
    countdownTimer = 0;
    countdownId = 0;
    countdownUntil = 0;
    recoveryPaused = false;
    resumeSyncError = '';
    if (api.connectionPause) api.connectionPause(false);
    if (G.ConnectionUI && G.ConnectionUI.isOpen()) G.ConnectionUI.close(true);
    if (host) {
      emit(['rp', 0]);
      flushAll();
    }
  }

  function cancelCountdown(id) {
    if (countdownId !== id) return;
    countdownId = 0;
    countdownUntil = 0;
    if (G.ConnectionUI && G.ConnectionUI.isOpen()) G.ConnectionUI.render();
  }

  function cancelResumeSync() {
    if (resumeSync && resumeSync.timer) clearTimeout(resumeSync.timer);
    resumeSync = null;
    resumeSyncError = '';
    if (countdownId) {
      const id = countdownId;
      clearTimeout(countdownTimer);
      countdownTimer = 0;
      countdownId = 0;
      countdownUntil = 0;
      for (const mate of mates.values()) {
        if (mate.connected && !mate.left) G.Net.send(mate.uid, { k: 'resumeCancel', id });
      }
    }
    if (G.ConnectionUI && G.ConnectionUI.isOpen()) G.ConnectionUI.render();
  }


  function restoreMate(uid, awaitingResumeStart = false) {
    const mate = mates.get(uid);
    const pending = reconnecting.get(uid);
    if (!mate || mate.left) return;
    if (pending && !awaitingResumeStart) {
      clearTimeout(pending.timer);
      reconnecting.delete(uid);
    }
    mate.left = false;
    mate.connected = true;
    mate.lastSeenAt = performance.now();
    mate.awaitingResumeStart = awaitingResumeStart;
    if (!awaitingResumeStart) mate.resumeReady = true;
    mate.q = [];
    mate.flushT = 0;

    if (G.ConnectionUI && G.ConnectionUI.isOpen()) G.ConnectionUI.render();
  }

  G.Net.onPeer((u, mode) => {
    if (!active) {
      if (mode === 'direct' && G.Social.resumePending && G.Social.room && !G.Social.room.isHost) {
        const ticket = G.Social.recoveryTicket();
        if (ticket) G.Net.toHost({ k: 'resumeReq', runId: ticket.runId });
      }
      return;
    }

    if (host) {
      if (mode === 'direct') {
        const mate = mates.get(u);
        if (mate && !mate.left && reconnecting.has(u)) restoreMate(u);
        if (recoveryPaused) {
          sendResumeWorld(u);
          const snapshot = createAuthoritySnapshot();
          if (snapshot && storeAuthoritySnapshot(snapshot)) sendAuthoritySnapshot(snapshot, u);
        }
        return;
      }
      if (mode === 'closed' || mode === 'failed') {
        startReconnectWindow(u);
      }
      return;
    }

    if (u === hostUid && (mode === 'closed' || mode === 'failed')) {
      startHostReconnectWindow();
      if (mode === 'failed') G.Net.retry(hostUid);
    }
  });

  window.addEventListener('offline', () => {
    if (!active) return;
    if (host) {
      for (const mate of mates.values()) if (mate.connected && !mate.left) startReconnectWindow(mate.uid);
    } else startHostReconnectWindow();
  });

  window.addEventListener('online', () => {
    if (!active) return;
    if (host) {
      for (const uid of reconnecting.keys()) G.Net.retry(uid);
    } else if (hostDisconnected) G.Net.retry(hostUid);
  });

  G.Social.on(() => {
    if (!active || !runConfig) return;
    const room = G.Social.room;
    if (!room || room.id !== runConfig.roomId || room.host === hostUid) return;

    const previousHost = hostUid;
    hostUid = room.host;
    host = hostUid === me;
    hostDisconnected = false;
    stalled = false;
    clearTimeout(hostReconnectTimer);
    hostReconnectTimer = 0;
    hostReconnectUntil = 0;
    recoveryPaused = true;
    resumeSyncError = '';
    cancelResumeSync();
    if (api.connectionPause) api.connectionPause(true);

    if (host) {
      const snapshot = readAuthoritySnapshot(room.id, runConfig.runId);
      if (!snapshot || !G.Game.restoreCoopCheckpoint(snapshot)) {
        console.error('[Coop] El nuevo anfitrión no pudo restaurar la última copia de la partida.');
        G.UI.toast('No se pudo restaurar la copia compartida de la partida.', 5000);
        return;
      }
      runConfig = Object.assign({}, snapshot.runConfig, { host: me });
      local.coopHost = true;
      const memberByUid = new Map(room.members.map(member => [member.uid, member]));
      for (const mate of mates.values()) {
        mate.state = snapshot.frame.p && snapshot.frame.p[mate.uid] || mate.state;
        mate.lastSeenAt = performance.now();
        const member = memberByUid.get(mate.uid);
        mate.left = !member || member.state === 'left';
        mate.wasHost = mate.uid === previousHost && !mate.left;
        mate.connected = false;
        mate.awaitingResumeStart = false;
        mate.resumeReady = false;
        if (!mate.left) startReconnectWindow(mate.uid);
      }
      G.Net.open(room.id, true, me);
      G.Net.syncMembers(room.members.map(member => member.uid));
      G.Spawner.say('El grupo está cambiando de anfitrión. La partida sigue pausada.', 4);
      flushAll();
    } else {
      local.coopHost = false;
      G.Net.open(room.id, false, hostUid);
      updateAway();
      if (G.ConnectionUI) {
        G.ConnectionUI.open();
        G.ConnectionUI.render();
      }
    }
  });

  function attemptHostMigration() {
    if (!active || !hostDisconnected || host || migrationStarted) return;
    const room = G.Social.room;
    if (!room || !runConfig || runConfig.tower) return;
    const snapshot = readAuthoritySnapshot(room.id, runConfig.runId);
    if (!snapshot) {
      resumeSyncError = 'No hay una copia local válida para continuar esta partida.';
      if (G.ConnectionUI) G.ConnectionUI.render();
      return;
    }
    migrationStarted = true;
    G.Social.takeOverHost(runConfig.runId).then(tookOver => {
      migrationStarted = false;
      if (!tookOver && active && hostDisconnected) {
        setTimeout(attemptHostMigration, 5000);
      }
    }).catch(e => {
      migrationStarted = false;
      console.error('[Coop] No se pudo elegir un nuevo anfitrión:', e);
      resumeSyncError = 'No se pudo elegir un nuevo anfitrión. Se volverá a intentar.';
      if (G.ConnectionUI) G.ConnectionUI.render();
      if (active && hostDisconnected) setTimeout(attemptHostMigration, 5000);
    });
  }

  async function resumeAsHost() {
    if (active) return false;
    const room = G.Social.room;
    const ticket = G.Social.recoveryTicket();
    if (!room || !room.isHost || !ticket || ticket.roomId !== room.id) return false;
    if (G.Game.state !== 'ui') {
      G.UI.toast('Vuelve al menú antes de recuperar la partida como anfitrión.', 4000);
      return false;
    }

    const snapshot = readAuthoritySnapshot(room.id, ticket.runId);
    if (!snapshot || !snapshot.runConfig || snapshot.runConfig.runId !== ticket.runId
      || !Array.isArray(snapshot.runConfig.members)) {
      G.UI.toast('No se encontró una copia local válida para recuperar la partida como anfitrión.', 4500);
      return false;
    }
    let roomMembers;
    try {
      const [hostSnap, runSnap, membersSnap] = await Promise.all([
        G.DB.fb.rtdb.ref('rooms/' + room.id + '/host').get(),
        G.DB.fb.rtdb.ref('rooms/' + room.id + '/activeRun').get(),
        G.DB.fb.rtdb.ref('rooms/' + room.id + '/m').get()
      ]);
      if (hostSnap.val() !== me || runSnap.val() !== ticket.runId) {
        G.UI.toast('La sala ya no corresponde a esta partida. Vuelve al menú y actualiza la sala.', 4500);
        return false;
      }
      roomMembers = membersSnap.val() || {};
    } catch (e) {
      console.error('[Coop] No se pudo comprobar la plaza del anfitrión:', e);
      G.UI.toast('No se pudo comprobar tu plaza en la sala. Revisa la conexión e inténtalo otra vez.', 4500);
      return false;
    }
    if (!roomMembers[me]) {
      G.UI.toast('El anfitrión ya no tiene una plaza registrada en esta sala.', 4500);
      return false;
    }
    const present = new Set(Object.keys(roomMembers).filter(uid => roomMembers[uid].state !== 'left'));
    present.add(me);
    const cfg = Object.assign({}, snapshot.runConfig, {
      host: me,
      resume: true,
      authoritySnapshot: snapshot,
      members: snapshot.runConfig.members.filter(member => present.has(member.uid))
    });
    if (!cfg.members.some(member => member.uid === me)) {
      const own = roomMembers[me];
      cfg.members.push({
        uid: me,
        name: own.name || G.Social.me.name,
        dex: Number(own.dex) || G.DB.save.partner,
        shiny: !!own.shiny,
        st: own.st || null
      });
    }

    const startMessage = Object.assign({}, cfg);
    delete startMessage.authoritySnapshot;
    G.Net.broadcast(startMessage);
    G.Flow.startCoop(cfg);
    return true;
  }

  function reconnectCheckpointPeers() {
    if (!active || !host || !recoveryPaused) return;
    for (const mate of mates.values()) {
      if (mate.left) continue;
      if (G.Net.mode(mate.uid) === 'direct') {
        restoreMate(mate.uid);
        sendResumeWorld(mate.uid);
      } else {
        G.Net.retry(mate.uid);
      }
    }
  }

  function startHostReconnectWindow() {
    if (!active || host || hostReconnectTimer) return;
    hostDisconnected = true;
    resumeSyncError = '';
    hostReconnectUntil = Date.now() + RECONNECT_MS;
    hostReconnectTimer = setTimeout(() => {
      hostReconnectTimer = 0;
      if (!active || !hostDisconnected) return;
      attemptHostMigration();
      if (G.ConnectionUI) G.ConnectionUI.render();
    }, RECONNECT_MS);
    recoveryPaused = true;
    if (api.connectionPause) api.connectionPause(true);
    if (G.ConnectionUI) {
      G.ConnectionUI.open();
      G.ConnectionUI.render();
    }
    updateAway();
  }

  function startReconnectWindow(uid) {
    const mate = mates.get(uid);
    if (!mate || mate.left || reconnecting.has(uid)) return;

    cancelResumeSync();
    mate.connected = false;
    mate.awaitingResumeStart = false;
    mate.resumeReady = false;
    const pending = { until: Date.now() + RECONNECT_MS, timer: 0 };
    pending.timer = setTimeout(() => {
      if (reconnecting.get(uid) !== pending) return;
      reconnecting.delete(uid);
      if (mate.connected) {
        G.Net.send(uid, { k: 'resumeError', message: 'Se agotaron los 45 segundos y el anfitrión reanudará sin tu jugador.' });
      }
      mateGone(uid);
      if (mate.wasHost && G.Social.removeDepartedHost) {
        G.Social.removeDepartedHost(uid);
        mate.wasHost = false;
      }
      if (G.ConnectionUI && G.ConnectionUI.isOpen()) G.ConnectionUI.render();
    }, RECONNECT_MS);
    reconnecting.set(uid, pending);
    syncReconnectPause();

    G.Spawner.say(mate.name + ' intenta reconectarse…', 3);
    if (G.ConnectionUI) {
      G.ConnectionUI.open();
      G.ConnectionUI.render();
    }
  }

  function mateGone(u, quiet) {
    const m = mates.get(u);
    if (!m || m.left) return;
    const pending = reconnecting.get(u);
    if (pending) {
      clearTimeout(pending.timer);
      reconnecting.delete(u);
    }
    m.left = true;
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
    syncReconnectPause();
  }

  function syncReconnectPause() {
    if (!host || recoveryPaused) return;
    recoveryPaused = true;
    resumeSyncError = '';
    if (api.connectionPause) api.connectionPause(true);
    if (G.ConnectionUI) G.ConnectionUI.open();
    emit(['rp', 1]);
    flushAll();
  }

  // --- en el anfitrión ---

  function onClientFrame(from, msg) {
    const m = mates.get(from);
    if (!m || !m.connected) return;
    if (reconnecting.has(from) && !m.awaitingResumeStart) restoreMate(from);
    if (!m.awaitingResumeStart) m.wasHost = false;
    if (!m.awaitingResumeStart) m.resumeReady = true;
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
          m.awaitingResumeStart = true;
          m.resumeReady = false;
          sendResumeWorld(from);
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
  function updateAway() { if (api.away) api.away(hostAway || stalled || hostDisconnected ? nameOf(hostUid) : null); }

  // Anfitrión: al irse de la pestaña avisa a todos al momento (después ya no
  // podrá mandar nada) y al volver, que sigue.
  document.addEventListener('visibilitychange', () => {
    if (!active || !host) return;
    emit(['ha', document.hidden ? 1 : 0]);
    flushAll();
  });

  function onHostFrame(msg) {
    lastHostAt = performance.now();
    if (msg.rs) remoteRoster = msg.rs;
    if (msg.rp) {
      recoveryPaused = true;
      if (api.connectionPause) api.connectionPause(true);
      if (G.ConnectionUI) G.ConnectionUI.open();
    }
    if (stalled || hostDisconnected) {
      stalled = false;
      hostDisconnected = false;
      clearTimeout(hostReconnectTimer);
      hostReconnectTimer = 0;
      hostReconnectUntil = 0;
      updateAway();
      if (G.ConnectionUI && G.ConnectionUI.isOpen()) G.ConnectionUI.render();
    }
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
                              friendly: false, color: ev[9] ? '#2f7494' : '#ff7a9e',
                              vis: ev[9] ? { proj: 'shard', pal: 'iceDark' } : G.VFX.forType(ev[8]), mtype: ev[8] });
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
      case 'rp': if (api.connectionPause) api.connectionPause(!!ev[1]); break;
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
  function enemyShot(p, type, dark) { emit(['es', r1(p.x), r1(p.y), r1(p.vx), r1(p.vy), r2(p.dmg), p.r, p.life, type, dark ? 1 : 0]); }
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

  function connectionState() {
    const now = Date.now();
    const players = host ? hostRoster() : (remoteRoster.length ? remoteRoster : members.map(member => ({
      uid: member.uid, name: member.name, status: member.uid === hostUid ? 'online' : 'reconnecting', left: 0, ping: null
    }))).map(player => Object.assign({}, player));
    if (!host) {
      const mine = players.find(player => player.uid === me);
      const hostPlayer = players.find(player => player.uid === hostUid);
      if (mine) {
        mine.status = hostDisconnected ? 'reconnecting' : 'online';
        mine.ping = !hostDisconnected && pingByUid.has(hostUid) ? pingByUid.get(hostUid) : null;
      }
      if (hostPlayer && hostDisconnected) {
        hostPlayer.status = 'reconnecting';
        hostPlayer.left = Math.max(0, Math.ceil((hostReconnectUntil - now) / 1000));
      }
    }
    const unresolved = reconnecting.size > 0
      || (host && [...mates.values()].some(mate => (!mate.connected || mate.awaitingResumeStart || !mate.resumeReady) && !mate.left));
    const paused = recoveryPaused || hostDisconnected || stalled;
    const countdown = countdownId ? Math.max(1, Math.ceil((countdownUntil - now) / 1000)) : 0;
    let message = 'Todos los jugadores están conectados.';
    if (countdown) message = 'Grupo sincronizado. La partida se reanudará en breve.';
    else if (resumeSync) message = 'Sincronizando la partida para todos…';
    else if (resumeSyncError) message = resumeSyncError;
    else if (unresolved) message = 'Esperando a que todos vuelvan o venza el plazo de 45 segundos…';
    else if (paused && host) message = 'El grupo está listo. El anfitrión puede reanudar la partida.';
    else if (paused) message = 'Esperando a que el anfitrión reanude la partida…';
    return {
      message,
      players,
      mine: players.find(player => player.uid === me) || null,
      host,
      hostDisconnected,
      paused,
      syncing: !!resumeSync,
      canResume: host && paused && !unresolved && !resumeSync && !countdown,
      countdown
    };
  }

  function reconnect() {
    if (!active || host || !hostDisconnected) return false;
    return G.Net.retry(hostUid);
  }

  function abandonReconnect() {
    if (!active || host || !hostDisconnected) return false;
    leave();
    G.Game.quit();
    G.Social.leaveRoom().catch(e => console.warn('[Coop] No se pudo salir de la sala:', e));
    G.Net.close();
    return true;
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
    roster, reportCards, voteTarget, connectionState, reconnect, resumeRun, abandonReconnect, resumeAsHost, reconnectCheckpointPeers, voteCard, askKick, voteKick, giveTicket,
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
    scoreboard,
    get active() { return active; },
    get isHost() { return active && host; },
    get local() { return local; }
  };
})();
