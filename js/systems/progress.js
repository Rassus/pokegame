/* ============ progress.js — misiones del pase, logros y estadísticas ============
 * El juego avisa de lo que pasa con G.Progress.event(tipo, datos).
 * Las misiones diarias, semanales y del mes viven en el pase (systems/pass.js):
 * se completan solas y dan puntos. Aquí siguen los logros y las regiones.
 *
 *   kill      { types, boss, legend, shiny, dex }
 *   chest     cofre con candado abierto
 *   item      { id }        objeto equipado
 *   evolve    { move }      movimiento evolucionado
 *   rift      { type, dex } pelea de grieta ganada
 *   runEnd    { time, level, coins, types, group, dex, kills, bosses, tower, gain }
 *
 * y esto actualiza en la partida guardada:
 *   stats.bossesTotal · riftWins · evolutions · missionsDone · groupRuns
 *   legends{dex} · arenas{tipo} · itemsFound{id} · evoMoves{id} · ach{id} · achRank{id}
 *   pass      el pase del mes (systems/pass.js)
 */
G.Progress = (() => {
  const TYPES = Object.keys(G.U.TYPE_NAME);
  let achT = 0, toastQ = [], toastT = 0;

  // ---------------- misiones ----------------

  function rng(seedStr) {
    let h = 2166136261;
    for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  function make(def, r) {
    const goal = def.goals[Math.floor(r() * def.goals.length)];
    const param = def.param === 'type' ? TYPES[Math.floor(r() * TYPES.length)] : null;
    return { id: def.id, goal, param, prog: 0, claimed: false, told: false };
  }

  function pickSet(defs, n, r, avoid = []) {
    const pool = defs.filter(d => !avoid.includes(d.id));
    const out = [];
    while (out.length < n && pool.length) out.push(make(pool.splice(Math.floor(r() * pool.length), 1)[0], r));
    return out;
  }

  /** Crea las misiones del día / semana si han cambiado. */
  function ensure(s) {
    if (!s) return;
    const ids = G.Ranking.periodIds();
    s.missions = s.missions || {};
    const M = s.missions;
    // Las diarias y semanales de antes las sustituye el pase.
    M.day = ids.d;
    M.week = ids.w;
    M.daily = [];
    M.weekly = [];
    if (s.region == null) s.region = 1;
    if (s.regionProg == null) s.regionProg = 0;
    s.achRank = s.achRank || {};
    if (G.Pass) G.Pass.ensure(s);
  }

  /** Cuánto llevas de un requisito de región (se lee de la cuenta). */
  function reqValue(s, req) {
    const st = s.stats || {};
    switch (req.kind) {
      case 'own': return G.DEX.filter(p => p.gen === req.gen && s.owned && s.owned[p.dex]).length;
      case 'kills': return st.totalKills || 0;
      case 'minutes': return Math.floor((st.bestTime || 0) / 60);
      case 'rift': return st.riftWins || 0;
      case 'bosses': return st.bossesTotal || 0;
      case 'towers':
        return (G.Towers ? G.Towers.LIST : []).filter(t => t.dexes.some(d => s.legends && s.legends[d])).length;
      case 'floor': return st.towerBest || 0;
      case 'clear': return st.towerClears || 0;
      case 'clears': return Object.keys(s.tower100 || {}).filter(id => s.tower100[id] > 0).length;
      case 'shiny': return Object.keys(s.shiny || {}).length;
      case 'pay':
        if (req.coins) return s.coins || 0;
        if (req.t1) return (s.tickets && s.tickets.t1) || 0;
        if (req.t10) return (s.tickets && s.tickets.t10) || 0;
        if (req.tb) return (s.tickets && s.tickets.tb) || 0;
        if (req.tg) return (s.tickets && s.tickets.tg) || 0;
        return 0;
      default: return 0;
    }
  }

  function regionState(s) {
    const def = (G.RegionMissions || []).find(m => m.gen === (s.region || 1) + 1);
    if (!def) return null;
    const rows = (def.reqs || []).map(req => {
      const v = reqValue(s, req);
      return { req, v, met: v >= req.goal };
    });
    return { def, rows, done: rows.length > 0 && rows.every(r => r.met) };
  }

  /** Avisa una vez cuando la lista de la región siguiente está completa. */
  function noteRegion(s) {
    const q = regionState(s);
    if (!q) return;
    if (!q.done) {
      if (s.regionTold) { s.regionTold = false; G.DB.commit(); }
      return;
    }
    if (s.regionTold) return;
    s.regionTold = true;
    notify('Misión completada: ' + q.def.name, 'Ábrela en Región');
    G.DB.commit();
  }

  /** Misión que abre la región siguiente, o null si ya están las 9. */
  function regionMission() {
    const s = G.DB.save;
    if (!s) return null;
    ensure(s);
    noteRegion(s);
    return regionState(s);
  }

  function payOk(s, req) {
    if (req.kind !== 'pay') return true;
    const t = s.tickets || {};
    if (req.coins) return (s.coins || 0) >= req.coins;
    if (req.t1) return (t.t1 || 0) >= req.t1;
    if (req.t10) return (t.t10 || 0) >= req.t10;
    if (req.tb) return (t.tb || 0) >= req.tb;
    if (req.tg) return (t.tg || 0) >= req.tg;
    return true;
  }

  /** Cobra lo que pide la ficha y abre la región. */
  function claimRegion() {
    const s = G.DB.save;
    if (!s) return null;
    const q = regionState(s);
    if (!q || !q.done) return null;
    if (q.rows.some(r => !payOk(s, r.req))) return null;
    s.tickets = Object.assign({ t1: 0, t10: 0, tb: 0, tg: 0 }, s.tickets);
    for (const r of q.rows) {
      const req = r.req;
      if (req.kind !== 'pay') continue;
      if (req.coins) s.coins -= req.coins;
      if (req.t1) s.tickets.t1 -= req.t1;
      if (req.t10) s.tickets.t10 -= req.t10;
      if (req.tb) s.tickets.tb -= req.tb;
      if (req.tg) s.tickets.tg -= req.tg;
      if (G.Pass) {
        if (req.coins) G.Pass.goldSpend(req.coins);
        G.Pass.ticketsSpent({ t1: req.t1 || 0, t10: req.t10 || 0, tb: req.tb || 0, tg: req.tg || 0 });
      }
    }
    s.region = q.def.gen;
    s.regionProg = 0;
    s.regionTold = false;
    s.stats.missionsDone = (s.stats.missionsDone || 0) + 1;
    G.DB.commit();
    if (G.UI && G.UI.refreshCoins && !document.getElementById('topbar').classList.contains('hidden')) G.UI.refreshCoins();
    noteRegion(s);
    return q.def;
  }

  function text(m) { return G.MissionDefs.BY[m.id].text(m.goal, m.param); }
  function done(m) { return m.prog >= m.goal; }

  function advance(list, kind, d) {
    for (const m of list || []) {
      if (m.claimed || done(m)) continue;
      const def = G.MissionDefs.BY[m.id];
      if (!def || def.ev !== kind) continue;
      if (def.match && !def.match(d, m.param)) continue;
      const v = def.value ? def.value(d) : 1;
      m.prog = def.mode === 'max' ? Math.max(m.prog, v) : m.prog + v;
      if (done(m) && !m.told) {
        m.told = true;
        notify('Misión completada: ' + text(m), 'Recoge el premio en Misiones');
      }
    }
  }

  /** Recoge el premio de una misión terminada. */
  function claim(m, weekly = false) {
    const s = G.DB.save;
    if (!s || m.claimed || !done(m)) return false;
    m.claimed = true;
    grant(G.MissionDefs.BY[m.id].reward);
    s.stats.missionsDone = (s.stats.missionsDone || 0) + 1;
    event('missionDone', { daily: !weekly });
    G.DB.commit();
    return true;
  }

  /** Cambia una diaria sin terminar por otra (una vez al día). */
  function reroll(i) {
    const s = G.DB.save;
    ensure(s);
    const M = s.missions;
    const m = M.daily[i];
    if (!m || M.rerolled || m.claimed) return false;
    const r = rng(M.day + 'cambio' + Date.now());
    const [n] = pickSet(G.MissionDefs.daily, 1, r, M.daily.map(x => x.id));
    if (!n) return false;
    M.daily[i] = n;
    M.rerolled = true;
    G.DB.commit();
    return true;
  }

  function grant(r) {
    const s = G.DB.save;
    if (!r) return;
    s.tickets = s.tickets || { t1: 0, t10: 0 };
    if (r.coins) s.coins += r.coins;
    if (r.t1) s.tickets.t1 += r.t1;
    if (r.t10) s.tickets.t10 += r.t10;
    if (r.tg) s.tickets.tg = (s.tickets.tg || 0) + r.tg;
    const got = (r.t1 || 0) + (r.t10 || 0) + (r.tg || 0);
    if (got) {
      s.stats = s.stats || {};
      s.stats.ticketsGot = (s.stats.ticketsGot || 0) + got;
    }
    if (G.Pass) {
      if (r.coins) G.Pass.goldEarn(r.coins);
      if (got) G.Pass.ticketsEarn({ t1: r.t1 || 0, t10: r.t10 || 0, tb: 0, tg: r.tg || 0 });
    }
    if (G.UI && G.UI.refreshCoins && !document.getElementById('topbar').classList.contains('hidden')) G.UI.refreshCoins();
  }

  function rewardText(r) {
    const p = [];
    if (r.tg) p.push(G.Icons.html('ticketg', 12) + ' ' + r.tg);
    if (r.t10) p.push(G.Icons.html('ticket10', 12) + ' ' + r.t10 + ' ×10');
    if (r.t1) p.push(G.Icons.html('ticket', 12) + ' ' + r.t1);
    if (r.coins) p.push('<span class="coin"></span> ' + G.U.num(r.coins));
    return p.join(' &nbsp;');
  }

  // ---------------- eventos ----------------

  function event(kind, d = {}) {
    const s = G.DB.save;
    if (!s) return;
    ensure(s);
    const S = s.stats;
    switch (kind) {
      case 'kill':
        if (d.boss) S.bossesTotal = (S.bossesTotal || 0) + 1;
        if (d.shiny) {
          if (d.boss) S.shinyBosses = (S.shinyBosses || 0) + 1;
          else S.shinyKills = (S.shinyKills || 0) + 1;
        }
        if (d.legend) { s.legends = s.legends || {}; if (!s.legends[d.legend]) s.legends[d.legend] = Date.now(); }
        break;
      case 'rift':
        S.riftWins = (S.riftWins || 0) + 1;
        if (d.type) { s.arenas = s.arenas || {}; s.arenas[d.type] = s.arenas[d.type] || Date.now(); }
        break;
      case 'evolve':
        S.evolutions = (S.evolutions || 0) + 1;
        s.evoMoves = s.evoMoves || {}; s.evoMoves[d.move] = s.evoMoves[d.move] || Date.now();
        break;
      case 'item':
        s.itemsFound = s.itemsFound || {}; s.itemsFound[d.id] = s.itemsFound[d.id] || Date.now();
        break;
      case 'runEnd':
        if (d.group) S.groupRuns = (S.groupRuns || 0) + 1;
        break;
    }
    advance(s.missions.daily, kind, d);
    advance(s.missions.weekly, kind, d);
    if (G.Pass) G.Pass.onEvent(kind, d);
    noteRegion(s);
    // Los logros se miran como mucho una vez por segundo (hay cientos de bajas).
    if (kind !== 'kill' || d.boss || d.legend || d.shiny) checkAch();
    else if (performance.now() - achT > 1000) checkAch();
  }

  /** Un enemigo ha caído (anfitrión, solitario o copia en el invitado). */
  function kill(e) {
    const legend = e.legend || (G.Rift.inArena && e.boss) ? e.dex : 0;
    event('kill', { types: e.types || [], boss: !!e.boss, legend, shiny: !!e.shiny, dex: e.dex || 0 });
  }

  // ---------------- logros ----------------

  function checkAch() {
    const s = G.DB.save;
    if (!s) return;
    achT = performance.now();
    s.ach = s.ach || {};
    s.achRank = s.achRank || {};
    let guard = 0, again = true;
    while (again && guard++ < 8) {
      again = false;
      for (const a of G.AchDefs.LIST) {
        if (a.steps) {
          let rank = s.achRank[a.id] || 0;
          if (rank >= a.steps.length) continue;
          const v = a.value(s);
          const from = rank;
          while (rank < a.steps.length && v >= a.steps[rank]) {
            grant(a.rewards[rank]);
            rank++;
          }
          if (rank === from) continue;
          s.achRank[a.id] = rank;
          const last = rank >= a.steps.length;
          if (last) s.ach[a.id] = Date.now();
          notify('¡Logro: ' + a.name + '!', last && a.title ? 'Nuevo título: ' + a.title : '', a);
          again = true;
        } else {
          if (s.ach[a.id]) continue;
          if (a.value(s) < a.goal) continue;
          s.ach[a.id] = Date.now();
          grant(a.reward);
          notify('¡Logro: ' + a.name + '!', a.title ? 'Nuevo título: ' + a.title : '', a);
          again = true;
        }
      }
    }
  }

  /** Títulos que tienes (de los logros conseguidos). */
  function titles() {
    const s = G.DB.save;
    return G.AchDefs.LIST.filter(a => a.title && s && s.ach && s.ach[a.id]).map(a => a.title);
  }

  /** Premios de misiones por recoger (para el aviso del menú). */
  function pending() {
    const s = G.DB.save;
    if (!s) return 0;
    ensure(s);
    const q = regionMission();
    const passN = G.Pass ? G.Pass.ready() : 0;
    return passN + (q && q.done ? 1 : 0);
  }

  // ---------------- avisos ----------------

  function notify(title, sub, ach) {
    toastQ.push({ title, sub, ach });
    if (toastQ.length === 1) showNext();
  }

  function showNext() {
    const n = toastQ[0];
    if (!n) return;
    let el = document.getElementById('ach-pop');
    if (!el) { el = document.createElement('div'); el.id = 'ach-pop'; el.className = 'box ach-pop'; document.body.appendChild(el); }
    const icon = n.ach ? (n.ach.dex ? '' : G.Icons.html('medal' + n.ach.tier, 24)) : G.Icons.html('medal2', 24);
    el.innerHTML = `${icon}<div><b>${n.title}</b>${n.sub ? `<small>${n.sub}</small>` : ''}</div>`;
    if (n.ach && n.ach.dex) el.prepend(G.UI.spriteCanvas(n.ach.dex, 48, 40, { scale: 1 }));
    el.classList.remove('hidden');
    G.Audio.sfx(n.ach ? 'legend' : 'confirm');
    clearTimeout(toastT);
    toastT = setTimeout(() => {
      el.classList.add('hidden');
      toastQ.shift();
      setTimeout(showNext, 250);
    }, 2800);
  }

  return { ensure, event, kill, claim, claimRegion, regionMission, region: () => (G.DB.save && G.DB.save.region) || 1,
           reroll, checkAch, titles, pending, text, done, rewardText, grant };
})();
