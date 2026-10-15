/* ============ run-ui.js — cartas de nivel, pausa y fin de run ============ */
G.RunUI = (() => {
  const $ = G.UI.$;
  let offers = null, offerCb = null, coopMode = false;

  /** @param coop  en grupo: tras elegir, se queda esperando a los demás */
  function showLevelUp(level, list, cb, coop = false) {
    offerCb = cb; coopMode = coop;
    $('lvl-num').textContent = level;
    $('lvl-wait').textContent = '';
    $('lvl-wait').classList.toggle('hidden', !coop);
    $('cards').classList.remove('done');
    renderCards(list);
    $('lvl-reroll').onclick = reroll;
    G.UI.show('scr-levelup');
  }

  /**
   * Cambiar las cartas: 1 vez gratis por partida y 1 más por cada jefe
   * derrotado (en grupo cuentan los jefes del equipo; cada uno tiene los suyos).
   */
  function rerollsLeft() {
    const p = G.Game.player;
    // 1 gratis + los comprados en Mejoras (antes, 1 más por cada jefe).
    return p ? Math.max(0, 1 + (p.rerollBonus || 0) - (p.rerolls || 0)) : 0;
  }

  function reroll() {
    if (!offers || rerollsLeft() <= 0) return;
    const vote = G.Coop.voteTarget && G.Coop.voteTarget();
    if (vote && vote === (G.Net && G.Net.uid)) return;
    const p = G.Game.player;
    p.rerolls = (p.rerolls || 0) + 1;
    G.Audio.sfx('select');
    renderCards(G.LevelUp.offer(p));
  }

  function renderCards(list) {
    offers = list;
    const left = rerollsLeft();
    $('lvl-rr-n').textContent = left;
    $('lvl-reroll').classList.toggle('hidden', left <= 0);
    const box = $('cards');
    box.innerHTML = '';
    list.forEach((c, i) => {
      const el = document.createElement('div');
      el.className = 'card';
      const tag = c.type === 'new'
        ? `<span class="tag-chip" style="background:${c.color}">Nuevo · ${c.tag}</span>`
        : c.type === 'up' || c.type === 'evo'
          ? `<span class="tag-chip" style="background:${c.color}">${c.tag}</span>`
          : `<span class="tag-chip" style="background:${c.color === '#ffd23f' ? '#ffd23f' : '#9fb1c9'}">${c.tag}</span>`;
      if (c.type === 'evo') el.classList.add('evo');
      el.innerHTML =
        `<div class="ico" style="background:${c.color}33">${G.Icons.html(c.icon, 32)}</div>
         <div class="txt"><div class="nm">${c.title} ${tag}</div><div class="ds">${c.desc}</div></div>
         <div class="key">${i + 1}</div>`;
      el.dataset.sfx = 'none';             // el juego pone su propio sonido al elegir
      el.onclick = () => pick(i);
      box.appendChild(el);
    });
    if (coopMode && G.Coop.active) {
      G.Coop.reportCards(list.map(c => ({ title: c.title, desc: c.desc, icon: c.icon, color: c.color, tag: c.tag || '' })));
    }
  }

  function pick(i) {
    if (!offers || !offers[i]) return;
    const c = offers[i], cb = offerCb;
    offers = null; offerCb = null;
    $('lvl-reroll').classList.add('hidden');
    if (coopMode) {
      // Se queda la carta elegida a la vista mientras eligen los demás.
      $('cards').querySelectorAll('.card').forEach((el, j) => el.classList.toggle('picked', j === i));
      $('cards').classList.add('done');
    } else G.UI.hide('scr-levelup');
    cb(c);
  }

  /** Cooperativo: quién falta por elegir. */
  function setWaiting(names) {
    const me = G.Social.me ? G.Social.me.name : '';
    const others = names.filter(n => n !== me);
    const list = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1] : a[0];
    $('lvl-wait').textContent = !names.length ? ''
      : !others.length ? 'Elige tu carta'
      : names.includes(me) ? 'Faltan por elegir: ' + list([...others, 'tú'])
      : 'Esperando a ' + list(others) + '…';
  }

  function closeLevelUp() {
    offers = null; offerCb = null;
    $('cards').classList.remove('done');
    G.UI.hide('scr-levelup');
  }

  /** Resumen de las cartas, para que el grupo vote si alguien no elige. */
  function cardBrief() {
    return (offers || []).map(c => ({ title: c.title, desc: c.desc, icon: c.icon, color: c.color, tag: c.tag || '' }));
  }

  /** El grupo eligió por ti. */
  function forcePick(i) {
    if (!offers || !offers[i]) return;
    pick(i);
  }

  function showOver(r, onBack) {
    $('over-title').textContent = r.title || (r.dead ? 'Has caído…' : 'Run terminada');
    renderOverDmg(r.dmg || []);
    const tabs = $('over-tabs');
    tabs.querySelectorAll('.gen-tab').forEach(btn => {
      btn.classList.toggle('on', btn.dataset.over === 'sum');
      btn.onclick = () => {
        tabs.querySelectorAll('.gen-tab').forEach(b => b.classList.toggle('on', b === btn));
        const dmg = btn.dataset.over === 'dmg';
        $('over-stats').classList.toggle('hidden', dmg);
        $('over-dmg').classList.toggle('hidden', !dmg);
      };
    });
    $('over-stats').classList.remove('hidden');
    $('over-dmg').classList.add('hidden');
    $('over-stats').innerHTML = `
      <div><span>Tiempo</span><b>${G.U.mmss(r.time)}</b></div>
      <div><span>Nivel</span><b>${r.level}</b></div>
      <div><span>Derrotados</span><b>${G.U.num(r.kills)}</b></div>
      <div><span>Jefes</span><b>${r.bosses}</b></div>
      <div style="grid-column:1/-1"><span>Pokémonedas ganadas</span>
        <b class="gold"><span class="coin"></span> +${G.U.num(r.coins)}</b>
        <div style="font-size:12px;color:var(--muted)">${r.breakdown}</div></div>
      ${r.t1 || r.t10 || r.tb || r.tg ? `<div style="grid-column:1/-1"><span>Tickets del gacha</span><b>
        ${r.t1 ? G.Icons.html('ticket', 22) + ' +' + r.t1 + ' ' : ''}${r.t10 ? G.Icons.html('ticket10', 22) + ' +' + r.t10 + ' ' : ''}${r.tb ? G.Icons.html('ticketb', 22) + ' +' + r.tb + ' ' : ''}${r.tg ? G.Icons.html('ticketg', 22) + ' +' + r.tg : ''}</b></div>` : ''}
      <div style="grid-column:1/-1"><span>Movimientos</span><b style="font-size:15px">
        ${r.moves.map(m => `${G.Icons.html('move:' + m.id, 16)} ${m.name} Nv.${m.lvl}`).join(' · ') || '—'}</b></div>
      ${r.caught && r.caught.length ? `<div style="grid-column:1/-1" class="caught"><span>${G.Icons.html('shiny', 12)} Shinies conseguidos</span>
        <div class="caught-row" id="over-caught"></div></div>` : ''}
      ${r.record ? '<div style="grid-column:1/-1;text-align:center" class="gold">¡Nuevo récord de tiempo!</div>' : ''}`;
    $('btn-again').onclick = onBack;
    if (r.caught && r.caught.length) {
      const row = $('over-caught');
      for (const c of r.caught) {
        const w = document.createElement('div');
        w.appendChild(G.UI.spriteCanvas(c.dex, 90, 72, { shiny: true, lively: true, scale: 2 }));
        w.insertAdjacentHTML('beforeend', `<small>${G.DEX_BY[c.dex].name}${c.isNew ? ' · ¡nuevo!' : ''}</small>`);
        row.appendChild(w);
      }
    }
    G.UI.show('scr-over');
  }

  /** Segunda pestaña: daño de cada movimiento y, en los de ataque, cuánto añadieron. */
  function renderOverDmg(list) {
    const box = $('over-dmg');
    if (!list.length) {
      box.innerHTML = '<p class="note">Todavía no has hecho daño.</p>';
      return;
    }
    const rows = list.map(m => ({
      ...m,
      dealt: Math.round(m.dealt || 0),
      added: Math.round(m.added || 0)
    }));
    for (const m of rows) m.show = m.kind === 'buff' ? (m.stat === 'atk' ? m.added : 0) : m.dealt;
    rows.sort((a, b) => b.show - a.show);
    const total = rows.reduce((s, m) => s + m.dealt, 0);
    const max = Math.max(1, ...rows.map(m => m.show));
    const anyAdd = rows.some(m => m.added > 0);
    box.innerHTML = `<div class="total"><span>Daño total</span><b>${G.U.num(total)}</b></div>` +
      rows.map(m => {
        const col = G.U.TYPE_COLOR[m.type] || '#fff';
        const pct = total > 0 ? Math.round(m.show / total * 100) : 0;
        const val = m.kind === 'buff' && m.stat === 'atk'
          ? `<b class="gold">+${G.U.num(m.added)}</b><small>añadió${total ? ' · ' + pct + '%' : ''}</small>`
          : m.kind === 'buff'
            ? '<small>Sin daño</small>'
            : `<b>${G.U.num(m.dealt)}</b>${total ? '<small>' + pct + '%</small>' : ''}`;
        return `<div class="dmg-row">
          <span class="ico">${G.Icons.html('move:' + m.id, 22)}</span>
          <div class="who"><b>${m.name} <small>Nv.${m.lvl}</small></b>
            <div class="dmg-bar"><i style="width:${Math.round(m.show / max * 100)}%;background:${col}"></i></div></div>
          <div class="val">${val}</div></div>`;
      }).join('') +
      (anyAdd ? '<p class="note">Ese daño ya va dentro de los otros movimientos.</p>' : '');
  }

  /** Has encontrado un objeto llevando ya otro: ¿con cuál te quedas? */
  function showItemChoice(cur, next, cb) {
    const box = $('item-cards');
    box.innerHTML = '';
    [[cur, 'Quedarme con'], [next, 'Cambiar a']].forEach(([id, verb], i) => {
      const it = G.Items.BY[id];
      const el = document.createElement('div');
      el.className = 'card' + (i === 1 ? ' evo' : '');
      el.innerHTML = `<div class="ico">${G.Icons.html(id, 36)}</div>
        <div class="txt"><div class="nm">${verb} ${it.name}</div><div class="ds">${it.desc}</div></div>
        <div class="key">${i + 1}</div>`;
      el.onclick = () => { G.UI.hide('scr-item'); cb(id); };
      box.appendChild(el);
    });
    G.UI.show('scr-item');
  }

  // ---------------- vínculo: qué movimientos se fusionan ----------------

  let bond = null;          // { opt, cb, first, list }

  /**
   * @param opt  pl.bondOptions(): 'add' (uno suelto al grupo) o 'pair' (dos sueltos, en dos pasos)
   * @param cb   recibe la lista de movimientos que se juntan
   */
  function showBond(opt, cb) {
    bond = { opt, cb, first: null, list: [] };
    $('bond-back').onclick = bondBack;
    renderBond();
    G.UI.show('scr-bond');
  }

  function renderBond() {
    const { opt, first } = bond;
    const names = ms => ms.map(m => m.name).join(' + ');
    const step2 = opt.mode === 'pair' && first;
    $('bond-sub').textContent = opt.mode === 'add' ? 'Elige qué movimiento se une a ' + names(opt.group)
      : step2 ? '¿Con cuál unes ' + first.name + '?' : 'Elige el primer movimiento que vas a unir';
    $('bond-back').classList.toggle('hidden', !step2);
    bond.list = step2 ? opt.loose.filter(m => m !== first) : opt.loose;
    const box = $('bond-cards');
    box.innerHTML = '';
    bond.list.forEach((m, i) => {
      const col = G.U.TYPE_COLOR[m.type];
      const desc = opt.mode === 'add' ? 'Se lanzará a la vez que ' + names(opt.group) + '.'
        : step2 ? 'Se lanzará a la vez que ' + first.name + '. Queda un hueco libre.'
        : m.desc || '';
      const el = document.createElement('div');
      el.className = 'card' + (opt.mode === 'add' || step2 ? ' bond' : '');
      el.innerHTML =
        `<div class="ico" style="background:${col}33">${G.Icons.html('move:' + m.id, 32)}</div>
         <div class="txt"><div class="nm">${m.name} <span class="tag-chip" style="background:${col}">Nv.${m.lvl}</span></div><div class="ds">${desc}</div></div>
         <div class="key">${i + 1}</div>`;
      el.dataset.sfx = 'none';
      el.onclick = () => pickBond(i);
      box.appendChild(el);
    });
  }

  function pickBond(i) {
    if (!bond || !bond.list[i]) return;
    const m = bond.list[i];
    if (bond.opt.mode === 'pair' && !bond.first) {
      bond.first = m;
      G.Audio.sfx('select');
      renderBond();
      return;
    }
    const picked = bond.opt.mode === 'add' ? [m] : [bond.first, m];
    const cb = bond.cb;
    bond = null;
    G.UI.hide('scr-bond');
    cb(picked);
  }

  function bondBack() {
    if (!bond) return;
    bond.first = null;
    renderBond();
  }

  function showPause(coop = false) {
    G.UI.soundControls($('pause-sound'));
    $('pause-coop').classList.toggle('hidden', !coop);
    $('btn-quit').textContent = coop ? 'Salir de la partida' : 'Abandonar run';
    const kick = $('btn-kick');
    const box = $('pause-kick');
    kick.classList.toggle('hidden', !coop);
    box.classList.add('hidden');
    kick.onclick = () => {
      if (!G.Coop.active) return;
      const people = G.Coop.roster().filter(p => p.uid !== G.Net.uid && !p.host);
      const list = $('pause-kick-list');
      list.innerHTML = '';
      if (!people.length) {
        list.innerHTML = '<p class="note">No hay otro jugador al que sacar.</p>';
      } else {
        for (const p of people) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'btn';
          b.textContent = p.name;
          b.setAttribute('translate', 'no');
          b.onclick = () => { G.UI.hide('scr-pause'); G.Coop.askKick(p.uid); };
          list.appendChild(b);
        }
      }
      box.classList.remove('hidden');
    };
    G.UI.show('scr-pause');
  }

  function wirePause(onResume, onQuit) {
    $('btn-resume').onclick = onResume;
    $('btn-quit').onclick = onQuit;
  }

  // ---------------- rueda del ticket dorado ----------------

  const WHEEL_COLS = ['#e53935', '#7e3ff2', '#1e88e5', '#26c6da', '#7cb342', '#fdd835', '#fb8c00', '#ec407a'];
  let wheelQ = [], wheel = null;

  function showWheel(names, win, dur, done) {
    wheelQ.push({ names, win, dur, done, t: 0, announced: false });
    if (!wheel) playWheel();
  }

  function playWheel() {
    wheel = wheelQ.shift();
    if (!wheel) return;
    $('wheel-sub').textContent = 'Girando…';
    $('wheel-win').textContent = '';
    G.UI.show('scr-wheel');
    drawWheel(0);
  }

  function drawWheel(rot) {
    const cv = $('wheel-cv');
    if (!cv || !wheel) return;
    const ctx = cv.getContext('2d');
    const names = wheel.names;
    const n = Math.max(1, names.length);
    const w = cv.width, h = cv.height;
    const cx = w / 2, cy = h / 2 + 6, r = 168;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    for (let i = 0; i < n; i++) {
      const a0 = -Math.PI / 2 + i * (Math.PI * 2 / n);
      const a1 = a0 + Math.PI * 2 / n;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, a0, a1);
      ctx.closePath();
      ctx.fillStyle = WHEEL_COLS[i % WHEEL_COLS.length];
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.save();
      ctx.rotate(a0 + Math.PI / n);
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = 'rgba(0,0,0,.55)';
      ctx.lineWidth = 4;
      ctx.font = '700 18px Segoe UI, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const label = Object(String(names[i] || '').slice(0, 14));
      ctx.strokeText(label, r - 16, 0);
      ctx.fillText(label, r - 16, 0);
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(10, 8);
    ctx.lineTo(-10, 8);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();
    // La flecha fija marca el hueco de arriba, que es el que gana.
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.moveTo(cx, cy - r - 8);
    ctx.lineTo(cx - 14, cy - r - 28);
    ctx.lineTo(cx + 14, cy - r - 28);
    ctx.closePath();
    ctx.fill();
  }

  function tick(dt) {
    if (!wheel) return;
    wheel.t += dt;
    const spins = 5;
    const n = Math.max(1, wheel.names.length);
    const slice = Math.PI * 2 / n;
    const finalRot = spins * Math.PI * 2 - (wheel.win + 0.5) * slice;
    const k = Math.min(1, wheel.t / wheel.dur);
    const ease = 1 - Math.pow(1 - k, 3);
    drawWheel(finalRot * ease);
    if (k >= 1 && !wheel.announced) {
      wheel.announced = true;
      const name = wheel.names[wheel.win] || '';
      $('wheel-sub').textContent = 'Ya está.';
      $('wheel-win').textContent = name;
      $('wheel-win').setAttribute('translate', 'no');
      G.Audio.sfx('shinyGet');
    }
    if (wheel.t >= wheel.dur + 1.3) {
      const cb = wheel.done;
      wheel = null;
      G.UI.hide('scr-wheel');
      if (cb) cb();
      if (wheelQ.length) playWheel();
    }
  }

  function voteCardEl(c, i, onChoose) {
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML =
      `<div class="ico" style="background:${c.color || '#9fb1c9'}33">${G.Icons.html(c.icon || 'star', 32)}</div>
       <div class="txt"><div class="nm">${c.title || ''}</div><div class="ds">${c.desc || ''}</div></div>
       <div class="key">${i + 1}</div>`;
    el.onclick = () => onChoose(i);
    return el;
  }

  /** Voto por la carta de quien no elige. */
  function showCardVote(name, cards, onChoose) {
    $('vote-title').textContent = 'Carta de un compañero';
    $('vote-sub').innerHTML = 'Elige la carta de <b translate="no"></b>. Cuando votéis todos, se queda la más votada.';
    $('vote-sub').querySelector('b').textContent = name;
    $('vote-wait').textContent = '';
    const box = $('vote-cards');
    box.innerHTML = '';
    box.classList.remove('hidden');
    cards.forEach((c, i) => box.appendChild(voteCardEl(c, i, index => {
      box.querySelectorAll('.card').forEach((el, j) => el.classList.toggle('picked', j === index));
      $('vote-wait').textContent = 'Has votado. Esperando al resto…';
      onChoose(index);
    })));
    $('vote-yn').classList.add('hidden');
    G.UI.show('scr-vote');
  }

  /** Voto para sacar a alguien. `mine` = te están votando a ti. */
  function showKickVote(name, mine, onChoose) {
    $('vote-title').textContent = 'Sacar de la partida';
    $('vote-cards').innerHTML = '';
    $('vote-wait').textContent = '';
    const yn = $('vote-yn');
    yn.innerHTML = '';
    if (mine) {
      $('vote-sub').innerHTML = 'Están votando si sales de la partida.';
      yn.classList.add('hidden');
      $('vote-wait').textContent = 'Esperando al resto…';
    } else {
      $('vote-sub').innerHTML = '¿Sacar a <b translate="no"></b> de la partida?';
      $('vote-sub').querySelector('b').textContent = name;
      yn.classList.remove('hidden');
      for (const [label, yes] of [['Sí, sacar', true], ['No', false]]) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn' + (yes ? '' : ' ghost');
        b.textContent = label;
        b.onclick = () => {
          yn.querySelectorAll('button').forEach(x => { x.disabled = true; });
          $('vote-wait').textContent = 'Has votado. Esperando al resto…';
          onChoose(yes);
        };
        yn.appendChild(b);
      }
    }
    G.UI.show('scr-vote');
  }

  function closeVote() { G.UI.hide('scr-vote'); }

  return { showLevelUp, reroll, showItemChoice, showBond, pickBond, bondBack, pick, forcePick, setWaiting, closeLevelUp, showOver, wirePause, showPause, showWheel, tick, showCardVote, showKickVote, closeVote };
})();
