/* ============ enemies.js — Pokémon salvajes de todas las generaciones ============
 *
 * Los tramos ya no son listas fijas: cada tramo recoge a todos los Pokémon
 * (de cualquier generación) cuyo total de stats base cae en su rango, y al
 * empezar una run se elige al azar un ELENCO de cada tramo. Así cada partida
 * trae Pokémon distintos sin tener que cargar cientos de sprites a la vez.
 *
 * Los stats de combate salen de la plantilla del tramo, ajustados con la
 * vida y la velocidad propias de cada Pokémon.
 *
 * behavior:
 *   chase    va directo a por ti
 *   charger  se para, apunta y embiste
 *   ranged   se mantiene a distancia y dispara
 *   tank     lento, mucha vida
 *   ---- con personalidad ----
 *   healer   cura a los de alrededor (Chansey, Blissey, Audino...)
 *   shielder pone escudos a sus compañeros (Shuckle, Bronzong, Mr. Mime...)
 *   summoner llama a su manada (Nidoqueen trae Nidoran, Vespiquen Combee...)
 *   bomber   se acerca y explota (Voltorb, Electrode, Koffing, Geodude...)
 *   beamer   rayo que avisa en el suelo antes de disparar
 *   zoner    zonas de daño bajo tus pies que estallan al poco
 *   fan      dispara en abanico
 *   jumper   salta y cae sobre ti (la caída se ve antes en el suelo)
 *   runner   corredor: muy rápido y frágil, va a donde vas a estar (corta el
 *            paso al que sólo huye). Uno por tramo: el más rápido del elenco.
 * Los ataques con aviso están en systems/hazards.js.
 *
 * Jefes: Pokémon fuertes NO legendarios (pseudolegendarios, Slaking...), al
 * azar por franjas de poder. Los legendarios sólo salen en las grietas
 * (systems/rift.js).
 */
