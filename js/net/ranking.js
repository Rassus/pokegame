/* ============ ranking.js — clasificación de tiempo aguantado ============
 * Firestore (pensado para gastar lo mínimo del plan gratuito):
 *
 *   lbs/{tabla}        RESUMEN: el top 50 de la tabla en UN documento
 *                      { top: { id: { t, uids, names, dex, shiny, lv, kills } }, me, ev }
 *                      Ver una pestaña del ranking = 1 lectura (antes ~52).
 *   lb/{tabla}/e/{id}  la marca de cada jugador o equipo (la que sirve para
 *                      calcular tu puesto si no estás en el top 50)
 *
 *   tabla = modo + periodo:
 *     s_d20261008   solitario, hoy            g_...   en grupo
 *     s_w2026-41    semana ISO                s_m202610  mes
 *     s_all         histórico   (la tabla anual se quitó el 2026-10-10)
 *     s_all_p25     histórico sólo con Pikachu (el filtro por Pokémon sólo
 *                   existe en el histórico: así cada partida escribe la mitad)
 *     s_tw150n_all  torre 150, modo normal, en solitario (h difícil, m demencial).
 *     g_tw150n_all  la misma torre en grupo: una fila por equipo.
 *                   La puntuación es la oleada.
 *   id = tu uid (solitario) o los uid del equipo ordenados y unidos con "_".
 *
 * Ahorros:
 *   - Lo leído se guarda 30 min en el navegador (cambiar de pestaña y volver: 0).
 *   - Tus mejores marcas se recuerdan en el navegador: al acabar una partida
 *     no hay que leer nada para saber si has mejorado, y sólo se escribe
 *     donde mejoras.
 *   - El resumen sólo se toca si tu marca entra en el top 50.
 *   - En diario, semanal y mensual sólo se guardan las marcas del top 50: si
 *     no entras no se escribe nada y tu puesto sale como "fuera del top 50".
 *     Tu puesto exacto, aunque estés el 3.000, sólo en el histórico. Con mucha
 *     gente jugando, ahorra unas 6 de cada 10 escrituras del ranking.
 *
 * Los periodos se cuentan en hora de España (Europe/Madrid).
 */
