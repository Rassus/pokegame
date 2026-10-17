/* ============ upgrades.js — mejoras permanentes entre runs ============
 * Pokémon: por compañero (save.pupg). Run, grieta y torre: de la cuenta
 * (save.gupg), valen con cualquiera.
 * `per` es lo que da cada nivel. `costs`, si está, sustituye a base/grow.
 */
G.Upgrades = (() => {
  /** Coste del nivel i (0 = el primero), de `first` a `last`, en curva. */
  function ladder(first, last, n) {
    if (n <= 1) return [first];
    const g = Math.pow(last / first, 1 / (n - 1));
    const out = [];
    for (let i = 0; i < n; i++) out.push(Math.max(10, Math.round(first * Math.pow(g, i) / 10) * 10));
    out[0] = first;
    out[n - 1] = last;
    return out;
  }

  const LIST = [
    { cat: 'mon', id: 'hp',     icon: 'heart', name: 'Vitalidad',      unit: '+8 vida',            max: 40, base: 60,  grow: 1.35 },
    { cat: 'mon', id: 'atk',    icon: 'fist', name: 'Fuerza',         unit: '+4% daño',           max: 40, base: 80,  grow: 1.38 },
    { cat: 'mon', id: 'spd',    icon: 'boot', name: 'Velocidad',      unit: '+3% velocidad',      max: 8, base: 70,  grow: 1.4 },
    { cat: 'mon', id: 'cd',     icon: 'clock', name: 'Reflejos',       unit: '-3% recarga',        max: 8, base: 90,  grow: 1.42 },
    { cat: 'mon', id: 'def',    icon: 'shield', name: 'Defensa',        unit: '+2% defensa',        max: 40, base: 80,  grow: 1.4 },
    { cat: 'mon', id: 'regen',  icon: 'sprout', name: 'Síntesis',       unit: '+0.2 vida/s',        max: 10, base: 120, grow: 1.5 },
    { cat: 'mon', id: 'magnet', icon: 'magnet', name: 'Imán',           unit: '+8% recogida',       max: 12, base: 50,  grow: 1.4 },
    { cat: 'mon', id: 'xp',     icon: 'book', name: 'Sabiduría',      unit: '+2% experiencia',    max: 40, base: 100, grow: 1.42 },
    { cat: 'mon', id: 'moves',  icon: 'cards', name: 'Repertorio',     unit: '+1 movimiento al empezar', max: 1, base: 1500, grow: 1 },
    { cat: 'mon', id: 'crit',   icon: 'star', name: 'Golpe Crítico',  unit: '+1,5% de críticos (x1,5 de daño)', max: 40, base: 90, grow: 1.4 },
    { cat: 'mon', id: 'reroll', icon: 'up', name: 'Cambio de cartas', unit: '+1 cambio de cartas de nivel por run', max: 6, base: 150, grow: 1.6 },
    { cat: 'mon', id: 'ban',    icon: 'ban', name: 'Veto',           unit: 'Bloquea 1 movimiento: no te sale en las cartas', max: 3, base: 300, grow: 1.9 },

    { cat: 'run', id: 'coins',  icon: 'coin', name: 'Fortuna',        unit: '+3,5% Pokémonedas',  max: 40, base: 120, grow: 1.45 },
    { cat: 'run', id: 'tluck',  icon: 'ticket', name: 'Fortuna de tickets', unit: '+2% gris, +0,1% morado, +0,05% azul, +0,001% dorado (cofres y jefes)', max: 10, base: 8000, grow: 1.7 },
    { cat: 'run', id: 'chest',  icon: 'clock', name: 'Rapidez para abrir cofres', unit: '−1 / −1,25 / −1,75 / −2,25 / −3,25 s', max: 5, costs: [9999, 25000, 100000, 450000, 999999] },
    { cat: 'run', id: 'chests', icon: 'chest', name: 'Cantidad de cofres', unit: '×1,2 / ×1,4 / ×1,7 cofres en el mapa', max: 3, costs: [100000, 300000, 600000] },
    { cat: 'run', id: 'bfind',  icon: 'star', name: 'Rastro de jefes', unit: 'Una flecha amarilla marca a cada jefe', max: 1, costs: [1000] },
    { cat: 'run', id: 'candy',  icon: 'candy', name: 'Willy Wonka es mi pastor, nada me faltará, Amén', unit: '+0,001% / +0,002% / +0,005% de Caramelo Raro', max: 3, costs: [5000, 45000, 450000] },

    { cat: 'rift', id: 'spring', icon: 'wrain', name: 'Fuente de agua', unit: 'Un manantial en cada grieta', max: 1, costs: [3500] },

    { cat: 'tower', id: 'tgold', icon: 'coin', name: 'Oro extra', unit: '+1 Pokémoneda por baja en la torre', max: 40, costs: ladder(1000, 4000000, 40) },
    { cat: 'tower', id: 'txp',   icon: 'book', name: 'Exp extra', unit: '+5% de experiencia en la torre', max: 20, costs: ladder(1000, 1000000, 20) },
    { cat: 'tower', id: 'twave', icon: 'cards', name: 'Premio por oleada', unit: 'La tienda llega 1 oleada antes (de cada 10 hasta cada 5)', max: 5, costs: ladder(10000, 500000, 5) },
    { cat: 'tower', id: 'angel', icon: 'heart', name: 'Ángel guardián', unit: 'En la torre, vuelves a la vida 1 vez', max: 1, costs: [25000] }
  ];
  const BY = {};
  for (const u of LIST) BY[u.id] = u;
  const CATS = [
    { id: 'mon', name: 'Pokémon' },
    { id: 'run', name: 'Run' },
    { id: 'rift', name: 'Grieta' },
    { id: 'tower', name: 'Torre' }
  ];

  function cost(id, lvl) {
    const u = BY[id];
    if (!u || lvl >= u.max) return 0;
    if (u.costs) return u.costs[lvl] || 0;
    return Math.round(u.base * Math.pow(u.grow, lvl) / 10) * 10;
  }

  function clamp(src, id) {
    const u = BY[id];
    if (!u) return 0;
    return Math.max(0, Math.min(u.max, Math.floor(+(src && src[id]) || 0)));
  }

  function globalBag() {
    return (G.DB && G.DB.save && G.DB.save.gupg) || {};
  }

  /** Nivel comprado de una mejora de la cuenta. */
  function lvl(id) { return clamp(globalBag(), id); }

  /** Cuántos cofres más: 1, 1,2, 1,4 o 1,7. */
  function chestMul() { return [1, 1.2, 1.4, 1.7][lvl('chests')] || 1; }

  /** Experiencia de los Pokémon de la torre. */
  function towerXp() { return 1 + lvl('txp') * 0.05; }

  /** Pokémonedas extra por baja en la torre. */
  function towerGold() { return lvl('tgold'); }

  /** Cada cuántas oleadas abre la tienda (10, y baja hasta 5). */
  function shopEvery() { return Math.max(5, 10 - lvl('twave')); }

  /** Probabilidad extra (en %) de Caramelo Raro: 0, 0,001, 0,002 o 0,005. */
  function candyAdd() { return [0, 0.001, 0.002, 0.005][lvl('candy')] || 0; }

  /** Niveles del Pokémon + los de la cuenta -> modificadores para G.Player.
   *  Vida, daño y defensa por nivel dependen del rol elegido. */
  function perks(levels = {}, global) {
    const g = global || globalBag();
    const L = id => clamp(levels, id);
    const G = id => clamp(g, id);
    const role = (G.Roles && G.Roles.current()) || { id: 'normal', hp: 8, atk: 40, def: 20 };
    return {
      hp: L('hp') * role.hp,
      atkMul: 1 + L('atk') * (role.atk / 1000),
      spdMul: 1 + L('spd') * 0.03,
      cdMul: 1 - L('cd') * 0.03,
      dmgReduce: L('def') * (role.def / 1000),
      role: role.id,
      regen: L('regen') * 0.2,
      magnetMul: 1 + L('magnet') * 0.08,
      xpMul: 1 + L('xp') * 0.02,
      startMoves: 1 + L('moves'),
      crit: L('crit') * 0.015,
      rerolls: L('reroll'),
      bans: L('ban'),
      coinMul: 1 + G('coins') * 0.035,
      ticketAdd: [G('tluck') * 2, G('tluck') * 0.1, G('tluck') * 0.05, G('tluck') * 0.001],
      chestCut: [0, 1, 1.25, 1.75, 2.25, 3.25][G('chest')] || 0,
      angel: G('angel') > 0
    };
  }

  return { LIST, BY, CATS, cost, perks, lvl, chestMul, towerXp, towerGold, shopEvery, candyAdd };
})();

