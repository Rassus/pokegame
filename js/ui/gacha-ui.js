/* ============ gacha-ui.js — banners por generación y animación de tirada ============
 * La lógica (probabilidades, pity, shiny, repetidos) está en systems/gacha.js.
 */
G.GachaUI = (() => {
  const $ = G.UI.$;
  let busy = false;
  let gen = 1;
  const ratesOpen = new Set();

  function init() {
    $('pull-1').onclick = () => pull(1, 't1');
    $('pull-10').onclick = () => pull(10, 't1');
    $('pull-10b').onclick = () => pull(10, 't10');
    $('pull-10c').onclick = () => pull(10, 'tb');
    $('pull-g').onclick = () => pull(1, 'tg');
    $('pull-close').onclick = close;
    $('pull-again').onclick = again;
    $('pull-all').onclick = pullAll;
    $('pull-stop').onclick = () => { bulkStop = true; };

    const tabs = $('gacha-gens');
    G.Gacha.BANNERS.forEach(b => {
      const t = document.createElement('button');
      t.className = 'gen-tab';
      t.dataset.gen = b.gen;
      t.innerHTML = `<b>${b.name}</b><small>Gen ${b.gen}</small>`;
      t.onclick = () => { gen = b.gen; refresh(); };
      tabs.appendChild(t);
    });
  }

  function open() {
    G.UI.show('scr-gacha', true);
    refresh();
  }

  function refresh() {
    const s = G.DB.save;
    const banner = G.Gacha.BANNERS[gen - 1];
    const openRegion = gen <= (s.region || 1);
    document.querySelectorAll('#gacha-gens .gen-tab').forEach(t => {
      const g = +t.dataset.gen;
      const open = g <= (s.region || 1);
      t.classList.toggle('on', g === gen);
      t.classList.toggle('locked', !open);
      const sub = t.querySelector('small');
      if (sub) sub.textContent = open ? 'Gen ' + g : 'Cerrada';
    });

    const all = G.DEX.filter(p => p.gen === gen);
    const owned = all.filter(p => s.owned[p.dex]).length;
    const shinies = all.filter(p => s.shiny && s.shiny[p.dex]).length;
    const [c1, c2, c3] = banner.color;
    $('banner').style.background =
      `radial-gradient(circle at 80% 30%, rgba(255,210,63,.3), transparent 45%),
       radial-gradient(circle at 15% 80%, rgba(196,123,255,.3), transparent 50%),
       linear-gradient(135deg, ${c1}, ${c2} 55%, ${c3})`;
    $('banner-title').textContent = banner.name + ' Misterioso';
    $('banner-desc').textContent = openRegion
      ? `Los ${all.length} Pokémon de la generación ${gen}. ¡Los legendarios esperan!`
      : 'Región cerrada. Completa la misión en Región para abrir ' + banner.name + '.';
    $('gacha-owned').innerHTML = `Tienes ${owned} de ${all.length}` +
      (shinies ? ` · ${G.Icons.html('shiny', 12)} ${shinies} shiny` : '');

    const feat = $('gacha-feat');
    feat.innerHTML = '';
    for (const dex of G.Gacha.featured(gen)) {
      feat.appendChild(G.UI.spriteCanvas(dex, 170, 190, { lively: true, scale: 2, dir: 1 }));
    }

    $('gacha-pity').textContent = '';

    $('gacha-rates').innerHTML = Object.entries(G.Gacha.TABLES).map(([key, tb]) => {
      const rows = tb.rows.slice().reverse().map(([r, w]) =>
        `<div class="rates-row"><span style="color:${G.Gacha.RARITY_COLOR[r]}">${G.UI.stars(r, 10)} ${G.Gacha.RARITY_NAME[r]}</span><span>${w}%</span></div>`
      ).join('');
      return `<details class="rates-acc" data-rate="${key}"${ratesOpen.has(key) ? ' open' : ''}>` +
        `<summary>${G.Icons.html(tb.icon, 14)} ${tb.name}</summary>` +
        `<div class="rates-acc-body">${rows}</div></details>`;
    }).join('') +
      `<p class="note">· El ticket dorado solo da un shiny que te falte. Si ya los tienes todos, da 1500 fragmentos de un Pokémon del banner.<br>
       · Los fragmentos son de la línea evolutiva. Un básico da ×1, la segunda ×2 y la tercera ×3. Entra en la pokédex al juntar: Común 3, Poco común 5, Rara 10, Épica 15 y Legendaria 20.<br>
       · Si ya lo tienes y aún puede subir, la tirada sigue dando fragmentos. Al tope, da Pokémonedas.<br>
       · Los tickets se consiguen jugando: al derrotar Pokémon, en cofres y al vencer jefes.</p>`;
    $('gacha-rates').querySelectorAll('.rates-acc').forEach(el => {
      el.addEventListener('toggle', () => {
        const key = el.dataset.rate;
        if (el.open) ratesOpen.add(key);
        else ratesOpen.delete(key);
      });
    });

    const t = s.tickets;
    $('cost-1').innerHTML = `${G.Icons.html('ticket', 18)} 1`;
    $('cost-10').innerHTML = `${G.Icons.html('ticket', 18)} 10`;
    $('cost-10b').innerHTML = `${G.Icons.html('ticket10', 18)} 1`;
    $('cost-10c').innerHTML = `${G.Icons.html('ticketb', 18)} 1`;
    $('cost-g').innerHTML = `${G.Icons.html('ticketg', 18)} 1`;
    $('gacha-tickets').innerHTML =
      `<span class="tk">${G.Icons.html('ticket', 18)} <b>${t.t1}</b>${G.UI.ticketPlus('t1')}</span>` +
      `<span class="tk">${G.Icons.html('ticket10', 18)} <b>${t.t10}</b>${G.UI.ticketPlus('t10')}</span>` +
      `<span class="tk">${G.Icons.html('ticketb', 18)} <b>${t.tb || 0}</b>${G.UI.ticketPlus('tb')}</span>` +
      `<span class="tk">${G.Icons.html('ticketg', 18)} <b>${t.tg || 0}</b>${G.UI.ticketPlus('tg')}</span>`;
    $('pull-1').disabled = !openRegion || !G.Gacha.costOf(s, 1, 't1');
    $('pull-10').disabled = !openRegion || !G.Gacha.costOf(s, 10, 't1');
    $('pull-10b').disabled = !openRegion || !G.Gacha.costOf(s, 10, 't10');
    $('pull-10c').disabled = !openRegion || !G.Gacha.costOf(s, 10, 'tb');
    $('pull-g').disabled = !openRegion || !G.Gacha.costOf(s, 1, 'tg');
    G.UI.refreshCoins();
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));
  let lastUse = 't1';
  let bulkStop = false;

  function againUse() {
    if (lastUse === 't10' || lastUse === 'tb' || lastUse === 'tg') return lastUse;
    return 't1';
  }

  function againBatch() { return againUse() === 'tg' ? 1 : 10; }

  function again() {
    pull(againBatch(), againUse());
  }

  function showAgain() {
    const use = againUse();
    const icon = use === 't10' ? 'ticket10' : use === 'tb' ? 'ticketb' : use === 'tg' ? 'ticketg' : 'ticket';
    const batch = againBatch();
    const cost = use === 't1' ? '10' : '1';
    const can = !!G.Gacha.costOf(G.DB.save, batch, use);
    $('pull-again').innerHTML = 'Tirar ×' + batch + ' · ' + G.Icons.html(icon, 16) + ' ' + cost;
    $('pull-again').disabled = !can;
    const all = $('pull-all');
    all.classList.remove('hidden');
    all.disabled = !can;
    all.innerHTML = 'Tirar todo · ' + G.Icons.html(icon, 16);
  }

  /** Suma las tiradas: una entrada por Pokémon (el shiny aparte). */
  function absorb(bag, r) {
    const key = r.dex + (r.shiny ? ':s' : '');
    let g = bag.get(key);
    if (!g) {
      g = { dex: r.dex, rarity: r.rarity, shiny: !!r.shiny, frag: 0, refund: 0, unlocked: false, isNew: false, full: false };
      bag.set(key, g);
    }
    g.frag += r.fragGain || 0;
    g.refund += r.refund || 0;
    if (r.unlocked) g.unlocked = true;
    if (r.isNew) g.isNew = true;
    if (r.full) g.full = true;
    if (r.rarity > g.rarity) g.rarity = r.rarity;
  }

  function renderGrouped(bag) {
    const out = $('pull-results');
    out.innerHTML = '';
    const list = [...bag.values()].sort((a, b) => b.rarity - a.rarity || b.frag - a.frag);
    if (!list.length) return;
    G.Audio.sfx('burst', { rarity: Math.max(...list.map(r => r.rarity)) });
    for (const r of list) {
      const mon = G.DEX_BY[r.dex];
      const c = document.createElement('div');
      c.className = 'pcard r' + r.rarity + (r.shiny ? ' shiny' : '');
      c.style.setProperty('--rc', r.shiny ? '#9ae6ff' : G.Gacha.RARITY_COLOR[r.rarity]);
      c.innerHTML = `<div class="stars">${G.UI.stars(r.rarity, 24)}</div>`;
      c.appendChild(G.UI.spriteCanvas(r.dex, 132, 120, { lively: r.rarity >= 4 || r.shiny, scale: 2, shiny: r.shiny }));
      const bits = [];
      if (r.frag) bits.push(`${G.Icons.html('frag', 18)} +${r.frag}`);
      if (r.full) bits.push('Colección shiny completa');
      else if (r.unlocked) bits.push('<span class="new">¡Capturado!</span>');
      else if (r.shiny && r.isNew) bits.push('<span class="new">¡Shiny!</span>');
      if (r.refund) bits.push(`<span class="coin"></span> +${G.U.num(r.refund)}`);
      const tag = bits.join(' ') || 'Repetido';
      c.insertAdjacentHTML('beforeend', `<b>${r.shiny ? G.Icons.html('shiny', 12) + ' ' : ''}${mon.name}</b><div class="tag">${tag}</div>`);
      out.appendChild(c);
    }
  }

  function ticketsLeft(use) {
    const t = G.DB.save.tickets || {};
    if (use === 't10') return t.t10 || 0;
    if (use === 'tb') return t.tb || 0;
    if (use === 'tg') return t.tg || 0;
    return t.t1 || 0;
  }

  /** De 10 en 10, sin cartas, hasta Parar o hasta quedarse sin tickets. */
  async function pullAll() {
    if (busy) return;
    const use = againUse();
    const batch = againBatch();
    if ((G.DB.save.region || 1) < gen) {
      G.Audio.sfx('error');
      G.UI.toast('Esta región está cerrada. Ábrela en Región.');
      return;
    }
    if (!G.Gacha.costOf(G.DB.save, batch, use)) {
      G.Audio.sfx('error');
      G.UI.toast('No tienes tickets suficientes: consíguelos jugando');
      return;
    }
    busy = true;
    bulkStop = false;
    const bag = new Map();
    let pulls = 0;
    $('pull-results').innerHTML = '';
    $('pull-actions').classList.add('hidden');
    $('slot').style.display = 'none';
    $('pull-bulk').classList.remove('hidden');
    $('pull-bulk-n').textContent = 'Tiradas: 0 · Quedan ' + ticketsLeft(use);
    $('pull-bulk-sub').textContent = batch === 1 ? 'De 1 en 1. Parar cuando quieras.' : 'De 10 en 10. Parar cuando quieras.';

    while (!bulkStop && G.Gacha.costOf(G.DB.save, batch, use)) {
      const res = G.Gacha.pull(G.DB.save, batch, gen, use);
      if (!res) break;
      pulls += res.length;
      for (const r of res) absorb(bag, r);
      G.DB.commit(true);
      $('pull-bulk-n').textContent = 'Tiradas: ' + pulls + ' · Quedan ' + ticketsLeft(use);
      await wait(140);
    }
    G.Progress.checkAch();
    G.DB.commit(true);
    $('pull-bulk').classList.add('hidden');
    renderGrouped(bag);
    showAgain();
    $('pull-actions').classList.remove('hidden');
    busy = false;
  }

  async function pull(n, use = 't1') {
    if (busy) return;
    if ((G.DB.save.region || 1) < gen) {
      G.Audio.sfx('error');
      G.UI.toast('Esta región está cerrada. Ábrela en Región.');
      return;
    }
    lastUse = use;
    const res = G.Gacha.pull(G.DB.save, n, gen, use);
    if (!res) { G.Audio.sfx('error'); G.UI.toast('No tienes tickets suficientes: consíguelos jugando'); return; }
    G.Progress.checkAch();
    G.DB.commit(true);
    busy = true;

    const best = Math.max(...res.map(r => r.rarity));
    const fx = $('pull-fx'), slot = $('slot'), out = $('pull-results');
    out.innerHTML = '';
    $('pull-actions').classList.add('hidden');
    slot.style.display = '';
    fx.classList.remove('hidden');

    // La tragaperras (ui/slots.js) y luego las cartas.
    await G.Slots.play(slot, res);
    G.Audio.sfx('burst', { rarity: best });
    slot.style.display = 'none';

    for (const r of res) {
      const mon = G.DEX_BY[r.dex];
      const c = document.createElement('div');
      c.className = 'pcard r' + r.rarity + (r.shiny ? ' shiny' : '');
      c.style.setProperty('--rc', r.shiny ? '#9ae6ff' : G.Gacha.RARITY_COLOR[r.rarity]);
      c.innerHTML = `<div class="stars">${G.UI.stars(r.rarity, 24)}</div>`;
      c.appendChild(G.UI.spriteCanvas(r.dex, 132, 120, { lively: r.rarity >= 4 || r.shiny, scale: 2, shiny: r.shiny }));
      const bits = [];
      if (r.fragGain) bits.push(`${G.Icons.html('frag', 18)} +${r.fragGain}`);
      if (r.full) bits.push('Colección shiny completa');
      else if (r.unlocked) bits.push('<span class="new">¡Capturado!</span>');
      else if (r.shiny && r.isNew) bits.push('<span class="new">¡Shiny!</span>');
      else if (r.shiny) bits.push('Repetido');
      const tag = bits.join(' ') || `Repetido · <span class="coin"></span> +${G.U.num(r.refund)}`;
      c.insertAdjacentHTML('beforeend', `<b>${r.shiny ? G.Icons.html('shiny', 12) + ' ' : ''}${mon.name}</b><div class="tag">${tag}</div>`);
      out.appendChild(c);
      G.Audio.sfx('reveal', { rarity: r.rarity });
      await wait(n === 10 ? 150 : 0);
    }
    showAgain();
    $('pull-actions').classList.remove('hidden');
    busy = false;
  }

  function close() {
    bulkStop = true;
    $('pull-bulk').classList.add('hidden');
    $('pull-fx').classList.add('hidden');
    refresh();
  }

  return { init, open, refresh, get open_() { return !$('pull-fx').classList.contains('hidden'); } };
})();
