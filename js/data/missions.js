/* ============ missions.js — plantillas de misiones diarias y semanales ============
 * Cada día salen 3 diarias y cada semana 2 semanales (hora de España), con
 * objetivos y tipos sorteados. Se completan jugando y el premio se recoge en
 * la pantalla de Misiones. La lógica está en systems/progress.js.
 *
 *   ev      evento que la hace avanzar (ver G.Progress.event)
 *   match   (datos, parámetro) -> ¿cuenta este evento?
 *   value   datos -> cuánto vale; con mode 'max' se queda el mayor, con
 *           'add' (por defecto) se suma (1 si no hay value)
 *   param   'type': sortea un tipo Pokémon para la misión
 */
G.MissionDefs = (() => {
  const T = t => G.U.TYPE_NAME[t];
  const min = d => Math.floor(d.time / 60);

  const daily = [
    { id: 'kill', ev: 'kill', goals: [300, 500, 800], reward: { t1: 2, coins: 150 },
      text: n => `Derrota a ${n} Pokémon` },
    { id: 'killType', ev: 'kill', param: 'type', goals: [30, 50, 80], reward: { t1: 2, coins: 200 },
      match: (d, t) => d.types.includes(t), text: (n, t) => `Derrota a ${n} Pokémon de tipo ${T(t)}` },
    { id: 'survive', ev: 'runEnd', mode: 'max', value: min, goals: [5, 7, 9], reward: { t1: 3, coins: 200 },
      text: n => `Aguanta ${n} minutos en una run` },
    { id: 'level', ev: 'runEnd', mode: 'max', value: d => d.level, goals: [8, 12, 15], reward: { t1: 2, coins: 200 },
      text: n => `Llega al nivel ${n} en una run` },
    { id: 'boss', ev: 'kill', match: d => d.boss, goals: [1, 2], reward: { t1: 3, coins: 250 },
      text: n => (n === 1 ? 'Derrota a un jefe' : `Derrota a ${n} jefes`) },
    { id: 'chest', ev: 'chest', goals: [1, 2], reward: { t1: 2, coins: 200 },
      text: n => (n === 1 ? 'Abre un cofre con candado' : `Abre ${n} cofres con candado`) },
    { id: 'coins', ev: 'runEnd', value: d => d.coins, goals: [100, 200, 300], reward: { t1: 2, coins: 150 },
      text: n => `Recoge ${n} monedas en tus runs` },
    { id: 'playType', ev: 'runEnd', param: 'type', mode: 'max', value: min, goals: [3], reward: { t1: 3, coins: 200 },
      match: (d, t) => d.types.includes(t), text: (n, t) => `Aguanta ${n} minutos con un Pokémon de tipo ${T(t)}` },
    { id: 'item', ev: 'item', goals: [1], reward: { t1: 2, coins: 150 },
      text: () => 'Encuentra un objeto equipable' },
    { id: 'evolve', ev: 'evolve', goals: [1], reward: { t1: 3, coins: 250 },
      text: () => 'Evoluciona un movimiento' }
  ];

  const weekly = [
    { id: 'wkill', ev: 'kill', goals: [4000, 6000], reward: { t10: 1, coins: 800 },
      text: n => `Derrota a ${G.U.num(n)} Pokémon` },
    { id: 'wrift', ev: 'rift', goals: [1, 2], reward: { t10: 1, coins: 1000 },
      text: n => (n === 1 ? 'Gana una pelea en una grieta' : `Gana ${n} peleas en grietas`) },
    { id: 'wboss', ev: 'kill', match: d => d.boss, goals: [4, 6], reward: { t10: 1, coins: 900 },
      text: n => `Derrota a ${n} jefes` },
    { id: 'wsurvive', ev: 'runEnd', mode: 'max', value: min, goals: [12, 15], reward: { t10: 1, coins: 1000 },
      text: n => `Aguanta ${n} minutos en una run` },
    { id: 'wevolve', ev: 'evolve', goals: [3, 5], reward: { t10: 1, coins: 900 },
      text: n => `Evoluciona ${n} movimientos` },
    { id: 'wdaily', ev: 'missionDone', match: d => d.daily, goals: [8, 12], reward: { t10: 1, coins: 800 },
      text: n => `Completa ${n} misiones diarias` }
  ];

  const BY = {};
  for (const m of daily.concat(weekly)) BY[m.id] = m;

  return { daily, weekly, BY };
})();

