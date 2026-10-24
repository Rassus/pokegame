/* ============ qa.js — modo prueba, solo apodos de la lista ============
 * En el menú sale "Modo prueba". Abre una ventana aparte (no botones
 * sobre la pantalla). El apodo se comprueba en cada acción: un ajuste
 * guardado en el navegador no sirve en otra cuenta.
 */
G.QA = (() => {
  const NICKS = new Set(['asus27', 'frodo', 'frodo1']);
  let gen = 1;

  function nick() {
    const me = G.Social && G.Social.me;
    return String(me && me.name || '').trim().toLowerCase();
  }
  function allowed() { return NICKS.has(nick()); }
  function isOpen() {
    const s = document.getElementById('scr-qa');
    return !!(s && !s.classList.contains('hidden'));
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function toast(msg) { if (G.UI && G.UI.toast) G.UI.toast(msg); }

  function sync() {
    const btn = document.getElementById('menu-qa');
    if (btn) btn.classList.toggle('hidden', !allowed());
    const top = document.getElementById('topbar');
    const away = top && top.classList.contains('hidden');
    if (isOpen() && (!allowed() || away)) close();
  }

  function open() {
    if (!allowed()) return;
    const s = document.getElementById('scr-qa');
    if (!s) return;
    s.classList.remove('hidden');
    render();
  }
  function close() {
    const s = document.getElementById('scr-qa');
    if (s) s.classList.add('hidden');
  }

  function addGold() {
    if (!allowed()) return;
    const s = G.DB.save;
    if (!s) return;
    s.coins = (s.coins || 0) + 1000000000;
    G.DB.commit(true);
    if (G.UI.refreshCoins) G.UI.refreshCoins();
    toast('+1b Pokémonedas');
  }

  function addTickets() {
    if (!allowed()) return;
    const s = G.DB.save;
    if (!s) return;
    s.tickets = s.tickets || { t1: 0, t10: 0, tb: 0, tg: 0 };
    for (const k of ['t1', 't10', 'tb', 'tg']) s.tickets[k] = (s.tickets[k] | 0) + 2000;
    G.DB.commit(true);
    if (G.UI.refreshCoins) G.UI.refreshCoins();
    if (G.GachaUI && G.UI.isOpen('scr-gacha')) G.GachaUI.refresh();
    toast('+2.000 tickets de cada color');
  }

  function addFrags() {
    if (!allowed()) return;
    const s = G.DB.save;
    if (!s || !s.partner) { toast('Elige un compañero primero'); return; }
    const key = String(G.Evo.root(s.partner));
    s.frags = s.frags || {};
    s.frags[key] = (s.frags[key] | 0) + 100;
    G.DB.commit(true);
    if (G.GachaUI && G.UI.isOpen('scr-gacha')) G.GachaUI.refresh();
    const name = (G.DEX_BY[s.partner] && G.DEX_BY[s.partner].name) || key;
    toast(G.I18n.f('+100 fragmentos de {x}', name));
  }

  function completeMissions() {
    if (!allowed()) return;
    if (!G.DB.save || !G.Pass) return;
    const r = G.Pass.completeOpen();
    G.DB.commit(true);
    const sub = document.getElementById('menu-goals-sub');
    if (sub && G.Progress) {
      const pend = G.Progress.pending();
      sub.textContent = pend ? pend + (pend === 1 ? ' premio por recoger' : ' premios por recoger') : 'Misiones, logros y perfil';
      sub.classList.toggle('gold', pend > 0);
    }
    if (G.GoalsUI && G.UI.isOpen('scr-goals')) G.GoalsUI.render();
    if (!r.n) toast('No hay misiones pendientes');
    else toast(G.I18n.f('Misiones hechas: {x} · pase +{x}', r.n, r.gained));
  }

  function touchDex() {
    const s = G.DB.save;
    const el = document.getElementById('menu-dex-count');
    if (!s || !el) return;
    const owned = Object.keys(s.owned).filter(d => G.DEX_BY[d]).length;
    const shinies = Object.keys(s.shiny || {}).length;
    el.textContent = `${owned} / ${G.DEX.length}` + (shinies ? ` · ${shinies} shiny` : '');
  }

  function unlockMons() {
    if (!allowed()) return;
    const s = G.DB.save;
    if (!s) return;
    let n = 0;
    for (const mon of G.DEX) {
      if (!G.DB.owns(mon.dex)) { G.DB.grant(mon.dex, 'dev'); n++; }
    }
    s.region = Math.max(s.region || 1, 9);
    s.regionProg = 0;
    G.DB.commit(true);
    touchDex();
    toast(n ? G.I18n.f('Pokémon nuevos: {x}', n) : G.I18n.f('Tienes los {x} Pokémon', G.DEX.length));
  }

  function unlockTowers() {
    if (!allowed()) return;
    const s = G.DB.save;
    if (!s || !G.Towers) return;
    s.legends = s.legends || {};
    let n = 0;
    for (const t of G.Towers.LIST) {
      const d = t.dexes[0];
      if (!s.legends[d]) { s.legends[d] = Date.now(); n++; }
    }
    G.DB.commit(true);
    toast(n ? G.I18n.f('Torres nuevas: {x}', n) : 'Ya estaban desbloqueadas');
    if (isOpen()) render();
  }

  function face(id) {
    if (!allowed()) return;
    if (G.Social && G.Social.room) { toast('Sal de la sala para enfrentar al jefe'); return; }
    const cfg = G.Towers.prepare(id, 'normal', true);
    if (!cfg) return;
    cfg.duel = true;
    cfg.share = 0;
    cfg.tickets = 0;
    G.Towers.arm(cfg);
    close();
    G.Flow.play();
  }

  // ---------------- durante la run ----------------

  let panelOn = false, pausedByQa = false, barOn = true;
  let mode = '', draft = 1, groups = [[], [], [], []], slotIx = 0, query = '', showAll = false, caret = null;

  function player() { return G.Game && G.Game.player; }
  function clampLvl(n) {
    n = Math.round(+n);
    return isFinite(n) ? Math.max(1, Math.min(9999, n)) : 1;
  }
  function readLvl() {
    const el = document.getElementById('qa-lvl-n');
    if (!el || el.value === '') return 0;
    return clampLvl(el.value);
  }
  function worldOk() {
    if (G.Coop && G.Coop.active && !G.Coop.isHost) { toast('Solo el anfitrión puede hacerlo'); return false; }
    return true;
  }
  function pauseForPanel() {
    if (!player() || !G.Game.qaPause || G.Game.state !== 'playing') return false;
    pausedByQa = !!G.Game.qaPause();
    return pausedByQa;
  }
  function resumeFromPanel() {
    if (pausedByQa && G.Game && G.Game.qaResume) G.Game.qaResume();
    pausedByQa = false;
  }
  function closePanel(skipResume) {
    panelOn = false;
    const s = document.getElementById('scr-qa-run');
    if (s) s.classList.add('hidden');
    if (skipResume) pausedByQa = false;
    else resumeFromPanel();
  }
  function showPanel(title, html) {
    panelOn = true;
    const s = document.getElementById('scr-qa-run');
    if (!s) return;
    document.getElementById('qa-run-title').textContent = title;
    document.getElementById('qa-run-body').innerHTML = html;
    s.classList.remove('hidden');
    bindBody();
  }

  function levelHtml() {
    const jumps = [1, 10, 20, 30, 50, 65, 100, 135, 200];
    const now = player() ? player().level : 1;
    return '<p class="sub">La run está en pausa. El Pokémon pasa al nivel que elijas.</p>'
      + '<p>Ahora está en el nivel <b>' + now + '</b>.</p>'
      + '<div class="qa-lvl-row">'
      + '<button type="button" class="btn small" data-d="-10">−10</button>'
      + '<button type="button" class="btn small" data-d="-1">−1</button>'
      + '<input id="qa-lvl-n" type="number" min="1" max="9999" inputmode="numeric" value="' + draft + '">'
      + '<button type="button" class="btn small" data-d="1">+1</button>'
      + '<button type="button" class="btn small" data-d="5">+5</button>'
      + '<button type="button" class="btn small" data-d="10">+10</button>'
      + '</div>'
      + '<div class="qa-lvl-row">'
      + jumps.map(n => '<button type="button" class="btn small' + (n === draft ? ' gold' : '') + '" data-set="' + n + '">Nv. ' + n + '</button>').join('')
      + '</div>'
      + '<div class="row"><button type="button" class="btn gold" data-apply="lvl">Aplicar</button></div>';
  }
  function openLevel() {
    if (!pauseForPanel()) return;
    mode = 'lvl';
    draft = player().level;
    showPanel('Cambiar nivel', levelHtml());
  }
  function applyLevel() {
    const n = readLvl();
    if (!n) { toast('Escribe un nivel'); return; }
    G.Game.qaSetLevel(n);
    toast('Nivel ' + n);
    closePanel();
  }

  function chipOf(s, i, mi) {
    const def = G.Moves.BY_ID[s.id];
    if (!def) return '';
    let opts = '';
    for (let n = 1; n <= def.maxLvl; n++) opts += '<option value="' + n + '"' + (n === s.lvl ? ' selected' : '') + '>' + n + '</option>';
    const evo = G.Moves.EVO[s.id]
      ? '<label class="qa-evo"><input type="checkbox" data-evo="' + i + ':' + mi + '"' + (s.evo ? ' checked' : '') + '>Evo</label>'
      : '';
    return '<div class="qa-chip"><span>' + esc(def.name) + '</span>'
      + '<select data-lvl="' + i + ':' + mi + '" aria-label="Nivel de ' + esc(def.name) + '">' + opts + '</select>'
      + evo
      + '<button type="button" class="btn small ghost" data-rm="' + i + ':' + mi + '">Quitar</button></div>';
  }
  function movesHtml() {
    const pl = player();
    const pool = showAll ? G.Moves.ALL.map(m => m.id) : G.Moves.poolFor(pl.mon);
    const q = query.trim().toLowerCase();
    const list = pool.map(id => G.Moves.BY_ID[id]).filter(Boolean)
      .filter(m => !q || m.name.toLowerCase().includes(q) || m.id.includes(q))
      .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name, 'es'));
    const used = new Set([].concat(...groups).map(s => s.id));
    const slots = groups.map((g, i) => {
      const chips = g.map((s, mi) => chipOf(s, i, mi)).join('') || '<small>Vacío. Elige ataques abajo.</small>';
      return '<div class="qa-slot' + (i === slotIx ? ' on' : '') + '" data-slot="' + i + '"><b>Hueco ' + (i + 1) + '</b>' + chips + '</div>';
    }).join('');
    const buttons = list.map(m => '<button type="button" class="qa-mv' + (used.has(m.id) ? ' on' : '') + '" data-mv="' + esc(m.id) + '" style="border-color:' + (G.U.TYPE_COLOR[m.type] || '#fff') + '">' + esc(m.name) + '</button>').join('');
    return '<p class="sub">La run está en pausa. El hueco marcado recibe el ataque. Varios en el mismo hueco salen a la vez. Los huecos vacíos se quitan y el resto se junta a la izquierda.</p>'
      + '<div class="qa-slots">' + slots + '</div>'
      + '<div class="qa-lvl-row"><input id="qa-move-q" placeholder="Buscar ataque" value="' + esc(query) + '">'
      + '<label class="qa-evo"><input type="checkbox" id="qa-all"' + (showAll ? ' checked' : '') + '>Todos los ataques</label></div>'
      + '<div class="qa-moves" id="qa-moves">' + (buttons || '<p class="sub">Ninguno con ese nombre.</p>') + '</div>'
      + '<div class="row"><button type="button" class="btn gold" data-apply="moves">Aplicar</button></div>';
  }
  function paintMoves(refocus) {
    const prev = document.getElementById('qa-moves');
    const y = prev ? prev.scrollTop : 0;
    mode = 'moves';
    showPanel('Habilidades', movesHtml());
    const box = document.getElementById('qa-moves');
    if (box) box.scrollTop = y;
    if (refocus) {
      const s = document.getElementById('qa-move-q');
      if (s) {
        s.focus();
        const p = caret == null ? s.value.length : caret;
        s.setSelectionRange(p, p);
      }
    }
  }
  function openMoves() {
    const pl = player();
    if (!pl || !pauseForPanel()) return;
    groups = [[], [], [], []];
    (pl.slots || []).forEach((g, i) => {
      if (i > 3) return;
      groups[i] = [...g].map(m => ({ id: m.id, lvl: m.lvl || 1, evo: !!m.evolved }));
    });
    slotIx = 0;
    query = '';
    showAll = false;
    caret = null;
    paintMoves(false);
  }
  function addMoveId(id) {
    const def = G.Moves.BY_ID[id];
    if (!def) return;
    if (groups[slotIx].some(s => s.id === id)) { toast('Ya está en este hueco'); return; }
    if (groups[slotIx].length >= G.Player.BOND_MAX) { toast('Ese hueco ya tiene 4 ataques'); return; }
    for (const g of groups) {
      const i = g.findIndex(s => s.id === id);
      if (i >= 0) g.splice(i, 1);
    }
    groups[slotIx].push({ id, lvl: def.maxLvl, evo: !!G.Moves.EVO[id] });
  }
  function removeAt(key) {
    const [i, j] = key.split(':').map(Number);
    if (groups[i]) groups[i].splice(j, 1);
  }
  function applyMoves() {
    const clean = groups.map(g => g.filter(s => G.Moves.BY_ID[s.id])).filter(g => g.length);
    if (!clean.length) { toast('Elige al menos un ataque'); return; }
    if (!G.Game.qaLoadout(clean)) { toast('No se pudieron poner esos ataques'); return; }
    toast('Habilidades cambiadas');
    closePanel();
  }

  function bindBody() {
    const body = document.getElementById('qa-run-body');
    if (!body) return;
    body.onclick = e => {
      const b = e.target.closest('[data-d],[data-set],[data-apply],[data-slot],[data-mv],[data-rm]');
      if (!b || !body.contains(b)) return;
      if (b.dataset.d) {
        draft = clampLvl((readLvl() || draft) + (+b.dataset.d));
        showPanel('Cambiar nivel', levelHtml());
      } else if (b.dataset.set) {
        draft = clampLvl(+b.dataset.set);
        showPanel('Cambiar nivel', levelHtml());
      } else if (b.dataset.apply === 'lvl') applyLevel();
      else if (b.dataset.apply === 'moves') applyMoves();
      else if (b.dataset.rm) { removeAt(b.dataset.rm); paintMoves(false); }
      else if (b.dataset.mv) { addMoveId(b.dataset.mv); paintMoves(false); }
      else if (b.dataset.slot != null) {
        if (e.target.closest('select,button,input,label')) return;
        slotIx = +b.dataset.slot;
        paintMoves(false);
      }
    };
    body.onchange = e => {
      const t = e.target;
      if (t.id === 'qa-all') { showAll = t.checked; paintMoves(false); return; }
      const key = t.dataset.lvl || t.dataset.evo;
      if (!key) return;
      const [i, j] = key.split(':').map(Number);
      if (!groups[i] || !groups[i][j]) return;
      if (t.dataset.lvl) groups[i][j].lvl = +t.value;
      else groups[i][j].evo = t.checked;
    };
    const q = document.getElementById('qa-move-q');
    if (q) q.oninput = () => { query = q.value; caret = q.selectionStart; paintMoves(true); };
    const n = document.getElementById('qa-lvl-n');
    if (n) n.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); applyLevel(); } };
  }

  function makeRift() {
    if (!worldOk() || !player()) return;
    if (G.Towers.active && G.Towers.active()) { toast('En una torre no hay grietas'); return; }
    if (G.Rift.inArena) { toast('Ya estás dentro de una grieta'); return; }
    G.Rift.debugOpen();
    if (!G.Rift.rift) toast('No hay sitio libre para la grieta');
    else { G.Game.qaTouch(); G.Spawner.say('¡Se abre una grieta!', 3, true); }
  }
  function callBoss() {
    if (!worldOk() || !player()) return;
    const e = G.Spawner.debugBoss();
    if (!e) toast('No se pudo llamar al jefe');
    else G.Game.qaTouch();
  }
  function toggleGod() {
    const pl = player();
    if (!pl || !G.Game.qaGod) return;
    const on = !pl.god;
    G.Game.qaGod(on);
    toast(on ? 'Indestructible' : 'Ya recibes daño');
  }
  function togglePow() {
    const pl = player();
    if (!pl || !G.Game.qaPower) return;
    const on = !pl.qaPow;
    G.Game.qaPower(on);
    toast(on ? 'Daño ×1000' : 'Daño normal');
  }

  function tick() {
    const dock = document.getElementById('qa-run');
    if (!dock) return;
    const st = G.Game && G.Game.state;
    const on = allowed() && player() && st && st !== 'ui' && st !== 'over';
    dock.classList.toggle('hidden', !on);
    if (!on) {
      if (panelOn) closePanel(true);
      return;
    }
    const pl = player();
    const god = dock.querySelector('[data-qa="god"]');
    const pow = dock.querySelector('[data-qa="pow"]');
    if (god) {
      god.classList.toggle('on', !!pl.god);
      god.textContent = pl.god ? 'Mortal' : 'Indestructible';
    }
    if (pow) {
      pow.classList.toggle('on', !!pl.qaPow);
      pow.textContent = pl.qaPow ? 'Daño normal' : 'Daño ×1000';
    }
  }

  function render() {
    const box = document.getElementById('qa-body');
    if (!box) return;
    const y = box.scrollTop;
    const gens = [];
    for (let g = 1; g <= 9; g++) if (G.Towers.LIST.some(t => t.gen === g)) gens.push(g);
    if (!gens.includes(gen)) gen = gens[0] || 1;
    const tabs = gens.map(g => {
      const name = (G.Towers.REGIONS && G.Towers.REGIONS[g]) || g;
      return '<button type="button" class="gen-tab' + (g === gen ? ' on' : '') + '" data-act="gen" data-gen="' + g + '">' + esc(name) + '</button>';
    }).join('');
    const rows = G.Towers.LIST.filter(t => t.gen === gen).map(t => {
      const dex = t.dexes[0];
      const name = G.DEX_BY[dex] ? G.DEX_BY[dex].name : t.name;
      return '<div class="tower-row"><b translate="no">' + esc(name) + '</b>'
        + '<button type="button" class="btn small gold" data-act="face" data-id="' + esc(t.id) + '" data-sfx="confirm">Enfrentar</button></div>';
    }).join('');
    box.innerHTML =
      '<p class="sub">Durante una run, a la izquierda, salen los botones de nivel, habilidades, grieta, jefe, indestructible y daño ×1000.</p>'
      + '<h3 class="set-h">Oro, tickets y misiones</h3>'
      + '<div id="qa-actions">'
      + '<button type="button" class="btn small gold" data-act="gold" data-sfx="buy">+1b oro</button>'
      + '<button type="button" class="btn small gold" data-act="tickets" data-sfx="buy">+2.000 tickets de cada</button>'
      + '<button type="button" class="btn small gold" data-act="frags" data-sfx="buy">+100 fragmentos</button>'
      + '<button type="button" class="btn small gold" data-act="missions">Completar misiones</button>'
      + '</div>'
      + '<div class="set-row"><div class="grow"><b>Desbloquear todos los Pokémon</b><small>Entran en tu colección y se abre la última región.</small></div>'
      + '<button type="button" class="btn small gold" data-act="mons">Obtener todos</button></div>'
      + '<div class="set-row"><div class="grow"><b>Desbloquear todas las torres</b><small>Cada jefe cuenta como vencido en una grieta.</small></div>'
      + '<button type="button" class="btn small gold" data-act="towers">Obtener todos</button></div>'
      + '<h3 class="set-h">Jefes de torre</h3>'
      + '<p class="sub">Entras al jefe, sin oleadas y sin pagar.</p>'
      + '<div class="gen-tabs">' + tabs + '</div>'
      + rows;
    box.scrollTop = y;
    box.querySelectorAll('[data-act]').forEach(b => {
      b.onclick = () => {
        const a = b.dataset.act;
        if (a === 'gold') addGold();
        else if (a === 'tickets') addTickets();
        else if (a === 'frags') addFrags();
        else if (a === 'missions') completeMissions();
        else if (a === 'mons') unlockMons();
        else if (a === 'towers') unlockTowers();
        else if (a === 'gen') { gen = +b.dataset.gen; render(); }
        else if (a === 'face') face(b.dataset.id);
      };
    });
  }

  function init() {
    const closeBtn = document.getElementById('qa-close');
    if (closeBtn) closeBtn.onclick = close;
    const runX = document.getElementById('qa-run-x');
    if (runX) runX.onclick = () => closePanel();
    const scr = document.getElementById('scr-qa-run');
    if (scr) scr.addEventListener('click', e => { if (e.target === scr) closePanel(); });
    const fold = document.getElementById('qa-run-toggle');
    const bar = document.getElementById('qa-run-bar');
    if (fold && bar) fold.onclick = () => { barOn = !barOn; bar.classList.toggle('hidden', !barOn); };
    if (bar) bar.addEventListener('click', e => {
      const b = e.target.closest('[data-qa]');
      if (!b) return;
      const a = b.dataset.qa;
      if (a === 'lvl') openLevel();
      else if (a === 'moves') openMoves();
      else if (a === 'rift') makeRift();
      else if (a === 'boss') callBoss();
      else if (a === 'god') toggleGod();
      else if (a === 'pow') togglePow();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && isOpen()) { e.preventDefault(); close(); }
    });
    if (G.Social) G.Social.on(() => sync());
    sync();
  }

  return { init, sync, allowed, open, close, tick, blocking() { return panelOn; }, closePanel };
})();
