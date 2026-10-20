/* ============ berries.js — las 8 bayas del huerto ============
 * El dibujo sale de assets/berries/bayas.png (192×96). Los recortes son el
 * píxel opaco de cada baya, de izquierda a derecha y de arriba abajo.
 * El arbusto (arbusto.png) tiene tres fases. El cartel (cartel.png) tapa
 * las parcelas que aún no están compradas.
 */
G.Berries = (() => {
  const LIST = [
    {
      id: 'caramel', name: 'Caramelo', grow: 90 * 60 * 1000, rect: [15, 9, 23, 28],
      text: 'En la partida cura 3,5 de vida por segundo hasta haber curado 350, y entonces se gasta. Si ya tienes la vida llena, no hace nada. En la torre cura 100 y se gasta. En la expedición, la ronda baja 1 minuto (mínimo 5).'
    },
    {
      id: 'bruva', name: 'Bruva', grow: 205 * 60 * 1000, rect: [60, 9, 26, 28],
      text: 'En la partida, tu veneno hace un 10% más de daño y dura un 5% menos. En la torre hace un 6% más. En un bioma malo, la probabilidad de perder un fragmento baja un 5%.'
    },
    {
      id: 'toto', name: 'Toto', grow: 45 * 60 * 1000, rect: [105, 9, 29, 28],
      text: 'Empiezas con Síntesis 3. En la expedición, la ronda sube 1 minuto y cada ronda tiene un 10% de dar un fragmento más.'
    },
    {
      id: 'drildo', name: 'Drildo', grow: 135 * 60 * 1000, rect: [153, 9, 28, 28],
      text: 'Empiezas con Coraza 2 y su tope pasa de 12 a 14. En un bioma malo, cada 30 minutos hay un 10% de ganar 3 fragmentos y un 15% más de perder uno.'
    },
    {
      id: 'perah', name: "Pera'h", grow: 80 * 60 * 1000, rect: [13, 59, 24, 28],
      text: 'Prisa dura 85 segundos y, si coges otra mientras dura, se acumula una vez. En la torre, el clima no te quita vida, no te frena y no cambia tu daño. La expedición puede durar 10 horas.'
    },
    {
      id: 'picor', name: 'Picor', grow: 240 * 60 * 1000, rect: [60, 59, 26, 28],
      text: 'En la partida, +25% de daño, y no salen Coraza ni Fortaleza. En la torre, +40%, con el mismo bloqueo. En un bioma malo no pierdes fragmentos.'
    },
    {
      id: 'polca', name: 'Polca', grow: 360 * 60 * 1000, rect: [107, 59, 26, 28],
      text: 'Mientras dura el altar Rayo, al rozar a un enemigo le haces el 8% de tu velocidad por tu ataque, como mucho cada 0,8 segundos. En la torre, si sale Carrera te la quedas y eliges otra carta. En la expedición, la ronda baja 5 minutos (mínimo 5) y dura como mucho 4 horas.'
    },
    {
      id: 'aranja', name: 'Aranja', grow: 170 * 60 * 1000, rect: [154, 59, 26, 28],
      text: 'El suelo no te frena ni te hace daño, ni las trampas del suelo. En un bioma bueno, la probabilidad de un fragmento extra sube un 15%.'
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

  return { LIST, BY, IDS, PLOTS, MAP, PRICES, BUSH, SEED_PRICE, SHOP_MS, clock };
})();
