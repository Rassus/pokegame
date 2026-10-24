/* ============ berries.js — las 8 bayas del huerto ============
 * El dibujo sale de assets/berries/bayas.png (192×96) y las semillas de
 * semillas.png, el mismo orden. Los recortes son el píxel opaco de cada una.
 * El arbusto (arbusto.png) tiene tres fases. El cartel (cartel.png) tapa
 * las parcelas que aún no están compradas.
 * La descripción larga (sabor, run, torre, expedición) solo se enseña en la mochila.
 */
G.Berries = (() => {
  const LIST = [
    {
      id: 'caramel', name: 'Caramelo', grow: 90 * 60 * 1000,
      rect: [15, 9, 23, 28], seed: [16, 12, 21, 21],
      blurb: 'Blanda y muy dulce. Se deshace al primer bocado y deja la boca pegajosa.',
      run: 'Cura 3,5 de vida por segundo hasta haber curado 350. Si la vida ya está llena, no hace nada.',
      tower: 'Aumenta 100 la vida máxima. No cura.',
      exp: 'La ronda baja 1 minuto (mínimo 5).',
      hudRun: 'Cura 3,5 por segundo', hudTower: '+100 de vida máxima', hudExp: 'Ronda -1 min'
    },
    {
      id: 'bruva', name: 'Bruva', grow: 205 * 60 * 1000,
      rect: [60, 9, 26, 28], seed: [64, 16, 15, 15],
      blurb: 'Ácida y firme. El zumo mancha los dedos y el sabor se queda un rato.',
      run: 'El veneno hace un 10% más de daño y dura un 5% menos.',
      tower: 'El veneno hace un 6% más de daño.',
      exp: 'En un bioma malo, la probabilidad de perder un fragmento baja un 5%.',
      hudRun: 'Veneno +10%', hudTower: 'Veneno +6%', hudExp: 'Menos pérdidas'
    },
    {
      id: 'toto', name: 'Toto', grow: 45 * 60 * 1000,
      rect: [105, 9, 29, 28], seed: [106, 9, 23, 25],
      blurb: 'Jugosa y ligera, con un gusto fresco que recuerda a hierba recién cortada.',
      run: 'Empiezas con Síntesis 3.',
      tower: 'Empiezas con Síntesis 3.',
      exp: 'La ronda sube 1 minuto y cada ronda tiene un 10% de dar un fragmento más.',
      hudRun: 'Síntesis 3', hudTower: 'Síntesis 3', hudExp: 'Ronda +1 min'
    },
    {
      id: 'drildo', name: 'Drildo', grow: 135 * 60 * 1000,
      rect: [153, 9, 28, 28], seed: [155, 14, 20, 20],
      blurb: 'Dura como un hueso. Hay que morder fuerte y suelta un sabor terroso.',
      run: 'Empiezas con Coraza 2 y su tope pasa de 12 a 14.',
      tower: 'Empiezas con Coraza 2 y su tope pasa de 12 a 14.',
      exp: 'En un bioma malo, cada 30 minutos hay un 10% de ganar 3 fragmentos y un 15% más de perder uno.',
      hudRun: 'Coraza 2', hudTower: 'Coraza 2', hudExp: 'Fragmentos extra'
    },
    {
      id: 'perah', name: "Pera'h", grow: 80 * 60 * 1000,
      rect: [13, 59, 24, 28], seed: [16, 60, 19, 28],
      blurb: 'Crujiente y un poco seca. El dulzor llega tarde y luego se alarga.',
      run: 'Prisa dura 85 segundos y, si coges otra mientras dura, se acumula una vez.',
      tower: 'El clima no te quita vida, no te frena y no cambia tu daño.',
      exp: 'La expedición puede durar 10 horas.',
      hudRun: 'Prisa más larga', hudTower: 'Ignora el clima', hudExp: 'Hasta 10 h'
    },
    {
      id: 'picor', name: 'Picor', grow: 240 * 60 * 1000,
      rect: [60, 59, 26, 28], seed: [61, 65, 24, 16],
      blurb: 'Pequeña y áspera. Pica en la lengua y el calor tarda en irse.',
      run: '+25% de daño, y no salen Coraza ni Fortaleza.',
      tower: '+40% de daño, y no salen Coraza ni Fortaleza.',
      exp: 'En un bioma malo no pierdes fragmentos.',
      hudRun: 'Daño +25%', hudTower: 'Daño +40%', hudExp: 'Sin pérdidas'
    },
    {
      id: 'polca', name: 'Polca', grow: 360 * 60 * 1000,
      rect: [107, 59, 26, 28], seed: [109, 62, 21, 22],
      blurb: 'Blanda y chispeante. El jugo salta y deja un cosquilleo en los dientes.',
      run: 'Mientras dura el altar Rayo, al rozar a un enemigo le haces el 8% de tu velocidad por tu ataque, como mucho cada 0,8 segundos.',
      tower: 'Si sale Carrera te la quedas y eliges otra carta.',
      exp: 'La ronda baja 5 minutos (mínimo 5) y dura como mucho 4 horas.',
      hudRun: 'Golpea al rozar', hudTower: 'Te quedas Carrera', hudExp: 'Ronda -5 min'
    },
    {
      id: 'aranja', name: 'Aranja', grow: 170 * 60 * 1000,
      rect: [154, 59, 26, 28], seed: [155, 64, 19, 18],
      blurb: 'Lisa y pesada. Amarga al principio y luego se vuelve dulce.',
      run: 'El suelo no te frena ni te hace daño, ni las trampas del suelo.',
      tower: 'El suelo no te frena ni te hace daño, ni las trampas del suelo.',
      exp: 'En un bioma bueno, la probabilidad de un fragmento extra sube un 15%.',
      hudRun: 'Ignora el suelo', hudTower: 'Ignora el suelo', hudExp: 'Más fragmentos'
    }
  ];
  const BY = {};
  for (const b of LIST) BY[b.id] = b;
  const IDS = LIST.map(b => b.id);

  // Parcelas del mapa (763×425), de izquierda a derecha y de arriba abajo.
  const PLOTS = [
    [98, 87, 69, 108], [198, 87, 69, 108], [298, 86, 70, 109], [399, 87, 68, 108], [498, 86, 69, 109], [598, 85, 69, 110],
    [98, 231, 69, 116], [198, 231, 69, 116], [298, 231, 69, 116], [398, 230, 69, 117], [498, 231, 69, 116], [598, 231, 69, 116]
  ];
  const MAP = { w: 763, h: 425 };
  // Precios de la 2ª a la 12ª. La primera ya está abierta.
  const PRICES = [1500, 35000, 125000, 450000, 865000, 1234000, 2500000, 2500000, 2500000, 2500000, 2500000];
  const BUSH = [
    [29, 61, 69, 37],
    [27, 172, 69, 48],
    [16, 288, 101, 62]
  ];
  const SEED_PRICE = 2500;
  const SHOP_MS = 8 * 60 * 60 * 1000;

  function clock(min) {
    const m = Math.max(0, Math.round(min));
    const h = Math.floor(m / 60);
    return String(h).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }

  /** Frase del resultado: run, torre o expedición. */
  function benefit(id, where) {
    const b = BY[id];
    if (!b) return '';
    if (where === 'tower') return b.tower;
    if (where === 'exp') return b.exp;
    return b.run;
  }
  /** Frase corta para el HUD y la ficha de la expedición. */
  function hudLine(id, where) {
    const b = BY[id];
    if (!b) return '';
    if (where === 'tower') return b.hudTower;
    if (where === 'exp') return b.hudExp;
    return b.hudRun;
  }

  const img = {};
  const readyFns = [];
  function onReady(fn) { readyFns.push(fn); }
  function sheet(file) {
    if (!img[file]) {
      const im = new Image();
      im.onload = () => { for (const fn of readyFns) { try { fn(); } catch (e) { /* la pantalla ya no está */ } } };
      im.src = 'assets/berries/' + file;
      img[file] = im;
    }
    return img[file];
  }
  function warm() { sheet('bayas.png'); sheet('semillas.png'); }

  /** Dibuja la baya o la semilla dentro del rectángulo, sin deformarla. */
  function paint(ctx, id, x, y, w, h, kind) {
    const def = BY[id];
    const rect = def && (kind === 'seed' ? def.seed : def.rect);
    const im = sheet(kind === 'seed' ? 'semillas.png' : 'bayas.png');
    if (!rect || !im.complete || !im.naturalWidth) return false;
    const [sx, sy, sw, sh] = rect;
    const sc = Math.min(w / sw, h / sh);
    const dw = sw * sc, dh = sh * sc;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(im, sx, sy, sw, sh, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    ctx.restore();
    return true;
  }

  return {
    LIST, BY, IDS, PLOTS, MAP, PRICES, BUSH, SEED_PRICE, SHOP_MS, clock,
    benefit, hudLine, onReady, warm, paint
  };
})();
