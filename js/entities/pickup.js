/* ============ pickup.js — orbes de experiencia y objetos ============
 * Los orbes se quedan quietos hasta que entras en el radio del imán; entonces
 * aceleran hacia ti. Para que no se acumulen miles, al pasar de MAX se fusionan
 * los más antiguos.
 *
 * Cooperativo: los objetos los crea el anfitrión (cada uno con su id) y los
 * demás reciben una copia. Todos vuelan hacia el jugador más cercano; quien
 * decide quién lo ha cogido es el anfitrión.
 */
G.Pickups = (() => {
  let list = [];
  const MAX = 420;
  let nextId = 1;

  const KIND = {
    xp:    { color: '#7fe0ff', glow: '#2a8fd0', r: 4.5 },
    xpBig: { color: '#ffd95e', glow: '#c08a10', r: 7 },
    heal:  { color: '#5fe08a', glow: '#1f8f4d', r: 6.5 },
    magnet:{ color: '#ff9ed8', glow: '#b03d84', r: 6.5 },
    bomb:  { color: '#ff7b3d', glow: '#b03d10', r: 6.5 },
    coin:  { color: '#ffd23f', glow: '#b8860b', r: 5.5 },
    ticket:   { color: '#c9cedb', glow: '#5c6378', r: 7 },
    ticket10: { color: '#c47bff', glow: '#8a3fd0', r: 8 },
    ticketb:  { color: '#4fb4ff', glow: '#1d6cb5', r: 8 },
    ticketg:  { color: '#ffd23f', glow: '#c08a10', r: 8 },
    item:     { color: '#ffd23f', glow: '#c08a10', r: 9 },      // value = id del objeto
    evostone: { color: '#c47bff', glow: '#6a3a9a', r: 9 },
    candy:    { color: '#c47bff', glow: '#ff8ad8', r: 8 }      // Caramelo Raro: no lo atrae el imán
  };
  // Probabilidad (en %) y cantidad de cada ticket: gris, morado, azul, dorado.
  const TICKET_KINDS = ['ticket', 'ticket10', 'ticketb', 'ticketg'];
  const DROPS = {
    small: { p: [10.12, 1.32, 0.05, 0.001], n: [[1, 3], [1, 1], [1, 1], [1, 1]] },
    big:   { p: [14.12, 6.2, 3.6, 0.008], n: [[2, 6], [1, 2], [1, 1], [1, 1]] },
    kill:  { p: [0.0118, 0.0012, 0.00036, 0.000000012], n: [[1, 1], [1, 1], [1, 1], [1, 1]] },
    boss:  { p: [75, 50, 32, 1], n: [[3, 10], [1, 4], [1, 2], [1, 1]] },
    rift:  { p: [85, 65, 46, 3], n: [[12, 26], [2, 7], [1, 5], [1, 2]] }
  };
  function partySize() {
    if (!G.Coop || !G.Coop.active || !G.Coop.players) return 1;
    return Math.max(1, G.Coop.players().length);
  }

  const TICK_KEY = { ticket: 't1', ticket10: 't10', ticketb: 'tb', ticketg: 'tg' };
  /** Los de un jefe caen juntos: en grupo se reparten, no se dejan en el suelo. */
  function shareBossTickets(kind, n) {
    const people = (G.Coop.roster && G.Coop.roster()) || [];
    const key = TICK_KEY[kind];
    if (people.length < 2 || !key || !G.Coop.giveTicket) return false;
    const order = people.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = order[i]; order[i] = order[j]; order[j] = t;
    }
    const base = Math.floor(n / order.length);
    let extra = n % order.length;
    for (const p of order) {
      const got = base + (extra > 0 ? 1 : 0);
      if (extra > 0) extra--;
      if (got) G.Coop.giveTicket(p.uid, key, got);
    }
    return true;
  }

  function dropTickets(source, x, y) {
    const d = DROPS[source];
    if (!d) return;
    // En grupo sólo el anfitrión crea el botín (si no, cada cliente lo tiraría).
    if (G.Coop.active && !G.Coop.isHost) return;
    // Fortuna de tickets suma en cofres y jefes, no en cada Pokémon derrotado.
    const add = source === 'kill' ? [0, 0, 0, 0] : ((G.Game && G.Game.player && G.Game.player.ticketAdd) || [0, 0, 0, 0]);
    TICKET_KINDS.forEach((kind, i) => {
      if (Math.random() * 100 >= Math.min(100, d.p[i] + (add[i] || 0))) return;
      const [a, b] = d.n[i];
      const n = G.U.randInt(a, b);
      if ((source === 'boss' || source === 'rift') && partySize() > 1) {
        // El dorado se sortea. El resto se reparte: si no, se lo queda quien esté encima.
        if (kind === 'ticketg') {
          for (let k = 0; k < n; k++) G.Game.queueGoldWheel();
          return;
        }
        if (shareBossTickets(kind, n)) return;
      }
      for (let k = 0; k < n; k++) push(orb(kind, x + G.U.rand(-18, 18), y + G.U.rand(-12, 12), 1));
    });
  }

  function clear() { list = []; }
  function all() { return list; }

  function push(o) {
    // En cooperativo sólo el anfitrión crea objetos (las copias llegan por la red).
    if (G.Coop.active && !G.Coop.isHost) return;
    o.id = nextId++;
    list.push(o);
    if (G.Coop.isHost) G.Coop.pickupAdded(o);
    if (list.length > MAX) {
      // Fusiona los dos más antiguos de XP para no crecer sin límite.
      const i = list.findIndex(p => p.kind === 'xp' || p.kind === 'xpBig');
      if (i >= 0) {
        const a = list.splice(i, 1)[0];
        const j = list.findIndex(p => p.kind === 'xp' || p.kind === 'xpBig');
        if (j >= 0) { list[j].value += a.value; list[j].kind = 'xpBig'; }
        if (G.Coop.isHost) G.Coop.pickupGone(a.id);
      } else {
        const a = list.shift();
        if (G.Coop.isHost) G.Coop.pickupGone(a.id);
      }
    }
  }

  /** Copia de un objeto del anfitrión. */
  function addRemote(id, kind, x, y, value, noMag) {
    if (list.some(p => p.id === id)) return;
    const o = orb(kind, x, y, value);
    o.id = id;
    if (noMag) o.noMag = true;
    list.push(o);
    if (kind === 'candy') G.Audio.sfx('shiny');
  }

  function removeId(id) {
    const i = list.findIndex(p => p.id === id);
    if (i < 0) return null;
    return list.splice(i, 1)[0];
  }

  /** Imán: todo vuela hacia el jugador más cercano (salvo noMag). */
  function pullAll() { for (const o of list) if (!o.noMag) o.pulled = true; }

  function dropXp(x, y, value, boss = false, legend = false, tickets = true) {
    if (boss) {
      // Los jefes revientan en un montón de orbes grandes + recompensas.
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * 6.2832, d = G.U.rand(10, 70);
        push(orb('xpBig', x + Math.cos(a) * d, y + Math.sin(a) * d, Math.ceil(value / 14)));
      }
      push(orb('heal', x + 24, y, 0));
      push(orb('magnet', x - 24, y, 0));
      if (tickets) dropTickets(legend ? 'rift' : 'boss', x, y);
      return;
    }
    push(orb(value >= 20 ? 'xpBig' : 'xp', x, y, value));
    if (tickets) dropTickets('kill', x, y);

    // Drops ocasionales.
    const r = Math.random();
    if (r < 0.012) push(orb('heal', x + G.U.rand(-8, 8), y, 0));
    else if (r < 0.020) push(orb('magnet', x, y, 0));
    else if (r < 0.026) push(orb('bomb', x, y, 0));
  }

  /** 3,2%: la Piedra Evolución, en su propio hueco (cofres y jefes). */
  function maybeEvoStone(x, y) {
    if (Math.random() * 100 < G.Items.DROP.stone) drop('evostone', x, y, 1);
  }

  /** 0,05% (más la mejora de run): Caramelo Raro. El imán no lo atrae. */
  const CANDY_P = 0.05;
  function maybeRareCandy(x, y) {
    if (G.Coop && G.Coop.active && !G.Coop.isHost) return;
    const add = (G.Upgrades && G.Upgrades.candyAdd) ? G.Upgrades.candyAdd() : 0;
    if (Math.random() * 100 >= CANDY_P + add) return;
    drop('candy', x, y, 0, true);
    G.Audio.sfx('shiny');
    if (G.Spawner) G.Spawner.say('¡Ha aparecido un Caramelo Raro!', 3.6);
  }

  /** Suelta un objeto suelto: 'heal' | 'magnet' | 'bomb' | 'coin'. noMag: el imán no lo atrae. */
  function drop(kind, x, y, value = 0, noMag = false) {
    const o = orb(kind, x, y, value);
    if (noMag) o.noMag = true;
    push(o);
  }

  function orb(kind, x, y, value) {
    const a = Math.random() * 6.2832;
    return {
      kind, x, y, value,
      vx: Math.cos(a) * G.U.rand(10, 46), vy: Math.sin(a) * G.U.rand(10, 46),
      t: Math.random() * 6.28, pulled: false, noMag: false
    };
  }

  /**
   * @param players  un jugador o la lista de jugadores (los caídos no recogen)
   * @param onCollect(pickup, jugador)
   */
  function update(dt, players, onCollect) {
    if (!Array.isArray(players)) players = [players];
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.t += dt * 4;

      // El jugador vivo más cercano (en solitario, siempre tú).
      let pl = null, d2 = Infinity;
      for (const o of players) {
        if (o.dead && players.length > 1) continue;
        const dd = G.U.dist2(o.x, o.y, p.x, p.y);
        if (dd < d2) { d2 = dd; pl = o; }
      }
      if (!pl) continue;
      const dx = pl.x - p.x, dy = pl.y - p.y;
      const mag2 = pl.magnet * pl.magnet;

      if (!p.noMag && (p.pulled || d2 < mag2)) {
        p.pulled = true;
        const d = Math.sqrt(d2) || 1;
        const pull = 240 + 1400 / d;
        p.vx = G.U.damp(p.vx, (dx / d) * pull, 7, dt);
        p.vy = G.U.damp(p.vy, (dy / d) * pull, 7, dt);
      } else {
        p.vx *= Math.pow(0.02, dt);
        p.vy *= Math.pow(0.02, dt);
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (d2 < 15 * 15) {
        list.splice(i, 1);
        onCollect(p, pl);
      }
    }
  }

  function draw(ctx) {
    for (const p of list) {
      if (!G.Camera.sees(p.x, p.y, 30)) continue;
      const k = KIND[p.kind];
      const bounce = Math.abs(Math.sin(p.t * 0.8)) * 3;
      const r = k.r;
      const y = p.y - 6 - bounce;

      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, r * 0.9, r * 0.35, 0, 0, 6.2832); ctx.fill();

      ctx.globalAlpha = 0.3;
      ctx.fillStyle = k.glow;
      ctx.beginPath(); ctx.arc(p.x, y, r * 2, 0, 6.2832); ctx.fill();

      ctx.globalAlpha = 1;
      ctx.fillStyle = k.color;
      if (p.kind === 'xp' || p.kind === 'xpBig') {
        ctx.beginPath();
        ctx.moveTo(p.x, y - r); ctx.lineTo(p.x + r * 0.78, y);
        ctx.lineTo(p.x, y + r); ctx.lineTo(p.x - r * 0.78, y);
        ctx.closePath(); ctx.fill();
      } else if (p.kind === 'coin') {
        // Moneda que gira: elipse que se estrecha.
        const sx = Math.max(0.25, Math.abs(Math.cos(p.t * 0.9)));
        ctx.beginPath(); ctx.ellipse(p.x, y, r * sx, r, 0, 0, 6.2832); ctx.fill();
        ctx.fillStyle = '#b8860b';
        ctx.beginPath(); ctx.ellipse(p.x, y, r * sx * 0.5, r * 0.5, 0, 0, 6.2832); ctx.fill();
      } else {
        // Baya, imán y bomba: su icono pixel art.
        const ICON = { heal: 'berry', magnet: 'magnet', bomb: 'bomb', ticket: 'ticket', ticket10: 'ticket10', ticketb: 'ticketb', ticketg: 'ticketg', candy: 'candy' };
        const sz = p.kind === 'ticket' ? 18 : (p.kind === 'item' || p.kind === 'evostone' || p.kind === 'candy' || p.kind.indexOf('ticket') === 0 ? 24 : 18);
        if (p.kind === 'item' || p.kind === 'evostone' || p.kind === 'candy') {
          ctx.globalAlpha = 0.35 + Math.sin(p.t * 1.5) * 0.15;
          ctx.fillStyle = p.kind === 'item' ? '#ffe14d' : '#e6d0ff';
          ctx.beginPath(); ctx.arc(p.x, y, 18, 0, 6.2832); ctx.fill();
          ctx.globalAlpha = 1;
        }
        const icon = p.kind === 'item' ? p.value : p.kind === 'evostone' ? 'evostone' : ICON[p.kind];
        G.Icons.draw(ctx, icon, p.x - sz / 2, y - sz / 2 - 1, sz);
        continue;
      }
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      ctx.beginPath(); ctx.arc(p.x - r * 0.25, y - r * 0.3, r * 0.28, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  return { clear, all, dropXp, drop, dropTickets, maybeEvoStone, maybeRareCandy, update, draw, addRemote, removeId, pullAll, KIND, get count() { return list.length; } };
})();