/* ============ roles — uno por jugador, se elige en Mejoras ============
 * Cambian lo que da cada nivel de Vitalidad, Fuerza y Defensa.
 * hp es vida plana por nivel. atk y def van en décimas de % (40 = 4%, 17 = 1,7%).
 * En una partida en grupo, como máximo 2 jugadores de cada rol.
 */
G.Roles = (() => {
  const CAP = 2;
  const AURA = 150;                       // radio del aura del sanador
  const LIST = [
    { id: 'normal', name: 'Normal', color: '#9eb0cc', hp: 8, atk: 40, def: 20,
      text: 'No cambia nada: +8 vida, +4% daño y +2% defensa por nivel.' },
    { id: 'dps', name: 'DPS', color: '#ff6b4d', hp: 6, atk: 60, def: 17,
      text: 'Por nivel: +6 vida, +6% daño y +1,7% defensa. Los golpes críticos curan un 5% del daño, hasta un 3% de tu vida máxima por segundo.' },
    { id: 'tank', name: 'Tanque', color: '#7eb6ff', hp: 12, atk: 32, def: 32,
      text: 'Por nivel: +12 vida, +3,2% daño y +3,2% defensa. Un 15% de bloquear el 80% del daño. Contra un jefe, ese bloqueo baja al 30%.' },
    { id: 'healer', name: 'Sanador', color: '#5fe08a', hp: 10, atk: 28, def: 22,
      text: 'Por nivel: +10 vida, +2,8% daño y +2,2% defensa. Un aura cura un 1% de la vida máxima por segundo a los jugadores que estén dentro. Tus ataques de apoyo también les llegan.' },
    { id: 'seeker', name: 'Buscador', color: '#ffd23f', hp: 8, atk: 35, def: 20,
      text: 'Por nivel: +8 vida, +3,5% daño y +2% defensa. Una flecha dorada marca el cofre más cercano, pequeño o grande: en el borde si no se ve y encima si se ve. Los abres un 10% más rápido y, si otro jugador abre el mismo, va aún más rápido.' }
  ];
  const BY = {};
  for (const r of LIST) BY[r.id] = r;

  function norm(id) { return BY[id] ? id : 'normal'; }
  function of(id) { return BY[norm(id)]; }
  function current() {
    const id = G.DB && G.DB.save && G.DB.save.role;
    return of(id);
  }
  /** 40 -> "4", 17 -> "1,7". */
  function tenths(n) {
    const x = Math.round(n) / 10;
    return String(x).replace('.', ',');
  }
  /** Texto de la mejora de vida, daño o defensa según el rol actual. Vacío si no es de esas. */
  function unit(id) {
    const r = current();
    if (id === 'hp') return '+' + r.hp + ' vida';
    if (id === 'atk') return '+' + tenths(r.atk) + '% daño';
    if (id === 'def') return '+' + tenths(r.def) + '% defensa';
    return '';
  }
  /** Lo que se manda al empezar la partida en grupo. */
  function pack(m) {
    return { uid: m.uid, name: m.name, dex: m.dex, shiny: !!m.shiny, role: norm(m.role) };
  }
  /** Uids que pasan del tope: los 2 primeros de cada rol (orden de la sala) valen. */
  function overCap(members) {
    const n = {};
    const bad = new Set();
    for (const m of members || []) {
      const id = norm(m.role);
      n[id] = (n[id] || 0) + 1;
      if (n[id] > CAP) bad.add(m.uid);
    }
    return bad;
  }

  let chestAt = 0, chestKey = '', chestList = [];

  /** El Pokémon de esta partida es buscador. Si en Mejoras está elegido y la run no lo copió, se corrige. */
  function isSeeker(pl) {
    pl = pl || (G.Game && G.Game.player);
    if (!pl || pl.remote || pl.dead) return false;
    if (G.Game && G.Game.state === 'ui') return false;
    if (pl.role === 'seeker') return true;
    if (G.Coop && G.Coop.active) return false;
    if (G.DB && G.DB.save && norm(G.DB.save.role) === 'seeker') { pl.role = 'seeker'; return true; }
    return false;
  }

  /** El cofre más cercano (pequeño o con candado). Sólo el buscador. */
  function chests(pl) {
    if (!isSeeker(pl) || !G.World) return [];
    const now = performance.now();
    const key = (pl.x / 64 | 0) + ',' + (pl.y / 64 | 0);
    if (now - chestAt < 300 && key === chestKey) return chestList;
    chestAt = now; chestKey = key;
    const list = [];
    const seen = new Set();
    const add = p => {
      if (!p || (p.type !== 'chest' && p.type !== 'bigchest')) return;
      if (p.hp != null && !(p.hp > 0)) return;
      const k = (p.tx | 0) + ',' + (p.ty | 0);
      if (seen.has(k)) return;
      seen.add(k);
      list.push(p);
    };
    // Los que ya están en el mapa (los que se ven) y, si faltan, los que predice el terreno.
    try { if (G.World.loadedChests) for (const p of G.World.loadedChests()) add(p); } catch (e) { /* nada */ }
    try { if (G.World.nearestChests) for (const p of G.World.nearestChests(pl.x, pl.y, 1)) add(p); } catch (e) { /* nada */ }
    list.sort((a, b) => G.U.dist2(pl.x, pl.y, a.x, a.y) - G.U.dist2(pl.x, pl.y, b.x, b.y));
    chestList = list.slice(0, 1);
    return chestList;
  }

  function marking(p) {
    const pl = G.Game && G.Game.player;
    if (!p || !isSeeker(pl)) return false;
    const tx = p.tx | 0, ty = p.ty | 0;
    for (const c of chests(pl)) if ((c.tx | 0) === tx && (c.ty | 0) === ty) return true;
    return false;
  }

  /** Flecha hacia abajo, en coordenadas de mundo. `y` es la punta de arriba del cofre. */
  function drawDownArrow(ctx, x, y) {
    const bob = Math.abs(Math.sin(performance.now() / 180)) * 8;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.translate(x, y - 18 - bob);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-20, -14); ctx.lineTo(20, -14); ctx.lineTo(0, 10); ctx.closePath();
    ctx.lineWidth = 6; ctx.strokeStyle = '#1a1204'; ctx.stroke();
    ctx.fillStyle = '#ffe14d'; ctx.fill();
    ctx.restore();
  }

  /** Aura del sanador: 1% de la vida máxima por segundo por cada aura en la que estás. */
  function pulse(pl, dt) {
    if (!pl || pl.dead || pl.remote) return;
    const all = (G.Coop && G.Coop.active) ? G.Coop.players() : [pl];
    let n = 0;
    for (const o of all) {
      if (!o || o.dead || o.role !== 'healer') continue;
      if (G.U.dist2(pl.x, pl.y, o.x, o.y) <= AURA * AURA) n++;
    }
    if (!n || pl.hp >= pl.maxHp) return;
    const before = pl.hp;
    pl.hp = Math.min(pl.maxHp, pl.hp + pl.maxHp * 0.01 * n * dt);
    pl.auraAcc = (pl.auraAcc || 0) + (pl.hp - before);
    pl.auraT = (pl.auraT || 0) - dt;
    if (pl.auraT <= 0 && pl.auraAcc >= 1) {
      pl.auraT = 0.7;
      G.FX.dmgText(pl.x, pl.y - pl.bodyH - 6, '+' + Math.round(pl.auraAcc), '#7dffb0');
      pl.auraAcc = 0;
    }
  }

  return { LIST, CAP, AURA, norm, of, current, unit, pack, overCap, isSeeker, chests, marking, drawDownArrow, pulse };
})();
