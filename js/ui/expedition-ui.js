/* ============ expedition-ui.js — ventana de expedición ============ */
G.ExpeditionUI = (() => {
  const $ = G.UI.$;
  let biome = 0;
  let selected = 0;
  let draft = null;
  let pickSlot = 0;
  let pickDex = null;
  let pickFilt = 'good';
  let timer = 0;
  let swipeX = null;

  function cur() { return G.Expedition.BIOMES[biome]; }

  function blurb(b) {
    return 'Aventúrate con tu compañero en una aventura por ' + b.where + '.';
  }
  function bonusLabel(plan) {
    if (!plan || !plan.bonus || !plan.bonusEvery) return '';
    const min = Math.round(plan.bonusEvery / 60000);
    const pct = Math.round((plan.chance != null ? +plan.chance : plan.bonus > 0 ? 0.65 : 0.5) * 100);
    if (!(pct > 0)) return '';
    if (plan.bonus > 0) return pct + '% de 1 extra cada ' + min + ' min';
    return pct + '% de perder 1 cada ' + min + ' min';
  }
  function capLabel(ms) {
    if (!(ms > 0) || ms === G.Expedition.MAX_MS) return '';
    return 'hasta ' + Math.round(ms / 3600000) + ' h';
  }

  function clock(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h) return h + ':' + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
    return m + ':' + String(sec).padStart(2, '0');
  }
  function everyLabel(ms) {
    const min = Math.round(ms / 60000);
    return 'cada ' + min + ' min';
  }
  function photo(b) { return 'assets/biome/' + encodeURI(b.file); }

  function init() {
    $('exp-prev').dataset.sfx = 'select';
    $('exp-next').dataset.sfx = 'select';
    $('exp-prev').onclick = () => shift(-1);
    $('exp-next').onclick = () => shift(1);
    $('exp-go').onclick = go;
    $('exp-pick-x').onclick = closePick;
    $('exp-choose').onclick = choose;
    $('exp-search').addEventListener('input', () => { if (!$('exp-pick').classList.contains('hidden')) renderGrid(); });
    const stage = $('exp-stage');
    stage.addEventListener('pointerdown', e => {
      if (e.target.closest('.exp-arrow')) return;
      swipeX = e.clientX;
    });
    stage.addEventListener('pointerup', e => {
      if (swipeX == null) return;
      const dx = e.clientX - swipeX;
      swipeX = null;
      if (Math.abs(dx) < 40) return;
      shift(dx < 0 ? 1 : -1);
    });
    stage.addEventListener('pointercancel', () => { swipeX = null; });
    document.addEventListener('keydown', e => {
      if (!G.UI.isOpen('scr-expedition') || !$('exp-pick').classList.contains('hidden')) return;
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowLeft') shift(-1);
      else if (e.key === 'ArrowRight') shift(1);
    });
  }

  function shift(dir) {
    const n = G.Expedition.BIOMES.length;
    biome = (biome + dir + n) % n;
    paintBiome();
    paintLive();
    paintRate();
  }

  function open() {
    const s = G.DB.save;
    if (!s) return;
    G.Expedition.clean(s);
    draft = null;
    selected = 0;
    closePick();
    G.UI.show('scr-expedition', true);
    paintBiome();
    paintSlots();
    clearInterval(timer);
    timer = setInterval(() => {
      if (!G.UI.isOpen('scr-expedition')) { clearInterval(timer); timer = 0; return; }
      paintLive();
    }, 1000);
  }

  function paintBiome() {
    const b = cur();
    $('exp-help').textContent = blurb(b);
    const img = $('exp-photo');
    img.src = photo(b);
    img.alt = b.name;
    $('exp-name').textContent = b.name;
    $('exp-types').innerHTML = G.UI.typeChips(b.types);
    $('exp-dots').innerHTML = G.Expedition.BIOMES.map((bb, i) =>
      '<button type="button" class="exp-dot' + (i === biome ? ' on' : '') + '" data-i="' + i + '" data-sfx="select" aria-label="' + bb.name + '"></button>'
    ).join('');
    $('exp-dots').querySelectorAll('[data-i]').forEach(btn => {
      btn.onclick = () => { biome = +btn.dataset.i; paintBiome(); paintLive(); paintRate(); };
    });
    paintRate();
  }

  function paintRate() {
    const s = G.DB.save;
    const el = $('exp-rate');
    const spot = s.expd[selected];
    if (spot) {
      const mon = G.DEX_BY[spot.dex];
      const b = G.Expedition.BY[spot.biome];
      const p = G.Expedition.progress(spot);
      const cond = G.Expedition.COND[spot.cond] || '';
      const gain = spot.gain === 1 ? '1 fragmento' : spot.gain + ' fragmentos';
      const extra = bonusLabel(spot);
      const cap = capLabel(spot.maxMs);
      const tail = p.done ? 'Completo' : 'siguiente en ' + clock(p.next);
      el.textContent = (mon ? mon.name : '') + ' en ' + (b ? b.name : '') + ' · ' + cond + ' · ' +
        everyLabel(spot.every) + ' · ' + gain + (extra ? ' · ' + extra : '') + (cap ? ' · ' + cap : '') + ' · ' + tail;
      return;
    }
    if (draft && draft.slot === selected) {
      const plan = G.Expedition.preview(s, draft.dex, cur().id);
      const mon = G.DEX_BY[draft.dex];
      if (plan && mon) {
        const gain = plan.gain === 1 ? '1 fragmento por ronda' : plan.gain + ' fragmentos por ronda';
        const extra = bonusLabel(plan);
        const cap = capLabel(plan.maxMs);
        el.textContent = mon.name + ' · ' + plan.name + ' · ' + everyLabel(plan.every) + ' · ' + gain +
          (extra ? ' · ' + extra : '') + (cap ? ' · ' + cap : '');
        return;
      }
    }
    const more = G.Expedition.slotCount(s) >= 1 + G.Upgrades.BY.expslot.max;
    el.textContent = more
      ? 'Hueco vacío. Elige un Pokémon y se irá a ' + cur().name + '.'
      : 'Hueco vacío. Elige un Pokémon y se irá a ' + cur().name + '. Más huecos, en Mejoras.';
  }

  function paintSlots() {
    const s = G.DB.save;
    const box = $('exp-slots');
    box.innerHTML = '';
    s.expd.forEach((spot, i) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'exp-slot' + (i === selected ? ' on' : '');
      el.dataset.slot = String(i);
      const drafted = !spot && draft && draft.slot === i;
      const mon = spot ? G.DEX_BY[spot.dex] : drafted ? G.DEX_BY[draft.dex] : null;
      const shiny = !!(mon && mon.dex === s.partner && s.partnerShiny && G.DB.ownsShiny(mon.dex));
      let cap = 'Vacío';
      if (spot) cap = G.Expedition.COND[spot.cond] || 'En marcha';
      else if (drafted) cap = 'Preparado';
      const bg = spot ? photo(G.Expedition.BY[spot.biome] || cur()) : '';
      el.innerHTML =
        '<span class="exp-time" data-live="' + i + '">' + cap + '</span>' +
        '<span class="exp-face' + (bg ? ' has' : '') + '"' + (bg ? ' style="background-image:url(\'' + bg + '\')"' : '') + '>' +
          (mon ? '<canvas width="112" height="84"></canvas>' : '<span class="exp-plus">+</span>') +
        '</span>' +
        '<b>' + (mon ? mon.name : 'Vacío') + '</b>' +
        '<small class="exp-meta" data-meta="' + i + '"></small>';
      if (mon) {
        const cv = el.querySelector('canvas');
        cv.style.setProperty('--stage-c', shiny ? '#9ae6ff' : G.U.TYPE_COLOR[mon.types[0]]);
        G.UI.sprite(cv, mon.dex, { lively: true, scale: 2, shiny });
      }
      el.onclick = () => pickSlotClick(i);
      box.appendChild(el);
    });
    paintLive();
    paintGo();
  }

  function paintLive() {
    const s = G.DB.save;
    if (!s || !s.expd) return;
    document.querySelectorAll('#exp-slots [data-live]').forEach(node => {
      const i = +node.dataset.live;
      const spot = s.expd[i];
      if (!spot) {
        node.textContent = draft && draft.slot === i ? 'Preparado' : 'Vacío';
        return;
      }
      const p = G.Expedition.progress(spot);
      node.textContent = p.done ? 'Completo' : clock(p.next);
    });
    document.querySelectorAll('#exp-slots [data-meta]').forEach(node => {
      const i = +node.dataset.meta;
      const spot = s.expd[i];
      if (!spot) {
        if (draft && draft.slot === i) {
          const plan = G.Expedition.preview(s, draft.dex, cur().id);
          node.textContent = plan ? plan.name : '';
        } else node.textContent = '';
        return;
      }
      const p = G.Expedition.progress(spot);
      const word = p.frags === 1 ? '1 fragmento' : p.frags + ' fragmentos';
      node.textContent = p.done ? word : word + ' · quedan ' + clock(p.left);
    });
    if (s.expd[selected]) paintRate();
  }

  function paintGo() {
    const s = G.DB.save;
    const btn = $('exp-go');
    const spot = s.expd[selected];
    if (spot) {
      btn.textContent = 'Llamar';
      btn.disabled = false;
      return;
    }
    btn.textContent = 'Enviar';
    btn.disabled = !(draft && draft.slot === selected);
  }

  function pickSlotClick(i) {
    selected = i;
    const spot = G.DB.save.expd[i];
    if (!spot && draft && draft.slot !== i) draft = null;
    paintSlots();
    if (!spot) openPick(i);
  }

  function openPick(i) {
    pickSlot = i;
    pickDex = draft && draft.slot === i ? draft.dex : null;
    pickFilt = 'good';
    $('exp-search').value = '';
    $('exp-pick-sub').textContent = 'Se irá a ' + cur().name + '.';
    $('exp-pick').classList.remove('hidden');
    renderFilters();
    renderBerries();
    renderGrid();
  }
  function closePick() { $('exp-pick').classList.add('hidden'); }

  function renderFilters() {
    const opts = [['good', 'Buena'], ['neutral', 'Neutral'], ['bad', 'Mala'], ['all', 'Todos']];
    $('exp-filt').innerHTML = opts.map(([id, name]) =>
      '<button type="button" class="chip' + (pickFilt === id ? ' on' : '') + '" data-f="' + id + '">' + name + '</button>'
    ).join('');
    $('exp-filt').querySelectorAll('[data-f]').forEach(b => {
      b.onclick = () => { pickFilt = b.dataset.f; renderFilters(); renderGrid(); };
    });
  }

  function renderBerries() {
    const box = $('exp-berries');
    const name = pickDex ? G.GardenUI.label(pickDex) : 'Ninguna';
    box.innerHTML = '<div class="exp-berry-row"><b>Baya</b>' +
      '<button type="button" class="exp-berry" id="exp-berry-btn">' + G.Icons.html('berry', 28) + '<small>' + name + '</small></button></div>' +
      '<p class="sub exp-berry-note">Cada Pokémon lleva una. La eliges aquí o en su ficha.</p>';
    $('exp-berry-btn').onclick = () => {
      if (!pickDex) { G.UI.toast('Elige un Pokémon'); return; }
      G.GardenUI.openBag(pickDex, () => { renderBerries(); if (draft && draft.dex === pickDex) paintRate(); });
    };
  }

  function renderGrid() {
    const s = G.DB.save;
    const q = ($('exp-search').value || '').trim().toLowerCase();
    const out = new Set(G.Expedition.busy(s).map(e => e.dex));
    const grid = $('exp-grid');
    grid.innerHTML = '';
    const list = Object.keys(s.owned).map(Number).filter(d => G.DEX_BY[d]);
    list.sort((a, b) => G.DEX_BY[a].name.localeCompare(G.DEX_BY[b].name, 'es'));
    let shown = 0;
    for (const dex of list) {
      const mon = G.DEX_BY[dex];
      if (q && mon.name.toLowerCase().indexOf(q) < 0) continue;
      const plan = G.Expedition.preview(s, dex, cur().id);
      if (!plan) continue;
      if (!q && pickFilt !== 'all' && plan.cond !== pickFilt) continue;
      const away = out.has(dex);
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell' + (dex === pickDex ? ' on' : '') + (away ? ' locked' : '');
      cell.dataset.dex = String(dex);
      cell.innerHTML = '<canvas width="96" height="72"></canvas><b>' + mon.name + '</b>' +
        '<span class="frag exp-' + plan.cond + '">' + plan.name + '</span>';
      const cv = cell.querySelector('canvas');
      const shiny = dex === s.partner && !!s.partnerShiny && G.DB.ownsShiny(dex);
      G.UI.sprite(cv, dex, { scale: 2, shiny, lively: !away });
      if (away) cell.disabled = true;
      else cell.onclick = () => {
        pickDex = dex;
        grid.querySelectorAll('.cell.on').forEach(c => c.classList.remove('on'));
        cell.classList.add('on');
        renderBerries();
      };
      grid.appendChild(cell);
      shown++;
    }
    if (!shown) grid.innerHTML = '<p class="sub" style="grid-column:1/-1">Ninguno con este filtro. Prueba con Todos o con el buscador.</p>';
  }

  function choose() {
    if (!pickDex || !G.DB.save.owned[pickDex]) { G.UI.toast('Elige un Pokémon'); return; }
    if (G.Expedition.busy(G.DB.save).some(e => e.dex === pickDex)) { G.UI.toast('Ese Pokémon ya está de expedición'); return; }
    draft = { slot: pickSlot, dex: pickDex };
    selected = pickSlot;
    closePick();
    paintSlots();
    paintRate();
  }

  function go() {
    const s = G.DB.save;
    const spot = s.expd[selected];
    if (spot) {
      const back = G.Expedition.recall(s, selected);
      if (!back) return;
      G.DB.commit(true);
      const mon = G.DEX_BY[back.dex];
      const name = mon ? mon.name : '';
      G.UI.toast(back.frags
        ? name + ' vuelve con ' + back.frags + (back.frags === 1 ? ' fragmento' : ' fragmentos')
        : name + ' vuelve sin fragmentos');
      G.Audio.sfx(back.frags ? 'buy' : 'click');
      paintSlots();
      paintRate();
      return;
    }
    if (!draft || draft.slot !== selected) return;
    const sent = G.Expedition.send(s, selected, draft.dex, cur().id);
    if (!sent) { G.UI.toast('No se pudo enviar'); return; }
    draft = null;
    G.DB.commit(true);
    const mon = G.DEX_BY[sent.dex];
    G.UI.toast((mon ? mon.name : '') + ' sale hacia ' + cur().name);
    G.Audio.sfx('confirm');
    paintSlots();
    paintRate();
  }

  return { init, open };
})();
