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
      '<h3 class="set-h">Oro, tickets y misiones</h3>'
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
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && isOpen()) { e.preventDefault(); close(); }
    });
    if (G.Social) G.Social.on(() => sync());
    sync();
  }

  return { init, sync, allowed, open, close };
})();
