/* ============ menu.js — menú principal, colección y mejoras ============ */
G.MenuUI = (() => {
  const $ = G.UI.$;
  const GEN_NAMES = ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Teselia', 'Kalos', 'Alola', 'Galar', 'Paldea'];
  let dexFilter = 'all', dexGen = 1, dexSel = null, dexFavOn = false, dexFilterOpen = false;
  const dexRarities = new Set(), dexTypes = new Set();

  /** Todas las mejoras de ese Pokémon (las de monedas) están al máximo. */
  function monFullUp(dex) {
    const lv = (G.DB.save.pupg && G.DB.save.pupg[dex]) || {};
    return G.Upgrades.LIST.every(u => u.cat !== 'mon' || (lv[u.id] || 0) >= u.max);
  }

  /** Vida, ataque y velocidad están en el tope de fragmentos. */
  function monFullIv(p) {
    return ['hp', 'atk', 'spd'].every(st => G.Gacha.atCap(p, G.DB.save, st));
  }

  function dexMarked(dex) {
    const f = G.DB.save && G.DB.save.dexFav;
    return !!(f && f[dex] > 0);
  }

  function toggleDexFav(dex) {
    const s = G.DB.save;
    if (!s) return;
    s.dexFav = s.dexFav || {};
    s.dexFav[dex] = dexMarked(dex) ? -Date.now() : Date.now();
    G.DB.commit(true);
  }

  function init() {
    const ICON = { play: 'ball', dex: 'book', upgrades: 'up', gacha: 'ball4', items: 'leftovers', towers: 'tower', goals: 'medal3', friends: 'friends', rank: 'trophy', settings: 'gear', qa: 'star' };
    document.querySelectorAll('#scr-menu [data-go]').forEach(b => {
      b.insertAdjacentHTML('afterbegin', `<span class="mi-ico">${G.Icons.html(ICON[b.dataset.go], 26)}</span>`);
      b.dataset.sfx = b.dataset.go === 'play' ? 'confirm' : 'click';
      b.onclick = () => {
        const go = b.dataset.go;
        if (go === 'play') { if (G.Social.room) G.LobbyUI.open(); else G.Flow.play(); }
        else if (go === 'dex') openDex();
        else if (go === 'upgrades') openUpgrades();
        else if (go === 'gacha') G.GachaUI.open();
        else if (go === 'items') openItems();
        else if (go === 'towers') G.TowerUI.open();
        else if (go === 'goals') G.GoalsUI.open();
        else if (go === 'friends') G.FriendsUI.open();
        else if (go === 'rank') G.RankingUI.open();
        else if (go === 'settings') G.SettingsUI.open();
        else if (go === 'qa' && G.QA) G.QA.open();
      };
    });
    document.querySelectorAll('[data-back]').forEach(b => { b.onclick = open; });
    const menuFold = $('menu-fold');
    if (menuFold) menuFold.onclick = () => menuFold.closest('.menu-right').classList.toggle('is-fold');
    G.Social.on(() => { if (G.UI.isOpen('scr-menu')) socialLine(); });
    $('btn-logout').onclick = () => {
      if (G.DB.guest && !confirm('Eres invitado: se perderá todo el progreso. ¿Salir?')) return;
      G.Audio.music(null);
      G.DB.logout().then(() => G.Flow.toLogin());
    };
    const b = document.createElement('button');
    b.id = 'dev-coins';
    b.className = 'btn small gold hidden';
    b.title = 'Herramienta de prueba';
    b.textContent = '+' + G.U.num(100000000);
    b.dataset.sfx = 'buy';
    $('coins').closest('.pill').after(b);
    b.onclick = () => {
      const sv = G.DB.save;
      if (!sv || !G.UI.helpersOn()) return;
      sv.coins += 100000000;
      G.DB.commit(true);
      G.UI.refreshCoins();
      G.UI.toast((G.DB.guest ? '+' + G.U.num(100000000) + ' monedas (invitado: no se guarda)' : '+' + G.U.num(100000000) + ' monedas'));
    };
    G.Settings.on(k => { if (k === 'helpers') syncHelpers(); });
    syncHelpers();
    const pop = $('move-pop');
    if (pop) pop.addEventListener('click', e => { if (e.target === pop) closeMove(); });
  }

  function syncHelpers() {
    const b = $('dev-coins');
    if (b) b.classList.toggle('hidden', !G.UI.helpersOn());
    if (G.UI.isOpen('scr-dex')) openDex();
    if (G.UI.isOpen('scr-towers') && G.TowerUI) G.TowerUI.open();
  }

  // ---------------- menú principal ----------------

  function open() {
    closeMove();
    const s = G.DB.save;
    const mon = G.DEX_BY[s.partner];
    const shiny = !!s.partnerShiny && G.DB.ownsShiny(mon.dex);
    G.UI.chrome(true);
    G.UI.show('scr-menu');
    G.UI.sprite($('menu-partner'), mon.dex, { lively: true, scale: 4, hero: true, shiny });
    $('menu-partner').style.setProperty('--stage-c', shiny ? '#9ae6ff' : G.U.TYPE_COLOR[mon.types[0]]);
    $('menu-partner').classList.toggle('shiny', shiny);
    $('menu-partner-name').innerHTML = mon.name + (shiny ? ' ' + G.Icons.html('shiny', 24) : '');
    $('menu-partner-info').innerHTML = G.UI.typeChips(mon.types) + ' ' + G.UI.stars(mon.rarity);
    // Normal / shiny a mano, aquí mismo (en el móvil no se encontraba en la ficha).
    const seg = $('menu-shiny');
    seg.classList.toggle('hidden', !G.DB.ownsShiny(mon.dex));
    seg.lastChild.innerHTML = G.Icons.html('shiny', 12) + ' Shiny';
    seg.querySelectorAll('button').forEach(b => {
      b.classList.toggle('on', (b.dataset.v === '1') === shiny);
      b.onclick = () => {
        if ((b.dataset.v === '1') === shiny) return;
        s.partnerShiny = b.dataset.v === '1';
        G.DB.commit();
        G.Audio.sfx('confirm');
        open();
      };
    });

    const owned = Object.keys(s.owned).filter(d => G.DEX_BY[d]).length;
    const shinies = Object.keys(s.shiny || {}).length;
    $('menu-dex-count').textContent = `${owned} / ${G.DEX.length}` + (shinies ? ` · ${shinies} shiny` : '');

    const st = s.stats;
    $('menu-stats').innerHTML =
      `Runs <b style="color:#fff">${st.runs}</b> · Mejor tiempo <b style="color:#fff">${G.U.mmss(st.bestTime)}</b><br>` +
      `Mejor nivel <b style="color:#fff">${st.bestLevel}</b> · Derrotados <b style="color:#fff">${G.U.num(st.totalKills)}</b>` +
      (G.DB.guest ? '<br><span style="color:#ffb0b8">Modo invitado: no se guarda</span>' : '');

    socialLine();
    // Premios de misiones por recoger.
    G.Progress.checkAch();
    const pend = G.Progress.pending();
    $('menu-goals-sub').textContent = pend ? pend + (pend === 1 ? ' premio por recoger' : ' premios por recoger') : 'Misiones, logros y perfil';
    $('menu-goals-sub').classList.toggle('gold', pend > 0);
    if (G.PassUI) G.PassUI.open();
    if (G.QA) G.QA.sync();
    // Con cuenta en la nube: amigos en línea, invitaciones y (una vez) el apodo.
    if (G.DB.online && !G.Social.started) {
      G.Social.start().then(r => {
        if (r === 'need-nick' && !G.NickUI.skipped && G.UI.isOpen('scr-menu')) G.NickUI.open();
        socialLine();
        if (G.QA) G.QA.sync();
      });
    }
    G.InvitePop.refresh();
  }

  /** Texto bajo "Amigos" y "Jugar": quién está en línea, solicitudes, sala. */
  function socialLine() {
    const room = G.Social.room;
    const play = document.querySelector('#scr-menu [data-go=play] small');
    if (play) play.textContent = room ? 'Volver a tu sala (' + room.members.length + '/' + G.Social.MAX_PLAYERS + ')' : 'Entra en la mazmorra';
    const fr = G.Social.friends;
    const on = fr.filter(f => f.status === 'ok' && f.online).length;
    const req = fr.filter(f => f.status === 'in').length;
    const parts = [];
    if (on) parts.push(on + ' en línea');
    if (req) parts.push(req + (req === 1 ? ' solicitud' : ' solicitudes'));
    $('menu-friends-sub').textContent = parts.length ? parts.join(' · ') : 'Juega en grupo, hasta 8';
    $('menu-friends-sub').classList.toggle('gold', req > 0);
  }

  function pct(n) {
    return n.toLocaleString('es', { maximumFractionDigits: 2 }) + '%';
  }

  function openItems() {
    const rate = `Cofre pequeño ${pct(G.Items.each('small'))} · Cofre grande ${pct(G.Items.each('big'))} · Jefe ${pct(G.Items.each('boss'))}`;
    const row = it => `<div class="item-row">
      <div class="ic">${G.Icons.html(it.id, 32)}</div>
      <div><b>${it.name}</b> <span class="ds">${it.desc}</span></div>
      <div class="ir">${it.id === 'evostone' ? `Cofre pequeño, cofre grande y jefe ${pct(G.Items.DROP.stone)}` : rate}</div>
    </div>`;
    $('items-list').innerHTML = `<p class="sub">En un cofre pequeño hay un ${pct(G.Items.DROP.small)} de que salga un objeto, en uno grande un ${pct(G.Items.DROP.big)} y en un jefe un ${pct(G.Items.DROP.boss)}. Si sale, es uno de estos al azar. La Piedra Evolución va en su propio hueco.</p>
      ${G.Items.LIST.map(row).join('')}
      ${row(G.Items.STONE)}`;
    G.UI.show('scr-items', true);
  }

  // ---------------- colección ----------------

  function openDex() {
    G.UI.show('scr-dex', true);
    const s = G.DB.save;
    if (dexSel == null) { dexSel = s.partner; dexGen = G.DEX_BY[s.partner].gen; }
    const owned = Object.keys(s.owned).filter(d => G.DEX_BY[d]).length;
    $('dex-total').textContent = `${owned} / ${G.DEX.length}`;
    // Obtener toda la colección: sólo en local, y se esconde si ya la tienes completa.
    const head = $('dex-head-actions');
    let allBtn = $('dex-grant-all');
    if (G.UI.helpersOn() && owned < G.DEX.length) {
      if (!allBtn) {
        allBtn = document.createElement('button');
        allBtn.id = 'dex-grant-all';
        allBtn.className = 'btn small gold';
        allBtn.title = 'Herramienta de prueba';
        allBtn.textContent = 'Obtener todos';
        head.insertBefore(allBtn, head.firstElementChild);
      }
      allBtn.onclick = () => {
        if (!G.DB.save) return;
        for (const mon of G.DEX) if (!G.DB.owns(mon.dex)) G.DB.grant(mon.dex, 'dev');
        G.DB.save.region = 9;
        G.DB.save.regionProg = 0;
        G.DB.commit(true);
        G.UI.toast(G.DB.guest ? 'Colección completa (invitado: no se guarda)' : 'Tienes los ' + G.DEX.length + ' Pokémon');
        openDex();
      };
    } else if (allBtn) allBtn.remove();

    const favBtn = $('dex-favs');
    if (favBtn && !favBtn.dataset.ready) {
      favBtn.dataset.ready = '1';
      favBtn.insertAdjacentHTML('afterbegin', G.Icons.html('star', 14));
    }
    if (favBtn) {
      favBtn.classList.toggle('on', dexFavOn);
      favBtn.onclick = () => { dexFavOn = !dexFavOn; openDex(); };
    }

    // Pestañas de generación, con cuántos tienes de cada una.
    const tabs = $('dex-gens');
    tabs.innerHTML = '';
    GEN_NAMES.forEach((name, i) => {
      const g = i + 1;
      const total = G.DEX.filter(p => p.gen === g).length;
      const have = G.DEX.filter(p => p.gen === g && s.owned[p.dex]).length;
      const b = document.createElement('button');
      const closed = g > G.Progress.region();
      b.className = 'gen-tab' + (!dexFavOn && g === dexGen ? ' on' : '') + (closed ? ' locked' : '');
      b.innerHTML = `<b>${name}</b><small>${closed ? 'Cerrada' : have + '/' + total}</small>`;
      b.onclick = () => { dexFavOn = false; dexGen = g; openDex(); };
      tabs.appendChild(b);
    });

    paintDexFilters();
    let lock = $('dex-lock');
    if (!lock) {
      lock = document.createElement('p');
      lock.id = 'dex-lock';
      lock.className = 'sub';
      $('dex-grid').before(lock);
    }
    if (!dexFavOn && dexGen > G.Progress.region()) {
      lock.classList.remove('hidden');
      lock.textContent = 'Región cerrada. Completa la misión en Región para abrirla.';
    } else lock.classList.add('hidden');
    renderGrid();
    showDetail(dexSel);
  }

  /** Fila Todos/Tengo/Me faltan/Shiny y el panel de rareza y tipo. */
  function paintDexFilters() {
    const fb = $('dex-filters');
    const pop = $('dex-filter-pop');
    const popTop = pop.scrollTop;
    const n = dexRarities.size + dexTypes.size;
    fb.innerHTML = '';
    const tool = document.createElement('button');
    tool.type = 'button';
    tool.id = 'dex-filter-btn';
    tool.className = 'chip' + (dexFilterOpen || n ? ' on' : '');
    tool.innerHTML = 'Filtros' + (n ? ' <b>' + n + '</b>' : '');
    tool.onclick = () => {
      dexFilterOpen = !dexFilterOpen;
      pop.classList.toggle('hidden', !dexFilterOpen);
      tool.classList.toggle('on', dexFilterOpen || dexRarities.size || dexTypes.size);
    };
    fb.appendChild(tool);
    for (const [k, label] of [['all', 'Todos'], ['own', 'Tengo'], ['miss', 'Me faltan'], ['shiny', 'Shiny']]) {
      const c = document.createElement('button');
      c.type = 'button';
      c.className = 'chip' + (k === dexFilter ? ' on' : '');
      c.innerHTML = k === 'shiny' ? G.Icons.html('shiny', 12) + ' Shiny' : label;
      c.onclick = () => { dexFilter = k; paintDexFilters(); refreshDexGrid(); };
      fb.appendChild(c);
    }

    pop.classList.toggle('hidden', !dexFilterOpen);
    pop.innerHTML = `
      <div class="row between dex-filter-head"><h3>Filtros</h3>
        <button type="button" class="btn small ghost" id="dex-filter-close">Cerrar</button></div>
      <p class="dex-filter-label">Rareza</p>
      <div class="dex-filter-opts" id="dex-filter-rarity"></div>
      <div class="dex-filter-line"></div>
      <p class="dex-filter-label">Tipo</p>
      <div class="dex-filter-opts" id="dex-filter-types"></div>
      <button type="button" class="btn small ghost" id="dex-filter-clear">Limpiar</button>`;
    const rar = pop.querySelector('#dex-filter-rarity');
    for (const r of [5, 4, 3, 2, 1]) {
      const c = document.createElement('button');
      c.type = 'button';
      c.className = 'chip' + (dexRarities.has(r) ? ' on' : '');
      c.innerHTML = G.Icons.rarity(r, 12) + ' ' + G.Gacha.RARITY_NAME[r];
      c.onclick = () => {
        if (dexRarities.has(r)) dexRarities.delete(r); else dexRarities.add(r);
        paintDexFilters();
        refreshDexGrid();
      };
      rar.appendChild(c);
    }
    const types = pop.querySelector('#dex-filter-types');
    for (const t of Object.keys(G.U.TYPE_NAME)) {
      const c = document.createElement('button');
      c.type = 'button';
      c.className = 'chip type-opt' + (dexTypes.has(t) ? ' on' : '');
      c.style.setProperty('--type', G.U.TYPE_COLOR[t]);
      c.textContent = G.U.TYPE_NAME[t];
      c.onclick = () => {
        if (dexTypes.has(t)) dexTypes.delete(t); else dexTypes.add(t);
        paintDexFilters();
        refreshDexGrid();
      };
      types.appendChild(c);
    }
    pop.querySelector('#dex-filter-close').onclick = () => {
      dexFilterOpen = false;
      pop.classList.add('hidden');
      const b = $('dex-filter-btn');
      if (b) b.classList.toggle('on', dexRarities.size + dexTypes.size > 0);
    };
    const clear = pop.querySelector('#dex-filter-clear');
    clear.disabled = !n;
    clear.onclick = () => {
      dexRarities.clear();
      dexTypes.clear();
      paintDexFilters();
      refreshDexGrid();
    };
    pop.scrollTop = popTop;
  }

  function refreshDexGrid() {
    const grid = $('dex-grid');
    const top = grid.scrollTop;
    renderGrid();
    grid.scrollTop = top;
  }

  function renderGrid() {
    const s = G.DB.save;
    const grid = $('dex-grid');
    grid.innerHTML = '';
    const anyFav = Object.values(s.dexFav || {}).some(t => t > 0);
    for (const p of G.DEX) {
      if (dexFavOn) { if (!dexMarked(p.dex)) continue; }
      else if (p.gen !== dexGen) continue;
      const own = !!s.owned[p.dex], sh = !!(s.shiny && s.shiny[p.dex]);
      if (dexFilter === 'own' && !own) continue;
      if (dexFilter === 'miss' && own) continue;
      if (dexFilter === 'shiny' && !sh) continue;
      // Varias rarezas o tipos: vale cualquiera. Se cruzan entre sí y con Todos, Tengo, Me faltan y Shiny.
      if (dexRarities.size && !dexRarities.has(p.rarity)) continue;
      if (dexTypes.size && !p.types.some(t => dexTypes.has(t))) continue;

      const cell = document.createElement('div');
      cell.className = 'cell' + (own ? '' : ' locked') + (p.dex === dexSel ? ' on' : '');
      cell.insertAdjacentHTML('beforeend', `<span class="no">${String(p.dex).padStart(3, '0')}</span>`);
      const marks = [];
      if (p.dex === s.partner) marks.push(['markCrown', 'Compañero']);
      if (dexMarked(p.dex)) marks.push(['markStar', 'Favorito']);
      if (sh) marks.push(['markShiny', 'Shiny']);
      if (own && monFullUp(p.dex)) marks.push(['markUp', 'Mejoras al máximo']);
      if (own && monFullIv(p)) marks.push(['markIv', 'IVs al máximo']);
      if (marks.length) cell.insertAdjacentHTML('beforeend', `<span class="cell-marks">${marks.map(([id, t]) => `<i title="${t}">${G.Icons.html(id, 14)}</i>`).join('')}</span>`);
      const useShiny = sh && p.dex === s.partner && s.partnerShiny;
      cell.appendChild(G.UI.spriteCanvas(p.dex, 92, 80, { scale: 2, silhouette: !own, shadow: own, shiny: useShiny }));
      const fr = G.Gacha.lineFrags(s, p.dex);
      cell.insertAdjacentHTML('beforeend', `<b>${own ? p.name : '???'}</b>${G.UI.stars(p.rarity, 9)}` +
        (fr ? `<small class="frag">${G.Icons.html('frag', 12)} ${own ? fr : fr + '/' + G.Gacha.fragNeed(p.rarity)}</small>` : ''));
      cell.onclick = () => {
        dexSel = p.dex;
        grid.querySelectorAll('.cell').forEach(c => c.classList.remove('on'));
        cell.classList.add('on');
        showDetail(p.dex);
      };
      grid.appendChild(cell);
    }
    if (!grid.children.length) {
      grid.innerHTML = dexFavOn && !anyFav
        ? '<p class="sub" style="grid-column:1/-1">Ninguno en favoritos.</p>'
        : '<p class="sub" style="grid-column:1/-1">Ninguno con este filtro.</p>';
    }
  }

  // Variante que se está viendo en la ficha (normal o shiny) y movimiento de la ventana.
  let viewShiny = false, moveSel = null, movePeek = 1;

  function moveOpen() {
    const pop = $('move-pop');
    return !!(pop && !pop.classList.contains('hidden'));
  }

  function markMove() {
    const box = $('dex-detail');
    if (!box) return;
    box.querySelectorAll('[data-move]').forEach(b => b.classList.toggle('on', b.dataset.move === moveSel));
  }

  /** Cierra la ventana del movimiento. Devuelve true si estaba abierta. */
  function closeMove() {
    const was = moveOpen();
    moveSel = null;
    movePeek = 1;
    const pop = $('move-pop');
    if (pop) pop.classList.add('hidden');
    markMove();
    return was;
  }

  function paintMove() {
    const pop = $('move-pop');
    const card = $('move-card');
    if (!pop || !card || !moveSel) return;
    const def = G.Moves.BY_ID[moveSel];
    if (!def) { closeMove(); return; }
    const shown = G.Moves.preview(def.id, movePeek);
    const steps = G.Moves.ladder(def.id);
    card.innerHTML = `
      <div class="row between">
        <h3>${shown.name}</h3>
        <button type="button" class="btn small ghost" id="move-close">Cerrar</button>
      </div>
      <div style="margin:6px 0">${G.UI.typeChips([def.type])}</div>
      <div class="move-ladder">${steps.map(s => `<button type="button" data-step="${s.step}" class="${s.step === movePeek ? 'on' : ''}"><b>${s.label}</b> ${s.text}</button>`).join('')}</div>
      ${shown.desc ? `<p class="sub move-desc">${shown.desc}</p>` : ''}
      ${G.Moves.effects(shown).map(e => `<p class="move-fx ${e.kind}">${e.text}</p>`).join('')}
      <div class="move-facts">${moveFacts(shown).map(([k, v]) => `<span>${k} <b>${v}</b></span>`).join('')}</div>`;
    pop.classList.remove('hidden');
    $('move-close').onclick = () => { G.Audio.sfx('back'); closeMove(); };
    card.querySelectorAll('[data-step]').forEach(b => {
      b.onclick = () => { movePeek = +b.dataset.step; G.Audio.sfx('select'); paintMove(); };
    });
  }

  /** Números del movimiento al nivel 1, para la ficha. */
  function moveFacts(m) {
    const sec = v => v.toLocaleString('es', { maximumFractionDigits: 2 }) + ' s';
    const rows = [];
    const n1 = v => Math.round(v * 10) / 10;
    if (m.dmg != null) rows.push(['Daño', n1(m.dmg)]);
    if (m.cd != null) rows.push(['Recarga', sec(m.cd)]);
    if (m.kind === 'buff') {
      const STAT = { atk: 'Ataque', spd: 'Velocidad', def: 'Defensa', regen: 'Regeneración' };
      if (m.amount != null) rows.push([STAT[m.stat] || 'Efecto',
        m.stat === 'regen' ? '+' + m.amount.toLocaleString('es', { maximumFractionDigits: 1 }) + '/s' : '+' + Math.round(m.amount * 100) + '%']);
      if (m.dur) rows.push(['Duración', sec(m.dur)]);
      if (m.stacks) rows.push(['Acumulaciones', m.stacks]);
    } else {
      if (m.count) rows.push(['Cantidad', m.count]);
      if (m.radius) rows.push(['Alcance', n1(m.radius)]);
      if (m.pierce) rows.push(['Perforación', m.pierce]);
      if (m.dur) rows.push(['Duración', sec(m.dur)]);
    }
    const fx = [];
    if (m.burn) fx.push('Quema');
    if (m.poison) fx.push('Envenena');
    if (m.slow) fx.push('Ralentiza');
    if (fx.length) rows.push(['Efecto', fx.join(', ')]);
    return rows;
  }

  /** Botón + de una estadística, con lo que cuesta. Vacío si ya está al tope. */
  function growBtn(p, s, st) {
    if (G.Gacha.atCap(p, s, st)) return '<span class="stat-plus"></span>';
    const cost = G.Gacha.growCost(p, s, st);
    const ok = G.Gacha.lineFrags(s, p.dex) >= cost;
    return `<button type="button" class="stat-plus" data-grow="${st}" data-sfx="${ok ? 'buy' : 'none'}" ${ok ? '' : 'disabled'}>+${G.Icons.html('frag', 12)}${cost}</button>`;
  }

  function showDetail(dex) {
    const s = G.DB.save;
    const p = G.DEX_BY[dex];
    const own = !!s.owned[dex];
    const hasSh = G.DB.ownsShiny(dex);
    const isPartner = dex === s.partner;
    if (dex !== showDetail.last) closeMove();
    if (!hasSh) viewShiny = false;
    else if (isPartner && dex !== showDetail.last) viewShiny = !!s.partnerShiny;
    showDetail.last = dex;

    const moves = G.Moves.poolFor(p);
    const startId = G.startMoveOf(dex);
    if (moves.indexOf(startId) < 0) moves.unshift(startId);
    if (moveSel && moves.indexOf(moveSel) < 0) closeMove();

    const gstat = G.Gacha.grown(p, s);
    const haveF = G.Gacha.lineFrags(s, dex);
    const fragMul = G.Evo.stage(dex);
    const bar = (label, stat, v, cap, txt) =>
      `<div class="stat"><span>${label}</span><div class="bar"><i style="width:${Math.min(100, v / Math.max(v, cap) * 100)}%"></i></div><span class="stat-n">${txt}</span>${own ? growBtn(p, s, stat) : ''}</div>`;
    const usingThis = isPartner && (!hasSh || !!s.partnerShiny === viewShiny);

    const fav = dexMarked(dex);
    const box = $('dex-detail');
    box.innerHTML = `
      <div class="stage-wrap">
        <canvas id="dex-big" class="stage" width="156" height="132"></canvas>
        <button type="button" class="dex-star${fav ? ' on' : ''}" id="dex-star" data-sfx="none" title="${fav ? 'Quitar de favoritos' : 'Añadir a favoritos'}">${G.Icons.html(fav ? 'star' : 'starDim', 12)}</button>
      </div>
      ${hasSh ? `<div class="seg">
          <button class="${viewShiny ? '' : 'on'}" data-v="0">Normal</button>
          <button class="${viewShiny ? 'on' : ''}" data-v="1">${G.Icons.html('shiny', 12)} Shiny</button></div>` : ''}
      <div class="center">
        <div style="color:var(--muted);font-size:13px">Nº ${String(p.dex).padStart(3, '0')} · ${GEN_NAMES[p.gen - 1]}</div>
        <h3>${own ? p.name : '???'}</h3>
        <div style="color:${G.Gacha.RARITY_COLOR[p.rarity]}">${G.UI.stars(p.rarity, 24)} ${G.Gacha.RARITY_NAME[p.rarity]}</div>
        <div style="margin:6px 0">${own ? G.UI.typeChips(p.types) : ''}</div>
      </div>
      ${own ? `
        ${bar('Vida', 'hp', gstat.hp, G.Gacha.CAP.hp, gstat.hp)}
        ${bar('Ataque', 'atk', gstat.atk, G.Gacha.CAP.atk, '×' + gstat.atk.toFixed(2))}
        ${bar('Velocidad', 'spd', gstat.spd, G.Gacha.CAP.spd, gstat.spd)}
        <p class="stat-have">${G.Icons.html('frag', 16)} <b>${haveF}</b></p>
        <p style="font-size:14px;margin:10px 0 4px">Empieza con <b class="gold">${G.Moves.BY_ID[G.startMoveOf(dex)].name}</b></p>
        <div class="move-icons" title="Movimientos que puede aprender">
          ${moves.map(id => `<button type="button" class="move-ico${id === moveSel ? ' on' : ''}" data-move="${id}" title="${G.Moves.BY_ID[id].name}">${G.Icons.html('move:' + id, 16)}</button>`).join('')}</div>
        ${usingThis
          ? '<button class="btn grow" disabled style="width:100%">Es tu compañero</button>'
          : `<button id="dex-pick" class="btn gold" data-sfx="confirm" style="width:100%">Elegir de compañero${viewShiny ? ' (shiny)' : ''}</button>`}
      ` : `<p class="center" style="color:var(--muted)">Aún no lo tienes.<br>Consíguelo en el banner de <b class="gold">${GEN_NAMES[p.gen - 1]}</b>
            o derrotándolo cuando salga shiny.</p>
            ${haveF ? `<p class="center stat-have">${G.Icons.html('frag', 16)} Fragmentos de la línea ${haveF} / ${G.Gacha.fragNeed(p.rarity)} · esta etapa da ×${fragMul}</p>` : ''}
            ${G.UI.helpersOn() ? '<button id="dex-grant" class="btn gold" style="width:100%;margin-top:8px">Obtener este</button>' : ''}`}
    `;
    const starBtn = $('dex-star');
    if (starBtn) starBtn.onclick = () => {
      toggleDexFav(dex);
      G.Audio.sfx('select');
      const grid = $('dex-grid');
      const top = grid.scrollTop;
      renderGrid();
      grid.scrollTop = top;
      showDetail(dex);
    };
    $('dex-big').style.setProperty('--stage-c', !own ? '#5b83d6' : viewShiny ? '#9ae6ff' : G.U.TYPE_COLOR[p.types[0]]);
    $('dex-big').classList.toggle('shiny', own && viewShiny);
    G.UI.sprite($('dex-big'), dex, { lively: own, spin: own, silhouette: !own, scale: 3, hero: true, shiny: own && viewShiny });
    box.querySelectorAll('.seg button').forEach(b => {
      b.onclick = () => { viewShiny = b.dataset.v === '1'; showDetail(dex); };
    });
    box.querySelectorAll('[data-move]').forEach(b => {
      b.onclick = () => {
        if (b.dataset.move === moveSel && moveOpen()) closeMove();
        else { moveSel = b.dataset.move; movePeek = 1; markMove(); paintMove(); }
        G.Audio.sfx('select');
      };
    });
    box.querySelectorAll('[data-grow]').forEach(b => {
      b.onclick = () => {
        if (!G.Gacha.grow(G.DB.save, dex, b.dataset.grow)) return;
        G.DB.commit(true);
        G.UI.refreshCoins();
        const grid = $('dex-grid');
        const top = grid.scrollTop;
        renderGrid();
        grid.scrollTop = top;
        showDetail(dex);
      };
    });
    const grantOne = $('dex-grant');
    if (grantOne) grantOne.onclick = () => {
      if (!G.DB.save || G.DB.owns(dex)) return;
      G.DB.grant(dex, 'dev');
      G.DB.commit(true);
      G.UI.toast(G.DB.guest ? p.name + ' (invitado: no se guarda)' : p.name + ' añadido a tu colección');
      openDex();
    };
    const pick = $('dex-pick');
    if (pick) pick.onclick = () => {
      s.partner = dex;
      s.partnerShiny = hasSh && viewShiny;
      G.DB.commit();
      G.UI.toast(p.name + (s.partnerShiny ? ' shiny' : '') + ' es ahora tu compañero');
      renderGrid(); showDetail(dex);
    };
  }

  // ---------------- mejoras ----------------

  let upgDex = null;
  let upgCat = 'mon';
  const UPG_NOTE = {
    mon: 'Cada Pokémon tiene las suyas. Sólo cuentan cuando juegas con él.',
    run: 'Valen en todas las partidas, con cualquier Pokémon.',
    rift: 'Valen al entrar en una grieta.',
    tower: 'Valen en todas las torres.'
  };

  /**
   * Un clic compra uno; si mantienes, sigue comprando hasta que no alcance
   * o sueltes. step() debe devolver false para parar. onEnd al soltar o al tope.
   */
  function holdBuy(btn, step, onEnd) {
    let delay = 0, rep = 0, on = false;
    const stop = () => {
      if (!on) return;
      on = false;
      clearTimeout(delay); clearInterval(rep);
      delay = rep = 0;
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      if (onEnd) onEnd();
    };
    const go = () => { if (on && !step()) stop(); };
    btn.addEventListener('pointerdown', e => {
      if (btn.disabled || (e.button != null && e.button !== 0)) return;
      e.preventDefault();
      stop();
      on = true;
      go();
      if (!on) return;
      delay = setTimeout(() => { if (on) rep = setInterval(go, 70); }, 320);
      window.addEventListener('pointerup', stop);
      window.addEventListener('pointercancel', stop);
    });
  }

  function openUpgrades() {
    G.UI.show('scr-upgrades', true);
    const s = G.DB.save;
    if (!upgDex || !s.owned[upgDex]) upgDex = s.partner;
    // Selector con tus Pokémon: el compañero primero, luego los que ya tienen mejoras.
    const sel = $('upg-mon');
    const lv = d => Object.values(s.pupg[d] || {}).reduce((a, b) => a + b, 0);
    const mons = Object.keys(s.owned).map(Number).filter(d => G.DEX_BY[d])
      .sort((a, b) => (b === s.partner) - (a === s.partner) || lv(b) - lv(a) || a - b);
    sel.innerHTML = mons.map(d => `<option value="${d}">${G.DEX_BY[d].name}${d === s.partner ? ' (compañero)' : ''}${lv(d) ? ' · ' + lv(d) + ' niveles' : ''}</option>`).join('');
    sel.value = upgDex;
    sel.onchange = () => { upgDex = +sel.value; G.Audio.sfx('select'); renderUpgrades(); };
    const tabs = $('upg-tabs');
    tabs.innerHTML = G.Upgrades.CATS.map(c =>
      '<button type="button" class="gen-tab' + (c.id === upgCat ? ' on' : '') + '" data-cat="' + c.id + '"><b>' + c.name + '</b></button>'
    ).join('');
    tabs.querySelectorAll('[data-cat]').forEach(b => {
      b.onclick = () => { upgCat = b.dataset.cat; G.Audio.sfx('select'); openUpgrades(); };
    });
    renderUpgrades();
  }

  function renderUpgrades() {
    const s = G.DB.save;
    const monTab = upgCat === 'mon';
    const levels = monTab ? G.DB.upgradesOf(upgDex) : G.DB.globalUpgrades();
    const mon = G.DEX_BY[upgDex];
    $('upg-note').textContent = UPG_NOTE[upgCat] || '';
    $('upg-stage').style.display = monTab ? '' : 'none';
    $('upg-pick').style.display = monTab ? '' : 'none';
    if (monTab) {
      const shiny = upgDex === s.partner && !!s.partnerShiny && G.DB.ownsShiny(upgDex);
      G.UI.sprite($('upg-stage'), upgDex, { lively: true, scale: 2, hero: true, shiny });
      $('upg-stage').style.setProperty('--stage-c', shiny ? '#9ae6ff' : G.U.TYPE_COLOR[mon.types[0]]);
    }
    const box = $('upg-list');
    box.innerHTML = '';
    for (const u of G.Upgrades.LIST) {
      if (u.cat !== upgCat) continue;
      const lvl = levels[u.id] || 0;
      const maxed = lvl >= u.max;
      const cost = maxed ? 0 : G.Upgrades.cost(u.id, lvl);
      const el = document.createElement('div');
      el.className = 'panel upg-item';
      el.innerHTML = `
        <div class="ic">${G.Icons.html(u.icon, 32)}</div>
        <div>
          <b>${u.name}</b> <span style="color:var(--muted);font-size:13px">${u.unit}</span>
          <div class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>
        </div>
        <div class="upg-btns">
          ${u.id === 'ban' && lvl > 0 ? `<button class="btn small" data-ban>Elegir (${banList().length}/${lvl})</button>` : ''}
          <button class="btn small ${maxed ? '' : 'gold'}" data-buy data-sfx="none" ${maxed || s.coins < cost ? 'disabled' : ''}>
          ${maxed ? 'Máx.' : `<span class="coin"></span> ${G.U.num(cost)}`}</button></div>`;
      if (u.id === 'ban' && lvl > 0 && monTab) el.querySelector('[data-ban]').onclick = () => { banOpen = !banOpen; renderUpgrades(); };
      const buyBtn = el.querySelector('[data-buy]');
      let bought = 0;
      holdBuy(buyBtn, () => {
        // Se vuelve a leer todo al pulsar (la partida puede haber cambiado desde que se dibujó).
        const sv = G.DB.save;
        const lv = monTab ? G.DB.upgradesOf(upgDex) : G.DB.globalUpgrades();
        const now = lv[u.id] || 0;
        if (now >= u.max) return false;
        const price = G.Upgrades.cost(u.id, now);
        if (sv.coins < price) return false;
        sv.coins -= price;
        if (G.Pass) G.Pass.goldSpend(price);
        lv[u.id] = now + 1;
        bought = now + 1;
        G.DB.commit(true);
        G.Audio.sfx('buy');
        G.UI.refreshCoins();
        const pips = el.querySelectorAll('.pips i');
        if (pips[now]) pips[now].classList.add('on');
        const next = now + 1;
        if (next >= u.max) {
          buyBtn.textContent = 'Máx.';
          buyBtn.disabled = true;
          buyBtn.classList.remove('gold');
          return false;
        }
        const nextPrice = G.Upgrades.cost(u.id, next);
        buyBtn.innerHTML = `<span class="coin"></span> ${G.U.num(nextPrice)}`;
        if (sv.coins < nextPrice) { buyBtn.disabled = true; return false; }
        return true;
      }, () => {
        if (!bought) return;
        G.UI.toast((monTab ? mon.name + ' · ' : '') + u.name + ': nivel ' + bought);
        bought = 0;
        renderUpgrades();
      });
      box.appendChild(el);
      if (monTab && u.id === 'ban' && lvl > 0 && banOpen) box.appendChild(banPicker(lvl));
    }
    if (monTab) box.appendChild(bindPanel());
  }

  // ---------------- atajos: hueco fijo para cada movimiento ----------------
  // save.pbind[dex] = [movimiento del hueco 1, del 2, del 3, del 4] (o null).
  function bindPanel() {
    const s = G.DB.save;
    s.pbind = s.pbind || {};
    const list = s.pbind[upgDex] || [null, null, null, null];
    const mon = G.DEX_BY[upgDex];
    const ids = G.Moves.poolFor(mon).concat([G.startMoveOf(upgDex)]).filter((v, i, a) => a.indexOf(v) === i)
      .sort((a, b) => G.Moves.BY_ID[a].name.localeCompare(G.Moves.BY_ID[b].name, 'es'));
    const el = document.createElement('div');
    el.className = 'panel bind-panel';
    el.innerHTML = `<b>Atajos de movimientos</b>
      <p class="sub" style="margin:2px 0 8px">Elige qué movimiento va siempre en cada hueco (teclas 1-4 o los iconos de abajo), para la memoria muscular. Si aún no tienes tantos movimientos, va al hueco más cercano.</p>
      <div class="bind-slots">${[0, 1, 2, 3].map(i => `<label class="bind-slot"><span>${i + 1}</span>
        <select class="field" data-slot="${i}"><option value="">Libre</option>${ids.map(id =>
          `<option value="${id}" ${list[i] === id ? 'selected' : ''}>${G.Moves.BY_ID[id].name}</option>`).join('')}</select></label>`).join('')}</div>`;
    el.querySelectorAll('select[data-slot]').forEach(sel => {
      sel.onchange = () => {
        const l = (s.pbind[upgDex] || [null, null, null, null]).slice(0, 4);
        while (l.length < 4) l.push(null);
        const i = +sel.dataset.slot, id = sel.value || null;
        // Un movimiento sólo puede estar en un hueco.
        for (let j = 0; j < 4; j++) if (id && l[j] === id) l[j] = null;
        l[i] = id;
        s.pbind[upgDex] = l;
        G.DB.commit();
        G.Audio.sfx('select');
        renderUpgrades();
      };
    });
    return el;
  }

  // ---------------- veto: movimientos bloqueados ----------------
  // Lista por Pokémon en save.pban[dex]; con N niveles de Veto, N movimientos.
  let banOpen = false;
  function banList() {
    const s = G.DB.save;
    s.pban = s.pban || {};
    return s.pban[upgDex] || (s.pban[upgDex] = []);
  }
  function banPicker(max) {
    const mon = G.DEX_BY[upgDex];
    const start = G.startMoveOf(upgDex);
    const ids = G.Moves.poolFor(mon).filter(id => id !== start)
      .sort((a, b) => G.Moves.BY_ID[a].name.localeCompare(G.Moves.BY_ID[b].name, 'es'));
    const list = banList();
    const el = document.createElement('div');
    el.className = 'panel ban-picker';
    el.innerHTML = `<p class="sub" style="margin:0 0 8px">Toca los movimientos que no quieres que te salgan en las cartas (${list.length}/${max}). El movimiento de inicio no se puede vetar.</p>
      <div class="ban-moves">${ids.map(id => { const d = G.Moves.BY_ID[id]; const on = list.includes(id);
        return `<button class="chip ${on ? 'on ban' : ''}" data-id="${id}">${G.Icons.html('move:' + id, 16)} ${d.name}${on ? ' ' + G.Icons.html('ban', 14) : ''}</button>`; }).join('')}</div>`;
    el.querySelectorAll('[data-id]').forEach(b => {
      b.onclick = () => {
        const l = banList(), id = b.dataset.id, i = l.indexOf(id);
        if (i >= 0) l.splice(i, 1);
        else if (l.length >= max) { G.UI.toast('Ya tienes ' + max + ' vetados: quita uno primero'); return; }
        else l.push(id);
        G.DB.commit();
        G.Audio.sfx('select');
        renderUpgrades();
      };
    });
    return el;
  }

  return { init, open, closeMove, GEN_NAMES };
})();
