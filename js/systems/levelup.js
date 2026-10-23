/* ============ levelup.js — las tres cartas de subida de nivel ============
 * Tipos de carta:
 *   new   aprender un movimiento nuevo (sólo si quedan huecos de los 4; un vínculo libera huecos)
 *   up    mejorar un movimiento que ya tienes
 *   stat  mejora permanente de la run
 */
G.LevelUp = (() => {

  const STATS = [
    { id: 'hp',   icon: 'heart', title: 'Vigor',        desc: '+20 de vida máxima (y la recupera).',
      apply: pl => pl.addMaxHp(20) },
    { id: 'atk',  icon: 'fist', title: 'Potencia',     desc: '+10% de daño con todos los movimientos.',
      apply: pl => pl.atkMul *= 1.10, max: 40 },
    { id: 'spd',  icon: 'boot', title: 'Carrera',      desc: '+7% de velocidad de movimiento.',
      apply: pl => pl.spdMul *= 1.07, max: 8 },
    { id: 'cd',   icon: 'clock', title: 'Reflejos',     desc: '-8% de recarga en todos los movimientos.',
      apply: pl => pl.cdMul *= 0.92, max: 10 },
    { id: 'def',  icon: 'shield', title: 'Coraza',       desc: '+6% de reducción de daño recibido.',
      apply: pl => pl.dmgReduce = Math.min(0.7, pl.dmgReduce + 0.06), max: 12 },
    { id: 'rgn',  icon: 'sprout', title: 'Síntesis',     desc: '+0.9 de vida regenerada por segundo.',
      apply: pl => pl.regenFlat += 0.9 },
    { id: 'mag',  icon: 'magnet', title: 'Imán',         desc: '+30% de radio de recogida de experiencia.',
      apply: pl => pl.magnet *= 1.30, max: 6 },
    { id: 'xp',   icon: 'book', title: 'Aprendizaje',  desc: '+12% de experiencia ganada.',
      apply: pl => pl.xpMul *= 1.12, max: 8 },
    { id: 'heal', icon: 'berry', title: 'Baya Zidra',   desc: 'Recupera el 45% de tu vida ahora mismo.',
      apply: pl => pl.heal(pl.maxHp * 0.45) }
  ];

  /** Construye el conjunto de cartas candidatas, con pesos. */
  function candidates(pl) {
    const out = [];

    // --- movimientos nuevos ---
    if (pl.slots.length < pl.maxMoves) {
      // Con 2 potenciadores ya no se ofrecen más: los buff no hacen daño y
      // llenar los 4 huecos con ellos deja la run sin salida.
      const buffs = pl.moves.filter(m => m.kind === 'buff').length;
      const pool = G.Moves.poolFor(pl.mon).filter(id =>
        !pl.hasMove(id) && !(pl.banned && pl.banned.has(id)) && !(buffs >= 2 && G.Moves.BY_ID[id].kind === 'buff'));
      for (const id of G.U.pickN(pool, 6)) {
        const d = G.Moves.BY_ID[id];
        out.push({
          w: 10, type: 'new', key: 'new:' + id,
          icon: 'move:' + id, color: G.U.TYPE_COLOR[d.type],
          tag: G.U.TYPE_NAME[d.type],
          title: d.name, desc: G.Moves.blurb(d),
          apply: p => p.addMove(id)
        });
      }
    }

    // --- evoluciones: movimiento al máximo + su condición cumplida ---
    const waiting = {};                   // stat -> movimiento que la espera para evolucionar
    for (const m of pl.moves) {
      const ev = G.Moves.evoInfo(m, pl.statsTaken);
      if (!ev) continue;
      if (!ev.ready) { waiting[ev.needs] = m; continue; }
      out.push({
        w: 40, type: 'evo', key: 'evo:' + m.id,
        icon: 'move:' + m.id, color: '#ffd23f', tag: 'EVOLUCIÓN',
        title: m.name + ' → ' + ev.name, desc: ev.text,
        apply: p => {
          G.Moves.evolve(m);
          G.FX.ring(p.x, p.y, 8, 120, '#ffd23f', 0.8, 6);
          G.FX.burst(p.x, p.y - p.bodyH * 0.5, '#ffe14d', 40, 240);
          G.Audio.sfx('legend');
          G.Progress.event('evolve', { move: m.id });
        }
      });
    }

    // --- mejoras de movimientos que ya tienes ---
    for (const m of pl.moves) {
      const txt = G.Moves.nextUpText(m);
      if (!txt) continue;
      out.push({
        w: 8, type: 'up', key: 'up:' + m.id,
        icon: 'move:' + m.id, color: G.U.TYPE_COLOR[m.type],
        tag: 'Nv.' + m.lvl + ' > ' + (m.lvl + 1),
        title: m.name, desc: txt,
        apply: () => G.Moves.levelUp(m)
      });
    }

    // --- piedra evolución: hueco aparte. Básica desde el 65, segunda desde el 135. ---
    if (pl.evoStone && G.Evo) {
      const info = G.Evo.of(pl.dex);
      const need = info.stage <= 1 ? 65 : info.stage === 2 ? 135 : 0;
      const forms = info.next.filter(d => G.DEX_BY[d]);
      if (need && pl.level >= need && forms.length) {
        const branch = forms.length > 1;
        const named = G.DEX_BY[forms[0]];
        out.push({
          w: 36, type: 'forme', key: 'forme',
          icon: 'evostone', color: '#c47bff', tag: 'EVOLUCIÓN',
          title: branch ? 'Evolucionar' : 'Evolucionar a ' + named.name,
          desc: branch
            ? 'Tu compañero pasa a una de sus siguientes formas, al azar.'
            : 'Tu compañero pasa a la siguiente etapa.',
          apply: p => {
            const nxt = G.Evo.next(p.dex).filter(d => G.DEX_BY[d]);
            const to = nxt.length > 1 ? G.U.pick(nxt) : nxt[0];
            if (to) p.become(to);
          }
        });
      }
    }

    // --- stats ---
    // Las que desbloquean una evolución salen siempre y con aviso.
    // Cada mejora tiene un tope de veces (`max`): en partidas muy largas se
    // acumulaban sin fin (velocidad, recarga y experiencia por las nubes) y el
    // juego acababa colgándose. Las que piden una evolución salen siempre.
    const room = s => !s.max || (pl.statsTaken[s.id] || 0) < s.max;
    const pickStats = G.U.pickN(STATS.filter(s => !waiting[s.id] && room(s)), 5).concat(STATS.filter(s => waiting[s.id]));
    for (const s of pickStats) {
      const evoFor = waiting[s.id];
      out.push({
        w: evoFor ? 14 : pl.slots.length < pl.maxMoves ? 4 : 7,
        type: 'stat', key: 'stat:' + s.id,
        icon: s.icon, color: evoFor ? '#ffd23f' : '#8fa3c4', tag: evoFor ? 'Evoluciona ' + evoFor.name : 'Mejora',
        title: s.title, desc: s.desc,
        apply: p => { s.apply(p); p.statsTaken[s.id] = (p.statsTaken[s.id] || 0) + 1; }
      });
    }

    return out;
  }

  /** Devuelve n cartas distintas, elegidas por peso. */
  function offer(pl, n = 3) {
    const pool = candidates(pl);
    const picked = [];
    const used = new Set();
    // Si hay una evolución lista, su carta dorada sale siempre.
    const evo = pool.findIndex(c => c.type === 'evo');
    if (evo >= 0) { const c = pool.splice(evo, 1)[0]; used.add(c.key); picked.push(c); }

    while (picked.length < n && pool.length) {
      const total = pool.reduce((a, c) => a + c.w, 0);
      let r = Math.random() * total, idx = 0;
      for (let i = 0; i < pool.length; i++) { r -= pool[i].w; if (r <= 0) { idx = i; break; } }
      const c = pool.splice(idx, 1)[0];
      if (used.has(c.key)) continue;
      used.add(c.key);
      picked.push(c);
    }
    return picked;
  }

  // Tienda de torre: 2 mejoras + 1 baya con rareza.
  const BERRIES = [
    { id: 'berry', w: 55, title: 'Baya', tag: 'Blanco', color: '#dfe6f2',
      desc: 'Recupera el 45% de tu vida ahora mismo.', heal: 0.45, shield: 0 },
    { id: 'joy', w: 28, title: 'Baya Alegría', tag: 'Morado', color: '#c47bff',
      desc: 'Recupera el 70% de tu vida ahora mismo.', heal: 0.7, shield: 0 },
    { id: 'angel', w: 14, title: 'Baya Ángel', tag: 'Azul', color: '#4fb4ff',
      desc: 'Recupera el 90% de tu vida ahora mismo.', heal: 0.9, shield: 0 },
    { id: 'miracle', w: 3, title: 'Baya Milagro', tag: 'Dorada', color: '#ffd23f',
      desc: 'Recupera el 100% de tu vida y ganas un escudo del 50%.', heal: 1, shield: 0.5 }
  ];

  function rollBerry() {
    const total = BERRIES.reduce((a, b) => a + b.w, 0);
    let r = Math.random() * total;
    let b = BERRIES[0];
    for (const x of BERRIES) { r -= x.w; if (r <= 0) { b = x; break; } }
    return {
      w: 0, type: 'berry', key: 'berry:' + b.id,
      icon: 'berry', color: b.color, tag: b.tag,
      title: b.title, desc: b.desc,
      apply: p => {
        p.heal(p.maxHp * b.heal);
        if (b.shield > 0) p.shield = Math.max(p.shield || 0, p.maxHp * b.shield);
        G.FX.ring(p.x, p.y, 8, 70, b.color, 0.55, 4);
      }
    };
  }

  /** Dos mejoras al azar (como las de nivel) y una baya segura. */
  function shopOffer(pl) {
    const ups = offer(pl, 2).filter(c => c.key !== 'stat:heal');
    while (ups.length < 2) {
      const more = offer(pl, 1).filter(c => c.key !== 'stat:heal' && !ups.some(u => u.key === c.key));
      if (!more.length) break;
      ups.push(more[0]);
    }
    return ups.concat(rollBerry());
  }

  return { offer, shopOffer, STATS, BERRIES };
})();
