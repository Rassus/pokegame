/* ============ pass.js — pase mensual ============
 * Contadores desde que empieza el mes. Las misiones de días anteriores
 * siguen abiertas y una acción suma en todas las que coinciden.
 * Al cambiar de mes se guardan los premios no recogidos, y puntos,
 * misiones y pista vuelven a cero con el número de pase siguiente.
 */
G.Pass = (() => {
  const D = () => G.PassData;
  let bag = null;
  let towerGroup = false;

  function rng(seedStr) {
    let h = 2166136261;
    for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => {
      h += 0x6D2B79F5;
      let t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (r, list) => list[Math.floor(r() * list.length)];

  function band(kind, r, limit) {
    const values = D().BANDS[kind];
    const w = D().WEIGHTS;
    const n = limit || w.length;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += w[i];
    let x = r() * sum;
    for (let i = 0; i < n; i++) { x -= w[i]; if (x < 0) return values[i]; }
    return values[0];
  }

  /** Cada cuenta tiene su propia tirada. Sin uid, se guarda una semilla en la partida. */
  function who(s) {
    const uid = (G.DB && G.DB.fb && G.DB.fb.uid) || (G.Social && G.Social.uid) || '';
    if (uid) return uid;
    if (!s.passSalt) s.passSalt = String(s.created || Date.now()) + '-' + Math.floor(Math.random() * 1e9);
    return s.passSalt;
  }

  function rollTrack(n, salt) {
    const r = rng('pase-pista-' + n + (salt ? ':' + salt : ''));
    return D().layout().map(row => {
      const o = { kind: row.kind };
      if (row.rarity) o.rarity = row.rarity;
      if (D().BANDS[row.kind]) o.n = band(row.kind, r);
      return o;
    });
  }

  function rewardSame(a, b) {
    return !!a && !!b && a.kind === b.kind && (a.n || 0) === (b.n || 0) && (a.rarity || 0) === (b.rarity || 0);
  }

  function trackSame(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!rewardSame(a[i], b[i])) return false;
    return true;
  }

  /**
   * La primera versión sorteaba el oro y los tickets con una semilla igual
   * para todos. Si esta pista sigue siendo esa, los premios sin recoger
   * pasan a la tirada de este jugador. Lo ya recogido se queda.
   */
  function personalize(s, Q) {
    const salt = who(s);
    if (Q.own === salt) return false;
    if (Q.track && trackSame(Q.track, rollTrack(Q.n || 1, ''))) {
      const mine = rollTrack(Q.n || 1, salt);
      for (let i = 0; i < mine.length; i++) {
        if (Q.claimed && Q.claimed[i + 1]) continue;
        Q.track[i] = mine[i];
      }
    }
    for (let i = 0; i < (Q.post || []).length; i++) {
      const post = Q.post[i];
      if (!post || post.claimed) continue;
      const shared = rollPost(rng('pase-extra-' + Q.n + '-' + Q.month + '-' + i));
      if (!rewardSame(post.reward, shared)) continue;
      post.reward = rollPost(rng('pase-extra-' + Q.n + '-' + Q.month + '-' + i + ':' + salt));
    }
    Q.own = salt;
    return true;
  }

  function fresh(month, n, bank, salt) {
    return {
      n, month, pts: 0, fold: false, claimed: {}, own: salt || '',
      track: rollTrack(n, salt), post: [], bank: bank || [],
      stats: {}, best: {},
      days: {}, weeks: {}, monthM: []
    };
  }

  function blank(s) {
    const ids = G.Ranking.periodIds();
    s.pass = fresh(ids.m, 1, [], who(s));
  }

  function allM(P) {
    const out = P.monthM ? P.monthM.slice() : [];
    for (const k in P.weeks || {}) out.push(...P.weeks[k]);
    for (const k in P.days || {}) out.push(...P.days[k]);
    return out;
  }

  function valueOf(m, P) {
    if (!P) {
      const s = G.DB && G.DB.save;
      P = s && s.pass;
    }
    if (!m || !P) return 0;
    const bucket = m.max ? P.best : P.stats;
    return (bucket && bucket[m.key]) || 0;
  }

  function toast(msg) {
    if (G.UI && G.UI.toast) G.UI.toast(msg);
  }

  function scan(s, quiet) {
    const P = s.pass;
    if (!P) return 0;
    let gained = 0, n = 0, last = '';
    for (const m of allM(P)) {
      if (m.awarded) continue;
      if (valueOf(m, P) < m.goal) continue;
      m.awarded = true;
      const pts = D().points(m.tier);
      P.pts += pts;
      gained += pts;
      n++;
      last = D().text(m);
      s.stats = s.stats || {};
      s.stats.missionsDone = (s.stats.missionsDone || 0) + 1;
    }
    if (gained) {
      ensurePost(s);
      if (!quiet) toast(n === 1 ? 'Pase +' + gained + ' · ' + last : 'Pase +' + gained + ' puntos');
      if (G.PassUI) G.PassUI.refresh();
    }
    return gained;
  }

  function ensurePost(s) {
    const P = s.pass;
    if (!P) return;
    const extra = Math.floor(Math.max(0, P.pts - 1000) / 10);
    P.post = P.post || [];
    const salt = P.own || who(s);
    while (P.post.length < extra) {
      const r = rng('pase-extra-' + P.n + '-' + P.month + '-' + P.post.length + (salt ? ':' + salt : ''));
      P.post.push({ reward: rollPost(r), claimed: false });
    }
  }

  function rollPost(r) {
    const x = r() * 100;
    if (x < 35) return { kind: 'gold', n: band('gold', r, 3) };
    if (x < 70) return { kind: 't1', n: band('t1', r, 3) };
    if (x < 80) return { kind: 't10', n: band('t10', r, 3) };
    const rarity = bandRarity(r);
    return { kind: 'frags', rarity, n: 20 };
  }

  function bandRarity(r) {
    const w = D().WEIGHTS;
    let x = r() * 100;
    for (let i = 0; i < w.length; i++) { x -= w[i]; if (x < 0) return i + 1; }
    return 1;
  }

  function bump(s, key, n, max) {
    const P = s.pass;
    if (!P || !n) return;
    const bucket = max ? (P.best || (P.best = {})) : (P.stats || (P.stats = {}));
    if (max) bucket[key] = Math.max(bucket[key] || 0, n);
    else bucket[key] = (bucket[key] || 0) + n;
  }

  // ---------------- quién puede salir en una misión ----------------

  function regionOf(s) { return s.region || 1; }

  function owned(s) {
    const out = [];
    for (const d in s.owned || {}) {
      const p = G.DEX_BY[d];
      if (p && G.SPRITE_META[p.dex]) out.push(p);
    }
    return out;
  }

  function inRegion(s, pred) {
    const g = regionOf(s);
    return G.DEX.filter(p => (p.gen || 1) <= g && G.SPRITE_META[p.dex] && pred(p));
  }

  function towersOf(s) {
    return (G.Towers ? G.Towers.LIST : []).filter(t => t.dexes.some(d => s.legends && s.legends[d]));
  }

  function linesOf(s) {
    const seen = new Set();
    const out = [];
    for (const p of inRegion(s, () => true)) {
      const root = G.Evo ? G.Evo.root(p.dex) : p.dex;
      if (seen.has(root)) continue;
      seen.add(root);
      out.push(root);
    }
    return out;
  }

  function can(s, k) {
    if (k.fam === 'torre' && !towersOf(s).length) return false;
    if (!k.param) return true;
    if (k.param === 'type' || k.param === 'ticket' || k.param === 'altar') return true;
    if (k.param === 'dex') return owned(s).length > 0;
    if (k.param === 'gachaDex' || k.param === 'line') return inRegion(s, () => true).length > 0;
    if (k.param === 'riftBoss') return inRegion(s, p => p.leg || p.rarity === 5).length > 0;
    if (k.param === 'boss') return inRegion(s, p => !p.leg && p.rarity < 5).length > 0;
    if (k.param === 'tower') return towersOf(s).length > 0;
    return true;
  }

  function rollParam(s, r, k) {
    if (!k.param) return '';
    if (k.param === 'type') return pick(r, Object.keys(G.U.TYPE_NAME));
    if (k.param === 'ticket') return pick(r, ['any', 't1', 't10', 'tb', 'tg']);
    if (k.param === 'altar') return pick(r, ['dmg', 'spd', 'mag', 'cd']);
    if (k.param === 'dex') return pick(r, owned(s)).dex;
    if (k.param === 'gachaDex') return pick(r, inRegion(s, () => true)).dex;
    if (k.param === 'line') return pick(r, linesOf(s));
    if (k.param === 'riftBoss') return pick(r, inRegion(s, p => p.leg || p.rarity === 5)).dex;
    if (k.param === 'boss') return pick(r, inRegion(s, p => !p.leg && p.rarity < 5)).dex;
    if (k.param === 'tower') return +pick(r, towersOf(s)).id;
    return '';
  }

  function statKey(id, param) {
    switch (id) {
      case 'goldSpend': return 'goldSpend';
      case 'goldEarn': return 'goldEarn';
      case 'goldRun': return 'goldRun';
      case 'kills': return 'kills';
      case 'runKillDex': return 'killD.' + param;
      case 'runKillType': return 'killT.' + param;
      case 'minutes': return 'min';
      case 'runMinDex': return 'minD.' + param;
      case 'runMinType': return 'minT.' + param;
      case 'tickE': return 'tickE.' + (param || 'any');
      case 'tickS': return 'tickS.' + (param || 'any');
      case 'rift': return 'rift';
      case 'riftRun': return 'riftRun';
      case 'riftBoss': return 'riftB.' + param;
      case 'boss': return 'boss';
      case 'bossRun': return 'bossRun';
      case 'bossOne': return 'bossD.' + param;
      case 'runs': return 'runs';
      case 'item': return 'item';
      case 'itemRun': return 'itemRun';
      case 'gachaDex': return 'gachaD.' + param;
      case 'gachaType': return 'gachaT.' + param;
      case 'gachaLine': return 'gachaL.' + param;
      case 'chest': return 'chest';
      case 'chestRun': return 'chestRun';
      case 'rock': return 'rock';
      case 'rockRun': return 'rockRun';
      case 'altar': return 'altar';
      case 'altarOne': return 'altar.' + param;
      case 'altarRun': return 'altarRun';
      case 'altarOneRun': return 'altarRun.' + param;
      case 'spring': return 'spring';
      case 'springRun': return 'springRun';
      case 'tw': return 'tw';
      case 'twOne': return 'tw.' + param;
      case 'twG': return 'twG';
      case 'twGOne': return 'twG.' + param;
      case 'twMon': return 'twM.' + param;
      case 'twType': return 'twT.' + param;
      case 'floor': return 'floor';
      case 'floorG': return 'floorG';
      default: return id;
    }
  }

  function makeBatch(s, n, tiers, seed) {
    const r = rng(seed + ':' + (s.created || 0) + ':' + s.pass.n);
    const fams = [];
    const seen = {};
    for (const k of D().KINDS) if (!seen[k.fam]) { seen[k.fam] = 1; fams.push(k.fam); }
    for (let i = fams.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const tmp = fams[i]; fams[i] = fams[j]; fams[j] = tmp;
    }
    const out = [];
    for (const fam of fams) {
      if (out.length >= n) break;
      const pool = D().KINDS.filter(k => k.fam === fam && can(s, k) && tiers.some(t => D().goals(k.id, t, k.param === 'ticket' ? 'any' : '').length));
      if (!pool.length) continue;
      const k = pick(r, pool);
      const okT = tiers.filter(t => D().goals(k.id, t, k.param === 'ticket' ? 't1' : '').length || D().goals(k.id, t, '').length);
      if (!okT.length) continue;
      const tier = pick(r, okT);
      const param = k.param ? rollParam(s, r, k) : '';
      let gs = D().goals(k.id, tier, param);
      if (!gs.length) gs = D().goals(k.id, tier, '');
      if (!gs.length) continue;
      const goal = pick(r, gs);
      out.push({
        kind: k.id, tier, goal, param: param || '',
        key: statKey(k.id, param), max: !!k.max, awarded: false
      });
    }
    return out;
  }

  function park(s, P) {
    const bank = P.bank || [];
    const lvl = Math.min(100, Math.floor((P.pts || 0) / 10));
    for (let i = 1; i <= lvl; i++) {
      if (P.claimed && P.claimed[i]) continue;
      bank.push(freeze(s, P.track[i - 1]));
    }
    for (const post of P.post || []) {
      if (!post.claimed) bank.push(freeze(s, post.reward));
    }
    return bank;
  }

  /** Deja el premio concreto (el Pokémon ya elegido) para el mes que viene. */
  function freeze(s, reward) {
    if (!reward) return { kind: 'gold', n: 1000 };
    if (reward.kind === 'mon') {
      const mon = monOf(s, reward.rarity);
      return mon ? { kind: 'mon', dex: mon.dex } : { kind: 'frags', n: 20, rarity: reward.rarity };
    }
    if (reward.kind === 'shiny' || reward.kind === 'shiny5') {
      const leg = reward.kind === 'shiny5';
      const mon = shinyOf(s, leg);
      if (mon) return { kind: 'shiny', dex: mon.dex };
      return { kind: 'pick', leg, n: leg ? 500 : 100 };
    }
    if (reward.kind === 'frags') {
      const mon = monOf(s, reward.rarity);
      return mon ? { kind: 'frags', dex: mon.dex, n: reward.n || 20 } : { kind: 'gold', n: 1000 };
    }
    return { kind: reward.kind, n: reward.n, rarity: reward.rarity };
  }

  function monOf(s, rarity) {
    let list = inRegion(s, p => p.rarity === rarity);
    if (!list.length) {
      for (let d = 1; d <= 4 && !list.length; d++) {
        list = inRegion(s, p => p.rarity === rarity - d || p.rarity === rarity + d);
      }
    }
    return list.length ? G.U.pick(list) : null;
  }

  function shinyOf(s, leg) {
    const list = inRegion(s, p => {
      if (!G.Sprites || !G.Sprites.hasShiny(p.dex)) return false;
      if (s.shiny && s.shiny[p.dex]) return false;
      if (leg) return !!(p.leg || p.rarity === 5);
      return !p.leg && p.rarity >= 1 && p.rarity <= 4;
    });
    if (!list.length) return null;
    if (!leg) {
      const rarity = 1 + Math.floor(Math.random() * 4);
      const sub = list.filter(p => p.rarity === rarity);
      return G.U.pick(sub.length ? sub : list);
    }
    return G.U.pick(list);
  }

  function ensure(s) {
    if (!s) return;
    const ids = G.Ranking.periodIds();
    if (!s.pass || !s.pass.month) blank(s);
    const P = s.pass;
    if (P.month !== ids.m) {
      const bank = park(s, P);
      const n = (P.n || 1) + 1;
      const fold = !!P.fold;
      s.pass = fresh(ids.m, n, bank, who(s));
      s.pass.fold = fold;
    }
    const Q = s.pass;
    Q.stats = Q.stats || {};
    Q.best = Q.best || {};
    Q.days = Q.days || {};
    Q.weeks = Q.weeks || {};
    Q.monthM = Q.monthM || [];
    Q.claimed = Q.claimed || {};
    Q.bank = Q.bank || [];
    Q.post = Q.post || [];
    let made = false;
    if (!Q.track || Q.track.length !== 100) {
      Q.track = rollTrack(Q.n || 1, who(s));
      Q.own = who(s);
      made = true;
    }
    if (personalize(s, Q)) made = true;
    // El pase 1 sale a mitad de mes: quien entra hoy recibe las diarias
    // desde el día 1, no solo la de hoy. Los meses siguientes solo suman el día en curso.
    if ((Q.n || 1) === 1 && ids.m === Q.month) {
      const y = ids.d.slice(1, 5), mo = ids.d.slice(5, 7), today = +ids.d.slice(7, 9);
      for (let d = 1; d <= today; d++) {
        const id = 'd' + y + mo + String(d).padStart(2, '0');
        if (Q.days[id]) continue;
        Q.days[id] = makeBatch(s, 5, D().DAILY, id);
        made = true;
      }
    } else if (!Q.days[ids.d]) {
      Q.days[ids.d] = makeBatch(s, 5, D().DAILY, ids.d);
      made = true;
    }
    if (!Q.weeks[ids.w]) {
      Q.weeks[ids.w] = makeBatch(s, 12, D().WEEKLY, ids.w);
      made = true;
    }
    if (!Q.monthM.length) {
      Q.monthM = makeBatch(s, 8, D().MONTHLY, ids.m);
      made = true;
    }
    const gained = scan(s, true);
    if ((made || gained) && G.DB && G.DB.commit) G.DB.commit();
    return Q;
  }

  // ---------------- durante la partida ----------------

  function beginRun(dex, types) {
    bag = { dex: dex || 0, types: types || [], rift: 0, item: 0, chest: 0, rock: 0, altar: 0, altarId: {}, spring: 0 };
    towerGroup = false;
  }

  function endRun(d) {
    const s = G.DB.save;
    if (!s || !s.pass) return;
    const minutes = Math.floor((d.time || 0) / 60);
    const dex = d.dex || (bag && bag.dex) || 0;
    const types = d.types && d.types.length ? d.types : (bag && bag.types) || [];
    bump(s, 'min', minutes, true);
    if (dex) bump(s, 'minD.' + dex, minutes, true);
    for (const t of types) bump(s, 'minT.' + t, minutes, true);
    bump(s, 'goldRun', d.gain || 0, true);
    bump(s, 'bossRun', d.bosses || 0, true);
    if (dex) bump(s, 'killD.' + dex, d.kills || 0, true);
    for (const t of types) bump(s, 'killT.' + t, d.kills || 0, true);
    if (bag) {
      bump(s, 'riftRun', bag.rift, true);
      bump(s, 'itemRun', bag.item, true);
      bump(s, 'chestRun', bag.chest, true);
      bump(s, 'rockRun', bag.rock, true);
      bump(s, 'altarRun', bag.altar, true);
      bump(s, 'springRun', bag.spring, true);
      for (const id in bag.altarId) bump(s, 'altarRun.' + id, bag.altarId[id], true);
    }
    bump(s, 'kills', d.kills || 0);
    bump(s, 'boss', d.bosses || 0);
    bump(s, 'goldEarn', d.gain || 0);
    if (!d.tower && minutes >= 1) bump(s, 'runs', 1);
    bag = null;
    scan(s);
  }

  function goldEarn(n) {
    const s = G.DB.save;
    if (!s || !(n > 0)) return;
    ensure(s);
    bump(s, 'goldEarn', n);
    scan(s);
  }

  function goldSpend(n) {
    const s = G.DB.save;
    if (!s || !(n > 0)) return;
    ensure(s);
    bump(s, 'goldSpend', n);
    scan(s);
  }

  function ticketsEarn(bagT) {
    const s = G.DB.save;
    if (!s || !bagT) return;
    ensure(s);
    let any = 0;
    for (const k of ['t1', 't10', 'tb', 'tg']) {
      const n = bagT[k] || 0;
      if (!n) continue;
      bump(s, 'tickE.' + k, n);
      any += n;
    }
    if (any) bump(s, 'tickE.any', any);
    scan(s);
  }

  function ticketsSpent(cost) {
    const s = G.DB.save;
    if (!s || !cost) return;
    ensure(s);
    let any = 0;
    for (const k of ['t1', 't10', 'tb', 'tg']) {
      const n = cost[k] || 0;
      if (!n) continue;
      bump(s, 'tickS.' + k, n);
      any += n;
    }
    if (any) bump(s, 'tickS.any', any);
    scan(s);
  }

  function gacha(dex) {
    const s = G.DB.save;
    const p = G.DEX_BY[dex];
    if (!s || !p) return;
    ensure(s);
    bump(s, 'gachaD.' + p.dex, 1);
    for (const t of p.types || []) bump(s, 'gachaT.' + t, 1);
    const root = G.Evo ? G.Evo.root(p.dex) : p.dex;
    bump(s, 'gachaL.' + root, 1);
    scan(s);
  }

  function towerPlayed(cfg, group) {
    const s = G.DB.save;
    if (!s || !cfg) return;
    ensure(s);
    towerGroup = !!group;
    const id = cfg.id;
    if (group) {
      bump(s, 'twG', 1);
      bump(s, 'twG.' + id, 1);
    } else {
      bump(s, 'tw', 1);
      bump(s, 'tw.' + id, 1);
      const dex = s.partner;
      const p = G.DEX_BY[dex];
      if (p) {
        bump(s, 'twM.' + p.dex, 1);
        for (const t of p.types || []) bump(s, 'twT.' + t, 1);
      }
    }
    scan(s);
  }

  function floor(wave) {
    const s = G.DB.save;
    if (!s || !(wave > 0)) return;
    ensure(s);
    const key = towerGroup ? 'floorG' : 'floor';
    if ((s.pass.best[key] || 0) >= wave) return;
    bump(s, key, wave, true);
    scan(s);
  }

  function onEvent(kind, d) {
    const s = G.DB.save;
    if (!s || !s.pass) return;
    if (kind === 'runEnd') { endRun(d); return; }
    if (kind === 'item') {
      bump(s, 'item', 1);
      if (bag) bag.item++;
      scan(s);
      return;
    }
    if (kind === 'rift') {
      bump(s, 'rift', 1);
      if (bag) bag.rift++;
      if (d.dex) bump(s, 'riftB.' + d.dex, 1);
      scan(s);
      return;
    }
    if (kind === 'kill' && d.boss && !d.legend && d.dex) {
      bump(s, 'bossD.' + d.dex, 1);
      scan(s);
    }
  }

  function chest() {
    const s = G.DB.save;
    if (!s) return;
    ensure(s);
    bump(s, 'chest', 1);
    if (bag) bag.chest++;
    scan(s);
  }

  function rock() {
    const s = G.DB.save;
    if (!s) return;
    ensure(s);
    bump(s, 'rock', 1);
    if (bag) bag.rock++;
    scan(s);
  }

  function altar(id) {
    const s = G.DB.save;
    if (!s) return;
    ensure(s);
    bump(s, 'altar', 1);
    if (id) bump(s, 'altar.' + id, 1);
    if (bag) {
      bag.altar++;
      if (id) bag.altarId[id] = (bag.altarId[id] || 0) + 1;
    }
    scan(s);
  }

  function spring() {
    const s = G.DB.save;
    if (!s) return;
    ensure(s);
    bump(s, 'spring', 1);
    if (bag) bag.spring++;
    scan(s);
  }

  // ---------------- premios ----------------

  function addFrags(s, dex, n) {
    const mon = G.DEX_BY[dex];
    if (!mon || !(n > 0)) return '';
    const had = !!(s.owned && s.owned[dex]);
    if (had && G.Gacha && !G.Gacha.canGrow(mon, s)) {
      const coins = G.Gacha.REFUND[mon.rarity] || 15;
      s.coins = (s.coins || 0) + coins;
      return mon.name + ' está al tope: +' + G.U.num(coins) + ' de oro';
    }
    const key = String(G.Evo ? G.Evo.root(dex) : dex);
    s.frags = s.frags || {};
    s.frags[key] = (s.frags[key] || 0) + n;
    const need = G.Gacha ? G.Gacha.fragNeed(mon.rarity) : 3;
    if (!had && s.frags[key] >= need) {
      G.DB.grant(dex, 'pass');
      s.frags[key] -= need;
      if (s.frags[key] <= 0) delete s.frags[key];
      return mon.name + ' se une a tu equipo';
    }
    return '+' + n + ' fragmentos de ' + mon.name;
  }

  function giveMon(s, dex) {
    const mon = G.DEX_BY[dex];
    if (!mon) return '';
    if (s.owned && s.owned[dex]) return addFrags(s, dex, D().DUP[mon.rarity] || 50);
    G.DB.grant(dex, 'pass');
    return mon.name;
  }

  function giveShiny(s, dex) {
    const mon = G.DEX_BY[dex];
    if (!mon) return '';
    const freshS = G.DB.grantShiny(dex, 'pass');
    if (freshS) {
      s.stats = s.stats || {};
      s.stats.shinies = (s.stats.shinies || 0) + 1;
      return mon.name + ' shiny';
    }
    return addFrags(s, dex, mon.leg || mon.rarity === 5 ? 500 : 100);
  }

  function apply(s, reward) {
    if (!reward) return '';
    if (reward.kind === 'gold') { s.coins = (s.coins || 0) + (reward.n || 0); return '+' + G.U.num(reward.n) + ' de oro'; }
    if (reward.kind === 't1' || reward.kind === 't10' || reward.kind === 'tb' || reward.kind === 'tg') {
      s.tickets = Object.assign({ t1: 0, t10: 0, tb: 0, tg: 0 }, s.tickets);
      s.tickets[reward.kind] = (s.tickets[reward.kind] || 0) + (reward.n || 0);
      const name = { t1: 'tickets grises', t10: 'tickets morados', tb: 'tickets azules', tg: 'tickets dorados' }[reward.kind];
      return '+' + G.U.num(reward.n) + ' ' + name;
    }
    if (reward.kind === 'mon') {
      if (!reward.dex) { const mon = monOf(s, reward.rarity); if (mon) reward.dex = mon.dex; }
      return reward.dex ? giveMon(s, reward.dex) : '';
    }
    if (reward.kind === 'shiny') return giveShiny(s, reward.dex);
    if (reward.kind === 'frags') {
      if (!reward.dex) { const mon = monOf(s, reward.rarity); if (mon) reward.dex = mon.dex; }
      return reward.dex ? addFrags(s, reward.dex, reward.n || 20) : '';
    }
    return '';
  }

  function reelNum(n) {
    n = n | 0;
    if (n >= 1000000 && n % 1000000 === 0) return (n / 1000000) + 'm';
    if (n >= 1000 && n % 1000 === 0) return (n / 1000) + 'k';
    return String(n);
  }

  /** Lo que enseña la tragaperras: los valores posibles y en cuál para. */
  function showRoll(s, reward) {
    if (!reward) return null;
    const bands = D().BANDS[reward.kind];
    if (reward.kind === 'gold' || bands) {
      const list = (reward.kind === 'gold' ? D().BANDS.gold : bands).slice();
      if (list.indexOf(reward.n) < 0) list.push(reward.n || 0);
      const icon = reward.kind === 'gold' ? 'coin' : { t1: 'ticket', t10: 'ticket10', tb: 'ticketb', tg: 'ticketg' }[reward.kind];
      const col = reward.kind === 'gold' ? '#ffd23f' : { t1: '#c9cedb', t10: '#c47bff', tb: '#4fb4ff', tg: '#ffd23f' }[reward.kind];
      const word = reward.kind === 'gold' ? 'de oro' : { t1: 'tickets grises', t10: 'tickets morados', tb: 'tickets azules', tg: 'tickets dorados' }[reward.kind];
      const faces = list.map(n => ({ icon, text: reelNum(n), n }));
      const hit = faces.find(f => f.n === (reward.n || 0)) || faces[0];
      const ix = Math.max(0, list.indexOf(reward.n || 0));
      return {
        faces, hit, col, big: ix >= list.length - 2,
        led: '+' + G.U.num(reward.n || 0) + ' ' + word,
        frenzy: reward.kind === 'gold' ? '¡¿ORO?!' : '¡¿TICKETS?!'
      };
    }
    if (reward.kind === 'mon' || reward.kind === 'frags' || reward.kind === 'shiny' || reward.kind === 'shiny5') {
      const mon = G.DEX_BY[reward.dex];
      if (!mon) return null;
      const rarity = mon.rarity || reward.rarity || 1;
      const shiny = reward.kind === 'shiny' || reward.kind === 'shiny5';
      let pool = inRegion(s, p => shiny ? (p.rarity === rarity) : p.rarity === rarity);
      if (!pool.some(p => p.dex === mon.dex)) pool = pool.concat([mon]);
      let show = pool;
      if (pool.length > 8) {
        show = G.U.pickN(pool.filter(p => p.dex !== mon.dex), 7).concat([mon]);
        for (let i = show.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const t = show[i]; show[i] = show[j]; show[j] = t;
        }
      }
      const faces = show.map(p => ({ dex: p.dex, rarity: p.rarity, shiny, name: p.name }));
      const hit = faces.find(f => f.dex === mon.dex) || faces[0];
      const col = (G.Gacha && G.Gacha.RARITY_COLOR[rarity]) || '#ffd23f';
      return { faces, hit, col, big: shiny || rarity >= 4, led: (shiny ? 'SHINY · ' : '') + mon.name.toUpperCase(), frenzy: shiny ? '¡¿SHINY?!' : '¡¿POKÉMON?!' };
    }
    return null;
  }

  /** null si ya está, 'pick' si el jugador elige a quién van los fragmentos. */
  function claimLevel(i) {
    const s = G.DB.save;
    if (!s) return null;
    ensure(s);
    const P = s.pass;
    const lvl = Math.min(100, Math.floor(P.pts / 10));
    if (i < 1 || i > lvl || P.claimed[i]) return null;
    const reward = P.track[i - 1];
    if (reward && (reward.kind === 'shiny' || reward.kind === 'shiny5')) {
      const leg = reward.kind === 'shiny5';
      const mon = shinyOf(s, leg);
      if (!mon) return { pick: true, leg, n: leg ? 500 : 100, level: i };
      reward.dex = mon.dex;
      P.claimed[i] = true;
      const msg = giveShiny(s, mon.dex);
      G.DB.commit();
      return { msg, roll: showRoll(s, reward) };
    }
    P.claimed[i] = true;
    const msg = apply(s, reward);
    G.DB.commit();
    return { msg, roll: showRoll(s, reward) };
  }

  function claimPost(i) {
    const s = G.DB.save;
    if (!s) return null;
    ensure(s);
    const post = s.pass.post && s.pass.post[i];
    if (!post || post.claimed) return null;
    post.claimed = true;
    const msg = apply(s, post.reward);
    G.DB.commit();
    return { msg, roll: showRoll(s, post.reward) };
  }

  function claimPick(dex, where) {
    const s = G.DB.save;
    if (!s || !G.DEX_BY[dex]) return '';
    const msg = addFrags(s, dex, where.n || 100);
    if (where.level) s.pass.claimed[where.level] = true;
    else if (where.bank != null) s.pass.bank.splice(where.bank, 1);
    G.DB.commit();
    return msg;
  }

  function claimBank() {
    const s = G.DB.save;
    if (!s || !s.pass) return null;
    ensure(s);
    const bank = s.pass.bank || [];
    const msgs = [];
    while (bank.length) {
      const reward = bank[0];
      if (reward.kind === 'pick') return { pick: true, leg: !!reward.leg, n: reward.n, bank: 0, msgs };
      bank.shift();
      const msg = apply(s, reward);
      if (msg) msgs.push(msg);
    }
    G.DB.commit();
    return { msgs };
  }

  function ready() {
    const s = G.DB.save;
    if (!s || !s.pass) return 0;
    const P = s.pass;
    const lvl = Math.min(100, Math.floor((P.pts || 0) / 10));
    let n = (P.bank && P.bank.length) || 0;
    for (let i = 1; i <= lvl; i++) if (!P.claimed[i]) n++;
    for (const post of P.post || []) if (!post.claimed) n++;
    return n;
  }

  function boards() {
    const s = G.DB.save;
    if (!s || !s.pass) return { month: [], weeks: [], days: [] };
    const P = s.pass;
    const weekKeys = Object.keys(P.weeks || {}).sort().reverse();
    const dayKeys = Object.keys(P.days || {}).sort().reverse();
    return {
      month: P.monthM || [],
      weeks: weekKeys.map(id => ({ id, list: P.weeks[id] })),
      days: dayKeys.map(id => ({ id, list: P.days[id] }))
    };
  }

  /** Días que le quedan al mes en curso, contando hoy. Octubre son 31, febrero 28 o 29. */
  function daysLeft() {
    const ids = G.Ranking.periodIds();
    const y = +ids.d.slice(1, 5), mo = +ids.d.slice(5, 7), day = +ids.d.slice(7, 9);
    const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    return Math.max(1, dim - day + 1);
  }

  /** QA: deja hechas las misiones del pase que sigan abiertas y suma sus puntos. */
  function completeOpen() {
    const s = G.DB.save;
    if (!s) return { n: 0, gained: 0 };
    ensure(s);
    const P = s.pass;
    if (!P) return { n: 0, gained: 0 };
    let n = 0;
    for (const m of allM(P)) {
      if (m.awarded) continue;
      const bucket = m.max ? (P.best = P.best || {}) : (P.stats = P.stats || {});
      if ((bucket[m.key] || 0) < m.goal) bucket[m.key] = m.goal;
      n++;
    }
    const gained = scan(s, true);
    return { n, gained };
  }

  function toggleFold() {
    const s = G.DB.save;
    if (!s || !s.pass) return;
    s.pass.fold = !s.pass.fold;
    G.DB.commit();
  }

  return {
    ensure, onEvent, beginRun, goldSpend, ticketsEarn, ticketsSpent, gacha,
    towerPlayed, floor, chest, rock, altar, spring, goldEarn,
    claimLevel, claimPost, claimPick, claimBank, ready, boards, completeOpen, toggleFold, daysLeft,
    value: valueOf, text: m => D().text(m), points: t => D().points(t)
  };
})();
