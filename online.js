'use strict';
/* =========================================================
   Optionale Online-Bestenliste. Läuft nur, wenn die Seite als
   Claude-Artefakt mit der "db"-Fähigkeit geöffnet wird; sonst
   passiert hier nichts und das Spiel nutzt nur lokale Scores.
   ========================================================= */
let onlineDb = null;
const onlineCollection = mode => 'scores_' + (mode === 'daily' ? 'daily_' + todayKey() : mode);

(async () => {
  try {
    if (window.claude && typeof window.claude.use === 'function') onlineDb = await window.claude.use('db');
  } catch (e) { onlineDb = null; }
  if (onlineDb && typeof renderMenu === 'function' && state === 'menu') renderMenu();
})();

function onlinePost(mode, entry) {
  if (!onlineDb) return;
  try {
    onlineDb.collection(onlineCollection(mode))
      .add({ name: String(entry.name).slice(0, 12), score: entry.score, stage: String(entry.stage || ''), t: entry.t })
      .catch(() => { /* kein Schreibrecht: lokal bleibt der Eintrag trotzdem */ });
  } catch (e) { /* ignorieren */ }
}

async function renderOnlineScores(table, mode) {
  table.innerHTML = '<tr><td colspan="4" class="empty">Lade Online-Bestenliste …</td></tr>';
  try {
    const snap = await onlineDb.collection(onlineCollection(mode)).orderBy('score', 'desc').limit(10).get();
    fillScoreTable(table, snap.docs.map(d => d.data()), null);
  } catch (e) {
    table.innerHTML = '<tr><td colspan="4" class="empty">Online-Bestenliste nicht erreichbar.</td></tr>';
  }
}
