/* ============ spawner.js — oleadas, jefes y shinies ============
 * Los enemigos aparecen en un anillo justo fuera de la vista, así que nunca
 * se materializan en pantalla. Cada ~45 s hay una "marea": una avalancha
 * concentrada desde un lado concreto, para romper el ritmo.
 *
 * Cada enemigo tiene 1/4096 de salir shiny (como en los juegos clásicos).
 * Una run mata 1.500–4.000, así que sale uno cada 1–3 partidas.
 *
 * Cooperativo (sólo en el anfitrión): aparecen alrededor de un jugador vivo
 * al azar, fuera de la vista de TODOS, y hay más y más fuertes según cuántos
 * jugáis (ver G.Coop.scaleRate / scaleHp).
 */
G.Spawner = (() => {
  // Tope de enemigos a la vez (antes 420: con tantos se ralentizaba). Cuando
  // se llega al tope, los que siguen saliendo son "élite" (más vida, daño y
  // experiencia), así la dificultad no baja.
  const CAP = 64, ELITE_FROM = 0.85;
  // Con menos Pokémon en pantalla, cada uno deja más experiencia.
  const XP_K = 5.6;
  const SHINY_RATE = 1 / 4096;
  let acc = 0, bossIdx = 0, surgeT = 32, announce = null, announceT = 0, preloadT = 0;
  // A partir del minuto 20: un jefe, y el siguiente entre 3 y 12 minutos después.
  let lateN = 0, lateAt = 20 * 60;
  // Tras salir de una grieta, ningún jefe puede salir hasta que pase esto.
  // Si no, el que tocaba durante la pelea aparece en la arena (a kilómetros).
  let bossWait = 0;
  const scriptedFired = new Set();
  let forceShiny = 0;           // para pruebas: los N próximos salen shiny

  function reset() {
    acc = 0; bossIdx = 0; surgeT = 32; announce = null; announceT = 0; preloadT = 0;
    lateN = 0; lateAt = 20 * 60; bossWait = 0;
    scriptedFired.clear();
    G.Enemies.rollRun();
    G.Sprites.preload(G.Enemies.upcomingDex(0, 80));
  }

  /** Enemigos por segundo según el minuto de la run (tabla PROGRESS). */
  function rate(t) {
    return G.Enemies.progressAt(t).rate;
  }

  /**
   * Escala de un salvaje. PROGRESS es un Pokémon normal del último tramo;
   * el resto queda en proporción a su plantilla.
   */
  function wildScale(t) {
    const p = G.Enemies.progressAt(t);
    return {
      sc: {
        hp: (p.hp / G.Enemies.REF_HP) * G.Coop.scaleHp(players.length),
        dmg: p.dmg / G.Enemies.REF_DMG,
        spd: 1 + Math.min(0.35, t / 1400)
      },
      dmgK: 1
    };
  }

  function ringPoint(pl, angle) {
    const d = G.Camera.outerRadius() + G.U.rand(10, 70);
    return [pl.x + Math.cos(angle) * d, pl.y + Math.sin(angle) * d * 0.9];
  }

  let players = [];

  /** ¿Lo vería algún jugador? (para no aparecer delante de nadie) */
  function seenByAnyone(x, y) {
    const r = G.Camera.outerRadius() - 30;
    return players.some(o => G.U.dist2(o.x, o.y, x, y) < r * r);
  }

  /** Punto del anillo donde quepa: no dentro de paredes ni en el agua. */
  function freePoint(pl, angle, flying) {
    for (let i = 0; i < 8; i++) {
      const a = angle + (i === 0 ? 0 : G.U.rand(-0.9, 0.9));
      const [x, y] = ringPoint(pl, a);
      if (players.length > 1 && seenByAnyone(x, y)) continue;
      if (flying || G.World.isFree(x, y, 14)) return [x, y];
    }
    return null;
  }

  /** Jugador alrededor del que sale el siguiente enemigo. */
  function anchor() {
    const alive = players.filter(o => !o.dead);
    return alive.length ? G.U.pick(alive) : players[0];
  }

  function scaled(sc, k) { return k === 1 ? sc : Object.assign({}, sc, { hp: sc.hp * k }); }

  function isFlyer(def) { return G.Sprites.hovers(def.dex); }

  function rollShiny(dex) {
    if (!G.Sprites.hasShiny(dex)) return false;
    if (forceShiny > 0) { forceShiny--; return true; }
    return Math.random() < SHINY_RATE;
  }

  function spawnOne(pl, t, angle) {
    const def = G.U.pick(G.Enemies.bagAt(t));
    const pt = freePoint(pl, angle == null ? Math.random() * 6.2832 : angle, isFlyer(def));
    if (!pt) return null;
    const shiny = rollShiny(def.dex);
    const sc = wildScale(t);
    const e = new G.Enemy(def, pt[0], pt[1], sc.sc);
    e.dmg *= sc.dmgK; e.xp = Math.round(e.xp * XP_K);
    if (G.EnemyMgr.count >= CAP * ELITE_FROM) { e.maxHp = e.hp = Math.round(e.maxHp * 1.6); e.dmg *= 1.25; e.xp = Math.round(e.xp * 1.6); }
    if (shiny) e.makeShiny();
    if (G.Events.golden) e.makeGolden();
    G.EnemyMgr.add(e);
    if (shiny) {
      say('¡Un ' + e.name + ' shiny anda cerca!', 3.4);
      G.Audio.sfx('shiny');
    }
    return e;
  }

  function spawnBoss(pl, t, b, at) {
    const [x, y] = at || ringPoint(pl, Math.random() * 6.2832);
    const n = Math.max(1, players.length);
    const sc = b.raw ? { hp: n, dmg: 1, spd: 1 } : scaled(G.Enemies.bossScale(t), n);
    const e = new G.Enemy(b, x, y, sc, true);
    if (rollShiny(b.dex)) e.makeShiny();
    G.EnemyMgr.add(e);
    say('¡' + e.name + (e.shiny ? ' shiny' : '') + ' salvaje apareció!', 3.2);
    G.Camera.kick(1.1);
    G.Audio.sfx('boss');
    return e;
  }

  function spawnKnown(pl, t, def, angle) {
    const pt = freePoint(pl, angle == null ? Math.random() * 6.2832 : angle, isFlyer(def));
    if (!pt) return null;
    const sc = wildScale(t);
    const e = new G.Enemy(def, pt[0], pt[1], sc.sc);
    e.dmg *= sc.dmgK; e.xp = Math.round(e.xp * XP_K);
    G.EnemyMgr.add(e);
    return e;
  }

  /** Eventos escritos en data/run-events.js. Una vez por partida. */
  function runScripted(t) {
    for (const ev of G.RunEvents || []) {
      if (scriptedFired.has(ev) || t < ev.min * 60) continue;
      if (ev.kind === 'rift') {
        if (!G.Rift.openScripted(ev.dex)) continue;
        say('¡Se abre una grieta!', 3);
      } else if (ev.kind === 'boss' && bossWait > 0) {
        continue;
      } else {
        const def = G.Enemies.scripted(ev.dex, ev.kind === 'boss');
        if (!def) { scriptedFired.add(ev); continue; }
        const who = anchor();
        if (ev.kind === 'boss') spawnBoss(who, t, def);
        else {
          const base = Math.random() * 6.2832;
          for (let i = 0; i < 10; i++) spawnKnown(who, t, def, base + G.U.rand(-0.5, 0.5));
          say('¡Marea de ' + def.name + '!', 2.6);
        }
      }
      scriptedFired.add(ev);
    }
  }

  /** @param who  el jugador o la lista de jugadores (cooperativo) */
  function update(dt, who, t) {
    players = Array.isArray(who) ? who : [who];
    if (announceT > 0) announceT -= dt;
    // En la arena de la grieta no sale nada más (el reloj de la run sigue,
    // pero los jefes esperan: al salir hay un minuto de margen).
    if (G.Rift.inArena) return;
    if (bossWait > 0) bossWait -= dt;

    // Precarga lo que va a salir en el próximo minuto.
    preloadT -= dt;
    if (preloadT <= 0) { preloadT = 10; G.Sprites.preload(G.Enemies.upcomingDex(t, 60)); }

    // Aviso al minuto 60: desde aquí el tramo de las oleadas se empina.
    const lf = G.Enemies.LATE_FROM * 60;
    if (t >= lf && t - dt < lf) { say('¡Los Pokémon salvajes se vuelven cada vez más fuertes!', 3.6); G.Audio.sfx('boss'); }

    runScripted(t);

    // --- jefes (no justo al salir de una grieta: saldrían en la arena) ---
    const b = bossWait > 0 ? null : G.Enemies.BOSSES[bossIdx];
    if (b && t >= b.at) { spawnBoss(anchor(), t, b); bossIdx++; }
    else if (!b && bossWait <= 0 && t >= lateAt) {
      spawnBoss(anchor(), t, G.Enemies.lateBoss(lateN));
      lateN++;
      lateAt = t + (3 + Math.floor(Math.random() * 10)) * 60;
    }

    // Combate de jefe: las oleadas bajan al 25% y no hay mareas, para que el
    // jefe sea un momento propio y se le pueda apuntar entre la multitud.
    const bossFight = G.EnemyMgr.bossAlive();

    // --- goteo normal ---
    if (G.EnemyMgr.count < CAP) {
      acc += rate(t) * G.Coop.scaleRate(players.length) * (bossFight ? 0.25 : 1) * dt;
      let n = Math.floor(acc);
      acc -= n;
      while (n-- > 0 && G.EnemyMgr.count < CAP) spawnOne(anchor(), t);
    }

    // --- marea ---
    if (!bossFight) surgeT -= dt;
    if (surgeT <= 0) {
      surgeT = G.U.rand(38, 56);
      const base = Math.random() * 6.2832;
      const target = anchor();
      const n = Math.min(CAP - G.EnemyMgr.count, Math.round((14 + Math.floor(t / 22)) * G.Coop.scaleRate(players.length) * 0.4));
      for (let i = 0; i < n; i++) spawnOne(target, t, base + G.U.rand(-0.55, 0.55));
      say('¡Marea de Pokémon!', 2.2);
      G.Audio.sfx('surge');
    }
  }

  /** Unos cuantos de golpe desde un lado (al empezar una horda). */
  function burst(n) {
    const base = Math.random() * 6.2832, target = anchor() || G.Game.player, t = G.Game.st.time;
    for (let i = 0; i < n && G.EnemyMgr.count < CAP + 10; i++) spawnOne(target, t, base + G.U.rand(-0.6, 0.6));
  }

  /**
   * Un rezagado vuelve a salir por delante del jugador (hacia donde corre),
   * fuera de la vista. Devuelve false si no hay sitio (entonces se quita).
   */
  function ahead(e, pl) {
    if (!players.length) players = [pl];
    const sp = Math.hypot(pl._vx || 0, pl._vy || 0);
    const a0 = sp > 20 ? Math.atan2(pl._vy, pl._vx) : Math.random() * 6.2832;
    const pt = freePoint(pl, a0 + G.U.rand(-0.9, 0.9), e.flying);
    if (!pt) return false;
    e.x = pt[0]; e.y = pt[1]; e.kx = e.ky = 0;
    e.phase = 'walk'; e.pt = 0; e.jump = null; e.jumpLift = 0;
    return true;
  }

  /** Aviso grande en pantalla (también lo usan el bioma y los shinies). */
  /** @param local  sólo en este ordenador (no se manda a los compañeros) */
  function say(text, secs = 2.6, local = false) {
    announce = text; announceT = secs;
    if (G.Coop.isHost && !local) G.Coop.say(text, secs);
  }

  function banner() { return announceT > 0 ? { text: announce, t: announceT } : null; }

  /** Invitado en cooperativo: sólo corre el reloj del aviso. */
  function tickBanner(dt) { if (announceT > 0) announceT -= dt; }

  /** Ningún jefe hasta dentro de `secs` (al volver de una grieta). */
  function holdBosses(secs) { if (secs > bossWait) bossWait = secs; }

  /** El siguiente jefe de la run, ahora. En la arena sale delante del jugador. */
  function debugBoss() {
    const who = (G.Game.everyone() || []).filter(p => p && !p.dead);
    if (!who.length) return null;
    players = who;
    const pl = G.U.pick(who);
    const t = G.Game.st.time;
    const list = G.Enemies.BOSSES;
    const def = bossIdx < list.length ? list[bossIdx++] : G.Enemies.lateBoss(lateN++);
    const at = G.Rift.inArena ? [pl.x, pl.y - 120] : null;
    return spawnBoss(pl, t, def, at);
  }

  return { reset, update, ahead, burst, tickBanner, banner, say, rate, holdBosses, SHINY_RATE, CAP,
           debugForceShiny(n = 1) { forceShiny = n; }, debugBoss };
})();
