/* ============ admin.js — borrar cuentas, solo el apodo asus27 ============
 * En Ajustes → Cuenta, con dev.html. Deja la cuenta como recién empezada:
 * solo Bulbasaur, sin oro de más, tickets, logros ni misiones.
 * Este archivo no se publica (está en .gitignore).
 */
G.Admin = (() => {
  const NICK = 'asus27';
  let saw = false;

  function nick() {
    const me = G.Social && G.Social.me;
    return String(me && me.name || '').trim().toLowerCase();
  }
  function allowed() { return nick() === NICK && !!(G.DB && G.DB.online); }

  function form() {
    return `<h3 class="set-h">Borrar una cuenta</h3>
      <p class="sub">Escribe el apodo. Se borra todo su progreso y se queda solo con Bulbasaur, como si acabara de empezar. No se puede deshacer.</p>
      <div class="row wrap" style="gap:8px">
        <input id="adm-nick" maxlength="16" placeholder="Apodo a borrar" autocomplete="off" translate="no" style="flex:1;min-width:140px">
        <button type="button" class="btn danger" id="adm-del">Borrar</button>
      </div>
      <p class="note" id="adm-msg"></p>`;
  }

  function say(box, text) {
    const n = box.querySelector('#adm-msg');
    if (n) n.textContent = text || '';
  }

  async function dropQuery(q) {
    const snap = await q.get();
    for (const d of snap.docs) await d.ref.delete();
  }

  /** Quita una fila del resumen. Las reglas solo dejan sacar una cada vez. */
  async function pullRows(fs, uid) {
    const boards = await fs.collection('lbs').get();
    for (const s of boards.docs) {
      const ids = Object.keys(s.data().top || {}).filter(id => {
        const row = s.data().top[id] || {};
        return id === uid || (row.uids || []).includes(uid);
      });
      for (const id of ids) {
        await fs.runTransaction(async tx => {
          const cur = await tx.get(s.ref);
          if (!cur.exists) return;
          const top = Object.assign({}, cur.data().top || {});
          if (!top[id]) return;
          delete top[id];
          tx.set(s.ref, { top, me: '', ev: id });
        });
      }
    }
  }

  async function run(box) {
    if (!allowed()) return;
    const fb = G.DB.fb;
    const input = box.querySelector('#adm-nick');
    const btn = box.querySelector('#adm-del');
    const name = String(input && input.value || '').trim();
    if (!fb) { say(box, 'No se pudo borrar.'); return; }
    if (!name) { say(box, 'Escribe el apodo.'); return; }
    if (name.toLowerCase() === NICK) { say(box, 'Esa cuenta no se borra desde aquí.'); return; }
    if (!confirm(G.I18n.f('Se borrará todo el progreso de {x}. Quedará solo con Bulbasaur. ¿Seguro?', name))) return;
    if (btn) btn.disabled = true;
    say(box, 'Borrando…');
    try {
      const fs = fb.fs;
      const nameDoc = await fs.collection('names').doc(name.toLowerCase()).get();
      if (!nameDoc.exists || !nameDoc.data().uid) throw Object.assign(new Error('No hay ninguna cuenta con ese apodo.'), { code: 'not-found' });
      const uid = nameDoc.data().uid;
      if (uid === fb.uid) throw Object.assign(new Error('Esa cuenta no se borra desde aquí.'), { code: 'failed-precondition' });
      const prof = await fs.collection('profiles').doc(uid).get();
      const shown = (prof.exists && prof.data().name) || name;
      await dropQuery(fs.collection('friendships').where('users', 'array-contains', uid));
      await dropQuery(fs.collection('inv').where('to', '==', uid));
      await dropQuery(fs.collection('inv').where('from', '==', uid));
      const now = Date.now();
      const stats = { runs: 0, bestTime: 0, bestLevel: 0, totalKills: 0, pulls: 0, coinsEarned: 0, shinies: 0,
        bossesTotal: 0, riftWins: 0, evolutions: 0, missionsDone: 0, groupRuns: 0, bestGroupTime: 0,
        shinyKills: 0, shinyBosses: 0, goldPulls: 0, ticketsGot: 0, bestKills: 0, bestBosses: 0, towerClears: 0, towerBest: 0 };
      const fresh = {
        v: 3, name: shown, created: now, updated: now, epoch: now,
        coins: G.DB.START_COINS || 500,
        owned: { 1: { at: now, from: 'starter' } }, shiny: {}, frags: {}, boost: {}, boostV: 1,
        partner: 1, partnerShiny: false, starter: 1, personality: null,
        upgrades: {}, pupg: {}, pupgDone: true, gupg: {}, gupgSplit: true,
        tickets: { t1: 0, t10: 0, tb: 0, tg: 0 }, pity: {},
        legends: {}, arenas: {}, itemsFound: {}, evoMoves: {}, ach: {}, achRank: {}, missions: {},
        region: 1, regionProg: 0, tower100: {}, towerMode: {},
        profile: { favs: [], title: '' }, stats
      };
      await fs.collection('saves').doc(uid).set({
        save: fresh, updatedAt: firebase.firestore.FieldValue.serverTimestamp(), v: 3
      });
      if (prof.exists) {
        await fs.collection('profiles').doc(uid).set({
          name: prof.data().name, lower: prof.data().lower,
          at: firebase.firestore.FieldValue.serverTimestamp(),
          favs: [], title: '', best: {}, medals: []
        });
      }
      await fs.collection('pres').doc(uid).delete().catch(() => {});
      await fs.collection('runs').doc(uid).delete().catch(() => {});
      try {
        await pullRows(fs, uid);
        await dropQuery(fs.collectionGroup('e').where('uids', 'array-contains', uid));
      } catch (e) { /* el ranking ya se quitó, o falta el índice */ }
      if (input) input.value = '';
      say(box, G.I18n.f('Listo: {x} empieza de cero, solo con Bulbasaur.', shown));
    } catch (e) {
      const code = e && (e.code || '');
      say(box, code === 'permission-denied' ? 'Hay que publicar las reglas de Firestore.' : ((e && e.message) || 'No se pudo borrar.'));
    }
    if (btn) btn.disabled = false;
  }

  function wire(box) {
    const b = box.querySelector('#adm-del');
    if (b) b.onclick = () => run(box);
  }

  function init() {
    const sync = () => {
      const now = allowed();
      if (now !== saw && G.SettingsUI && G.SettingsUI.isOpen) {
        saw = now;
        G.SettingsUI.open();
      } else saw = now;
    };
    if (G.Social) G.Social.on(sync);
    sync();
  }

  return { init, allowed, form, wire };
})();
