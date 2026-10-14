/* ============ upgrades.js — mejoras permanentes entre runs ============
 * Se compran con Pokémonedas en el menú. `per` es lo que da cada nivel.
 */
G.Upgrades = (() => {
  const LIST = [
    { id: 'hp',     icon: 'heart', name: 'Vitalidad',      unit: '+8 vida',            max: 40, base: 60,  grow: 1.35 },
    { id: 'atk',    icon: 'fist', name: 'Fuerza',         unit: '+4% daño',           max: 40, base: 80,  grow: 1.38 },
    { id: 'spd',    icon: 'boot', name: 'Zancada',        unit: '+3% velocidad',      max: 8, base: 70,  grow: 1.4 },
    { id: 'cd',     icon: 'clock', name: 'Reflejos',       unit: '-3% recarga',        max: 8, base: 90,  grow: 1.42 },
    { id: 'def',    icon: 'shield', name: 'Coraza',         unit: '+2% defensa',        max: 40, base: 80,  grow: 1.4 },
    { id: 'regen',  icon: 'sprout', name: 'Síntesis',       unit: '+0.2 vida/s',        max: 10, base: 120, grow: 1.5 },
    { id: 'magnet', icon: 'magnet', name: 'Imán',           unit: '+8% recogida',       max: 12, base: 50,  grow: 1.4 },
    { id: 'xp',     icon: 'book', name: 'Sabiduría',      unit: '+2% experiencia',    max: 40, base: 100, grow: 1.42 },
    { id: 'coins',  icon: 'coin', name: 'Fortuna',        unit: '+5% Pokémonedas',    max: 20, base: 120, grow: 1.45 },
    { id: 'moves',  icon: 'cards', name: 'Repertorio',     unit: '+1 movimiento al empezar', max: 1, base: 1500, grow: 1 },
    { id: 'crit',   icon: 'star', name: 'Golpe Crítico',  unit: '+1,5% de críticos (x1,5 de daño)', max: 40, base: 90, grow: 1.4 },
    { id: 'reroll', icon: 'up', name: 'Cambio de cartas', unit: '+1 cambio de cartas de nivel por run', max: 6, base: 150, grow: 1.6 },
    { id: 'ban',    icon: 'ban', name: 'Veto',           unit: 'Bloquea 1 movimiento: no te sale en las cartas', max: 3, base: 300, grow: 1.9 },
    { id: 'tluck',  icon: 'ticket', name: 'Fortuna de tickets', unit: '+2% gris, +0,1% morado, +0,05% azul, +0,001% dorado (cofres y jefes)', max: 10, base: 8000, grow: 1.7 },
    { id: 'chest',  icon: 'chest', name: 'Rapidez para abrir cofres', unit: '−1 / −1,25 / −1,75 / −2,25 / −3,25 s', max: 5, costs: [9999, 25000, 100000, 450000, 999999] }
  ];
  const BY = {};
  for (const u of LIST) BY[u.id] = u;

  function cost(id, lvl) {
    const u = BY[id];
    if (u.costs) return u.costs[lvl] || 0;
    return Math.round(u.base * Math.pow(u.grow, lvl) / 10) * 10;
  }

  /** Niveles comprados -> modificadores para G.Player. */
  function perks(levels = {}) {
    // Nunca por encima del máximo (una partida editada a mano no da más poder).
    const L = id => Math.max(0, Math.min(BY[id].max, Math.floor(+levels[id] || 0)));
    return {
      hp: L('hp') * 8,
      atkMul: 1 + L('atk') * 0.04,
      spdMul: 1 + L('spd') * 0.03,
      cdMul: 1 - L('cd') * 0.03,
      dmgReduce: L('def') * 0.02,
      regen: L('regen') * 0.2,
      magnetMul: 1 + L('magnet') * 0.08,
      xpMul: 1 + L('xp') * 0.02,
      coinMul: 1 + L('coins') * 0.05,
      startMoves: 1 + L('moves'),
      crit: L('crit') * 0.015,
      rerolls: L('reroll'),
      bans: L('ban'),
      // Puntos extra en cofres y jefes (no en cada baja): gris, morado, azul, dorado.
      ticketAdd: [L('tluck') * 2, L('tluck') * 0.1, L('tluck') * 0.05, L('tluck') * 0.001],
      // Segundos que se restan a los 3,5 s de un cofre con candado (el valor del nivel, no se acumulan).
      chestCut: [0, 1, 1.25, 1.75, 2.25, 3.25][L('chest')] || 0
    };
  }

  return { LIST, BY, cost, perks };
})();
