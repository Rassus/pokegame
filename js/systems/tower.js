/* ============ tower.js — torres en una grieta ============
 * Cada jefe vencido en una grieta tiene su torre. La primera oleada sale al
 * entrar; las siguientes, cada 10 s, aunque queden vivos. Difícil duplica
 * los Pokémon, baja a 5 s y parte al jefe en 10 etapas. Demencial los
 * cuadruplica, una oleada cada 2 s y un jefe en cada una: se quedan todos.
 * Se juega en una arena de grieta más ancha que la del legendario: las
 * oleadas salen en el borde, lejos de los jugadores. La dificultad sube con
 * las mejoras del compañero (en grupo, las del anfitrión, que es quien
 * genera las oleadas).
 *
 * Entrada, en oro y a partes iguales: Kanto 3.000, Johto 10.000, Hoenn y
 * las de después 50.000. Desde Hoenn, cada jugador paga además 10 tickets
 * grises. Rayquaza es aparte: 150 oleadas, 100.000 de oro y seis encuentros
 * antes del jefe final.
 *
 * En torres de Kanto, los Pokémon de oleada dan XP ×2, 3 Pokémonedas y un
 * 0,01% de un fragmento de su línea. En todas las torres, la tienda abre cada
 * 10 oleadas (Premio por oleada la adelanta hasta cada 5): 2 mejoras y una baya.
 *
 * Al superar la torre el premio sigue la tier: Kanto es 1 y cada región
 * suma una; el difícil empieza en 10 y el demencial en 19. El oro es ×4 del
 * costo × la tier, los tickets dorados ×0,8 × la tier y los fragmentos
 * (60 % de 45 a 100) ×1,5 × la tier. Si no lo tienes, un 25% de atraparlo.
 * El jefe puede salir shiny (1/1024). No cuenta para el récord de tiempo
 * ni para el ranking.
 */
