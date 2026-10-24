/* ============ changelog.js — novedades del juego ============
 * Lo que ve la gente en el botón "Novedades" de la barra de arriba: cambios
 * de juego y fallos arreglados (nada de servidores ni bases de datos).
 * La fecha más nueva, arriba. En cada fecha, por apartados:
 *   new  lo nuevo · chg  cambios y ajustes · fix  fallos arreglados
 * Cada línea en español y en inglés.
 */
G.CHANGELOG = [
  { d: '2026-10-24', title: ['Peleas más fluidas', 'Smoother fights'], new: [
    ['En el modo prueba, durante la run se puede cambiar el nivel, elegir ataques y combinaciones, abrir una grieta, llamar un jefe, volverse indestructible o poner el daño a ×1000. Esa run no entra en el ranking ni en tus récords.',
     'In test mode, during a run you can change level, pick moves and combinations, open a rift, call a boss, turn invincible or set damage to ×1000. That run does not count for the leaderboard or your records.']
  ], chg: [
    ['El agua, la lava y el destello al golpear gastan menos. Con muchos efectos la pelea va más suave.',
     'Water, lava and the flash when you land a hit cost less. With lots of effects the fight runs smoother.'],
    ['El ticket dorado solo da un shiny que te falte. Si ya tienes todos los shiny, da 1500 fragmentos de un Pokémon del banner.',
     'The gold ticket only gives a shiny you are missing. If you already have every shiny, it gives 1,500 fragments of a Pokémon from the banner.']
  ] },
  { d: '2026-10-23', title: ['Probabilidades del gacha', 'Gacha odds'], chg: [
    ['Fortaleza baja a +2,2% de defensa por carga.',
     'Harden goes down to +2.2% defense per stack.'],
    ['Lo que pase del 82% de reducción de daño se convierte en escudo: ese porcentaje de tu vida, y se llena un 1% por segundo. Con Cascabel Concha se suma a su 25%.',
     'Anything past 82% damage reduction becomes a shield: that percentage of your HP, and it fills 1% per second. With a Shell Bell it adds to its 25%.'],
    ['Coraza ya no se corta al 70%. Cada carta suma su 6% (hasta 12) y lo que pase del 82% de reducción agranda el escudo.',
     'Armor no longer stops at 70%. Each card adds its 6% (up to 12) and anything past 82% damage reduction makes the shield bigger.'],
    ['En la run y en la torre, la carta de un ataque nuevo solo dice si quema, envenena, frena o empuja. Cuánto quita sigue en la ventana del ataque.',
     'In a run and in a tower, a new attack\'s card only says if it burns, poisons, slows or knocks back. How much it takes stays in the attack window.'],
    ['La Piedra Evolución pasa del 1,5% al 3,2% en cofres y jefes.',
     'The Evolution Stone goes from 1.5% to 3.2% on chests and bosses.'],
    ['El Caramelo Raro sale la mitad de veces: 0,05%. Willy Wonka suma 0,05%, 0,1% o 0,25%.',
     'Rare Candy drops half as often: 0.05%. Willy Wonka adds 0.05%, 0.1% or 0.25%.'],
    ['Si el pase te pide un jefe concreto, ese jefe sale 3 veces más. En la grieta, el legendario que te pide también.',
     'If the pass asks for a specific boss, that boss shows up 3 times as often. In a rift, the legendary it asks for does too.']
  ], fix: [
    ['En el gacha, cada descripción de ticket se abre al pulsar su nombre y enseña solo sus probabilidades.',
     'In the gacha, each ticket descriptionopens when you tap its name and shows only its odds.']
  ] },
  { d: '2026-10-22', title: ['Favoritos, cofres y torres', 'Favorites, chests and towers'], new: [
    ['En Pokémon, el botón Favoritos (a la izquierda de Volver) enseña los que marcaste. La estrella del cuadro del sprite los añade o los quita.',
     'In Pokémon, the Favorites button (left of Back) shows the ones you marked. The star on the sprite box adds or removes them.'],
    ['En Pokémon, Filtros abre un panel a la izquierda. Ahí se marcan varias rarezas y varios tipos, y se combinan con Todos, Tengo, Me faltan y Shiny.',
     'In Pokémon, Filters opens a panel on the left. You can mark several rarities and several types, and they combine with All, Owned, Missing and Shiny.'],
    ['En la ficha de cada Pokémon caben sus marcas a la vez: corona de compañero, estrella de favorito, estrella roja de shiny, medalla de mejoras al máximo y medalla azul de IVs al máximo.',
     'A Pokémon\'s card can show all its marks at once: partner crown, favorite star, red shiny star, max-upgrades medal and blue max-IVs medal.'],
    ['El detalle de un movimiento se abre en su propia ventana: qué hace, el efecto y los niveles 2, 3, 4, 5 y la evolución. La ficha del Pokémon queda más corta, con el recuadro más pequeño, y se puede bajar.',
     'A move\'s details open in their own window: what it does, the effect and levels 2, 3, 4, 5 and the evolution. The Pokémon card stays shorter, with a smaller sprite box, and it can be scrolled.']
  ], chg: [
    ['La Piedra Evolución pasa del 0,01% al 1,5% en cofres y jefes.',
     'The Evolution Stone goes from 0.01% to 1.5% on chests and bosses.'],
    ['Defensa pasa a +1,2% por nivel. La reducción de daño no pasa del 82%.',
     'Defense goes to +1.2% per level. Damage reduction does not go past 82%.'],
    ['Cantidad de cofres, en solitario, es ×1,26, ×1,53 y ×1,84. En grupo cada jugador suma solo la suya: 0,05, 0,10 o 0,14. Ocho con el primer nivel dan ×1,4.',
     'Chest amount, solo, is ×1.26, ×1.53 and ×1.84. In a group each player adds only their own: 0.05, 0.10 or 0.14. Eight at the first level give ×1.4.'],
    ['El Caramelo Raro sale al 0,1%. Willy Wonka suma 0,1%, 0,2% o 0,5%.',
     'Rare Candy drops at 0.1%. Willy Wonka adds 0.1%, 0.2% or 0.5%.'],
    ['Si un ataque quema, envenena, frena o empuja, la descripción dice qué hace ese efecto. En su ventana el efecto va en otra línea y otro color, y dice cuánto quita.',
     'If an attack burns, poisons, slows or knocks back, the description says what that effect does. In its window the effect is on another line and another color, and it says how much it takes.'],
    ['Infortunio llama Beneficio a su daño extra y dice cuánto es: ×1,7 si el enemigo está quemado, envenenado o frenado.',
     'Hex calls its extra damage Benefit and says how much it is: ×1.7 if the enemy is burned, poisoned or slowed.'],
    ['En el gacha, las probabilidades de los tickets se pliegan y se despliegan. El ticket dorado también tiene tirada rápida.',
     'In the gacha, ticket odds fold and unfold. The gold ticket also has a quick pull.'],
    ['En la sala no se puede elegir torre difícil ni demencial si alguien del grupo aún no ha superado al menos una torre.',
     'In the room you cannot pick a hard or insane tower if someone in the group has not cleared at least one tower yet.']
  ], fix: [
    ['Un cofre abierto en grupo no soltaba nada si quien lo abría no era el anfitrión y este aún no había llegado a esa zona. Con la rapidez alta pasaba más. Ahora sí suelta.',
     'A chest opened in a group dropped nothing if the opener was not the host and the host had not reached that area yet. Faster opening made it more common. It drops now.']
  ] },
  { d: '2026-10-21', title: ['La página ya no se recarga sola', 'The page no longer reloads on its own'], fix: [
    ['Si había una versión nueva, el juego recargaba la página guardada y a los 30 segundos lo intentaba otra vez. Ahora pide la página nueva una sola vez.',
     'When a new version was out, the game reloaded the saved page and tried again 30 seconds later. It now asks for the new page once.']
  ] },
  { d: '2026-10-20', title: ['Torre en grupo', 'Group tower'], new: [
    ['Articuno, en su torre, inhala con cinco círculos que se cierran en la boca y suelta un Rayo congelante: un rayo de hielo de ancho fijo que barre 45 grados de ida y vuelve al mismo punto.',
     'In his tower, Articuno inhales with five circles that close on his mouth and fires a Freezing Beam: a fixed-width ice beam that sweeps 45 degrees out and back to the same point.']
  ], chg: [
    ['En la torre, cada compañero que te revive acorta el tiempo. Uno tarda 3 s; dos, 1,5 s; tres, 1 s.',
     'In a tower, each teammate reviving you shortens the time. One takes 3 s; two, 1.5 s; three, 1 s.'],
    ['En la tienda de objetos de la torre, si ya llevas uno, la tercera opción es conservarlo.',
     'In the tower item shop, if you already hold one, the third option is to keep it.'],
    ['Al acabar o perder una run se ve el oro, el multiplicador y el total. Si superas la torre, también el premio por la tier.',
     'When a run ends or you lose, you see the gold, the multiplier and the total. If you clear a tower, the tier prize is shown too.'],
    ['En la sala, al elegir torre, se ven las oleadas, el modo y la tier. El ranking de torres en grupo ya no se queda cargando si hay muchos amigos.',
     'In the room, picking a tower shows the waves, the mode and the tier. The group tower leaderboard no longer stays loading when you have many friends.'],
    ['Al cerrarse la última luz, el rayo de Rayquaza marca el carril un segundo, con la misma luz, y entonces dispara. El suelo que deja queda en lava.',
     'When the last light closes, Rayquaza\'s beam marks the lane for one second, with the same light, and then it fires. The ground it leaves behind turns to lava.'],
  ], fix: [
    ['El Rayo congelante de Articuno cruzaba el cuerpo y no hacía daño. Ahora pega al tocarte.',
     'Articuno\'s Freezing Beam crossed your body and dealt no damage. It now hits when it touches you.']
  ] },
  { d: '2026-10-19', title: ['Hielo oscuro y el equipo', 'Dark ice and the team'], new: [
    ['Al acabar una partida en grupo, Daño tiene la pestaña Equipo: el daño de cada jugador, el MVP, la mochila (el que menos daño hizo) y la alfombra (el que más tiempo pasó caído).',
     'When a group run ends, Damage has a Team tab: each player\'s damage, the MVP, the backpack (least damage) and the carpet (most time down).'],
    ['El ranking de torres separa solitario y grupo. En grupo cuenta la oleada del equipo.',
     'The tower leaderboard splits solo and group. In a group, the team\'s wave is what counts.']
  ], chg: [
    ['Articuno ataca con un hielo más oscuro: ventisca y ráfaga que te frenan. Su aura, su silencio y su amnesia también se ven más oscuros.',
     'Articuno attacks with darker ice: a blizzard and a gust that slow you. Its aura, silence and amnesia look darker too.'],
    ['El Ángel guardián ya no salta al caer si un compañero puede levantarte. Solo actúa cuando la torre se iba a perder.',
     'Guardian angel no longer triggers when you go down if a teammate can revive you. It only acts when the tower was about to be lost.'],
    ['Al vencer al jefe de una torre no suelta un objeto: abre una tienda con 2 objetos y 1 cambio para todos. No salen Ganzúa, Llave Maestra, Moneda Amuleto ni Piedra Evolución.',
     'Beating a tower boss no longer drops an item: it opens a shop with 2 items and 1 reroll for everyone. Lockpick, Master Key, Amulet Coin and Evolution Stone do not appear.'],
    ['En difícil, el oro al superar la torre se multiplica por 4. Las oleadas tienen ×1,3 de vida y de velocidad de ataque.',
     'On hard, the gold for clearing the tower is multiplied by 4. Waves have ×1.3 HP and attack speed.']
  ], fix: [
    ['En el pase, el oro y los tickets salían iguales para todo el mundo. Ahora cada jugador tiene su propia tirada. Lo que ya habías recogido se queda; lo que no, se vuelve a sortear.',
     'On the pass, gold and tickets came out the same for everyone. Each player now has their own roll. What you already claimed stays; what you have not is rolled again.']
  ] },
  { d: '2026-10-18', title: ['Ranking de torres', 'Tower leaderboard'], new: [
    ['Al terminar una torre se ve tu resultado: la torre, el modo, la oleada y si es tu mejor. El premio y el daño son los tuyos.',
     'When a tower ends you see your own result: the tower, the mode, the wave and whether it is your best. The reward and the damage are yours.'],
    ['Pase 1, a la izquierda del menú. 100 niveles: las misiones del mes dan puntos solas y los premios se recogen en el pase. Al pulsar la cabecera se esconde.',
     'Pass 1, on the left of the menu. 100 levels: the month\'s missions add points on their own and the rewards are claimed on the pass. Tap the header to hide it.'],
    ['El ranking tiene la pestaña Torre. Hay una tabla por torre y por modo (normal, difícil y demencial). Gana quien llega más lejos; si la superáis, el más rápido queda delante.',
     'The leaderboard has a Tower tab. There is a board for each tower and mode (normal, hard and insane). Whoever gets further wins; if you clear it, the faster time ranks higher.']
  ], chg: [
    ['En Ajustes ya no está el interruptor de herramientas de prueba. Quedan apagadas.',
     'Settings no longer has the test-tools switch. They stay off.'],
    ['El ranking tiene la pestaña Riqueza: los 50 con más oro y los 50 con más tickets en total.',
     'The leaderboard has a Wealth tab: the 50 with the most gold and the 50 with the most tickets in total.'],
    ['En el ranking, al pulsar un Pokémon se ve su nivel y sus mejoras (Vitalidad, Fuerza y el resto).',
     'On the leaderboard, tapping a Pokémon shows its level and its upgrades (Vitality, Strength and the rest).'],
    ['En el pase, el Pokémon del premio se ve junto a su nombre y la pokéball es la de su rareza. Jugar runs solo cuenta si la partida dura 1 minuto o más.',
     'On the pass, a Pokémon reward shows next to its name and the Poké Ball matches its tier. Playing runs only counts if the run lasts 1 minute or more.'],
    ['Al recoger oro, tickets o un Pokémon del pase gira la tragaperras del gacha y se ven los premios que podían salir.',
     'Claiming gold, tickets or a Pokémon from the pass spins the gacha machine and shows the prizes that could have landed.'],
    ['El pase 1 incluye las misiones diarias desde el día 1 del mes. Plegado mide igual que abierto y dice cuántos días le quedan al mes.',
     'Pass 1 includes the daily missions from day 1 of the month. Folded, it is as wide as when open and shows how many days the month has left.'],
    ['En Misiones hay un filtro para ver todas, solo las diarias, solo las semanales o solo las mensuales.',
     'Missions has a filter to see all of them, or only the daily, weekly or monthly ones.'],
    ['Las misiones del pase van en dos grupos, incompletas y completas, en cápsulas como los logros y con etiqueta de diaria, semanal o mensual. La de región tiene su pestaña y se ve igual.',
     'Pass missions are split into incomplete and complete, in capsules like achievements, tagged daily, weekly or monthly. The region quest has its own tab and looks the same.'],
    ['En el pase, el oro y los tickets se muestran sin cantidad. Al recogerlos se ve cuánto tocó.',
     'On the pass, gold and tickets hide the amount. Claiming them shows what you rolled.'],
    ['En el móvil, el menú es una sola lista: se desplaza y, con Menú, se esconde. En la partida, el oro, los tickets y los shinies caben en un botón del tamaño de un ataque hasta que lo abres.',
     'On mobile, the menu is a single list: it scrolls and Menú hides it. In a run, gold, tickets and shinies fit in a button the size of a move until you open it.']
  ], fix: [
    ['Abrir Misiones ya no falla al leer el progreso del pase.',
     'Opening Missions no longer fails when reading pass progress.'],
    ['Al abrir el oro, los tickets y los shinies en el móvil ya no se queda el marco blanco del botón.',
     'Opening gold, tickets and shinies on mobile no longer leaves the button\'s white frame.'],
    ['Si el navegador se cuelga a mitad de una run, al volver a entrar se guardan el tiempo, las monedas, los récords y el ranking hasta el último punto (como mucho 15 segundos antes). Durante la partida se cierra el tubo de amigos, que es lo que Chrome cortaba.',
     'If the browser hangs mid-run, coming back saves the time, coins, records and leaderboard up to the last point (at most 15 seconds earlier). During a run the friends channel is closed, which is what Chrome was cutting.']
  ] },
  { d: '2026-10-17', title: ['Torres', 'Towers'], new: [
    ['Modo difícil: el doble de Pokémon por oleada, una cada 5 segundos y el jefe en 10 etapas. Cuesta 4 veces más. Se abre al superar esa torre en normal.',
     'Hard mode: twice the Pokémon per wave, one every 5 seconds and the boss in 10 stages. It costs 4 times as much. It opens once you clear that tower on normal.'],
    ['Modo demencial: el cuádruple de Pokémon por oleada, una cada 2 segundos y un jefe en cada oleada. Los jefes se quedan todos a la vez. No cuesta nada. Se abre al superar esa torre en difícil.',
     'Insane mode: four times the Pokémon per wave, one every 2 seconds and a boss on every wave. The bosses all stay at once. It costs nothing. It opens once you clear that tower on hard.'],
    ['Durante la partida, a la derecha de los movimientos, se ven el oro y los tickets que llevas (gris, morado, azul y dorado) y la lista de shinies que has conseguido.',
     'During a run, to the right of your moves, you see the gold and the tickets you are carrying (grey, purple, blue and gold) and the list of shinies you have caught.'],
    ['En la sala se elige si la partida es una run normal o una torre. Si es una torre, en cada jugador se ve si le alcanza para la entrada.',
     'In the room you choose whether the game is a normal run or a tower. On a tower, each player shows whether they can afford the entry.'],
    ['En la sala, el anfitrión puede sacar a alguien. Esa persona vuelve al menú y los demás siguen en la sala.',
     'In the room, the host can remove someone. That person returns to the menu and the others stay in the room.']
  ], chg: [
    ['Defensa baja a +1% por nivel (40% al 40). Fortaleza baja a +4% por carga y ya no sube de potencia: a 7 cargas son un 28%. Con el Chaleco Asalto (+20%) el tope sigue en el 80%; sin él, Defensa al máximo y Fortaleza a tope llegan al 68%.',
     'Defense drops to +1% per level (40% at 40). Harden drops to +4% per stack and no longer gains power: 7 stacks are 28%. With the Assault Vest (+20%) the cap stays at 80%; without it, max Defense and full Harden reach 68%.'],
    ['La tier de una torre es la de su región: Kanto 1, Johto 2… y Paldea 9. El difícil sigue en la 10 y el demencial en la 19. Al ganar, el oro ×4 del costo se multiplica por la tier, los tickets dorados por 0,8 × la tier y los fragmentos por 1,5 × la tier.',
     'A tower\'s tier is its region: Kanto 1, Johto 2… and Paldea 9. Hard continues at 10 and insane at 19. On a clear, gold ×4 the cost is multiplied by the tier, gold tickets by 0.8 × the tier and fragments by 1.5 × the tier.'],
    ['En el título, debajo de Mundo Misterioso, Torres es el logo de Torres Legendarias.',
     'In the title, under Mystery Dungeon, Towers is the Torres Legendarias logo.'],
    ['La arena de las torres es más grande. Las oleadas aparecen en el borde, lejos de donde estáis, y ya no salen encima de los jugadores.',
     'The tower arena is larger. Waves appear at the edge, away from where you stand, and no longer spawn on top of the players.']
  ], fix: [
    ['En la sala, al elegir torre se abre una ventana para escoger cuál. Antes solo se veía la dificultad.',
     'In the room, choosing a tower opens a window to pick which one. Before, only the difficulty was shown.'],
    ['Al salir de una grieta, un jefe no puede aparecer hasta pasados 1 minuto. Antes, si le tocaba durante la pelea, salía en la arena y se quedaba a kilómetros de donde volvíais.',
     'After leaving a rift, a boss cannot appear for 1 minute. Before, if one was due during the fight, it spawned in the arena and stayed kilometres away from where you returned.']
  ] },
  { d: '2026-10-16', title: ['Tirar todo', 'Pull all'], new: [
    ['Caramelo Raro: sale en la hierba, en las rocas y al derrotar un Pokémon, con un 0,001% de probabilidad. Cuando sale, se anuncia. El imán no lo atrae: hay que pasar por encima. Sube un nivel.',
     'Rare Candy: it appears in tall grass, in rocks and when you defeat a Pokémon, with a 0.001% chance. When it appears, it is announced. The magnet does not pull it: you have to walk over it. It raises you one level.'],
    ['Mejora de run: Willy Wonka es mi pastor, nada me faltará, Amén. Suma +0,001% / +0,002% / +0,005% a esa probabilidad. Cuesta 5.000, 45.000 y 450.000.',
     'Run upgrade: Willy Wonka is my shepherd, I shall not want, Amen. It adds +0.001% / +0.002% / +0.005% to that chance. It costs 5,000, 45,000 and 450,000.'],
    ['En el gacha, junto a Tirar ×10, está Tirar todo. Sigue de 10 en 10 sin enseñar cada Pokémon, hasta que paras o se acaban los tickets. Al terminar hay una tarjeta por Pokémon, con los fragmentos sumados.',
     'In the gacha, next to Pull ×10, there is Pull all. It keeps pulling 10 at a time without showing each Pokémon, until you stop or the tickets run out. At the end there is one card per Pokémon, with the fragments added up.']
  ], chg: [
    ['Desde el minuto 15, las oleadas suben de tramo en tramo. Un Pokémon del tramo final tiene, al 15, 13.100 de vida, 210 de daño y salen 16 por segundo; al 30, 24.900 / 355 / 40; al 45, 48.600 / 640 / 109; al 60, 122.500 / 1.250 / 197; al 90, 325.000 / 2.950 / 320; al 105, 425.888 / 4.236 / 425; al 120, 1.000.000 / 15.000 / 600; al 150, 2.500.000 / 30.000 / 850. Entre un tramo y el siguiente suben poco a poco. A partir del 150, vida, daño y ritmo suman un 1% cada 5 minutos.',
     'From minute 15, waves climb from one tier to the next. A final-tier Pokémon has, at 15, 13,100 HP, 210 damage and 16 spawn per second; at 30, 24,900 / 355 / 40; at 45, 48,600 / 640 / 109; at 60, 122,500 / 1,250 / 197; at 90, 325,000 / 2,950 / 320; at 105, 425,888 / 4,236 / 425; at 120, 1,000,000 / 15,000 / 600; at 150, 2,500,000 / 30,000 / 850. Between tiers they rise steadily. From 150 on, HP, damage and spawn rate gain 1% every 5 minutes.'],
    ['A partir del minuto 20, los jefes salen al azar cada 3 a 12 minutos. El primero tiene 150.000 de vida y 550 de daño. Cada uno que sigue suma un 15% de vida y un 10% de daño sobre el anterior.',
     'From minute 20 on, bosses show up at random every 3 to 12 minutes. The first has 150,000 HP and 550 damage. Each one after adds 15% HP and 10% damage on top of the one before.'],
    ['El legendario de una grieta gana un 10% de vida y un 5% de daño y de disparo por cada grieta de la partida, contando esta. Desde el minuto 30 suelta oro: el minuto × las grietas × 4.',
     'A rift legendary gains 10% HP and 5% damage and shot damage for each rift in the run, including this one. From minute 30 it also drops gold: the minute × the rifts × 4.']
  ], fix: [
    ['Al subir vida, ataque o velocidad, los fragmentos que quedan bajan en el momento en las fichas de la pokédex, y ya no vuelven al sincronizar la partida.',
     'After raising HP, attack or speed, the fragments left drop right away on the Pokédex cards, and they no longer come back when the save syncs.']
  ] },
  { d: '2026-10-15', title: ['La meta de ahora', 'The current goal'], new: [
    ['Objetos nuevos: Medallón de Meowth (las monedas caen un 30% más), Boleto Ganador (el oro recogido vale ×1,5 al momento), Ganzúa (los cofres se abren 1 s antes), Llave Maestra (abre un cofre al tocarlo y se gasta), Botines de Hielo (en el agua no frenan y dan +30% de velocidad) y Toalla de Sauna (la lava no hace daño y cura 4 de vida por segundo).',
     'New items: Meowth Medal (coins drop 30% more often), Winning Ticket (picked-up gold is worth ×1.5 right away), Lockpick (chests open 1 s faster), Master Key (opens one chest on touch, then it is gone), Ice Boots (in water they do not slow you and grant +30% speed) and Sauna Towel (lava deals no damage and heals 4 HP per second).'],
    ['Cada jefe tiene su torre. Kanto cuesta 3.000 Pokémonedas, Johto 10.000 y, desde Hoenn, 50.000 más 10 tickets grises por jugador. Rayquaza es una torre de 150 oleadas: la entrada son 100.000 y aparece seis veces antes del jefe final.',
     'Each boss has a tower. Kanto costs 3,000 PokéCoins, Johto 10,000 and, from Hoenn on, 50,000 plus 10 grey tickets per player. Rayquaza is a 150-wave tower: entry is 100,000 and it appears six times before the final boss.'],
    ['En torres de Kanto, los Pokémon de oleada dan experiencia ×2, 3 Pokémonedas y un 0,01% de un fragmento de ese Pokémon. En todas las torres, cada 10 oleadas abre una tienda: 2 mejoras al azar y una baya (blanca 45% vida, morada 70%, azul 90%, dorada 100% + escudo 50%).',
     'In Kanto towers, wave Pokémon give ×2 XP, 3 PokéCoins and a 0.01% chance of a fragment of that Pokémon. In every tower, every 10 waves a shop opens: 2 random upgrades and a berry (white 45% HP, purple 70%, blue 90%, gold 100% + 50% shield).'],
    ['Las mejoras se separan. Del Pokémon: Vitalidad, Fuerza, Velocidad, Reflejos, Defensa, Síntesis, Imán, Sabiduría, Repertorio, Golpe crítico, Cambio de cartas y Veto. De la run: Fortuna (hasta 40, +3,5% por nivel), Fortuna de tickets, Rapidez para abrir cofres y Cantidad de cofres (3 niveles, ×1,2 / ×1,4 / ×1,7). De la grieta: Fuente de agua (3.500, un manantial). De la torre: Oro extra (hasta +40 por baja), Exp extra (hasta +100%), Premio por oleada (la tienda pasa de cada 10 a cada 5) y Ángel guardián (una vida, 25.000).',
     'Upgrades are split. Pokémon: Vitality, Strength, Speed, Reflexes, Defense, Synthesis, Magnet, Wisdom, Repertoire, Critical Hit, Card reroll and Ban. Run: Fortune (up to 40, +3.5% per level), Ticket fortune, Chest opening speed and Chest amount (3 levels, ×1.2 / ×1.4 / ×1.7). Rift: Water spring (3,500, one spring). Tower: Extra gold (up to +40 per defeat), Extra XP (up to +100%), Wave prize (the shop goes from every 10 waves to every 5) and Guardian angel (one life, 25,000).'],
    ['En la sala, cada jugador se marca listo. La partida sólo empieza cuando lo estáis todos.',
     'In the room, each player marks ready. The run only starts once everyone is ready.'],
    ['Rastro de jefes (run, 1.000, un nivel): una flecha amarilla marca a cada jefe, en el borde si no se ve y encima si se ve.',
     'Boss trail (run, 1,000, one level): a yellow arrow marks every boss, on the edge if it is off screen and above it if it is on screen.']
  ], chg: [
    ['En Mejoras, si mantienes pulsado el botón de comprar, sube todos los niveles de esa mejora que te alcance el oro.',
     'In Upgrades, holding the buy button raises every level of that upgrade you can afford.'],
    ['Rayquaza, en su torre, cierra una luz sobre sí cinco veces, cada vez más rápido, y suelta un rayo del grosor de su sprite. Dura 4 segundos, la pantalla tiembla y el suelo por donde pasó quema durante 15 segundos. Vuelve a usarlo a los 30.',
     'In his tower, Rayquaza closes a light on himself five times, faster each time, then fires a beam as thick as his sprite. It lasts 4 seconds, the screen shakes, and the ground it crossed burns for 15 seconds. He uses it again after 30.'],
    ['Al terminar la run, la pestaña Daño muestra cuánto hizo cada movimiento. Los que suben el ataque, como Danza Espada, indican cuánto daño añadieron.',
     'At the end of a run, the Damage tab shows how much each move dealt. Moves that raise attack, like Swords Dance, show how much damage they added.'],
    ['Al superar una torre: 1 ticket dorado, oro por 4 veces el costo y un 60% de 45 a 100 fragmentos de ese jefe. Si no lo tienes, sigue habiendo un 25% de atraparlo.',
     'Clearing a tower gives 1 gold ticket, gold equal to 4 times the entry cost and a 60% chance of 45 to 100 fragments of that boss. If you do not own it, there is still a 25% chance to catch it.'],
    ['Cada oleada, los Pokémon tienen un 3% más de vida y de daño que en la anterior. En las oleadas 10, 30, 50, 70 y 90 salen Chansey: 1, 3, 5, 7 y 7, con esa misma fuerza.',
     'Each wave, Pokémon have 3% more HP and damage than in the wave before. Waves 10, 30, 50, 70 and 90 bring Chansey: 1, 3, 5, 7 and 7, at that same strength.'],
    ['Abrir una región es una lista: Pokémon de las regiones anteriores, bajas, minutos, jefes y torres. Desde Teselia también se paga oro y tickets, y se gastan al abrirla.',
     'Opening a region is a checklist: Pokémon from earlier regions, defeats, minutes, bosses and towers. From Unova on you also pay gold and tickets, and they are spent when you open it.'],
    ['Garra Sangrienta: 3 de vida por enemigo en cada ataque, hasta 12 por ataque. Entre todos, no más del 2% de tu vida máxima por segundo.',
     'Bloody Claw: 3 HP per enemy on each attack, up to 12 per attack. Altogether, no more than 2% of your max HP per second.'],
    ['Moneda Amuleto: +100% de Pokémonedas al acabar la run, y solo si la sigues llevando. Si la cambias antes, no cuenta.',
     'Amulet Coin: +100% PokéCoins at the end of the run, and only if you are still holding it. If you swap it earlier, it does not count.'],
    ['Los logros por escalones muestran solo la meta actual. Al cumplirla, el texto pasa a la siguiente: 1 torre, luego 2, luego 4…',
     'Step achievements show only the current goal. Once you reach it, the text moves on: 1 tower, then 2, then 4…'],
    ['Esas cartas ya no dicen «Paso 1/8»: se ve la meta y el avance.',
     'Those cards no longer say “Step 1/8”: they show the goal and the progress.'],
    ['Los potenciadores y las mejoras de la run se ven a la derecha.',
     'Buffs and run upgrades are shown on the right.'],
    ['Los tickets que recoges son solo tuyos. Los de un jefe se reparten entre el grupo, porque caen juntos. El dorado se sortea con una rueda: el juego se para, gira y se lo lleva quien salga.',
     'Tickets you pick up are yours alone. A boss\'s tickets are split among the group, because they drop together. The gold one is raffled on a wheel: the game pauses, it spins, and the winner keeps it.'],
    ['Si alguien tarda más de 30 segundos en elegir carta, el resto puede votar cuál se queda. Cuando todos han votado, se aplica la más elegida y la partida sigue.',
     'If someone takes more than 30 seconds to pick a card, the others can vote which one they get. Once everyone has voted, the top choice is applied and the run continues.'],
    ['En la pausa, en grupo, se puede votar sacar a un jugador. Si sale que sí, esa persona deja la partida y los demás siguen con lo ganado.',
     'While paused, in a group, you can vote to remove a player. If the vote passes, that person leaves and the others keep going with what they earned.'],
    ['La vida de un jefe, ya con su escala normal, se multiplica por el número de jugadores.',
     'A boss\'s HP, after its normal scaling, is multiplied by the number of players.'],
    ['Un shiny repetido en el gacha da fragmentos de ese Pokémon y vuelve a salir un shiny. Al terminar la tirada hay un botón para tirar otra vez ×10.',
     'A duplicate shiny in the gacha gives fragments of that Pokémon and rolls another shiny. After the pull there is a button to pull ×10 again.'],
    ['Completar la Pokédex de una región da un ticket dorado.',
     'Completing a region\'s Pokédex awards a gold ticket.'],
    ['Al evolucionar en una run, las mejoras de vida, ataque y velocidad pasan a la evolución si son más altas que las que ya tenía. No se suman y no pasan del máximo.',
     'Evolving in a run carries HP, attack and speed upgrades to the new form when they are higher than the ones it already had. They are not added together and they cannot go past the cap.']
  ], fix: [
    ['Si alguien no elige carta, el voto del resto ya cuenta. Al votar todos, se le aplica la carta más elegida y la partida sigue.',
     'If someone does not pick a card, the others\' votes now count. Once everyone has voted, they get the top choice and the run continues.'],
    ['Al sacar a un jugador ausente, la partida ya no se queda parada: se cierran las cartas o la votación y el resto sigue.',
     'After removing an idle player, the run no longer freezes: cards or the vote close and the others keep going.'],
    ['Cooperativo: la partida ya no se queda parada con cada uno esperando a que el otro elija. Un objeto y las cartas de nivel ya no se tapan, y si la conexión pierde un aviso se arregla solo.',
     'Co-op: runs no longer freeze with each player stuck waiting for the other to make a choice. Held-item and level-up cards no longer overlap each other, and lost connection messages now recover on their own.'],
    ['Al salir de una grieta, los Pokémon salvajes se quedaban pegados y no caían aunque les quitaras toda la vida.',
     'After leaving a rift, wild Pokémon got stuck and would not faint even with no HP left.'],
    ['Cambiar opciones [R] no hacía nada en solitario: el juego creía que estabas en una votación de cartas.',
     'Reroll [R] did nothing in solo: the game thought you were in a card vote.'],
    ['«Me gusta el dinero» cuenta solo el oro de las runs. El de las misiones no suma.',
     '“I like money” counts only gold from runs. Mission gold does not count.'],
    ['A veces un Pokémon salvaje se quedaba invisible si el navegador soltaba su dibujo.',
     'A wild Pokémon could turn invisible when the browser dropped its sprite.'],
    ['Al jugar en grupo, Chrome a veces cortaba la conexión con la partida guardada.',
     'In a group, Chrome could drop the connection to the saved game.']
  ]},
  { d: '2026-10-14', title: ['Sin avisos de donación', 'No donation prompts'], new: [
    ['Logros por escalones: las 9 regiones completas, Pokémon y jefes shiny vencidos, tragaperras, tickets dorados gastados, oro ganado y oro acumulado, tickets, minutos y nivel en una run, partidas jugadas, torres al 100 y torres desbloqueadas, y bajas y jefes en una sola run.',
     'Step achievements: all 9 regions, shiny Pokémon and shiny bosses defeated, slot pulls, gold tickets spent, gold earned and gold held, tickets, minutes and level in a run, runs played, towers cleared at wave 100 and towers unlocked, and kills and bosses in a single run.']
  ], chg: [
    ['Se quitó el botón de Apoyar de la barra y el aviso de Ko-fi al terminar una partida.',
     'The Support button in the top bar and the Ko-fi prompt at the end of a run are gone.']
  ]},
  { d: '2026-10-13', title: ['Todas las partidas cuentan', 'Every run counts'], new: [
    ['Regiones: solo Kanto empieza abierta. En Misiones hay una misión fija para abrir cada región siguiente (Johto, Hoenn… hasta Paldea). El gacha de una región cerrada se puede mirar, pero no tirar. Si ya tenías Pokémon de otras regiones, esas siguen abiertas.',
     'Regions: only Kanto starts open. Missions has a fixed quest to open each next region (Johto, Hoenn… through Paldea). You can look at a locked region\'s banner, but not pull on it. If you already had Pokémon from other regions, those stay open.'],
    ['Gacha: cada tirada da 1 fragmento de ese Pokémon. Se desbloquea al juntar los de su rareza: Común 3, Poco común 5, Rara 10, Épica 15 y Legendaria 20. Un shiny lo desbloquea en esa tirada.',
     'Gacha: each pull gives 1 fragment of that Pokémon. You unlock it by collecting its rarity\'s worth: Common 3, Uncommon 5, Rare 10, Epic 15 and Legendary 20. A shiny unlocks it on that pull.'],
    ['Si ya tienes un Pokémon y aún puede subir, la tirada sigue dando fragmentos de su línea. Al tope de vida, ataque y velocidad, da Pokémonedas. El gacha no da tickets: esos se consiguen jugando.',
     'Once you own a Pokémon and it can still grow, the pull keeps giving fragments of its line. At the HP, attack and speed cap, it gives PokéCoins. The gacha does not give tickets: those are earned by playing.'],
    ['Subir vida, ataque o velocidad gasta fragmentos de la línea. Cuesta 10 al empezar y sube de 10 en 10 según lo cerca que estés del máximo: a mitad de camino 60, y 100 en el último tramo. En la ficha se ven con una pieza de puzle. Ya no se cambian por tickets.',
     'Raising HP, attack or speed spends line fragments. It costs 10 at the start and goes up by 10 the closer you are to the cap: 60 at the halfway point, and 100 on the last stretch. The page shows them as a puzzle piece. They can no longer be converted into tickets.'],
    ['Oleadas por etapas: al empezar salen básicos, desde el minuto 3 las segundas evoluciones y desde el minuto 8 las formas finales.',
     'Waves by stage: basics at the start, second evolutions from minute 3 and final forms from minute 8.'],
    ['Piedra Evolución: sale al 0,01% en cofres y jefes, y ocupa un hueco aparte del objeto. Un básico puede evolucionar desde el nivel 65 y una segunda etapa desde el 135. Si hay varias formas, como Eevee, la carta solo dice Evolucionar y la forma sale al azar.',
     'Evolution Stone: a 0.01% drop from chests and bosses, in its own slot besides your item. A basic can evolve from level 65 and a second stage from level 135. If there are several forms, like Eevee, the card only says Evolve and the form is random.'],
    ['Los fragmentos son de la línea evolutiva, como en Pokémon GO. Un básico da ×1, la segunda evolución ×2 y la tercera ×3. Se comparten entre todas las formas de esa línea.',
     'Fragments belong to the evolution line, as in Pokémon GO. A basic gives ×1, the second evolution ×2 and the third ×3. Every form in that line shares them.'],
    ['Al minuto 25 de una partida se abre una grieta con Articuno.',
     'At minute 25 of a run, a rift opens with Articuno.'],
    ['El ticket azul hace una tirada ×10, como el morado, y se ve del mismo tamaño.',
     'The blue ticket does a ×10 pull, like the purple one, and shows at the same size.'],
    ['Oleadas y jefes: en una partida sólo salen Pokémon de las regiones que tengas abiertas. Los legendarios de las grietas, también.',
     'Waves and bosses: a run only spawns Pokémon from the regions you have open. Rift legendaries do too.'],
    ['En la ficha de un Pokémon, al tocar un movimiento se ven sus datos (daño, recarga y el resto) y qué hace, justo encima del botón de compañero.',
     'On a Pokémon\'s page, tapping a move shows its stats (damage, cooldown and the rest) and what it does, right above the partner button.'],
    ['Los jefes pegan más fuerte según avanza la partida. Al minuto 3 su vida y su daño van por ×1,8, al minuto 9 por ×3,5 y al minuto 15 por ×5,1. En una grieta, el legendario también crece más deprisa con el reloj.',
     'Bosses hit harder as the run goes on. At minute 3 their HP and damage are about ×1.8, at minute 9 ×3.5 and at minute 15 ×5.1. In a rift, the legendary also grows faster with the clock.'],
    ['Al empezar eliges a tu compañero entre Bulbasaur, Squirtle y Charmander. Ya no hay test de personalidad.',
     'When you start, you pick your partner from Bulbasaur, Squirtle and Charmander. There is no personality test.'],
    ['Si evolucionas en una partida, esa forma entra en la pokédex. Si ibas shiny, también entra su versión shiny.',
     'If you evolve during a run, that form joins your Pokédex. If you were shiny, its shiny form joins too.'],
    ['En el menú, entre Gacha y Misiones, hay Objetos: qué hace cada uno y el porcentaje de que caiga en un cofre pequeño, un cofre grande o un jefe.',
     'In the menu, between Gacha and Missions, there is Items: what each one does and its chance to drop from a small chest, a big chest or a boss.'],
    ['Fortuna de tickets: hasta 10 niveles. Cada uno suma 2% al ticket gris, 0,1% al morado, 0,05% al azul y 0,001% al dorado, en cofres y jefes. No cambia lo que suelta cada Pokémon derrotado.',
     'Ticket fortune: up to 10 levels. Each adds 2% to grey tickets, 0.1% to purple, 0.05% to blue and 0.001% to gold, from chests and bosses. It does not change what each defeated Pokémon drops.'],
    ['Cascabel Concha: ya no cura con el daño. Da un escudo de hasta el 25% de tu vida, que se recarga un 1% por segundo. La barra va encima de la de vida y el escudo absorbe el golpe antes.',
     'Shell Bell: it no longer heals from damage. It gives a shield of up to 25% of your HP, which refills 1% per second. The bar sits above the HP bar, and the shield takes the hit first.'],
    ['Garra Sangrienta: recuperas 3 de vida por cada golpe, hasta 12 por segundo.',
     'Bloody Claw: you recover 3 HP per hit, up to 12 per second.'],
    ['Amuleto Suerte: al recoger un ticket, un 1% de que cuente por dos del mismo color.',
     'Lucky Charm: when you pick up a ticket, a 1% chance it counts as two of the same color.'],
    ['Rapidez para abrir cofres: 5 niveles. El cofre con candado tarda 3,5 s y cada nivel lo recorta 1, 1,25, 1,75, 2,25 o 3,25 s.',
     'Chest opening speed: 5 levels. A locked chest takes 3.5 s, and each level cuts that by 1, 1.25, 1.75, 2.25 or 3.25 s.'],
    ['Torres: 100 oleadas dentro de una grieta, la primera al entrar y luego una cada 10 segundos aunque queden Pokémon vivos. La Sala de Kanto es una montaña: al entrar sale Articuno, Zapdos o Moltres, de los que ya hayas vencido, y esa torre trae más Pokémon de su tipo. Mew y Mewtwo tienen la suya. La entrada son 3000 Pokémonedas, a partes iguales si vais en grupo. Al ganar, si no lo tienes hay un 25% de atraparlo; si ya lo tienes, da de 25 a 50 fragmentos. El jefe puede salir shiny (1/1024). Las mejoras suben la dificultad. El jefe sale en las oleadas 25, 50, 75 y 100. Cada vez que lo derrotas, fusionas un movimiento. Lleva un escudo.',
     'Towers: 100 waves inside a rift, the first as you enter and then one every 10 seconds even if Pokémon are still alive. Kanto Hall is a mountain: on entry it is Articuno, Zapdos or Moltres, among those you have already beaten, and that tower brings more Pokémon of its type. Mew and Mewtwo have their own. Entry is 3000 PokéCoins, split evenly if you go as a group. On a clear, if you do not own it there is a 25% chance to catch it; if you do, it gives 25 to 50 fragments. The boss can be shiny (1/1024). Upgrades raise the difficulty. The boss appears on waves 25, 50, 75 and 100. Each time you defeat it, you fuse a move. It has a shield.']
  ], chg: [
    ['Cooperativo: las salas admiten hasta 8 jugadores.',
     'Co-op: rooms allow up to 8 players.'],
    ['El ticket azul tira ×10, como el morado, y las pokébolas de la tragaperras salen del mismo tamaño.',
     'The blue ticket pulls ×10, like the purple one, and the slot-machine Poké Balls come out the same size.'],
    ['Las cantidades grandes se acortan: hasta 99.999 se ven enteras, de 100.000 a 9.999.999 como 100k–9.999k, de 10.000.000 a 9.999.999.999 como 10m–9.999m, y a partir de 10.000.000.000 como 10b.',
     'Big amounts are shortened: up to 99,999 in full, 100,000 to 9,999,999 as 100k–9,999k, 10,000,000 to 9,999,999,999 as 10m–9,999m, and from 10,000,000,000 as 10b.'],
    ['Desbloquear cuesta menos fragmentos: Común 3, Poco común 5, Rara 10 y Épica 15. La legendaria pasa a 20.',
     'Unlocking costs fewer fragments: Common 3, Uncommon 5, Rare 10 and Epic 15. Legendary goes to 20.'],
    ['En el resultado de una tirada, cada Pokémon muestra los fragmentos que dio en esa tirada. Sólo entra en la pokédex, con la palabra Capturado, cuando la línea junta los fragmentos de su rareza.',
     'On a pull result, each Pokémon shows the fragments it gave on that pull. It joins the Pokédex, marked Caught, only when the line has that rarity\'s fragments.'],
    ['Mejoras: nuevos máximos (Vitalidad y Fuerza 40, Coraza 40, Sabiduría 40, Golpe crítico 40, Fortuna 20, Imán 12, Síntesis 10, Zancada y Reflejos 8, Cambio de cartas 6, Veto 3, Repertorio 1). Imán da 8% por nivel, Sabiduría 2%, Fortuna 5% y Golpe crítico 1,5%.',
     'Upgrades: new caps (Vitality and Strength 40, Armor 40, Wisdom 40, Critical Hit 40, Fortune 20, Magnet 12, Synthesis 10, Stride and Reflexes 8, Reroll 6, Ban 3, Repertoire 1). Magnet gives 8% per level, Wisdom 2%, Fortune 5% and Critical Hit 1.5%.'],
    ['Tickets del gacha: gris, morado, azul y dorado, cada uno con sus probabilidades. El azul tira ×5 y el dorado ×1, y siempre es shiny. En la partida caen de los Pokémon, los cofres y los jefes.',
     'Gacha tickets: grey, purple, blue and gold, each with its own odds. Blue pulls ×5 and gold pulls ×1, and is always shiny. In a run they drop from Pokémon, chests and bosses.'],
    ['Los tickets caen menos: el cofre pequeño da menos morados y azules, y cada Pokémon derrotado casi no suelta tickets. Los jefes de la run y de la grieta siguen igual.',
     'Tickets drop less often: small chests give fewer purple and blue ones, and each defeated Pokémon almost never drops a ticket. Run bosses and rift bosses stay the same.'],
    ['Ya no hay comprobaciones contra trampas: todas las partidas cuentan para el ranking y los récords, y no se pierde nada de lo ganado.',
     'No more anti-cheat checks: every run counts for the leaderboard and your records, and nothing you earn is taken away.']
  ] },
  { d: '2026-10-12', title: ['Tiempo extra y grietas con menos azar', 'Overtime and less random rifts'], new: [
    ['Tiempo extra: desde el minuto 60 los Pokémon salvajes se vuelven cada vez más fuertes (más vida y más daño), y cada vez más deprisa. Antes, con las mejoras al máximo, algunas partidas no acababan nunca; ahora las mejores rondarán la hora y media.',
     'Overtime: from minute 60 on, wild Pokémon keep getting stronger (more HP and more damage), faster and faster. Before, with maxed upgrades, some runs never ended; now the best ones will last about an hour and a half.'],
    ['El juego se actualiza solo cuando sale una versión nueva: si estás en el menú, a los 5 segundos; si estás jugando, al acabar la partida (sin perder nada).',
     'The game now updates itself when a new version is out: within 5 seconds if you are in the menu, or after your run if you are playing (without losing anything).'],
    ['Botón de Novedades (esta ventana) con todos los cambios del juego.',
     'A "What\'s new" button (this window) with every change to the game.'],
    ['Números más fáciles de leer: el 2, el 5 y el 8 ya no se confunden.',
     'Easier to read numbers: 2, 5 and 8 no longer look alike.'],
    ['Elige la versión normal o shiny de tu compañero desde el menú principal, debajo de él.',
     'Pick the normal or shiny version of your partner right from the main menu, under it.'],
    ['Mejoras nuevas para cada Pokémon: Golpe Crítico (+3 % de críticos por nivel, que hacen x1,5 de daño), Cambio de cartas (+1 cambio de las cartas de nivel por run) y Veto (bloquea movimientos para que no te salgan en las cartas; se eligen en Mejoras).',
     'New upgrades for each Pokémon: Critical Hit (+3% critical chance per level, crits deal x1.5 damage), Card reroll (+1 level-up card reroll per run) and Ban (block moves so they never show up in your cards; pick them in Upgrades).'],
    ['Atajos de movimientos (en Mejoras, para cada Pokémon): elige qué movimiento va siempre en cada hueco, por ejemplo Confusión siempre en el 1, para la memoria muscular.',
     'Move shortcuts (in Upgrades, for each Pokémon): choose which move always goes in each slot, for example Confusion always on 1, for muscle memory.'],
    ['Durante la partida, a la izquierda, se ve cuántas veces has cogido cada carta de mejora (Potencia, Aprendizaje y el resto).',
     'During a run, the left side shows how many times you have picked each upgrade card (Power, Learning and the rest).']
  ], chg: [
    ['Las mejoras permanentes tienen el doble de niveles (Vitalidad pasa de 10 a 20, y el resto igual). Cada nivel nuevo da lo mismo que los de antes y cuesta según la misma curva.',
     'Permanent upgrades have twice as many levels (Vitality goes from 10 to 20, and the rest the same way). Each new level gives the same bonus as before and costs along the same curve.'],
    ['Avalancha hace menos daño (21 en vez de 26): derrotaba casi el doble que la media de los movimientos.',
     'Rock Slide deals less damage (21 instead of 26): it defeated almost twice as many as the average move.'],
    ['Los cambios de cartas de nivel ya no se ganan venciendo jefes: tienes 1 gratis por run y el resto se compra en Mejoras.',
     'Level-up card rerolls are no longer earned by defeating bosses: you get 1 free per run and can buy more in Upgrades.'],
    ['Los legendarios de grieta ya no dan siempre tickets x10: dan uno la mitad de las veces (antes daban 2 siempre y salían demasiados).',
     'Rift legendaries no longer always drop x10 tickets: they drop one half of the time (they used to always drop 2, which was too many).'],
    ['Cooperativo: si vuestras redes no consiguen conectar entre sí, la sala lo avisa y lo reintenta sola, en vez de jugar a tirones por un servidor lento.',
     'Co-op: if your networks cannot connect to each other, the room says so and keeps retrying, instead of playing laggy through a slow server.'],
    ['Hemos cambiado de servidores para que el juego siga siendo gratis: puede que tengas que volver a iniciar sesión (con la misma cuenta y contraseña, o con Google). Tu partida y tus Pokémon siguen igual.',
     'We moved to new servers so the game can stay free: you may need to sign in again (with the same account and password, or with Google). Your save and your Pokémon are unchanged.'],
    ['Gacha: los shiny ya no salen repetidos. Si te toca uno que ya tienes, sale otro de la misma rareza que te falte.',
     'Gacha: shinies no longer come out as duplicates. If you roll one you already have, you get another of the same rarity that you are missing.'],
    ['Grietas con menos azar: cada vez que no sale una, la siguiente es más probable (como mucho 2,5 minutos sin grieta).',
     'Less random rifts: every time one does not show up, the next one is more likely (at most 2.5 minutes without a rift).'],
    ['Los legendarios que aún no has vencido salen 4 veces más en las grietas.',
     'Legendaries you have not beaten yet show up 4 times as often in rifts.'],
    ['Los curanderos curan más cuanto más fuerte pegas, pero cada vez menos y con un tope (como mucho el 2,5x).',
     'Healers heal more the harder you hit, but with diminishing returns and a cap (2.5x at most).'],
    ['Ataques cuerpo a cuerpo más fuertes: mientras llevas uno activo recibes un 25 % menos de daño, llegan un 25 % más lejos y hacen un 20 % más de daño.',
     'Stronger melee attacks: while one is active you take 25% less damage, and they reach 25% further and deal 20% more damage.'],
    ['Cooperativo: al elegir con qué objeto quedarte, la partida se para para todos (antes seguía y te pegaban mientras elegías).',
     'Co-op: choosing which held item to keep now pauses the run for everyone (it used to keep going and you got hit while choosing).'],
    ['Cooperativo: mientras alguien elige una fusión, la partida se para para todos.',
     'Co-op: while someone is choosing a fusion, the run pauses for everyone.'],
    ['Cooperativo: si el anfitrión cambia de pestaña o se le para el juego, la partida se pausa para todos hasta que vuelva.',
     'Co-op: if the host switches tabs or their game stalls, the run pauses for everyone until they are back.'],
    ['Las runs de menos de 1 minuto ya no cuentan para el ranking.',
     'Runs shorter than 1 minute no longer count for the leaderboard.']
  ], fix: [
    ['Quitadas del ranking las marcas rotas por el fallo del minuto 84 (el reloj seguía corriendo con el juego parado) y alguna imposible. Si tenías una, tu próxima partida vuelve a contar.',
     'Removed broken records from the leaderboard caused by the minute 84 bug (the clock kept running while the game was frozen) and a few impossible ones. If you had one, your next run counts again.'],
    ['iPhone (Safari y Chrome): a veces no se podía cambiar de movimiento tocando los iconos, sobre todo con el otro dedo en el joystick. Además los botones quedan por encima de la barra de inicio.',
     'iPhone (Safari and Chrome): sometimes you could not switch moves by tapping the icons, especially with your other finger on the joystick. Buttons also sit above the home bar now.'],
    ['En las partidas de más de 84 minutos la pantalla se quedaba en negro, el juego se paraba o empezabas a subir de nivel sin fin. Ya puedes jugar todo lo que aguantes.',
     'In runs longer than 84 minutes the screen went black, the game froze or you kept levelling up forever. Now you can play for as long as you survive.'],
    ['Si el juego fallara, la partida se cierra sola y se guarda (tiempo, derrotados, récords y ranking) en vez de perderse.',
     'If the game ever crashes, the run ends by itself and is saved (time, defeated, records and leaderboard) instead of being lost.'],
    ['Las partidas muy largas a veces se tomaban por trampas y no contaban para el ranking.',
     'Very long runs were sometimes flagged as cheating and did not count for the leaderboard.'],
    ['Cooperativo: si el anfitrión cambiaba de pestaña, los enemigos se quedaban quietos y los demás jugaban con ventaja.',
     'Co-op: if the host switched tabs, enemies stood still and everyone else got a free advantage.'],
    ['iPhone: mantener el dedo en el joystick sacaba "Copiar / Seleccionar todo".',
     'iPhone: holding your finger on the joystick brought up "Copy / Select all".'],
    ['iPhone: a veces no salía la pantalla completa. Ahora el botón explica cómo tenerla (Compartir y "Añadir a pantalla de inicio").',
     'iPhone: fullscreen sometimes did not show up. Now the button explains how to get it (Share and "Add to Home Screen").']
  ] },
  { d: '2026-10-11', title: ['Vínculos', 'Bonds'], new: [
    ['Vínculos: al vencer a un legendario fusionas movimientos que se lanzan a la vez desde un solo hueco (hasta 4).',
     'Bonds: defeating a legendary lets you fuse moves that fire at the same time from a single slot (up to 4).'],
    ['Botón para cambiar las cartas de subir de nivel.',
     'A button to reroll the level-up cards.']
  ], chg: [
    ['Más grietas.', 'More rifts.'],
    ['Movimientos psíquicos y curanderos más flojos.', 'Weaker psychic moves and healers.'],
    ['Las mejoras de las cartas de nivel (velocidad, recarga, experiencia, imán, coraza y potencia) tienen un tope de veces.',
     'Level-up card upgrades (speed, cooldown, experience, magnet, armor and power) can only be taken a limited number of times.'],
    ['En el móvil, la ficha del Pokémon sale al lado; entrar es más rápido y el gacha x10 se puede cerrar.',
     'On mobile, the Pokémon details show alongside; logging in is faster and the x10 gacha can be closed.']
  ], fix: [
    ['Pantalla negra en partidas de más de una hora por llenarse la memoria de imágenes.',
     'Black screen in runs longer than an hour because image memory filled up.'],
    ['Los tickets se perdían si se cerraba la pestaña antes de acabar la partida: ahora se guardan al cogerlos.',
     'Tickets were lost if the tab closed before the run ended: now they are saved as soon as you pick them up.'],
    ['Una mejora comprada justo después de guardar se cobraba y no se apuntaba.',
     'An upgrade bought right after saving was charged but not applied.'],
    ['El juego se quedaba congelado para siempre si algo fallaba a mitad de partida.',
     'The game froze forever if something went wrong mid-run.']
  ] },
  { d: '2026-10-10', title: ['Más reto', 'More challenge'], new: [
    ['Jefes y legendarios con 4 ataques avisados que se enfurecen a media vida.',
     'Bosses and legendaries with 4 telegraphed attacks that get enraged at half health.'],
    ['12 movimientos nuevos y 8 formas de atacar nuevas: bumerán, cadena, minas, meteoros, torreta, embestida, rastro y abanico.',
     '12 new moves and 8 new ways to attack: boomerang, chain, mines, meteors, turret, dash, trail and spray.'],
    ['Eventos a mitad de partida (hordas de un tipo, hora dorada, Pokémon perdidos) y Meowth y Gholdengo que huyen cargados de monedas.',
     'Mid-run events (single-type hordes, golden hour, lost Pokémon) and Meowth and Gholdengo running away loaded with coins.'],
    ['Estatuas para los Pokémon grandes.', 'Statues for big Pokémon.']
  ], chg: [
    ['Más difícil: menos enemigos pero más duros.', 'Harder: fewer but tougher enemies.'],
    ['Subir de nivel es más lento, los tickets son más raros y los jefes dan ticket x10 una de cada tres veces.',
     'Levelling up is slower, tickets are rarer and bosses drop a x10 ticket one time in three.'],
    ['Carga más rápida.', 'Faster loading.']
  ], fix: [
    ['Los enemigos rezagados desaparecían delante de ti: ahora sólo fuera de la vista.',
     'Straggling enemies vanished in front of you: now only off-screen.'],
    ['Los menús y pantallas se montaban encima de la barra de arriba.',
     'Menus and screens overlapped the top bar.']
  ] },
  { d: '2026-10-09', title: ['Móvil e inglés', 'Mobile and English'], new: [
    ['Se puede jugar en móvil y tablet con joystick táctil, e instalar como app.',
     'Play on phones and tablets with a touch joystick, and install it as an app.'],
    ['El juego, en español y en inglés.', 'The game in English and Spanish.'],
    ['Pantalla de ajustes con calidad gráfica automática.', 'Settings screen with automatic graphics quality.']
  ], chg: [
    ['Menos enemigos en pantalla pero más fuertes.', 'Fewer but stronger enemies on screen.'],
    ['Gigadrenado pasa a ser Hierba Lazo (ya no cura).', 'Giga Drain becomes Grass Knot (no more healing).']
  ] },
  { d: '2026-10-08', title: ['Misiones, grietas y cooperativo', 'Missions, rifts and co-op'], new: [
    ['Misiones diarias y semanales, logros con medallas y títulos, y perfil público.',
     'Daily and weekly missions, achievements with medals and titles, and a public profile.'],
    ['Objetos equipables, evoluciones de movimientos y enemigos que curan, protegen, invocan o explotan.',
     'Held items, move evolutions and enemies that heal, shield, summon or explode.'],
    ['Grietas que llevan a 18 arenas legendarias, una por tipo, y clima que cambia la batalla.',
     'Rifts leading to 18 legendary arenas, one per type, and weather that changes the fight.'],
    ['Cooperativo con tu lista de amigos y ranking.', 'Co-op with your friends list and leaderboards.'],
    ['Mejoras para cada Pokémon, gacha tragaperras con tickets y tabla de tipos.',
     'Upgrades for each Pokémon, a slot-machine ticket gacha and a type chart.']
  ], chg: [
    ['Cámara más lejos y enemigos que rodean los obstáculos.', 'Camera further out and enemies that walk around obstacles.']
  ] },
  { d: '2026-10-07', title: ['Primera versión', 'First version'], new: [
    ['Primera versión pública de PokéSurvivor.', 'First public version of PokéSurvivor.']
  ] }
];
