/* ============ tower.js — torres en una grieta ============
 * Una sola entrada (no hay modo atrapar / enfrentar). Siempre 100 oleadas.
 * La primera sale al entrar; las siguientes, cada 10 s, aunque queden vivos.
 * Se juega en una arena de grieta. La dificultad sube con las mejoras del
 * compañero (en grupo, las del anfitrión, que es quien genera las oleadas).
 *
 * Sala de Kanto: montaña. Al entrar sale uno de los pájaros que ya venciste.
 * Oleadas con más Pokémon de su tipo; el resto, otros de Kanto.
 *
 * Al superar la torre, cada jugador: si no lo tiene, 25% de atraparlo;
 * si ya lo tiene, 25-50 fragmentos de su línea. El jefe es shiny a 1/1024.
 * La entrada (FEE) se reparte entre los de la sala.
 * No cuenta para el récord de tiempo ni para el ranking.
 */
G.Towers = (() => {
  const FEE = 3000;
  const WAVES = 100;
  const EVERY = 10;
  const LIST = [
    { id: 'kanto', name: 'Sala de Kanto', dexes: [144, 145, 146] },
    { id: 'mew', name: 'Mew', dexes: [151] },
    { id: 'mewtwo', name: 'Mewtwo', dexes: [150] }
  ];
  const ONE = { hp: 1, spd: 1, dmg: 1 };
  const KIT = {
    1: ['med'],
    2: ['med', 'aura'],
    3: ['med', 'aura', 'amnesia'],
    4: ['med', 'aura', 'amnesia', 'silence']
  };
  const PHASE_HP = [0, 0.8, 1.05, 1.35, 1.7];

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

  function share() { return Math.ceil(FEE / party()); }

  function charge(cfg) {
    const save = G.DB.save;
    const cost = cfg && cfg.share;
    if (!(cost > 0)) return true;
    if (!save || (save.coins || 0) < cost) return false;
    save.coins -= cost;
    G.DB.commit();
    return true;
  }

  function peek() { return armed; }
  function arm(cfg) { armed = cfg; }
  function claim() { const a = armed; armed = null; return a; }
  function reset() { run = null; }

  /** Qué pájaro (o qué jefe) y en qué arena. La llama quien entra. */
  function prepare(id) {
    const t = LIST.find(x => x.id === id);
    if (!t) return null;
    const open = t.dexes.filter(unlocked);
    if (!open.length) return null;
    const dex = G.U.pick(open);
    const type = id === 'kanto' ? 'flying' : arenaType(dex);
    return {
      id, dex, share: share(),
      arena: {
        tx: 5000 + G.U.randInt(0, 2999), ty: 5000 + G.U.randInt(0, 2999),
        r: 11, type
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
    for (const u of G.Upgrades.LIST) max += u.max;
    if (!max) return 1;
    return 1 + Math.min(1, sum / max);
  }

  function begin(cfg) {
    const tile = ts();
    run = {
      id: cfg.id, dex: cfg.dex, shiny: !!cfg.shiny, waves: WAVES,
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
    G.Spawner.say('Has entrado en la grieta…', 2.4, true);
    const pool = minionPool(cfg.dex);
    const dexes = pool.typed.concat(pool.rest).map(p => p.dex);
    G.Sprites.preload(dexes.concat(cfg.dex), 8000, cfg.shiny);
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
    if (!run.wave) return 'Torre · ' + WAVES + ' oleadas';
    const left = run.wave < WAVES && run.wait > 0 ? ' · ' + Math.ceil(run.wait) + ' s' : '';
    return 'Oleada ' + run.wave + '/' + WAVES + left;
  }

  function minionPool(dex) {
    const types = (G.DEX_BY[dex] && G.DEX_BY[dex].types) || [];
    const base = G.DEX.filter(p => !p.leg && G.SPRITE_META[p.dex] && (p.gen || 1) === 1 && p.dex !== dex);
    const typed = base.filter(p => p.types.some(t => types.includes(t)));
    const rest = base.filter(p => !typed.includes(p));
    return { typed, rest: rest.length ? rest : base };
  }

  function pickMinion(pool, prefer) {
    if (prefer && pool.typed.length) return G.U.pick(pool.typed);
    return G.U.pick(pool.rest.length ? pool.rest : pool.typed);
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

  function spot() {
    const max = (run.ar - 2) * ts();
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * 6.2832, d = G.U.rand(70, max * 0.82);
      const x = run.ax + Math.cos(a) * d, y = run.ay + Math.sin(a) * d;
      if (G.World.isFree(x, y, 16)) return [x, y];
    }
    return [run.ax, run.ay - 60];
  }

  function scale() {
    const n = G.Game.everyone().length;
    return threat() * G.Coop.scaleHp(n);
  }

  function spawnPack(pl) {
    const k = run.wave;
    const mul = scale();
    const n = packSize(k);
    const pool = minionPool(run.dex);
    const preferN = pool.typed.length ? Math.ceil(n * 0.6) : 0;
    for (let i = 0; i < n; i++) {
      const p = pickMinion(pool, i < preferN);
      const far = p.types.some(t => ['psychic', 'electric', 'fire', 'water', 'ice', 'ghost', 'dragon'].includes(t));
      const def = {
        dex: p.dex, name: p.name, behavior: far ? 'ranged' : 'chase',
        hp: Math.round((26 + k * 12) * mul),
        spd: Math.round(G.U.clamp(52 + (p.spd - 78) * 0.25, 46, 96)),
        dmg: Math.round((6 + k * 0.85) * mul),
        xp: Math.round(4 + k * 1.4),
        shotDmg: Math.round((4 + k * 0.55) * mul), shotCd: 2.1, range: 200
      };
      const [x, y] = spot(pl);
      G.EnemyMgr.add(new G.Enemy(def, x, y, ONE));
    }
    G.Spawner.say('Oleada ' + k + ' de ' + WAVES, 2.2);
  }

  function spawnBoss(pl, phase) {
    const mon = G.DEX_BY[run.dex];
    const n = G.Game.everyone().length;
    const mul = scale() * (n > 1 ? 1.4 : 1) * PHASE_HP[phase];
    const far = mon.types.some(t => ['psychic', 'electric', 'ghost', 'fairy', 'fire', 'water', 'ice', 'dragon'].includes(t));
    const def = {
      dex: mon.dex, name: mon.name, behavior: far ? 'ranged' : 'charger',
      hp: Math.round(4200 * mul), spd: Math.round(G.U.clamp(50 + (mon.spd - 78) * 0.45, 48, 100)),
      dmg: Math.round(34 * mul), xp: 360 + phase * 80,
      shotDmg: Math.round(18 * mul), shotCd: 1, range: 280
    };
    const e = new G.Enemy(def, run.ax, run.ay - ts() * 3.2, ONE, true);
    e.flying = false;
    e.legend = true;
    e.towerPhase = phase;
    e.maxShield = Math.round(e.maxHp * 0.25);
    e.shield = e.maxShield;
    e.tower = { meds: 0, med: 0, auraR: 340, cd: 5, cast: null, rad: 0 };
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
    const e = bossOf();
    return !!(e && G.U.dist(pl.x, pl.y, e.x, e.y) < 340);
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
    } else if (ev[1] === 'bond') grantBond(false);
    else if (ev[1] === 'sil') {
      const p = G.Game.player;
      if (p) p.silence = Math.max(p.silence || 0, 10);
      run.fx = null;
    } else if (ev[1] === 'aura') run.aura = 30;
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
    e.guard = 0;
    t.cd -= dt;
    if (t.cd > 0) return null;
    const kit = (KIT[e.towerPhase] || []).filter(id => id !== 'med' || t.meds < 3).filter(id => id !== 'aura' || run.aura <= 0);
    if (!kit.length) { t.cd = 4; return null; }
    const low = e.hp < e.maxHp * 0.7 && t.meds < 3 && kit.includes('med');
    if (startCast(e, pl, low && Math.random() < 0.55 ? 'med' : G.U.pick(kit))) t.cd = e.towerPhase === 4 ? 9 : 12;
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
      grantBond(true);
      if (b.phase < 4) G.Spawner.say('Se retira… volverá más adelante', 2.4);
      else run.finalDown = true;
    }
  }

  function anyAlive() {
    return G.EnemyMgr.all().some(e => !e.dead && !e.remote);
  }

  function rollReward() {
    const own = G.DB.owns(run.dex);
    const wantShiny = run.shiny && !G.DB.ownsShiny(run.dex);
    const frags = own ? G.U.randInt(25, 50) : 0;
    let caught = false, caughtShiny = false;
    if (!own && Math.random() < 0.25) { caught = true; caughtShiny = !!run.shiny; }
    else if (wantShiny && Math.random() < 0.25) caughtShiny = true;
    return { frags, caught, caughtShiny };
  }

  function finish() {
    noteClear();
    run.cleared = true;
    run.reward = rollReward();
    run.done = true;
    const r = run.reward;
    const msg = r.caught || r.caughtShiny ? '¡Lo has atrapado!'
      : r.frags ? '+' + r.frags + ' fragmentos' : '¡Torre superada!';
    G.Spawner.say(msg, 2.4, true);
    G.Audio.sfx('legend');
  }

  function update(dt, pl) {
    if (!run || run.done) return;
    const me = pl || G.Game.player;
    if (!me) return;
    if (me.dead && !G.Coop.active) return;
    if (run.aura > 0) run.aura -= dt;
    if (!authority()) {
      tickGuestFx(dt);
      keepInside(false);
      if (!run.duel && run.wave < WAVES) {
        run.wait -= dt;
        if (run.wait <= 0) { run.wave++; run.wait = EVERY; }
      }
      return;
    }
    keepInside(true);
    watchBosses();
    if (run.duel) {
      if (!run.bosses.length) {
        run.wait -= dt;
        if (run.wait <= 0) { run.wave = WAVES; spawnBoss(me, 4); }
      }
      return;
    }
    if (run.wave < WAVES) {
      run.wait -= dt;
      if (run.wait > 0) return;
      run.wave++;
      spawnPack(me);
      const phase = run.wave % 25 === 0 ? (run.wave / 25) | 0 : 0;
      if (phase) spawnBoss(me, phase);
      run.wait = EVERY;
    }
  }

  /** La torre está limpia: el jefe final cayó y no queda nadie. */
  function clearReady() {
    return authority() && !!run && !run.done && run.wave >= WAVES && run.finalDown && !anyAlive();
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
    LIST, FEE, unlocked, share, charge, prepare, peek, arm, claim, reset,
    begin, active, done, take, markClear, clearReady, finish, hud, update, hold, inAura, draw, drawScreen, onNet
  };
})();
