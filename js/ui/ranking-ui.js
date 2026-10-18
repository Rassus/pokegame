/* ============ ranking-ui.js — pantalla del ranking ============
 * Pestañas Solo / Grupo / Torre, periodo (diario ... histórico), todos o sólo amigos,
 * filtro por Pokémon (sólo en el histórico) y tu puesto abajo aunque no salgas
 * en el top. En Torre se elige la torre y el modo, y se ordena por oleada.
 * Lo leído se guarda 30 min (ver ranking.js).
 */
G.RankingUI = (() => {
  const $ = G.UI.$;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let mode = 's', period = 'w', scope = 'all', dex = null, towerId = '', towerMode = 'normal';
  let token = 0;

  function init() {
    const dl = $('rk-dl');
    dl.innerHTML = G.DEX.map(p => `<option value="${esc(p.name)}">`).join('');
    $('rk-poke').onchange = () => {
      const v = $('rk-poke').value.trim().toLowerCase();
      const p = G.DEX.find(x => x.name.toLowerCase() === v);
      if (!v) { setDex(null); return; }
      if (!p) { G.UI.toast('No hay ningún Pokémon con ese nombre'); return; }
      setDex(p.dex);
    };
    $('rk-clear').onclick = () => { $('rk-poke').value = ''; setDex(null); };
  }

  /** El filtro por Pokémon sólo existe en el histórico: al elegir uno se pasa a esa pestaña. */
  function setDex(d) {
    dex = d;
    if (d && period !== 'a') period = 'a';
    $('rk-clear').classList.toggle('hidden', !d);
    tabs(); load();
  }

  function open() {
    if (!G.SocialUI.needOnline()) return;
    G.UI.show('scr-rank', true);
    if (!G.Social.started) G.Social.start();
    tabs();
    load();
  }

  function tabs() {
    const mk = (box, items, cur, set, cls) => {
      box.innerHTML = '';
      for (const [k, label] of items) {
        const b = document.createElement('button');
        b.className = cls + (k === cur ? ' on' : '');
        b.innerHTML = label;
        b.onclick = () => { set(k); tabs(); load(); };
        box.appendChild(b);
      }
    };
    mk($('rk-mode'), [
      ['s', `<b>${G.Icons.html('user', 16)} Solo</b>`],
      ['g', `<b>${G.Icons.html('friends', 16)} Grupo</b>`],
      ['tw', `<b>${G.Icons.html('tower', 16)} Torre</b>`]
    ], mode, k => { mode = k; }, 'gen-tab');
    mk($('rk-period'), G.Ranking.PERIODS, period, k => {
      period = k;
      if (k !== 'a' && dex) { dex = null; $('rk-poke').value = ''; $('rk-clear').classList.add('hidden'); }
    }, 'chip');
    mk($('rk-scope'), [['all', 'Todos'], ['friends', 'Sólo amigos']], scope, k => { scope = k; }, 'chip');
    towerTools();
  }

  function towerTools() {
    const on = mode === 'tw';
    const poke = $('rk-poke'), clr = $('rk-clear'), sel = $('rk-tower'), tm = $('rk-tmode'), sub = $('rk-sub');
    if (poke) poke.classList.toggle('hidden', on);
    if (clr) clr.classList.toggle('hidden', on || !dex);
    if (sel) sel.classList.toggle('hidden', !on);
    if (tm) tm.classList.toggle('hidden', !on);
    if (sub) sub.textContent = on ? '· oleada alcanzada' : '· tiempo aguantado';
    if (!on || !sel || !tm) return;
    if (!sel.dataset.ready) {
      for (let g = 1; g <= 9; g++) {
        const list = G.Towers.LIST.filter(t => t.gen === g);
        if (!list.length) continue;
        const og = document.createElement('optgroup');
        og.label = G.Towers.REGIONS[g] || String(g);
        for (const t of list) {
          const o = document.createElement('option');
          o.value = t.id;
          o.textContent = G.DEX_BY[t.dexes[0]] ? G.DEX_BY[t.dexes[0]].name : t.name;
          o.setAttribute('translate', 'no');
          og.appendChild(o);
        }
        sel.appendChild(og);
      }
      sel.dataset.ready = '1';
      sel.onchange = () => { towerId = sel.value; load(); };
    }
    if (!towerId && sel.options.length) towerId = sel.options[0].value;
    if (towerId) sel.value = towerId;
    tm.innerHTML = '';
    for (const m of G.Towers.MODES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (m.id === towerMode ? ' on' : '');
      b.textContent = m.name;
      b.onclick = () => { towerMode = m.id; tabs(); load(); };
      tm.appendChild(b);
    }
  }

  function waveText(t, en) {
    const w = G.Ranking.waveOf(t);
    const done = G.Ranking.clearedOf(t);
    if (en) return 'Wave ' + w + (done ? ' · cleared' : '');
    return done ? ('Oleada ' + w + ' · superada') : ('Oleada ' + w);
  }

  function towerBits() {
    const t = G.Towers.LIST.find(x => x.id === towerId);
    const name = t && G.DEX_BY[t.dexes[0]] ? G.DEX_BY[t.dexes[0]].name : (t ? t.name : '');
    const modeName = (G.Towers.MODES.find(m => m.id === towerMode) || G.Towers.MODES[0]).name;
    const enMode = { normal: 'Normal', hard: 'Hard', mad: 'Insane' }[towerMode] || 'Normal';
    return { name, modeName, enMode };
  }

  const fmt = t => t >= 3600 ? Math.floor(t / 3600) + ':' + G.U.mmss(t % 3600).padStart(5, '0') : G.U.mmss(t);

  async function load() {
    const my = ++token;
    const list = $('rk-list');
    list.innerHTML = '<p class="sub">Cargando…</p>';
    $('rk-me').innerHTML = '';
    let rows = [], me = null;
    try {
      const tower = mode === 'tw' ? { id: towerId, mode: towerMode } : null;
      [rows, me] = await Promise.all([
        G.Ranking.top(mode, period, mode === 'tw' ? null : dex, scope === 'friends', tower),
        G.Social.me ? G.Ranking.myRank(mode, period, mode === 'tw' ? null : dex, tower) : Promise.resolve(null)
      ]);
    } catch (e) {
      if (my !== token) return;
      list.innerHTML = '<p class="sub">No se pudo cargar el ranking (' + esc(e.code || e.message) + ').</p>';
      return;
    }
    if (my !== token) return;
    list.innerHTML = '';
    if (!rows.length) {
      list.innerHTML = '<p class="sub">Todavía no hay marcas aquí. ¡Sé el primero!</p>';
    }
    const uid = G.Social.uid;
    rows.forEach((r, i) => list.appendChild(rowEl(r, i + 1, r.uids.includes(uid))));

    // La frase se monta en cada idioma (traducirla por trozos sale rara).
    const en = G.I18n.lang === 'en';
    const pn = en ? { d: 'today', w: 'this week', m: 'this month', y: 'this year', a: 'of all time' }[period]
                  : { d: 'de hoy', w: 'de esta semana', m: 'de este mes', y: 'de este año', a: 'de siempre' }[period];
    const mon = dex ? G.DEX_BY[dex].name : '';
    const where = en ? (mode === 's' ? 'solo' : 'group') + (dex ? ' with ' + mon : '')
                     : (mode === 's' ? 'en solitario' : 'en grupo') + (dex ? ' con ' + mon : '');
    if (mode === 'tw') {
      const tb = towerBits();
      const who = '<b translate="no">' + esc(tb.name) + '</b> · ' + tb.modeName;
      $('rk-me').innerHTML = !G.Social.me ? 'Elige un apodo (en Amigos) para salir en el ranking.'
        : me && me.out ? (en ? `<span translate="no">You're not in the top 50 of ${esc(tb.name)} (${tb.enMode}) ${pn} yet. Your exact rank is in All-time.</span>`
                             : `Aún no estás en el top 50 ${pn} en ${who}. Tu puesto exacto está en Histórico.`)
        : me ? (en ? `<span translate="no">Your best rank on ${esc(tb.name)} (${tb.enMode}) ${pn}: <b class="gold">#${me.pos}</b> · ${waveText(me.t, true)}</span>`
                   : `Tu mejor puesto ${pn} en ${who}: <b class="gold">#${me.pos}</b> · <span>${waveText(me.t)}</span>`)
        : (en ? `<span translate="no">You don't have a record on ${esc(tb.name)} (${tb.enMode}) ${pn} yet.</span>`
              : `Aún no tienes marca ${pn} en ${who}.`);
      return;
    }
    $('rk-me').innerHTML = !G.Social.me ? 'Elige un apodo (en Amigos) para salir en el ranking.'
      : me && me.out ? (en ? `<span translate="no">You're not in the top 50 ${where} ${pn} yet. Your exact rank is in All-time.</span>`
                           : `Aún no estás en el top 50 ${pn} ${where}. Tu puesto exacto está en Histórico.`)
      : me ? (en ? `<span translate="no">Your best ${where} rank ${pn}: <b class="gold">#${me.pos}</b> · ${fmt(me.t)}</span>`
                 : `Tu mejor puesto ${pn} ${where}: <b class="gold">#${me.pos}</b> · ${fmt(me.t)}`)
      : (en ? `<span translate="no">You don't have a ${where} record ${pn} yet.</span>` : `Aún no tienes marca ${pn} ${where}.`);
  }

  function rowEl(r, pos, mine) {
    const el = document.createElement('div');
    el.className = 'rk-row' + (mine ? ' mine' : '') + (pos <= 3 ? ' top' + pos : '');
    el.insertAdjacentHTML('beforeend', `<span class="pos">${pos <= 3 ? G.Icons.html('trophy', 20) : ''}${pos}</span>`);
    const mons = document.createElement('span');
    mons.className = 'mons';
    r.dex.forEach((d, i) => { if (G.DEX_BY[d]) mons.appendChild(G.UI.spriteCanvas(d, 44, 40, { scale: 1, shiny: !!r.shiny[i] })); });
    el.appendChild(mons);
    el.insertAdjacentHTML('beforeend',
      `<span class="who"><b translate="no">${r.names.map((n, i) => `<a href="#" class="plink" data-u="${esc(r.uids[i] || '')}">${esc(n)}</a>`).join(' · ')}</b><small>Nv. ${r.lv || 1} · ${G.U.num(r.kills || 0)} derrotados</small></span>
       <span class="time${mode === 'tw' ? ' wave' : ''}">${mode === 'tw' ? waveText(r.t) : fmt(r.t)}</span>`);
    el.querySelectorAll('.plink').forEach(a => { a.onclick = e => { e.preventDefault(); G.ProfileUI.show(a.dataset.u); }; });
    return el;
  }

  return { init, open };
})();
