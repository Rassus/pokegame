/* ============ social-ui.js — apodo, amigos, sala e invitaciones ============ */
(() => {
  const $ = G.UI.$;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** ¿Se puede usar lo online? Si no, explica por qué. */
  function needOnline() {
    if (G.DB.online) return true;
    G.UI.toast(G.DB.guest ? 'Crea una cuenta para jugar con amigos y salir en el ranking.'
      : 'Esto necesita la versión online del juego (con la nube).', 3200);
    return false;
  }

  // ======================= APODO =======================

  G.NickUI = (() => {
    let then = null, skipped = false;

    function init() {
      $('nick-form').onsubmit = async e => {
        e.preventDefault();
        $('nick-err').textContent = '';
        $('nick-ok').disabled = true;
        const r = await G.Social.claimNick($('nick-in').value);
        $('nick-ok').disabled = false;
        if (!r.ok) { $('nick-err').textContent = r.error; G.Audio.sfx('error'); return; }
        G.Audio.sfx('confirm');
        G.UI.toast('Tu apodo es ' + G.Social.me.name);
        const cb = then; then = null;
        if (cb) cb(); else G.MenuUI.open();
      };
      $('nick-later').onclick = () => { skipped = true; then = null; G.MenuUI.open(); };
    }

    /** @param next  qué abrir después de elegirlo */
    function open(next) {
      then = next || null;
      G.UI.show('scr-nick');
      $('nick-err').textContent = '';
      $('nick-in').value = '';
      setTimeout(() => $('nick-in').focus(), 50);
    }

    return { init, open, get skipped() { return skipped; } };
  })();

  /** Abre `fn` si tienes apodo; si no, pide el apodo primero. */
  function withNick(fn) {
    if (!needOnline()) return;
    if (G.Social.me) { fn(); return; }
    G.Social.start().then(r => { if (r === 'ok') fn(); else G.NickUI.open(fn); });
  }

  // ======================= AMIGOS =======================

  G.FriendsUI = (() => {
    function init() {
      $('fr-add').onsubmit = async e => {
        e.preventDefault();
        const name = $('fr-name').value;
        msg('');
        const r = await G.Social.request(name);
        msg(r.ok ? r.msg : r.error, !r.ok);
        if (r.ok) $('fr-name').value = '';
      };
      $('fr-room').onclick = () => G.LobbyUI.open();
      G.Social.on(() => { if (G.UI.isOpen('scr-friends')) render(); });
    }

    function msg(t, bad) {
      $('fr-msg').textContent = t || '';
      $('fr-msg').style.color = bad ? '#ffb0b8' : '';
      if (t) G.Audio.sfx(bad ? 'error' : 'confirm');
    }

    function open() { withNick(() => { G.UI.show('scr-friends', true); msg(''); render(); G.Social.refreshPresence(); }); }

    /** "hace 5 min", "hace 2 h", "hace 3 días". */
    function ago(t) {
      const m = Math.max(1, Math.round((Date.now() - t) / 60000));
      if (m < 60) return 'hace ' + m + ' min';
      const h = Math.round(m / 60);
      if (h < 48) return 'hace ' + h + ' h';
      return 'hace ' + Math.round(h / 24) + ' días';
    }

    function stateText(f) {
      if (f.status === 'in') return 'Quiere ser tu amigo';
      if (f.status === 'out') return 'Solicitud enviada';
      if (!f.online) return f.seen ? 'Visto ' + ago(f.seen) : 'Desconectado';
      return f.play ? 'Jugando' : 'En línea';
    }

    function render() {
      const room = G.Social.room;
      $('fr-me').innerHTML = 'Tu apodo: <b class="gold" translate="no">' + esc(G.Social.me ? G.Social.me.name : '') + '</b> · dáselo a tus amigos para que te añadan.';
      $('fr-room').classList.toggle('hidden', !room);
      const list = G.Social.friends.sort((a, b) => {
        const rank = f => f.status === 'in' ? 0 : f.status === 'ok' ? (f.online ? (f.play ? 2 : 1) : 3) : 4;
        return rank(a) - rank(b) || a.name.localeCompare(b.name);
      });
      const box = $('fr-list');
      box.innerHTML = '';
      if (!list.length) {
        box.innerHTML = '<p class="sub">Aún no tienes amigos añadidos. Escribe arriba el apodo de un amigo.</p>';
        return;
      }
      for (const f of list) {
        const el = document.createElement('div');
        el.className = 'fr-row';
        const dot = f.status !== 'ok' ? 'pend' : !f.online ? 'off' : f.play ? 'play' : 'on';
        const inRoom = room && room.members.some(m => m.uid === f.uid);
        el.innerHTML = `<i class="dot ${dot}"></i><b translate="no"><a href="#" class="plink" title="Ver su perfil">${esc(f.name)}</a></b><span class="st">${inRoom ? 'En tu sala' : stateText(f)}</span><span class="grow"></span>`;
        if (f.status === 'ok') el.querySelector('.plink').onclick = e => { e.preventDefault(); G.ProfileUI.show(f.uid); };
        else el.querySelector('.plink').onclick = e => e.preventDefault();
        const btn = (txt, cls, fn) => {
          const b = document.createElement('button');
          b.className = 'btn small ' + cls; b.textContent = txt; b.onclick = fn; el.appendChild(b); return b;
        };
        if (f.status === 'in') {
          btn('Aceptar', 'gold', async () => { const r = await G.Social.accept(f.uid); msg(r.ok ? r.msg : r.error, !r.ok); });
          btn('Rechazar', 'ghost', () => G.Social.remove(f.uid));
        } else if (f.status === 'out') {
          btn('Cancelar', 'ghost', () => G.Social.remove(f.uid));
        } else {
          if (f.online && !f.play && !inRoom && (!room || room.isHost)) {
            btn('Invitar', 'gold', async () => {
              const r = await G.Social.invite(f.uid);
              msg(r.ok ? r.msg : r.error, !r.ok);
              if (r.ok) G.LobbyUI.open();
            });
          }
          btn('Quitar', 'ghost', () => { if (confirm('¿Quitar a ' + f.name + ' de tus amigos?')) G.Social.remove(f.uid); });
        }
        box.appendChild(el);
      }
    }

    return { init, open, render };
  })();

  // ======================= SALA =======================

  G.LobbyUI = (() => {
    let membersKey = '';
    let playUiKey = '';
    let lastTower = { id: '', mode: 'normal' };
    let pickGen = 1;

    function purse(m) {
      if (m.uid === G.Social.uid) {
        const s = G.DB.save;
        return {
          known: true,
          coins: Math.max(0, Math.floor(Number(s && s.coins) || 0)),
          t1: Math.max(0, Math.floor(Number(s && s.tickets && s.tickets.t1) || 0))
        };
      }
      if (typeof m.coins !== 'number') return { known: false, coins: 0, t1: 0 };
      return {
        known: true,
        coins: Math.max(0, Math.floor(Number(m.coins) || 0)),
        t1: Math.max(0, Math.floor(Number(m.t1) || 0))
      };
    }

    /** ¿Le alcanza la entrada? why: '' | 'wait' | 'coins' | 'tickets' | 'both'. */
    function affordOf(m, pay) {
      if (!pay || (!(pay.share > 0) && !(pay.tickets > 0))) return { ok: true, why: '' };
      const p = purse(m);
      if (!p.known) return { ok: false, why: 'wait' };
      const coins = Math.max(0, (pay.share || 0) - p.coins);
      const tickets = Math.max(0, (pay.tickets || 0) - p.t1);
      if (coins && tickets) return { ok: false, why: 'both', coins, tickets };
      if (coins) return { ok: false, why: 'coins', need: coins };
      if (tickets) return { ok: false, why: 'tickets', need: tickets };
      return { ok: true, why: '' };
    }

    function payText(a) {
      if (!a) return { text: '', cls: '' };
      if (a.why === 'wait') return { text: 'Comprobando…', cls: 'wait' };
      if (a.ok) return { text: 'Puede entrar', cls: 'ok' };
      if (a.why === 'both') return { text: 'Faltan ' + G.U.num(a.coins) + ' y ' + a.tickets + ' tickets', cls: 'no' };
      if (a.why === 'tickets') return { text: 'Faltan ' + a.need + ' tickets', cls: 'no' };
      return { text: 'Faltan ' + G.U.num(a.need), cls: 'no' };
    }

    function costText(pay) {
      if (!pay) return '';
      if (pay.tickets) return 'Entrada: ' + G.U.num(pay.share) + ' y ' + pay.tickets + ' tickets grises cada uno';
      if (pay.share) return 'Entrada: ' + G.U.num(pay.share) + ' cada uno';
      return 'Entrada gratis';
    }

    function kindTab(text, on, fn) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'gen-tab' + (on ? ' on' : '');
      const lab = document.createElement('b');
      lab.textContent = text;
      b.appendChild(lab);
      b.onclick = fn;
      return b;
    }

    function buildPlay(box, room, play) {
      box.classList.toggle('view', !room.isHost);
      box.replaceChildren();
      const label = document.createElement('p');
      label.className = 'lobby-label';
      label.textContent = 'Tipo de partida';
      box.appendChild(label);

      const kinds = document.createElement('div');
      kinds.className = 'gen-tabs';
      kinds.appendChild(kindTab('Partida normal', play.kind !== 'tower', () => G.Social.setPlay({ kind: 'run' })));
      kinds.appendChild(kindTab('Torre', play.kind === 'tower', () => {
        const mode = lastTower.mode || 'normal';
        const id = lastTower.id && G.Towers.LIST.some(t => t.id === lastTower.id) ? lastTower.id : '';
        G.Social.setPlay({ kind: 'tower', id, mode });
        if (room.isHost) openPick();
      }));
      box.appendChild(kinds);

      if (play.kind === 'tower') {
        const modes = document.createElement('div');
        modes.className = 'gen-tabs';
        for (const m of G.Towers.MODES) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'gen-tab' + (m.id === (play.mode || 'normal') ? ' on' : '');
          b.dataset.mode = m.id;
          const lab = document.createElement('b');
          lab.textContent = m.name;
          const hint = document.createElement('small');
          hint.textContent = m.hint;
          b.appendChild(lab);
          b.appendChild(hint);
          if (room.isHost) b.onclick = () => G.Social.setPlay({ kind: 'tower', id: play.id || '', mode: m.id });
          modes.appendChild(b);
        }
        box.appendChild(modes);

        const chosen = play.id && G.Towers.LIST.find(x => x.id === play.id);
        const nameLine = document.createElement('p');
        nameLine.className = 'lobby-pick';
        if (!chosen) nameLine.textContent = room.isHost ? 'Elige una torre para empezar.' : 'El anfitrión aún no elige torre.';
        else {
          const name = (G.DEX_BY[chosen.dexes[0]] && G.DEX_BY[chosen.dexes[0]].name) || chosen.name;
          const modeName = (G.Towers.MODES.find(m => m.id === play.mode) || G.Towers.MODES[0]).name;
          nameLine.textContent = 'Torre de ' + name + ' · ' + modeName;
        }
        box.appendChild(nameLine);
        if (room.isHost) {
          const pick = document.createElement('button');
          pick.type = 'button';
          pick.className = 'btn gold';
          pick.style.marginTop = '6px';
          pick.style.width = '100%';
          pick.textContent = chosen ? 'Cambiar torre' : 'Elegir torre';
          pick.onclick = () => openPick();
          box.appendChild(pick);
        }
      }

      const cost = document.createElement('p');
      cost.className = 'lobby-cost';
      box.appendChild(cost);
    }

    function towerName(t) {
      return (G.DEX_BY[t.dexes[0]] && G.DEX_BY[t.dexes[0]].name) || t.name;
    }

    /** Ventana para escoger la torre. La dificultad es la que está marcada en la sala. */
    function openPick() {
      const room = G.Social.room;
      if (!room || !room.isHost) return;
      const play = room.play && room.play.kind === 'tower' ? room.play : { kind: 'tower', id: '', mode: lastTower.mode || 'normal' };
      const mode = play.mode || 'normal';
      const cur = play.id && G.Towers.LIST.find(t => t.id === play.id);
      if (cur) pickGen = cur.gen;
      const gens = [];
      for (let g = 1; g <= 9; g++) if (G.Towers.LIST.some(t => t.gen === g)) gens.push(g);
      if (!gens.includes(pickGen)) pickGen = gens[0] || 1;
      G.UI.show('scr-lobby-tower');
      const modeName = (G.Towers.MODES.find(m => m.id === mode) || G.Towers.MODES[0]).name;
      const sub = $('lobby-tower-sub');
      if (sub) sub.textContent = 'Modo ' + modeName + '. La entrada se reparte entre la sala.';
      const box = $('lobby-tower-list');
      if (!box) return;
      const tabs = gens.map(g =>
        '<button type="button" class="gen-tab' + (g === pickGen ? ' on' : '') + '" data-gen="' + g + '"><b>' + (G.Towers.REGIONS[g] || g) + '</b></button>'
      ).join('');
      box.innerHTML = '<div class="gen-tabs">' + tabs + '</div><div id="lobby-tower-rows"></div>';
      box.querySelectorAll('[data-gen]').forEach(b => { b.onclick = () => { pickGen = +b.dataset.gen; openPick(); }; });
      const rows = $('lobby-tower-rows');
      for (const t of G.Towers.LIST.filter(x => x.gen === pickGen)) {
        const el = document.createElement('div');
        el.className = 'tower-row';
        const name = towerName(t);
        const title = document.createElement('b');
        title.textContent = name;
        title.setAttribute('translate', 'no');
        el.appendChild(title);
        const info = document.createElement('span');
        info.className = 'ds';
        const open = G.Towers.unlocked(t.dexes[0]);
        const modeOk = open && G.Towers.modeOpen(t.id, mode);
        if (!open) info.textContent = 'Vence a ' + name + ' en una grieta';
        else if (!modeOk) info.textContent = mode === 'mad' ? 'Supera el modo difícil' : 'Supera el modo normal';
        else info.textContent = costText(G.Towers.due(t.id, mode));
        el.appendChild(info);
        if (open) {
          const bestN = G.Towers.bestWave(t.id, mode);
          if (bestN) {
            const best = document.createElement('span');
            best.className = 'ds';
            best.textContent = 'Tu mejor: oleada ' + bestN;
            el.appendChild(best);
          }
        }
        if (modeOk) {
          const go = document.createElement('span');
          go.className = 'tower-go';
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'btn small' + (t.id === play.id ? '' : ' gold');
          btn.textContent = t.id === play.id ? 'Elegida' : 'Elegir';
          btn.onclick = () => {
            G.Social.setPlay({ kind: 'tower', id: t.id, mode });
            G.Audio.sfx('confirm');
            G.LobbyUI.open();
          };
          go.appendChild(btn);
          el.appendChild(go);
        }
        rows.appendChild(el);
      }
    }

    /** Dibuja el tipo de partida y devuelve el precio de la torre, si hay una elegida. */
    function renderPlay(room) {
      const box = $('lobby-play');
      const play = room.play && room.play.kind === 'tower' ? room.play : { kind: 'run' };
      if (play.kind === 'tower') lastTower = { id: play.id || '', mode: play.mode || 'normal' };
      const key = (room.isHost ? 'h:' : 'g:') + (play.kind === 'tower' ? 'tower:' + (play.id || '') + ':' + (play.mode || 'normal') : 'run');
      if (box && key !== playUiKey) {
        playUiKey = key;
        buildPlay(box, room, play);
      }
      const pay = play.kind === 'tower' && play.id ? G.Towers.due(play.id, play.mode) : null;
      const cost = box && box.querySelector('.lobby-cost');
      if (cost) cost.textContent = costText(pay);
      return { play, pay };
    }

    function init() {
      $('lobby-leave').onclick = async () => {
        await G.Social.leaveRoom();
        G.Net.close();
        G.MenuUI.open();
      };
      $('lobby-menu').onclick = () => G.MenuUI.open();
      $('lobby-start').onclick = start;
      $('lobby-start').dataset.sfx = 'confirm';
      const towerBack = $('lobby-tower-back');
      if (towerBack) towerBack.onclick = () => open();
      $('lobby-ready').onclick = () => {
        const room = G.Social.room;
        const mine = room && room.members.find(m => m.uid === G.Social.uid);
        G.Social.setReady(!(mine && mine.ready));
        G.Audio.sfx('select');
      };
      // Conecta / desconecta la red al entrar o salir de una sala.
      G.Social.on(what => {
        const room = G.Social.room;
        if (room) {
          G.Net.open(room.id, room.isHost, room.host);
          G.Net.syncMembers(room.members.map(m => m.uid));
        } else if (G.Net.open_) G.Net.close();
        if (what === 'room-closed') {
          G.UI.toast('La sala se ha cerrado', 2600);
          if (G.UI.isOpen('scr-lobby') || G.UI.isOpen('scr-lobby-tower')) G.MenuUI.open();
        }
        if (what === 'kicked') {
          G.UI.toast('Te han sacado de la sala', 2800);
          if (G.Game.state === 'ui') G.MenuUI.open();
        }
        if (G.UI.isOpen('scr-lobby')) render();
      });
      G.Net.onPeer(() => { if (G.UI.isOpen('scr-lobby')) render(); });
    }

    function open() {
      if (!G.Social.room) { G.MenuUI.open(); return; }
      G.Social.refreshMember();
      G.Social.refreshPresence();
      G.UI.show('scr-lobby', true);
      membersKey = '';
      playUiKey = '';
      render();
    }

    function close() { G.UI.hide('scr-lobby'); }

    async function removeMember(uid, name) {
      if (!confirm('¿Sacar a ' + name + ' de la sala?')) return;
      const r = await G.Social.kick(uid);
      G.UI.toast(r.ok ? name + ' ha salido de la sala' : (r.error || 'No se pudo sacar de la sala.'));
    }

    function connText(m, room) {
      if (m.uid === room.host) return 'Anfitrión';
      if (!room.isHost) return m.uid === G.Social.uid ? 'Tú' : 'En la sala';
      const mode = G.Net.mode(m.uid);
      return mode === 'direct' ? 'Conectado' : mode === 'relay' ? 'Conectado (por servidor)' : mode === 'failed' ? 'No se pudo conectar (reintentando…)' : 'Conectando…';
    }

    function render() {
      const room = G.Social.room;
      if (!room) return;
      G.Social.refreshMember();
      const ms = room.members;
      const chosen = renderPlay(room);
      const play = chosen.play;
      const pay = chosen.pay;
      $('lobby-sub').textContent = room.isHost
        ? 'Eres el anfitrión. Invita a tus amigos (hasta ' + G.Social.MAX_PLAYERS + ') y empezad cuando estéis.'
        : 'Estás en la sala de ' + ((ms.find(m => m.uid === room.host) || {}).name || '…') + '. El anfitrión empezará la partida.';

      // Las tarjetas sólo se rehacen si cambian los miembros (los sprites no parpadean).
      const key = ms.map(m => m.uid + ':' + m.dex + ':' + (m.shiny ? 1 : 0)).join('|');
      const box = $('lobby-members');
      if (key !== membersKey) {
        membersKey = key;
        box.innerHTML = '';
        for (let i = 0; i < G.Social.MAX_PLAYERS; i++) {
          const m = ms[i];
          const c = document.createElement('div');
          c.className = 'lob-card' + (m ? '' : ' empty');
          if (m) {
            c.style.setProperty('--pc', G.Coop.COLORS[i]);
            c.appendChild(G.UI.spriteCanvas(m.dex, 120, 96, { scale: 2, lively: true, shiny: !!m.shiny }));
            c.insertAdjacentHTML('beforeend', `<b translate="no">${esc(m.name)}</b><small>${esc((G.DEX_BY[m.dex] || {}).name || '')}</small><span class="pay" data-u="${m.uid}"></span><span class="rdy" data-u="${m.uid}"></span><span class="conn" data-u="${m.uid}"></span>`);
            if (room.isHost && m.uid !== room.host) {
              const b = document.createElement('button');
              b.type = 'button';
              b.className = 'btn small ghost';
              b.textContent = 'Sacar';
              b.onclick = () => removeMember(m.uid, m.name);
              c.appendChild(b);
            }
          } else c.innerHTML = '<span>Libre</span>';
          box.appendChild(c);
        }
      }
      box.querySelectorAll('.lob-card').forEach((c, i) => {
        const m = ms[i];
        const a = m && pay ? affordOf(m, pay) : null;
        c.classList.toggle('ready', !!(m && m.ready));
        c.classList.toggle('short', !!(a && !a.ok && a.why !== 'wait'));
      });
      box.querySelectorAll('.pay').forEach(el => {
        const m = ms.find(x => x.uid === el.dataset.u);
        if (!m || !pay) { el.textContent = ''; el.className = 'pay'; return; }
        const lab = payText(affordOf(m, pay));
        el.textContent = lab.text;
        el.className = 'pay' + (lab.cls ? ' ' + lab.cls : '');
      });
      box.querySelectorAll('.rdy').forEach(el => {
        const m = ms.find(x => x.uid === el.dataset.u);
        if (!m) return;
        el.textContent = m.ready ? 'Listo' : 'Esperando';
      });
      box.querySelectorAll('.conn').forEach(el => {
        const m = ms.find(x => x.uid === el.dataset.u);
        if (!m) return;
        const t = connText(m, room);
        el.textContent = t;
        el.className = 'conn' + (t === 'Conectando…' ? ' wait' : '');
      });

      // Invitar (sólo el anfitrión y si queda sitio).
      const canInvite = room.isHost && ms.length < G.Social.MAX_PLAYERS;
      $('lobby-inv-title').classList.toggle('hidden', !canInvite);
      const inv = $('lobby-invite');
      inv.classList.toggle('hidden', !canInvite);
      if (canInvite) {
        inv.innerHTML = '';
        const free = G.Social.friends.filter(f => f.status === 'ok' && f.online && !ms.some(m => m.uid === f.uid));
        if (!free.length) inv.innerHTML = '<p class="sub" style="margin:0">Ningún amigo en línea ahora mismo.</p>';
        for (const f of free) {
          const el = document.createElement('div');
          el.className = 'fr-row';
          el.innerHTML = `<i class="dot ${f.play ? 'play' : 'on'}"></i><b translate="no">${esc(f.name)}</b><span class="st">${f.play ? 'Jugando' : 'En línea'}</span><span class="grow"></span>`;
          const b = document.createElement('button');
          b.className = 'btn small gold'; b.textContent = 'Invitar';
          b.onclick = async () => { const r = await G.Social.invite(f.uid); G.UI.toast(r.ok ? r.msg : r.error); };
          el.appendChild(b);
          inv.appendChild(el);
        }
      }

      const mine = ms.find(m => m.uid === G.Social.uid);
      const readyBtn = $('lobby-ready');
      const imReady = !!(mine && mine.ready);
      readyBtn.textContent = imReady ? 'No estoy listo' : 'Listo';
      readyBtn.classList.toggle('gold', !imReady);
      const allReady = ms.length >= 2 && ms.every(m => m.ready);
      const nReady = ms.filter(m => m.ready).length;
      const btn = $('lobby-start');
      btn.classList.toggle('hidden', !room.isHost);
      const connecting = ms.some(m => m.uid !== room.host && G.Net.mode(m.uid) === 'connecting');
      const failed = ms.some(m => m.uid !== room.host && G.Net.mode(m.uid) === 'failed');
      const towerOn = play.kind === 'tower';
      const modeOk = !room.isHost || !towerOn || !play.id || G.Towers.modeOpen(play.id, play.mode);
      const blocked = pay ? ms.map(m => ({ m, a: affordOf(m, pay) })).filter(x => !x.a.ok) : [];
      const broke = blocked.filter(x => x.a.why !== 'wait');
      const waitingPurse = blocked.some(x => x.a.why === 'wait');
      btn.disabled = !room.isHost || !allReady || connecting || failed
        || (towerOn && !pay) || (towerOn && !modeOk) || broke.length > 0 || waitingPurse;
      btn.textContent = (towerOn ? 'Empezar torre (' : 'Empezar partida (') + nReady + '/' + ms.length + ')';
      $('lobby-note').textContent = ms.length < 2 && room.isHost ? 'Necesitas al menos un amigo en la sala.'
        : failed ? 'No se puede conectar con algún amigo: su red (o la tuya) no deja jugar en grupo. Probad con otra wifi o datos móviles; se reintenta solo.'
        : connecting ? 'Conectando con tus amigos…'
        : towerOn && !play.id ? 'Elige una torre para empezar.'
        : towerOn && !modeOk ? (play.mode === 'mad' ? 'Supera el modo difícil' : 'Supera el modo normal')
        : broke.length ? 'No pueden entrar: ' + broke.map(x => x.m.name).join(', ') + '.'
        : waitingPurse ? 'Comprobando el oro de la sala…'
        : !allReady ? 'Poneos listos. La partida empieza cuando lo estéis todos (' + nReady + '/' + ms.length + ').'
        : room.isHost ? 'Todos listos. La partida empieza para todos a la vez.'
        : 'Todos listos. El anfitrión puede empezar.';
    }

    function start() {
      const room = G.Social.room;
      if (!room || !room.isHost || room.members.length < 2 || !room.members.every(m => m.ready)) return;
      const play = room.play && room.play.kind === 'tower' ? room.play : { kind: 'run' };
      let tower = null;
      if (play.kind === 'tower') {
        if (!play.id || !G.Towers.modeOpen(play.id, play.mode)) return;
        const pay = G.Towers.due(play.id, play.mode);
        if (!pay || room.members.some(m => !affordOf(m, pay).ok)) return;
        tower = G.Towers.prepare(play.id, play.mode);
        if (!tower) return;
      }
      const cfg = {
        k: 'start', seed: Math.floor(Math.random() * 1e6), host: room.host,
        members: room.members.map(m => ({ uid: m.uid, name: m.name, dex: m.dex, shiny: !!m.shiny, st: m.st == null ? null : G.Upgrades.sheet(m.st) }))
      };
      if (tower) cfg.tower = tower;
      G.Social.setOpen(false);
      G.Net.broadcast(cfg);
      G.Flow.startCoop(cfg);
    }

    return { init, open, close, render };
  })();

  // ======================= INVITACIONES =======================

  G.InvitePop = (() => {
    let cur = null;

    function init() {
      $('inv-yes').onclick = async () => {
        if (!cur) return;
        const from = cur.from;
        hide();
        const r = await G.Social.acceptInvite(from);
        if (!r.ok) { G.UI.toast(r.error, 3000); return; }
        G.LobbyUI.open();
      };
      $('inv-no').onclick = () => { if (cur) G.Social.declineInvite(cur.from); hide(); };
      G.Social.on(what => { if (what === 'invites' || what === 'room') refresh(); });
    }

    function hide() { cur = null; $('invite-pop').classList.add('hidden'); }

    /** Enseña la invitación más antigua si estás en los menús (no en plena partida). */
    function refresh() {
      const room = G.Social.room;
      const list = G.Social.invites.filter(i => !room || i.room !== room.id).sort((a, b) => a.at - b.at);
      if (!list.length || G.Game.state !== 'ui' || !G.DB.loggedIn) { hide(); return; }
      if (cur && cur.from === list[0].from) return;
      cur = list[0];
      $('inv-text').innerHTML = `${G.Icons.html('friends', 22)} <b class="gold" translate="no">${esc(cur.name)}</b> te invita a jugar en su sala`;
      $('invite-pop').classList.remove('hidden');
      G.Audio.sfx('shiny');
    }

    return { init, refresh };
  })();

  G.SocialUI = {
    init() { G.NickUI.init(); G.FriendsUI.init(); G.LobbyUI.init(); G.InvitePop.init(); },
    withNick, needOnline
  };
})();
