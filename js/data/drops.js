/* ============ drops.js — porcentajes de aparición ============
 * Todos los números de esta tabla están en porcentaje (%).
 * Cantidad de cofres multiplica los cofres del mapa.
 * Fortuna de tickets suma en cofres, jefes y grietas, no en cada Pokémon.
 * Willy Wonka suma al Caramelo Raro.
 * Esas tres mejoras están en UPGRADES: el índice es el nivel comprado.
 */
G.Drops = (() => {
  /**
   * De cada 100 casillas de suelo abierto, lejos del inicio.
   * Altar, manantial, cofre con candado y trampa comparten `special`:
   * lo que no es altar, manantial ni cofre, es trampa.
   * `chest` y `bigchest` se multiplican por Cantidad de cofres.
   */
  const MAP = {
    altar: 0.04,
    spring: 0.04,
    bigchest: 0.03,
    special: 0.32,
    chest: 0.049
  };

  /** Hierba, roca o Pokémon derrotado. */
  const CANDY = 0.005;

  /**
   * Tickets. Cada uno: probabilidad en %, y cuántos salen (mínimo y máximo).
   *   ticket gris · ticket10 morado · ticketb azul · ticketg dorado
   *   kill   al derrotar un Pokémon
   *   small  cofre pequeño · big  cofre con candado
   *   boss   jefe · rift  legendario de grieta
   */
  const TICKETS = {
    kill: {
      ticket:   { p: 0.118, min: 2, max: 5 },
      ticket10: { p: 0.012, min: 1, max: 3 },
      ticketb:  { p: 0.0036, min: 1, max: 2 },
      ticketg:  { p: 0.0000012, min: 1, max: 1 }
    },
    small: {
      ticket:   { p: 10.12, min: 1, max: 3 },
      ticket10: { p: 1.32, min: 1, max: 1 },
      ticketb:  { p: 0.05, min: 1, max: 1 },
      ticketg:  { p: 0.001, min: 1, max: 1 }
    },
    big: {
      ticket:   { p: 14.12, min: 2, max: 6 },
      ticket10: { p: 6.2, min: 1, max: 2 },
      ticketb:  { p: 3.6, min: 1, max: 1 },
      ticketg:  { p: 0.008, min: 1, max: 1 }
    },
    boss: {
      ticket:   { p: 75, min: 13, max: 100 },
      ticket10: { p: 50, min: 1, max: 4 },
      ticketb:  { p: 32, min: 1, max: 2 },
      ticketg:  { p: 1, min: 1, max: 1 }
    },
    rift: {
      ticket:   { p: 85, min: 25, max: 120 },
      ticket10: { p: 65, min: 5, max: 17 },
      ticketb:  { p: 46, min: 3, max: 5 },
      ticketg:  { p: 3, min: 1, max: 2 }
    }
  };

  const TICKET_KINDS = ['ticket', 'ticket10', 'ticketb', 'ticketg'];

  /**
   * Mejoras de la cuenta. El índice es el nivel (0 = sin comprar).
   *   chests.solo   multiplicador del mapa, en solitario
   *   chests.party  lo que suma cada jugador, en grupo
   *   candy         % extra de Caramelo Raro
   *   tickets       % extra de gris, morado, azul y dorado
   */
  const UPGRADES = {
    chests: {
      solo:  [1, 1.26, 1.53, 1.84],
      party: [0, 0.05, 0.10, 0.14]
    },
    candy: [0, 0.005, 0.010, 0.025],
    tickets: [
      { ticket:  0, ticket10: 0,   ticketb: 0,    ticketg: 0 },
      { ticket:  2, ticket10: 0.1, ticketb: 0.05, ticketg: 0.001 },
      { ticket:  4, ticket10: 0.2, ticketb: 0.10, ticketg: 0.002 },
      { ticket:  6, ticket10: 0.3, ticketb: 0.15, ticketg: 0.003 },
      { ticket:  8, ticket10: 0.4, ticketb: 0.20, ticketg: 0.004 },
      { ticket: 10, ticket10: 0.5, ticketb: 0.25, ticketg: 0.005 },
      { ticket: 12, ticket10: 0.6, ticketb: 0.30, ticketg: 0.006 },
      { ticket: 14, ticket10: 0.7, ticketb: 0.35, ticketg: 0.007 },
      { ticket: 16, ticket10: 0.8, ticketb: 0.40, ticketg: 0.008 },
      { ticket: 18, ticket10: 0.9, ticketb: 0.45, ticketg: 0.009 },
      { ticket: 20, ticket10: 1,   ticketb: 0.50, ticketg: 0.010 }
    ]
  };

  function at(rows, level) {
    const i = Math.max(0, Math.min(rows.length - 1, level | 0));
    return rows[i];
  }

  /** % extra de Caramelo Raro según el nivel de Willy Wonka. */
  function candyAdd(level) { return at(UPGRADES.candy, level); }

  /** % extra de cada ticket según el nivel de Fortuna de tickets. */
  function ticketAdd(level) {
    const row = at(UPGRADES.tickets, level);
    return TICKET_KINDS.map(k => row[k]);
  }

  /** Franja del mapa (altar, manantial, cofre con candado, trampa) para un multiplicador de cofres. */
  function mapBand(k) {
    const altar = MAP.altar / 100;
    const spring = altar + MAP.spring / 100;
    const big = spring + (MAP.bigchest / 100) * k;
    return { cap: Math.max(MAP.special / 100, big), altar, spring, big };
  }

  /**
   * Cofre pequeño: la probabilidad de la tabla, colocada justo debajo de las
   * rocas. Con los números de ahora, la franja es la de siempre (0,7% × 7%).
   */
  function chestRoll(k) {
    const want = (MAP.chest / 100) * k;
    const hi = 0.992;
    const width = Math.max(0.007, Math.min(0.9, want));
    return { lo: hi - width, hi, roll: Math.min(1, want / width) };
  }

  return { MAP, CANDY, TICKETS, TICKET_KINDS, UPGRADES, candyAdd, ticketAdd, mapBand, chestRoll };
})();
