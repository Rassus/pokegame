/* ============ pass.js — misiones y premios del pase mensual ============
 * El pase dura un mes (hora de España). 100 niveles, 10 puntos cada uno.
 * Las misiones se completan solas. Los premios se recogen a mano.
 * La misma familia no se repite dentro de un lote (las 5 del día, las 12
 * de la semana o las 8 del mes). De un día a otro sí puede repetirse:
 * las dos avanzan con el mismo contador del mes.
 */
G.PassData = (() => {
  const T = t => (G.U.TYPE_NAME[t] || t);
  const num = n => G.U.num(n);
  const mon = dex => (G.DEX_BY[dex] && G.DEX_BY[dex].name) || 'ese Pokémon';
  const ALTAR = { dmg: 'Furia', spd: 'Rayo', mag: 'Imán', cd: 'Prisa' };
  const TICK = { any: '', t1: ' grises', t10: ' morados', tb: ' azules', tg: ' dorados' };

  function tiers(groups) {
    const o = {};
    for (let i = 0; i < groups.length; i++) o[i + 1] = groups[i];
    return o;
  }

  // Cada familia reparte metas cerradas del tier 1 (poco) al 9 (el tope).
  const L = {
    goldSpend: tiers([[1000, 1500, 2000, 3000, 5000], [8000, 10000, 15000], [20000, 25000, 40000, 50000], [75000, 100000, 150000], [200000, 350000, 500000, 650000], [800000, 1000000], [1200000, 1500000], [1750000], [2000000]]),
    goldEarn: tiers([[10000, 15000, 25000], [40000, 50000, 80000], [100000, 150000, 250000], [400000, 500000], [800000, 1000000, 1500000], [2000000], [3000000], [4000000], [5000000]]),
    goldRun: tiers([[2000, 3000, 5000], [8000, 10000], [15000, 20000], [25000, 35000], [50000], [65000], [80000], [90000], [100000]]),
    kills: tiers([[100, 200, 400, 500], [800, 1000, 1500, 2000], [3000, 5000, 8000, 10000], [15000, 25000, 40000], [60000, 100000, 150000], [250000, 400000], [600000, 750000], [900000], [1000000]]),
    runKill: tiers([[100, 200, 400], [800, 1500], [2500, 4000], [6000, 8000], [12000, 15000], [20000, 25000], [30000, 35000], [40000], [50000]]),
    minutes: tiers([[5, 6, 8], [10, 12, 15], [18, 20, 25], [30, 40], [45, 50, 60], [70, 80], [90, 100], [110], [120]]),
    runMin: tiers([[3, 4, 5], [6, 8], [10, 12], [14, 15], [18], [20], [22], [24], [25]]),
    tickAny: tiers([[1, 5, 10, 25, 50], [100, 200, 400], [600, 800, 1000], [1500, 2000], [2500, 3000], [3500], [4000], [4500], [5000]]),
    tick10: tiers([[1, 3, 5], [10, 20], [30, 50], [80, 100], [150, 200], [300], [500], [650], [800]]),
    tickB: tiers([[1, 2, 3], [5, 10], [15, 25], [40, 50], [70, 100], [150], [180], [220], [250]]),
    tickG: tiers([[1], [2, 3], [5, 7], [10], [15], [20], [30], [40], [50]]),
    rift: tiers([[1, 2], [3, 4], [5, 8], [10, 15], [20, 30], [40, 50], [60, 75], [90], [100]]),
    riftRun: tiers([[1], [2, 3], [4, 5], [6, 8], [10, 12], [15, 18], [20, 22], [25], [30]]),
    few: tiers([[1], [1], [2], [2], [2], [3], [3], [3], [3]]),
    boss: tiers([[10, 15], [20, 30], [40, 50], [75, 100], [150, 200], [300, 400], [500, 650], [800], [1000]]),
    bossRun: tiers([[1], [2, 3], [4, 5], [6, 8], [10, 12], [15, 18], [20, 22], [25], [30]]),
    runs: tiers([[10, 12, 15], [20, 25], [30, 40], [50, 75], [100, 120], [150, 180], [200, 230], [260], [300]]),
    item: tiers([[10, 15, 25], [40, 50], [75, 100], [150, 200], [250, 300], [350], [400], [450], [500]]),
    itemRun: tiers([[3, 5], [8, 10], [15, 20], [25, 30], [40, 50], [60], [75], [90], [100]]),
    gacha: tiers([[1, 2], [3, 4], [5, 6], [8], [10], [12, 15], [18], [22], [25]]),
    chest: tiers([[25, 40], [50, 75], [100, 150], [200, 250], [300, 400], [500], [650], [800], [1000]]),
    chestRun: tiers([[1, 2], [3, 5], [8, 10], [15, 20], [25, 30], [40, 50], [60, 75], [90], [100]]),
    rock: tiers([[100, 150], [200, 300], [400, 500], [600], [700], [800], [900], [950], [1000]]),
    rockRun: tiers([[3, 5], [8, 12], [15, 20], [25, 30], [40, 50], [60], [75], [90], [100]]),
    altar: tiers([[100, 150], [200, 250], [300, 400], [500], [600], [700], [800], [900], [1000]]),
    altarOne: tiers([[10, 15], [20, 30], [40, 50], [60, 80], [100], [120], [150], [180], [200]]),
    altarRun: tiers([[5, 8], [10, 15], [20, 25], [30, 40], [50], [60], [75], [90], [100]]),
    altarOneRun: tiers([[1, 2], [3, 4], [5, 6], [8], [10], [12, 15], [18], [22], [25]]),
    spring: tiers([[150, 200], [250, 400], [500, 700], [800, 1000], [1200], [1400], [1600], [1800], [2000]]),
    springRun: tiers([[25, 40], [50, 75], [100, 120], [140, 160], [180], [200], [220], [240], [250]]),
    tw: tiers([[1], [2, 3], [4, 5], [6, 8], [10], [12, 15], [18], [22], [25]]),
    twOne: tiers([[1], [2], [3], [4], [5], [6], [8], [9], [10]]),
    twG: tiers([[3, 5], [8, 10], [15, 20], [25, 30], [40, 50], [60], [75], [90], [100]]),
    floor: tiers([[10, 15], [20, 25], [30, 40], [50], [60], [70], [80], [90], [100]]),
    floorG: tiers([[20, 25], [30, 40], [50], [60], [70], [80], [90], [95], [100]])
  };

  const TICK_L = { any: 'tickAny', t1: 'tickAny', t10: 'tick10', tb: 'tickB', tg: 'tickG' };

  // fam: no se repite en el mismo lote. mode max = la mejor run del mes.
  const KINDS = [
    { id: 'goldSpend', fam: 'oro', ladder: 'goldSpend' },
    { id: 'goldEarn', fam: 'oro', ladder: 'goldEarn' },
    { id: 'goldRun', fam: 'oro', ladder: 'goldRun', max: true },
    { id: 'kills', fam: 'kills', ladder: 'kills' },
    { id: 'runKillDex', fam: 'kills', ladder: 'runKill', max: true, param: 'dex' },
    { id: 'runKillType', fam: 'kills', ladder: 'runKill', max: true, param: 'type' },
    { id: 'minutes', fam: 'tiempo', ladder: 'minutes', max: true },
    { id: 'runMinDex', fam: 'tiempo', ladder: 'runMin', max: true, param: 'dex' },
    { id: 'runMinType', fam: 'tiempo', ladder: 'runMin', max: true, param: 'type' },
    { id: 'tickE', fam: 'tickets', ladder: 'tick', param: 'ticket' },
    { id: 'tickS', fam: 'tickets', ladder: 'tick', param: 'ticket' },
    { id: 'rift', fam: 'grieta', ladder: 'rift' },
    { id: 'riftRun', fam: 'grieta', ladder: 'riftRun', max: true },
    { id: 'riftBoss', fam: 'grieta', ladder: 'few', param: 'riftBoss' },
    { id: 'boss', fam: 'jefe', ladder: 'boss' },
    { id: 'bossRun', fam: 'jefe', ladder: 'bossRun', max: true },
    { id: 'bossOne', fam: 'jefe', ladder: 'few', param: 'boss' },
    { id: 'runs', fam: 'runs', ladder: 'runs' },
    { id: 'item', fam: 'objeto', ladder: 'item' },
    { id: 'itemRun', fam: 'objeto', ladder: 'itemRun', max: true },
    { id: 'gachaDex', fam: 'gacha', ladder: 'gacha', param: 'gachaDex' },
    { id: 'gachaType', fam: 'gacha', ladder: 'gacha', param: 'type' },
    { id: 'gachaLine', fam: 'gacha', ladder: 'gacha', param: 'line' },
    { id: 'chest', fam: 'cofre', ladder: 'chest' },
    { id: 'chestRun', fam: 'cofre', ladder: 'chestRun', max: true },
    { id: 'rock', fam: 'piedra', ladder: 'rock' },
    { id: 'rockRun', fam: 'piedra', ladder: 'rockRun', max: true },
    { id: 'altar', fam: 'altar', ladder: 'altar' },
    { id: 'altarOne', fam: 'altar', ladder: 'altarOne', param: 'altar' },
    { id: 'altarRun', fam: 'altar', ladder: 'altarRun', max: true },
    { id: 'altarOneRun', fam: 'altar', ladder: 'altarOneRun', max: true, param: 'altar' },
    { id: 'spring', fam: 'pozo', ladder: 'spring' },
    { id: 'springRun', fam: 'pozo', ladder: 'springRun', max: true },
    { id: 'tw', fam: 'torre', ladder: 'tw' },
    { id: 'twOne', fam: 'torre', ladder: 'twOne', param: 'tower' },
    { id: 'twG', fam: 'torre', ladder: 'twG' },
    { id: 'twGOne', fam: 'torre', ladder: 'twOne', param: 'tower' },
    { id: 'twMon', fam: 'torre', ladder: 'few', param: 'dex' },
    { id: 'twType', fam: 'torre', ladder: 'few', param: 'type' },
    { id: 'floor', fam: 'torre', ladder: 'floor', max: true },
    { id: 'floorG', fam: 'torre', ladder: 'floorG', max: true }
  ];
  const BY = {};
  for (const k of KINDS) BY[k.id] = k;

  function goals(id, tier, param) {
    const k = BY[id];
    if (!k) return [];
    let name = k.ladder;
    if (name === 'tick') name = TICK_L[param] || 'tickAny';
    const row = L[name];
    return (row && row[tier]) || [];
  }

  function points(tier) {
    if (tier <= 4) return tier * 3;
    if (tier <= 7) return tier * 6;
    return tier * 40;
  }

  function text(m) {
    const n = num(m.goal);
    const p = m.param;
    switch (m.kind) {
      case 'goldSpend': return 'Gasta ' + n + ' de oro';
      case 'goldEarn': return 'Acumula ' + n + ' de oro';
      case 'goldRun': return 'Gana ' + n + ' de oro en una run';
      case 'kills': return 'Derrota a ' + n + ' Pokémon';
      case 'runKillDex': return 'Derrota a ' + n + ' Pokémon con ' + mon(p);
      case 'runKillType': return 'Derrota a ' + n + ' Pokémon con un Pokémon de tipo ' + T(p);
      case 'minutes': return 'Aguanta ' + n + ' minutos en una run';
      case 'runMinDex': return 'Aguanta ' + n + ' minutos con ' + mon(p);
      case 'runMinType': return 'Aguanta ' + n + ' minutos con un Pokémon de tipo ' + T(p);
      case 'tickE': return 'Consigue ' + n + ' tickets' + (TICK[p] || '');
      case 'tickS': return 'Gasta ' + n + ' tickets' + (TICK[p] || '');
      case 'rift': return n === '1' ? 'Gana 1 grieta' : 'Gana ' + n + ' grietas';
      case 'riftRun': return 'Gana ' + n + ' grietas en una run';
      case 'riftBoss': return 'Derrota ' + n + ' veces a ' + mon(p) + ' en una grieta';
      case 'boss': return 'Derrota a ' + n + ' jefes';
      case 'bossRun': return 'Derrota a ' + n + ' jefes en una run';
      case 'bossOne': return 'Derrota ' + n + ' veces al jefe ' + mon(p);
      case 'runs': return 'Juega ' + n + ' runs de 1 minuto o más';
      case 'item': return 'Encuentra ' + n + ' objetos';
      case 'itemRun': return 'Encuentra ' + n + ' objetos en una run';
      case 'gachaDex': return 'Encuentra ' + n + ' veces a ' + mon(p) + ' en el gacha';
      case 'gachaType': return 'Encuentra ' + n + ' Pokémon de tipo ' + T(p) + ' en el gacha';
      case 'gachaLine': return 'Encuentra ' + n + ' Pokémon de la línea de ' + mon(p);
      case 'chest': return 'Abre ' + n + ' cofres';
      case 'chestRun': return 'Abre ' + n + ' cofres en una run';
      case 'rock': return 'Rompe ' + n + ' piedras';
      case 'rockRun': return 'Rompe ' + n + ' piedras en una run';
      case 'altar': return 'Activa ' + n + ' altares';
      case 'altarOne': return 'Activa ' + n + ' veces el altar de ' + (ALTAR[p] || 'Furia');
      case 'altarRun': return 'Activa ' + n + ' altares en una run';
      case 'altarOneRun': return 'Activa ' + n + ' veces el altar de ' + (ALTAR[p] || 'Furia') + ' en una run';
      case 'spring': return 'Cúrate ' + n + ' veces en un manantial';
      case 'springRun': return 'Cúrate ' + n + ' veces en un manantial en una run';
      case 'tw': return 'Juega ' + n + ' torres en solitario';
      case 'twOne': return 'Juega ' + n + ' veces la torre de ' + mon(p);
      case 'twG': return 'Juega ' + n + ' torres en grupo';
      case 'twGOne': return 'Juega ' + n + ' veces la torre de ' + mon(p) + ' en grupo';
      case 'twMon': return 'Juega ' + n + ' torres en solitario con ' + mon(p);
      case 'twType': return 'Juega ' + n + ' torres en solitario con un Pokémon de tipo ' + T(p);
      case 'floor': return 'Llega a la oleada ' + n + ' de una torre';
      case 'floorG': return 'Llega a la oleada ' + n + ' de una torre en grupo';
      default: return 'Misión de pase';
    }
  }

  // Huecos fijos de cada nivel. El oro, los grises y los morados van en el
  // resto (2 por decena, 2 por decena y 1 por decena).
  const PIN = {
    35: { kind: 'shiny' }, 50: { kind: 'tg' }, 90: { kind: 'tg' }, 100: { kind: 'shiny5' },
    30: { kind: 'mon', rarity: 5 }, 60: { kind: 'mon', rarity: 5 }, 97: { kind: 'mon', rarity: 5 },
    21: { kind: 'mon', rarity: 4 }, 41: { kind: 'mon', rarity: 4 }, 61: { kind: 'mon', rarity: 4 },
    81: { kind: 'mon', rarity: 4 }, 95: { kind: 'mon', rarity: 4 },
    15: { kind: 'tb' }, 27: { kind: 'tb' }, 45: { kind: 'tb' }, 63: { kind: 'tb' }, 75: { kind: 'tb' }, 87: { kind: 'tb' },
    13: { kind: 'mon', rarity: 3 }, 33: { kind: 'mon', rarity: 3 }, 43: { kind: 'mon', rarity: 3 },
    57: { kind: 'mon', rarity: 3 }, 73: { kind: 'mon', rarity: 3 }, 83: { kind: 'mon', rarity: 3 },
    10: { kind: 'mon', rarity: 2 }, 20: { kind: 'mon', rarity: 2 }, 37: { kind: 'mon', rarity: 2 },
    40: { kind: 'mon', rarity: 2 }, 47: { kind: 'mon', rarity: 2 }, 67: { kind: 'mon', rarity: 2 },
    70: { kind: 'mon', rarity: 2 }, 80: { kind: 'mon', rarity: 2 }, 85: { kind: 'mon', rarity: 2 },
    91: { kind: 'mon', rarity: 2 }
  };

  function layout() {
    const rows = [];
    for (let lv = 1; lv <= 100; lv++) {
      const e = lv % 10;
      let row;
      if (PIN[lv]) row = Object.assign({ lv }, PIN[lv]);
      else if (e === 2 || e === 4) row = { lv, kind: 'gold' };
      else if (e === 6 || e === 8) row = { lv, kind: 't1' };
      else if (e === 9) row = { lv, kind: 't10' };
      else row = { lv, kind: 'mon', rarity: 1 };
      rows.push(row);
    }
    return rows;
  }

  const BANDS = {
    gold: [1000, 5000, 25000, 150000, 250000],
    t1: [100, 300, 600, 1000, 5000],
    t10: [10, 30, 100, 200, 800],
    tb: [5, 15, 45, 70, 250],
    tg: [1, 3, 7, 15, 50]
  };
  const WEIGHTS = [50, 30, 15, 4, 1];
  const DUP = { 1: 50, 2: 100, 3: 100, 4: 150, 5: 150 };
  const RNAME = { 1: 'común', 2: 'poco común', 3: 'raro', 4: 'épico', 5: 'legendario' };

  return {
    KINDS, BY, goals, points, text, layout, BANDS, WEIGHTS, DUP, RNAME, ALTAR,
    DAILY: [1, 2], WEEKLY: [3, 4, 5, 6], MONTHLY: [7, 8, 9]
  };
})();
