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
    { cat: 'mon', id: 'def',    icon: 'shield', name: 'Defensa',        unit: '+1% defensa',        max: 40, base: 80,  grow: 1.4 },
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

  /** Mejoras del Pokémon con nivel, sólo las que tiene compradas. */
  function sheet(src) {
    const o = {};
    for (const u of LIST) {
      if (u.cat !== 'mon') continue;
      const n = clamp(src, u.id);
      if (n) o[u.id] = n;
    }
    return o;
  }

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

  /** Niveles del Pokémon + los de la cuenta -> modificadores para G.Player. */
  function perks(levels = {}, global) {
    const g = global || globalBag();
    const L = id => clamp(levels, id);
    const G = id => clamp(g, id);
    return {
      hp: L('hp') * 8,
      atkMul: 1 + L('atk') * 0.04,
      spdMul: 1 + L('spd') * 0.03,
      cdMul: 1 - L('cd') * 0.03,
      dmgReduce: L('def') * 0.01,
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

  return { LIST, BY, CATS, cost, perks, lvl, sheet, chestMul, towerXp, towerGold, shopEvery, candyAdd };
})();
