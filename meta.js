'use strict';
/* =========================================================
   Meta-Fortschritt: Credits, Freischaltungen, Erfolge,
   Highscores, Tages-Seed
   ========================================================= */

/* ---------------- Zufall (für die tägliche Herausforderung seedbar) ---------------- */
let rng = Math.random;
function seedRng(seed) {
  let a = seed >>> 0;
  rng = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rrand = (a, b) => a + rng() * (b - a);
const rpick = arr => arr[Math.floor(rng() * arr.length)];
function rshuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todaySeed() { return parseInt(todayKey().replace(/-/g, ''), 10); }

/* ---------------- Inhalte ---------------- */
const SHIPS = {
  falke:   { name: 'Falke', icon: '➤', desc: 'Schnell und wendig, aber zerbrechlich.', hp: 4, speed: 340, fireDelay: 0.15, dmg: 1, shield: 0, drones: 0, cost: 0 },
  bastion: { name: 'Bastion', icon: '⬣', desc: 'Schwer gepanzert, mehr Schaden, startet mit Schild. Langsam.', hp: 8, speed: 250, fireDelay: 0.2, dmg: 1.25, shield: 1, drones: 0, cost: 300 },
  wisp:    { name: 'Wisp', icon: '✧', desc: 'Support-Schiff mit zwei Begleitdrohnen.', hp: 5, speed: 300, fireDelay: 0.18, dmg: 0.9, shield: 0, drones: 2, cost: 500 },
};
const ULTS = {
  nova:      { name: 'Nova', icon: '◎', desc: 'Druckwelle: löscht Geschosse und trifft alle im Umkreis.', cost: 0 },
  blackhole: { name: 'Schwarzes Loch', icon: '●', desc: 'Zieht Gegner zusammen, saugt Geschosse auf und zerreißt alles im Sog.', cost: 400 },
  laser:     { name: 'Orbitallaser', icon: '║', desc: 'Ein gewaltiger Strahl fegt in einem Bogen über das Schlachtfeld.', cost: 600 },
  swarm:     { name: 'Drohnenschwarm', icon: '✺', desc: 'Eine Salve selbstzielender Raketen jagt alle Gegner.', cost: 800 },
};
const HULLS = [
  { id: 'std',    name: 'Standard',  dark: '#7f95c9', main: '#eef4ff', accent: '#2f6bff', flame: '#7fd4ff' },
  { id: 'gold',   name: 'Gold',      dark: '#b8860b', main: '#fff1b8', accent: '#e0a100', flame: '#ffd35a' },
  { id: 'violet', name: 'Violett',   dark: '#6a4cb8', main: '#efe2ff', accent: '#9b59ff', flame: '#c9a2ff' },
  { id: 'ember',  name: 'Glut',      dark: '#a8431c', main: '#ffe3d1', accent: '#ff6a1f', flame: '#ffa24a' },
  { id: 'mint',   name: 'Minze',     dark: '#2f8a6a', main: '#e0fff3', accent: '#1fd18f', flame: '#7dffcf' },
  { id: 'white',  name: 'Weiß',      dark: '#9aa4b5', main: '#ffffff', accent: '#8892a6', flame: '#ffffff' },
  { id: 'crimson',name: 'Karmesin',  dark: '#8a1c33', main: '#ffd9e0', accent: '#ff2a55', flame: '#ff6a85' },
  { id: 'ice',    name: 'Eis',       dark: '#4a8fc7', main: '#eafaff', accent: '#37c3ff', flame: '#aeeaff' },
  { id: 'solar',  name: 'Solar',     dark: '#c27a00', main: '#fffbe0', accent: '#ffcf1f', flame: '#fff08a' },
  { id: 'neon',   name: 'Neon',      dark: '#1a1a2e', main: '#d6ffe9', accent: '#00ffa3', flame: '#00ffa3' },
  { id: 'sunset', name: 'Abendrot',  dark: '#b0407a', main: '#ffe6d6', accent: '#ff7a59', flame: '#ffb199' },
  { id: 'chrome', name: 'Chrom',     dark: '#5d6674', main: '#f4f7fb', accent: '#c0c8d4', flame: '#dfe6f0' },
  { id: 'void',   name: 'Leere',     dark: '#161226', main: '#c9c0e8', accent: '#6a3dff', flame: '#9d7bff' },
];
const PERMS = [
  { id: 'hp',   name: 'Verstärkter Rumpf', desc: '+1 Start-Leben', costs: [150, 300, 500] },
  { id: 'dmg',  name: 'Waffen-Tuning', desc: '+6% Schaden von Anfang an', costs: [100, 200, 300, 400, 500] },
  { id: 'ult',  name: 'Vorgeladene Zelle', desc: 'Ultimate startet zu 25% geladen', costs: [200, 350, 500] },
  { id: 'loot', name: 'Bergungsrechte', desc: '+15% Credits pro Lauf', costs: [150, 300, 450] },
];
const ACH = [
  { id: 'first_boss', name: 'Erstes Blut', desc: 'Besiege einen Boss.', hull: 'gold' },
  { id: 'phantom', name: 'Geisterjäger', desc: 'Besiege das Phantom.', hull: 'violet' },
  { id: 'duo', name: 'Feuer und Eis', desc: 'Besiege Ignis & Glacies.', hull: 'ember' },
  { id: 'trio', name: 'Ordnung muss sein', desc: 'Besiege die Triarchie.', hull: 'mint' },
  { id: 'nohit', name: 'Unberührbar', desc: 'Besiege einen Boss, ohne Schaden zu nehmen.', hull: 'white' },
  { id: 'score10k', name: 'Fünfstellig', desc: 'Erreiche 10.000 Punkte in einem Lauf.', hull: 'crimson' },
  { id: 'ultmaster', name: 'Knopfdrücker', desc: 'Nutze das Ultimate 10× in einem Lauf.', hull: 'ice' },
  { id: 'maxperk', name: 'Volltreffer', desc: 'Bringe ein Upgrade auf die Maximalstufe.', hull: 'solar' },
  { id: 'synergy', name: 'Das passt!', desc: 'Aktiviere eine Synergie.', hull: 'neon' },
  { id: 'combo', name: 'Kettenreaktion', desc: 'Erreiche einen Kombo-Multiplikator von ×5.', hull: 'sunset' },
  { id: 'rush5', name: 'Bosssprint', desc: 'Besiege 5 Bosse im Boss Rush.', hull: 'chrome' },
  { id: 'endless', name: 'Chaos-Pilot', desc: 'Überlebe einen Modifikator im Endlos-Modus.', hull: 'void' },
];

/* ---------------- Speicher ---------------- */
const META_KEY = 'julshot_meta_v1';
function defaultMeta() {
  return {
    credits: 0, perm: { hp: 0, dmg: 0, ult: 0, loot: 0 },
    ships: ['falke'], ults: ['nova'], hulls: ['std'], ach: {},
    sel: { ship: 'falke', ult: 'nova', hull: 'std' },
    stats: { runs: 0, bosses: 0 },
  };
}
function loadMeta() {
  const d = defaultMeta();
  try {
    const m = JSON.parse(localStorage.getItem(META_KEY) || 'null');
    if (m && typeof m === 'object') {
      return Object.assign(d, m, { perm: Object.assign(d.perm, m.perm), sel: Object.assign(d.sel, m.sel), stats: Object.assign(d.stats, m.stats) });
    }
  } catch (e) { /* ignorieren */ }
  return d;
}
let meta = loadMeta();
function saveMeta() { try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) { /* ignorieren */ } }

