/* ============ garden-ui.js — huerto, tienda de semillas y mochila de bayas ============
 * La mochila solo se abre al poner o cambiar la baya de un Pokémon.
 */
G.GardenUI = (() => {
  const $ = G.UI.$;
  const sheets = {};
  let raf = 0;
  let bagDex = null;
  let bagDone = null;
  let seedPlot = 0;
  let seedSlot = 0;
  let plotSig = '';
  let seenShop = 0;

  function clock(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h) return h + ':' + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
    return m + ':' + String(sec).padStart(2, '0');
  }

  function spritesReady() {
    plotSig = '';
    const shop = $('garden-shop-list');
    if (shop) shop.dataset.sig = '';
    if ($('seed-bag') && !$('seed-bag').classList.contains('hidden')) paintSeeds();
    if ($('berry-bag') && !$('berry-bag').classList.contains('hidden')) paintBag();
  }

  function load(name) {
    const img = new Image();
    img.onload = spritesReady;
    img.src = 'assets/berries/' + name;
    return img;
  }

  function init() {
    sheets.bayas = load('bayas.png');
    sheets.bush = load('arbusto.png');
    $('garden-shop').onclick = openShop;
    $('garden-shop-x').onclick = closeShop;
    $('berry-bag-x').onclick = closeBag;
    $('seed-bag-x').onclick = closeSeeds;
  }

  function loop() {
    if (!G.UI.isOpen('scr-garden')) { raf = 0; return; }
    paintPlots();
    const at = G.DB.save.garden.shopAt;
    if (seenShop && at !== seenShop) G.DB.commit(true);
    seenShop = at;
    const left = G.Garden.shopLeft(G.DB.save);
    const shop = $('garden-shop-panel');
    if (shop && !shop.classList.contains('hidden')) paintShop(left);
    raf = requestAnimationFrame(loop);
  }

  function open() {
    const s = G.DB.save;
    if (!s) return;
    const before = s.garden && s.garden.shopAt;
    G.Garden.clean(s);
    if (s.garden.shopAt !== before) G.DB.commit(true);
    G.UI.show('scr-garden');
    paintPlots();
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function pct(plot) {
    const [x, y, w, h] = plot;
    const m = G.Berries.MAP;
    return 'left:' + (x / m.w * 100) + '%;top:' + (y / m.h * 100) + '%;width:' + (w / m.w * 100) + '%;height:' + (h / m.h * 100) + '%';
  }

  function drawBerry(ctx, id, x, y, w, h, bob) {
    const def = G.Berries.BY[id];
    const im = sheets.bayas;
    if (!def || !im || !im.complete) return;
    const oy = bob ? Math.sin(performance.now() / 280 + x) * 1.6 : 0;
    const [sx, sy, sw, sh] = def.rect;
    ctx.drawImage(im, sx, sy, sw, sh, x, y + oy, w, h);
  }

  function drawSlot(cv, plant) {
    const ctx = cv.getContext('2d');
    const w = cv.width, h = cv.height;
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;
    if (!plant) return;
    const g = G.Garden.growth(plant);
    const bush = sheets.bush;
    const frame = G.Berries.BUSH[g.phase <= 0 ? 0 : g.phase === 1 ? 1 : 2];
    if (bush && bush.complete && frame) {
      const [sx, sy, sw, sh] = frame;
      const dw = Math.round(w * 0.92);
      const dh = Math.round(dw * sh / sw);
      ctx.drawImage(bush, sx, sy, sw, sh, Math.round((w - dw) / 2), h - dh - 2, dw, dh);
    }
    if (g.phase >= 3) {
      const n = 1 + Math.floor(G.Garden.roll(plant.at, 40, 0) * 6);
      const bob = g.phase === 3;
      for (let i = 0; i < n; i++) {
        const ang = G.Garden.roll(plant.at, 41, i) * 6.2832;
        const rad = 8 + G.Garden.roll(plant.at, 42, i) * 16;
        const bx = w * 0.5 + Math.cos(ang) * rad - 8;
        const by = h * 0.42 + Math.sin(ang) * rad * 0.45 - 8;
        drawBerry(ctx, plant.id, bx, by, 16, 16, bob);
      }
    }
    if (g.ready) {
      ctx.fillStyle = 'rgba(255, 210, 63, .85)';
      ctx.beginPath();
      ctx.arc(w * 0.5, 16, 14, 0, 6.2832);
      ctx.fill();
      drawBerry(ctx, plant.id, w * 0.5 - 10, 6, 20, 20, true);
    }
  }

  function stateSig(s) {
    const g = s.garden;
    const parts = [String(g.open)];
    for (let i = 0; i < 12; i++) {
      for (const slot of [0, 1]) {
        const p = g.plants[i + '-' + slot];
        parts.push(p ? p.id + '@' + p.at : '-');
      }
    }
    return parts.join('|');
  }

  function paintPlots() {
    const s = G.DB.save;
    if (!s) return;
    G.Garden.clean(s);
    const box = $('garden-plots');
    const sig = stateSig(s);
    if (sig === plotSig && box.childElementCount) {
      box.querySelectorAll('canvas[data-grow]').forEach(cv => drawSlot(cv, s.garden.plants[cv.dataset.grow]));
      return;
    }
    plotSig = sig;
    const g = s.garden;
    box.innerHTML = '';
    G.Berries.PLOTS.forEach((rect, i) => {
      const node = document.createElement('div');
      node.className = 'g-plot';
      node.style.cssText = pct(rect);
      if (i < g.open) {
        for (const slot of [0, 1]) {
          const plant = g.plants[i + '-' + slot];
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'g-soil ' + (slot ? 'bot' : 'top');
          btn.dataset.sfx = 'select';
          const cv = document.createElement('canvas');
          cv.width = 96;
          cv.height = 72;
          if (plant) cv.dataset.grow = i + '-' + slot;
          btn.appendChild(cv);
          drawSlot(cv, plant);
          btn.onclick = () => onSoil(i, slot, plant);
          node.appendChild(btn);
        }
      } else {
        const next = i === g.open;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'g-sign';
        btn.dataset.sfx = next ? 'buy' : 'select';
        btn.innerHTML = '<img src="assets/berries/cartel.png" alt="" draggable="false">' +
          (next ? '<span class="g-price">' + G.U.num(G.Berries.PRICES[i - 1]) + '</span>' : '');
        btn.onclick = () => {
          if (!next) { G.UI.toast('Abre antes la parcela anterior.'); return; }
          if (!G.Garden.unlock(s)) { G.UI.toast('No tienes Pokémonedas suficientes'); G.Audio.sfx('error'); return; }
          G.DB.commit(true);
          G.UI.refreshCoins();
          G.UI.toast('Parcela abierta.');
          paintPlots();
        };
        node.appendChild(btn);
      }
      box.appendChild(node);
    });
  }

  function onSoil(plot, slot, plant) {
    if (!plant) { openSeeds(plot, slot); return; }
    const g = G.Garden.growth(plant);
    if (!g.ready) {
      G.UI.toast('Quedan ' + clock(g.left));
      return;
    }
    const got = G.Garden.harvest(G.DB.save, plot, slot);
    if (!got) return;
    G.DB.commit(true);
    const name = G.Berries.BY[got.id].name;
    const word = got.n === 1 ? '1 ' + name : got.n + ' ' + name;
    G.UI.toast(got.seed ? 'Recoges ' + word + ' y 1 semilla' : 'Recoges ' + word);
    G.Audio.sfx('confirm');
    paintPlots();
  }

  function openSeeds(plot, slot) {
    seedPlot = plot;
    seedSlot = slot;
    $('seed-bag').classList.remove('hidden');
    paintSeeds();
  }
  function closeSeeds() { $('seed-bag').classList.add('hidden'); }

  function paintSeeds() {
    const s = G.DB.save;
    const box = $('seed-list');
    const ids = G.Berries.IDS.filter(id => s.seeds[id] > 0);
    if (!ids.length) {
      box.innerHTML = '<p class="sub">No tienes semillas. Cómpralas en la tienda.</p>';
      return;
    }
    box.innerHTML = ids.map(id => {
      const b = G.Berries.BY[id];
      return '<button type="button" class="bag-item" data-id="' + id + '">' +
        '<canvas width="48" height="48"></canvas><span><b>Semilla de ' + b.name + '</b>' +
        '<small>Crece en ' + G.Berries.clock(b.grow / 60000) + ' · tienes ' + s.seeds[id] + '</small></span></button>';
    }).join('');
    box.querySelectorAll('.bag-item').forEach(btn => {
      const id = btn.dataset.id;
      drawBerry(btn.querySelector('canvas').getContext('2d'), id, 8, 8, 32, 32, false);
      btn.onclick = () => {
        if (!G.Garden.plant(s, seedPlot, seedSlot, id)) return;
        G.DB.commit(true);
        G.UI.toast('Plantada.');
        closeSeeds();
        paintPlots();
      };
    });
  }

  function openShop() {
    G.Garden.clean(G.DB.save);
    $('garden-shop-panel').classList.remove('hidden');
    paintShop(G.Garden.shopLeft(G.DB.save));
  }
  function closeShop() { $('garden-shop-panel').classList.add('hidden'); }

  function paintShop(left) {
    const s = G.DB.save;
    $('garden-shop-left').textContent = 'Se renueva en ' + clock(left);
    const box = $('garden-shop-list');
    const prev = box.dataset.sig || '';
    const sig = s.garden.shop.join(',') + '|' + s.garden.sold.join('');
    if (prev === sig && box.childElementCount) return;
    box.dataset.sig = sig;
    box.innerHTML = s.garden.shop.map((id, i) => {
      const b = G.Berries.BY[id];
      const sold = s.garden.sold[i];
      return '<button type="button" class="bag-item' + (sold ? ' sold' : '') + '" data-i="' + i + '"' + (sold ? ' disabled' : '') + '>' +
        '<canvas width="48" height="48"></canvas><span><b>Semilla de ' + b.name + '</b>' +
        '<small>' + (sold ? 'Agotada' : G.U.num(G.Berries.SEED_PRICE) + ' · crece en ' + G.Berries.clock(b.grow / 60000)) + '</small></span></button>';
    }).join('');
    box.querySelectorAll('.bag-item').forEach(btn => {
      const i = +btn.dataset.i;
      drawBerry(btn.querySelector('canvas').getContext('2d'), s.garden.shop[i], 8, 8, 32, 32, false);
      btn.onclick = () => {
        if (s.garden.sold[i]) return;
        const id = G.Garden.buySeed(s, i);
        if (!id) { G.UI.toast('No tienes Pokémonedas suficientes'); G.Audio.sfx('error'); return; }
        G.DB.commit(true);
        G.UI.refreshCoins();
        G.UI.toast('Comprada.');
        box.dataset.sig = '';
        paintShop(G.Garden.shopLeft(s));
      };
    });
  }

  /**
   * Mochila de bayas de un Pokémon. onDone se llama al poner, quitar o cerrar
   * después de un cambio, para que la ficha o la expedición se redibujen.
   */
  function openBag(dex, onDone) {
    const s = G.DB.save;
    if (!s || !s.owned || !s.owned[dex]) { G.UI.toast('Elige un Pokémon'); return; }
    bagDex = dex;
    bagDone = onDone || null;
    const mon = G.DEX_BY[dex];
    $('berry-bag-title').textContent = mon ? mon.name : 'Baya';
    const away = G.Expedition && G.Expedition.busy(s).some(e => e.dex === dex);
    $('berry-bag-note').textContent = away
      ? 'Si ya está fuera, esta baya no cambia esa expedición.'
      : 'Cada Pokémon lleva una.';
    $('berry-bag').classList.remove('hidden');
    paintBag();
  }
  function closeBag() {
    $('berry-bag').classList.add('hidden');
    const done = bagDone;
    bagDone = null;
    if (done) done();
  }

  function paintBag() {
    const s = G.DB.save;
    const cur = G.Garden.worn(s, bagDex);
    const box = $('berry-list');
    const ids = G.Berries.IDS.filter(id => (s.berries[id] || 0) > 0 || id === cur);
    let html = '';
    if (cur) html += '<button type="button" class="bag-item" data-clear="1"><span><b>Quitar</b><small>' + G.Berries.BY[cur].name + ' vuelve a la mochila</small></span></button>';
    if (!ids.length && !cur) html = '<p class="sub">No tienes bayas. Recógelas en el huerto.</p>';
    html += ids.map(id => {
      const b = G.Berries.BY[id];
      const on = id === cur;
      const n = s.berries[id] || 0;
      return '<button type="button" class="bag-item' + (on ? ' on' : '') + '" data-id="' + id + '">' +
        '<canvas width="48" height="48"></canvas><span><b>' + b.name + (on ? ' · puesta' : '') + '</b>' +
        '<small>' + (on ? 'En este Pokémon' : 'Tienes ' + n) + '</small><small class="bag-text">' + b.text + '</small></span></button>';
    }).join('');
    box.innerHTML = html;
    box.querySelectorAll('canvas').forEach(cv => {
      const id = cv.parentElement.dataset.id;
      if (id) drawBerry(cv.getContext('2d'), id, 8, 8, 32, 32, false);
    });
    const clear = box.querySelector('[data-clear]');
    if (clear) clear.onclick = () => setBerry(null);
    box.querySelectorAll('[data-id]').forEach(btn => {
      btn.onclick = () => { if (btn.dataset.id !== cur) setBerry(btn.dataset.id); };
    });
  }

  function setBerry(id) {
    if (!G.Garden.equip(G.DB.save, bagDex, id)) {
      G.UI.toast('No tienes esa baya');
      return;
    }
    G.DB.commit(true);
    G.Audio.sfx('confirm');
    closeBag();
  }

  function label(dex) {
    const id = G.DB.save && G.Garden.worn(G.DB.save, dex);
    return id ? G.Berries.BY[id].name : 'Ninguna';
  }

  return { init, open, openBag, label };
})();
