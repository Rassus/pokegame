/* ============ hud.js — interfaz dentro del canvas ============
 * Se dibuja en coordenadas de PANTALLA (sin la transformación de cámara).
 */
G.HUD = (() => {
  const F = (w, s) => `${w} ${s}px Pixelify,"Segoe UI",system-ui,sans-serif`;

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // La barra de XP usa el mismo degradado mientras no cambie el ancho.
  let xpGrad = null;
  function xpFill(ctx, w) {
    if (!xpGrad || xpGrad.ctx !== ctx || xpGrad.w !== w) {
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, '#4fd1ff'); g.addColorStop(1, '#a98bff');
      xpGrad = { ctx, w, g };
    }
    return xpGrad.g;
  }

  function bar(ctx, x, y, w, h, frac, col, bg = 'rgba(0,0,0,.55)') {
    roundRect(ctx, x, y, w, h, h / 2); ctx.fillStyle = bg; ctx.fill();
    if (frac > 0) {
      ctx.save();
      roundRect(ctx, x, y, w, h, h / 2); ctx.clip();
      ctx.fillStyle = col;
      ctx.fillRect(x, y, w * G.U.clamp(frac, 0, 1), h);
      ctx.restore();
    }
  }

  function draw(ctx, w, h, pl, st) {
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    G.Touch.clearButtons();
    const touch = G.Touch.active;

    // ---------- barra de experiencia (borde superior) ----------
    const xpF = pl.xp / pl.xpNext;
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(0, 0, w, 7);
    ctx.fillStyle = xpFill(ctx, w);
    ctx.fillRect(0, 0, w * G.U.clamp(xpF, 0, 1), 7);

    // ---------- vida + nivel ----------
    const px = 16, py = 20;
    ctx.font = F(800, 13);
    ctx.fillStyle = '#eaf2ff';
    ctx.textAlign = 'left';
    ctx.fillText(pl.mon.name, px, py + 10);

    ctx.font = F(700, 11);
    ctx.fillStyle = '#ffcb3d';
    ctx.fillText('Nv. ' + pl.level, px, py + 26);

    const shieldFrac = pl.shieldCapFrac ? pl.shieldCapFrac() : 0;
    if (shieldFrac > 0) bar(ctx, px + 48, py + 11, 168, 5, pl.shield / (pl.maxHp * shieldFrac), '#9ad7ff');
    bar(ctx, px + 48, py + 17, 168, 11, pl.hp / pl.maxHp, '#ff5f6d');
    ctx.font = F(700, 10);
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    ctx.textAlign = 'center';
    ctx.fillText(Math.ceil(pl.hp) + ' / ' + Math.round(pl.maxHp), px + 48 + 84, py + 26);

    // La vida se queda a la izquierda. Potenciadores y mejoras de la run, a la derecha.

    // ---------- reloj / bioma / kills ----------
    ctx.textAlign = 'center';
    ctx.font = F(800, 26);
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    ctx.fillText(G.U.mmss(st.time), w / 2, 42);
    ctx.font = F(600, 10);
    ctx.fillStyle = '#8fa3c4';
    const towerLine = G.Towers.hud();
    ctx.fillText(towerLine || (G.World.biomeName().toUpperCase() + '  ·  ' + G.U.num(pl.kills) + ' DERROTADOS  ·  ' + G.U.num(pl.coins) + ' MONEDAS'), w / 2, 58);
    if (pl.silence > 0 || pl.amnesiaT > 0) {
      ctx.font = F(800, 13);
      ctx.fillStyle = pl.silence > 0 ? '#efe8ff' : '#d2b6ff';
      ctx.fillText(pl.silence > 0 ? 'Silencio ' + Math.ceil(pl.silence) + ' s' : 'Amnesia ' + Math.ceil(pl.amnesiaT) + ' s', w / 2, 76);
    }

    // ---------- clima (arriba a la derecha) ----------
    const wx = G.Weather.current;
    if (wx) {
      ctx.font = F(800, 11);
      ctx.textAlign = 'left';
      const txt = wx.name.toUpperCase() + ' · ' + Math.ceil(wx.left) + 's';
      const tw = ctx.measureText(txt).width + 40;
      const x0 = w - tw - 16 - (touch ? 56 : 0), y0 = 14;
      roundRect(ctx, x0, y0, tw, 26, 9);
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fill();
      G.Icons.draw(ctx, wx.icon, x0 + 6, y0 + 3, 20);
      ctx.fillStyle = wx.color;
      ctx.fillText(txt, x0 + 32, y0 + 17);
    }

    // ---------- barra del jefe ----------
    const boss = G.EnemyMgr.all().find(e => e.boss && !e.dead);
    if (boss) {
      const bw = Math.min(420, w - 80);
      bar(ctx, (w - bw) / 2, 70, bw, 12, boss.hp / boss.maxHp, '#ffcb3d');
      ctx.font = F(800, 10);
      ctx.fillStyle = '#20160a';
      ctx.fillText(boss.name.toUpperCase(), w / 2, 80);
    }

    // ---------- aviso ----------
    // ---------- shinies fuera de pantalla: destello en el borde ----------
    const cam = G.Camera, pulse = 0.6 + Math.sin(performance.now() / 160) * 0.4;
    for (const e of G.EnemyMgr.shinies()) {
      const sx = (e.x - cam.left()) * cam.scale, sy = (e.y - cam.top()) * cam.scale;
      if (sx > 0 && sx < w && sy > 0 && sy < h) continue;
      const M = 34;
      const ex = G.U.clamp(sx, M, w - M), ey = G.U.clamp(sy, M + 60, h - M - 70);
      const a = Math.atan2(sy - ey, sx - ex);
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.translate(ex, ey);
      ctx.fillStyle = '#9ae6ff';
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 24, Math.sin(a) * 24);
      ctx.lineTo(Math.cos(a + 2.5) * 12, Math.sin(a + 2.5) * 12);
      ctx.lineTo(Math.cos(a - 2.5) * 12, Math.sin(a - 2.5) * 12);
      ctx.fill();
      ctx.globalAlpha = 1;
      G.Icons.draw(ctx, 'shiny', -12, -12, 24);
      ctx.restore();
    }

    // Potenciadores (ATK, VEL...) y cartas de la run, pegados al borde derecho.
    // sideY queda justo debajo: ahí abajo, a la derecha de los ataques, van tickets y shinies.
    let sideY = wx ? 48 : 16;
    {
      const edge = w - 16 - (touch ? 56 : 0);
      let ry = sideY;
      if (pl.berryId && G.Berries && G.Berries.BY[pl.berryId]) {
        const where = pl.berryWhere === 'tower' ? 'tower' : 'run';
        const spent = pl.berryId === 'caramel' && where === 'run' && !(pl.candyLeft > 0);
        const def = G.Berries.BY[pl.berryId];
        const line = spent ? 'Caramelo se ha gastado' : (def.name + ' · ' + G.Berries.hudLine(pl.berryId, where));
        ctx.font = F(800, 11);
        ctx.textAlign = 'left';
        const tw = ctx.measureText(line).width + 28;
        const x = edge - tw;
        roundRect(ctx, x, ry, tw, 18, 7);
        ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fill();
        if (!G.Berries.paint(ctx, pl.berryId, x + 2, ry + 1, 16, 16, 'berry')) G.Icons.draw(ctx, 'berry', x + 2, ry + 1, 16);
        ctx.fillStyle = spent ? '#ffd3e0' : '#ff9eb8';
        ctx.fillText(line, x + 20, ry + 13);
        ry += 22;
      }
      const COL = { atk: '#ff6b4d', spd: '#7fe0ff', def: '#b0b8c8', regen: '#5fe08a' };
      const LBL = { atk: 'ATK', spd: 'VEL', def: 'DEF', regen: 'REG' };
      const chips = [];
      for (const k in pl.buffs) {
        const b = pl.buffs[k];
        if (b.n > 0) chips.push({ txt: LBL[k] + ' ×' + b.n, col: COL[k] });
      }
      if (pl.power) {
        const pw = pl.power;
        chips.push({ txt: pw.def.name.toUpperCase() + ' ' + Math.ceil(pw.t) + 's', col: pw.def.color });
      }
      if (chips.length) {
        ctx.font = F(800, 9);
        ctx.textAlign = 'left';
        let x = edge;
        for (let i = chips.length - 1; i >= 0; i--) {
          const c = chips[i];
          const tw = ctx.measureText(c.txt).width + 12;
          x -= tw;
          roundRect(ctx, x, ry, tw, 15, 7);
          ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fill();
          ctx.fillStyle = c.col;
          ctx.fillText(c.txt, x + 6, ry + 11);
          x -= 5;
        }
        ry += 20;
      }
      const taken = G.LevelUp.STATS.filter(s => (pl.statsTaken[s.id] || 0) > 0);
      ctx.font = F(700, 11);
      ctx.textAlign = 'left';
      for (const s of taken) {
        const num = String(pl.statsTaken[s.id]);
        const lw = ctx.measureText(s.title).width;
        const nw = ctx.measureText(num).width;
        const tw = lw + nw + 36;
        const x = edge - tw;
        roundRect(ctx, x, ry, tw, 18, 7);
        ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fill();
        G.Icons.draw(ctx, s.icon, x + 3, ry + 2, 14);
        ctx.fillStyle = '#e7eefc';
        ctx.fillText(s.title, x + 20, ry + 13);
        ctx.fillStyle = '#ffd23f';
        ctx.fillText(num, x + 26 + lw, ry + 13);
        ry += 20;
      }
      sideY = ry;
    }

    if (G.Coop.active) drawCoop(ctx, w, h, pl, px, py + 40);

    // Grieta: flecha grande que late en el borde si no se ve, y si se ve, una
    // flecha que bota encima; en la arena, cuenta atrás.
    const rift = G.Rift.rift;
    if (rift) {
      const sx = (rift.x - cam.left()) * cam.scale, sy = (rift.y - 40 - cam.top()) * cam.scale;
      const now = performance.now() / 1000, beat = 0.5 + Math.sin(now * 7) * 0.5;
      const label = 'GRIETA · ' + Math.round(G.U.dist(pl.x, pl.y, rift.x, rift.y) / 32) + ' m · ' + Math.ceil(rift.ttl) + ' s';
      const off = sx < 0 || sx > w || sy < 0 || sy > h;
      ctx.save();
      if (off) {
        const M = 52, ex = G.U.clamp(sx, M, w - M), ey = G.U.clamp(sy, M + 70, h - M - 80);
        const a = Math.atan2(sy - ey, sx - ex), ca = Math.cos(a), sa = Math.sin(a);
        ctx.translate(ex, ey);
        // Halo que late.
        ctx.globalAlpha = 0.18 + beat * 0.22;
        ctx.fillStyle = '#b48aff';
        ctx.beginPath(); ctx.arc(0, 0, 30 + beat * 8, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = 1;
        const tri = (k) => {
          ctx.beginPath();
          ctx.moveTo(ca * 40 * k, sa * 40 * k);
          ctx.lineTo(Math.cos(a + 2.45) * 20 * k, Math.sin(a + 2.45) * 20 * k);
          ctx.lineTo(Math.cos(a - 2.45) * 20 * k, Math.sin(a - 2.45) * 20 * k);
          ctx.closePath();
        };
        tri(1.12); ctx.fillStyle = '#1a0b33'; ctx.fill();
        tri(1); ctx.fillStyle = beat > 0.5 ? '#e2d0ff' : '#a06bff'; ctx.fill();
        ctx.font = F(800, 12);
        ctx.textAlign = ca > 0.3 ? 'right' : ca < -0.3 ? 'left' : 'center';
        const lx = -ca * 34, ly = -sa * 30 + 4;
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.85)';
        ctx.strokeText(label, lx, ly);
        ctx.fillStyle = '#e2d0ff';
        ctx.fillText(label, lx, ly);
      } else {
        // Encima de la grieta: flecha hacia abajo que bota.
        const by = sy - 46 - Math.abs(Math.sin(now * 4)) * 10;
        ctx.translate(sx, by);
        ctx.beginPath(); ctx.moveTo(-15, -12); ctx.lineTo(15, -12); ctx.lineTo(0, 8); ctx.closePath();
        ctx.lineWidth = 4; ctx.strokeStyle = '#1a0b33'; ctx.stroke();
        ctx.fillStyle = beat > 0.5 ? '#e2d0ff' : '#a06bff'; ctx.fill();
        ctx.font = F(800, 11); ctx.textAlign = 'center';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.85)';
        const l2 = 'GRIETA · ' + Math.ceil(rift.ttl) + ' s';
        ctx.strokeText(l2, 0, -18); ctx.fillStyle = '#e2d0ff'; ctx.fillText(l2, 0, -18);
      }
      ctx.restore();
    }
    if (G.Rift.inArena) {
      ctx.textAlign = 'center';
      ctx.font = F(800, 12);
      ctx.fillStyle = '#d9c2ff';
      ctx.fillText('GRIETA · ' + G.U.mmss(G.Rift.timeLeft), w / 2, boss ? 98 : 76);
    }

    // Rastro de jefes: flecha amarilla, en el borde si no se ve y encima si se ve.
    if (G.Upgrades.lvl('bfind')) {
      const nowB = performance.now() / 1000, beatB = 0.5 + Math.sin(nowB * 7) * 0.5;
      for (const b of G.EnemyMgr.all()) {
        if (!b.boss || b.dead) continue;
        const sx = (b.x - cam.left()) * cam.scale, sy = (b.y - 40 - cam.top()) * cam.scale;
        const off = sx < 0 || sx > w || sy < 0 || sy > h;
        const label = b.name.toUpperCase() + ' · ' + Math.round(G.U.dist(pl.x, pl.y, b.x, b.y) / 32) + ' m';
        ctx.save();
        if (off) {
          const M = 52, ex = G.U.clamp(sx, M, w - M), ey = G.U.clamp(sy, M + 70, h - M - 80);
          const a = Math.atan2(sy - ey, sx - ex), ca = Math.cos(a), sa = Math.sin(a);
          ctx.translate(ex, ey);
          ctx.globalAlpha = 0.2 + beatB * 0.25;
          ctx.fillStyle = '#ffd23f';
          ctx.beginPath(); ctx.arc(0, 0, 28 + beatB * 8, 0, 6.2832); ctx.fill();
          ctx.globalAlpha = 1;
          const tri = (k) => {
            ctx.beginPath();
            ctx.moveTo(ca * 40 * k, sa * 40 * k);
            ctx.lineTo(Math.cos(a + 2.45) * 20 * k, Math.sin(a + 2.45) * 20 * k);
            ctx.lineTo(Math.cos(a - 2.45) * 20 * k, Math.sin(a - 2.45) * 20 * k);
            ctx.closePath();
          };
          tri(1.12); ctx.fillStyle = '#3a2808'; ctx.fill();
          tri(1); ctx.fillStyle = beatB > 0.5 ? '#ffe98a' : '#ffd23f'; ctx.fill();
          ctx.font = F(800, 12);
          ctx.textAlign = ca > 0.3 ? 'right' : ca < -0.3 ? 'left' : 'center';
          const lx = -ca * 34, ly = -sa * 30 + 4;
          ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.85)';
          ctx.strokeText(label, lx, ly);
          ctx.fillStyle = '#ffe98a';
          ctx.fillText(label, lx, ly);
        } else {
          const by = sy - 46 - Math.abs(Math.sin(nowB * 4)) * 10;
          ctx.translate(sx, by);
          ctx.beginPath(); ctx.moveTo(-15, -12); ctx.lineTo(15, -12); ctx.lineTo(0, 8); ctx.closePath();
          ctx.lineWidth = 4; ctx.strokeStyle = '#3a2808'; ctx.stroke();
          ctx.fillStyle = beatB > 0.5 ? '#ffe98a' : '#ffd23f'; ctx.fill();
          ctx.font = F(800, 11); ctx.textAlign = 'center';
          ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.85)';
          ctx.strokeText(label, 0, -18); ctx.fillStyle = '#ffe98a'; ctx.fillText(label, 0, -18);
        }
        ctx.restore();
      }
    }

    // Eventos: cuenta atrás, flecha al Pokémon perdido / a la marca y a los duendes.
    G.Events.drawHud(ctx, w, h, pl, F);

    // Aviso propio al abrirse una grieta (no lo tapan los otros avisos).
    if (rift && rift.t < 4.5) {
      const a = Math.min(1, rift.t * 4, (4.5 - rift.t) * 2), pop = 1 + Math.max(0, 0.25 - rift.t) * 1.6;
      const y0 = h * 0.2;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(w / 2, y0); ctx.scale(pop, pop);
      ctx.font = F(800, 20);
      const t1 = '¡SE HA ABIERTO UNA GRIETA!', t2 = 'Sigue la flecha morada: dentro te espera un legendario';
      const bw = Math.min(w - 24, Math.max(ctx.measureText(t1).width, (ctx.font = F(700, 11), ctx.measureText(t2).width)) + 36);
      roundRect(ctx, -bw / 2, -26, bw, 52, 10);
      ctx.fillStyle = 'rgba(26,11,51,.88)'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#b48aff'; ctx.stroke();
      ctx.textAlign = 'center';
      ctx.font = F(800, 20); ctx.fillStyle = '#e2d0ff'; ctx.fillText(t1, 0, -2);
      ctx.font = F(700, 11); ctx.fillStyle = '#c9b0ff'; ctx.fillText(t2, 0, 16);
      ctx.restore();
    }

    const ban = G.Spawner.banner();
    if (ban) {
      const a = Math.min(1, ban.t * 1.6);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = F(800, 22);
      ctx.fillStyle = '#ffcb3d';
      ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 4;
      ctx.strokeText(ban.text, w / 2, h * 0.3);
      ctx.fillText(ban.text, w / 2, h * 0.3);
      ctx.restore();
    }

    // ---------- ranura de movimientos ----------
    const S = 54, GAP = 9;
    const n = Math.max(1, pl.slots.length);
    const totalW = n * S + (n - 1) * GAP;
    let sx = (w - totalW) / 2;
    // Por encima de la barra de inicio del iPhone (allí los toques a veces no llegan).
    const sy = h - S - 18 - (touch ? Math.min(28, G.Touch.safeArea().bottom) : 0);
    const BOND = '#ff8ad8';
    const cdOf = m => m.kind === 'orbit' ? 0 : G.U.clamp(m.t / (m.cd * pl.cdMul), 0, 1);

    for (let i = 0; i < n; i++) {
      const g = pl.slots[i] || [];
      const m = g[0];
      const fused = g.length > 1;
      const on = i === pl.active;
      const x = sx + i * (S + GAP);
      const y = on ? sy - 6 : sy;
      // Tocar (o hacer clic en) un icono activa ese movimiento.
      if (m) G.Touch.addButton(x, y, S, S, () => { if (G.Game.state === 'playing' && pl.active !== i) { pl.setActive(i); G.Audio.sfx('click'); } }, GAP / 2 + 3);
      const col = m ? G.U.TYPE_COLOR[m.type] : '#4a5468';

      // fondo
      roundRect(ctx, x, y, S, S, 12);
      ctx.fillStyle = on ? 'rgba(20,30,50,.95)' : 'rgba(10,16,28,.8)';
      ctx.fill();
      ctx.lineWidth = on ? 2.5 : fused || (m && m.evolved) ? 2 : 1.2;
      // Vínculo: borde rosa. Evolucionado: dorado.
      ctx.strokeStyle = fused ? BOND : m && m.evolved ? '#ffd23f' : on ? col : 'rgba(140,170,210,.22)';
      ctx.stroke();
      if (pl.amnesiaT > 0 && pl.amnesia && pl.amnesia.includes(i)) {
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = '#6a3aa8';
        roundRect(ctx, x, y, S, S, 12); ctx.fill();
        ctx.restore();
      }

      if (!m) continue;

      if (fused) {
        // Vínculo: los movimientos en una cuadrícula de 2×2, cada uno con su recarga.
        const C = 22, P = (S - C * 2) / 3;
        g.forEach((gm, k) => {
          const cx = x + P + (k % 2) * (C + P), cy = y + P + Math.floor(k / 2) * (C + P);
          G.Icons.draw(ctx, 'move:' + gm.id, cx, cy, C);
          const f = cdOf(gm);
          if (f > 0) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(cx, cy, C, C * f); }
          if (gm.evolved) { ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 1; ctx.strokeRect(cx + 0.5, cy + 0.5, C - 1, C - 1); }
          // Destello al lanzarse.
          const fl = 1 - (performance.now() - (gm.castAt || 0)) / 180;
          if (fl > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (fl * 0.55).toFixed(2) + ')'; ctx.fillRect(cx, cy, C, C); }
        });
      } else {
        // recarga: se vacía de abajo a arriba
        const cdFrac = cdOf(m);
        if (cdFrac > 0) {
          ctx.save();
          roundRect(ctx, x, y, S, S, 12); ctx.clip();
          ctx.fillStyle = 'rgba(0,0,0,.6)';
          ctx.fillRect(x, y, S, S * cdFrac);
          ctx.restore();
        }

        // emblema del tipo + insignia de la familia
        G.Icons.draw(ctx, 'move:' + m.id, x + (S - 32) / 2, y + (S - 32) / 2 - 2, 32);

        // nivel del movimiento (puntitos)
        const dots = m.def.maxLvl;
        const dw = 4, dgap = 2;
        const tw = dots * dw + (dots - 1) * dgap;
        for (let d = 0; d < dots; d++) {
          ctx.fillStyle = d < m.lvl ? col : 'rgba(255,255,255,.18)';
          ctx.fillRect(x + (S - tw) / 2 + d * (dw + dgap), y + S - 9, dw, 3);
        }
      }

      // tecla
      ctx.font = F(800, 9);
      ctx.fillStyle = fused ? BOND : on ? col : 'rgba(180,200,230,.6)';
      ctx.textAlign = 'left';
      ctx.fillText(String(i + 1), x + 3, y + 10);

      // nombre encima del activo (con un vínculo: "Ascuas +2")
      if (on) {
        ctx.font = F(700, 10);
        ctx.textAlign = 'center';
        ctx.fillStyle = fused ? BOND : col;
        ctx.fillText(fused ? m.name + ' +' + (g.length - 1) : m.name, x + S / 2, y - 7);
      }
    }

    // ---------- vínculo guardado (aún no hay dos movimientos sueltos) ----------
    let bondExtra = 0;
    if (pl.bonds > 0) {
      const bx = sx + totalW + 12, by = sy + S / 2 - 12;
      G.Icons.draw(ctx, 'bond', bx, by, 24);
      bondExtra = 40;
      if (pl.bonds > 1) {
        ctx.font = F(800, 10);
        ctx.textAlign = 'left';
        ctx.fillStyle = BOND;
        ctx.fillText('×' + pl.bonds, bx + 25, by + 20);
        bondExtra = 56;
      }
    }

    drawCarry(ctx, w, pl, sx, totalW, sy, S, sideY, touch, bondExtra);

    // ---------- objeto equipado (a la izquierda de los movimientos) ----------
    {
      const ix = sx - S - 18, iy = sy;
      roundRect(ctx, ix, iy, S, S, 12);
      ctx.fillStyle = pl.item ? 'rgba(40,30,10,.9)' : 'rgba(10,16,28,.55)';
      ctx.fill();
      ctx.lineWidth = pl.item ? 2 : 1;
      ctx.strokeStyle = pl.item ? '#ffd23f' : 'rgba(140,170,210,.18)';
      ctx.stroke();
      if (pl.item) {
        G.Icons.draw(ctx, pl.item, ix + (S - 36) / 2, iy + (S - 36) / 2, 36);
        ctx.font = F(700, 9);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd23f';
        ctx.fillText(G.Items.BY[pl.item].name, ix + S / 2, iy - 6);
      }
      if (pl.evoStone) {
        const ey = iy - S - 22;
        roundRect(ctx, ix, ey, S, S, 12);
        ctx.fillStyle = 'rgba(40,20,55,.92)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#c47bff';
        ctx.stroke();
        G.Icons.draw(ctx, 'evostone', ix + (S - 36) / 2, ey + (S - 36) / 2, 36);
        ctx.font = F(700, 9);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#e6d0ff';
        ctx.fillText('Piedra Evolución', ix + S / 2, ey - 6);
      }
    }

    // ---------- botón de pausa (táctil) ----------
    if (touch) {
      const sa = G.Touch.safeArea();
      const bx = w - 52 - Math.min(44, sa.right), by = 12 + Math.min(20, sa.top), bs = 40;
      roundRect(ctx, bx, by, bs, bs, 10);
      ctx.fillStyle = 'rgba(10,16,28,.7)'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(244,248,255,.8)'; ctx.stroke();
      ctx.fillStyle = '#f4f8ff';
      ctx.fillRect(bx + 13, by + 11, 5, 18); ctx.fillRect(bx + 22, by + 11, 5, 18);
      G.Touch.addButton(bx, by, bs, bs, () => G.Game.togglePause(), 8);
    }

    // pista de controles
    if (st.time < 14) {
      ctx.font = F(600, 10);
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(180,200,230,.55)';
      ctx.fillText(touch ? 'Arrastra el dedo para moverte  ·  toca un ataque para cambiarlo'
                         : 'WASD moverse  ·  1-4 / Q / E o clic en un ataque para cambiarlo  ·  Esc pausa', w / 2, h - 4);
    }

    ctx.restore();
  }

  // ---------------- tickets y shinies de la run ----------------

  const TICKETS = [
    ['ticket', 't1', '#c9cedb'],
    ['ticket10', 't10', '#c47bff'],
    ['ticketb', 'tb', '#4fb4ff'],
    ['ticketg', 'tg', '#ffd23f']
  ];
  const shinyAnim = new Map();
  let shinyClock = 0;

  function animFor(dex) {
    let a = shinyAnim.get(dex);
    if (!a) {
      a = new G.Sprites.Animator(dex, 1, true);
      a.dir = 0;
      shinyAnim.set(dex, a);
      G.Sprites.preload([dex], 4000, true);
    }
    return a;
  }

  function tickAnims() {
    const now = performance.now();
    const dt = shinyClock ? Math.min(0.05, (now - shinyClock) / 1000) : 0;
    shinyClock = now;
    if (!dt) return;
    for (const a of shinyAnim.values()) a.update(dt);
  }

  /** Shinies de esta run, en el orden en que cayeron. Los repetidos se agrupan. */
  function carryShinies() {
    const src = (G.Game && G.Game.caught) || [];
    const rows = [];
    const ix = new Map();
    for (const c of src) {
      let i = ix.get(c.dex);
      if (i == null) {
        ix.set(c.dex, rows.length);
        const mon = G.DEX_BY[c.dex];
        rows.push({ dex: c.dex, name: (mon && mon.name) || '???', n: 1 });
      } else rows[i].n++;
    }
    return rows;
  }

  function fitLabel(ctx, label, maxW) {
    if (ctx.measureText(label).width <= maxW) return label;
    let s = label;
    while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
  }

  /** En el móvil el recuadro nace cerrado: un botón del tamaño de un ataque. */
  let carryOpen = false;

  /** Botón cuadrado, igual que las ranuras de ataque, con la moneda. */
  function drawCarryTab(ctx, x, y, S) {
    roundRect(ctx, x, y, S, S, 12);
    ctx.fillStyle = 'rgba(10,16,28,.8)';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(140,170,210,.55)';
    ctx.stroke();
    G.Icons.draw(ctx, 'coin', x + (S - 32) / 2, y + (S - 32) / 2, 32);
  }

  /**
   * Recuadro a la derecha de los movimientos: el oro y los cuatro tickets de la run
   * y, encima, los shinies conseguidos. Si no cabe al lado, sube al borde derecho.
   * En el móvil web empieza plegado, del mismo tamaño que un ataque; al tocarlo se abre
   * y otro toque en esa misma esquina lo cierra.
   */
  function drawCarry(ctx, w, pl, sx, totalW, sy, S, sideY, touch, bondExtra) {
    tickAnims();
    const list = carryShinies();
    const saR = touch ? Math.min(28, G.Touch.safeArea().right || 0) : 0;
    const edgeR = w - 8 - saR;
    const beside = sx + totalW + 12 + (bondExtra || 0);
    if (touch && !carryOpen) {
      let x = beside, y = sy;
      if (x + S > edgeR) {
        x = Math.max(8, edgeR - S);
        if (x < sx + totalW + 4) y = Math.max(8, sy - S - 8);
      }
      drawCarryTab(ctx, x, y, S);
      G.Touch.addButton(x, y, S, S, () => { carryOpen = true; G.Audio.sfx('click'); }, 6);
      return;
    }
    const PAD = 5, TROW = 17, SROW = 22;
    const wideW = 156, slimW = 64;
    const topLimit = sideY + 4;

    const measure = shown => {
      const extra = list.length > shown && shown > 0 ? 13 : 0;
      const shinyH = shown ? 4 + shown * SROW + extra : 0;
      return PAD * 2 + (TICKETS.length + 1) * TROW + shinyH;
    };
    // El fondo del recuadro se apoya en `bottom` y crece hacia arriba, sin pasar de las mejoras.
    function place(bottom) {
      let nShow = list.length;
      let h = measure(nShow);
      while (nShow > 0 && bottom - h < topLimit) { nShow--; h = measure(nShow); }
      return { nShow, h, y: bottom - h };
    }

    let mode, x, width, shown, boxH, y;
    const slotBottom = sy + S;
    if (beside + wideW <= edgeR + 1) {
      mode = 'wide'; width = wideW; x = beside;
      ({ nShow: shown, h: boxH, y } = place(slotBottom));
    } else if (beside + slimW <= edgeR + 1) {
      mode = 'slim'; width = slimW; x = beside;
      ({ nShow: shown, h: boxH, y } = place(slotBottom));
    } else if (edgeR - wideW >= sx + totalW - 6) {
      mode = 'wide'; width = wideW; x = edgeR - wideW;
      ({ nShow: shown, h: boxH, y } = place(sy - 22));
    } else {
      mode = 'slim'; width = slimW;
      x = Math.max(8, Math.min(beside, edgeR - slimW));
      ({ nShow: shown, h: boxH, y } = place(sy - 22));
    }

    const hidden = list.length - shown;
    const vis = hidden > 0 ? list.slice(list.length - shown) : list;

    ctx.save();
    roundRect(ctx, x, y, width, boxH, 10);
    ctx.fillStyle = 'rgba(10,16,28,.82)';
    ctx.fill();
    ctx.save();
    ctx.clip();

    const rowsTop = y + boxH - PAD - (TICKETS.length + 1) * TROW;
    const ticketTop = rowsTop + TROW;
    if (vis.length) {
      let ry = rowsTop - 4 - vis.length * SROW;
      if (hidden > 0) {
        ctx.font = F(700, 9);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#9ae6ff';
        const more = mode === 'wide' ? 'y ' + hidden + ' más' : '+' + hidden;
        ctx.fillText(more, x + PAD, ry - 2);
      }
      vis.forEach((row, i) => {
        const ry0 = ry + i * SROW;
        const a = animFor(row.dex);
        const bh = Math.max(14, G.Sprites.bodyHeight(row.dex, 1));
        a.scale = Math.min(1, 18 / bh);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x + 2, ry0, mode === 'wide' ? 26 : width - 4, SROW);
        ctx.clip();
        a.draw(ctx, x + 14, ry0 + SROW - 2);
        ctx.restore();
        ctx.font = F(700, 10);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        if (mode === 'wide') {
          const count = row.n > 1 ? ' ×' + row.n : '';
          const name = fitLabel(ctx, row.name, width - 34 - ctx.measureText(count).width);
          ctx.fillStyle = '#d7f6ff';
          ctx.fillText(name, x + 28, ry0 + 15);
          if (count) {
            ctx.fillStyle = '#ffd23f';
            ctx.fillText(count, x + 28 + ctx.measureText(name).width, ry0 + 15);
          }
        } else if (row.n > 1) {
          ctx.fillStyle = '#ffd23f';
          ctx.fillText('×' + row.n, x + 28, ry0 + 15);
        }
      });
      ctx.strokeStyle = 'rgba(255,255,255,.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 6, rowsTop - 2);
      ctx.lineTo(x + width - 6, rowsTop - 2);
      ctx.stroke();
    }

    G.Icons.draw(ctx, 'coin', x + PAD, rowsTop + (TROW - 14) / 2, 14);
    ctx.font = F(800, 11);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(G.U.num(pl.coins || 0), x + PAD + 18, rowsTop + 13);

    TICKETS.forEach((t, i) => {
      const ty = ticketTop + i * TROW;
      G.Icons.draw(ctx, t[0], x + PAD, ty + (TROW - 14) / 2, 14);
      ctx.font = F(800, 11);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = t[2];
      ctx.fillText(G.U.num(pl[t[1]] || 0), x + PAD + 18, ty + 13);
    });

    ctx.restore();
    roundRect(ctx, x, y, width, boxH, 10);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(180,210,235,.32)';
    ctx.stroke();
    if (touch) {
      const tx = x, ty = y + boxH - S;
      G.Touch.addButton(tx, ty, S, S, () => { carryOpen = false; G.Audio.sfx('click'); }, 4);
    }
    ctx.restore();
  }

  // ---------------- cooperativo ----------------

  /**
   * - Vida de cada compañero debajo de la tuya.
   * - Flecha en el borde de la pantalla hacia los que no se ven, con su nombre
   *   y a cuántos metros están (roja y parpadeando si está caído).
   * - Si has caído tú: aviso y barra de "te están levantando".
   */
  function drawCoop(ctx, w, h, pl, px, top) {
    const cam = G.Camera;
    const t = performance.now() / 1000;
    let y = top;
    ctx.textAlign = 'left';
    for (const m of G.Coop.mates) {
      if (!m.connected) continue;
      const o = m.pl;
      ctx.font = F(800, 10);
      ctx.fillStyle = m.color;
      ctx.fillText(m.name, px, y + 9);
      const lx = px + 78;
      bar(ctx, lx, y + 1, 110, 8, o.dead ? 0 : o.hp / o.maxHp, o.dead ? '#ff5f6d' : '#5fe08a');
      if (o.dead) {
        ctx.font = F(800, 9);
        ctx.fillStyle = Math.sin(t * 8) > 0 ? '#ff8a96' : '#ffd0d5';
        ctx.fillText('CAÍDO', lx + 116, y + 9);
      }
      y += 15;
    }

    // Flechas hacia los compañeros fuera de la vista.
    for (const m of G.Coop.mates) {
      if (!m.connected) continue;
      const o = m.pl;
      const sx = (o.x - cam.left()) * cam.scale, sy = (o.y - o.bodyH * 0.5 - cam.top()) * cam.scale;
      if (sx > 0 && sx < w && sy > 0 && sy < h) continue;
      const M = 42;
      const ex = G.U.clamp(sx, M, w - M), ey = G.U.clamp(sy, M + 70, h - M - 80);
      const a = Math.atan2(sy - ey, sx - ex);
      const metres = Math.round(G.U.dist(pl.x, pl.y, o.x, o.y) / 32);
      const col = o.dead ? (Math.sin(t * 8) > 0 ? '#ff5f6d' : '#ffd0d5') : m.color;
      ctx.save();
      ctx.translate(ex, ey);
      // Flecha
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.beginPath(); ctx.arc(0, 0, 17, 0, 6.2832); ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 28, Math.sin(a) * 28);
      ctx.lineTo(Math.cos(a + 2.4) * 14, Math.sin(a + 2.4) * 14);
      ctx.lineTo(Math.cos(a - 2.4) * 14, Math.sin(a - 2.4) * 14);
      ctx.closePath(); ctx.fill();
      // Inicial del compañero dentro del círculo
      ctx.font = F(800, 14);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(m.name.charAt(0).toUpperCase(), 0, 5);
      // Nombre y distancia: al lado contrario de la flecha, para que no se salga
      const lx = -Math.cos(a) * 30, ly = -Math.sin(a) * 26 + 4;
      ctx.font = F(800, 12);
      const label = (o.dead ? '¡' + m.name + ' necesita ayuda! ' : m.name + ' ') + '· ' + metres + ' m';
      ctx.textAlign = Math.cos(a) > 0.3 ? 'right' : Math.cos(a) < -0.3 ? 'left' : 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.8)';
      ctx.strokeText(label, lx, ly);
      ctx.fillStyle = col;
      ctx.fillText(label, lx, ly);
      ctx.restore();
    }

    // Tú, caído.
    if (pl.dead) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = F(800, 20);
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.75)';
      const msg = G.Coop.players().every(p => p.dead) ? 'Habéis caído todos…' : 'Has caído: un compañero puede levantarte';
      ctx.strokeText(msg, w / 2, h * 0.62);
      ctx.fillStyle = '#ffb0b8';
      ctx.fillText(msg, w / 2, h * 0.62);
      const f = (pl.reviveT || 0) / G.Player.REVIVE_TIME;
      if (f > 0) bar(ctx, w / 2 - 110, h * 0.62 + 12, 220, 10, f, '#5fe08a');
      ctx.restore();
    }
  }

  return { draw, roundRect, bar };
})();
