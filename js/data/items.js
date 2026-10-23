/* ============ items.js — objetos equipables (uno por run) ============
 * Se encuentran en los cofres (a veces en los normales, a menudo en los de
 * candado) y los sueltan los jefes. Sólo puedes llevar UNO; si encuentras
 * otro, eliges con cuál quedarte. Duran lo que dura la run.
 *
 *   on(pl)   se lo pones (lo que hace mientras lo llevas)
 *   off(pl)  se lo quitas (deshace lo de on)
 * Los que reaccionan a algo (golpe mortal, daño hecho...) los mira el
 * jugador con pl.hasItem(id).
 */
G.Items = (() => {
  const LIST = [
    { id: 'leftovers', name: 'Restos', desc: 'Recuperas un 1,5% de tu vida por segundo.',
      on: p => { p.regenFlat += p.maxHp * 0.015; p._itemRegen = p.maxHp * 0.015; },
      off: p => { p.regenFlat -= p._itemRegen || 0; } },
    { id: 'choiceband', name: 'Cinta Elección', desc: '+40% de daño, pero no puedes cambiar de movimiento.',
      on: p => { p.atkMul *= 1.4; }, off: p => { p.atkMul /= 1.4; } },
    { id: 'quickclaw', name: 'Garra Rápida', desc: '-20% de recarga en todos tus movimientos.',
      on: p => { p.cdMul *= 0.8; }, off: p => { p.cdMul /= 0.8; } },
    { id: 'focussash', name: 'Banda Focus', desc: 'Un golpe que te dejaría KO te deja con 1 de vida (cada 60 s).',
      on: () => {}, off: () => {} },
    { id: 'shellbell', name: 'Cascabel Concha', desc: 'Un escudo de hasta el 25% de tu vida. Se recarga un 1% por segundo.',
      on: () => {}, off: p => { p.shield = 0; } },
    { id: 'bloodclaw', name: 'Garra Sangrienta', desc: '3 de vida por enemigo en cada ataque, hasta 12 por ataque. En total, no más del 2% de tu vida máxima por segundo.',
      on: () => {}, off: () => {} },
    { id: 'luckcharm', name: 'Amuleto Suerte', desc: 'Al recoger un ticket, un 1% de que cuente por dos.',
      on: () => {}, off: () => {} },
    { id: 'amuletcoin', name: 'Moneda Amuleto', desc: '+100% de Pokémonedas al acabar la run. Si lo cambias antes de terminar, no se aplica.',
      on: p => { p.coinMul *= 2; }, off: p => { p.coinMul /= 2; } },
    { id: 'luckyegg', name: 'Huevo Suerte', desc: '+30% de experiencia.',
      on: p => { p.xpMul *= 1.3; }, off: p => { p.xpMul /= 1.3; } },
    { id: 'lifeorb', name: 'Vidasfera', desc: '+30% de daño, pero cada ataque te quita un poco de vida.',
      on: p => { p.atkMul *= 1.3; }, off: p => { p.atkMul /= 1.3; } },
    { id: 'choicescarf', name: 'Pañuelo Elección', desc: '+35% de velocidad.',
      on: p => { p.spdMul *= 1.35; }, off: p => { p.spdMul /= 1.35; } },
    { id: 'rockyhelmet', name: 'Casco Dentado', desc: 'Los que te golpean cuerpo a cuerpo reciben daño.',
      on: () => {}, off: () => {} },
    { id: 'assaultvest', name: 'Chaleco Asalto', desc: '+20% de reducción de daño recibido.',
      on: p => { p.dmgReduce += 0.2; }, off: p => { p.dmgReduce -= 0.2; } },
    { id: 'meowthmedal', name: 'Medallón de Meowth', desc: 'Las monedas caen un 30% más a menudo.',
      on: () => {}, off: () => {} },
    { id: 'winticket', name: 'Boleto Ganador', desc: 'El oro que recoges vale ×1,5 al momento.',
      on: () => {}, off: () => {} },
    { id: 'lockpick', name: 'Ganzúa', desc: 'Los cofres se abren 1 segundo más rápido.',
      on: p => { p.chestCut += 1; }, off: p => { p.chestCut -= 1; } },
    { id: 'masterkey', name: 'Llave Maestra (1)', desc: 'Abre un cofre al tocarlo. Luego se gasta.',
      on: () => {}, off: () => {} },
    { id: 'iceboots', name: 'Botines de Hielo', desc: 'En el agua no te frenas y vas un 30% más rápido.',
      on: () => {}, off: () => {} },
    { id: 'saunatowel', name: 'Toalla de Sauna', desc: 'La lava no te hace daño y recuperas 4 de vida por segundo.',
      on: () => {}, off: () => {} }
  ];
  // Hueco propio (no entra en el sorteo del objeto normal). 1,5% en cofres y jefes.
  const STONE = { id: 'evostone', name: 'Piedra Evolución', desc: 'Hueco aparte. Un básico evoluciona desde el nivel 65 y una segunda etapa desde el 135.',
    on: () => {}, off: () => {} };
  const BY = {};
  for (const it of LIST) BY[it.id] = it;
  BY[STONE.id] = STONE;

  // Probabilidad (en %) de que aparezca un objeto normal, y la de la piedra (aparte).
  const DROP = { small: 8, big: 50, boss: 100, stone: 1.5 };
  /** Probabilidad (en %) de un objeto concreto de la lista en esa fuente. */
  function each(source) { return DROP[source] / LIST.length; }

  /** Uno al azar, distinto del que ya llevas. */
  function roll(except) {
    const pool = LIST.filter(i => i.id !== except);
    return G.U.pick(pool).id;
  }

  // En la torre no hay cofres ni cierre de run al que le saquen partido.
  const TOWER_BAN = new Set(['lockpick', 'masterkey', 'amuletcoin']);

  function itemCard(it) {
    return {
      w: 0, type: 'item', key: 'item:' + it.id, itemId: it.id,
      icon: it.id, color: '#ffd23f', tag: 'Objeto',
      title: it.name, desc: it.desc,
      apply: p => {
        if (!p || p.item === it.id) return;
        p.equip(it.id);
        G.Spawner.say('¡Llevas ' + it.name + '!', 2.6, true);
        G.Progress.event('item', { id: it.id });
        G.FX.ring(p.x, p.y, 8, 70, '#ffd23f', 0.55, 4);
      }
    };
  }

  /**
   * Tienda del jefe de la torre: 2 objetos. avoid son los que acaba de ver
   * (el cambio no los repite). Tampoco sale el que ya lleva.
   */
  function towerOffer(pl, n = 2, avoid) {
    const ban = new Set(TOWER_BAN);
    if (pl && pl.item) ban.add(pl.item);
    const base = LIST.filter(i => !ban.has(i.id));
    const skip = new Set(avoid || []);
    let pool = base.filter(i => !skip.has(i.id));
    if (pool.length < n) pool = base.slice();
    const bag = pool.slice();
    const out = [];
    while (out.length < n && bag.length) {
      const i = Math.floor(Math.random() * bag.length);
      out.push(itemCard(bag.splice(i, 1)[0]));
    }
    return out;
  }

  /** Cuántos llevan este objeto ahora (en grupo, cada uno el suyo). */
  function holders(id) {
    if (G.Coop && G.Coop.active) {
      let n = 0;
      for (const p of G.Coop.players()) if (p && p.item === id) n++;
      return n;
    }
    const pl = G.Game && G.Game.player;
    return pl && pl.item === id ? 1 : 0;
  }

  /** Medallón de Meowth: las monedas caen un 30% más por cada uno que lo lleve. */
  function coinFreq() { return 1 + 0.3 * holders('meowthmedal'); }

  /** Probabilidad de que caiga una moneda, ya con el medallón. */
  function coinChance(p) { return Math.min(1, p * coinFreq()); }

  /** Cuántas monedas suelta un montón fijo (10 pasan a 13, etc.). */
  function coinRolls(n) {
    const x = n * coinFreq();
    if (x === n) return n;
    const base = Math.floor(x);
    return base + (Math.random() < x - base ? 1 : 0);
  }

  return { LIST, BY, roll, towerOffer, STONE, DROP, each, holders, coinFreq, coinChance, coinRolls };
})();