G.Ranking = (() => {
  const TZ = 'Europe/Madrid';
  const PERIODS = [['d', 'Diario'], ['w', 'Semanal'], ['m', 'Mensual'], ['a', 'Histórico']];
  // Periodos en los que sólo se guarda el top 50 (ver arriba).
  // ('p' = histórico de un Pokémon: casi cada partida entraba en el de su
  //  Pokémon y escribía; ahora también sólo el top 50.)
  const TOP_ONLY = new Set(['d', 'w', 'm', 'p']);
  // Cuentas de prueba: no entran en ninguna tabla. El apodo no se puede cambiar.
  const ASIDE = new Set(['asus27']);
  const hiddenName = n => ASIDE.has(String(n || '').trim().toLowerCase());
  const aside = () => !!(G.Social && G.Social.me && hiddenName(G.Social.me.name));
  const partyHidden = members => aside() || (members || []).some(m => hiddenName(m && m.name));
  const hide = rows => rows.filter(r => !(r.names || []).some(hiddenName));
  const TOP = 50;
  // Las runs de menos de 1 minuto no se suben (casi nunca entran en una tabla
  // y eran muchas lecturas y escrituras para nada).
  const MIN_T = 60;
  const TTL = 30 * 60 * 1000;            // caché de lo leído (30 min: menos lecturas de Firestore)

  const fbx = () => G.DB.online ? G.DB.fb : null;

  // ---------------- periodos ----------------

  function madridDate(date) {
    const p = {};
    for (const x of new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)) p[x.type] = x.value;
    return { y: +p.year, m: +p.month, d: +p.day };
  }

  /** Semana ISO (lunes a domingo) de una fecha y-m-d. */
  function isoWeek(y, m, d) {
    const t = new Date(Date.UTC(y, m - 1, d));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return { year: t.getUTCFullYear(), week: Math.ceil(((t - y0) / 86400000 + 1) / 7) };
  }

  function periodIds(date = new Date()) {
    const { y, m, d } = madridDate(date);
    const w = isoWeek(y, m, d);
    const p2 = n => String(n).padStart(2, '0');
    return { d: 'd' + y + p2(m) + p2(d), w: 'w' + w.year + '-' + p2(w.week), m: 'm' + y + p2(m), y: 'y' + y, a: 'all' };
  }

  /** El filtro por Pokémon sólo existe en el histórico. */
  function board(mode, period, dex) {
    return mode + '_' + periodIds()[period] + (dex && period === 'a' ? '_p' + dex : '');
  }

  const col = b => fbx().fs.collection('lb').doc(b).collection('e');
  const sumRef = b => fbx().fs.collection('lbs').doc(b);

  // ---------------- caché en el navegador ----------------

  const mem = new Map();                 // clave -> { at, v }
  function cacheGet(k) {
    let c = mem.get(k);
    if (!c) { try { c = JSON.parse(localStorage.getItem('ps.rk.c.' + k) || 'null'); } catch (e) { c = null; } if (c) mem.set(k, c); }
    return c && Date.now() - c.at < TTL ? c.v : undefined;
  }
  function cacheSet(k, v) {
    const c = { at: Date.now(), v };
    mem.set(k, c);
    try { localStorage.setItem('ps.rk.c.' + k, JSON.stringify(c)); } catch (e) { /* lleno */ }
  }
  /** Borra lo caducado (la caché del navegador no crece sin límite). */
  function cachePrune() {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith('ps.rk.c.')) continue;
        const c = JSON.parse(localStorage.getItem(k) || 'null');
        if (!c || Date.now() - c.at > TTL) localStorage.removeItem(k);
      }
    } catch (e) { /* nada */ }
  }
  cachePrune();

  // Tus mejores marcas por tabla (para no leer antes de escribir).
  // (best2 desde 2026-10-12: se quitaron del ranking las marcas rotas; así quien
  //  tenía una vuelve a mirar su marca real y puede volver a entrar.)
  const bestKey = () => 'ps.rk.best2.' + (fbx() ? fbx().uid : '');
  function bests() { try { return JSON.parse(localStorage.getItem(bestKey()) || '{}'); } catch (e) { return {}; } }
  function saveBests(b) {
    // Sólo se conservan las tablas de los periodos actuales y las históricas.
    const cur = Object.values(periodIds());
    for (const k of Object.keys(b)) {
      const parts = k.split(':')[0].split('_');
      if (!parts.some(p => cur.includes(p))) delete b[k];
    }
    try { localStorage.setItem(bestKey(), JSON.stringify(b)); } catch (e) { /* lleno */ }
  }

  // ---------------- guardar ----------------

  const rowOf = (id, v) => ({ id, t: v.t, uids: v.uids || [], names: v.names || [], dex: v.dex || [], shiny: v.shiny || [], lv: v.lv, kills: v.kills, st: Array.isArray(v.st) ? v.st : null });
  const sorted = top => Object.entries(top || {}).map(([id, v]) => rowOf(id, v)).sort((a, b) => b.t - a.t);

  /** Guarda la entrada en cada tabla donde mejore. → periodos mejorados */
  async function store(boards, id, entry) {
    const fb = fbx();
    const better = [];
    const known = bests();
    await Promise.all(boards.map(async ([b, period]) => {
      const key = b + ':' + id;
      try {
        // ¿Ya tenías una marca mejor? Si este navegador no lo sabe, se mira una vez.
        if (known[key] === undefined) {
          if (TOP_ONLY.has(period)) {
            // En estas tablas sólo hay marcas en el top 50: basta con el resumen
            // (que además se guarda 30 min y es el mismo que se lee al mirar el ranking).
            const top = await summary(b);
            known[key] = top[id] ? top[id].t : 0;
          } else {
            const old = await col(b).doc(id).get();
            known[key] = old.exists ? old.data().t : 0;
          }
        }
        if (known[key] >= entry.t) return;
        const data = Object.assign({}, entry, { at: firebase.firestore.FieldValue.serverTimestamp() });
        // Si la tabla ya está llena y no llegas al top 50, no hace falta tocar el resumen
        // (y en diario, semanal y mensual, ni siquiera se guarda la marca).
        const topOnly = TOP_ONLY.has(period);
        const cached = cacheGet('s:' + b);
        const full = cached && Object.keys(cached).length >= TOP;
        const minT = full ? Math.min(...Object.values(cached).map(v => v.t)) : 0;
        if (full && entry.t <= minT && !(id in cached)) {
          if (!topOnly) await col(b).doc(id).set(data);
          else { known[key] = entry.t; return; }
        } else {
          let entered = true;
          let newTop = null;
          await fb.fs.runTransaction(async tx => {
            const s = await tx.get(sumRef(b));
            const top = Object.assign({}, s.exists ? s.data().top : {});
            const mine = { t: entry.t, uids: entry.uids, names: entry.names, dex: entry.dex, shiny: entry.shiny, lv: entry.lv, kills: entry.kills, st: entry.st || null };
            let ev = '';
            // Ya estabas con una marca mejor (otro ordenador): nada que escribir.
            if (id in top && top[id].t >= entry.t) { entered = false; newTop = top; return; }
            if (!(id in top) && Object.keys(top).length >= TOP) {
              const low = sorted(top).pop();
              if (low.t >= entry.t) {                                // no entra en el top
                if (!topOnly) tx.set(col(b).doc(id), data);
                entered = false; newTop = top; return;
              }
              ev = low.id; delete top[ev];
            }
            tx.set(col(b).doc(id), data);
            top[id] = mine;
            tx.set(sumRef(b), { top, me: id, ev });
            newTop = top;
          });
          if (newTop) cacheSet('s:' + b, newTop);
          if (topOnly && !entered) { known[key] = entry.t; return; }
        }
        known[key] = entry.t;
        if (b.startsWith('g_')) known[b + ':*'] = Math.max(known[b + ':*'] || 0, entry.t);
        mem.delete('r:' + b); try { localStorage.removeItem('ps.rk.c.r:' + b); } catch (e) { /* nada */ }
        if (period && period !== 'p' && !better.includes(period)) better.push(period);
      } catch (e) { console.warn('[Ranking] no se pudo guardar en', b, e.code || e.message); }
    }));
    saveBests(known);
    return better;
  }

  function announce(better) {
    if (!better.length) return;
    const names = { d: 'de hoy', w: 'de la semana', m: 'del mes', a: 'histórico' };
    const best = PERIODS.map(p => p[0]).filter(p => better.includes(p)).pop();
    G.UI.toast('¡Nueva mejor marca ' + names[best] + ' en el ranking!', 3400);
  }

  /** Mejoras de ese Pokémon en la marca. null si la partida no las guardó. */
  function sheetOf(r) {
    if (!r || r.st == null) return null;
    return G.Upgrades.sheet(r.st);
  }

  async function submitSolo(r) {
    const fb = fbx();
    if (aside() || !fb || !G.Social.me || r.t < MIN_T) return [];
    const ids = periodIds();
    const entry = { t: r.t, uids: [fb.uid], names: [G.Social.me.name], dex: [r.dex], shiny: [!!r.shiny], lv: r.lv, kills: r.kills, st: [sheetOf(r)] };
    const boards = PERIODS.map(([p]) => ['s_' + ids[p], p]);
    boards.push(['s_all_p' + r.dex, 'p']);
    const better = await store(boards, fb.uid, entry);
    announce(better);
    return better;
  }

  // Oleada × 1e6. Si la superaste, suma el tiempo que te sobró (más rápido = más puntos).
  const WAVE = 1000000;
  function packWave(wave, cleared, time) {
    const w = Math.max(1, Math.min(200, Math.floor(wave) || 0));
    if (!cleared) return w * WAVE;
    const sec = Math.max(0, Math.min(WAVE - 1, Math.floor(time) || 0));
    return w * WAVE + (WAVE - 1 - sec);
  }
  function waveOf(t) { return t >= WAVE ? Math.floor(t / WAVE) : (t | 0); }
  function clearedOf(t) { return t >= WAVE && (t % WAVE) !== 0; }

  function towerLetter(mode) { return mode === 'hard' ? 'h' : mode === 'mad' ? 'm' : 'n'; }

  /** Tabla de una torre: s_tw150n_all en solitario, g_tw150n_all en grupo. */
  function towerBoard(id, mode, period, party) {
    return (party === 'g' ? 'g' : 's') + '_tw' + id + towerLetter(mode) + '_' + periodIds()[period];
  }

  /** Cada jugador sube su oleada en solitario. No pide el minuto mínimo de las runs. */
  async function submitTower(r) {
    const fb = fbx();
    if (aside() || !fb || !G.Social.me || !(r.wave > 0) || !r.id) return [];
    const entry = {
      t: packWave(r.wave, r.cleared, r.time),
      uids: [fb.uid], names: [G.Social.me.name], dex: [r.dex | 0], shiny: [!!r.shiny],
      lv: r.lv | 0, kills: r.kills | 0, st: [sheetOf(r)]
    };
    const ids = periodIds();
    const stem = 's_tw' + r.id + towerLetter(r.mode) + '_';
    const boards = PERIODS.map(([p]) => [stem + ids[p], p]);
    const better = await store(boards, fb.uid, entry);
    announce(better);
    return better;
  }

  /** La sube el anfitrión: el equipo, con la oleada de la torre. */
  async function submitTowerGroup(r) {
    const fb = fbx();
    if (partyHidden(r.members) || !fb || !(r.wave > 0) || !r.id || !r.members || r.members.length < 2) return [];
    const ms = r.members.slice().sort((a, b) => (a.uid < b.uid ? -1 : 1));
    if (!ms.some(m => m.uid === fb.uid)) return [];
    const entry = {
      t: packWave(r.wave, r.cleared, r.time),
      uids: ms.map(m => m.uid), names: ms.map(m => m.name), dex: ms.map(m => m.dex | 0),
      shiny: ms.map(m => !!m.shiny), lv: r.lv | 0, kills: r.kills | 0,
      st: ms.map(m => (m.st ? G.Upgrades.sheet(m.st) : null))
    };
    const ids = periodIds();
    const stem = 'g_tw' + r.id + towerLetter(r.mode) + '_';
    const boards = PERIODS.map(([p]) => [stem + ids[p], p]);
    const better = await store(boards, ms.map(m => m.uid).join('_'), entry);
    announce(better);
    return better;
  }

  /** La sube el anfitrión, con todo el equipo. */
  async function submitGroup(r) {
    const fb = fbx();
    if (partyHidden(r.members) || !fb || r.t < MIN_T || !r.members || r.members.length < 2) return [];
    const ms = r.members.slice().sort((a, b) => (a.uid < b.uid ? -1 : 1));
    const id = ms.map(m => m.uid).join('_');
    const entry = { t: r.t, uids: ms.map(m => m.uid), names: ms.map(m => m.name), dex: ms.map(m => m.dex),
                    shiny: ms.map(m => !!m.shiny), lv: r.lv, kills: r.kills,
                    st: ms.map(m => (m.st ? G.Upgrades.sheet(m.st) : null)) };
    const ids = periodIds();
    const boards = PERIODS.map(([p]) => ['g_' + ids[p], p]);
    for (const d of new Set(entry.dex)) boards.push(['g_all_p' + d, 'p']);
    const better = await store(boards, id, entry);
    announce(better);
    return better;
  }

  // ---------------- leer ----------------

  /** El top 50 de una tabla (1 lectura, o 0 si se leyó hace menos de 30 min). */
  const inflight = new Map();             // tabla -> lectura en curso (la lista y tu puesto la comparten)
  async function summary(b) {
    const c = cacheGet('s:' + b);
    if (c !== undefined) return c;
    if (!inflight.has(b)) {
      inflight.set(b, sumRef(b).get().then(s => {
        const top = s.exists ? (s.data().top || {}) : {};
        cacheSet('s:' + b, top);
        return top;
      }).finally(() => inflight.delete(b)));
    }
    return inflight.get(b);
  }

  /**
   * Mejores marcas de una tabla.
   * @param friendsOnly  sólo tú y tus amigos
   */
  async function top(mode, period, dex, friendsOnly, tower) {
    const fb = fbx();
    if (!fb) return [];
    const party = tower && tower.party === 'g' ? 'g' : 's';
    const b = mode === 'tw' && tower ? towerBoard(tower.id, tower.mode, period, party) : board(mode, period, dex);
    const solo = mode === 'tw' ? party !== 'g' : mode !== 'g';
    const rows = hide(sorted(await summary(b)));
    if (!friendsOnly) return rows.slice(0, TOP);
    const circle = [fb.uid, ...G.Social.friends.filter(f => f.status === 'ok').map(f => f.uid)].slice(0, 30);
    const inTop = rows.filter(r => r.uids.some(u => circle.includes(u)));
    // En diario, semanal, mensual y por Pokémon no hay marcas fuera del top 50.
    if (TOP_ONLY.has(period) || (dex && mode !== 'tw')) return inTop;
    // Los amigos que no están en el top 50: se buscan aparte (y se guardan 30 min).
    const ck = 'f:' + b + ':' + circle.slice().sort().join(',');
    let extra = cacheGet(ck);
    if (extra === undefined) {
      if (solo) {
        const missing = circle.filter(u => !inTop.some(r => r.id === u));
        const docs = await Promise.all(missing.map(u => col(b).doc(u).get().catch(() => null)));
        extra = docs.filter(d => d && d.exists).map(d => rowOf(d.id, d.data()));
      } else {
        extra = [];
        for (let i = 0; i < circle.length; i += 10) {
          const s = await col(b).where('uids', 'array-contains-any', circle.slice(i, i + 10)).get();
          extra.push(...s.docs.map(d => rowOf(d.id, d.data())));
        }
      }
      cacheSet(ck, extra);
    }
    const all = new Map();
    for (const r of hide([...inTop, ...extra])) all.set(r.id, r);
    return [...all.values()].sort((a, c) => c.t - a.t).slice(0, TOP);
  }

  /** Tu puesto en la tabla (aunque no salgas en el top). → { pos, t, row } | null */
  async function myRank(mode, period, dex, tower) {
    const fb = fbx();
    if (!fb || aside()) return null;
    const party = tower && tower.party === 'g' ? 'g' : 's';
    const b = mode === 'tw' && tower ? towerBoard(tower.id, tower.mode, period, party) : board(mode, period, dex);
    const solo = mode === 'tw' ? party !== 'g' : mode !== 'g';
    // ¿Estás en el top 50? Entonces el puesto sale del resumen, sin gastar nada.
    const rows = hide(sorted(await summary(b)));
    const i = rows.findIndex(r => r.uids.includes(fb.uid));
    if (i >= 0) return { pos: i + 1, t: rows[i].t, row: rows[i] };
    if (TOP_ONLY.has(period) || (dex && mode !== 'tw')) return { out: true };
    const ck = 'r:' + b;
    const c = cacheGet(ck);
    if (c !== undefined) return c;
    // Si este navegador ya sabe que no tienes marca en esta tabla, no se mira.
    const kb = bests(), mk = b + ':' + (solo ? fb.uid : '*');
    if (kb[mk] === 0) { cacheSet(ck, null); return null; }
    let mine = null;
    if (solo) {
      const d = await col(b).doc(fb.uid).get();
      if (d.exists) mine = rowOf(d.id, d.data());
    } else {
      const s = await col(b).where('uids', 'array-contains', fb.uid).get();
      for (const d of s.docs) { const r = rowOf(d.id, d.data()); if (!mine || r.t > mine.t) mine = r; }
    }
    kb[mk] = mine ? mine.t : 0;
    saveBests(kb);
    let res = null;
    if (mine) res = { pos: (await countAbove(b, mine.t)) + 1, t: mine.t, row: mine };
    cacheSet(ck, res);
    return res;
  }

  /**
   * Cuántas entradas tienen más tiempo. La versión "compat" del SDK no trae
   * count(), así que se usa la API REST de agregación (1 lectura por cada
   * 1.000 entradas, en vez de leerlas todas). Sólo se usa si no estás en el top 50.
   */
  async function countAbove(b, t) {
    const fb = fbx();
    const cfg = G.FIREBASE_CONFIG;
    const base = fb.emulator ? 'http://127.0.0.1:8080/v1' : 'https://firestore.googleapis.com/v1';
    const url = `${base}/projects/${cfg.projectId}/databases/(default)/documents/lb/${encodeURIComponent(b)}:runAggregationQuery`;
    const token = await fb.auth.currentUser.getIdToken();
    const body = { structuredAggregationQuery: {
      structuredQuery: { from: [{ collectionId: 'e' }],
        where: { fieldFilter: { field: { fieldPath: 't' }, op: 'GREATER_THAN', value: { integerValue: String(t) } } } },
      aggregations: [{ alias: 'n', count: {} }] } };
    try {
      const r = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      const n = j && j[0] && j[0].result && j[0].result.aggregateFields && j[0].result.aggregateFields.n;
      return n ? +n.integerValue : 0;
    } catch (e) {
      console.warn('[Ranking] puesto:', e.message);
      return 0;
    }
  }

  // ---------------- oro y tickets (top 50 de lo que tienes ahora) ----------------
  // Un documento por tabla (lbs/gold, lbs/tickets). Sólo se escribe si entras,
  // si ya estabas y la cifra cambió, o si te quedas en 0 y sales.

  function wallet() {
    const s = (G.DB && G.DB.save) || {};
    const t = s.tickets || {};
    const n = k => Math.max(0, Math.floor(Number(t[k]) || 0));
    const t1 = n('t1'), t10 = n('t10'), tb = n('tb'), tg = n('tg');
    return { coins: Math.max(0, Math.floor(Number(s.coins) || 0)), t1, t10, tb, tg, tickets: t1 + t10 + tb + tg };
  }

  function wealthRow(kind, w) {
    const s = G.DB.save;
    const dex = s.partner | 0;
    const tickets = kind === 'tickets';
    return {
      n: tickets ? w.tickets : w.coins,
      name: G.Social.me.name,
      dex, shiny: !!(s.partnerShiny && G.DB.ownsShiny(dex)),
      t1: tickets ? w.t1 : 0, t10: tickets ? w.t10 : 0, tb: tickets ? w.tb : 0, tg: tickets ? w.tg : 0
    };
  }

  function sameWealth(a, b) {
    return a && b && a.n === b.n && a.name === b.name && (a.dex | 0) === (b.dex | 0) && !!a.shiny === !!b.shiny
      && (a.t1 | 0) === b.t1 && (a.t10 | 0) === b.t10 && (a.tb | 0) === b.tb && (a.tg | 0) === b.tg;
  }

  /** ¿Hay que tocar la tabla? Con la copia en memoria no gasta lecturas. */
  function needsWealth(top, uid, row) {
    const mine = top[uid];
    if (mine && sameWealth(mine, row)) return false;
    if (mine) return true;
    if (row.n <= 0) return false;
    const ids = Object.keys(top);
    if (ids.length < TOP) return true;
    let min = Infinity;
    for (const k of ids) if (top[k].n < min) min = top[k].n;
    return row.n > min;
  }

  /** Las filas del top, de más a menos. 1 lectura, o 0 si se miró hace menos de 30 min. */
  async function wealthTop(kind) {
    const board = kind === 'tickets' ? 'tickets' : 'gold';
    const top = await summary(board);
    return Object.entries(top).map(([id, v]) => ({ id, n: v.n | 0, name: v.name || '', dex: v.dex | 0, shiny: !!v.shiny, t1: v.t1 | 0, t10: v.t10 | 0, tb: v.tb | 0, tg: v.tg | 0 }))
      .filter(r => !hiddenName(r.name))
      .sort((a, b) => b.n - a.n || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }

  async function syncWealth(kind, row) {
    const fb = fbx();
    const board = kind === 'tickets' ? 'tickets' : 'gold';
    const uid = fb.uid;
    const known = await summary(board);
    if (!needsWealth(known, uid, row)) return;
    const next = await fb.fs.runTransaction(async tx => {
      const snap = await tx.get(sumRef(board));
      const top = Object.assign({}, snap.exists ? (snap.data().top || {}) : {});
      if (row.n <= 0) {
        if (!top[uid]) return top;
        delete top[uid];
        tx.set(sumRef(board), { top, me: '', ev: uid });
        return top;
      }
      if (sameWealth(top[uid], row)) return top;
      let ev = '';
      if (!top[uid]) {
        const ids = Object.keys(top);
        if (ids.length >= TOP) {
          let low = ids[0];
          for (const k of ids) if (top[k].n < top[low].n) low = k;
          if (row.n <= top[low].n) return top;
          ev = low;
          delete top[low];
        }
      }
      top[uid] = row;
      tx.set(sumRef(board), { top, me: uid, ev });
      return top;
    });
    cacheSet('s:' + board, next);
  }

  let purseBusy = null;
  /** Sube tu oro y tus tickets al top 50 si la cifra cambia el puesto. */
  function touchPurse() {
    const fb = fbx();
    if (aside() || !fb || !G.Social.me || !G.DB.save) return Promise.resolve();
    if (purseBusy) return purseBusy;
    const w = wallet();
    purseBusy = (async () => {
      await syncWealth('gold', wealthRow('gold', w));
      await syncWealth('tickets', wealthRow('tickets', w));
    })().catch(e => { console.warn('[Ranking] oro/tickets:', e.code || e.message); }).finally(() => {
      purseBusy = null;
      const now = wallet();
      if (now.coins !== w.coins || now.tickets !== w.tickets) touchPurse();
    });
    return purseBusy;
  }

  /**
   * Cuenta de prueba: borra sus marcas (la ficha y la fila del top) la primera
   * vez que entra en este navegador. Las reglas impiden volver a escribirlas.
   */
  function quiet() {
    const fb = fbx();
    if (!aside() || !fb) return Promise.resolve();
    const flag = 'ps.rk.aside.' + fb.uid;
    try { if (localStorage.getItem(flag) === '1') return Promise.resolve(); } catch (e) { /* nada */ }
    if (quiet.busy) return quiet.busy;
    quiet.busy = (async () => {
      const snap = await fb.fs.collectionGroup('e').where('uids', 'array-contains', fb.uid).get();
      for (const d of snap.docs) {
        const board = d.ref.parent.parent.id;
        await fb.fs.runTransaction(async tx => {
          const s = await tx.get(sumRef(board));
          const e = await tx.get(d.ref);
          if (s.exists) {
            const top = Object.assign({}, s.data().top || {});
            if (top[d.id] && (top[d.id].uids || []).includes(fb.uid)) {
              delete top[d.id];
              tx.set(sumRef(board), { top, me: '', ev: d.id });
            }
          }
          if (e.exists && (e.data().uids || []).includes(fb.uid)) tx.delete(d.ref);
        });
      }
      await Promise.all(['gold', 'tickets'].map(b => fb.fs.runTransaction(async tx => {
        const s = await tx.get(sumRef(b));
        if (!s.exists) return;
        const top = Object.assign({}, s.data().top || {});
        if (!top[fb.uid]) return;
        delete top[fb.uid];
        tx.set(sumRef(b), { top, me: '', ev: fb.uid });
      })));
      try { localStorage.setItem(flag, '1'); localStorage.removeItem(bestKey()); } catch (e) { /* nada */ }
      G.UI.toast('Esta cuenta no entra en el ranking', 3200);
    })().catch(e => {
      quiet.busy = null;
      console.warn('[Ranking] cuenta de prueba:', e.code || e.message);
    });
    return quiet.busy;
  }

  /** Al borrar la cuenta: quita tus filas de los resúmenes que conoce este navegador. */
  async function removeMine() {
    const fb = fbx();
    if (!fb) return;
    const ids = periodIds();
    const boards = new Set();
    for (const m of ['s', 'g']) for (const [p] of PERIODS) boards.add(m + '_' + ids[p]);
    for (const k of Object.keys(bests())) boards.add(k.split(':')[0]);
    await Promise.all([...boards].map(b => fb.fs.runTransaction(async tx => {
      const s = await tx.get(sumRef(b));
      if (!s.exists) return;
      const top = s.data().top || {};
      for (const [id, v] of Object.entries(top)) {
        if (!(v.uids || []).includes(fb.uid)) continue;
        // Una fila por escritura (las reglas sólo dejan quitar una cada vez).
        const next = Object.assign({}, top); delete next[id];
        tx.set(sumRef(b), { top: next, me: '', ev: id });
        return;
      }
    }).catch(() => {})));
    await Promise.all(['gold', 'tickets'].map(b => fb.fs.runTransaction(async tx => {
      const s = await tx.get(sumRef(b));
      if (!s.exists) return;
      const top = Object.assign({}, s.data().top || {});
      if (!top[fb.uid]) return;
      delete top[fb.uid];
      tx.set(sumRef(b), { top, me: '', ev: fb.uid });
    }).catch(() => {})));
    try { localStorage.removeItem(bestKey()); } catch (e) { /* nada */ }
  }

  return { PERIODS, periodIds, board, submitSolo, submitGroup, submitTower, submitTowerGroup, waveOf, clearedOf, top, myRank, removeMine, quiet, wealthTop, touchPurse, wallet };
})();