/* Misiones fijas para abrir regiones. Kanto (gen 1) empieza abierta.
 * Cada ficha es una lista: se mira en la cuenta (no se lleva un contador
 * aparte) y, si hay algo «a pagar», se gasta al abrirla.
 * «Cada región» son las anteriores a la que se abre.
 * Si una región tiene menos Pokémon que lo pedido, la meta es tenerlos todos
 * (Kalos 70, Alola 83, Galar 87). */
G.RegionMissions = (() => {
  const REG = ['', 'Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Teselia', 'Kalos', 'Alola', 'Galar', 'Paldea'];
  const n = x => G.U.num(x);
  const capOf = gen => G.DEX.filter(p => p.gen === gen && G.SPRITE_META[p.dex]).length;
  const own = (gen, goal) => {
    const g = Math.min(goal, capOf(gen) || goal);
    return { kind: 'own', gen, goal: g, text: n(g) + ' Pokémon de ' + REG[gen] };
  };
  const each = (gen, goal) => { const a = []; for (let g = 1; g < gen; g++) a.push(own(g, goal)); return a; };
  const kills = goal => ({ kind: 'kills', goal, text: 'Derrota a ' + n(goal) + ' Pokémon' });
  const minutes = goal => ({ kind: 'minutes', goal, text: 'Aguanta ' + n(goal) + ' minutos en una run' });
  const rift = () => ({ kind: 'rift', goal: 1, text: 'Derrota a 1 jefe de grieta' });
  const bosses = goal => ({ kind: 'bosses', goal, text: 'Derrota a ' + n(goal) + ' jefes' });
  const towers = goal => ({ kind: 'towers', goal, text: (goal === 1 ? 'Desbloquea 1 torre' : 'Desbloquea ' + n(goal) + ' torres') });
  const floor = goal => ({ kind: 'floor', goal, text: 'Llega a la oleada ' + n(goal) + ' de una torre' });
  const clear = () => ({ kind: 'clear', goal: 1, text: 'Llega a la oleada 100 de una torre' });
  const clears = goal => ({ kind: 'clears', goal, text: 'Llega a la oleada 100 en ' + n(goal) + ' torres distintas' });
  const shiny = goal => ({ kind: 'shiny', goal, text: 'Consigue ' + n(goal) + ' shinies' });
  const gold = goal => ({ kind: 'pay', coins: goal, goal, text: 'Paga ' + n(goal) + ' de oro' });
  const ticket = (key, goal, word) => ({ kind: 'pay', [key]: goal, goal, text: 'Paga ' + n(goal) + ' tickets ' + word });

  return [
    { gen: 2, name: 'Johto', reqs: [own(1, 15), kills(150), minutes(5), rift()] },
    { gen: 3, name: 'Hoenn', reqs: [own(1, 35), own(2, 15), kills(800), minutes(8), towers(1), bosses(5)] },
    { gen: 4, name: 'Sinnoh', reqs: [own(1, 70), own(2, 50), own(3, 50), kills(4600), minutes(15), towers(5), floor(40), bosses(25)] },
    { gen: 5, name: 'Teselia', reqs: [...each(5, 50), kills(10000), gold(10000), minutes(20), towers(10), clear(), bosses(40)] },
    { gen: 6, name: 'Kalos', reqs: [...each(6, 60), gold(20000), ticket('t1', 25, 'grises'), shiny(5)] },
    { gen: 7, name: 'Alola', reqs: [...each(7, 70), gold(35000), ticket('t1', 50, 'grises'), ticket('t10', 5, 'morados'), clears(3)] },
    { gen: 8, name: 'Galar', reqs: [...each(8, 80), gold(50000), ticket('t1', 100, 'grises'), ticket('t10', 10, 'morados'), ticket('tb', 10, 'azules'), kills(1000000), bosses(100)] },
    { gen: 9, name: 'Paldea', reqs: [...each(9, 90), gold(100000), ticket('tg', 2, 'dorados')] }
  ];
})();
