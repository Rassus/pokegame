/* ============ game.js — flujo del juego y bucle principal ============
 *
 *   login ──> test de personalidad ──> menú ──> run ──> resumen ──> menú
 *                (sólo la 1ª vez)          │
 *                                          ├─ Pokémon (colección)
 *                                          ├─ Mejoras
 *                                          └─ Gacha
 *
 * Estados del bucle: 'ui' (menús, con el mundo de fondo), 'playing',
 * 'levelup', 'paused', 'over'.
 *
 * Cooperativo (G.Coop.active): el anfitrión lleva enemigos, objetos y
 * experiencia; cada uno su Pokémon. La pausa no para el juego, las cartas de
 * nivel esperan a que elijan todos y un compañero caído se levanta si otro
 * se queda a su lado. Ver net/coop.js.
 */
G.Game = (() => {
  let cv, ctx, dpr = 1, w = 0, h = 0;
  let state = 'ui';
  let time = 0, last = 0, pendingLevels = 0, qaDirty = false;
  let pl = null;
  let caught = [];          // shinies conseguidos en esta run
  let biome = -1;
  let fogGrad = null;          // niebla: el mismo degradado, el alpha lo pone globalAlpha

  const st = { get time() { return time; } };

  // ---------------- arranque ----------------

  function init() {
    cv = document.getElementById('game');
    ctx = cv.getContext('2d');
    resize();
    addEventListener('resize', resize);
    G.Touch.init(cv);
    // En móvil: al cambiar de app o girarlo en vertical, la partida se pausa.
    document.addEventListener('visibilitychange', () => { if (document.hidden) { noteCkpt(true); autoPause(); } });
    addEventListener('pagehide', () => noteCkpt(true));
    G.RunUI.wirePause(() => { state = 'playing'; G.UI.hideAll(); }, quitRun);
    Backdrop.init();
    last = performance.now();
    requestAnimationFrame(loop);
  }

  function resize() {
    // Resolución interna como mucho ×1,5: en pantallas ×2 dibujar el doble de
    // píxeles era de lo que más costaba, y con el pixel art no se nota.
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    w = cv.clientWidth; h = cv.clientHeight;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    G.Camera.resize(w, h, dpr);
    checkOrientation();
  }

  /** Móvil en vertical: aviso de girarlo (y pausa). */
  function checkOrientation() {
    const portrait = G.Touch.active && innerHeight > innerWidth;
    const el = document.getElementById('rotate');
    if (!el) return;
    if (portrait && !document.getElementById('rotate-ico').innerHTML) document.getElementById('rotate-ico').innerHTML = G.Icons.html('phone', 48);
    el.classList.toggle('hidden', !portrait);
    if (portrait) autoPause();
  }

  /** Pausa sola (sólo en solitario: en grupo los demás siguen). */
  function autoPause() {
    G.Touch.reset();
    if (state === 'playing' && !G.Coop.active) { state = 'paused'; G.RunUI.showPause(); }
  }

  /** Pausa/continúa (tecla Esc o P, o el botón de pausa del móvil). */
  let holdBy = [];                   // grupo: quién está eligiendo fusión (todo parado)
  let openItem = null;               // { cur, next, take } elección de objeto sin terminar
  const laterItems = [];             // objetos recogidos con las cartas de nivel abiertas

  function togglePause() {
    if (G.QA && G.QA.blocking()) { G.QA.closePanel(); return; }
    // En grupo la pausa no para el juego (los demás siguen jugando).
    // También durante las cartas: así se puede sacar a quien no elige.
    if (G.Coop.active) {
      if (state !== 'playing' && state !== 'levelup' && state !== 'held') return;
      if (G.UI.isOpen('scr-pause')) G.UI.hide('scr-pause');
      else { G.RunUI.showPause(true); G.Audio.sfx('pause'); }
      return;
    }
    if (state === 'playing') { state = 'paused'; G.RunUI.showPause(); G.Audio.sfx('pause'); }
    else if (state === 'paused') { state = 'playing'; G.UI.hideAll(); }
  }

  // ---------------- run ----------------

  /** @param coop  { seed, host, members } para una partida en grupo */
  function startRun(coop = null) {
    salvageCrash();
    const towerCfg = (coop && coop.tower) || G.Towers.peek();
    if (towerCfg && !G.Towers.charge(towerCfg)) {
      const why = G.Towers.afford(towerCfg);
      G.UI.toast(why === 'tickets'
        ? 'No tienes tickets grises para la torre (' + (towerCfg.tickets || 0) + ')'
        : 'No tienes Pokémonedas para la torre (' + G.U.num(towerCfg.share) + ')');
      if (coop && G.Social.room) G.LobbyUI.open();
      return;
    }
    if (G.Pass) {
      const mon0 = G.DEX_BY[G.DB.save.partner];
      G.Pass.beginRun(mon0 && mon0.dex, mon0 && mon0.types);
      if (towerCfg) G.Pass.towerPlayed(towerCfg, !!coop);
    }
    holdBy = []; awayBy = null;
    openItem = null; laterItems.length = 0;
    G.Towers.reset();
    G.Towers.claim();
    const save = G.DB.save;
    const mon = G.DEX_BY[save.partner];
    const perks = G.Upgrades.perks(G.DB.upgradesOf(mon.dex), G.DB.globalUpgrades());

    G.UI.hideAll();
    G.UI.chrome(false);
    G.FX.clear();
    G.Projectiles.clear();
    G.Combat.clearFields();
    G.EnemyMgr.clear();
    G.Pickups.clear();
    G.Spawner.reset();
    G.Rift.reset();
    G.Events.reset();
    G.Weather.reset();
    G.Path.clear();
    G.Hazards.clear();
    G.World.reset(coop ? coop.seed : Math.floor(Math.random() * 1e6));
    G.World.setBiome(0, true);
    biome = 0;
    time = 0; pendingLevels = 0; qaDirty = false;

    pl = new G.Player(mon, perks, !!save.partnerShiny && G.DB.ownsShiny(mon.dex), G.Gacha.grown(mon, save));
    banked = { t1: 0, t10: 0, tb: 0, tg: 0 };
    caught = [];
    // Atajos: movimientos con hueco fijo (save.pbind[dex] = [id del 1, id del 2, ...]),
    // antes de aprender nada: addMove ya los coloca.
    (save.pbind && save.pbind[mon.dex] || []).forEach((id, i) => { if (id) pl.bind[id] = i; });
    pl.addMove(G.startMoveOf(mon.dex));
    // Mejora "Veto": movimientos que no quieres que te salgan.
    pl.banned = new Set((save.pban && save.pban[mon.dex] || []).slice(0, perks.bans));
    // Mejora "Repertorio": un movimiento de ataque extra al empezar, por nivel.
    const extra = Math.max(0, perks.startMoves - 1);
    for (let i = 0; i < extra; i++) {
      const pool = G.Moves.poolFor(mon).filter(id => !pl.hasMove(id) && !pl.banned.has(id) && G.Moves.BY_ID[id].kind !== 'buff');
      if (!pool.length) break;
      pl.addMove(G.U.pick(pool));
    }
    if (extra) pl.setActive(0);

    if (coop) {
      G.Coop.begin(coop, pl, coopApi);
      G.Social.setPlaying(true);
    }
    G.Camera.x = pl.x; G.Camera.y = pl.y; G.Camera.shake = 0;
    // Hojas de sprites locales: el compañero y los primeros enemigos.
    G.Sprites.preload([mon.dex], 8000, pl.shiny);
    G.Audio.music(G.BIOME_MUSIC[0]);
    deathT = 0;
    if (towerCfg) G.Towers.begin(towerCfg);

    state = 'playing';
    // El invitado no tiene partida que recuperar: no se toca la copia de una cuenta.
    ckptId = G.DB.guest ? 0 : Date.now();
    ckptAt = 0;
    if (G.Social.pauseWatch) G.Social.pauseWatch();
    noteCkpt(true);
  }

  function quitRun() {
    if (G.Coop.active) G.Coop.leave();
    endRun(false);
  }

  /** Todos los jugadores de la partida (tú primero). */
  function everyone() { return G.Coop.active ? G.Coop.players() : [pl]; }

  /** Experiencia que hace falta para el siguiente nivel (cofres con candado). */
  function levelXp() {
    if (!pl) return 20;
    const k = (G.Coop.active ? G.Coop.xpFactor() : 1) * (pl.xpMul || 1);
    return Math.ceil((pl.xpNext - pl.xp + 1) / k);
  }

  // Destello de pantalla completa (viaje a la grieta).
  let flashT = 0, flashDur = 1, flashCol = '#fff';
  function flash(col, dur) { flashCol = col; flashDur = dur; flashT = dur; }

  function teamState() {
    return { time, level: pl.level, xp: pl.xp, xpNext: pl.xpNext, kills: pl.kills, bosses: pl.bosses, coins: pl.coins, t1: pl.t1, t10: pl.t10, tb: pl.tb, tg: pl.tg };
  }
  function summary() { return { t: time, ki: pl.kills, bo: pl.bosses, co: pl.coins, lv: pl.level, t1: pl.t1, t10: pl.t10, tb: pl.tb, tg: pl.tg }; }

  /** Oleada de la torre, para que el invitado use la del anfitrión. */
  function towerNet() {
    const s = G.Towers.snapshot();
    if (!s || s.duel) return null;
    const waves = s.waves || 100;
    return { wave: s.cleared ? waves : (s.wave || 0), waves, id: s.id, mode: s.mode || 'normal', cleared: s.cleared ? 1 : 0 };
  }

  /** Lo que el cooperativo necesita del juego. */
  /**
   * Los tickets recogidos se guardan en cuanto los coges (como los shinies):
   * antes sólo al acabar, y si la pestaña se cerraba de golpe se perdían.
   * `banked` = los de esta partida que ya están en la partida guardada.
   */
  let banked = { t1: 0, t10: 0, tb: 0, tg: 0 };
  function bankTickets(save_ = true) {
    const sv = G.DB.save;
    if (!sv || !pl) return;
    sv.tickets = Object.assign({ t1: 0, t10: 0, tb: 0, tg: 0 }, sv.tickets);
    const d = {
      t1: Math.max(0, pl.t1 - banked.t1), t10: Math.max(0, pl.t10 - banked.t10),
      tb: Math.max(0, pl.tb - banked.tb), tg: Math.max(0, pl.tg - banked.tg)
    };
    if (!d.t1 && !d.t10 && !d.tb && !d.tg) return;
    sv.tickets.t1 += d.t1; sv.tickets.t10 += d.t10; sv.tickets.tb += d.tb; sv.tickets.tg += d.tg;
    sv.stats = sv.stats || {};
    sv.stats.ticketsGot = (sv.stats.ticketsGot || 0) + d.t1 + d.t10 + d.tb + d.tg;
    if (G.Pass) G.Pass.ticketsEarn(d);
    banked = { t1: pl.t1, t10: pl.t10, tb: pl.tb, tg: pl.tg };
    if (save_) G.DB.commit();
  }

  const TICK_FX = { t1: ['ticket', '#c9cedb'], t10: ['morado', '#c47bff'], tb: ['azul', '#4fb4ff'], tg: ['dorado', '#ffd23f'] };

  /** Suma tickets a TU partida y los guarda. `quiet` = el aviso ya se pintó. */
  function addTickets(key, n, quiet) {
    if (!pl || !n) return;
    pl[key] = (pl[key] || 0) + n;
    bankTickets();
    if (quiet) return;
    const [word, col] = TICK_FX[key] || ['ticket', '#fff'];
    G.FX.dmgText(pl.x, pl.y - pl.bodyH - 8, '+' + n + ' ' + word, col, true);
    G.Audio.sfx(key === 'tg' ? 'shinyGet' : 'shiny');
  }

  let goldQ = 0;
  /** El anfitrión sortea un ticket dorado de jefe entre el grupo. */
  function queueGoldWheel() {
    if (!G.Coop.active || !G.Coop.isHost) return;
    goldQ++;
    if (state !== 'wheel') spinGold();
  }
  function spinGold() {
    if (!goldQ || !G.Coop.active) { goldQ = 0; return; }
    const people = G.Coop.roster();
    if (people.length < 2) { goldQ = 0; addTickets('tg', 1); return; }
    goldQ--;
    const win = Math.floor(Math.random() * people.length);
    const dur = Math.round((2 + Math.random() * 3) * 100) / 100;
    const names = people.map(p => p.name);
    const uids = people.map(p => p.uid);
    state = 'wheel';
    G.UI.hide('scr-pause');
    G.Coop.broadcast(['gw', dur, win, names, uids]);
    G.RunUI.showWheel(names, win, dur, () => {
      G.Coop.giveTicket(uids[win], 'tg', 1);
      G.Spawner.say('¡' + names[win] + ' se lleva el ticket dorado!', 3.2);
      if (goldQ > 0) spinGold();
      else if (state === 'wheel') state = 'playing';
    });
  }

  const coopApi = {
    team: teamState,
    summary,
    // Invitado: el anfitrión manda el reloj y lo del equipo.
    syncTeam(t) {
      if (Math.abs(t.time - time) > 0.4) time = t.time;
      if (t.level > pl.level) G.Audio.sfx('xp');
      pl.level = t.level; pl.xp = t.xp; pl.xpNext = t.xpNext;
      pl.kills = t.kills; pl.bosses = t.bosses; pl.coins = t.coins;
      // Los tickets no se copian: cada uno se queda los que recoge.
    },
    levelStart(level) {
      // Si tenías abierta la elección de objeto, vuelve al terminar: afterLevelUp.
      // level === 0: tienda de oleada (2 mejoras + baya). level < 0: tienda de objetos del jefe.
      if (state === 'choice' && openItem && G.Coop.active) G.Coop.holdEnd();
      state = 'levelup';
      G.UI.hide('scr-pause');
      G.Audio.sfx('levelup');
      const item = level < 0;
      const shop = level === 0;
      const cards = item ? G.Items.towerOffer(pl, 2) : shop ? G.LevelUp.shopOffer(pl) : G.LevelUp.offer(pl);
      G.RunUI.showLevelUp(level, cards, card => {
        G.Audio.sfx(item ? 'legend' : card.type === 'berry' ? 'heal' : 'confirm');
        card.apply(pl);
        G.Coop.localPicked();
      }, true, { shop, item });
    },
    waiting(names) { G.RunUI.setWaiting(names); },
    resume() {
      G.RunUI.closeLevelUp();
      G.RunUI.closeVote();
      // También desde la votación de expulsar: si no, al sacar al ausente la
      // partida se queda parada con las cartas o en kickvote.
      if (state === 'levelup' || state === 'kickvote') {
        state = holdBy.length ? 'held' : 'playing';
        afterLevelUp();
      }
    },
    /** ¿Estás eligiendo algo que para la partida (objeto o vínculo)? */
    choosing() { return state === 'choice'; },
    inLevelUp() { return state === 'levelup'; },
    shiny(dex) { G.onShinyCaught({ dex, name: (G.DEX_BY[dex] || {}).name || '' }); },
    over(d) {
      // En una torre cada uno se queda con su nivel, sus bajas y su premio.
      if (d && d.tw) G.Towers.stamp(d.tw);
      else if (d) Object.assign(pl, { kills: d.ki, bosses: d.bo, coins: d.co, level: Math.max(pl.level, d.lv || 1) });
      if (d && d.t) time = d.t;
      if (d && d.towerClear) G.Towers.markClear();
      if (d && d.why === 'host') G.UI.toast('El anfitrión ha terminado la partida', 3200);
      endRun(d && d.towerClear ? false : !(d && d.why === 'host'));
    },
    lost(msg) { G.UI.toast(msg, 3600); endRun(false); },
    item(id) { offerItem(id); },
    stone() { equipStone(); },
    mateLeft() {},
    grantTicket(key, n) { addTickets(key, n); },
    wheel(dur, win, names) {
      state = 'wheel';
      G.UI.hide('scr-pause');
      G.RunUI.showWheel(names, win, dur, () => { if (state === 'wheel') state = 'playing'; });
    },
    cardVote(uid, name, cards) {
      if (!G.Net || uid === G.Net.uid) return;
      G.RunUI.showCardVote(name, cards, i => G.Coop.voteCard(i));
    },
    forceCard(index) { G.RunUI.forcePick(index); },
    pauseForVote(on) {
      if (on) {
        if (state === 'playing' || state === 'paused' || state === 'levelup' || state === 'held') state = 'kickvote';
        G.UI.hide('scr-pause');
      } else if (state === 'kickvote') {
        state = holdBy.length ? 'held' : (G.UI.isOpen('scr-levelup') ? 'levelup' : 'playing');
      }
    },
    kickVote(uid, name) {
      if (state === 'playing' || state === 'paused' || state === 'levelup' || state === 'held') state = 'kickvote';
      G.UI.hide('scr-pause');
      G.RunUI.showKickVote(name, G.Net && uid === G.Net.uid, yes => G.Coop.voteKick(yes));
    },
    kickDone(pass, name) {
      G.RunUI.closeVote();
      G.UI.hide('scr-pause');
      if (state === 'kickvote') {
        if (holdBy.length) state = 'held';
        else if (G.UI.isOpen('scr-levelup')) state = 'levelup';
        else state = 'playing';
      }
      if (state === 'held' && !holdBy.length) state = 'playing';
      if (name) G.Spawner.say(pass ? name + ' sale de la partida' : name + ' se queda', 2.8, true);
    },
    kicked() {
      G.UI.toast('Te han sacado de la partida. Lo que habías recogido se queda guardado.', 4200);
      if (G.Coop.active) G.Coop.end();
      endRun(false);
    },
    /** Grupo: quién está eligiendo fusión. Mientras haya alguien, todo parado. */
    hold(names) {
      holdBy = names || [];
      const mine = G.UI.isOpen('scr-bond');
      if (holdBy.length) {
        if (state === 'playing') state = 'held';
        if (pl && pl.bonds > 0) offerBond(true);      // si tú también tienes vínculo, eliges a la vez
        const others = holdBy.filter(n => n !== (G.Social.me && G.Social.me.name) && n !== 'Tú');
        if (!mine && others.length) G.Spawner.say('Pausa: ' + others.join(', ') + ' ' + (others.length > 1 ? 'están eligiendo…' : 'está eligiendo…'), 999, true);
        else if (!others.length) G.Spawner.say(awayBy ? awayText() : '', awayBy ? 999 : 0, true);
      } else {
        if (state === 'held' && !awayBy) state = 'playing';
        G.Spawner.say(awayBy ? awayText() : '', awayBy ? 999 : 0, true);
      }
    },
    /** Grupo (invitado): el anfitrión se ha ido de la pestaña o no responde: todo parado. */
    away(name) {
      awayBy = name || null;
      if (awayBy) {
        if (state === 'playing') state = 'held';
        G.Spawner.say(awayText(), 999, true);
      } else if (!holdBy.length) {
        if (state === 'held') state = 'playing';
        G.Spawner.say('', 0, true);
      }
    }
  };
  let awayBy = null;
  const awayText = () => 'Pausa: esperando a ' + awayBy + ' (anfitrión)…';

  /** Has llevado a casa a un Pokémon perdido y se une a ti (events.js). */
  G.onRescue = (dex, name) => {
    if (!G.DB.save || !pl) return;
    const isNew = !G.DB.owns(dex);
    if (isNew) { G.DB.grant(dex, 'rescue'); G.DB.commit(); }
    else pl.coins += 150;
    G.Spawner.say(isNew ? '¡' + name + ' se une a tu equipo!' : '¡' + name + ' te da las gracias! (+150 monedas, ya lo tenías)', 4);
    G.Audio.sfx('shinyGet');
  };

  /** Un shiny salvaje cae: te lo quedas (y la versión normal si no la tenías). */
  G.onShinyCaught = e => {
    if (!G.DB.save || !pl) return;
    if (G.Coop.isHost) G.Coop.shinyCaught(e);
    const isNew = G.DB.grantShiny(e.dex, 'wild');
    G.DB.save.stats.shinies++;
    G.DB.commit();
    caught.push({ dex: e.dex, isNew });
    G.Spawner.say(isNew ? '¡Has conseguido a ' + e.name + ' shiny!' : '¡Otro ' + e.name + ' shiny! (+300 monedas)', 4);
    if (!isNew) pl.coins += 300;
    G.Audio.sfx('shinyGet');
  };

  // Copia de la run en este navegador, por si el proceso se cuelga y hay que
  // matarlo (el try/catch del bucle no llega a ejecutarse). Al volver a entrar
  // se cobra como una partida acabada hasta el último punto guardado.
  const CK_KEY = 'ps.run.ckpt';
  let ckptId = 0, ckptAt = 0;
  function readCkpt() {
    try { return JSON.parse(localStorage.getItem(CK_KEY) || 'null'); }
    catch (e) { return null; }
  }
  function clearCkpt() {
    ckptId = 0; ckptAt = 0;
    try { localStorage.removeItem(CK_KEY); } catch (e) { /* nada */ }
  }
  function noteCkpt(force) {
    if (G.DB.guest || !pl || state === 'ui' || state === 'over') return;
    const now = performance.now();
    if (!force && now - ckptAt < 15000) return;
    ckptAt = now;
    if (!ckptId) ckptId = Date.now();
    const tower = G.Towers.snapshot();
    const snap = {
      id: ckptId, t: time, lv: pl.level, ki: pl.kills | 0, bo: pl.bosses | 0, co: pl.coins | 0,
      mul: pl.coinMul || 1, dex: pl.dex, shiny: !!pl.shiny,
      coop: !!pl.uid, host: !!pl.coopHost,
      types: (pl.mon && pl.mon.types) || [],
      st: G.Upgrades.sheet((G.DB.save.pupg || {})[pl.dex]),
      team: G.Coop.active ? G.Coop.members.map(m => ({ uid: m.uid, name: m.name, dex: m.dex, shiny: !!m.shiny, st: m.st || null })) : null,
      tower: tower && !tower.duel ? {
        id: tower.id, mode: tower.mode || 'normal', dex: tower.dex,
        wave: tower.cleared ? (tower.waves || 100) : (tower.wave || 0),
        waves: tower.waves || 100, cleared: tower.cleared ? 1 : 0,
        reward: tower.reward || null
      } : null
    };
    try { localStorage.setItem(CK_KEY, JSON.stringify(snap)); } catch (e) { /* lleno */ }
  }

  /** La run cortada a la fuerza: monedas, tiempo, récords y ranking, sin repetir. */
  function salvageCrash() {
    const s = readCkpt();
    const save = G.DB.save;
    if (!s || !save || G.DB.guest) return null;
    if (save.salvagedRun === s.id) { clearCkpt(); return null; }
    const worth = (s.t || 0) >= 5 || s.ki || s.bo || (s.tower && s.tower.wave);
    if (!worth) { clearCkpt(); return null; }
    const mul = s.mul || 1;
    const parts = {
      tiempo: Math.floor((s.t || 0) / 5),
      derrotados: Math.floor((s.ki || 0) * 0.25),
      jefes: (s.bo || 0) * 80,
      recogidas: s.co || 0
    };
    let coins = Math.round((parts.tiempo + parts.derrotados + parts.jefes + parts.recogidas) * mul);
    const tower = s.tower;
    if (tower && tower.id) {
      const wave = tower.cleared ? (tower.waves || tower.wave || 0) : (tower.wave || 0);
      if (wave >= 1) {
        G.Towers.remember(tower.id, tower.mode, wave);
        save.stats.towerBest = Math.max(save.stats.towerBest || 0, wave);
        if (tower.cleared) {
          save.tower100 = save.tower100 || {};
          save.tower100[tower.id] = (save.tower100[tower.id] || 0) + 1;
        }
        save.rankPending = {
          kind: 'tower',
          r: {
            id: tower.id, mode: tower.mode || 'normal', wave, cleared: !!tower.cleared,
            time: Math.floor(s.t || 0), dex: s.dex, shiny: !!s.shiny, lv: s.lv | 0, kills: s.ki | 0, st: s.st || null
          },
          group: (s.coop && s.host && s.team && s.team.length >= 2) ? s.team : null
        };
      }
      const rw = tower.cleared && tower.reward;
      if (rw) {
        if (rw.caughtShiny) {
          if (G.DB.grantShiny(tower.dex, 'tower')) save.stats.shinies = (save.stats.shinies || 0) + 1;
        } else if (rw.caught) G.DB.grant(tower.dex, 'tower');
        if (rw.frags && G.Evo) {
          const key = String(G.Evo.root(tower.dex));
          save.frags[key] = (save.frags[key] || 0) + rw.frags;
        }
        if (rw.gold) coins += rw.gold;
        if (rw.ticket) {
          save.tickets = Object.assign({ t1: 0, t10: 0, tb: 0, tg: 0 }, save.tickets);
          save.tickets.tg += rw.ticket;
          save.stats.ticketsGot = (save.stats.ticketsGot || 0) + rw.ticket;
          if (G.Pass) G.Pass.ticketsEarn({ tg: rw.ticket });
        }
      }
    } else if (s.coop && s.host && s.team && s.team.length >= 2) {
      save.rankPending = { kind: 'group', r: { t: Math.floor(s.t || 0), lv: s.lv | 0, kills: s.ki | 0, members: s.team } };
    } else if (!s.coop) {
      save.rankPending = { kind: 'solo', r: { t: Math.floor(s.t || 0), lv: s.lv | 0, kills: s.ki | 0, dex: s.dex, shiny: !!s.shiny, st: s.st || null } };
    }
    save.coins += coins;
    save.stats.runs = (save.stats.runs || 0) + 1;
    save.stats.totalKills = (save.stats.totalKills || 0) + (s.ki || 0);
    if (!tower) save.stats.bestTime = Math.max(save.stats.bestTime || 0, Math.floor(s.t || 0));
    if (s.coop && !tower) save.stats.bestGroupTime = Math.max(save.stats.bestGroupTime || 0, Math.floor(s.t || 0));
    save.stats.bestLevel = Math.max(save.stats.bestLevel || 0, s.lv || 1);
    save.stats.bestKills = Math.max(save.stats.bestKills || 0, s.ki || 0);
    save.stats.bestBosses = Math.max(save.stats.bestBosses || 0, s.bo || 0);
    save.stats.coinsEarned = (save.stats.coinsEarned || 0) + coins;
    save.salvagedRun = s.id;
    G.Progress.event('runEnd', { time: s.t || 0, level: s.lv || 1, coins: s.co || 0, types: s.types || [], group: !!s.coop, dex: s.dex || 0, kills: s.ki || 0, bosses: s.bo || 0, tower: !!(s.tower && s.tower.id), gain: coins });
    G.Progress.checkAch();
    G.DB.commit();
    if (G.Social.me) G.Social.publishProfile();
    flushRank();
    clearCkpt();
    return { time: Math.floor(s.t || 0), coins };
  }

  /** Sube al ranking lo que quedó pendiente de una run recuperada. */
  function flushRank() {
    const save = G.DB.save;
    const p = save && save.rankPending;
    if (!p || !G.Social.me) return;
    delete save.rankPending;
    G.DB.commit();
    if (p.kind === 'tower') {
      G.Ranking.submitTower(p.r);
      if (p.group) G.Ranking.submitTowerGroup(Object.assign({}, p.r, { members: p.group }));
    } else if (p.kind === 'group') G.Ranking.submitGroup(p.r);
    else G.Ranking.submitSolo(p.r);
  }

  function endRun(dead = true) {
    if (state === 'over' || !pl) return;
    if (G.Social.resumeWatch) G.Social.resumeWatch();
    const coop = !!pl.uid;                    // sólo las partidas en grupo le ponen uid
    const wasHost = !!pl.coopHost;
    const team = coop ? G.Coop.members.slice() : [];
    const teamBoard = coop && G.Coop.scoreboard ? G.Coop.scoreboard() : null;
    if (G.Coop.active) G.Coop.end();
    if (coop) G.Social.setPlaying(false);
    state = 'over';
    G.Audio.music(null);
    G.Audio.sfx(dead ? 'gameover' : 'back');
    const save = G.DB.save;
    const mul = pl.coinMul || 1;
    const parts = {
      tiempo: Math.floor(time / 5),
      derrotados: Math.floor(pl.kills * 0.25),
      jefes: pl.bosses * 80,
      recogidas: pl.coins
    };
    const baseGold = parts.tiempo + parts.derrotados + parts.jefes + parts.recogidas;
    let coins = Math.round(baseGold * mul);
    const pay = { base: baseGold, mul: mul.toFixed(2).replace('.', ','), got: coins };
    const tower = G.Towers.take();
    let towerInfo = null;
    if (tower && !tower.duel) {
      const wave = tower.cleared ? (tower.waves || 100) : (tower.wave || 0);
      const prev = G.Towers.remember(tower.id, tower.mode, wave);
      save.stats.towerBest = Math.max(save.stats.towerBest || 0, wave);
      if (tower.cleared && tower.id) {
        save.tower100 = save.tower100 || {};
        save.tower100[tower.id] = (save.tower100[tower.id] || 0) + 1;
      }
      const modeName = (G.Towers.MODES.find(m => m.id === tower.mode) || G.Towers.MODES[0]).name;
      towerInfo = {
        name: (G.DEX_BY[tower.dex] && G.DEX_BY[tower.dex].name) || '',
        mode: modeName, wave, waves: tower.waves || 100,
        cleared: !!tower.cleared, best: wave > prev
      };
      if (wave >= 1) {
        const row = {
          id: tower.id, mode: tower.mode || 'normal', wave, cleared: !!tower.cleared,
          time: Math.floor(time), dex: pl.dex, shiny: !!pl.shiny, lv: pl.level | 0, kills: pl.kills | 0,
          st: G.Upgrades.sheet((save.pupg || {})[pl.dex])
        };
        G.Ranking.submitTower(row);
        if (wasHost && team.length >= 2) G.Ranking.submitTowerGroup(Object.assign({}, row, { members: team }));
      }
    }
    let caughtName = '';
    let towerExtra = '';
    if (tower && tower.cleared && !dead && tower.reward) {
      const nm = G.DEX_BY[tower.dex] && G.DEX_BY[tower.dex].name;
      const rw = tower.reward;
      if (nm && rw.caughtShiny) {
        if (G.DB.grantShiny(tower.dex, 'tower')) save.stats.shinies = (save.stats.shinies || 0) + 1;
        caughtName = nm;
        towerExtra = ' · shiny';
      } else if (nm && rw.caught) {
        G.DB.grant(tower.dex, 'tower');
        caughtName = nm;
      }
      if (rw.frags) {
        const key = String(G.Evo.root(tower.dex));
        save.frags[key] = (save.frags[key] || 0) + rw.frags;
        towerExtra += ' · ' + rw.frags + ' fragmentos de ' + (nm || '');
      }
      if (rw.gold) {
        coins += rw.gold;
        const tier = rw.tier || 1;
        const goldBase = rw.goldBase != null ? rw.goldBase : Math.round(rw.gold / tier);
        pay.prize = { base: goldBase, tier, gold: rw.gold };
      }
      if (rw.ticket) {
        save.tickets = Object.assign({ t1: 0, t10: 0, tb: 0, tg: 0 }, save.tickets);
        save.tickets.tg += rw.ticket;
        save.stats.ticketsGot = (save.stats.ticketsGot || 0) + rw.ticket;
        if (G.Pass) G.Pass.ticketsEarn({ tg: rw.ticket });
        towerExtra += rw.ticket === 1 ? ' · 1 ticket dorado' : ' · ' + rw.ticket + ' tickets dorados';
      }
    }
    const record = !qaDirty && !tower && time > save.stats.bestTime;

    save.coins += coins;
    bankTickets(false);
    save.stats.runs++;
    save.stats.totalKills += pl.kills;
    if (!qaDirty) {
      if (!tower) save.stats.bestTime = Math.max(save.stats.bestTime, Math.floor(time));
      if (coop && !tower) save.stats.bestGroupTime = Math.max(save.stats.bestGroupTime || 0, Math.floor(time));
      save.stats.bestLevel = Math.max(save.stats.bestLevel, pl.level);
      save.stats.bestKills = Math.max(save.stats.bestKills || 0, pl.kills || 0);
      save.stats.bestBosses = Math.max(save.stats.bestBosses || 0, pl.bosses || 0);
    }
    save.stats.coinsEarned += coins;
    G.Progress.event('runEnd', { time, level: pl.level, coins: pl.coins, types: pl.mon.types, group: coop, dex: pl.dex, kills: pl.kills || 0, bosses: pl.bosses || 0, tower: !!tower, gain: coins });
    G.Progress.checkAch();
    if (ckptId) save.salvagedRun = ckptId;
    G.DB.commit();
    if (ckptId) clearCkpt();
    if (G.Social.me) G.Social.publishProfile();

    // Ranking: en solitario cada uno lo suyo; en grupo lo sube el anfitrión.
    // La torre ya se apuntó arriba: cada jugador en solo y, si ibais juntos, el equipo.
    const mark = { t: Math.floor(time), lv: pl.level, kills: pl.kills, st: G.Upgrades.sheet((save.pupg || {})[pl.dex]) };
    if (!qaDirty && !tower && !coop) G.Ranking.submitSolo(Object.assign(mark, { dex: pl.dex, shiny: pl.shiny }));
    else if (!qaDirty && !tower && wasHost) G.Ranking.submitGroup(Object.assign(mark, { members: team }));

    const title = caughtName ? '¡' + caughtName + ' atrapado!' : (tower && tower.cleared ? '¡Torre superada!' : '');
    G.RunUI.showOver({
      dead, time, level: pl.level, kills: pl.kills, bosses: pl.bosses, coins, record, tower: towerInfo, t1: pl.t1, t10: pl.t10, tb: pl.tb, tg: pl.tg,
      moves: pl.moves, caught, title,
      dmg: pl.moves.map(m => ({
        id: m.id, name: m.name, lvl: m.lvl, type: m.type, kind: m.kind, stat: m.stat || '',
        dealt: pl.dmgBy[m.id] || 0, added: pl.buffAdd[m.id] || 0
      })),
      team: teamBoard,
      pay,
      breakdown: Object.entries(parts).filter(([, v]) => v).map(([k, v]) => `${k} ${G.U.num(v)}`).join(' · ') +
                 (caughtName ? ' · ' + caughtName + ' atrapado' : '') + towerExtra
    }, () => { pl = null; G.Flow.afterRun(); });
  }

  // ---------------- subida de nivel ----------------

  function openCards(level, list, shop) {
    state = 'levelup';
    G.Audio.sfx('levelup');
    G.RunUI.showLevelUp(level, list, card => {
      G.Audio.sfx(card.type === 'berry' ? 'heal' : 'confirm');
      card.apply(pl);
      state = 'playing';
    }, false, { shop: !!shop });
  }

  function maybeLevelUp() {
    if (pendingLevels <= 0 || state !== 'playing') return;
    if (G.Coop.active) {
      // En grupo, las cartas salen a la vez para todos y se espera a que elijan.
      if (G.Coop.players().every(p => p.dead)) return;
      pendingLevels--;
      G.Coop.levelStart(pl.level);
      return;
    }
    // Nunca abras cartas con el Pokémon caído (morir y recoger XP en el mismo frame).
    if (pl.dead) return;
    pendingLevels--;
    openCards(pl.level, G.LevelUp.offer(pl), false);
  }

  /** Torres: tienda cada 10 oleadas (Premio por oleada la adelanta hasta cada 5). */
  function maybeTowerShop() {
    if (state !== 'playing' || !G.Towers.wantShop || !G.Towers.wantShop()) return;
    G.Towers.clearShop();
    if (G.Coop.active) {
      if (G.Coop.players().every(p => p.dead)) return;
      G.Coop.levelStart(0);
      return;
    }
    if (pl.dead) return;
    openCards(0, G.LevelUp.shopOffer(pl), true);
  }

  /** Torres: al caer un jefe, 2 objetos y 1 cambio, para todos. */
  function maybeTowerItemShop() {
    if (state !== 'playing' || !G.Towers.wantItem || !G.Towers.wantItem()) return;
    if (G.Coop.active) {
      if (G.Coop.players().every(p => p.dead)) return;
      G.Towers.clearItem();
      G.Coop.levelStart(-1);
      return;
    }
    if (pl.dead) return;
    G.Towers.clearItem();
    state = 'levelup';
    G.Audio.sfx('levelup');
    G.RunUI.showLevelUp(0, G.Items.towerOffer(pl, 2), card => {
      G.Audio.sfx('legend');
      card.apply(pl);
      state = 'playing';
    }, false, { item: true });
  }

  // ---------------- vínculos ----------------

  /**
   * Vínculo de un legendario: eliges qué movimientos se fusionan.
   * Si ahora no se puede (no hay dos sueltos), se guarda hasta que aprendas
   * otro movimiento. Se mira en cada fotograma: si otra pantalla la tapa (cartas
   * de nivel en grupo, pausa), vuelve a salir al cerrarla.
   * @param quiet  no avisar si todavía no se puede
   */
  function offerBond(quiet = false) {
    if (!pl || pl.bonds <= 0 || pl.dead || (state !== 'playing' && state !== 'held') || G.Rift.inArena) return;
    if (['scr-bond', 'scr-pause', 'scr-item', 'scr-levelup'].some(G.UI.isOpen)) return;
    const opt = pl.bondOptions();
    if (!opt) {
      if (!quiet) G.Spawner.say('Guardas el vínculo: aprende otro movimiento para usarlo', 3, true);
      return;
    }
    // Se para el juego; en grupo, para todos hasta que cada uno elige (G.Coop.holdStart).
    state = 'choice';
    if (G.Coop.active) G.Coop.holdStart();
    G.Audio.sfx('levelup');
    G.RunUI.showBond(opt, picked => {
      const group = pl.fuse(picked, opt.group);
      G.Audio.sfx('legend');
      G.FX.ring(pl.x, pl.y, 8, 130, '#ff8ad8', 0.8, 6);
      G.FX.burst(pl.x, pl.y - pl.bodyH * 0.5, '#ffb3e6', 40, 240);
      G.Spawner.say('¡Vínculo! ' + group.length + ' movimientos a la vez', 2.6, true);
      if (state === 'choice') state = holdBy.length ? 'held' : 'playing';
      if (G.Coop.active) G.Coop.holdEnd();
    });
  }

  // ---------------- recogida ----------------

  const PICK_SFX = { xp: 'xp', xpBig: 'xp', coin: 'coin', heal: 'heal', bomb: 'break', magnet: 'confirm', ticket: 'shiny', ticket10: 'legend', ticketb: 'legend', ticketg: 'shinyGet', item: 'legend', evostone: 'legend', candy: 'legend' };

  /** Piedra Evolución: hueco propio, no sustituye al objeto de la run. */
  function equipStone() {
    if (!pl) return;
    if (pl.evoStone) { G.Spawner.say('Ya llevas la Piedra Evolución', 2, true); return; }
    pl.evoStone = true;
    G.Spawner.say('¡Piedra Evolución!', 2.6, true);
    G.Progress.event('item', { id: 'evostone' });
    G.FX.ring(pl.x, pl.y, 8, 70, '#c47bff', 0.55, 4);
  }

  /*
   * Cooperativo: la elección de objeto y las cartas de nivel no pueden taparse.
   * Si llega un objeto con las cartas abiertas, espera a que elijas carta; y si
   * las cartas llegan con la elección de objeto abierta, ésta vuelve a salir al
   * terminar. (Antes una cerraba la otra, nadie podía terminar de elegir y la
   * partida se quedaba parada para todos.)
   */
  function afterLevelUp() {
    if (state !== 'playing' && state !== 'held') return;
    if (openItem && !G.UI.isOpen('scr-item')) {
      const o = openItem;
      if (o.mine) { state = 'choice'; if (G.Coop.active) G.Coop.holdStart(); }
      G.RunUI.showItemChoice(o.cur, o.next, o.take);
      return;
    }
    if (laterItems.length) offerItem(laterItems.shift());
  }

  /** Has cogido un objeto: si no llevas ninguno te lo pones; si no, eliges. */
  function offerItem(id) {
    if (!pl || !G.Items.BY[id]) return;
    if (state === 'levelup' || G.UI.isOpen('scr-levelup')) { laterItems.push(id); return; }
    let mine = false;            // esta elección es la que ha parado el juego
    const take = got => {
      openItem = null;
      if (got !== pl.item) {
        pl.equip(got);
        G.Spawner.say('¡Llevas ' + G.Items.BY[got].name + '!', 2.6, true);
        G.Progress.event('item', { id: got });
      }
      if (!mine) { afterLevelUp(); return; }
      if (state === 'choice') state = holdBy.length ? 'held' : 'playing';
      if (G.Coop.active) G.Coop.holdEnd();
      afterLevelUp();
    };
    if (!pl.item) { take(id); return; }
    if (pl.item === id) { G.Spawner.say('Ya llevas ' + G.Items.BY[id].name, 2, true); return; }
    // Se para el juego mientras eliges; en grupo, para todos (como con las
    // fusiones). Antes en grupo seguía y te pegaban mientras elegías.
    if (state === 'playing' || state === 'held') {
      mine = true;
      state = 'choice';
      if (G.Coop.active) G.Coop.holdStart();
    }
    openItem = { cur: pl.item, next: id, take, get mine() { return mine; } };
    G.RunUI.showItemChoice(pl.item, id, take);
  }

  /** @param who  quien lo ha cogido (en cooperativo puede ser un compañero) */
  function onCollect(p, who = pl) {
    const mine = who === pl;
    if (G.Coop.active && !G.Coop.isHost) {
      // Copia de un objeto del anfitrión: el efecto lo decide él.
      if (mine) G.Audio.sfx(PICK_SFX[p.kind]);
      return;
    }
    if (G.Coop.active) G.Coop.collected(p, who);
    if (mine || p.kind === 'bomb') G.Audio.sfx(PICK_SFX[p.kind]);
    if (p.kind === 'xp' || p.kind === 'xpBig') {
      pendingLevels += pl.gainXp(p.value * (G.Coop.active ? G.Coop.xpFactor() : 1));
      return;
    }
    if (p.kind === 'coin') {
      let gain = p.value;
      // Boleto Ganador: ×1,5 en el momento de recogerlo, no al acabar la run.
      if (who && who.item === 'winticket') {
        who._coinBonus = (who._coinBonus || 0) + p.value * 0.5;
        const extra = Math.floor(who._coinBonus);
        who._coinBonus -= extra;
        gain += extra;
      }
      pl.coins += gain;
      G.FX.dmgText(who.x, who.y - who.bodyH - 6, '+' + gain, '#ffd23f');
      return;
    }
    if (p.kind === 'item') {
      if (mine) offerItem(p.value);
      return;
    }
    if (p.kind === 'evostone') {
      if (mine) equipStone();
      return;
    }
    if (p.kind === 'candy') {
      // Un nivel justo: llena la barra y no arrastra el sobrante.
      pl.xp = pl.xpNext;
      pendingLevels += pl.gainXp(0);
      G.FX.dmgText(who.x, who.y - (who.bodyH || 28) - 8, '+1 nivel', '#c47bff', true);
      G.FX.ring(who.x, who.y, 8, 90, '#c47bff', 0.75, 5);
      return;
    }
    const TICK = { ticket: ['t1', '+1 ticket', '#c9cedb'], ticket10: ['t10', '+1 morado', '#c47bff'], ticketb: ['tb', '+1 azul', '#4fb4ff'], ticketg: ['tg', '+1 dorado', '#ffd23f'] };
    if (TICK[p.kind]) {
      const [key, label, col] = TICK[p.kind];
      const doble = who && who.item === 'luckcharm' && Math.random() < 0.01;
      const n = doble ? 2 : 1;
      const text = doble ? label.replace('+1', '+' + n) : label;
      G.FX.dmgText(who.x, who.y - who.bodyH - 8, text, col, true);
      G.FX.ring(who.x, who.y, 6, 50, col, 0.4, 3);
    if (!who || who === pl || !who.uid || who.uid === pl.uid) addTickets(key, n, true);
      else G.Coop.giveTicket(who.uid, key, n);
      return;
    }
    if (p.kind === 'heal') {
      if (mine) pl.heal(pl.maxHp * 0.3);
      G.FX.ring(who.x, who.y, 6, 60, '#5fe08a', 0.4, 3);
      return;
    }
    if (p.kind === 'magnet') {
      G.Pickups.pullAll();
      G.FX.ring(who.x, who.y, 10, 420, '#ff9ed8', 0.6, 4);
      return;
    }
    if (p.kind === 'bomb') {
      if (G.U.dist2(who.x, who.y, pl.x, pl.y) < 500 * 500) G.Camera.kick(0.8);
      const R = G.Camera.outerRadius();
      G.FX.ring(who.x, who.y, 20, R, '#ff7b3d', 0.5, 6);
      for (const e of G.EnemyMgr.all()) {
        if (mine ? !G.Camera.sees(e.x, e.y, 0) : G.U.dist2(e.x, e.y, who.x, who.y) > R * R) continue;
        e.hurt(60 + pl.level * 14, '#ff7b3d', e.x - who.x, e.y - who.y, 160);
      }
    }
  }

  // ---------------- teclado ----------------

  function handleKeys() {
    if (G.SettingsUI.isOpen) { if (G.Input.tap('escape')) G.SettingsUI.close(); return; }
    if (G.QA && G.QA.blocking()) {
      if (G.Input.tap('escape')) G.QA.closePanel();
      return;
    }
    if (state === 'levelup') {
      if (G.Coop.active && (G.Input.tap('escape') || G.Input.tap('keyp'))) { togglePause(); return; }
      for (let i = 0; i < 3; i++) {
        if (G.Input.tap('digit' + (i + 1)) || G.Input.tap('numpad' + (i + 1))) G.RunUI.pick(i);
      }
      if (G.Input.tap('keyr')) G.RunUI.reroll();
      return;
    }
    if (G.UI.isOpen('scr-bond')) {
      for (let i = 0; i < 4; i++) {
        if (G.Input.tap('digit' + (i + 1)) || G.Input.tap('numpad' + (i + 1))) G.RunUI.pickBond(i);
      }
      return;
    }
    if (G.UI.isOpen('scr-item')) {
      for (let i = 0; i < 2; i++) {
        if (G.Input.tap('digit' + (i + 1)) || G.Input.tap('numpad' + (i + 1))) document.querySelectorAll('#item-cards .card')[i].click();
      }
      return;
    }
    if (state === 'ui') {
      // Esc en una subpantalla del menú vuelve al menú.
      if (G.Input.tap('escape')) {
        if (G.MenuUI.closeMove()) return;
        if (!G.UI.isOpen('scr-profile') && ['scr-dex', 'scr-upgrades', 'scr-gacha', 'scr-items', 'scr-towers', 'scr-friends', 'scr-rank', 'scr-goals'].some(G.UI.isOpen)
            && document.getElementById('pull-fx').classList.contains('hidden')) G.MenuUI.open();
      }
      return;
    }
    if (state === 'wheel' || state === 'kickvote') return;
    if (G.Input.tap('escape') || G.Input.tap('keyp')) { togglePause(); return; }
    if (state !== 'playing' || !pl) return;
    for (let i = 0; i < 4; i++) {
      if (G.Input.tap('digit' + (i + 1)) || G.Input.tap('numpad' + (i + 1))) pl.setActive(i);
    }
    if (G.Input.tap('keyq')) pl.cycle(-1);
    if (G.Input.tap('keye') || G.Input.tap('tab')) pl.cycle(1);
  }

  // ---------------- bucle ----------------

  let deathT = 0;

  let frameDt = 0, speedK = 1;
  let fpsShown = 60, fpsAcc = 0, fpsN = 0;
  // El siguiente fotograma se pide ANTES de nada: si algo falla a mitad, el
  // juego sigue (antes se quedaba congelado para siempre y había que recargar;
  // así se perdió una partida enorme al abrirse una grieta).
  // Si falla fotograma tras fotograma (el juego ya no avanza ni se ve), la
  // partida se da por terminada a los ~3 s y se guarda: tiempo, derrotados,
  // récords y ranking. Mejor eso que una pantalla negra y perderlo todo.
  let loopErrs = 0, errRun = 0;
  function loop(ts) {
    requestAnimationFrame(loop);
    try { frame(ts); errRun = 0; }
    catch (e) {
      if (loopErrs++ < 5) console.error('[Game] fallo en un fotograma:', e);
      G.Input.endFrame();
      if (++errRun === 180 && pl && state !== 'ui' && state !== 'over') {
        try {
          G.UI.hideAll();
          quitRun();
          G.UI.toast('El juego ha fallado: tu partida se ha guardado hasta aquí', 5000);
        } catch (e2) { console.error('[Game] no se pudo cerrar la partida:', e2); }
      }
    }
  }

  function frame(ts) {
    const real = (ts - last) / 1000 || 0;
    const dt = Math.min(1 / 30, real) * speedK;
    last = ts;
    if (state === 'playing') G.Settings.sample(real);
    fpsAcc += real; fpsN++;
    if (fpsAcc >= 0.5) { fpsShown = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
    frameDt = state === 'playing' ? dt : 0;

    handleKeys();
    if (G.QA && G.QA.tick) G.QA.tick();
    G.RunUI.tick(Math.min(0.05, real));

    if (state === 'playing') update(dt);
    else if (pl && state !== 'ui') { G.FX.update(dt * 0.25); pl.anim.update(dt * 0.25); }
    // La red se atiende siempre (también con las cartas de nivel abiertas).
    if (G.Coop.active && pl && state !== 'ui' && state !== 'over') G.Coop.tick(dt);

    if (pl && state !== 'ui') render(); else Backdrop.render(ctx, w, h, dpr, dt);
    G.UI.tick(dt);
    noteCkpt(false);

    G.Input.endFrame();
  }

  function update(dt) {
    const coop = G.Coop.active;
    if (flashT > 0) flashT -= dt;
    // El ángel solo gasta la vida cuando ya no hay quien te levante.
    if (pl.dead && pl.angelLeft > 0 && G.Towers.active() && !pl.mateCanRaise()) {
      pl.angelSave();
      deathT = 0;
    }
    // Tras caer, deja que se vea la animación de Faint antes del resumen.
    // (En la arena de la grieta no: allí caer sólo te echa de vuelta.)
    if (pl.dead && !coop && !G.Rift.inArena) {
      deathT += dt;
      pl.update(dt);
      G.EnemyMgr.update(dt * 0.3, pl);
      G.FX.update(dt);
      G.Camera.follow(pl.x, pl.y, dt);
      if (deathT > 1.3) { deathT = 0; endRun(true); }
      return;
    }
    time += dt;

    const b = Math.floor(time / 240);
    if (b !== biome && !G.Rift.inArena && !G.Towers.active()) {
      biome = b;
      G.World.setBiome(b);
      G.Audio.sfx('biome');
      G.Spawner.say('— ' + G.World.biomeName() + ' —', 3);
      G.FX.ring(pl.x, pl.y, 10, G.Camera.outerRadius(), '#ffffff', 0.7, 6);
    }

    pl.frozen = coop && (G.UI.isOpen('scr-pause') || G.UI.isOpen('scr-item'));
    pl.update(dt);
    if (coop) {
      for (const p of G.Coop.puppets()) { p.netUpdate(dt); G.Combat.ghostOrbit(p, dt, time); }
      if (pl.dead) reviveTick(dt);
    }
    G.Camera.follow(pl.x, pl.y, dt);
    G.World.update(dt, G.Camera);

    const all = everyone();
    if (!coop || G.Coop.isHost) G.Path.update(dt, all);
    if (G.Towers.active()) {
      G.Towers.update(dt, pl);
      // Si acabas de tumbar al jefe y puedes fusionar, se espera a esa pantalla.
      if (G.Towers.clearReady() && !(pl && !pl.dead && pl.bonds > 0 && pl.bondOptions())) {
        G.Towers.finish();
        if (G.Coop.isHost) {
          const tw = towerNet();
          G.Coop.over(Object.assign(summary(), { towerClear: 1 }, tw ? { tw } : {}));
        }
        endRun(false);
        return;
      }
    } else if (!coop || G.Coop.isHost) G.Spawner.update(dt, all, time);
    else G.Spawner.tickBanner(dt);
    G.EnemyMgr.update(dt, all);
    // Segunda rejilla: el combate tiene que ver dónde están ahora, no antes de moverse.
    G.EnemyMgr.rebuildGrid();
    G.Combat.tick(dt, pl, time);
    G.Projectiles.update(dt, pl, G.EnemyMgr.all());
    G.Combat.resolve(dt, pl, time);
    G.Combat.updateFields(dt);
    G.Pickups.update(dt, all, onCollect);
    G.Hazards.update(dt);
    G.Interact.update(dt, pl);
    if (!G.Towers.active()) {
      G.Rift.update(dt, pl, time);
      G.Events.update(dt, all, time);
    }
    G.Weather.update(dt, time, pl);
    G.FX.update(dt);

    G.Audio.music(G.Rift.inArena || G.Towers.active() ? 'rift' : G.EnemyMgr.bossAlive() ? 'boss' : G.BIOME_MUSIC[biome % G.BIOME_MUSIC.length]);
    if (!coop || G.Coop.isHost) {
      maybeTowerItemShop();
      maybeTowerShop();
      maybeLevelUp();
    }
    if (pl.bonds > 0) offerBond(true);
    if (G.Coop.isHost) checkAllDown(dt);
  }

  /** Caído en grupo: un compañero a tu lado te va levantando.
   *  En la torre, cada uno que esté a tu lado acorta el tiempo (3 s, 1,5 s, 1 s…). */
  function reviveTick(dt) {
    const n = G.Coop.puppets().filter(p => !p.dead && G.U.dist2(p.x, p.y, pl.x, pl.y) < 56 * 56).length;
    const rate = n > 0 && G.Towers.active() ? n : (n > 0 ? 1 : 0);
    pl.reviveT = rate ? (pl.reviveT || 0) + dt * rate : Math.max(0, (pl.reviveT || 0) - dt * 0.5);
    if (pl.reviveT >= G.Player.REVIVE_TIME) pl.revive(0.5);
  }

  /** Anfitrión: si caéis todos, se acaba (tras ver caer al último). */
  function checkAllDown(dt) {
    if (G.Rift.inArena || !G.Coop.players().every(p => p.dead)) { deathT = 0; return; }
    deathT += dt;
    // Si alguien aún tiene el ángel, su ordenador lo levanta y avisa. Se espera ese aviso.
    const angel = G.Towers.active() && G.Coop.players().some(p => (p.angelLeft || 0) > 0);
    if (deathT > (angel ? 3.5 : 1.6)) {
      deathT = 0;
      const tw = towerNet();
      G.Coop.over(Object.assign(summary(), tw ? { tw } : {}));
      endRun(true);
    }
  }

  // ---------------- dibujo ----------------

  function drawScene(cam, extra) {
    const t = performance.now() / 1000;
    G.World.drawGround(ctx, cam);
    G.World.drawLiquid(ctx, cam, t);
    G.Hazards.draw(ctx);
    G.Towers.draw(ctx);
    G.Combat.drawGroundFields(ctx);
    G.Pickups.draw(ctx);

    // Todo lo que tiene "pies" se ordena por Y: objetos, enemigos, jugador.
    const items = [];
    // Los planos (manantiales, trampas) siempre debajo de todo lo demás.
    for (const p of G.World.visibleProps(cam)) items.push({ y: p.flat ? p.y - 4000 : p.y, prop: p });
    for (const e of G.EnemyMgr.drawables(cam)) items.push({ y: e.y, ent: e });
    for (const e of extra) items.push({ y: e.y, ent: e });
    const rift = G.Rift.drawable();
    if (rift) items.push({ y: rift.y, ent: rift });
    if (pl && state !== 'ui') for (const d of G.Events.drawables()) items.push({ y: d.y, ent: d });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) {
      if (it.prop) G.World.drawProp(ctx, it.prop, t);
      else it.ent.draw(ctx);
    }
    G.Towers.drawAir(ctx);
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;

    ctx.save();
    ctx.scale(G.Camera.scale, G.Camera.scale);
    G.Camera.apply(ctx);
    drawScene(G.Camera, G.Coop.active ? [pl, ...G.Coop.puppets()] : [pl]);
    G.Projectiles.draw(ctx);
    G.Combat.drawAirFields(ctx);
    G.FX.draw(ctx);
    ctx.restore();

    G.Weather.draw(ctx, w, h, frameDt);
    if (pl) G.Towers.drawScreen(ctx, w, h, pl);
    G.World.drawVignette(ctx, w, h);
    // Niebla: la viñeta se cierra un poco (sin tapar el centro).
    const fog = G.Weather.vignette;
    if (fog > 0) {
      if (!fogGrad || fogGrad.ctx !== ctx || fogGrad.w !== w || fogGrad.h !== h) {
        const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.62);
        g.addColorStop(0, 'rgba(200,205,220,0)');
        g.addColorStop(1, 'rgba(200,205,220,0.45)');
        fogGrad = { ctx, w, h, g };
      }
      const prevA = ctx.globalAlpha;
      ctx.globalAlpha = prevA * fog;
      ctx.fillStyle = fogGrad.g;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = prevA;
    }
    G.HUD.draw(ctx, w, h, pl, st);
    G.Touch.draw(ctx);
    if (G.Settings.get('fps')) {
      ctx.save();
      ctx.font = '700 11px Pixelify, monospace';
      ctx.textAlign = 'right';
      ctx.fillStyle = fpsShown >= 50 ? '#5fe08a' : fpsShown >= 30 ? '#ffd23f' : '#ff5f6d';
      ctx.fillText(fpsShown + ' FPS', w - 10, h - 8);
      ctx.restore();
    }
    if (flashT > 0) {
      ctx.save();
      // "Menos destellos": el fogonazo de pantalla se queda en un tercio.
      ctx.globalAlpha = Math.min(1, flashT / flashDur * 1.4) * (G.Settings.get('calm') ? 0.3 : 1);
      ctx.fillStyle = flashCol;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  // ---------------- fondo de los menús ----------------

  /**
   * El mundo de verdad, con Pokémon salvajes paseando y la cámara a la deriva.
   * Así el menú enseña desde el primer segundo cómo se ve el juego.
   */
  const Backdrop = (() => {
    let wanderers = [], t = 0, ready = false, biomeT = 0, bi = 0;
    const CAST = [1, 4, 7, 25, 133, 52, 39, 35, 16, 43, 60, 69, 74, 92, 129, 147, 113, 143, 54, 79];

    function init() {
      G.World.reset(4242);
      G.World.setBiome(0, true);
      G.Camera.x = 0; G.Camera.y = 0;
      wanderers = CAST.map(dex => spawn(dex, true));
      ready = true;
    }

    function spawn(dex, anywhere) {
      const a = new G.Sprites.Animator(dex, 1);
      const r = G.Sprites.bodyRadius(dex);
      let x = 0, y = 0;
      for (let i = 0; i < 20; i++) {
        x = G.Camera.x + G.U.rand(-1, 1) * (anywhere ? G.Camera.w * 0.6 : G.Camera.w * 0.7);
        y = G.Camera.y + G.U.rand(-1, 1) * (anywhere ? G.Camera.h * 0.6 : G.Camera.h * 0.7);
        if (G.World.isFree(x, y, r)) break;
      }
      return { dex, anim: a, x, y, r, vx: 0, vy: 0, t: 0, draw(ctx) {
        G.Sprites.drawShadow(ctx, this.dex, this.x, this.y);
        this.anim.draw(ctx, this.x, this.y);
      } };
    }

    function step(dt) {
      t += dt;
      G.World.update(dt, G.Camera);
      // Deriva lenta de la cámara.
      G.Camera.x += Math.cos(t * 0.05) * 14 * dt;
      G.Camera.y += Math.sin(t * 0.037) * 10 * dt;
      G.Camera.follow(G.Camera.x, G.Camera.y, dt);

      biomeT += dt;
      if (biomeT > 30) { biomeT = 0; bi = (bi + 1) % 3; G.World.setBiome(bi); }

      for (const wd of wanderers) {
        wd.t -= dt;
        if (wd.t <= 0) {
          // Pasea, se para o "ataca" al aire de vez en cuando.
          wd.t = G.U.rand(1, 3.5);
          const r = Math.random();
          if (r < 0.55) {
            const a = Math.random() * 6.2832, s = G.U.rand(25, 55);
            wd.vx = Math.cos(a) * s; wd.vy = Math.sin(a) * s;
          } else {
            wd.vx = wd.vy = 0;
            if (r > 0.85) wd.anim.play(G.U.pick(['Attack', 'Shoot', 'Charge']));
          }
        }
        wd.x += wd.vx * dt; wd.y += wd.vy * dt;
        G.World.collide(wd);
        const moving = Math.abs(wd.vx) + Math.abs(wd.vy) > 1;
        if (moving) wd.anim.dir = G.Sprites.dirFromAngle(Math.atan2(wd.vy, wd.vx));
        wd.anim.loop(moving ? 'Walk' : 'Idle');
        wd.anim.update(dt);
        // Si se queda fuera de cámara, reaparece dentro.
        if (!G.Camera.sees(wd.x, wd.y, 120)) Object.assign(wd, spawn(wd.dex, false));
      }
    }

    function render(ctx, w, h, dpr, dt) {
      if (!ready) return;
      step(dt);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.save();
      ctx.scale(G.Camera.scale, G.Camera.scale);
      G.Camera.apply(ctx);
      drawScene(G.Camera, wanderers);
      ctx.restore();
      G.World.drawVignette(ctx, w, h);
    }

    /** Al volver de una run, recupera el mundo del menú. */
    function restore() {
      G.World.reset(4242);
      G.World.setBiome(bi, true);
      G.FX.clear(); G.Projectiles.clear(); G.Combat.clearFields(); G.EnemyMgr.clear(); G.Pickups.clear();
      wanderers = CAST.map(dex => spawn(dex, true));
    }

    return { init, render, restore };
  })();

  return {
    init, startRun, everyone, levelXp, flash, offerBond,
    /** Para pruebas: salta el reloj de la run. */
    debugTime(t) { time = t; },
    /** Para grabar vídeos: cámara lenta (0,5 = mitad de velocidad). */
    debugSpeed(k) { speedK = k; },
    togglePause,
    /** Abandona la partida en curso (p. ej. al cerrar sesión desde Ajustes). */
    quit() { if (state !== 'ui' && state !== 'over') quitRun(); },
    /** Para grabar vídeos: abre las cartas de subir de nivel. */
    debugLevelUp() { pl.level++; pendingLevels++; },
    /** Suma monedas de esta run. Sirve para probar el bloqueo de la consola. */
    debugCoins(n = 100000) { if (pl) pl.coins += Math.floor(n) || 0; },
    /** Pausa la run para una ventana del modo prueba. True si esta llamada la paró. */
    qaPause() {
      if (state !== 'playing') return false;
      state = 'paused';
      return true;
    },
    qaResume() {
      if (state === 'paused' && !G.UI.isOpen('scr-pause')) state = 'playing';
    },
    qaTouch() { qaDirty = true; },
    qaSetLevel(n) {
      if (!pl) return;
      n = Math.max(1, Math.min(9999, n | 0));
      pl.level = n;
      pl.xp = 0;
      pl.xpNext = G.Player.xpFor(n);
      qaDirty = true;
    },
    /** groups: [[{ id, lvl, evo }, ...], ...] — cada lista es un hueco (salen a la vez). */
    qaLoadout(groups) {
      if (!pl || !Array.isArray(groups)) return false;
      const moves = [];
      const slots = [];
      const seen = new Set();
      for (const g of groups) {
        if (slots.length >= pl.maxMoves || !Array.isArray(g)) continue;
        const slot = [];
        for (const spec of g) {
          if (slot.length >= G.Player.BOND_MAX) break;
          const id = spec && spec.id;
          const def = id && G.Moves.BY_ID[id];
          if (!def || seen.has(id)) continue;
          seen.add(id);
          const lvl = Math.max(1, Math.min(def.maxLvl, spec.lvl | 0 || 1));
          const m = G.Moves.instance(id, lvl);
          if (spec.evo) G.Moves.evolve(m);
          moves.push(m);
          slot.push(m);
        }
        if (slot.length) slots.push(slot);
      }
      if (!slots.length) return false;
      pl.moves = moves;
      pl.slots = slots;
      pl.active = 0;
      G.Projectiles.clearOrbs(pl);
      qaDirty = true;
      return true;
    },
    qaGod(on) {
      if (!pl) return;
      pl.god = !!on;
      qaDirty = true;
      if (on && pl.dead) { pl.revive(1); deathT = 0; }
    },
    qaPower(on) {
      if (!pl) return;
      pl.qaPow = !!on;
      qaDirty = true;
    },
    toUI() { state = 'ui'; Backdrop.restore(); },
    get state() { return state; },
    get player() { return pl && G.Guard ? G.Guard.wrap(pl) : pl; },
    /** Shinies conseguidos en esta run: { dex, isNew }. */
    get caught() { return caught; },
    queueGoldWheel, st, salvageCrash, flushRank
  };
})();
if (G.Guard) G.Guard.sealCalls(G.Game);

/* ============ Flow — transiciones entre pantallas ============ */
G.Flow = {
  boot() {
    G.UI.initChrome();
    G.LoginUI.init(); G.TestUI.init(); G.MenuUI.init(); G.GachaUI.init();
    G.SocialUI.init(); G.RankingUI.init(); G.GoalsUI.init(); G.ProfileUI.init(); G.SettingsUI.init();
    if (G.QA) G.QA.init();
    if (G.Admin) G.Admin.init();
    else if (/dev\.html$/i.test(location.pathname)) {
      const adm = document.createElement('script');
      adm.src = 'js/ui/admin.js';
      adm.onload = () => { if (G.Admin) G.Admin.init(); };
      document.body.appendChild(adm);
    }
    G.SupportUI.init(); G.NewsUI.init(); G.PassUI.init(); G.Updater.init();
    // Tu nombre arriba a la derecha abre tu perfil.
    document.getElementById('user-pill').onclick = () => G.GoalsUI.open('profile');
    G.Audio.music('village');     // suena tras el primer clic (lo exige el navegador)
    G.Game.init();
    // La base de datos (nube o local) recupera la sesión anterior.
    G.DB.ready().then(restored => {
      document.getElementById('boot').classList.add('hidden');
      // En otra tarea: crear el sonido para comprobarlo cuesta ~60 ms y no debe bloquear la carga.
      setTimeout(() => this.tapToStart(() => { if (restored) this.afterLogin(); else this.toLogin(); }), 0);
    });
  },
  /**
   * "Pulsa para empezar": los navegadores no dejan que una web suene hasta
   * que se toca algo. Con esta pantalla la música empieza en cuanto entras.
   * (Si el navegador ya deja sonar, no sale.)
   */
  tapToStart(then) {
    G.Audio.unlock();
    if (G.Audio.canPlay()) { then(); return; }
    const el = document.getElementById('tap-start');
    el.classList.remove('hidden');
    const go = e => {
      if (e.type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(e.key)) return;
      e.preventDefault(); e.stopPropagation();
      G.Audio.unlock();
      el.classList.add('hidden');
      el.removeEventListener('click', go); removeEventListener('keydown', go, true);
      then();
    };
    el.addEventListener('click', go);
    addEventListener('keydown', go, true);
  },
  toLogin() { G.Audio.music('village'); G.LoginUI.open(); },
  afterLogin() {
    G.Audio.music('village');
    const kept = G.Game.salvageCrash();
    if (kept) G.UI.toast('La partida anterior se cortó y se ha guardado hasta ' + G.U.mmss(kept.time) + ' (' + G.U.num(kept.coins) + ' Pokémonedas).', 6000);
    if (!G.DB.save.partner) G.TestUI.start();
    else this.goMenu();
  },
  goMenu() {
    if (G.Game.state !== 'ui') G.Game.toUI();
    G.Audio.music('village');
    G.MenuUI.open();
  },
  /** Al cerrar el resumen: a la sala si sigues en una, si no al menú. */
  afterRun() {
    if (G.Social.room) {
      if (G.Game.state !== 'ui') G.Game.toUI();
      G.Audio.music('village');
      if (G.Social.room.isHost) G.Social.setOpen(true);
      G.LobbyUI.open();
    } else this.goMenu();
  },
  play() { G.Game.startRun(); },
  /** Empieza la partida en grupo (el anfitrión la manda a todos). */
  startCoop(cfg) {
    if (G.Game.state !== 'ui' || !G.Social.room) return;
    G.Social.setReady(false);
    G.LobbyUI.close();
    G.Game.startRun(cfg);
  }
};
