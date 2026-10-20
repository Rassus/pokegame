/* ============ garden.js — huerto, semillas y la baya de cada Pokémon ============
 * Cada Pokémon tiene un hueco. La baya equipada no está en la mochila:
 * al cambiarla, la anterior vuelve, salvo que se haya gastado en la partida.
 * Plantar, cosechar y la tienda salen de la hora, así que recargar no cambia
 * la tirada. La expedición guarda el ritmo al enviar.
 */
G.Garden = (() => {
  const SHOP_MS = () => G.Berries.SHOP_MS;

  function mix(n) {
    let x = n >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
    x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
    return (x ^ (x >>> 16)) >>> 0;
  }
  function roll(at, salt, i) {
    const s = mix((Math.floor(at / 1000) ^ Math.imul(salt || 1, 0x85ebca6b) ^ Math.imul((i || 0) + 1, 0x9e3779b1)) >>> 0);
    return s / 4294967296;
  }

  function blank() {
    return { open: 1, plants: {}, shopAt: 0, shop: [], sold: [0, 0, 0, 0] };
  }

  function countBag(bag) {
    const out = {};
    const src = bag && typeof bag === 'object' ? bag : {};
    for (const id of G.Berries.IDS) {
      const n = Math.floor(+src[id] || 0);
      if (n > 0) out[id] = Math.min(9999, n);
    }
    return out;
  }

  function rollShop(at) {
    const left = G.Berries.IDS.slice();
    const ids = [];
    for (let i = 0; i < 4 && left.length; i++) {
      const k = Math.floor(roll(at, 11, i) * left.length);
      ids.push(left.splice(k, 1)[0]);
    }
    return ids;
  }

  function ensureShop(g, now) {
    now = now || Date.now();
    if (!(g.shopAt > 0)) {
      g.shopAt = now;
      g.shop = rollShop(now);
      g.sold = [0, 0, 0, 0];
      return;
    }
    if (now - g.shopAt >= SHOP_MS()) {
      const steps = Math.floor((now - g.shopAt) / SHOP_MS());
      g.shopAt = g.shopAt + steps * SHOP_MS();
      g.shop = rollShop(g.shopAt);
      g.sold = [0, 0, 0, 0];
      return;
    }
    if (!Array.isArray(g.shop) || g.shop.length !== 4 || g.shop.some(id => !G.Berries.BY[id])) {
      g.shop = rollShop(g.shopAt);
      g.sold = [0, 0, 0, 0];
    }
    if (!Array.isArray(g.sold) || g.sold.length !== 4) g.sold = [0, 0, 0, 0];
    g.sold = g.sold.map(v => v ? 1 : 0);
  }

  function clean(save) {
    if (!save || !G.Berries) return;
    save.berries = countBag(save.berries);
    save.seeds = countBag(save.seeds);
    const worn = {};
    const src = save.monBerry && typeof save.monBerry === 'object' ? save.monBerry : {};
    for (const k of Object.keys(src)) {
      const dex = Math.floor(+k);
      if (!dex || !G.Berries.BY[src[k]]) continue;
      if (save.owned && !save.owned[dex]) continue;
      worn[String(dex)] = src[k];
    }
    save.monBerry = worn;

    const g = save.garden && typeof save.garden === 'object' ? save.garden : blank();
    g.open = Math.max(1, Math.min(12, Math.floor(+g.open) || 1));
    const plants = {};
    const raw = g.plants && typeof g.plants === 'object' ? g.plants : {};
    for (const key of Object.keys(raw)) {
      const m = /^(\d+)-([01])$/.exec(key);
      if (!m) continue;
      const plot = +m[1], slot = +m[2];
      if (plot < 0 || plot >= g.open) continue;
      const p = raw[key];
      if (!p || !G.Berries.BY[p.id]) continue;
      const at = Math.floor(+p.at);
      if (!(at > 0)) continue;
      plants[key] = { id: p.id, at: Math.min(Date.now() + 60000, at) };
    }
    g.plants = plants;
    g.shopAt = Math.floor(+g.shopAt) || 0;
    ensureShop(g);
    save.garden = g;
  }

  /** La mochila no se duplica: manda la cantidad mayor. Las plantas se unen. */
  function merge(newer, older) {
    if (!newer || !older) return;
    clean(newer);
    clean(older);
    for (const bag of ['berries', 'seeds']) {
      newer[bag] = newer[bag] || {};
      for (const id of G.Berries.IDS) {
        const n = Math.max(newer[bag][id] || 0, (older[bag] && older[bag][id]) || 0);
        if (n > 0) newer[bag][id] = n;
        else delete newer[bag][id];
      }
    }
    newer.monBerry = newer.monBerry || {};
    for (const dex in older.monBerry || {}) {
      if (!newer.monBerry[dex]) newer.monBerry[dex] = older.monBerry[dex];
    }
    const a = newer.garden, b = older.garden;
    a.open = Math.max(a.open, b.open);
    for (const key in b.plants) {
      const mine = a.plants[key];
      if (!mine || b.plants[key].at < mine.at) a.plants[key] = b.plants[key];
    }
    if ((b.shopAt || 0) > (a.shopAt || 0)) {
      a.shopAt = b.shopAt;
      a.shop = b.shop.slice();
      a.sold = b.sold.slice();
    }
  }

  function worn(save, dex) {
    if (!save || !save.monBerry) return null;
    const id = save.monBerry[String(dex)];
    return id && G.Berries.BY[id] ? id : null;
  }

  /**
   * Lo que esa baya cambia en la expedición.
   * everyMin se suma a los minutos de la ronda fija (luego se queda en 5 como poco).
   * goodChance / badChance solo valen en ese bioma. chanceZero apaga la pérdida.
   */
  function mods(save, dex) {
    const id = worn(save, dex);
    const H = 60 * 60 * 1000;
    if (id === 'caramel') return { everyMin: -1 };
    if (id === 'bruva') return { badChance: -0.05 };
    if (id === 'toto') return { everyMin: 1, extraP: 0.10 };
    if (id === 'drildo') return { badChance: 0.15, tripleP: 0.10 };
    if (id === 'perah') return { maxMs: 10 * H };
    if (id === 'picor') return { chanceZero: true };
    if (id === 'polca') return { everyMin: -5, maxMs: 4 * H };
    if (id === 'aranja') return { goodChance: 0.15 };
    return null;
  }

  function growth(plant, now) {
    const def = plant && G.Berries.BY[plant.id];
    const total = def ? def.grow : 1;
    const t = Math.max(0, (now || Date.now()) - (plant ? plant.at : 0));
    const p = Math.min(1, t / total);
    let phase = 0;
    if (p >= 1) phase = 4;
    else if (p >= 0.75) phase = 3;
    else if (p >= 0.50) phase = 2;
    else if (p >= 0.30) phase = 1;
    return { p, phase, left: Math.max(0, total - t), total, ready: p >= 1 };
  }

  function yieldOf(plant) {
    const n = 1 + Math.floor(roll(plant.at, 21, 0) * 3);
    const seed = roll(plant.at, 21, 1) < 0.30 ? 1 : 0;
    return { n, seed };
  }

  function plant(save, plot, slot, id) {
    clean(save);
    plot = Math.floor(+plot);
    slot = Math.floor(+slot);
    if (plot < 0 || plot >= save.garden.open || (slot !== 0 && slot !== 1)) return false;
    if (!G.Berries.BY[id] || !(save.seeds[id] > 0)) return false;
    const key = plot + '-' + slot;
    if (save.garden.plants[key]) return false;
    save.seeds[id]--;
    if (save.seeds[id] <= 0) delete save.seeds[id];
    save.garden.plants[key] = { id, at: Date.now() };
    return true;
  }

  function harvest(save, plot, slot) {
    clean(save);
    const key = Math.floor(+plot) + '-' + Math.floor(+slot);
    const spot = save.garden.plants[key];
    if (!spot || !growth(spot).ready) return null;
    const got = yieldOf(spot);
    save.berries[spot.id] = (save.berries[spot.id] || 0) + got.n;
    if (got.seed) save.seeds[spot.id] = (save.seeds[spot.id] || 0) + 1;
    delete save.garden.plants[key];
    return { id: spot.id, n: got.n, seed: got.seed };
  }

  function unlock(save) {
    clean(save);
    const n = save.garden.open;
    if (n >= 12) return false;
    const price = G.Berries.PRICES[n - 1];
    if (!(save.coins >= price)) return false;
    save.coins -= price;
    save.garden.open = n + 1;
    return true;
  }

  function buySeed(save, index) {
    clean(save);
    ensureShop(save.garden);
    index = Math.floor(+index);
    if (index < 0 || index > 3 || save.garden.sold[index]) return null;
    const id = save.garden.shop[index];
    if (!id || !(save.coins >= G.Berries.SEED_PRICE)) return null;
    save.coins -= G.Berries.SEED_PRICE;
    save.seeds[id] = (save.seeds[id] || 0) + 1;
    save.garden.sold[index] = 1;
    return id;
  }

  function equip(save, dex, id) {
    clean(save);
    dex = Math.floor(+dex);
    if (!dex || !save.owned || !save.owned[dex]) return false;
    const key = String(dex);
    const prev = save.monBerry[key] || null;
    if (id && !G.Berries.BY[id]) return false;
    if (prev === id) return true;
    if (id) {
      if (!(save.berries[id] > 0)) return false;
      save.berries[id]--;
      if (save.berries[id] <= 0) delete save.berries[id];
    }
    if (prev) save.berries[prev] = (save.berries[prev] || 0) + 1;
    if (id) save.monBerry[key] = id;
    else delete save.monBerry[key];
    return true;
  }

  /** La baya se gastó en la partida: sale del Pokémon y no vuelve a la mochila. */
  function consume(dex) {
    const save = G.DB && G.DB.save;
    if (!save || !save.monBerry) return;
    const key = String(dex);
    if (!save.monBerry[key]) return;
    delete save.monBerry[key];
    if (G.DB.commit) G.DB.commit(true);
  }

  function grantStat(pl, id, times) {
    const s = G.LevelUp && G.LevelUp.STATS.find(x => x.id === id);
    if (!s) return;
    for (let i = 0; i < times; i++) {
      s.apply(pl);
      pl.statsTaken[id] = (pl.statsTaken[id] || 0) + 1;
    }
  }

  /** Efectos de la baya al empezar una partida o una torre. */
  function applyRun(pl, tower) {
    if (!pl || !G.DB || !G.DB.save) return;
    const id = worn(G.DB.save, pl.dex);
    if (!id) return;
    pl.berryId = id;
    if (id === 'caramel') {
      if (tower) {
        pl.heal(100);
        consume(pl.dex);
        if (G.Spawner) G.Spawner.say('Caramelo se ha gastado', 2.4, true);
      } else pl.candyLeft = 350;
    } else if (id === 'bruva') {
      pl.poisonMul = tower ? 1.06 : 1.10;
      if (!tower) pl.poisonTime = 0.95;
    } else if (id === 'toto') {
      grantStat(pl, 'rgn', 3);
    } else if (id === 'drildo') {
      pl.defExtra = 2;
      grantStat(pl, 'def', 2);
    } else if (id === 'perah') {
      if (tower) pl.weatherImmune = true;
      else pl.hasteExtra = 60;
    } else if (id === 'picor') {
      pl.atkMul *= tower ? 1.40 : 1.25;
      pl.noDef = true;
      pl.noHarden = true;
    } else if (id === 'polca') {
      if (tower) pl.polcaTower = true;
      else pl.polcaHit = true;
    } else if (id === 'aranja') {
      pl.floorImmune = true;
    }
  }

  function menuLine(save) {
    if (!save) return 'Siembra bayas y dáselas a tus Pokémon';
    clean(save);
    let ready = 0, growing = 0;
    for (const key in save.garden.plants) {
      if (growth(save.garden.plants[key]).ready) ready++;
      else growing++;
    }
    if (ready === 1) return '1 lista para recoger';
    if (ready > 1) return ready + ' listas para recoger';
    if (growing === 1) return '1 creciendo';
    if (growing > 1) return growing + ' creciendo';
    return 'Siembra bayas y dáselas a tus Pokémon';
  }

  function shopLeft(save, now) {
    clean(save);
    const at = save.garden.shopAt || now || Date.now();
    return Math.max(0, at + SHOP_MS() - (now || Date.now()));
  }

  return {
    roll, clean, merge, worn, mods, growth, yieldOf,
    plant, harvest, unlock, buySeed, equip, consume, applyRun, menuLine, shopLeft, ensureShop
  };
})();