G.Towers = (() => {
  const EVERY = 10;
  // La del legendario es 11. Aquí cabe un anillo de aparición fuera de la vista.
  const ARENA_R = 16;
  const MODES = [
    { id: 'normal', name: 'Normal', hint: '10 s', pack: 1, every: 10, stages: 0, stack: false },
    { id: 'hard', name: 'Difícil', hint: '×4 precio', detail: '×4 de precio · ×2 Pokémon · 5 s · jefe en 10 etapas', pack: 2, every: 5, stages: 10, stack: false },
    { id: 'mad', name: 'Demencial', hint: 'sin costo', detail: 'sin costo · ×4 Pokémon · 2 s · jefe en cada oleada', pack: 4, every: 2, stages: 0, stack: true }
  ];
  const CHANSEY = 113;
  const RAYQUAZA = 384;
  // Cinco luces: la primera tarda 1,5 s y cada una va más rápida. Luego el rayo.
  const RAY_PULSE = [1.5, 1.08, 0.78, 0.56, 0.4];
  const RAY_BEAM = 4;
  const RAY_SCORCH = 15;
  const RAY_CD = 30;
  const CHANSEY_N = { 10: 1, 30: 3, 50: 5, 70: 7, 90: 7 };
  const PLAN = [25, 50, 75, 100];
  const REGIONS = ['', 'Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Teselia', 'Kalos', 'Alola', 'Galar', 'Paldea'];
  const ONE = { hp: 1, spd: 1, dmg: 1 };
  // Torres de Kanto: más XP/oro por baja y un fragmento muy raro.
  const KANTO = { xp: 2, gold: 3, fragPct: 0.01 };

  function specFor(p) {
    if (p.dex === 384) return { fee: 100000, tickets: 0, waves: 150, plan: [20, 40, 60, 80, 100, 120, 150] };
    const gen = p.gen || 1;
    const fee = gen === 1 ? 3000 : gen === 2 ? 10000 : 50000;
    return { fee, tickets: gen >= 3 ? 10 : 0, waves: 100, plan: PLAN.slice() };
  }

  const LIST = G.DEX.filter(p => p.leg && G.SPRITE_META[p.dex]).map(p => {
    const spec = specFor(p);
    return {
      id: String(p.dex), name: p.name, gen: p.gen || 1,
      region: REGIONS[p.gen] || REGIONS[1], dexes: [p.dex],
      fee: spec.fee, tickets: spec.tickets, waves: spec.waves, plan: spec.plan
    };
  });
  const KIT = {
    1: ['med'],
    2: ['med', 'aura'],
    3: ['med', 'aura', 'amnesia'],
    4: ['med', 'aura', 'amnesia', 'silence']
  };
  const PHASE_HP = [0, 0.8, 1.05, 1.35, 1.7, 2.1, 2.55, 3.05];

  let armed = null;
  let run = null;

  const authority = () => !G.Coop.active || G.Coop.isHost;
  const ts = () => G.Tiles.T * G.Sprites.PX;

  function unlocked(dex) {
    const s = G.DB.save;
    return !!(s && s.legends && s.legends[dex]);
  }

  function party() {
    const room = G.Social && G.Social.room;
    return Math.max(1, room && room.members ? room.members.length : 1);
  }

  function due(id, modeId) {
    const t = LIST.find(x => x.id === id);
    if (!t) return null;
    const mode = modeOf(modeId);
    const k = mode.id === 'mad' ? 0 : mode.id === 'hard' ? 4 : 1;
    const fee = t.fee * k, tickets = (t.tickets || 0) * k;
    return { share: fee ? Math.ceil(fee / party()) : 0, tickets, fee: t.fee };
  }

  /** La difícil pide esa torre en normal; la demencial, en difícil. */
  function modeOpen(id, modeId) {
    const mode = modeOf(modeId).id;
    if (mode === 'normal') return true;
    const s = G.DB.save;
    const row = (s && s.towerMode && s.towerMode[id]) || {};
    if (mode === 'hard') return !!((s && s.tower100 && s.tower100[id] > 0) || row.normal > 0);
    return (row.hard || 0) > 0;
  }

  /** '' si puede pagar; si no, 'coins' o 'tickets'. */
  function afford(cfg) {
    const save = G.DB.save;
    const cost = (cfg && cfg.share) || 0;
    const tickets = (cfg && cfg.tickets) || 0;
    if (cost > 0 && (!save || (save.coins || 0) < cost)) return 'coins';
    if (tickets > 0 && (!save || !save.tickets || (save.tickets.t1 || 0) < tickets)) return 'tickets';
    return '';
  }

  function charge(cfg) {
    const why = afford(cfg);
    if (why) return false;
    const save = G.DB.save;
    const cost = (cfg && cfg.share) || 0;
    const tickets = (cfg && cfg.tickets) || 0;
    if (!(cost > 0) && !(tickets > 0)) return true;
    if (!save) return false;
    if (cost > 0) save.coins -= cost;
    if (tickets > 0) {
      save.tickets = Object.assign({ t1: 0, t10: 0, tb: 0, tg: 0 }, save.tickets);
      save.tickets.t1 -= tickets;
    }
    G.DB.commit();
    return true;
  }

  function peek() { return armed; }
  function arm(cfg) { armed = cfg; }
  function claim() { const a = armed; armed = null; return a; }
  function reset() { run = null; }

  function modeOf(id) { return MODES.find(m => m.id === id) || MODES[0]; }

  /** Kanto es 1. El difícil sigue tras Paldea (10) y el demencial tras el difícil (19). */
  function tierOf(gen, modeId) {
    const g = Math.max(1, Math.min(9, gen || 1));
    const mode = modeOf(modeId).id;
    const block = mode === 'hard' ? 9 : mode === 'mad' ? 18 : 0;
    return g + block;
  }

  /** Etapas repartidas por la torre; la última cae en la oleada final. */
  function stagePlan(waves, stages) {
    const plan = [];
    for (let i = 1; i <= stages; i++) {
      const prev = plan.length ? plan[plan.length - 1] : 0;
      plan.push(Math.min(waves, Math.max(prev + 1, Math.round(waves * i / stages))));
    }
    plan[plan.length - 1] = waves;
    return plan;
  }

  function planFor(t, mode) {
    if (mode.stack) {
      const plan = [];
      for (let i = 1; i <= t.waves; i++) plan.push(i);
      return plan;
    }
    if (mode.stages) return stagePlan(t.waves, mode.stages);
    return t.plan.slice();
  }

  /** Qué jefe y en qué arena. La llama quien entra. */
  function prepare(id, modeId) {
    const t = LIST.find(x => x.id === id);
    if (!t) return null;
    const dex = t.dexes[0];
    if (!unlocked(dex)) return null;
    const mode = modeOf(modeId);
    if (!modeOpen(id, mode.id)) return null;
    const pay = due(id, mode.id);
    return {
      id, dex, fee: t.fee, tickets: pay.tickets, waves: t.waves, plan: planFor(t, mode),
      share: pay.share, every: mode.every, pack: mode.pack, stack: mode.stack, mode: mode.id,
      tier: tierOf(t.gen, mode.id),
      arena: {
        tx: 5000 + G.U.randInt(0, 2999), ty: 5000 + G.U.randInt(0, 2999),
        r: ARENA_R, type: arenaType(dex)
      },
      shiny: G.Sprites.hasShiny(dex) && Math.random() < 1 / 1024,
      duel: false
    };
  }

  function arenaType(dex) {
    const types = (G.DEX_BY[dex] && G.DEX_BY[dex].types) || [];
    return types.find(tp => G.Tiles.ARENA_TYPES.includes(tp)) || 'psychic';
  }

  /** 1 sin mejoras, 2 con todas al máximo. */
  function threat() {
    const save = G.DB.save;
    if (!save || !save.partner) return 1;
    const levels = G.DB.upgradesOf(save.partner);
    let sum = 0;
    for (const k in levels) sum += +levels[k] || 0;
    let max = 0;
    for (const u of G.Upgrades.LIST) if (u.cat === 'mon') max += u.max;
    if (!max) return 1;
    return 1 + Math.min(1, sum / max);
  }

  function begin(cfg) {
    const tile = ts();
    const plan = (cfg.plan && cfg.plan.length) ? cfg.plan.slice() : PLAN.slice();
    const gen = (G.DEX_BY[cfg.dex] && G.DEX_BY[cfg.dex].gen) || 1;
    run = {
      id: cfg.id, dex: cfg.dex, gen, shiny: !!cfg.shiny, waves: cfg.waves || 100,
      plan, phases: plan.length, fee: cfg.fee || 0,
      every: cfg.every || EVERY, pack: cfg.pack || 1, stack: !!cfg.stack, mode: cfg.mode || 'normal',
      tier: cfg.tier || tierOf(gen, cfg.mode),
      wave: 0, wait: 0.4, cleared: false, done: false, reward: null,
      bosses: [], finalDown: false, aura: 0, fx: null, duel: !!cfg.duel,
      ax: cfg.arena.tx * tile + tile / 2, ay: cfg.arena.ty * tile + tile / 2, ar: cfg.arena.r
    };
    G.World.setArena({ tx: cfg.arena.tx, ty: cfg.arena.ty, r: cfg.arena.r, type: cfg.arena.type });
    G.World.setBiome(G.Tiles.arenaBiome(cfg.arena.type), true);
    const th = G.Tiles.ARENA_THEMES[cfg.arena.type];
    if (th && th.weather) G.Weather.force(th.weather, 2400);
    const ps = G.Game.everyone();
    ps.forEach((p, i) => {
      p.x = run.ax + (i - (ps.length - 1) / 2) * 34;
      p.y = run.ay + tile * 3;
    });
    const pl = G.Game.player;
    if (pl) { G.Camera.x = pl.x; G.Camera.y = pl.y; }
    G.Audio.sfx('rift');
    const hi = run.mode === 'hard' ? 'Modo difícil…' : run.mode === 'mad' ? 'Modo demencial…' : 'Has entrado en la grieta…';
    G.Spawner.say(hi, 2.4, true);
    const pool = minionPool(cfg.dex);
    const dexes = pool.typed.concat(pool.rest).map(p => p.dex);
    G.Sprites.preload(dexes.concat(cfg.dex, CHANSEY), 8000, cfg.shiny);
  }

  function active() { return !!run && !run.done; }
  function done() { return !!(run && run.done); }
  function take() { const r = run; run = null; return r; }

  function noteClear() {
    if (!run || run.counted || run.duel) return;
    run.counted = true;
    const s = G.DB.save;
    if (!s) return;
    s.stats = s.stats || {};
    s.stats.towerClears = (s.stats.towerClears || 0) + 1;
    if (!run.id) return;
    s.towerMode = s.towerMode || {};
    const row = Object.assign({ normal: 0, hard: 0, mad: 0 }, s.towerMode[run.id]);
    const key = run.mode === 'hard' ? 'hard' : run.mode === 'mad' ? 'mad' : 'normal';
    row[key] = (row[key] || 0) + 1;
    s.towerMode[run.id] = row;
  }

  function markClear() {
    if (!run) return;
    noteClear();
    if (!run.reward) { run.cleared = true; run.reward = rollReward(); }
    run.done = true;
  }

  function hud() {
    if (!run) return null;
    if (run.duel) {
      const name = (G.DEX_BY[run.dex] && G.DEX_BY[run.dex].name) || '';
      return name ? '¡Jefe: ' + name + '!' : 'Jefe directo';
    }
    const tag = run.mode === 'hard' ? 'Difícil · ' : run.mode === 'mad' ? 'Demencial · ' : '';
    if (!run.wave) return tag + 'Torre · ' + run.waves + ' oleadas';
    const left = run.wave < run.waves && run.wait > 0 ? ' · ' + Math.ceil(run.wait) + ' s' : '';
    return tag + 'Oleada ' + run.wave + '/' + run.waves + left;
  }

  function minionPool(dex) {
    const mon = G.DEX_BY[dex];
    const gen = (mon && mon.gen) || 1;
    const types = (mon && mon.types) || [];
    const base = G.DEX.filter(p => !p.leg && G.SPRITE_META[p.dex] && (p.gen || 1) === gen && p.dex !== dex && p.dex !== CHANSEY);
    const typed = base.filter(p => p.types.some(t => types.includes(t)));
    const rest = base.filter(p => !typed.includes(p));
    const bag = rest.length ? rest : base;
    if (bag.length) return { typed, rest: bag };
    const any = G.DEX.filter(p => !p.leg && G.SPRITE_META[p.dex] && p.dex !== CHANSEY);
    return { typed: [], rest: any };
  }

  function pickMinion(pool, prefer) {
    if (prefer && pool.typed.length) return G.U.pick(pool.typed);
    const bag = pool.rest.length ? pool.rest : pool.typed;
    return bag.length ? G.U.pick(bag) : null;
  }

  /**
   * Tamaño de la oleada. Lo pedido: 1-5 → 10, 6-12 → 12, 13-18 → 16.
   * A partir de la 13, cada 6 oleadas suma 4 Pokémon.
   */
  function packSize(wave) {
    if (wave <= 5) return 10;
    if (wave <= 12) return 12;
    return 16 + Math.floor((wave - 13) / 6) * 4;
  }

  /** Borde de la arena, nunca encima de un jugador. */
  function spot() {
    const tile = ts();
    const outer = (run.ar - 2.2) * tile;
    const inner = Math.max(tile * 6, outer * 0.62);
    const gap = tile * 3.5;
    const players = G.Game.everyone().filter(p => p && !p.dead);
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * 6.2832, d = G.U.rand(inner, outer);
      const x = run.ax + Math.cos(a) * d, y = run.ay + Math.sin(a) * d;
      if (!G.World.isFree(x, y, 16)) continue;
      if (players.some(p => G.U.dist2(p.x, p.y, x, y) < gap * gap)) continue;
      return [x, y];
    }
    const x = run.ax, y = run.ay - outer;
    return G.World.isFree(x, y, 16) ? [x, y] : [run.ax, run.ay - tile * 4];
  }

  function scale() {
    const n = G.Game.everyone().length;
    return threat() * G.Coop.scaleHp(n);
  }

  /** Cada oleada es un 3% más fuerte que la anterior, en vida y en daño. */
  function growOf(k) { return Math.pow(1.03, Math.max(0, k - 1)); }

  function kantoLoot() {
    return run && !run.duel && run.gen === 1 ? KANTO : null;
  }

  function waveDef(p, k, mul, behavior) {
    const grow = growOf(k);
    const far = (p.types || []).some(t => ['psychic', 'electric', 'fire', 'water', 'ice', 'ghost', 'dragon'].includes(t));
    const beh = behavior || (far ? 'ranged' : 'chase');
    const loot = kantoLoot();
    const xp = Math.round((4 + k * 1.4) * (loot ? loot.xp : 1) * G.Upgrades.towerXp());
    return {
      dex: p.dex, name: p.name, behavior: beh,
      hp: Math.round((26 + k * 12) * mul * grow),
      spd: Math.round(G.U.clamp(52 + ((p.spd || 78) - 78) * 0.25, 46, 96)),
      dmg: Math.round((6 + k * 0.85) * mul * grow),
      xp,
      shotDmg: Math.round((4 + k * 0.55) * mul * grow),
      shotCd: beh === 'healer' ? 3.5 : 2.1,
      range: beh === 'healer' ? 230 : 200
    };
  }

  function place(def) {
    const [x, y] = spot();
    G.EnemyMgr.add(new G.Enemy(def, x, y, ONE));
  }

  function spawnPack(pl) {
    const k = run.wave;
    const mul = scale();
    const n = packSize(k) * Math.max(1, run.pack || 1);
    const pool = minionPool(run.dex);
    const preferN = pool.typed.length ? Math.ceil(n * 0.6) : 0;
    for (let i = 0; i < n; i++) {
      const p = pickMinion(pool, i < preferN);
      if (p) place(waveDef(p, k, mul));
    }
    const hens = CHANSEY_N[k] || 0;
    const hen = G.DEX_BY[CHANSEY];
    if (hen && hens) for (let i = 0; i < hens; i++) place(waveDef(hen, k, mul, 'healer'));
    G.Spawner.say('Oleada ' + k + ' de ' + run.waves, 2.2);
    if (k % G.Upgrades.shopEvery() === 0) run.wantShop = true;
  }

  function wantShop() { return !!(run && run.wantShop && !run.duel); }
  function clearShop() { if (run) run.wantShop = false; }

  /** Botín de oleada: oro extra de la cuenta y, en Kanto, el bono y el fragmento. */
  function onMinionDown(e) {
    if (!run || run.duel || !e || e.boss || e.legend || e.towerPhase) return;
    const loot = kantoLoot();
    const gold = (loot ? loot.gold : 0) + G.Upgrades.towerGold();
    if (gold > 0) G.Pickups.drop('coin', e.x + G.U.rand(-8, 8), e.y + G.U.rand(-6, 6), gold);
    if (loot && Math.random() * 100 < loot.fragPct) grantFrag(e.dex, true);
  }

  function grantFrag(dex, send) {
    const save = G.DB.save;
    if (!save || !dex) return;
    const key = String(G.Evo.root(dex));
    save.frags = save.frags || {};
    save.frags[key] = (save.frags[key] || 0) + 1;
    G.DB.commit();
    const name = (G.DEX_BY[dex] && G.DEX_BY[dex].name) || '';
    const pl = G.Game.player;
    if (pl) G.FX.dmgText(pl.x, pl.y - pl.bodyH - 10, '+1 fragmento · ' + name, '#c47bff', true);
    if (name) G.Spawner.say('¡Fragmento de ' + name + '!', 2.2, true);
    if (send) net(['tw', 'frag', dex]);
  }

  /** En demencial se abren en abanico al norte para no pisarse. */
  function bossSpot() {
    const tile = ts();
    const home = [run.ax, run.ay - tile * 3.2];
    if (!run.stack) return home;
    const n = run.bosses.length;
    for (let i = 0; i < 8; i++) {
      const k = n + i;
      const a = -1.5708 + ((k % 8) - 3.5) * 0.32;
      const d = tile * (2.6 + Math.floor(k / 8) * 0.85);
      const x = run.ax + Math.cos(a) * d, y = run.ay + Math.sin(a) * d;
      if (G.World.isFree(x, y, 16)) return [x, y];
    }
    return home;
  }

  function spawnBoss(pl, phase) {
    const mon = G.DEX_BY[run.dex];
    const n = G.Game.everyone().length;
    const hpK = PHASE_HP[phase] || PHASE_HP[PHASE_HP.length - 1];
    const mul = threat() * Math.max(1, n) * hpK * growOf(run.wave || 1);
    const far = mon.types.some(t => ['psychic', 'electric', 'ghost', 'fairy', 'fire', 'water', 'ice', 'dragon'].includes(t));
    const def = {
      dex: mon.dex, name: mon.name, behavior: far ? 'ranged' : 'charger',
      hp: Math.round(4200 * mul), spd: Math.round(G.U.clamp(50 + (mon.spd - 78) * 0.45, 48, 100)),
      dmg: Math.round(34 * mul), xp: Math.round((360 + phase * 80) * G.Upgrades.towerXp()),
      shotDmg: Math.round(18 * mul), shotCd: 1, range: 280
    };
    const [bx, by] = bossSpot();
    const e = new G.Enemy(def, bx, by, ONE, true);
    e.flying = false;
    e.legend = true;
    e.towerPhase = phase;
    e.maxShield = Math.round(e.maxHp * 0.25);
    e.shield = e.maxShield;
    e.tower = { meds: 0, med: 0, auraR: 340, cd: 5, cast: null, rad: 0, rayCd: mon.dex === RAYQUAZA ? 20 : 0 };
    if (run.shiny) e.makeShiny();
    G.EnemyMgr.add(e);
    run.bosses.push({ id: e.id, phase });
    G.Spawner.say(run.duel ? '¡Jefe: ' + mon.name + (e.shiny ? ' shiny' : '') + '!' : 'Fase ' + phase + ' · ' + mon.name + (e.shiny ? ' shiny' : ''), 3);
    G.Camera.kick(1.1);
    G.Audio.sfx('boss');
  }

  function bossOf() {
    return G.EnemyMgr.all().find(e => e.towerPhase && !e.dead) || null;
  }

  function inAura(pl) {
    if (!run || run.aura <= 0 || !pl) return false;
    return G.EnemyMgr.all().some(e => e.towerPhase && !e.dead && G.U.dist(pl.x, pl.y, e.x, e.y) < 340);
  }

  function coverRadius(e) {
    const max = (run.ar || 11) * ts();
    return Math.hypot((run.ax || e.x) - e.x, (run.ay || e.y) - e.y) + max;
  }

  function applyAmnesia(pl) {
    const n = pl.slots.length;
    if (!n) return;
    const lockN = n >= 4 ? 2 : 1;
    const idx = [pl.active];
    for (let i = 0; i < n && idx.length < lockN; i++) if (!idx.includes(i)) idx.push(i);
    pl.amnesia = idx;
    pl.amnesiaT = 15;
    if (idx.includes(pl.active)) {
      for (let i = 0; i < n; i++) if (!idx.includes(i)) { pl.active = i; G.Projectiles.clearOrbs(pl); break; }
    }
    G.Spawner.say('¡Amnesia! Durante 15 s olvidas parte de tus movimientos', 2.8, true);
  }

  function net(ev) { if (G.Coop.isHost) G.Coop.broadcast(ev); }

  function onNet(ev) {
    if (!run || authority()) return;
    if (ev[1] === 'fx') {
      run.fx = { id: ev[2], t: 0, dur: ev[2] === 'silence' ? 3.5 : 2.6, hit: false, rad: 0 };
    } else if (ev[1] === 'frag') grantFrag(ev[2], false);
    else if (ev[1] === 'bond') grantBond(false);
    else if (ev[1] === 'sil') {
      const p = G.Game.player;
      if (p) p.silence = Math.max(p.silence || 0, 10);
      run.fx = null;
    } else if (ev[1] === 'aura') run.aura = 30;
    else if (ev[1] === 'ray' && ev[2] === 'off') {
      if (run.ray && run.ray.phase === 'ring') run.ray = null;
    } else if (ev[1] === 'ray' && ev[2] === 'go') {
      run.ray = { phase: 'ring', n: 0, t: 0, dur: RAY_PULSE[0], tick: 0, owner: ev[3] || 0 };
      G.Audio.sfx('boss');
    } else if (ev[1] === 'ray' && ev[2] === 'beam') {
      run.ray = {
        phase: 'beam', t: 0, tick: 0.2,
        x: ev[3], y: ev[4], ang: ev[5] / 1000, len: ev[6], w: ev[7], dmg: ev[8], burn: ev[9], owner: ev[10] || 0
      };
      G.Camera.kick(0.85);
      G.Audio.sfx('shot', { kind: 'beam', type: 'dragon' });
    }
  }

  /** Ancho con el que se dibuja el sprite (el rayo sale de ese grosor). */
  function spriteW(dex) {
    const m = G.Sprites.animMeta(dex, 'Idle');
    return (m ? m.w : 40) * G.Sprites.PX;
  }

  function inRay(r, x, y, rad) {
    const ca = Math.cos(r.ang), sa = Math.sin(r.ang);
    const px = x - r.x, py = y - r.y;
    const along = px * ca + py * sa;
    if (along < -rad || along > r.len + rad) return false;
    return Math.abs(-px * sa + py * ca) <= r.w / 2 + rad * 0.45;
  }

  function rayBoss() {
    const id = run.ray && run.ray.owner;
    const e = id && G.EnemyMgr.get(id);
    if (e && !e.dead) return e;
    return bossOf();
  }

  function startRay(e) {
    run.ray = { phase: 'ring', n: 0, t: 0, dur: RAY_PULSE[0], tick: 0, owner: e.id };
    net(['tw', 'ray', 'go', e.id]);
    G.Spawner.say('¡Rayquaza concentra la luz!', 2.2);
    G.Audio.sfx('boss');
  }

  function fireRay(e) {
    const mates = G.Game.everyone().filter(p => p && !p.dead);
    let tx = e.x + 1, ty = e.y, best = Infinity;
    for (const p of mates) {
      const d = G.U.dist2(e.x, e.y, p.x, p.y);
      if (d < best) { best = d; tx = p.x; ty = p.y; }
    }
    const ang = Math.atan2(ty - e.y, tx - e.x);
    const w = Math.round(spriteW(e.dex));
    const len = Math.round((run.ar || 11) * ts() * 2.8);
    const dmg = Math.max(8, Math.round(e.shotDmg()));
    const burn = Math.max(5, Math.round(dmg * 0.45));
    run.ray = { phase: 'beam', t: 0, tick: 0.2, x: e.x, y: e.y, ang, len, w, dmg, burn, owner: e.id };
    e.look = ang;
    net(['tw', 'ray', 'beam', Math.round(e.x), Math.round(e.y), Math.round(ang * 1000), len, w, dmg, burn, e.id]);
    G.Camera.kick(0.85);
    G.Audio.sfx('shot', { kind: 'beam', type: 'dragon' });
    G.Spawner.say('¡Rayo!', 1.8);
  }

  function rayHurt(r, dt, amount, type) {
    const pl = G.Game.player;
    if (!pl || pl.dead) return;
    r.tick -= dt;
    if (r.tick > 0) return;
    r.tick = 0.5;
    if (inRay(r, pl.x, pl.y, pl.r)) pl.hurt(amount, type);
  }

  /** Luz, rayo y suelo ardiente de Rayquaza. Lo corren todos: cada uno se quema el suyo. */
  function tickRay(dt) {
    const r = run && run.ray;
    if (!r) return;
    if (r.phase === 'ring') {
      const e = rayBoss();
      if (authority() && (!e || (r.owner && e.id !== r.owner))) { run.ray = null; net(['tw', 'ray', 'off']); return; }
      r.t += dt;
      if (r.t < r.dur) return;
      if (r.n >= RAY_PULSE.length - 1) {
        if (authority() && e) fireRay(e);
        else r.t = r.dur;
        return;
      }
      if (e) G.FX.ring(e.x, e.y - e.bodyH * 0.42, spriteW(e.dex) / 2, spriteW(e.dex), '#e8ff9a', 0.4, 3);
      r.n++;
      r.t = 0;
      r.dur = RAY_PULSE[r.n];
      return;
    }
    if (r.phase === 'beam') {
      r.t += dt;
      G.Camera.kick(0.1);
      rayHurt(r, dt, r.dmg, 'dragon');
      if (r.t < RAY_BEAM) return;
      r.phase = 'scorch';
      r.t = 0;
      r.tick = 0.35;
      const e = rayBoss();
      if (e && e.tower && (!r.owner || e.id === r.owner)) { e.tower.rayCd = RAY_CD; e.look = null; }
      if (authority()) G.Spawner.say('El suelo arde', 2);
      return;
    }
    r.t += dt;
    rayHurt(r, dt, r.burn, 'fire');
    if (r.t >= RAY_SCORCH) run.ray = null;
  }

  function startCast(e, pl, id) {
    const t = e.tower;
    if (id === 'med') {
      if (t.meds >= 3) return false;
      t.meds++;
      t.med = 4;
      t.cast = null;
      G.Spawner.say('Meditación', 2);
      return true;
    }
    if (id === 'aura') {
      if (run.aura > 0) return false;
      run.aura = 30;
      net(['tw', 'aura']);
      G.Spawner.say('¡Aura de terror!', 2.4);
      G.Audio.sfx('boss');
      return true;
    }
    if (id === 'amnesia') {
      run.fx = t.cast = { id, t: 0, dur: 2.6, hit: false };
      net(['tw', 'fx', 'amnesia']);
      G.Spawner.say('¡Amnesia selectiva!', 2.2);
      return true;
    }
    if (id === 'silence') {
      run.fx = t.cast = { id, t: 0, dur: 3.5, rad: 0 };
      e.guard = 0.4;
      net(['tw', 'fx', 'silence']);
      G.Spawner.say('¡Silencio mortal!', 2.4);
      G.Audio.sfx('boss');
      return true;
    }
    return false;
  }

  /** Mientras carga o medita, el jefe no se mueve. Null: que pelee normal. */
  function hold(e, dt, pl) {
    const t = e.tower;
    if (!t || !run) return null;
    const rayOn = run.ray && (run.ray.phase === 'ring' || run.ray.phase === 'beam');
    const mine = rayOn && (!run.ray.owner || run.ray.owner === e.id);
    if (e.dex === RAYQUAZA && !rayOn && t.rayCd > 0) t.rayCd -= dt;
    if (t.med > 0) {
      t.med -= dt;
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.25 * dt / 4);
      e.guard = 0;
      if (e.ai) e.ai.cast = null;
      return [0, 0, 'Idle'];
    }
    if (t.cast) {
      t.cast.t += dt;
      run.fx = t.cast;
      if (e.ai) e.ai.cast = null;
      if (t.cast.id === 'silence') {
        t.cast.rad = coverRadius(e) * Math.min(1, t.cast.t / t.cast.dur);
        e.guard = 0.4;
        if (t.cast.t >= t.cast.dur) {
          const who = G.Game.player;
          if (who) who.silence = Math.max(who.silence || 0, 10);
          net(['tw', 'sil']);
          e.guard = 0;
          t.cast = null;
          run.fx = null;
          t.cd = 8;
          G.Spawner.say('No puedes usar movimientos', 2.2);
        }
      } else if (t.cast.t >= t.cast.dur) {
        t.cast = null;
        run.fx = null;
        t.cd = 8;
      }
      return [0, 0, 'Charge'];
    }
    if (mine) {
      if (e.ai) e.ai.cast = null;
      e.guard = 0;
      e.look = run.ray.phase === 'beam' ? run.ray.ang : null;
      return [0, 0, run.ray.phase === 'beam' ? 'Shoot' : 'Charge'];
    }
    e.look = null;
    if (e.dex === RAYQUAZA && t.rayCd <= 0 && !rayOn) {
      startRay(e);
      return [0, 0, 'Charge'];
    }
    e.guard = 0;
    t.cd -= dt;
    if (t.cd > 0) return null;
    const kit = (KIT[Math.min(4, e.towerPhase)] || []).filter(id => id !== 'med' || t.meds < 3).filter(id => id !== 'aura' || run.aura <= 0);
    if (!kit.length) { t.cd = 4; return null; }
    const low = e.hp < e.maxHp * 0.7 && t.meds < 3 && kit.includes('med');
    if (startCast(e, pl, low && Math.random() < 0.55 ? 'med' : G.U.pick(kit))) t.cd = e.towerPhase >= 4 ? 9 : 12;
    else t.cd = 3;
    return t.med > 0 || t.cast ? [0, 0, t.med > 0 ? 'Idle' : 'Charge'] : null;
  }

  function tickGuestFx(dt) {
    const c = run.fx;
    if (!c) return;
    c.t += dt;
    if (c.id === 'silence') {
      const e = bossOf();
      c.rad = (e ? coverRadius(e) : (run.ar || 11) * ts()) * Math.min(1, c.t / c.dur);
    }
    if (c.t >= c.dur && c.id !== 'silence') run.fx = null;
  }

  function keepInside(moveEnemies) {
    const max = (run.ar - 1.4) * ts();
    const pin = p => {
      if (!p || p.dead) return;
      const dx = p.x - run.ax, dy = p.y - run.ay, d = Math.hypot(dx, dy);
      if (d > max && d > 0) { p.x = run.ax + dx / d * max; p.y = run.ay + dy / d * max; }
    };
    for (const p of G.Game.everyone()) pin(p);
    if (!moveEnemies) return;
    for (const e of G.EnemyMgr.all()) if (!e.remote) pin(e);
  }

  function watchBosses() {
    for (const b of run.bosses) {
      if (b.down) continue;
      const e = G.EnemyMgr.get(b.id);
      if (e && !e.dead) continue;
      b.down = true;
      run.aura = 0;
      run.fx = null;
      if (run.ray && run.ray.phase === 'ring' && (!run.ray.owner || run.ray.owner === b.id)) {
        run.ray = null; net(['tw', 'ray', 'off']);
      }
      grantBond(true);
      if (b.phase < run.phases) {
        if (!run.stack) G.Spawner.say('Se retira… volverá más adelante', 2.4);
      } else run.finalDown = true;
    }
  }

  function anyAlive() {
    return G.EnemyMgr.all().some(e => !e.dead && !e.remote);
  }

  function rollReward() {
    const own = G.DB.owns(run.dex);
    const wantShiny = run.shiny && !G.DB.ownsShiny(run.dex);
    let caught = false, caughtShiny = false;
    if (!own && Math.random() < 0.25) { caught = true; caughtShiny = !!run.shiny; }
    else if (wantShiny && Math.random() < 0.25) caughtShiny = true;
    if (run.duel) return { frags: 0, caught, caughtShiny, gold: 0, ticket: 0 };
    const tier = run.tier || 1;
    const frags = Math.random() < 0.6 ? Math.round(G.U.randInt(45, 100) * 1.5 * tier) : 0;
    const ticket = Math.round(0.8 * tier);
    return { frags, caught, caughtShiny, gold: Math.round((run.fee || 0) * 4 * tier), ticket };
  }

  function finish() {
    noteClear();
    run.cleared = true;
    run.reward = rollReward();
    run.done = true;
    const r = run.reward;
    const bits = [];
    if (r.caught || r.caughtShiny) bits.push('¡Lo has atrapado!');
    if (r.ticket === 1) bits.push('1 ticket dorado');
    else if (r.ticket) bits.push(r.ticket + ' tickets dorados');
    if (r.frags) bits.push('+' + r.frags + ' fragmentos');
    if (r.gold) bits.push('+' + G.U.num(r.gold) + ' Pokémonedas');
    G.Spawner.say(bits.join(' · ') || '¡Torre superada!', 2.4, true);
    G.Audio.sfx('legend');
  }

  function update(dt, pl) {
    if (!run || run.done) return;
    tickRay(dt);
    const me = pl || G.Game.player;
    if (!me) return;
    if (me.dead && !G.Coop.active) return;
    if (run.aura > 0) run.aura -= dt;
    if (!authority()) {
      tickGuestFx(dt);
      keepInside(false);
      if (!run.duel && run.wave < run.waves) {
        run.wait -= dt;
        if (run.wait <= 0) { run.wave++; run.wait = run.every || EVERY; }
      }
      return;
    }
    keepInside(true);
    watchBosses();
    if (run.duel) {
      if (!run.bosses.length) {
        run.wait -= dt;
        if (run.wait <= 0) { run.wave = run.waves; spawnBoss(me, run.phases); }
      }
      return;
    }
    if (run.wave < run.waves) {
      run.wait -= dt;
      if (run.wait > 0) return;
      run.wave++;
      spawnPack(me);
      const at = run.plan.indexOf(run.wave);
      if (at >= 0) spawnBoss(me, at + 1);
      run.wait = run.every || EVERY;
    }
  }

  /** La torre está limpia: el jefe final cayó y no queda nadie. */
  function clearReady() {
    return authority() && !!run && !run.done && run.wave >= run.waves && run.finalDown && !anyAlive();
  }

  function grantBond(send) {
    const pl = G.Game.player;
    if (pl) {
      pl.bonds++;
      G.FX.dmgText(pl.x, pl.y - pl.bodyH - 10, '¡Vínculo!', '#ff8ad8', true);
      G.FX.ring(pl.x, pl.y, 8, 90, '#ff8ad8', 0.7, 5);
    }
    G.Spawner.say('Puedes fusionar un movimiento', 2.6, true);
    if (send) net(['tw', 'bond']);
  }

  function draw(ctx) {
    if (!run) return;
    const e = bossOf();
    if (run.aura > 0 && e) {
      ctx.save();
      ctx.globalAlpha = 0.16 + Math.sin(performance.now() / 200) * 0.04;
      ctx.fillStyle = '#7a4ad0';
      ctx.beginPath(); ctx.arc(e.x, e.y, 340, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = '#c9b6ff'; ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
    const c = run.fx;
    if (c && c.id === 'silence' && e) {
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#b9a6ff';
      ctx.beginPath(); ctx.arc(e.x, e.y, c.rad || 8, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#efe8ff'; ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
    drawRay(ctx);
  }

  function drawRay(ctx) {
    const r = run.ray;
    if (!r) return;
    if (r.phase === 'ring') {
      const e = rayBoss();
      if (!e) return;
      const endR = spriteW(e.dex) / 2;
      const startR = Math.max(260, endR * 3.4);
      const u = Math.min(1, r.t / Math.max(0.05, r.dur));
      const rad = startR + (endR - startR) * u;
      const cy = e.y - e.bodyH * 0.42;
      ctx.save();
      ctx.globalAlpha = 0.14 + 0.2 * u;
      ctx.fillStyle = '#d8ff6a';
      ctx.beginPath(); ctx.arc(e.x, cy, rad, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 0.5 + 0.45 * u;
      ctx.strokeStyle = '#f6ffd0';
      ctx.lineWidth = 3 + 8 * (1 - u);
      ctx.beginPath(); ctx.arc(e.x, cy, rad, 0, 6.2832); ctx.stroke();
      ctx.restore();
      return;
    }
    const hot = r.phase === 'scorch';
    const fade = hot ? Math.min(1, Math.max(0, (RAY_SCORCH - r.t) / 2)) : 1;
    const flick = hot ? 0.22 + Math.sin(performance.now() / 90) * 0.07 : 0.75 + Math.sin(performance.now() / 45) * 0.2;
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.ang);
    ctx.globalAlpha = (hot ? flick : 0.4 * flick) * fade;
    ctx.fillStyle = hot ? '#ff6a2a' : '#c6ff55';
    ctx.fillRect(0, -r.w / 2, r.len, r.w);
    ctx.globalAlpha = (hot ? Math.min(0.5, flick + 0.12) : 0.92) * fade;
    ctx.fillStyle = hot ? '#ffd08a' : '#f7ffe6';
    ctx.fillRect(0, -r.w * (hot ? 0.14 : 0.18), r.len, r.w * (hot ? 0.28 : 0.36));
    ctx.restore();
  }

  function drawScreen(ctx, w, h, pl) {
    const c = run && run.fx;
    if (!c || c.id !== 'amnesia' || !pl) return;
    const u = Math.min(1, c.t / c.dur);
    const left = w * (0.16 + 0.34 * u);
    const right = w * (0.84 - 0.34 * u);
    ctx.save();
    ctx.fillStyle = 'rgba(150, 90, 255, .28)';
    ctx.fillRect(0, 0, left, h);
    ctx.fillRect(right, 0, w - right, h);
    ctx.fillStyle = 'rgba(90, 40, 160, .22)';
    if (right > left) ctx.fillRect(left, 0, right - left, h);
    ctx.restore();
    if (c.t > 0.75 && !c.hit) {
      const sx = (pl.x - G.Camera.left()) * G.Camera.scale;
      if (sx > left && sx < right) { c.hit = true; applyAmnesia(pl); }
    }
  }

  return {
    LIST, REGIONS, MODES, unlocked, modeOpen, tierOf, due, afford, charge, prepare, peek, arm, claim, reset,
    begin, active, done, take, markClear, clearReady, finish, hud, update, hold, inAura,
    draw, drawScreen, onNet, onMinionDown, wantShop, clearShop
  };
})();
