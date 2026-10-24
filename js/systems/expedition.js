/* ============ expedition.js — expedición (fragmentos fuera de la partida) ============
 * Un Pokémon por hueco. Cada ronda completa da fragmentos de su línea
 * evolutiva, los mismos en un básico que en una evolución (no hay ×2 ni ×3).
 *
 * Todos sacan fragmentos en una ronda de 15 min (sin subir) a 10 min (al tope).
 * Una baya puede bajarla hasta 5, subirla, cambiar las tiradas del bioma
 * o el tope de horas (8 h; Pera'h 10 h; Polca 4 h). Eso se guarda al enviar.
 * da igual el bioma. "Al tope" es la media de dos cosas: las mejoras de
 * monedas de ese Pokémon y lo cerca que está del tope de vida, ataque y
 * velocidad. Se redondea al minuto.
 * Aparte, si el bioma le va bien, cada 10 min hay un 65% de sumar 1 fragmento.
 * Si le va mal, cada 30 min hay un 50% de perder 1. Neutral no suma ni resta.
 * La tirada sale de la hora de salida, así que recargar no la cambia.
 * Mentalidad Ganadora suma 1 fragmento por ronda fija y por nivel.
 * El ritmo se guarda al enviar: subirlo después no reescribe la que ya está fuera.
 * A las 8 h para. Llamar antes entrega solo lo ya completado. El total no baja de 0.
 *
 * Condición, con la misma tabla de tipos que las runs y las torres.
 * El tipo normal no cuenta: si es lo único que tiene, queda Neutral.
 *   - algún tipo suyo está en el bioma → Buena
 *   - si no, y un tipo suyo le pega poco a algo del bioma y eso le pega
 *     fuerte de vuelta → Mala (el agua frena al fuego y le hace ×2:
 *     fuego en el bosque y en el lago es Mala)
 *   - si no, y un tipo suyo le pega poco a todo el bioma → Mala
 *   - si no, y alguno es supereficaz y nadie del bioma lo contrarresta → Buena
 *   - si no → Neutral
 * Un tipo bueno salva a uno malo (un fuego/volador en el bosque lo salva el volador).
 * Planta en el bosque es Buena. Planta en el volcán es Mala. Planta en el
 * glaciar es Neutral: le pega ×1 al hielo, y el hielo no le resiste el golpe.
 */
