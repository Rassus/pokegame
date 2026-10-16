/* ============ tower-ui.js — pantalla de torres ============ */
G.TowerUI = (() => {
  const $ = G.UI.$;
  const INTRO = 'Cada jefe que venzas en una grieta tiene su torre. La primera oleada sale al entrar y luego una cada 10 segundos, aunque queden Pokémon vivos. El oro de la entrada se reparte entre la sala. Desde Hoenn, cada jugador paga 10 tickets grises. Rayquaza cuesta 100.000 de oro y no pide tickets. Al ganar: 1 ticket dorado, oro ×4 del costo y un 60% de 45 a 100 fragmentos. Si no lo tienes, un 25% de atraparlo. El jefe puede salir shiny (1/1024) y, cada vez que cae, fusionas un movimiento. Cada oleada suma un 3% de vida y de daño. En la 10, 30, 50, 70 y 90 salen Chansey. Cada 10 oleadas abre una tienda con 2 mejoras y una baya (blanca, morada, azul o dorada); Premio por oleada la adelanta hasta cada 5. En torres de Kanto, los Pokémon dan además XP ×2, 3 Pokémonedas y un 0,01% de un fragmento suyo.';
  let gen = 1;

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
    box.innerHTML = '<p class="sub">' + INTRO + '</p><div class="gen-tabs">' + tabs + '</div><div id="tower-rows"></div>';
    box.querySelectorAll('.gen-tab').forEach(b => { b.onclick = () => { gen = +b.dataset.gen; open(); }; });
    const rows = $('tower-rows');
    for (const t of G.Towers.LIST.filter(t => t.gen === gen)) {
      const el = document.createElement('div');
      el.className = 'tower-row';
      const dex = t.dexes[0];
      const name = G.DEX_BY[dex] ? G.DEX_BY[dex].name : t.name;
      if (!G.Towers.unlocked(dex)) {
        el.innerHTML = '<b>' + name + '</b><span class="ds">Vence a ' + name + ' en una grieta</span>';
      } else {
        const pay = G.Towers.due(t.id);
        const own = G.DB.owns(dex) ? ' · en tu pokédex' : '';
        const extra = t.waves > 100 ? ' · 6 encuentros antes del jefe final' : ' · jefe en la 25, 50, 75 y 100';
        const label = pay.tickets
          ? 'Entrar · ' + G.U.num(pay.share) + ' y ' + pay.tickets + ' tickets grises'
          : 'Entrar · ' + G.U.num(pay.share);
        const duel = G.UI.helpersOn()
          ? '<button class="btn small" data-id="' + t.id + '" data-duel="1">Jefe directo</button>' : '';
        el.innerHTML = '<b>' + name + '</b><span class="ds">' + t.waves + ' oleadas' + extra + own + '</span>' +
          '<span class="tower-go"><button class="btn small gold" data-id="' + t.id + '">' + label + '</button>' + duel + '</span>';
        el.querySelectorAll('button').forEach(b => { b.onclick = () => start(b.dataset.id, b.dataset.duel === '1'); });
      }
      rows.appendChild(el);
    }
  }

  function start(id, duel) {
    if (duel && !G.UI.helpersOn()) return;
    const room = G.Social && G.Social.room;
    const n = (room && room.members.length) || 1;
    if (room && n >= 2 && !room.isHost) { G.UI.toast('Entra el anfitrión de la sala'); return; }
    const pay = G.Towers.due(id);
    if (!pay) return;
    if (!duel) {
      const why = G.Towers.afford(pay);
      if (why === 'tickets') { G.UI.toast('No tienes tickets grises para la torre (' + pay.tickets + ')'); return; }
      if (why === 'coins') { G.UI.toast('No tienes Pokémonedas para la torre (' + G.U.num(pay.share) + ')'); return; }
    }
    const cfg = G.Towers.prepare(id);
    if (!cfg) return;
    if (duel) { cfg.duel = true; cfg.share = 0; cfg.tickets = 0; }
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