G.Enemies = (() => {
  const TIERS = [
    { from: 0,   bst: [180, 330], hp: 17,  spd: 56, dmg: 6,  xp: 3.5, cast: 7 },
    { from: 70,  bst: [300, 405], hp: 32,  spd: 62, dmg: 8.5, xp: 5,  cast: 7 },
    { from: 160, bst: [385, 465], hp: 52,  spd: 60, dmg: 11, xp: 8,  cast: 7 },
    { from: 260, bst: [445, 515], hp: 88,  spd: 70, dmg: 14, xp: 13, cast: 7 },
    { from: 380, bst: [495, 560], hp: 150, spd: 66, dmg: 22, xp: 24, cast: 7 },
    { from: 500, bst: [530, 620], hp: 250, spd: 72, dmg: 28, xp: 38, cast: 7 }
  ];

  /**
   * Jefes de la run, en solitario. Vida, daño y disparo ya son los finales.
   * En grupo la vida se multiplica por los jugadores. `bst` elige el Pokémon.
   */
  const RUN_BOSSES = [
    { min: 3,  hp: 3436,   dmg: 75,  shot: 35,  xp: 220,  bst: [490, 545] },
    { min: 6,  hp: 11389,  dmg: 132, shot: 61,  xp: 420,  bst: [520, 580] },
    { min: 9,  hp: 26116,  dmg: 200, shot: 90,  xp: 680,  bst: [540, 600] },
    { min: 12, hp: 51914,  dmg: 286, shot: 133, xp: 1000, bst: [580, 700] },
    { min: 15, hp: 109964, dmg: 418, shot: 188, xp: 1800, bst: [600, 700] }
  ];

  /**
   * Desde el minuto 20, un jefe cada 3 a 12 minutos, en este orden.
   * El que pase del último toma el anterior y le suma LATE_GROW.
   */
  const LATE_GROW = { hp: 10, dmg: 1.10 };
  const LATE_BOSSES = [
    { hp:   150000, dmg: 550,  shot: 303 },
    { hp:   472500, dmg: 605,  shot: 333 },
    { hp:   698375, dmg: 666,  shot: 366 },
    { hp:   828131, dmg: 732,  shot: 403 },
    { hp:  1262351, dmg: 805,  shot: 443 },
    { hp:  2001704, dmg: 886,  shot: 487 },
    { hp:  3246959, dmg: 974,  shot: 536 },
    { hp:  4399003, dmg: 1072, shot: 590 },
    { hp:  6458853, dmg: 1179, shot: 648 },
    { hp:  8527681, dmg: 1297, shot: 713 },
    { hp: 10606834, dmg: 1427, shot: 785 },
    { hp: 16097859, dmg: 1569, shot: 863 },
    { hp: 18002538, dmg: 1726, shot: 949 }
  ];

  // Stats base aproximados a partir de los de juego (inverso de fetch_pokedex).
  const baseHp = p => (p.hp - 70) / 0.45;
  const baseSpd = p => (p.spd - 78) / 0.42;

  const H = (d, s) => G.U.hash(d, 7, s);

  // Personalidades fijas de algunos Pokémon.
  const HEAL = new Set([35, 36, 113, 173, 183, 184, 242, 301, 440, 531, 594, 700, 764, 858]);
  const SHIELD = new Set([95, 122, 208, 213, 227, 306, 375, 410, 411, 436, 437, 439, 476, 703]);
  const BOMB = new Set([74, 75, 76, 100, 101, 102, 109, 110, 337, 338, 343, 344]);
  // Invocador -> Pokémon de su manada.
  const SUMMON = { 15: 13, 18: 16, 24: 23, 28: 27, 31: 29, 34: 32, 42: 41, 51: 50, 53: 52, 57: 56, 59: 58,
                   62: 60, 68: 66, 73: 72, 78: 77, 82: 81, 85: 84, 91: 90, 117: 116, 130: 129, 168: 167, 169: 41,
                   199: 79, 230: 116, 262: 261, 334: 333, 405: 403, 416: 415, 462: 81, 466: 239, 553: 551, 637: 636 };

  function behaviorOf(p) {
    const t = p.types, h = H(p.dex, 11);
    const has = (...xs) => xs.some(x => t.includes(x));
    if (HEAL.has(p.dex)) return 'healer';
    if (SHIELD.has(p.dex)) return 'shielder';
    if (BOMB.has(p.dex)) return 'bomber';
    if (SUMMON[p.dex] && G.SPRITE_META[SUMMON[p.dex]]) return 'summoner';
    // Enjambres: algunos Bicho llaman a más de los suyos (desde el principio).
    if (has('bug') && h >= 0.6 && h < 0.78) return 'summoner';
    if (has('electric', 'psychic', 'dragon', 'ice') && h < 0.18) return 'beamer';
    if (has('fire', 'ground', 'poison') && h < 0.18) return 'zoner';
    if (has('water', 'grass', 'bug', 'fairy') && h >= 0.18 && h < 0.32) return 'fan';
    if (has('fighting', 'ground', 'normal', 'rock') && h >= 0.42 && h < 0.56) return 'jumper';
    if (has('psychic', 'electric', 'ghost', 'fairy') && h < 0.4) return 'ranged';
    if (has('fire', 'water', 'poison', 'ice') && h < 0.22) return 'ranged';
    if (has('fighting', 'normal', 'ground', 'rock', 'dragon', 'steel', 'dark') && h < 0.4) return 'charger';
    if (baseHp(p) > 95 && baseSpd(p) < 50) return 'tank';
    return 'chase';
  }

  /** Construye la definición de enemigo de un Pokémon para un tramo. */
  function defFor(p, tier, ti) {
    const hpK = G.U.clamp(baseHp(p) / 65, 0.7, 1.6);
    const spdK = G.U.clamp(0.75 + baseSpd(p) / 260, 0.75, 1.3);
    const behavior = behaviorOf(p);
    const d = {
      dex: p.dex, name: p.name, behavior,
      hp: Math.round(tier.hp * hpK * (behavior === 'tank' ? 1.5 : 1)),
      spd: Math.round(tier.spd * spdK * (behavior === 'tank' ? 0.7 : 1)),
      dmg: Math.round(tier.dmg * (behavior === 'tank' ? 1.2 : 1)),
      xp: Math.max(3, Math.round(tier.xp * (behavior === 'tank' ? 1.3 : 1)))
    };
    // Los que pelean de lejos: daño del disparo, recarga y distancia.
    const CD = { ranged: 2.2 - ti * 0.15, fan: 3.2 - ti * 0.15, beamer: 4.4 - ti * 0.2, zoner: 4.6 - ti * 0.2,
                 healer: 3.5, summoner: 7 };
    if (CD[behavior]) {
      d.shotDmg = Math.round(tier.dmg * (behavior === 'fan' ? 0.7 : 0.8));
      d.shotCd = +CD[behavior].toFixed(2);
      d.range = (behavior === 'beamer' ? 260 : behavior === 'healer' || behavior === 'summoner' ? 230 : 190) + ti * 6;
    }
    if (behavior === 'summoner') d.minion = SUMMON[p.dex];
    if (behavior === 'fan') d.fanN = ti < 2 ? 3 : 5;             // abanico más ancho más adelante
    if (behavior === 'zoner') d.zones = ti < 2 ? 1 : ti < 4 ? 2 : 3;   // más zonas más adelante
    if (behavior === 'bomber') { d.spd = Math.round(d.spd * 1.25); d.hp = Math.round(d.hp * 0.8); }
    return d;
  }

  /** Generación más alta que esta partida puede encontrar en el mapa. */
  function regionCap() {
    const s = G.DB && G.DB.save;
    return (s && s.region) || 1;
  }

  /** 1 básicos (hasta el min 3), 2 segundas (hasta el min 8), 3 formas finales. */
  function phaseOf(t) { return t < 180 ? 1 : t < 480 ? 2 : 3; }
  function fitsPhase(dex, phase) {
    const e = G.Evo.of(dex);
    if (phase === 1) return e.stage === 1;
    if (phase === 2) return e.stage === 2;
    return !e.next.length && e.stage > 1;
  }

  /** Todos los candidatos de un tramo (sin legendarios, de regiones abiertas y de la etapa que toca). */
  function candidates(tier) {
    const cap = regionCap();
    const phase = phaseOf(tier.from);
    const base = p => p.rarity < 5 && (p.gen || 1) <= cap && G.SPRITE_META[p.dex];
    const band = (lo, hi, staged) => G.DEX.filter(p => base(p) && p.bst >= lo && p.bst <= hi && (!staged || fitsPhase(p.dex, phase)));
    let list = band(tier.bst[0], tier.bst[1], true);
    if (list.length < (tier.cast || 4)) list = band(tier.bst[0] - 80, tier.bst[1] + 80, true);
    if (list.length < 4) list = G.DEX.filter(p => base(p) && fitsPhase(p.dex, phase));
    return list.length ? list : G.DEX.filter(base);
  }

  // ---------------- elenco de la run ----------------

  const PLAIN = ['chase', 'charger', 'ranged', 'tank'];
  const SUPPORT = ['healer', 'shielder', 'summoner'];

  /**
   * Elenco de un tramo: siempre un "apoyo" (curandero, escudo o invocador)
   * y, desde el segundo tramo, también uno de los que atacan con aviso.
   * En el primero no hay más personalidades (para ir aprendiendo).
   */
  function castFor(tier) {
    const all = candidates(tier);
    const kind = p => behaviorOf(p);
    // Primero el tipo de apoyo (a partes iguales) y luego el Pokémon.
    const kinds = SUPPORT.filter(k => all.some(p => kind(p) === k));
    const sk = kinds.length ? kinds[Math.floor(Math.random() * kinds.length)] : null;
    const pick = sk ? G.U.pickN(all.filter(p => kind(p) === sk), 1) : [];
    if (tier.from > 0) pick.push(...G.U.pickN(all.filter(p => !PLAIN.includes(kind(p)) && !SUPPORT.includes(kind(p))), 1));
    if (tier.from === 0) return pick.concat(G.U.pickN(all.filter(p => !pick.includes(p) && PLAIN.includes(kind(p))), tier.cast - pick.length));
    return pick.concat(G.U.pickN(all.filter(p => !pick.includes(p)), tier.cast - pick.length));
  }

  let cast = null;      // [{ from, list: [def] }]
  let bosses = null;    // [def de jefe]

  /** Jefes que el pase aún pide. Salen mucho más que el resto. */
  const MISSION_W = 3;
  function missionWanted(kind) {
    return new Set((G.Pass && G.Pass.wanted) ? G.Pass.wanted(kind) : []);
  }
  function pickWeighted(pool, weight) {
    const ws = pool.map(weight);
    let r = Math.random() * ws.reduce((a, b) => a + b, 0), i = 0;
    while (i < pool.length - 1 && (r -= ws[i]) > 0) i++;
    return pool[i];
  }

  /** Sortea el elenco de una run nueva. */
  function rollRun() {
    cast = TIERS.map((tier, ti) => ({
      from: tier.from,
      list: castFor(tier).map(p => defFor(p, tier, ti))
    }));
    for (const tier of cast) {
      const plain = tier.list.filter(d => d.behavior === 'chase' || d.behavior === 'charger' || d.behavior === 'tank');
      const r = plain.sort((a, b) => b.spd - a.spd)[0];
      if (r) { r.behavior = 'runner'; r.spd = Math.round(r.spd * 1.6); r.hp = Math.round(r.hp * 0.7); }
    }
    const used = new Set();
    const cap = regionCap();
    bosses = RUN_BOSSES.map(slot => {
      const at = slot.min * 60;
      const phase = phaseOf(at);
      const ok = p => !p.leg && (p.gen || 1) <= cap && G.SPRITE_META[p.dex] && !used.has(p.dex);
      let pool = G.DEX.filter(p => ok(p) && fitsPhase(p.dex, phase) && p.bst >= slot.bst[0] && p.bst <= slot.bst[1]);
      if (pool.length < 3) pool = G.DEX.filter(p => ok(p) && fitsPhase(p.dex, phase));
      if (!pool.length) pool = G.DEX.filter(p => ok(p));
      const need = missionWanted('bossOne');
      const p = pickWeighted(pool, mon => need.has(mon.dex) ? MISSION_W : 1);
      used.add(p.dex);
      return {
        at, raw: true, dex: p.dex, name: p.name,
        hp: slot.hp, spd: Math.round(G.U.clamp(40 + baseSpd(p) * 0.5, 40, 100)),
        dmg: slot.dmg, xp: slot.xp,
        behavior: behaviorOf(p) === 'ranged' ? 'ranged' : (baseSpd(p) > 90 ? 'charger' : 'chase'),
        shotDmg: slot.shot, shotCd: 1.1, range: 260
      };
    });
    return { cast, bosses };
  }

  // Plantilla del último tramo: la tabla de abajo está escrita para un
  // Pokémon normal de este tramo. Los demás quedan en esa proporción.
  const REF_HP = TIERS[TIERS.length - 1].hp, REF_DMG = TIERS[TIERS.length - 1].dmg;
  // Pasado el último minuto de la tabla, vida, daño y ritmo suman esto cada 5 min.
  const AFTER_EVERY = 5, AFTER_GROW = 1.01;

  /**
   * Progresión de la run. Cada fila: [minuto, vida, daño, salen/s] de un
   * Pokémon normal del último tramo. Entre dos filas sube en línea recta.
   * Un Pokémon de otro tramo usa su plantilla: vida × (su vida / REF_HP).
   */
  const PROGRESS = [
    [  0,     825,    67,   0.38],
    [  1,    1463,    77,   0.91],
    [  2,    2190,    86,   1.55],
    [  3,    3008,    96,   2.29],
    [  4,    3917,   106,   3.10],
    [  5,    4915,   115,   3.98],
    [  6,    5987,   125,   4.91],
    [  7,    6776,   134,   5.91],
    [  8,    7566,   144,   6.95],
    [  9,    8355,   154,   8.05],
    [ 10,    9145,   163,   9.19],
    [ 11,    9934,   173,  10.38],
    [ 12,   10724,   182,  11.62],
    [ 13,   11513,   192,  12.89],
    [ 14,   12303,   202,  14.21],
    [ 15,   23100,   210,     16],
    [ 16,   43100,   300,     36],
    [ 20,   94900,   355,     40],
    [ 25,  175600,   640,    109],
    [ 30,  222500,  1250,    197],
    [ 40,  425000,  1950,    320],
    [ 60,  725888,  2236,    425],
    [ 70, 1000000,  2500,    600],
    [ 85, 2500000,  3000,    850]
  ];

  /** Vida, daño y ritmo del Pokémon de referencia en el segundo `t`. */
  function progressAt(t) {
    const min = Math.max(0, t / 60);
    const last = PROGRESS[PROGRESS.length - 1];
    if (min >= last[0]) {
      const k = Math.pow(AFTER_GROW, Math.floor((min - last[0]) / AFTER_EVERY));
      return { hp: last[1] * k, dmg: last[2] * k, rate: last[3] * k };
    }
    let i = 0;
    while (i < PROGRESS.length - 2 && min >= PROGRESS[i + 1][0]) i++;
    const a = PROGRESS[i], b = PROGRESS[i + 1];
    const u = (min - a[0]) / (b[0] - a[0]);
    return {
      hp: a[1] + (b[1] - a[1]) * u,
      dmg: a[2] + (b[2] - a[2]) * u,
      rate: a[3] + (b[3] - a[3]) * u
    };
  }

  /**
   * Tiempo extra, pasado el último minuto de RIFT_BOSSES (los salvajes van por
   * PROGRESS y los jefes de la run por su tabla). Hasta el minuto 60 es ×1; desde ahí la vida crece cada
   * vez más deprisa.
   *   minuto   60    75    90    105   120   150
   *   vida    ×1   ×1,09 ×1,4  ×2,1  ×3,8  ×21
   */
  const LATE_FROM = 60, LATE_K = 0.000374;
  function late(t) { const m = Math.max(0, t / 60 - LATE_FROM); return Math.exp(Math.min(30, LATE_K * m * m)); }

  /** Jefe de después del minuto 20. La fila n de LATE_BOSSES; luego LATE_GROW. */
  function lateBoss(n) {
    const cap = regionCap();
    const ok = p => !p.leg && (p.gen || 1) <= cap && G.SPRITE_META[p.dex] && fitsPhase(p.dex, 3);
    let pool = G.DEX.filter(p => ok(p) && p.bst >= 580 && p.bst <= 700);
    if (pool.length < 3) pool = G.DEX.filter(ok);
    if (!pool.length) pool = G.DEX.filter(p => !p.leg && G.SPRITE_META[p.dex]);
    const need = missionWanted('bossOne');
    const p = pickWeighted(pool, mon => need.has(mon.dex) ? MISSION_W : 1);
    const row = n < LATE_BOSSES.length ? LATE_BOSSES[n] : null;
    const extra = row ? 0 : n - (LATE_BOSSES.length - 1);
    const last = row || LATE_BOSSES[LATE_BOSSES.length - 1];
    const hp = row ? row.hp : Math.round(last.hp * Math.pow(LATE_GROW.hp, extra));
    const dmg = row ? row.dmg : Math.round(last.dmg * Math.pow(LATE_GROW.dmg, extra));
    const shot = row ? row.shot : Math.round(last.shot * Math.pow(LATE_GROW.dmg, extra));
    return {
      raw: true, dex: p.dex, name: p.name,
      hp, spd: Math.round(G.U.clamp(40 + baseSpd(p) * 0.5, 40, 100)),
      dmg, xp: 1800,
      behavior: behaviorOf(p) === 'ranged' ? 'ranged' : (baseSpd(p) > 90 ? 'charger' : 'chase'),
      shotDmg: shot, shotCd: 1.1, range: 260
    };
  }

  /**
   * Primera grieta de la run, un jugador: [minuto, vida, daño, disparo].
   * Entre filas sube en línea recta. Cada grieta de más, contando esta, pasa
   * de ×1,10 de vida y ×1,05 de daño a ×1,20 / ×1,10, ×1,30 / ×1,15, y así.
   * Pasado el último minuto sigue la misma curva.
   */
  const RIFT_STACK = { hp: 2.10, dmg: 0.15 };
  const RIFT_BOSSES = [
    [  0,     3520,     38,    19],
    [  5,    25300,    156,    78],
    [ 10,    47080,    274,   137],
    [ 11,    68860,    392,   196],
    [ 12,    90640,    510,   255],
    [ 13,    98820,    553,   277],
    [ 14,   109167,    605,   302],
    [ 15,   122290,    667,   333],
    [ 20,   238993,    742,   371],
    [ 25,   460367,    833,   416],
    [ 30,  1087904,    945,   472],
    [ 35,  3223669,   1083,   542],
    [ 40,  4270552,   1255,   627],
    [ 45,  6332646,   1469,   735],
    [ 50,  8415807,   1740,   870]
  ];
  // Base de la grieta (ya con la primera) para seguir pasado el último minuto.
  const RIFT_PAST = { hp0: 3520, hpSec: 24.2, dmg0: 37.8, dmgSec: 0.13125, shot0: 18.9, shotSec: 0.065625 };
  function riftClosed(t) {
    const lk = late(t), soft = Math.pow(lk, 0.7);
    return {
      hp: (RIFT_PAST.hp0 + t * RIFT_PAST.hpSec) * lk,
      dmg: (RIFT_PAST.dmg0 + t * RIFT_PAST.dmgSec) * soft,
      shot: (RIFT_PAST.shot0 + t * RIFT_PAST.shotSec) * soft
    };
  }
  /** Vida, daño y disparo del legendario en el segundo `t` (primera grieta, un jugador). */
  function riftAt(t) {
    const min = Math.max(0, t / 60);
    const last = RIFT_BOSSES[RIFT_BOSSES.length - 1];
    if (min >= last[0]) {
      const now = riftClosed(t), base = riftClosed(last[0] * 60);
      return { hp: last[1] * now.hp / base.hp, dmg: last[2] * now.dmg / base.dmg, shot: last[3] * now.shot / base.shot };
    }
    let i = 0;
    while (i < RIFT_BOSSES.length - 2 && min >= RIFT_BOSSES[i + 1][0]) i++;
    const a = RIFT_BOSSES[i], b = RIFT_BOSSES[i + 1];
    const u = (min - a[0]) / (b[0] - a[0]);
    return {
      hp: a[1] + (b[1] - a[1]) * u,
      dmg: a[2] + (b[2] - a[2]) * u,
      shot: a[3] + (b[3] - a[3]) * u
    };
  }

  /** Escala de un jefe escrito en run-events.js. Los de RUN_BOSSES no pasan por aquí. */
  function bossScale(t) {
    const k = late(t);
    const m = 1 + t / 220;
    return { hp: m * k, dmg: m * Math.pow(k, 0.7), spd: 1 + Math.min(0.2, t / 3600) };
  }

  /** Tramo que toca en el segundo `t`. */
  function tierAt(t) { let ti = 0; TIERS.forEach((tr, i) => { if (t >= tr.from) ti = i; }); return ti; }

  const NO_HORDE = new Set(['bomber', 'healer', 'shielder', 'summoner']);
  /** Tipos con bastantes Pokémon en el tramo actual para una horda (events.js). */
  function hordeTypes(t) {
    const all = candidates(TIERS[tierAt(t)]).filter(p => !NO_HORDE.has(behaviorOf(p)));
    return Object.keys(G.U.TYPE_COLOR).filter(ty => all.filter(p => p.types.includes(ty)).length >= 3);
  }
  /** Hasta 4 Pokémon de un tipo, con los stats del tramo actual. */
  function hordeDefs(type, t) {
    const ti = tierAt(t);
    const pool = candidates(TIERS[ti]).filter(p => p.types.includes(type) && !NO_HORDE.has(behaviorOf(p)));
    return G.U.pickN(pool, 4).map(p => defFor(p, TIERS[ti], ti));
  }

  /** Bolsa de enemigos disponibles en el segundo `t`. */
  function bagAt(t) {
    // Durante una horda de un tipo sólo salen los de ese tipo (systems/events.js).
    const horde = G.Events && G.Events.bag();
    if (horde) return horde;
    if (!cast) rollRun();
    const bag = [];
    for (const tier of cast) {
      if (t < tier.from) continue;
      const w = t - tier.from > 260 ? 3 : 10;       // los tramos viejos pierden peso
      for (const e of tier.list) for (let i = 0; i < w; i++) bag.push(e);
    }
    return bag.length ? bag : cast[0].list;
  }

  /** dex del elenco que aparecerán pronto (para precargar sprites). */
  function upcomingDex(t, ahead = 60) {
    if (!cast) rollRun();
    const out = [];
    for (const tier of cast) if (tier.from <= t + ahead) for (const e of tier.list) out.push(e.dex);
    for (const b of bosses) if (b.at <= t + ahead) out.push(b.dex);
    return out;
  }

  /** Definición suelta para un evento de run-events.js. */
  function scripted(dex, boss) {
    const p = G.DEX_BY[dex];
    if (!p) return null;
    if (!boss) return defFor(p, TIERS[2], 2);
    return {
      dex: p.dex, name: p.name, hp: 4200, spd: 64, dmg: 36, xp: 400,
      behavior: behaviorOf(p) === 'ranged' ? 'ranged' : 'chase',
      shotDmg: 20, shotCd: 1.2, range: 240
    };
  }

  return {
    TIERS, RUN_BOSSES, LATE_BOSSES, LATE_GROW, RIFT_BOSSES, RIFT_STACK, LATE_FROM, PROGRESS, REF_HP, REF_DMG, rollRun, bossScale, late, progressAt, riftAt, lateBoss, bagAt, upcomingDex, candidates, hordeTypes, hordeDefs, scripted,
    get BOSSES() { if (!bosses) rollRun(); return bosses; },
    get cast() { if (!cast) rollRun(); return cast; }
  };
})();
