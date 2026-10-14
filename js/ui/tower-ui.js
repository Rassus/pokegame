/* ============ tower-ui.js — pantalla de torres ============ */
G.TowerUI = (() => {
  const $ = G.UI.$;

  function open() {
    G.UI.show('scr-towers', true);
    const box = $('tower-list');
    const cost = G.Towers.share();
    const n = (G.Social.room && G.Social.room.members.length) || 1;
    const split = n > 1 ? ' Entre ' + n + ': ' + cost + ' cada uno.' : '';
    box.innerHTML = '<p class="sub">100 oleadas en una grieta. La primera sale al entrar y luego una cada 10 segundos, aunque queden Pokémon vivos. La entrada son ' + G.Towers.FEE + ' Pokémonedas, a partes iguales.' + split + ' Si no lo tienes, al ganar hay un 25% de atraparlo; si ya lo tienes, da de 25 a 50 fragmentos. El jefe puede salir shiny (1/1024). Las mejoras suben la dificultad. Sale en las oleadas 25, 50, 75 y 100: al derrotarlo, fusionas un movimiento.</p>';
    for (const t of G.Towers.LIST) {
      const el = document.createElement('div');
      el.className = 'panel';
      el.style.marginTop = '12px';
      const openDex = t.dexes.filter(d => G.Towers.unlocked(d));
      let body;
      if (!openDex.length) {
        const names = t.dexes.map(d => G.DEX_BY[d] ? G.DEX_BY[d].name : d).join(', ');
        body = '<div class="tower-row"><b>' + t.name + '</b><span class="ds">Vence a ' + names + ' en una grieta</span></div>';
      } else {
        const who = t.dexes.map(d => {
          const name = G.DEX_BY[d] ? G.DEX_BY[d].name : d;
          const ok = G.Towers.unlocked(d);
          const own = ok && G.DB.owns(d) ? ' · en tu pokédex' : '';
          return ok ? name + own : name + ' · sin vencer';
        }).join(' · ');
        const duel = G.UI.helpersOn()
          ? '<button class="btn small" data-id="' + t.id + '" data-duel="1">Jefe directo</button>' : '';
        body = '<div class="tower-row"><b>' + t.name + '</b><span class="ds">' + who + '</span>' +
          '<span class="tower-go"><button class="btn small gold" data-id="' + t.id + '">Entrar · ' + cost + '</button>' + duel + '</span></div>';
      }
      el.innerHTML = body;
      el.querySelectorAll('button').forEach(b => { b.onclick = () => start(b.dataset.id, b.dataset.duel === '1'); });
      box.appendChild(el);
    }
  }

  function start(id, duel) {
    if (duel && !G.UI.helpersOn()) return;
    const room = G.Social && G.Social.room;
    const n = (room && room.members.length) || 1;
    if (room && n >= 2 && !room.isHost) { G.UI.toast('Entra el anfitrión de la sala'); return; }
    const cost = duel ? 0 : G.Towers.share();
    if (!duel && (!G.DB.save || (G.DB.save.coins || 0) < cost)) {
      G.UI.toast('No tienes Pokémonedas para la torre (' + cost + ')');
      return;
    }
    const cfg = G.Towers.prepare(id);
    if (!cfg) return;
    if (duel) { cfg.duel = true; cfg.share = 0; }
    G.Audio.sfx('confirm');
    if (room && n >= 2) {
      const startCfg = {
        k: 'start', seed: Math.floor(Math.random() * 1e6), host: room.host,
        members: room.members.map(m => ({ uid: m.uid, name: m.name, dex: m.dex, shiny: !!m.shiny })),
        tower: cfg
      };
      G.Social.setOpen(false);
      G.Net.broadcast(startCfg);
      G.Flow.startCoop(startCfg);
      return;
    }
    G.Towers.arm(cfg);
    G.Flow.play();
  }

  return { open };
})();
