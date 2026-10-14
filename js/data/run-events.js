/* ============ run-events.js — eventos fijos de una partida ============
 * Como las misiones: se edita esta lista. Cada ficha dice cuándo ocurre y
 * qué Pokémon sale. Se dispara una vez por partida, al llegar a ese minuto.
 *
 *   min    minuto de la run (25 = al cumplirse 25:00)
 *   kind   'rift'  abre una grieta; al entrar peleas contra ese Pokémon
 *          'boss'  aparece como jefe
 *          'wave'  una marea de ese Pokémon
 *   dex    número de la pokédex
 *
 * Ejemplo: al minuto 25, una grieta con Articuno.
 */
G.RunEvents = [
  { min: 25, kind: 'rift', dex: 144 }
];
