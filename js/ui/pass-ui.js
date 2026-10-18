/* ============ pass-ui.js — pase a la izquierda del menú ============
 * La cabecera dice qué pase es. Al pulsarla se esconde la lista y queda
 * solo esa cabecera; al pulsar otra vez vuelve. Los premios se recogen aquí.
 */
G.PassUI = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let jump = false;
  let picking = null;
  let spinning = false;

  const TICKET = { t1: 'tickets grises', t10: 'tickets morados', tb: 'tickets azules', tg: 'tickets dorados' };

  function label(rw, revealed) {
    if (!rw) return '';
    const n = G.U.num(rw.n || 0);
    if (rw.kind === 'gold') return revealed ? n + ' de oro' : 'Oro';
    if (TICKET[rw.kind]) {
      const name = TICKET[rw.kind].replace(/^t/, 'T');
      return revealed ? n + ' ' + TICKET[rw.kind] : name;
    }
    if (rw.kind === 'mon') {
      if (rw.dex && G.DEX_BY[rw.dex]) return G.DEX_BY[rw.dex].name;
      const name = (G.PassData.RNAME[rw.rarity] || 'común');
      return 'Pokémon ' + name;
    }
    if (rw.kind === 'shiny') return rw.dex && G.DEX_BY[rw.dex] ? G.DEX_BY[rw.dex].name + ' shiny' : 'Shiny';
    if (rw.kind === 'shiny5') return 'Shiny legendario';
    if (rw.kind === 'frags') {
      if (rw.dex && G.DEX_BY[rw.dex]) return (rw.n || 20) + ' fragmentos de ' + G.DEX_BY[rw.dex].name;
      return (rw.n || 20) + ' fragmentos ' + (G.PassData.RNAME[rw.rarity] || '');
    }
    if (rw.kind === 'pick') return 'Elige quién recibe ' + G.U.num(rw.n) + ' fragmentos';
    return '';
  }

  function ballOf(rw) {
    let r = rw.rarity || 0;
    if (!r && rw.dex && G.DEX_BY[rw.dex]) r = G.DEX_BY[rw.dex].rarity;
    if (!r && (rw.kind === 'shiny5' || rw.leg)) r = 5;
    if (rw.kind === 'shiny' || rw.kind === 'shiny5') return 'shiny';
    return (G.Icons.RARITY_BALL && G.Icons.RARITY_BALL[r]) || 'ball';
  }

  function faceOf(rw) {
    const shiny = rw.kind === 'shiny' || rw.kind === 'shiny5';
    if (rw.dex && G.DEX_BY[rw.dex] && G.UI && G.UI.spriteCanvas) {
      const cv = G.UI.spriteCanvas(rw.dex, 36, 32, { scale: 1, shiny, shadow: false });
      cv.className = 'pass-mon';
      return cv;
    }
    if (rw.kind === 'gold') { const s = document.createElement('span'); s.className = 'coin'; return s; }
    const ico = rw.kind === 't1' ? 'ticket' : rw.kind === 't10' ? 'ticket10' : rw.kind === 'tb' ? 'ticketb' : rw.kind === 'tg' ? 'ticketg' : ballOf(rw);
    const wrap = document.createElement('span');
    wrap.innerHTML = G.Icons.html(ico, 18);
    return wrap.firstChild;
  }

  function row(lv, rw, state, onClaim) {
    const el = document.createElement('div');
    el.className = 'pass-row ' + state;
    el.innerHTML = `<b>${lv}</b><span class="pass-prize"></span>`;
    const span = el.querySelector('.pass-prize');
    const face = faceOf(rw);
    if (face) span.appendChild(face);
    span.appendChild(document.createTextNode(' ' + label(rw, state === 'is-got')));
    if (state === 'is-ready') {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn small gold';
      b.textContent = 'Recoger';
      b.dataset.sfx = 'none';
      b.onclick = onClaim;
      el.appendChild(b);
    } else if (state === 'is-got') {
      const s = document.createElement('small');
      s.textContent = 'Listo';
      el.appendChild(s);
    }
    return el;
  }

  function refresh(opts) {
    const dock = $('pass-dock');
    const s = G.DB && G.DB.save;
    if (!dock || !s || !G.Pass) return;
    G.Pass.ensure(s);
    const P = s.pass;
    dock.classList.toggle('is-fold', !!P.fold);
    const head = $('pass-head');
    const lvl = Math.min(100, Math.floor((P.pts || 0) / 10));
    const into = Math.min(10, (P.pts || 0) - lvl * 10);
    const left = G.Pass.daysLeft();
    const when = left <= 1 ? 'Termina hoy' : 'Quedan ' + left + ' días';
    const lvlTxt = lvl >= 100 ? 'Nivel 100 · ' + G.U.num(P.pts) + ' puntos' : 'Nivel ' + lvl + ' · ' + into + '/10';
    head.innerHTML = `<b>Pase ${P.n || 1}</b><small>${lvlTxt}</small><small>${when}</small>`;
    const list = $('pass-list');
    list.innerHTML = '';
    if (P.bank && P.bank.length) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn small gold pass-bank';
      b.textContent = 'Premios sin recoger (' + P.bank.length + ')';
      b.dataset.sfx = 'none';
      b.onclick = () => takeBank();
      list.appendChild(b);
    }
    const reached = Math.min(100, Math.floor((P.pts || 0) / 10));
    let focus = null;
    P.track.forEach((rw, i) => {
      const lv = i + 1;
      const got = !!P.claimed[lv];
      const open = lv <= reached && !got;
      const state = got ? 'is-got' : open ? 'is-ready' : (lv === reached + 1 ? 'is-now' : 'is-locked');
      const el = row(lv, rw, state, () => takeLevel(lv));
      if (state === 'is-ready' || state === 'is-now') focus = focus || el;
      list.appendChild(el);
    });
    (P.post || []).forEach((post, i) => {
      const state = post.claimed ? 'is-got' : 'is-ready';
      const el = row('+', post.reward, state, () => takePost(i));
      list.appendChild(el);
    });
    if ((opts && opts.jump) || jump) {
      jump = false;
      if (focus) focus.scrollIntoView({ block: 'center' });
    }
    noteMenu();
  }

  function noteMenu() {
    const sub = $('menu-goals-sub');
    if (!sub || !G.Progress) return;
    const pend = G.Progress.pending();
    sub.textContent = pend ? pend + (pend === 1 ? ' premio por recoger' : ' premios por recoger') : 'Misiones, logros y perfil';
    sub.classList.toggle('gold', pend > 0);
  }

  async function playRoll(roll) {
    const fx = $('pull-fx'), slot = $('slot');
    if (!fx || !slot || !G.Slots || !roll || !roll.faces) return;
    const out = $('pull-results'), acts = $('pull-actions');
    if (out) out.innerHTML = '';
    if (acts) acts.classList.add('hidden');
    slot.style.display = '';
    fx.classList.remove('hidden');
    try { await G.Slots.play(slot, [roll]); }
    finally {
      slot.style.display = 'none';
      fx.classList.add('hidden');
    }
  }

  async function after(res) {
    if (!res) return;
    if (res.pick) { ask(res); return; }
    if (res.roll && !spinning) {
      spinning = true;
      try { await playRoll(res.roll); } catch (e) { /* la tirada no debe tragarse el premio */ }
      spinning = false;
    }
    if (res.msg) { G.Audio.sfx('buy'); G.UI.toast(res.msg); }
    if (res.msgs && res.msgs.length) { G.Audio.sfx('buy'); G.UI.toast(res.msgs[0] + (res.msgs.length > 1 ? ' y ' + (res.msgs.length - 1) + ' más' : '')); }
    if (G.UI.refreshCoins) G.UI.refreshCoins();
    refresh();
  }

  function takeLevel(lv) { if (!spinning) after(G.Pass.claimLevel(lv)); }
  function takePost(i) { if (!spinning) after(G.Pass.claimPost(i)); }

  function takeBank() {
    const res = G.Pass.claimBank();
    if (res && res.pick) {
      if (res.msgs && res.msgs.length) G.UI.toast(res.msgs[0]);
      ask(res);
      return;
    }
    after(res);
  }

  function ask(where) {
    closeAsk();
    picking = where;
    const s = G.DB.save;
    const gen = (s && s.region) || 1;
    const leg = !!where.leg;
    const box = document.createElement('div');
    box.id = 'pass-pick';
    box.className = 'scr dim';
    const list = G.DEX.filter(p => (p.gen || 1) <= gen && G.SPRITE_META[p.dex] && (leg ? (p.leg || p.rarity === 5) : true));
    box.innerHTML = `<div class="box pass-pick-box"><div class="row between"><h2>${leg ? 'Elige un legendario' : 'Elige un Pokémon'}</h2><button type="button" class="btn small ghost" id="pass-pick-x">Cerrar</button></div>
      <p class="sub">${leg ? 'Recibe 500 fragmentos.' : 'Recibe 100 fragmentos.'}</p>
      <input id="pass-pick-q" class="field" placeholder="Buscar" spellcheck="false">
      <div id="pass-pick-list" class="pass-pick-list"></div></div>`;
    document.body.appendChild(box);
    const paint = () => {
      const q = ($('pass-pick-q').value || '').trim().toLowerCase();
      const show = list.filter(p => !q || p.name.toLowerCase().includes(q)).slice(0, leg ? 80 : 60);
      const host = $('pass-pick-list');
      host.innerHTML = '';
      if (!q && !leg) {
        host.innerHTML = '<p class="sub">Escribe el nombre.</p>';
        return;
      }
      for (const p of show) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn small';
        b.textContent = p.name;
        b.onclick = () => {
          const msg = G.Pass.claimPick(p.dex, where);
          closeAsk();
          if (msg) { G.Audio.sfx('buy'); G.UI.toast(msg); }
          if (G.UI.refreshCoins) G.UI.refreshCoins();
          if (where.bank != null) takeBank();
          else refresh();
        };
        host.appendChild(b);
      }
    };
    $('pass-pick-q').oninput = paint;
    $('pass-pick-x').onclick = () => { closeAsk(); refresh(); };
    paint();
  }

  function closeAsk() {
    picking = null;
    const el = $('pass-pick');
    if (el) el.remove();
  }

  function init() {
    const head = $('pass-head');
    if (!head) return;
    head.onclick = () => {
      G.Pass.toggleFold();
      refresh();
    };
  }

  function open() { jump = true; refresh({ jump: true }); }

  return { init, refresh, open };
})();
