/* ============ tower-ui.js — pantalla de torres ============ */
G.TowerUI = (() => {
  const $ = G.UI.$;
  const INTRO = 'Cada jefe que venzas en una grieta tiene su torre. La primera oleada sale al entrar y luego una cada 10 segundos, aunque queden Pokémon vivos. El oro de la entrada se reparte entre la sala. Desde Hoenn, cada jugador paga 10 tickets grises. Rayquaza cuesta 100.000 de oro y no pide tickets. Al ganar, según la tier: oro ×4 del costo × la tier, tickets dorados ×0,8 × la tier y un 60% de 45 a 100 fragmentos ×1,5 × la tier. Kanto es la tier 1 y cada región suma una; el difícil empieza en la 10 y el demencial en la 19. Si no lo tienes, un 25% de atraparlo. El jefe puede salir shiny (1/1024) y, cada vez que cae, fusionas un movimiento. Cada oleada suma un 3% de vida y de daño. En la 10, 30, 50, 70 y 90 salen Chansey. Cada 10 oleadas abre una tienda con 2 mejoras y una baya (blanca, morada, azul o dorada); Premio por oleada la adelanta hasta cada 5. Al vencer a un jefe no cae un objeto: se abre una tienda con 2 objetos y 1 cambio. Si ya llevas uno, la tercera opción es conservarlo. No salen la Ganzúa, la Llave Maestra, la Moneda Amuleto ni la Piedra Evolución. Cada Pokémon tiene un 70% de soltar oro: 3 × la tier + 3 × Oro extra. La experiencia es la base ×1 en normal, ×0,5 en difícil y ×0,1 en demencial, y después Exp extra. En Kanto, un 0,01% de un fragmento suyo. Difícil duplica los Pokémon de cada oleada, les pone ×1,3 de vida y de velocidad de ataque, baja el tiempo a 5 segundos y el jefe sale en 10 etapas. Cuesta cuatro veces más, al ganar el oro se multiplica por 4 y se abre al superar esa torre en normal. Demencial los cuadruplica, una oleada cada 2 segundos, y suelta un jefe en cada oleada: se quedan todos a la vez. No cuesta nada y se abre al superar esa torre en difícil.';
  let gen = 1;
  let mode = 'normal';

  function open() {
    G.UI.show('scr-towers', true);
    const box = $('tower-list');
    const gens = [];
    for (let g = 1; g <= 9; g++) if (G.Towers.LIST.some(t => t.gen === g)) gens.push(g);
    if (!gens.includes(gen)) gen = gens[0] || 1;
    const tabs = gens.map(g => {
      const all = G.Towers.LIST.filter(t => t.gen === g);
      const n = all.filter(t => G.Towers.unlocked(t.dexes[0])).length;
      const name = (G.Towers.REGIONS && G.Towers.REGIONS[g]) || g;
      return '<button type="button" class="gen-tab' + (g === gen ? ' on' : '') + '" data-gen="' + g + '"><b>' + name + '</b><small>' + n + '/' + all.length + '</small></button>';
    }).join('');
    const modeTabs = G.Towers.MODES.map(m =>
      '<button type="button" class="gen-tab' + (m.id === mode ? ' on' : '') + '" data-mode="' + m.id + '"><b>' + m.name + '</b><small>' + m.hint + '</small></button>'
    ).join('');
    box.innerHTML = '<p class="sub">' + INTRO + '</p><div class="gen-tabs">' + modeTabs + '</div><div class="gen-tabs">' + tabs + '</div><div id="tower-rows"></div>';
    box.querySelectorAll('[data-mode]').forEach(b => { b.onclick = () => { mode = b.dataset.mode; open(); }; });
    box.querySelectorAll('.gen-tab').forEach(b => { if (!b.dataset.mode) b.onclick = () => { gen = +b.dataset.gen; open(); }; });
    const rows = $('tower-rows');
    for (const t of G.Towers.LIST.filter(t => t.gen === gen)) {
      const el = document.createElement('div');
      el.className = 'tower-row';
      const dex = t.dexes[0];
      const name = G.DEX_BY[dex] ? G.DEX_BY[dex].name : t.name;
      if (!G.Towers.unlocked(dex)) {
        el.innerHTML = '<b>' + name + '</b><span class="ds">Vence a ' + name + ' en una grieta</span>';
      } else {
        const pay = G.Towers.due(t.id, mode);
        const own = G.DB.owns(dex) ? ' · en tu pokédex' : '';
        const picked = G.Towers.MODES.find(x => x.id === mode) || G.Towers.MODES[0];
        const tier = G.Towers.tierOf(t.gen, mode);
        const extra = (picked.detail ? ' · ' + picked.detail : (t.waves > 100 ? ' · 6 encuentros antes del jefe final' : ' · jefe en la 25, 50, 75 y 100')) + ' · tier ' + tier;
        const bestN = G.Towers.bestWave(t.id, mode);
        const bestHtml = bestN ? '<span class="ds">Tu mejor: oleada ' + bestN + '</span>' : '';
        if (!G.Towers.modeOpen(t.id, mode)) {
          const need = mode === 'mad' ? 'Supera el modo difícil' : 'Supera el modo normal';
          el.innerHTML = '<b>' + name + '</b><span class="ds">' + t.waves + ' oleadas' + extra + '</span>' + bestHtml + '<span class="ds">' + need + '</span>';
        } else {
        const label = pay.tickets
          ? 'Entrar · ' + G.U.num(pay.share) + ' y ' + pay.tickets + ' tickets grises'
          : pay.share ? 'Entrar · ' + G.U.num(pay.share) : 'Entrar · gratis';
        const duel = G.UI.helpersOn()
          ? '<button class="btn small" data-id="' + t.id + '" data-duel="1">Jefe directo</button>' : '';
        el.innerHTML = '<b>' + name + '</b><span class="ds">' + t.waves + ' oleadas' + extra + own + '</span>' + bestHtml +
          '<span class="tower-go"><button class="btn small gold" data-id="' + t.id + '">' + label + '</button>' + duel + '</span>';
        el.querySelectorAll('button').forEach(b => { b.onclick = () => start(b.dataset.id, b.dataset.duel === '1'); });
        }
      }
      rows.appendChild(el);
    }
  }

  function start(id, duel) {
    if (duel && !G.UI.helpersOn()) return;
    const room = G.Social && G.Social.room;
    const n = (room && room.members.length) || 1;
    if (room && n >= 2 && !duel) {
      if (!room.isHost) { G.UI.toast('Entra el anfitrión de la sala'); return; }
      if (!G.Towers.modeOpen(id, mode)) {
        G.UI.toast(mode === 'mad' ? 'Supera el modo difícil' : 'Supera el modo normal');
        return;
      }
      G.Social.setPlay({ kind: 'tower', id: String(id), mode });
      G.Audio.sfx('confirm');
      G.UI.toast('La torre queda elegida en la sala.');
      G.LobbyUI.open();
      return;
    }
    if (room && n >= 2 && !room.isHost) { G.UI.toast('Entra el anfitrión de la sala'); return; }
    const pay = G.Towers.due(id, duel ? 'normal' : mode);
    if (!pay) return;
    if (!duel && !G.Towers.modeOpen(id, mode)) {
      G.UI.toast(mode === 'mad' ? 'Supera el modo difícil' : 'Supera el modo normal');
      return;
    }
    if (!duel) {
      const why = G.Towers.afford(pay);
      if (why === 'tickets') { G.UI.toast('No tienes tickets grises para la torre (' + pay.tickets + ')'); return; }
      if (why === 'coins') { G.UI.toast('No tienes Pokémonedas para la torre (' + G.U.num(pay.share) + ')'); return; }
    }
    const cfg = G.Towers.prepare(id, duel ? 'normal' : mode);
    if (!cfg) return;
    if (duel) { cfg.duel = true; cfg.share = 0; cfg.tickets = 0; }
    G.Audio.sfx('confirm');
    if (room && n >= 2) {
      const startCfg = {
        k: 'start',runId: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) ,seed: Math.floor(Math.random() * 1e6), host: room.host,
        members: room.members.map(m => ({ uid: m.uid, name: m.name, dex: m.dex, shiny: !!m.shiny, st: m.st == null ? null : G.Upgrades.sheet(m.st) })),
        tower: cfg
      };
      G.Social.setActiveRun(startCfg.runId);
      G.Net.broadcast(startCfg);
      G.Flow.startCoop(startCfg);
      return;
    }
    G.Towers.arm(cfg);
    G.Flow.play();
  }

  return { open };
})();
