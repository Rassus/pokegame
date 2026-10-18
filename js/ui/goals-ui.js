/* ============ goals-ui.js — misiones, región, logros y perfil ============
 * Una pantalla con cuatro pestañas:
 *   Misiones  las del pase, en incompletas y completas, con su etiqueta
 *   Región    la misión que abre la siguiente, en cuadros como los logros
 *   Logros    medallas por categoría; los legendarios, uno a uno con su sprite
 *   Perfil    tus 3 favoritos y tu título; vista previa del perfil público
 * y la ventana del perfil público de cualquier jugador (G.ProfileUI.show).
 */
(() => {
  const $ = G.UI.$;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = t => (t >= 3600 ? Math.floor(t / 3600) + ':' + G.U.mmss(t % 3600).padStart(5, '0') : G.U.mmss(t));

  // ======================= PANTALLA =======================

  G.GoalsUI = (() => {
    let tab = 'missions', cat = 'coleccion', period = 'all';

    function init() {
      document.querySelectorAll('#goals-tabs .tab').forEach(t => {
        t.onclick = () => { tab = t.dataset.tab; render(); };
      });
    }

    function open(t) {
      if (t) tab = t;
      G.UI.show('scr-goals', true);
      G.Progress.ensure(G.DB.save);
      G.Progress.checkAch();
      render();
    }

    function render() {
      document.querySelectorAll('#goals-tabs .tab').forEach(t => t.classList.toggle('on', t.dataset.tab === tab));
      const box = $('goals-body');
      box.innerHTML = '';
      if (tab === 'missions') missions(box);
      else if (tab === 'region') region(box);
      else if (tab === 'ach') achievements(box);
      else profile(box);
    }

    // ---------------- misiones ----------------

    const PERIOD = { day: ['Diaria', 'day'], week: ['Semanal', 'week'], month: ['Mensual', 'month'] };

    function passRow(m, kind) {
      const v = G.Pass.value(m);
      const pct = Math.min(100, v / (m.goal || 1) * 100);
      const tag = PERIOD[kind];
      const pts = '+' + G.Pass.points(m.tier);
      const el = document.createElement('div');
      el.className = 'ach pass-cap ' + tag[1] + (m.awarded ? ' ok' : '');
      el.innerHTML = `<div class="a-txt"><span class="m-tag ${tag[1]}">${tag[0]}</span><b>${esc(G.Pass.text(m))}</b>
          ${m.awarded ? '' : `<div class="bar"><i style="width:${pct}%"></i></div>`}
          <div class="a-rw">${m.awarded ? 'Hecha' : G.U.num(Math.min(v, m.goal)) + ' / ' + G.U.num(m.goal)} · ${pts}</div></div>`;
      return el;
    }

    function missions(box) {
      box.insertAdjacentHTML('beforeend', '<p class="sub">Se completan solas y suman puntos del pase. Duran hasta que acaba el mes.</p>');
      const B = G.Pass.boards();
      const items = [];
      const push = (list, kind) => { for (const m of list || []) items.push({ m, kind }); };
      push(B.month, 'month');
      B.weeks.forEach(w => push(w.list, 'week'));
      B.days.forEach(d => push(d.list, 'day'));
      const chips = document.createElement('div');
      chips.className = 'filters';
      for (const [k, label] of [['all', 'Todas'], ['day', 'Diarias'], ['week', 'Semanales'], ['month', 'Mensuales']]) {
        const n = k === 'all' ? items.length : items.filter(x => x.kind === k).length;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip' + (k === 'all' ? '' : ' ' + k) + (period === k ? ' on' : '');
        b.textContent = label + ' ' + n;
        b.onclick = () => { period = k; render(); };
        chips.appendChild(b);
      }
      box.appendChild(chips);
      const shown = period === 'all' ? items : items.filter(x => x.kind === period);
      const groups = [
        ['Incompletas', shown.filter(x => !x.m.awarded)],
        ['Completas', shown.filter(x => x.m.awarded)]
      ];
      for (const [title, list] of groups) {
        box.insertAdjacentHTML('beforeend', `<div class="row between goals-h"><h3>${title}</h3></div>`);
        if (!list.length) {
          box.insertAdjacentHTML('beforeend', '<p class="sub">Ninguna por ahora.</p>');
          continue;
        }
        const grid = document.createElement('div');
        grid.className = 'ach-grid';
        for (const it of list) grid.appendChild(passRow(it.m, it.kind));
        box.appendChild(grid);
      }
    }

    function region(box) {
      box.insertAdjacentHTML('beforeend', `<div class="row between goals-h"><h3>Regiones</h3>
        <span class="sub">${G.Progress.region()} / 9 abiertas</span></div>`);
      const q = G.Progress.regionMission();
      if (!q) {
        box.insertAdjacentHTML('beforeend', '<p class="sub">Las 9 regiones están abiertas.</p>');
        return;
      }
      const ready = q.rows.filter(r => r.met).length;
      box.insertAdjacentHTML('beforeend', `<p class="sub">Abre ${esc(q.def.name)} · ${ready} / ${q.rows.length}</p>`);
      const grid = document.createElement('div');
      grid.className = 'ach-grid';
      for (const r of q.rows) {
        const pct = Math.min(100, r.v / (r.req.goal || 1) * 100);
        const el = document.createElement('div');
        el.className = 'ach' + (r.met ? ' ok' : '');
        el.innerHTML = `${G.Icons.html(r.met ? 'medal3' : 'medalOff', 36)}
          <div class="a-txt"><b>${esc(r.req.text)}</b>
            ${r.met ? '' : `<div class="bar"><i style="width:${pct}%"></i></div>`}
            <div class="a-rw">${r.met ? 'Hecha' : G.U.num(Math.min(r.v, r.req.goal)) + ' / ' + G.U.num(r.req.goal)}</div></div>`;
        grid.appendChild(el);
      }
      box.appendChild(grid);
      if (!q.done) return;
      const pays = q.rows.some(r => r.req.kind === 'pay');
      const btn = document.createElement('button');
      btn.className = 'btn small gold';
      btn.style.marginTop = '10px';
      btn.textContent = 'Abrir ' + q.def.name;
      btn.dataset.sfx = 'none';
      btn.onclick = () => {
        if (pays && !confirm('¿Pagar y abrir ' + q.def.name + '?')) return;
        const def = G.Progress.claimRegion();
        if (def) { G.Audio.sfx('buy'); G.UI.toast(def.name + ' está abierta'); render(); }
        else { G.Audio.sfx('error'); G.UI.toast('Aún te falta algo para abrirla.'); render(); }
      };
      box.appendChild(btn);
    }

    // ---------------- logros ----------------

    function achievements(box) {
      const s = G.DB.save;
      const all = G.AchDefs.LIST;
      const got = all.filter(a => s.ach && s.ach[a.id]).length;
      const chips = document.createElement('div');
      chips.className = 'filters';
      for (const [k, label] of G.AchDefs.CATS) {
        const list = all.filter(a => a.cat === k);
        const n = list.filter(a => s.ach && s.ach[a.id]).length;
        const b = document.createElement('button');
        b.className = 'chip' + (k === cat ? ' on' : '');
        b.textContent = `${label} ${n}/${list.length}`;
        b.onclick = () => { cat = k; render(); };
        chips.appendChild(b);
      }
      box.insertAdjacentHTML('beforeend', `<p class="sub">${got} de ${all.length} logros · títulos: ${G.Progress.titles().length}</p>`);
      box.appendChild(chips);

      const list = all.filter(a => a.cat === cat && !a.dex);
      const grid = document.createElement('div');
      grid.className = 'ach-grid';
      for (const a of list) grid.appendChild(achCard(a, s));
      box.appendChild(grid);

      // Legendarios: uno a uno, con su sprite (en sombra si aún no le has vencido).
      if (cat === 'legendarios') {
        const legs = all.filter(a => a.dex);
        const beaten = legs.filter(a => s.legends && s.legends[a.dex]).length;
        box.insertAdjacentHTML('beforeend', `<h3 style="margin:14px 0 6px">Legendarios vencidos ${beaten} / ${legs.length}</h3>`);
        const lg = document.createElement('div');
        lg.className = 'leg-grid';
        for (const a of legs) {
          const ok = !!(s.legends && s.legends[a.dex]);
          const c = document.createElement('div');
          c.className = 'leg-cell' + (ok ? ' ok' : '');
          c.title = a.name + (ok ? ' · ¡vencido!' : '');
          c.appendChild(G.UI.spriteCanvas(a.dex, 64, 56, { scale: 1, silhouette: !ok, shadow: ok }));
          c.insertAdjacentHTML('beforeend', `<small>${ok ? esc(G.DEX_BY[a.dex].name) : '???'}</small>`);
          lg.appendChild(c);
        }
        box.appendChild(lg);
      }
    }

    function achCard(a, s) {
      const steps = a.steps;
      const rank = steps ? ((s.achRank && s.achRank[a.id]) || 0) : 0;
      const ok = steps ? rank >= steps.length : !!(s.ach && s.ach[a.id]);
      const goal = steps ? steps[Math.min(rank, steps.length - 1)] : a.goal;
      const v = Math.min(goal, a.value(s) || 0);
      const reward = steps ? a.rewards[Math.min(rank, a.rewards.length - 1)] : a.reward;
      const desc = steps && a.say ? a.say(goal) : a.desc;
      const el = document.createElement('div');
      el.className = 'ach' + (ok ? ' ok' : '');
      el.innerHTML = `${G.Icons.html(ok ? 'medal' + a.tier : 'medalOff', 36)}
        <div class="a-txt"><b>${esc(a.name)}</b><small>${esc(desc)}</small>
          ${ok ? '' : `<div class="bar"><i style="width:${v / (goal || 1) * 100}%"></i></div>`}
          <div class="a-rw">${ok ? '¡Conseguido!' : G.U.num(v) + ' / ' + G.U.num(goal)} · ${G.Progress.rewardText(reward)}
          ${a.title ? ` · <span class="gold">Título: ${esc(a.title)}</span>` : ''}</div></div>`;
      return el;
    }

    // ---------------- perfil (editar) ----------------

    function profile(box) {
      const s = G.DB.save;
      s.profile = s.profile || { favs: [], title: '' };
      const P = s.profile;
      box.insertAdjacentHTML('beforeend', `<p class="sub">${G.DB.online ? 'Así te ven los demás jugadores (desde el ranking y la lista de amigos).'
        : 'Tu perfil se publica cuando juegas con una cuenta online.'}</p>
        <h3>Tus 3 Pokémon favoritos</h3>`);
      const favs = document.createElement('div');
      favs.className = 'fav-slots';
      for (let i = 0; i < 3; i++) {
        const f = P.favs[i];
        const slot = document.createElement('div');
        slot.className = 'fav-slot';
        if (f && G.DEX_BY[f.dex]) {
          slot.appendChild(G.UI.spriteCanvas(f.dex, 120, 100, { scale: 2, lively: true, shiny: !!f.shiny }));
          slot.insertAdjacentHTML('beforeend', `<b>${f.shiny ? G.Icons.html('shiny', 12) + ' ' : ''}${esc(G.DEX_BY[f.dex].name)}</b>`);
        } else slot.innerHTML = '<span>Elegir</span>';
        slot.onclick = () => pickFav(i);
        favs.appendChild(slot);
      }
      box.appendChild(favs);

      const titles = G.Progress.titles();
      box.insertAdjacentHTML('beforeend', `<h3 style="margin-top:14px">Título</h3>`);
      const sel = document.createElement('select');
      sel.className = 'field';
      sel.style.maxWidth = '320px';
      sel.innerHTML = `<option value="">(sin título)</option>` + titles.map(t => `<option ${t === P.title ? 'selected' : ''}>${esc(t)}</option>`).join('');
      sel.onchange = () => { P.title = sel.value; save(); };
      box.appendChild(sel);
      if (!titles.length) box.insertAdjacentHTML('beforeend', '<p class="note">Consigue logros para desbloquear títulos.</p>');

      const prev = document.createElement('button');
      prev.className = 'btn gold'; prev.style.marginTop = '16px';
      prev.textContent = 'Ver mi perfil público';
      prev.onclick = () => G.ProfileUI.showData(G.Social.profileData());
      box.appendChild(prev);
    }

    function pickFav(i) {
      const s = G.DB.save;
      const box = $('goals-body');
      box.innerHTML = `<div class="row between"><h3>Elige el favorito ${i + 1}</h3>
        <button class="btn small ghost" id="fav-back">Volver</button></div>
        <input class="field" id="fav-q" placeholder="Buscar por nombre" style="max-width:320px;margin:6px 0 10px">
        <div class="grid" id="fav-grid"></div>`;
      $('fav-back').onclick = () => { tab = 'profile'; render(); };
      const fill = q => {
        const g = $('fav-grid');
        g.innerHTML = '';
        const mons = Object.keys(s.owned).map(Number).filter(d => G.DEX_BY[d] && (!q || G.DEX_BY[d].name.toLowerCase().includes(q)));
        for (const d of mons.slice(0, 120)) {
          for (const shiny of G.DB.ownsShiny(d) ? [false, true] : [false]) {
            const c = document.createElement('div');
            c.className = 'cell';
            c.appendChild(G.UI.spriteCanvas(d, 92, 80, { scale: 2, shiny }));
            c.insertAdjacentHTML('beforeend', `<b>${shiny ? G.Icons.html('shiny', 12) + ' ' : ''}${esc(G.DEX_BY[d].name)}</b>`);
            c.onclick = () => {
              s.profile.favs = (s.profile.favs || []).slice();
              s.profile.favs[i] = { dex: d, shiny };
              s.profile.favs = s.profile.favs.filter(Boolean).slice(0, 3);
              save(); tab = 'profile'; render();
            };
            g.appendChild(c);
          }
        }
      };
      $('fav-q').oninput = () => fill($('fav-q').value.trim().toLowerCase());
      fill('');
    }

    function save() {
      G.DB.commit();
      if (G.Social.me) G.Social.publishProfile(true);
      G.Audio.sfx('confirm');
    }

    return { init, open, render };
  })();

  // ======================= PERFIL PÚBLICO =======================

  G.ProfileUI = (() => {
    function init() {
      $('prof-close').onclick = close;
      $('scr-profile').onclick = e => { if (e.target.id === 'scr-profile') close(); };
    }
    function close() { $('scr-profile').classList.add('hidden'); }

    /** Abre el perfil de otro jugador por su uid. */
    async function show(uid) {
      if (!uid) return;
      if (uid === G.Social.uid) { showData(G.Social.profileData()); return; }
      $('prof-body').innerHTML = '<p class="sub">Cargando…</p>';
      $('scr-profile').classList.remove('hidden');
      const d = await G.Social.getProfile(uid);
      if (!d) { $('prof-body').innerHTML = '<p class="sub">Este jugador aún no tiene perfil.</p>'; return; }
      showData(d);
    }

    function showData(d) {
      const b = d.best || {};
      const body = $('prof-body');
      body.innerHTML = `
        <div class="prof-head"><h2 translate="no">${esc(d.name || '???')}</h2>${d.title ? `<span class="prof-title">${esc(d.title)}</span>` : ''}</div>
        <div class="fav-slots view" id="prof-favs"></div>
        <div class="prof-marks">
          <div><span>Mejor tiempo</span><b>${fmt(b.solo || 0)}</b></div>
          <div><span>En grupo</span><b>${fmt(b.group || 0)}</b></div>
          <div><span>Nivel máximo</span><b>${b.level || 0}</b></div>
          <div><span>Jefes</span><b>${G.U.num(b.bosses || 0)}</b></div>
          <div><span>Legendarios</span><b>${b.legends || 0}</b></div>
          <div><span>Derrotados</span><b>${G.U.num(b.kills || 0)}</b></div>
        </div>
        <h3>Medallas <span class="sub">${b.medals || 0}</span></h3>
        <div class="prof-medals" id="prof-medals"></div>`;
      const favs = $('prof-favs');
      for (const f of (d.favs || []).slice(0, 3)) {
        if (!G.DEX_BY[f.dex]) continue;
        const slot = document.createElement('div');
        slot.className = 'fav-slot';
        slot.appendChild(G.UI.spriteCanvas(f.dex, 120, 100, { scale: 2, lively: true, shiny: !!f.shiny }));
        slot.insertAdjacentHTML('beforeend', `<b>${f.shiny ? G.Icons.html('shiny', 12) + ' ' : ''}${esc(G.DEX_BY[f.dex].name)}</b>`);
        favs.appendChild(slot);
      }
      if (!favs.children.length) favs.innerHTML = '<p class="sub">Sin favoritos todavía.</p>';
      const med = $('prof-medals');
      for (const id of d.medals || []) {
        const a = G.AchDefs.BY[id];
        if (!a) continue;
        const m = document.createElement('div');
        m.className = 'pm';
        m.title = a.name;
        if (a.dex) m.appendChild(G.UI.spriteCanvas(a.dex, 48, 40, { scale: 1 }));
        else m.innerHTML = G.Icons.html('medal' + a.tier, 36);
        m.insertAdjacentHTML('beforeend', `<small>${esc(a.name)}</small>`);
        med.appendChild(m);
      }
      if (!med.children.length) med.innerHTML = '<p class="sub">Aún sin medallas.</p>';
      $('scr-profile').classList.remove('hidden');
    }

    return { init, show, showData };
  })();
})();