G.Expedition = (() => {
  const MAX_MS = 8 * 60 * 60 * 1000;
  const BIOMES = [
    { id: 'bosque', name: 'Bosque', where: 'los claros del bosque', file: 'bosque.png', types: ['bug', 'grass', 'water', 'fairy'] },
    { id: 'montana', name: 'Montaña', where: 'las laderas de la montaña', file: 'montaña.png', types: ['steel', 'rock', 'flying', 'ground'] },
    { id: 'caverna', name: 'Caverna', where: 'las cuevas de la caverna', file: 'caverna.png', types: ['dark', 'fighting', 'ground', 'rock'] },
    { id: 'lago', name: 'Lago', where: 'las aguas del lago', file: 'lago.png', types: ['water', 'flying', 'grass'] },
    { id: 'glaciar', name: 'Glaciar', where: 'el hielo del glaciar', file: 'glaciar.png', types: ['ice'] },
    { id: 'mansion', name: 'Mansión Embrujada', where: 'los salones de la mansión embrujada', file: 'mansion.png', types: ['dark', 'ghost', 'psychic', 'fairy'] },
    { id: 'volcan', name: 'Volcán', where: 'el calor del volcán', file: 'volcan.png', types: ['fire', 'flying', 'dragon'] },
    { id: 'central', name: 'Central Hidroeléctrica', where: 'las turbinas de la central hidroeléctrica', file: 'central.png', types: ['electric', 'poison'] }
  ];
  const BY = {};
  for (const b of BIOMES) BY[b.id] = b;
  const COND = { good: 'Buena', neutral: 'Neutral', bad: 'Mala' };

  /** Nivel de una mejora de la cuenta, leído de ESA partida (no de la que esté abierta). */
  function accountLvl(save, id) {
    const def = G.Upgrades && G.Upgrades.BY[id];
    const n = Math.floor(+((save && save.gupg && save.gupg[id]) || 0));
    if (!(n > 0)) return 0;
    return def ? Math.min(def.max, n) : n;
  }
  function slotCount(save) { return 1 + accountLvl(save, 'expslot'); }
  function mind(save) { return accountLvl(save, 'expmind'); }

  function offense(atk, def) {
    const row = G.Types && G.Types.CHART && G.Types.CHART[atk];
    if (!row || row[def] == null) return 1;
    return row[def];
  }

  /**
   * Un tipo contra el bioma.
   * Malo si algo del bioma le frena el golpe y encima le pega fuerte,
   * o si le pega poco a todo y a nada le pega fuerte.
   * Bueno si es supereficaz y nadie lo contrarresta.
   */
  function stance(monType, theirs) {
    let se = false, resist = false, countered = false;
    for (const d of theirs) {
      const off = offense(monType, d);
      const back = offense(d, monType);
      if (off >= 2) se = true;
      if (off <= 0.5) {
        resist = true;
        if (back >= 2) countered = true;
      }
    }
    if (countered || (resist && !se)) return 'bad';
    if (se) return 'good';
    return 'neutral';
  }

  /** 'good' | 'neutral' | 'bad'. El normal no decide: solo, es neutral; con otro tipo, manda el otro. */
  function condition(types, biome) {
    const mine = (types || []).filter(t => t !== 'normal');
    if (!mine.length) return 'neutral';
    const theirs = (biome && biome.types) || [];
    if (mine.some(t => theirs.includes(t))) return 'good';
    let anyGood = false, anyBad = false;
    for (const a of mine) {
      const s = stance(a, theirs);
      if (s === 'good') anyGood = true;
      else if (s === 'bad') anyBad = true;
    }
    if (anyGood) return 'good';
    if (anyBad) return 'bad';
    return 'neutral';
  }

  /** 0 = sin invertir, 1 = mejoras de monedas y estadísticas al máximo. */
  function fullness(save, mon) {
    const ups = (G.Upgrades && G.Upgrades.LIST || []).filter(u => u.cat === 'mon');
    const bag = (save.pupg && save.pupg[mon.dex]) || {};
    let up = 0;
    for (const u of ups) up += Math.min(u.max, Math.max(0, +bag[u.id] || 0)) / u.max;
    up = ups.length ? up / ups.length : 0;
    let st = 0;
    const grown = G.Gacha ? G.Gacha.grown(mon, save) : null;
    for (const stat of ['hp', 'atk', 'spd']) {
      const base = mon[stat], cap = G.Gacha ? G.Gacha.CAP[stat] : base;
      const span = cap - base;
      if (!(span > 0)) { st += 1; continue; }
      const cur = grown ? grown[stat] : base;
      st += Math.max(0, Math.min(1, (cur - base) / span));
    }
    return (up + st / 3) / 2;
  }

  /** Milisegundos de la ronda fija: 15 min sin subir, 10 min al tope. El bioma no entra. */
  function intervalMs(save, mon) {
    const baseMin = 15 - 5 * fullness(save, mon);
    return Math.max(1, Math.round(baseMin)) * 60 * 1000;
  }

  /** Extra del bioma, aparte de la ronda fija. Buena: 65% de +1 / 10 min. Mala: 50% de −1 / 30 min. */
  function bonusOf(cond) {
    if (cond === 'good') return { bonusEvery: 10 * 60 * 1000, bonus: 1, chance: 0.65 };
    if (cond === 'bad') return { bonusEvery: 30 * 60 * 1000, bonus: -1, chance: 0.5 };
    return { bonusEvery: 0, bonus: 0, chance: 0 };
  }

  /** Tirada fija: la misma expedición da siempre el mismo resultado. */
  function mix(n) {
    let x = n >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
    x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
    return (x ^ (x >>> 16)) >>> 0;
  }
  function roll(at, dex, i) {
    const s = mix((Math.floor(at / 1000) ^ Math.imul(dex || 1, 0x85ebca6b) ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0);
    return s / 4294967296;
  }
  function bonusNet(at, dex, cycles, bonus, chance) {
    if (!(cycles > 0) || !bonus || !(chance > 0)) return 0;
    const step = bonus > 0 ? 1 : -1;
    let n = 0;
    for (let i = 0; i < cycles; i++) if (roll(at, dex, i) < chance) n += step;
    return n;
  }
  /** Toto: un fragmento más en la ronda fija. La tirada no comparte índice con el bioma. */
  function extraNet(at, dex, cycles, p) {
    if (!(cycles > 0) || !(p > 0)) return 0;
    let n = 0;
    for (let i = 0; i < cycles; i++) if (roll(at, dex, 500000 + i) < p) n++;
    return n;
  }
  /** Drildo: 3 fragmentos en el tick del bioma malo, aparte de la pérdida. */
  function tripleNet(at, dex, cycles, p) {
    if (!(cycles > 0) || !(p > 0)) return 0;
    let n = 0;
    for (let i = 0; i < cycles; i++) if (roll(at, dex, 800000 + i) < p) n += 3;
    return n;
  }

  function preview(save, dex, biomeId) {
    const mon = G.DEX_BY[dex];
    const biome = BY[biomeId];
    if (!mon || !biome) return null;
    const cond = condition(mon.types, biome);
    let min = Math.round(intervalMs(save, mon) / 60000);
    const gain = 1 + mind(save);
    const bonus = bonusOf(cond);
    let chance = bonus.chance;
    let extraP = 0, tripleP = 0, maxMs = MAX_MS;
    const mod = G.Garden && G.Garden.mods(save, dex);
    if (mod) {
      min += mod.everyMin || 0;
      if (bonus.bonus > 0 && mod.goodChance) chance += mod.goodChance;
      if (bonus.bonus < 0 && mod.badChance) chance += mod.badChance;
      if (bonus.bonus < 0 && mod.chanceZero) chance = 0;
      extraP = mod.extraP || 0;
      tripleP = bonus.bonus < 0 ? (mod.tripleP || 0) : 0;
      if (mod.maxMs) maxMs = mod.maxMs;
    }
    min = Math.max(5, min);
    chance = Math.max(0, Math.min(1, chance));
    return {
      cond, every: min * 60000, gain, name: COND[cond],
      bonusEvery: bonus.bonusEvery, bonus: bonus.bonus, chance, extraP, tripleP, maxMs
    };
  }

  function chanceOf(e) {
    if (e.chance != null && e.chance !== '') {
      const c = +e.chance;
      if (c >= 0 && c <= 1) return c;
    }
    if ((+e.bonus || 0) > 0) return 0.65;
    if ((+e.bonus || 0) < 0) return 0.5;
    return 0;
  }

  function progress(e, now) {
    const every = Math.max(60000, +e.every || 0);
    const gain = Math.max(1, +e.gain || 1);
    const bonusEvery = Math.max(0, +e.bonusEvery || 0);
    const bonus = Math.floor(+e.bonus) || 0;
    const chance = chanceOf(e);
    const extraP = Math.max(0, Math.min(1, +e.extraP || 0));
    const tripleP = bonus < 0 ? Math.max(0, Math.min(1, +e.tripleP || 0)) : 0;
    const cap = +e.maxMs > 0 ? Math.max(every, Math.min(12 * 60 * 60 * 1000, +e.maxMs)) : MAX_MS;
    const elapsed = Math.max(0, Math.min(cap, (now || Date.now()) - e.at));
    const cycles = Math.floor(elapsed / every);
    const bonusCycles = bonusEvery ? Math.floor(elapsed / bonusEvery) : 0;
    const done = elapsed >= cap;
    const into = done ? every : elapsed % every;
    let next = done ? 0 : every - into;
    if (!done && bonus > 0 && bonusEvery && chance > 0) {
      const from = bonusCycles;
      for (let i = from; i < from + 48; i++) {
        const atTick = (i + 1) * bonusEvery;
        if (atTick > cap) break;
        if (roll(e.at, e.dex, i) >= chance) continue;
        const wait = atTick - elapsed;
        if (wait < next) next = wait;
        break;
      }
    }
    if (!done && tripleP > 0 && bonusEvery) {
      const from = bonusCycles;
      for (let i = from; i < from + 48; i++) {
        const atTick = (i + 1) * bonusEvery;
        if (atTick > cap) break;
        if (roll(e.at, e.dex, 800000 + i) >= tripleP) continue;
        const wait = atTick - elapsed;
        if (wait > 0 && wait < next) next = wait;
        break;
      }
    }
    return {
      frags: Math.max(0, cycles * gain + bonusNet(e.at, e.dex, bonusCycles, bonus, chance) + extraNet(e.at, e.dex, cycles, extraP) + tripleNet(e.at, e.dex, bonusCycles, tripleP)),
      cycles, elapsed, every, gain, bonusEvery, bonus, chance, done, next,
      left: cap - elapsed,
      into
    };
  }

  function busy(save) {
    return (save && save.expd || []).filter(e => e && e.dex);
  }

  function menuLine(save) {
    const n = busy(save).length;
    if (!n) return 'Fragmentos de su línea, hasta 8 h';
    return n === 1 ? '1 en marcha' : n + ' en marcha';
  }

  function normDone(raw, key) {
    const dex = Math.floor(+key);
    if (!dex) return null;
    if (raw && typeof raw === 'object') {
      const t = Math.floor(+raw.t);
      if (!(t > 0)) return null;
      return { dex: String(dex), t, n: Math.max(0, Math.min(100000, Math.floor(+raw.n) || 0)), k: typeof raw.k === 'string' ? raw.k : '' };
    }
    const t = Math.floor(+raw);
    return t > 0 ? { dex: String(dex), t, n: 0, k: '' } : null;
  }

  /** Deja la lista de huecos y los regresos en un estado posible. */
  function clean(save) {
    if (!save) return;
    const slots = slotCount(save);
    const raw = Array.isArray(save.expd) ? save.expd : [];
    const seen = new Set();
    const out = [];
    for (const e of raw) {
      if (!e || typeof e !== 'object') { out.push(null); continue; }
      const dex = Math.floor(+e.dex);
      const biome = BY[e.biome];
      const at = Math.floor(+e.at);
      const mon = dex && G.DEX_BY && G.DEX_BY[dex];
      if (!mon || (save.owned && !save.owned[dex]) || !biome || !(at > 0)) { out.push(null); continue; }
      if (seen.has(dex)) { out.push(null); continue; }
      seen.add(dex);
      const cond = e.cond === 'good' || e.cond === 'bad' || e.cond === 'neutral' ? e.cond : condition(mon.types, biome);
      // Sin el extra guardado es una salida de la regla vieja (el bioma acortaba la ronda). Se reescribe.
      const fresh = e.bonusEvery == null || e.bonus == null ? preview(save, dex, biome.id) : null;
      const every = fresh ? fresh.every : (Math.max(60000, Math.min(2 * 60 * 60 * 1000, Math.floor(+e.every) || 0)) || intervalMs(save, mon));
      const gain = fresh ? fresh.gain : Math.max(1, Math.min(20, Math.floor(+e.gain) || (1 + mind(save))));
      const extra = fresh || bonusOf(cond);
      const bonusEvery = fresh ? extra.bonusEvery : Math.max(0, Math.min(2 * 60 * 60 * 1000, Math.floor(+e.bonusEvery) || 0));
      const bonus = fresh ? extra.bonus : Math.max(-5, Math.min(20, Math.floor(+e.bonus) || 0));
      const chance = fresh ? extra.chance
        : (e.chance == null ? (bonus > 0 ? 0.65 : bonus < 0 ? 0.5 : 0) : Math.max(0, Math.min(1, +e.chance || 0)));
      const spot = { dex, biome: biome.id, at: Math.min(Date.now() + 60000, at), every, gain, cond, bonusEvery, bonus, chance };
      if (typeof e.berry === 'string' && G.Berries && G.Berries.BY[e.berry]) spot.berry = e.berry;
      if (!fresh) {
        const extraP = Math.max(0, Math.min(1, +e.extraP || 0));
        const tripleP = Math.max(0, Math.min(1, +e.tripleP || 0));
        if (extraP) spot.extraP = extraP;
        if (tripleP) spot.tripleP = tripleP;
        if (+e.maxMs > 0) spot.maxMs = Math.max(60000, Math.min(12 * 60 * 60 * 1000, Math.floor(+e.maxMs)));
      }
      out.push(spot);
    }
    while (out.length < slots) out.push(null);
    while (out.length > slots && out[out.length - 1] == null) out.pop();
    save.expd = out;

    const done = {};
    const src = save.expdDone && typeof save.expdDone === 'object' ? save.expdDone : {};
    for (const k of Object.keys(src)) {
      const rec = normDone(src[k], k);
      if (!rec) continue;
      if (G.DEX_BY && !G.DEX_BY[rec.dex]) continue;
      done[rec.dex] = { t: rec.t, n: rec.n, k: rec.k };
    }
    save.expdDone = done;
  }

  /**
   * Une las expediciones de dos partidas. Si en una ya se llamó a ese
   * Pokémon, no vuelve a salir. Si quien lo llamó es la copia vieja, se
   * suman los fragmentos que anotó al llamarlo (la copia nueva no los tiene).
   * Modifica `newer`, que es la partida que se queda.
   */
  function merge(newer, older) {
    if (!newer) return;
    const done = {};
    const put = src => {
      for (const k in (src && src.expdDone) || {}) {
        const rec = normDone(src.expdDone[k], k);
        if (!rec) continue;
        const prev = done[rec.dex];
        if (!prev || rec.t >= prev.t) done[rec.dex] = rec;
      }
    };
    put(older);
    put(newer);
    const knew = {};
    for (const k in (newer.expdDone || {})) {
      const rec = normDone(newer.expdDone[k], k);
      if (rec) knew[rec.dex] = rec;
    }
    newer.frags = newer.frags || {};
    for (const dex in done) {
      const rec = done[dex];
      const nw = knew[dex];
      if (nw && nw.t >= rec.t) continue;
      if (rec.n > 0 && rec.k) newer.frags[rec.k] = (newer.frags[rec.k] || 0) + rec.n;
    }

    const lists = [newer.expd || [], (older && older.expd) || []];
    const alive = e => {
      if (!e || !e.dex) return null;
      const dex = Math.floor(+e.dex);
      const at = Math.floor(+e.at) || 0;
      const rec = done[String(dex)];
      if (!dex || (rec && rec.t >= at)) return null;
      return Object.assign({}, e, { dex, at });
    };
    // Si las dos copias tienen al mismo Pokémon, se queda la salida más antigua.
    const best = new Map();
    for (const list of lists) for (const raw of list) {
      const e = alive(raw);
      if (!e) continue;
      const prev = best.get(e.dex);
      if (!prev || e.at < prev.at) best.set(e.dex, e);
    }
    const n = Math.max(lists[0].length, lists[1].length);
    const used = new Set();
    const out = [];
    for (let i = 0; i < n; i++) {
      const opts = [alive(lists[0][i]), alive(lists[1][i])].filter(Boolean)
        .sort((a, b) => a.at - b.at);
      let placed = null;
      for (const e of opts) {
        const keep = best.get(e.dex);
        if (!keep || keep.at !== e.at || used.has(e.dex)) continue;
        placed = keep;
        used.add(e.dex);
        break;
      }
      out.push(placed);
    }
    for (const e of best.values()) {
      if (used.has(e.dex)) continue;
      const hole = out.indexOf(null);
      if (hole >= 0) out[hole] = e;
      else out.push(e);
      used.add(e.dex);
    }
    newer.expd = out;
    const packed = {};
    for (const dex in done) packed[dex] = { t: done[dex].t, n: done[dex].n, k: done[dex].k };
    newer.expdDone = packed;
  }

  function send(save, index, dex, biomeId) {
    if (!save || !save.owned || !save.owned[dex]) return null;
    clean(save);
    if (index < 0 || index >= save.expd.length || save.expd[index]) return null;
    if (save.expd.some(e => e && e.dex === dex)) return null;
    const plan = preview(save, dex, biomeId);
    if (!plan) return null;
    const spot = {
      dex, biome: biomeId, at: Date.now(), every: plan.every, gain: plan.gain, cond: plan.cond,
      bonusEvery: plan.bonusEvery, bonus: plan.bonus, chance: plan.chance,
      extraP: plan.extraP || 0, tripleP: plan.tripleP || 0, maxMs: plan.maxMs || MAX_MS
    };
    const berry = G.Garden && G.Garden.worn(save, dex);
    if (berry) spot.berry = berry;
    save.expd[index] = spot;
    return spot;
  }

  /** Quita el Pokémon del hueco y anota los fragmentos de las rondas completas. */
  function recall(save, index) {
    if (!save || !save.expd || !save.expd[index]) return null;
    const e = save.expd[index];
    const info = progress(e, Date.now());
    const key = String(G.Evo.root(e.dex));
    if (info.frags > 0) {
      save.frags = save.frags || {};
      save.frags[key] = (save.frags[key] || 0) + info.frags;
    }
    save.expdDone = save.expdDone || {};
    save.expdDone[String(e.dex)] = { t: Date.now(), n: info.frags, k: key };
    save.expd[index] = null;
    return { dex: e.dex, frags: info.frags, biome: e.biome, berry: e.berry || null };
  }

  return {
    BIOMES, BY, COND, MAX_MS,
    slotCount, mind, condition, fullness, intervalMs, preview, progress,
    busy, menuLine, clean, merge, send, recall
  };
})();
