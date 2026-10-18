/* ============ gacha.js — un banner por generación ============
 * Lógica pura: no toca la interfaz. La pantalla está en ui/gacha-ui.js.
 *
 * 9 banners (Kanto ... Paldea).
 * Cada ticket tiene su tabla (gris, morado, azul, dorado). El dorado
 * siempre sale shiny. Los otros no: dan fragmentos de la línea
 * (×1, ×2 o ×3) y el Pokémon entra en la pokédex sólo cuando esa línea
 * junta los de su rareza (común 3, poco común 5, rara 10, épica 15,
 * legendaria 20). Si ya lo tienes y aún puede subir, siguen saliendo
 * fragmentos. Al tope, Pokémonedas.
 *
 * Se tira con tickets que se consiguen jugando:
 *   ×1   1 gris
 *   ×10  10 grises, 1 morado o 1 azul
 *   ×1   1 dorado (shiny). Si ese shiny ya lo tienes, da fragmentos de su
 *        línea y sale otro shiny.
 */
G.Gacha = (() => {
  const EMPTY = { t1: 0, t10: 0, tb: 0, tg: 0 };
  /** ¿Qué gasta una tirada de n? → costes o null si no llega. */
  function costOf(save, n, use = 't1') {
    const t = Object.assign({}, EMPTY, save.tickets);
    if (n === 1 && use === 'tg') return t.tg >= 1 ? Object.assign({}, EMPTY, { tg: 1 }) : null;
    if (n === 10 && use === 't10') return t.t10 >= 1 ? Object.assign({}, EMPTY, { t10: 1 }) : null;
    if (n === 10 && use === 'tb') return t.tb >= 1 ? Object.assign({}, EMPTY, { tb: 1 }) : null;
    return t.t1 >= n ? Object.assign({}, EMPTY, { t1: n }) : null;
  }
  // Porcentajes por ticket: común, poco común, rara, épica, legendaria.
  const TABLES = {
    t1:  { name: 'Ticket gris',   icon: 'ticket',   rows: [[1, 56], [2, 28], [3, 12], [4, 3.5], [5, 0.5]] },
    t10: { name: 'Ticket morado', icon: 'ticket10', rows: [[1, 45], [2, 31], [3, 15], [4, 7], [5, 2]] },
    tb:  { name: 'Ticket azul',   icon: 'ticketb',  rows: [[1, 30], [2, 20], [3, 29], [4, 17], [5, 4]] },
    tg:  { name: 'Ticket dorado', icon: 'ticketg',  rows: [[1, 65], [2, 25], [3, 6], [4, 3], [5, 1]] }
  };
  const RATES = TABLES.t1.rows;
  const REFUND = { 1: 15, 2: 30, 3: 60, 4: 120, 5: 300 };
  const FRAGS = { 1: 3, 2: 5, 3: 10, 4: 15, 5: 20 };
  function fragNeed(rarity) { return FRAGS[rarity] || 3; }
  // Vida, ataque y velocidad se pagan con fragmentos de la línea: 10 al empezar
  // y 10 más por cada tramo de un 10 % del camino hasta el tope (10…100).
  const CAP = { hp: 150, atk: 2, spd: 150 };
  const STEP = { hp: 1, atk: 0.01, spd: 1 };
  /** Fragmentos que cuesta el siguiente nivel de esa estadística. */
  function growCost(mon, save, stat) {
    const base = mon[stat], cap = CAP[stat];
    const span = cap - base;
    if (!(span > 0)) return 10;
    const cur = valueOf(mon, stat, levelsOf(save, mon.dex)[stat]);
    const frac = Math.max(0, Math.min(0.999, (cur - base) / span));
    return 10 * (Math.floor(frac * 10) + 1);
  }
  function levelsOf(save, dex) {
    const b = save && save.boost && save.boost[dex];
    return { hp: (b && b.hp) || 0, atk: (b && b.atk) || 0, spd: (b && b.spd) || 0 };
  }
  function valueOf(mon, stat, levels) {
    const base = mon[stat], cap = CAP[stat];
    if (base >= cap) return base;
    const bonus = levels * STEP[stat];
    const v = Math.min(cap, base + bonus);
    return stat === 'atk' ? Math.round(v * 100) / 100 : v;
  }
  function grown(mon, save) {
    const lv = levelsOf(save, mon.dex);
    return { hp: valueOf(mon, 'hp', lv.hp), atk: valueOf(mon, 'atk', lv.atk), spd: valueOf(mon, 'spd', lv.spd) };
  }
  function atCap(mon, save, stat) {
    return mon[stat] >= CAP[stat] || valueOf(mon, stat, levelsOf(save, mon.dex)[stat]) >= CAP[stat];
  }
  function canGrow(mon, save) { return ['hp', 'atk', 'spd'].some(s => !atCap(mon, save, s)); }
  /** Niveles de mejora que caben antes del tope (150 de vida, 2 de ataque, 150 de velocidad). */
  function maxLevels(mon, stat) {
    const base = mon[stat], cap = CAP[stat], step = STEP[stat];
    if (!(step > 0) || base >= cap) return 0;
    return Math.floor((cap - base) / step + 1e-6);
  }
  /**
   * Al evolucionar en una run, cada estadística de la evolución se queda
   * con el mayor número de mejoras (la suya o la de la forma anterior).
   * No se suman, y no se guarda más de lo que cabe bajo el tope.
   */
  function carryBoosts(save, fromDex, toDex) {
    const mon = G.DEX_BY[toDex];
    if (!save || !mon || fromDex === toDex) return;
    const src = levelsOf(save, fromDex);
    save.boost = save.boost || {};
    const dst = save.boost[toDex] = Object.assign({ hp: 0, atk: 0, spd: 0 }, save.boost[toDex]);
    for (const stat of ['hp', 'atk', 'spd']) {
      dst[stat] = Math.min(maxLevels(mon, stat), Math.max(dst[stat] || 0, src[stat] || 0));
    }
  }
  /** Gasta fragmentos de la línea en un nivel de esa estadística. */
  function grow(save, dex, stat) {
    const mon = G.DEX_BY[dex];
    if (!mon || !save || !save.owned[dex] || !CAP[stat] || atCap(mon, save, stat)) return false;
    const cost = growCost(mon, save, stat);
    const key = lineKey(dex);
    const have = (save.frags && save.frags[key]) || 0;
    if (have < cost) return false;
    save.frags[key] = have - cost;
    if (save.frags[key] <= 0) delete save.frags[key];
    save.boost = save.boost || {};
    const b = save.boost[dex] = save.boost[dex] || { hp: 0, atk: 0, spd: 0 };
    b[stat] = (b[stat] || 0) + 1;
    return true;
  }
  /** Fragmentos de la línea (la clave es el básico), no de cada forma. */
  function lineKey(dex) { return String(G.Evo.root(dex)); }
  function lineFrags(save, dex) { return (save && save.frags && save.frags[lineKey(dex)]) || 0; }
  let forceShiny = 0;           // para pruebas y vídeos: las N próximas salen shiny

  const RARITY_NAME = { 1: 'Común', 2: 'Poco común', 3: 'Rara', 4: 'Épica', 5: 'Legendaria' };
  const RARITY_COLOR = { 1: '#9fb1c9', 2: '#5fe08a', 3: '#4fb4ff', 4: '#c47bff', 5: '#ffcb3d' };

  const BANNERS = [
    { gen: 1, name: 'Kanto',   color: ['#3a1d6e', '#1b2f78', '#0f4d6e'] },
    { gen: 2, name: 'Johto',   color: ['#5a2a1a', '#7a3d1f', '#2d4a6e'] },
    { gen: 3, name: 'Hoenn',   color: ['#0f4d6e', '#1b6a5a', '#2a3d78'] },
    { gen: 4, name: 'Sinnoh',  color: ['#2a2a5e', '#3d3d8a', '#5a2a6e'] },
    { gen: 5, name: 'Teselia', color: ['#1a1a2a', '#3a3a4e', '#2a4a6e'] },
    { gen: 6, name: 'Kalos',   color: ['#4a1a3a', '#2a3a7a', '#1a5a7a'] },
    { gen: 7, name: 'Alola',   color: ['#7a3a1a', '#1a6a6a', '#2a4a8a'] },
    { gen: 8, name: 'Galar',   color: ['#4a1a5a', '#1a3a6a', '#6a1a3a'] },
    { gen: 9, name: 'Paldea',  color: ['#6a2a1a', '#4a1a5a', '#1a4a6a'] }
  ];

  function inBanner(p, gen) { return p.gen === gen && !!G.SPRITE_META[p.dex]; }

  /** Pokémon de una rareza en un banner. */
  function pool(rarity, gen) { return G.DEX.filter(p => inBanner(p, gen) && p.rarity === rarity); }

  /** Pool no vacío más cercano (algunas generaciones tienen rarezas casi vacías). */
  function poolNear(rarity, gen) {
    for (const d of [0, -1, 1, -2, 2, -3, 3, -4, 4]) {
      const r = rarity + d;
      if (r < 1 || r > 5) continue;
      const p = pool(r, gen);
      if (p.length) return { rarity: r, list: p };
    }
    return { rarity, list: G.DEX.filter(p => inBanner(p, gen)) };
  }

  function rollRarity(use) {
    const rates = (TABLES[use] || TABLES.t1).rows;
    const total = rates.reduce((a, [, w]) => a + w, 0);
    let x = Math.random() * total;
    for (const [r, w] of rates) { x -= w; if (x <= 0) return r; }
    return rates[rates.length - 1][0];
  }

  /** Los 3 más fuertes de la generación, para el cartel del banner. */
  function featured(gen) {
    return G.DEX.filter(p => inBanner(p, gen) && p.rarity === 5)
      .sort((a, b) => b.bst - a.bst).slice(0, 3).map(p => p.dex);
  }

  /**
   * Hace `n` tiradas en el banner `gen` sobre el guardado `save` (lo modifica).
   * Devuelve null si no hay tickets, o la lista de resultados.
   * unlocked: esta tirada lo mete en la pokédex (se cumplieron los fragmentos,
   * o es un dorado de uno que no tenías).
   */
  function pull(save, n, gen = 1, use = 't1') {
    if ((save.region || 1) < gen) return null;
    const cost = costOf(save, n, use);
    if (!cost) return null;
    save.tickets = Object.assign({}, EMPTY, save.tickets);
    save.tickets.t1 -= cost.t1;
    save.tickets.t10 -= cost.t10;
    save.tickets.tb -= cost.tb;
    save.tickets.tg -= cost.tg;
    save.shiny = save.shiny || {};
    save.frags = save.frags || {};
    const gold = use === 'tg';

    function pickShiny() {
      const { list } = poolNear(rollRarity('tg'), gen);
      let withArt = list.filter(p => G.Sprites.hasShiny(p.dex));
      if (!withArt.length) withArt = G.DEX.filter(p => p.gen === gen && G.Sprites.hasShiny(p.dex));
      if (!withArt.length) return null;
      const missing = withArt.filter(p => !save.shiny[p.dex]);
      return G.U.pick(missing.length ? missing : withArt);
    }
    function takeShiny(mon) {
      const had = !!save.owned[mon.dex];
      const isNew = !save.shiny[mon.dex];
      let unlocked = false, fragGain = 0, frags = 0;
      if (isNew) {
        save.shiny[mon.dex] = { at: Date.now(), from: 'gacha' };
        if (!had) {
          save.owned[mon.dex] = { at: Date.now(), from: 'gacha' };
          unlocked = true;
        }
      } else {
        const key = lineKey(mon.dex);
        fragGain = G.Evo.stage(mon.dex);
        frags = (save.frags[key] || 0) + fragGain;
        save.frags[key] = frags;
      }
      return { dex: mon.dex, rarity: mon.rarity, shiny: true, isNew, refund: 0, frags, fragGain, need: 0, unlocked };
    }

    const out = [];
    for (let i = 0; i < n; i++) {
      if (gold) {
        const mon = pickShiny();
        if (!mon) continue;
        const card = takeShiny(mon);
        out.push(card);
        if (!card.isNew) {
          const again = pickShiny();
          if (again) out.push(takeShiny(again));
        }
        continue;
      }
      const { list } = poolNear(rollRarity(use), gen);
      const mon = G.U.pick(list);
      const shiny = false;

      const need = fragNeed(mon.rarity);
      const had = !!save.owned[mon.dex];
      let isNew = false, refund = 0, unlocked = false, frags = 0, fragGain = 0;
      if (had && !canGrow(mon, save)) {
        refund = REFUND[mon.rarity];
      } else {
        const key = lineKey(mon.dex);
        fragGain = G.Evo.stage(mon.dex);
        frags = (save.frags[key] || 0) + fragGain;
        save.frags[key] = frags;
        if (!had && frags >= need) {
          save.owned[mon.dex] = { at: Date.now(), from: 'gacha' };
          frags -= need;
          if (frags > 0) save.frags[key] = frags;
          else delete save.frags[key];
          unlocked = true;
        }
      }
      save.coins += refund;
      if (refund && G.Pass) G.Pass.goldEarn(refund);
      out.push({ dex: mon.dex, rarity: mon.rarity, shiny, isNew, refund, frags, fragGain, need: had || unlocked ? 0 : need, unlocked });
    }
    save.stats.pulls = (save.stats.pulls || 0) + n;
    if (gold) save.stats.goldPulls = (save.stats.goldPulls || 0) + 1;
    if (G.Pass) {
      G.Pass.ticketsSpent(cost);
      for (const c of out) if (c && c.dex) G.Pass.gacha(c.dex);
    }
    return out;
  }

  return { debugForceShiny(n = 1) { forceShiny = n; },
           costOf, RATES, TABLES, REFUND, FRAGS, fragNeed, lineFrags, CAP, STEP, growCost, grown, atCap, canGrow, grow, carryBoosts,
           RARITY_NAME, RARITY_COLOR, BANNERS,
           pool, featured, pull };
})();