/* ---------------- Toasts ---------------- */
let toastQ = [], toastBusy = false;
function toast(title, sub, cls) {
  toastQ.push({ title, sub, cls });
  if (!toastBusy) nextToast();
}
function nextToast() {
  const el = document.getElementById('toast');
  const t = toastQ.shift();
  if (!el || !t) { toastBusy = false; return; }
  toastBusy = true;
  el.className = 'toast show ' + (t.cls || '');
  el.innerHTML = '';
  const a = document.createElement('div'); a.className = 'tt'; a.textContent = t.title;
  const b = document.createElement('div'); b.className = 'ts'; b.textContent = t.sub || '';
  el.append(a, b);
  setTimeout(() => { el.className = 'toast'; setTimeout(nextToast, 250); }, 2600);
}

/* ---------------- Erfolge ---------------- */
function ach(id) {
  if (meta.ach[id]) return;
  const a = ACH.find(x => x.id === id);
  if (!a) return;
  meta.ach[id] = Date.now();
  if (a.hull && !meta.hulls.includes(a.hull)) meta.hulls.push(a.hull);
  saveMeta();
  toast('Erfolg: ' + a.name, a.desc + (a.hull ? ' · Neuer Anstrich freigeschaltet' : ''), 'gold');
  if (typeof sfx === 'function') sfx('ach');
}

/* ---------------- Modi & Highscores ---------------- */
const MODES = { endless: 'Endlos', rush: 'Boss Rush', daily: 'Täglich' };
let gameMode = 'endless';
function scoreKey(mode) {
  if (mode === 'rush') return 'julshot_scores_rush';
  if (mode === 'daily') return 'julshot_daily_' + todayKey();
  return 'julshot_scores_v1';
}
function loadScores(mode) {
  try {
    const s = JSON.parse(localStorage.getItem(scoreKey(mode || gameMode)) || '[]');
    return Array.isArray(s) ? s : [];
  } catch (e) { return []; }
}
function saveScore(name, score, stage) {
  const list = loadScores(gameMode);
  const entry = { name: name || 'Pilot', score, stage, t: Date.now() };
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const top = list.slice(0, 10);
  try { localStorage.setItem(scoreKey(gameMode), JSON.stringify(top)); } catch (e) { /* ignorieren */ }
  cachedBest = null;
  if (typeof onlinePost === 'function') onlinePost(gameMode, entry);
  return top.includes(entry) ? entry.t : null;
}
function renderScores(table, highlightT, mode) {
  fillScoreTable(table, loadScores(mode || gameMode), highlightT);
}
function fillScoreTable(table, list, highlightT) {
  table.innerHTML = '';
  const head = document.createElement('tr');
  head.innerHTML = '<th>#</th><th>Name</th><th>Punkte</th><th>Stufe</th>';
  table.appendChild(head);
  if (!list.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="4" class="empty">Noch keine Einträge – sei der Erste!</td>';
    table.appendChild(tr);
    return;
  }
  list.forEach((s, i) => {
    const tr = document.createElement('tr');
    if (highlightT && s.t === highlightT) tr.className = 'me';
    for (const c of [i + 1, s.name, s.score.toLocaleString('de-DE'), s.stage || '-']) {
      const td = document.createElement('td');
      td.textContent = c;
      tr.appendChild(td);
    }
    table.appendChild(tr);
  });
}
let cachedBest = null;
function bestScore() {
  if (cachedBest === null) { const l = loadScores(gameMode); cachedBest = l.length ? l[0].score : 0; }
  return cachedBest;
}
