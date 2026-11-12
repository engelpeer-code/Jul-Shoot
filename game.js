'use strict';
/* =========================================================
   JUL SHOT – ein kleiner Weltraum-Shooter
   Steuerung: WASD fliegen, Maus zielen, Klick/Leertaste schießen, Q/Rechtsklick Ultimate
   ========================================================= */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1;   // W,H = Größe des Spielfelds (Weltkoordinaten)
let SW = 0, SH = 0;          // Größe des Bildschirms
let zoom = 1;                // Kamera-Zoom: kleiner = größeres Schlachtfeld
const ZOOM_TARGET = 0.7;     // Zoom nach dem ersten Phantom
function setZoom(z) { zoom = z; W = SW / z; H = SH / z; }

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  SW = window.innerWidth;
  SH = window.innerHeight;
  canvas.width = Math.floor(SW * DPR);
  canvas.height = Math.floor(SH * DPR);
  canvas.style.width = SW + 'px';
  canvas.style.height = SH + 'px';
  setZoom(zoom);
  initStars();
}

/* ---------------- Hilfsfunktionen ---------------- */
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;
const angTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
function segDist2(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const l = dx * dx + dy * dy;
  let t = l ? ((px - x1) * dx + (py - y1) * dy) / l : 0;
  t = clamp(t, 0, 1);
  return dist2(px, py, x1 + t * dx, y1 + t * dy);
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------------- Eingabe ---------------- */
const keys = {};
const mouse = { x: 0, y: 0, sx: 0, sy: 0, down: false }; // x,y = Weltkoordinaten, sx,sy = Bildschirm
let autoFire = false;

window.addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  onKey(e.code);
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
canvas.addEventListener('mousemove', e => { mouse.sx = e.clientX; mouse.sy = e.clientY; });
canvas.addEventListener('mousedown', e => { if (e.button === 0) mouse.down = true; else if (e.button === 2) useUlt(); });
window.addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('blur', () => {
  for (const k in keys) keys[k] = false;
  mouse.down = false;
  if (state === 'playing') setPause(true);
});

/* ---------------- Highscores ---------------- */
const SCORE_KEY = 'julshot_scores_v1';
function loadScores() {
  try {
    const s = JSON.parse(localStorage.getItem(SCORE_KEY) || '[]');
    return Array.isArray(s) ? s : [];
  } catch (e) { return []; }
}
function saveScore(name, score, stage) {
  const list = loadScores();
  const entry = { name: name || 'Pilot', score, stage, t: Date.now() };
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const top = list.slice(0, 10);
  try { localStorage.setItem(SCORE_KEY, JSON.stringify(top)); } catch (e) { /* ignorieren */ }
  cachedBest = null;
  return top.includes(entry) ? entry.t : null;
}
function renderScores(table, highlightT) {
  const list = loadScores();
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
    const cells = [i + 1, s.name, s.score.toLocaleString('de-DE'), s.stage || '-'];
    for (const c of cells) {
      const td = document.createElement('td');
      td.textContent = c;
      tr.appendChild(td);
    }
    table.appendChild(tr);
  });
}
let cachedBest = null;
function bestScore() {
  if (cachedBest === null) { const l = loadScores(); cachedBest = l.length ? l[0].score : 0; }
  return cachedBest;
}

/* ---------------- Sterne-Hintergrund ---------------- */
let stars = [];
const STAR_COLORS = ['#cfe0ff', '#ffffff', '#ffe9c4', '#bcd0ff', '#ffc9d6'];
function makeStar(x, y) {
  const layer = Math.random();
  return { x, y, z: layer < 0.6 ? 0.25 : layer < 0.9 ? 0.55 : 1, tw: Math.random() * TAU, col: pick(STAR_COLORS) };
}
function initStars() {
  stars = [];
  const n = Math.floor((W * H) / 3200);
  for (let i = 0; i < n; i++) stars.push(makeStar(Math.random() * W, Math.random() * H));
}
// Beim Herauszoomen: Sterne für den neu sichtbaren Bereich ergänzen
function addStarsForZoom(target) {
  const tw = SW / target, th = SH / target;
  const ox = (tw - W) / 2, oy = (th - H) / 2;
  const n = Math.floor((tw * th - W * H) / 3200);
  for (let i = 0; i < n; i++) {
    let x, y;
    do { x = rand(-ox, W + ox); y = rand(-oy, H + oy); } while (x >= 0 && x <= W && y >= 0 && y <= H);
    stars.push(makeStar(x, y));
  }
}

// Nebel-Hintergrund (einmal vorgerendert)
let nebula = null;
function buildNebula() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 640;
  const g = c.getContext('2d');
  g.fillStyle = '#03040d'; g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'lighter';
  const blobs = [[0.18, 0.3, 330, '70,60,210'], [0.78, 0.22, 300, '200,50,140'], [0.5, 0.82, 400, '30,110,200'],
                 [0.92, 0.8, 280, '120,40,180'], [0.08, 0.92, 260, '40,160,170'], [0.55, 0.35, 220, '90,40,160']];
  for (const [bx, by, br, col] of blobs) {
    for (let k = 0; k < 7; k++) {
      const x = bx * c.width + rand(-90, 90), y = by * c.height + rand(-70, 70), r = br * rand(0.4, 1);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(${col},0.10)`);
      gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  nebula = c;
}

// Leuchtsprites für Glow-Effekte
const glowCache = {};
function glowSprite(color) {
  let c = glowCache[color];
  if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, color);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return (glowCache[color] = c);
}
// zeichnet einen Glow; ctx.globalCompositeOperation sollte 'lighter' sein
function glowRaw(x, y, r, color, a) {
  ctx.globalAlpha = a;
  ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

/* ---------------- Upgrades ---------------- */
const UPGRADES = [
  { id: 'rate', icon: '⚡', name: 'Schnellfeuer', desc: 'Schießt 22% schneller.', max: 8,
    apply: p => { p.fireDelay = Math.max(0.045, p.fireDelay * 0.78); } },
  { id: 'multi', icon: '✶', name: 'Mehrfachschuss', desc: '+1 Geschoss pro Schuss.', max: 6,
    apply: p => { p.shots += 1; } },
  { id: 'dmg', icon: '💥', name: 'Schwere Munition', desc: '+35% Schaden.', max: 10,
    apply: p => { p.dmg *= 1.35; } },
  { id: 'speed', icon: '🚀', name: 'Triebwerk', desc: 'Fliegt 15% schneller.', max: 6,
    apply: p => { p.speed *= 1.15; } },
  { id: 'bspeed', icon: '➹', name: 'Railgun-Läufe', desc: 'Geschosse fliegen 25% schneller und größer.', max: 5,
    apply: p => { p.bulletSpeed *= 1.25; p.bulletSize += 1; } },
  { id: 'hp', icon: '❤', name: 'Panzerung', desc: '+2 maximale Lebenspunkte und volle Heilung.', max: 6,
    apply: p => { p.maxHp += 2; p.hp = p.maxHp; } },
  { id: 'pierce', icon: '➶', name: 'Durchschlag', desc: 'Geschosse durchdringen +1 Gegner.', max: 4,
    apply: p => { p.pierce += 1; } },
  { id: 'homing', icon: '◎', name: 'Zielsuchend', desc: 'Geschosse lenken sich zu Gegnern.', max: 3,
    apply: p => { p.homing += 1; } },
  { id: 'shield', icon: '🛡', name: 'Energieschild', desc: 'Blockt einen Treffer, lädt sich wieder auf.', max: 3,
    apply: p => { p.shieldMax += 1; p.shield = p.shieldMax; } },
  { id: 'regen', icon: '✚', name: 'Nanobots', desc: 'Repariert dein Schiff langsam.', max: 4,
    apply: p => { p.regen += 1; } },
  { id: 'rear', icon: '⇅', name: 'Heckkanone', desc: 'Zusätzliche Schüsse nach hinten.', max: 3,
    apply: p => { p.rear += 1; } },
  { id: 'crit', icon: '✦', name: 'Kritische Treffer', desc: '+12% Chance auf doppelten Schaden.', max: 5,
    apply: p => { p.crit += 0.12; } },
  // --- Ultimate-Perks (Q / Rechtsklick) ---
  { id: 'ultcd', icon: '⏱', name: 'Schnelle Ladung', desc: 'Ultimate lädt 2,5 Sek. schneller.', max: 4,
    apply: p => { p.ultCD = Math.max(8, p.ultCD - 2.5); } },
  { id: 'ultpow', icon: '☄', name: 'Nova-Verstärker', desc: 'Ultimate: +50% Schaden und größere Reichweite.', max: 4,
    apply: p => { p.ultPow += 1; } },
  { id: 'ultecho', icon: '◌', name: 'Nova-Echo', desc: 'Ultimate löst eine zusätzliche Druckwelle aus.', max: 2,
    apply: p => { p.ultEcho += 1; } },
  { id: 'ultshield', icon: '◈', name: 'Nova-Panzer', desc: 'Nach dem Ultimate bist du länger unverwundbar.', max: 3,
    apply: p => { p.ultInv += 1; } },
  { id: 'ultsurge', icon: '✹', name: 'Nachbrenner', desc: 'Nach dem Ultimate feuerst du einige Sekunden doppelt so schnell.', max: 3,
    apply: p => { p.ultSurge += 1; } },
];

/* ---------------- Spielzustand ---------------- */
let state = 'menu'; // menu | upgrade | playing | paused | gameover
let player, bullets, eBullets, enemies, particles, texts, lasers, pickups, novas, rings;
let game;
let shake = 0;
let flash = 0;

function newPlayer() {
  return {
    x: W / 2, y: H * 0.75, vx: 0, vy: 0, r: 13, aim: -Math.PI / 2,
    hp: 5, maxHp: 5, speed: 300,
    fireDelay: 0.17, fireT: 0, shots: 1, dmg: 1, bulletSpeed: 640, bulletSize: 3,
    pierce: 0, homing: 0, shield: 0, shieldMax: 0, shieldT: 0,
    regen: 0, regenT: 0, rear: 0, crit: 0,
    invuln: 0, dead: false,
    ultCharge: 0, ultCD: 20, ultPow: 0, ultInv: 0, ultSurge: 0, ultEcho: 0, surgeT: 0, ultReady: false,
    levels: {},
  };
}

function resetGame() {
  setZoom(1); initStars();
  player = newPlayer();
  bullets = []; eBullets = []; enemies = []; particles = []; texts = []; lasers = []; pickups = []; novas = []; rings = [];
  shake = 0; flash = 0;
  game = {
    round: 0, normalWaves: 0, bossesDefeated: 0,
    score: 0, time: 0, zoomed: false, zoomT: 0, lastBossName: '',
    spawnQueue: [], spawnT: 0,
    phase: 'idle', // idle | wave | boss | clear | dying
    phaseT: 0,
    banner: null,
    boss: null,
    afterUpgrade: null,
  };
}

/* ---------------- UI-Overlays ---------------- */
const $ = id => document.getElementById(id);
const ui = {
  menu: $('menu'), upgrade: $('upgrade'), pause: $('pause'), gameover: $('gameover'),
};
function showOverlay(name) {
  for (const k in ui) ui[k].classList.toggle('hidden', k !== name);
}

function toMenu() {
  state = 'menu';
  setZoom(1); initStars();
  renderScores($('menuScores'));
  showOverlay('menu');
}

function startGame() {
  resetGame();
  offerUpgrade('Start', 'Wähle dein erstes Upgrade für den Flug.', () => nextRound());
}

const UPGRADE_OFFER = 6;  // so viele Karten werden angezeigt
const UPGRADE_PICKS = 3;  // so viele davon darf man nehmen
let upgradeChoices = [];
let upgradeCallback = null;
let picksLeft = 0;
let taken = [];
function offerUpgrade(title, sub, cb) {
  state = 'upgrade';
  mouse.down = false;
  const avail = UPGRADES.filter(u => (player.levels[u.id] || 0) < u.max);
  upgradeChoices = shuffle(avail.slice()).slice(0, UPGRADE_OFFER);
  picksLeft = Math.min(UPGRADE_PICKS, upgradeChoices.length);
  taken = [];
  upgradeCallback = cb;
  $('upTitle').textContent = title === 'Start' ? 'Wähle deine Start-Upgrades' : 'Boss besiegt! Wähle deine Upgrades';
  $('upSub').textContent = sub;
  const cards = $('cards');
  cards.innerHTML = '';
  if (!upgradeChoices.length) { // alles maximiert
    player.hp = player.maxHp;
    state = 'playing'; showOverlay(null); cb(); return;
  }
  upgradeChoices.forEach((u, i) => {
    const lvl = player.levels[u.id] || 0;
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML =
      `<div class="key">[${i + 1}]</div><div class="icon"></div><div class="name"></div>` +
      `<div class="desc"></div><div class="lvl"></div>`;
    div.querySelector('.icon').textContent = u.icon;
    div.querySelector('.name').textContent = u.name;
    div.querySelector('.desc').textContent = u.desc;
    div.querySelector('.lvl').textContent = `Stufe ${lvl} → ${lvl + 1} (max ${u.max})`;
    div.addEventListener('click', () => chooseUpgrade(i));
    cards.appendChild(div);
  });
  updatePicksUI();
  showOverlay('upgrade');
}
function updatePicksUI() {
  $('upSub').textContent = `Wähle ${picksLeft === 1 ? 'noch 1 Upgrade' : picksLeft + ' Upgrades'} aus ${upgradeChoices.length} Karten.`;
  [...$('cards').children].forEach((el, i) => el.classList.toggle('taken', taken.includes(i)));
}
function chooseUpgrade(i) {
  if (state !== 'upgrade') return;
  const u = upgradeChoices[i];
  if (!u || taken.includes(i)) return;
  u.apply(player);
  player.levels[u.id] = (player.levels[u.id] || 0) + 1;
  taken.push(i);
  picksLeft--;
  addText(player.x, player.y - 30 - taken.length * 18, u.name + '!', '#7fe8ff', 18);
  if (picksLeft > 0) { updatePicksUI(); return; }
  showOverlay(null);
  state = 'playing';
  const cb = upgradeCallback;
  upgradeCallback = null;
  if (cb) cb();
}

function setPause(on) {
  if (on && state === 'playing') { state = 'paused'; showOverlay('pause'); }
  else if (!on && state === 'paused') { state = 'playing'; showOverlay(null); }
}

let lastSavedT = null;
function gameOver() {
  state = 'gameover';
  lastSavedT = null;
  $('finalScore').textContent = game.score.toLocaleString('de-DE');
  $('finalInfo').textContent =
    `${stageLabel()} erreicht · ${game.bossesDefeated} Boss${game.bossesDefeated === 1 ? '' : 'e'} besiegt`;
  $('nameForm').classList.remove('hidden');
  let lastName = '';
  try { lastName = localStorage.getItem('julshot_name') || ''; } catch (e) { /* ignorieren */ }
  $('nameInput').value = lastName;
  renderScores($('overScores'));
  showOverlay('gameover');
  setTimeout(() => $('nameInput').focus(), 50);
}

function onKey(code) {
  if (state === 'menu' && (code === 'Enter' || code === 'Space')) startGame();
  else if (state === 'upgrade' && /^(Digit|Numpad)[1-6]$/.test(code)) {
    chooseUpgrade(parseInt(code.slice(-1), 10) - 1);
  } else if (code === 'KeyP' || code === 'Escape') {
    if (state === 'playing') setPause(true);
    else if (state === 'paused') setPause(false);
  } else if ((code === 'KeyQ' || code === 'KeyE') && state === 'playing') {
    useUlt();
  } else if (code === 'KeyF' && (state === 'playing' || state === 'paused')) {
    autoFire = !autoFire;
    if (player) addText(player.x, player.y - 30, autoFire ? 'Auto-Feuer AN' : 'Auto-Feuer AUS', '#ffffff', 14);
  }
}

$('btnStart').addEventListener('click', startGame);
$('btnResume').addEventListener('click', () => setPause(false));
$('btnQuit').addEventListener('click', toMenu);
$('btnRetry').addEventListener('click', startGame);
$('btnMenu').addEventListener('click', toMenu);
$('nameForm').addEventListener('submit', e => {
  e.preventDefault();
  if (lastSavedT !== null) return;
  const name = $('nameInput').value.trim().slice(0, 12) || 'Pilot';
  try { localStorage.setItem('julshot_name', name); } catch (err) { /* ignorieren */ }
  lastSavedT = saveScore(name, game.score, stageLabel()) || -1;
  $('nameForm').classList.add('hidden');
  renderScores($('overScores'), lastSavedT);
});

/* ---------------- Wellen & Runden ---------------- */
function isBossRound(r) { return r % 3 === 0; } // nach 2 Wellen immer ein Boss
function stageLabel() {
  if (!game || game.round === 0) return 'Welle 1';
  return isBossRound(game.round) ? `Boss ${game.bossesDefeated + 1}` : `Welle ${game.normalWaves}`;
}

function nextRound() {
  game.round++;
  if (isBossRound(game.round)) {
    const enc = ENCOUNTERS[game.bossesDefeated % ENCOUNTERS.length];
    game.banner = { text: 'BOSS: ' + enc.name, sub: enc.title, t: 2.8, color: enc.color };
    game.phase = 'boss';
    game.phaseT = 1.6;
    game.boss = null;
  } else {
    game.normalWaves++;
    const n = game.normalWaves;
    game.banner = { text: 'Welle ' + n, sub: n === 1 ? 'Viel Glück, Pilot!' : '', t: 2.0, color: '#7fe8ff' };
    game.phase = 'wave';
    game.spawnQueue = buildWave(n);
    game.spawnT = 1.4;
  }
}

function buildWave(n) {
  const q = [];
  const count = Math.round((8 + n * 3) * (game.zoomed ? 1.45 : 1)); // größeres Feld = mehr Gegner
  for (let i = 0; i < count; i++) {
    const pool = ['drone', 'drone', 'drone'];
    if (n >= 1) pool.push('gunner');
    if (n >= 2) pool.push('dart', 'dart');
    if (n >= 3) pool.push('gunner');
    if (n >= 4) pool.push('tank');
    if (n >= 6) pool.push('tank', 'dart');
    q.push(pick(pool));
  }
  // Am Ende der Welle ein paar zähe Gegner
  if (n >= 3) q.push('tank');
  if (n >= 5) q.push('tank');
  return q;
}

function difficulty() {
  // steigt mit jeder Runde
  return 1 + 0.16 * (game.round - 1);
}

/* ---------------- Gegner ---------------- */
const ENEMY_DEFS = {
  drone:  { r: 13, hp: 2,  speed: 120, score: 100, color: '#ff5577' },
  dart:   { r: 11, hp: 1,  speed: 420, score: 120, color: '#ffcc33' },
  gunner: { r: 16, hp: 4,  speed: 110, score: 150, color: '#45d8ff' },
  tank:   { r: 25, hp: 14, speed: 55,  score: 300, color: '#b07bff' },
  minion: { r: 10, hp: 1,  speed: 170, score: 40,  color: '#8dff6a' },
};

function spawnPos(margin = 40) {
  const side = randInt(0, 3);
  if (side === 0) return { x: rand(0, W), y: -margin };
  if (side === 1) return { x: W + margin, y: rand(0, H) };
  if (side === 2) return { x: rand(0, W), y: H + margin };
  return { x: -margin, y: rand(0, H) };
}

function spawnEnemy(type, x, y) {
  const d = ENEMY_DEFS[type];
  const diff = difficulty();
  if (x === undefined) { const p = spawnPos(d.r + 20); x = p.x; y = p.y; }
  const hp = d.hp * (1 + 0.22 * (game.round - 1));
  const e = {
    type, x, y, vx: 0, vy: 0, r: d.r, hp, maxHp: hp,
    speed: d.speed * (1 + 0.04 * (game.round - 1)),
    score: Math.round(d.score * (1 + 0.1 * (game.round - 1))),
    color: d.color, t: rand(0, 10), fireT: rand(1, 2.5) / Math.sqrt(diff),
    mode: 0, modeT: rand(0.5, 1.2), hitFlash: 0, rot: 0, boss: false,
  };
  enemies.push(e);
  return e;
}

function updateEnemy(e, dt) {
  e.t += dt;
  e.hitFlash = Math.max(0, e.hitFlash - dt);
  const a = Math.atan2(player.y - e.y, player.x - e.x);
  const dist = Math.hypot(player.x - e.x, player.y - e.y);
  const diff = difficulty();

  if (e.type === 'drone' || e.type === 'minion') {
    const wob = Math.sin(e.t * 3) * 0.5;
    const tx = Math.cos(a + wob) * e.speed, ty = Math.sin(a + wob) * e.speed;
    e.vx += (tx - e.vx) * Math.min(1, dt * 2.5);
    e.vy += (ty - e.vy) * Math.min(1, dt * 2.5);
    e.rot = Math.atan2(e.vy, e.vx);
  } else if (e.type === 'dart') {
    e.modeT -= dt;
    if (e.mode === 0) { // zielen
      e.vx *= Math.pow(0.05, dt); e.vy *= Math.pow(0.05, dt);
      e.rot = a;
      if (e.modeT <= 0 && onScreen(e, -10)) { e.mode = 1; e.modeT = 0.75; e.vx = Math.cos(a) * e.speed; e.vy = Math.sin(a) * e.speed; }
      else if (!onScreen(e, -10)) { e.vx = Math.cos(a) * 160; e.vy = Math.sin(a) * 160; }
    } else { // Sturzflug
      if (e.modeT <= 0) { e.mode = 0; e.modeT = rand(0.6, 1.1); }
      if (Math.random() < 0.5) addParticle(e.x, e.y, -e.vx * 0.1, -e.vy * 0.1, 0.3, '#ffcc33', 2);
    }
  } else if (e.type === 'gunner') {
    const pref = 260;
    const radial = dist > pref + 30 ? 1 : dist < pref - 30 ? -1 : 0;
    const tang = Math.sin(e.t * 0.7) > 0 ? 1 : -1;
    const tx = (Math.cos(a) * radial + Math.cos(a + Math.PI / 2) * tang * 0.6) * e.speed;
    const ty = (Math.sin(a) * radial + Math.sin(a + Math.PI / 2) * tang * 0.6) * e.speed;
    e.vx += (tx - e.vx) * Math.min(1, dt * 2);
    e.vy += (ty - e.vy) * Math.min(1, dt * 2);
    e.rot = a;
    e.fireT -= dt;
    if (e.fireT <= 0 && onScreen(e, 10)) {
      e.fireT = rand(1.4, 2.2) / Math.sqrt(diff);
      fireEnemy(e.x, e.y, a, 230 * Math.min(1.6, Math.sqrt(diff)), '#45d8ff', 5);
    }
  } else if (e.type === 'tank') {
    e.vx += (Math.cos(a) * e.speed - e.vx) * Math.min(1, dt);
    e.vy += (Math.sin(a) * e.speed - e.vy) * Math.min(1, dt);
    e.rot += dt * 0.8;
    e.fireT -= dt;
    if (e.fireT <= 0 && onScreen(e, 10)) {
      e.fireT = rand(2.2, 3.0) / Math.sqrt(diff);
      for (let i = -2; i <= 2; i++) fireEnemy(e.x, e.y, a + i * 0.2, 180, '#c99bff', 6);
    }
  }

  e.x += e.vx * dt;
  e.y += e.vy * dt;

  // Gegner sollen nicht ewig außerhalb des Bildschirms bleiben
  if (e.type !== 'dart' || e.mode === 0) {
    const m = 60;
    if (e.x < -m) e.vx += 300 * dt; if (e.x > W + m) e.vx -= 300 * dt;
    if (e.y < -m) e.vy += 300 * dt; if (e.y > H + m) e.vy -= 300 * dt;
  }
}

function onScreen(o, m = 0) {
  return o.x > -m && o.x < W + m && o.y > -m && o.y < H + m;
}

function fireEnemy(x, y, a, speed, color, r = 5, extra) {
  const b = { x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r, color, life: 9 };
  if (extra) Object.assign(b, extra);
  eBullets.push(b);
  return b;
}

/* ---------------- Bosse ---------------- */
const BOSSES = [
  {
    name: 'WÄCHTER', title: 'Hüter der Spiralen', color: '#ffb347', r: 58, hp: 150, score: 3000,
    move(b, dt) {
      b.x += (W / 2 + Math.sin(b.t * 0.6) * W * 0.3 - b.x) * Math.min(1, dt * 1.5);
      b.y += (H * 0.22 + Math.sin(b.t * 1.3) * 30 - b.y) * Math.min(1, dt * 1.5);
      b.rot += dt * (b.enraged ? 2.2 : 1.2);
    },
    patterns: [
      function* spiral(b) { // Spiralfeuer
        const arms = b.enraged ? 4 : 3;
        for (let i = 0; i < 60; i++) {
          for (let k = 0; k < arms; k++) fireEnemy(b.x, b.y, b.spin + k * TAU / arms, 190, '#ffb347', 6);
          b.spin += 0.17;
          yield 0.06;
        }
      },
      function* rings(b) { // Ringexplosionen
        const n = b.enraged ? 28 : 22;
        for (let r = 0; r < 4; r++) {
          const off = r * 0.5 * TAU / n;
          for (let k = 0; k < n; k++) fireEnemy(b.x, b.y, off + k * TAU / n, 170 + r * 15, '#ffd27a', 6);
          yield 0.55;
        }
      },
      function* fans(b) { // gezielte Fächer
        for (let r = 0; r < 4; r++) {
          const a = angTo(b, player);
          const n = b.enraged ? 9 : 7;
          for (let k = 0; k < n; k++) fireEnemy(b.x, b.y, a + (k - (n - 1) / 2) * 0.13, 280, '#ff8c42', 6);
          yield 0.45;
        }
      },
    ],
    draw(b) {
      ctx.save(); ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      for (let i = 0; i < 8; i++) {
        ctx.rotate(TAU / 8);
        ctx.fillStyle = i % 2 ? '#a3561a' : '#d8792a';
        ctx.beginPath(); ctx.moveTo(30, -12); ctx.lineTo(b.r + 10, 0); ctx.lineTo(30, 12); ctx.fill();
      }
      ctx.restore();
      circle(b.x, b.y, 40, b.hitFlash > 0 ? '#fff' : '#5a2e10');
      circle(b.x, b.y, 30, '#ffb347');
      const pa = angTo(b, player);
      circle(b.x + Math.cos(pa) * 10, b.y + Math.sin(pa) * 10, 13, b.enraged ? '#ff2a2a' : '#2a1405');
      circle(b.x + Math.cos(pa) * 13, b.y + Math.sin(pa) * 13, 5, '#fff');
    },
  },
  {
    name: 'SCHWARMKÖNIGIN', title: 'Mutter der Drohnen', color: '#8dff6a', r: 54, hp: 170, score: 3500,
    move(b, dt) {
      const tx = W / 2 + Math.sin(b.t * 0.5) * W * 0.32;
      const ty = H * 0.25 + Math.sin(b.t * 1.0) * H * 0.1;
      b.x += (tx - b.x) * Math.min(1, dt * 1.2);
      b.y += (ty - b.y) * Math.min(1, dt * 1.2);
      b.rot = Math.sin(b.t * 2) * 0.15;
    },
    patterns: [
      function* brood(b) { // Brut ausspucken
        const n = b.enraged ? 6 : 4;
        for (let i = 0; i < n; i++) {
          const a = Math.PI / 2 + (i - (n - 1) / 2) * 0.5;
          const m = spawnEnemy('minion', b.x + Math.cos(a) * 40, b.y + Math.sin(a) * 40);
          m.vx = Math.cos(a) * 250; m.vy = Math.sin(a) * 250;
          m.minion = true;
          burst(m.x, m.y, '#8dff6a', 6, 120);
          yield 0.18;
        }
        yield 0.6;
      },
      function* missiles(b) { // Lenkraketen
        const n = b.enraged ? 6 : 4;
        for (let i = 0; i < n; i++) {
          const a = Math.PI / 2 + (i - (n - 1) / 2) * 0.6;
          fireEnemy(b.x, b.y, a, 150, '#d6ff5a', 7, { homing: 2.0, life: 5.5, missile: true, maxSpeed: 260 });
          yield 0.25;
        }
        yield 0.8;
      },
      function* acid(b) { // Säureregen
        for (let i = 0; i < (b.enraged ? 45 : 32); i++) {
          const a = angTo(b, player) + rand(-0.55, 0.55);
          fireEnemy(b.x, b.y + 20, a, rand(120, 260), '#5dff9d', rand(4, 7));
          yield 0.05;
        }
      },
    ],
    draw(b) {
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
      // Flügel
      ctx.fillStyle = 'rgba(141,255,106,0.25)';
      const flap = Math.sin(b.t * 18) * 0.25;
      for (const s of [-1, 1]) {
        ctx.save(); ctx.scale(s, 1); ctx.rotate(flap);
        ctx.beginPath(); ctx.ellipse(48, -14, 46, 18, -0.35, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(40, 10, 34, 12, 0.3, 0, TAU); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = b.hitFlash > 0 ? '#fff' : '#2f6e1f';
      ctx.beginPath(); ctx.ellipse(0, 8, 30, 48, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#8dff6a';
      for (let i = 0; i < 4; i++) { ctx.fillRect(-24 + i * 2, 10 + i * 12, 48 - i * 4, 4); }
      circle(0, -36, 20, b.hitFlash > 0 ? '#fff' : '#3d8a28');
      circle(-8, -40, 6, b.enraged ? '#ff3b3b' : '#e7ff5a');
      circle(8, -40, 6, b.enraged ? '#ff3b3b' : '#e7ff5a');
      ctx.restore();
    },
  },
  {
    name: 'LASERKOLOSS', title: 'Der rote Strahl', color: '#ff4a5a', r: 62, hp: 200, score: 4000,
    move(b, dt) {
      if (b.anchored) return;
      b.x += (clamp(player.x, W * 0.15, W * 0.85) - b.x) * Math.min(1, dt * 0.6);
      b.y += (H * 0.2 - b.y) * Math.min(1, dt * 1.2);
    },
    patterns: [
      function* aimedLasers(b) { // gezielte Laser mit Warnung
        const n = b.enraged ? 5 : 3;
        for (let i = 0; i < n; i++) {
          const a = angTo(b, player);
          addLaser(b, a, 0.85, 0.45, 26, 0);
          yield 0.6;
        }
        yield 0.9;
      },
      function* cross(b) { // rotierendes Laserkreuz
        b.anchored = true;
        const arms = b.enraged ? 5 : 4;
        const dir = Math.random() < 0.5 ? 1 : -1;
        const base = rand(0, TAU);
        for (let k = 0; k < arms; k++) addLaser(b, base + k * TAU / arms, 1.1, 3.4, 22, dir * (b.enraged ? 0.75 : 0.55));
        yield 4.6;
        b.anchored = false;
      },
      function* barrage(b) { // Geschosshagel aus den Kanonen
        for (let i = 0; i < 12; i++) {
          for (const s of [-1, 1]) {
            const gx = b.x + s * 46, gy = b.y + 20;
            const a = Math.atan2(player.y - gy, player.x - gx) + rand(-0.1, 0.1);
            fireEnemy(gx, gy, a, 300, '#ff7a85', 5);
          }
          yield b.enraged ? 0.12 : 0.17;
        }
      },
    ],
    draw(b) {
      ctx.save(); ctx.translate(b.x, b.y);
      ctx.fillStyle = b.hitFlash > 0 ? '#fff' : '#4a1018';
      ctx.beginPath();
      ctx.moveTo(-70, -20); ctx.lineTo(-40, -45); ctx.lineTo(40, -45); ctx.lineTo(70, -20);
      ctx.lineTo(55, 30); ctx.lineTo(-55, 30); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#7d1c28';
      ctx.fillRect(-52, 10, 14, 26); ctx.fillRect(38, 10, 14, 26);
      ctx.restore();
      const glow = 0.6 + Math.sin(b.t * 8) * 0.4;
      circle(b.x, b.y - 6, 22, '#2a0508');
      circle(b.x, b.y - 6, 14 + glow * 4, b.enraged ? '#ffffff' : '#ff4a5a');
    },
  },
  {
    name: 'PHANTOM', title: 'Schatten zwischen den Sternen', color: '#c77dff', r: 46, hp: 190, score: 4500,
    move(b, dt) {
      if (b.dash) {
        b.x += b.dash.vx * dt; b.y += b.dash.vy * dt;
        b.dash.t -= dt;
        b.dash.drop -= dt;
        if (b.dash.drop <= 0) {
          b.dash.drop = 0.07;
          fireEnemy(b.x, b.y, 0, 0, '#e0b0ff', 8, { mine: 1.2 + rand(0, 0.4), life: 3 });
        }
        addParticle(b.x, b.y, rand(-30, 30), rand(-30, 30), 0.5, '#c77dff', 5);
        if (b.dash.t <= 0) b.dash = null;
        return;
      }
      b.x += Math.sin(b.t * 1.7) * 40 * dt;
      b.y += Math.cos(b.t * 1.3) * 30 * dt;
    },
    patterns: [
      function* teleportRing(b) { // Teleport + Ring
        for (let i = 0; i < (b.enraged ? 3 : 2); i++) {
          b.fade = 1; yield 0.35;
          burst(b.x, b.y, '#c77dff', 20, 200);
          b.x = rand(W * 0.15, W * 0.85); b.y = rand(H * 0.12, H * 0.5);
          if (Math.hypot(b.x - player.x, b.y - player.y) < 220) b.y = clamp(player.y - 260, 60, H - 60);
          b.fade = 0; burst(b.x, b.y, '#c77dff', 20, 200);
          yield 0.3;
          const n = 24, off = rand(0, TAU);
          for (let k = 0; k < n; k++) fireEnemy(b.x, b.y, off + k * TAU / n, 200, '#c77dff', 6);
          yield 0.5;
        }
      },
      function* dash(b) { // Sturmangriff mit Minenspur
        for (let i = 0; i < (b.enraged ? 3 : 2); i++) {
          const a = angTo(b, player);
          const len = Math.max(W, H);
          addLaser(b, a, 0.7, 0, 40, 0, true); // nur Warnlinie
          yield 0.75;
          b.dash = { vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, t: Math.min(0.9, len / 900), drop: 0 };
          yield 1.0;
          b.dash = null;
          b.x = clamp(b.x, 60, W - 60); b.y = clamp(b.y, 60, H - 60);
          yield 0.3;
        }
      },
      function* shadowVolley(b) { // Schattensalven aus 3 Richtungen
        for (let r = 0; r < 5; r++) {
          const a = angTo(b, player);
          for (let k = -1; k <= 1; k++) {
            const sx = player.x + Math.cos(a + Math.PI + k * 1.6) * 360;
            const sy = player.y + Math.sin(a + Math.PI + k * 1.6) * 360;
            const aa = Math.atan2(player.y - sy, player.x - sx);
            burst(sx, sy, '#7b2cbf', 6, 60);
            fireEnemy(sx, sy, aa, 60, '#e0b0ff', 7, { accel: 340, maxSpeed: 360 });
          }
          yield b.enraged ? 0.45 : 0.65;
        }
      },
    ],
    draw(b) {
      const alpha = b.fade ? 0.25 : 1;
      ctx.save(); ctx.globalAlpha = alpha; ctx.translate(b.x, b.y);
      ctx.rotate(b.t * 0.8);
      ctx.strokeStyle = '#c77dff'; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i <= 5; i++) {
        const a = i * TAU / 5 * 2;
        const r = b.r + Math.sin(b.t * 4 + i) * 4;
        i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.stroke();
      ctx.restore();
      ctx.save(); ctx.globalAlpha = alpha;
      circle(b.x, b.y, 28, b.hitFlash > 0 ? '#fff' : '#240046');
      circle(b.x, b.y, 18, '#7b2cbf');
      const pa = angTo(b, player);
      circle(b.x + Math.cos(pa) * 6, b.y + Math.sin(pa) * 6, 7, b.enraged ? '#ff4d6d' : '#f8e1ff');
      ctx.restore();
    },
  },
  // ---------- 4: IGNIS (Zwilling, Feuer) ----------
  {
    name: 'IGNIS', title: 'Die Flamme', color: '#ff7a2a', r: 44, hp: 115, score: 2500,
    move(b, dt) { twinMove(b, dt); b.rot += dt; },
    patterns: [
      function* flameSpiral(b) {
        for (let i = 0; i < 42; i++) {
          for (let k = 0; k < 2; k++) fireEnemy(b.x, b.y, b.spin + k * Math.PI, 200, '#ff8c42', 6);
          b.spin += b.enraged ? 0.3 : 0.22;
          yield 0.06;
        }
      },
      function* fireballs(b) {
        const n = b.enraged ? 5 : 3;
        for (let i = 0; i < n; i++) {
          const a = angTo(b, player) + rand(-0.25, 0.25);
          fireEnemy(b.x, b.y, a, 230, '#ff5a1f', 11, { mine: 0.85, split: true, splitN: 8, splitColor: '#ffa24a' });
          yield 0.5;
        }
        yield 0.4;
      },
      function* sunburst(b) {
        for (let r = 0; r < 3; r++) {
          const n = 22, gap = angTo(b, player) + rand(-0.8, 0.8);
          for (let k = 0; k < n; k++) {
            const a = k * TAU / n;
            if (Math.abs(angDiff(a, gap)) < 0.32) continue;
            fireEnemy(b.x, b.y, a, 175, '#ffb13b', 6);
          }
          yield 0.7;
        }
      },
    ],
    draw(b) {
      const fl = b.hitFlash > 0;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.t * 1.4);
      for (let i = 0; i < 7; i++) {
        ctx.rotate(TAU / 7);
        ctx.fillStyle = fl ? '#fff' : (i % 2 ? '#ff5a1f' : '#ffb13b');
        ctx.beginPath(); ctx.moveTo(18, -9);
        ctx.quadraticCurveTo(b.r * 1.05, -5, b.r * 1.3 + Math.sin(b.t * 9 + i) * 5, 0);
        ctx.quadraticCurveTo(b.r * 1.05, 5, 18, 9); ctx.fill();
      }
      ctx.restore();
      circle(b.x, b.y, b.r * 0.72, fl ? '#fff' : '#7a1d06');
      circle(b.x, b.y, b.r * 0.55, '#ff7a2a');
      circle(b.x, b.y, b.r * 0.32, '#ffd27a');
      const pa = angTo(b, player);
      circle(b.x + Math.cos(pa) * 8, b.y + Math.sin(pa) * 8, 8, b.enraged ? '#ffffff' : '#3a0d02');
      circle(b.x + Math.cos(pa) * 10, b.y + Math.sin(pa) * 10, 3.5, b.enraged ? '#ff2a2a' : '#ffd27a');
    },
  },
  // ---------- 5: GLACIES (Zwilling, Eis) ----------
  {
    name: 'GLACIES', title: 'Der Frost', color: '#6fd6ff', r: 44, hp: 115, score: 2500,
    move(b, dt) { twinMove(b, dt); },
    patterns: [
      function* iceShards(b) {
        for (let i = 0; i < 9; i++) {
          const a = angTo(b, player);
          for (let k = -1; k <= 1; k++) fireEnemy(b.x, b.y, a + k * 0.1, b.enraged ? 400 : 360, '#9be7ff', 4);
          yield 0.3;
        }
      },
      function* frostRing(b) {
        for (let r = 0; r < 3; r++) {
          const n = 30, gap = angTo(b, player);
          for (let k = 0; k < n; k++) {
            const a = k * TAU / n;
            if (Math.abs(angDiff(a, gap)) < 0.4) continue;
            fireEnemy(b.x, b.y, a, 150 + r * 20, '#bff3ff', 6);
          }
          yield 0.6;
        }
      },
      function* blizzard(b) {
        const n = b.enraged ? 60 : 42;
        for (let i = 0; i < n; i++) {
          const x = rand(0, W);
          const d = fireEnemy(x, -12, Math.PI / 2, rand(190, 280), '#d6f6ff', rand(5, 8));
          d.vx = rand(-40, 40);
          yield 0.07;
        }
      },
    ],
    draw(b) {
      const fl = b.hitFlash > 0;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(-b.t * 0.6);
      for (let i = 0; i < 6; i++) {
        ctx.rotate(TAU / 6);
        ctx.fillStyle = fl ? '#fff' : (i % 2 ? '#4aa8e8' : '#bff3ff');
        ctx.beginPath(); ctx.moveTo(16, -8); ctx.lineTo(b.r * 1.35, 0); ctx.lineTo(16, 8); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#ffffffaa'; ctx.lineWidth = 1; ctx.stroke();
      }
      ctx.restore();
      circle(b.x, b.y, b.r * 0.7, fl ? '#fff' : '#0e3a66');
      circle(b.x, b.y, b.r * 0.5, '#6fd6ff');
      circle(b.x, b.y, b.r * 0.28, '#eaffff');
      const pa = angTo(b, player);
      circle(b.x + Math.cos(pa) * 7, b.y + Math.sin(pa) * 7, 6, b.enraged ? '#ff4d6d' : '#06223d');
    },
  },
  // ---------- 6: GRAVITON ----------
  {
    name: 'GRAVITON', title: 'Der Schlund', color: '#7aa2ff', r: 56, hp: 200, score: 5000,
    move(b, dt) {
      b.x += (W / 2 + Math.sin(b.t * 0.4) * W * 0.25 - b.x) * Math.min(1, dt * 1.2);
      b.y += (H * 0.28 + Math.sin(b.t * 0.7) * H * 0.07 - b.y) * Math.min(1, dt * 1.2);
    },
    patterns: [
      function* orbitRing(b) {
        const n = b.enraged ? 20 : 14, spin = Math.random() < 0.5 ? 1 : -1;
        for (let i = 0; i < n; i++) {
          const a = i * TAU / n;
          const bl = fireEnemy(b.x + Math.cos(a) * 80, b.y + Math.sin(a) * 80, 0, 0, '#9bb0ff', 7);
          bl.orbit = { owner: b, a, r: 80, w: 1.9 * spin, grow: 22, t: 1.7 + i * 0.045, release: 230 };
          yield 0.045;
        }
        yield 1.6;
      },
      function* singularity(b) {
        b.pulling = 3.6;
        for (let i = 0; i < 4; i++) {
          const n = b.enraged ? 22 : 16, off = rand(0, TAU);
          for (let k = 0; k < n; k++) fireEnemy(b.x, b.y, off + k * TAU / n, 170, '#c3d1ff', 6);
          yield 0.9;
        }
        yield 0.3;
      },
      function* meteors(b) {
        const n = b.enraged ? 40 : 28;
        for (let i = 0; i < n; i++) {
          const m = fireEnemy(rand(0, W), -20, Math.PI / 2, rand(240, 380), '#9bb0ff', rand(7, 12));
          m.vx = rand(-60, 60);
          yield b.enraged ? 0.08 : 0.11;
        }
      },
    ],
    draw(b) {
      ctx.save(); ctx.translate(b.x, b.y);
      for (let i = 0; i < 4; i++) {
        ctx.save(); ctx.rotate(b.t * (0.6 + i * 0.2) * (i % 2 ? -1 : 1));
        ctx.strokeStyle = `rgba(${130 + i * 25},${150 + i * 15},255,${0.55 - i * 0.1})`;
        ctx.lineWidth = 6 - i;
        ctx.beginPath(); ctx.ellipse(0, 0, b.r * (1.45 + i * 0.32), b.r * (0.5 + i * 0.12), 0, 0, TAU); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      glowRaw(b.x, b.y, b.r * 2.2, b.enraged ? '#ff4d8d' : '#5a7bff', 0.5);
      ctx.restore();
      circle(b.x, b.y, b.r * 0.72, '#000000');
      ctx.strokeStyle = b.hitFlash > 0 ? '#ffffff' : (b.enraged ? '#ff6ea8' : '#aebfff');
      ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.72, 0, TAU); ctx.stroke();
      if (b.pulling > 0) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 4; k++) {
          const f = (b.t * 1.3 + k / 4) % 1;
          ctx.strokeStyle = `rgba(160,185,255,${0.5 * f})`; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(b.x, b.y, 80 + 620 * (1 - f), 0, TAU); ctx.stroke();
        }
        ctx.restore();
      }
    },
  },
  // ---------- 7: DREADNOUGHT ----------
  {
    name: 'DREADNOUGHT', title: 'Flaggschiff der Flotte', color: '#9fb3c8', r: 78, hp: 250, score: 6000,
    move(b, dt) {
      b.x += (W / 2 + Math.sin(b.t * 0.35) * W * 0.3 - b.x) * Math.min(1, dt * 1.5);
      b.y += (H * 0.2 - b.y) * Math.min(1, dt * 1.5);
    },
    patterns: [
      function* broadside(b) {
        const n = b.enraged ? 20 : 14;
        for (let i = 0; i < n; i++) {
          const s = i % 2 ? 1 : -1, gx = b.x + s * 92, gy = b.y + 34;
          const a = Math.atan2(player.y - gy, player.x - gx) + rand(-0.08, 0.08);
          fireEnemy(gx, gy, a, 320, '#ffd27a', 5);
          if (b.enraged) fireEnemy(gx, gy, a + 0.2, 280, '#ffd27a', 5);
          yield b.enraged ? 0.1 : 0.14;
        }
      },
      function* hangar(b) {
        const alive = enemies.filter(e => e.minion && !e.dead).length;
        if (alive < 5) {
          const n = b.enraged ? 3 : 2;
          for (let i = 0; i < n; i++) {
            const m = spawnEnemy('gunner', b.x + (i - (n - 1) / 2) * 60, b.y + 70);
            m.minion = true; m.vy = 140;
            burst(m.x, m.y, '#9fb3c8', 8, 120);
            yield 0.35;
          }
        }
        yield 0.9;
      },
      function* sweep(b) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        addLaser(b, Math.PI / 2 - dir * 0.95, 1.0, 3.4, 26, dir * 0.56);
        if (b.enraged) addLaser(b, Math.PI / 2 + dir * 0.95, 1.0, 3.4, 26, -dir * 0.56);
        yield 5.0;
      },
      function* missiles(b) {
        const n = b.enraged ? 6 : 4;
        for (let i = 0; i < n; i++) {
          fireEnemy(b.x + (i % 2 ? 60 : -60), b.y + 40, Math.PI / 2 + (i % 2 ? 0.4 : -0.4), 150, '#ff9a5a', 7,
            { homing: 1.8, life: 5, missile: true, maxSpeed: 250 });
          yield 0.3;
        }
        yield 0.8;
      },
    ],
    draw(b) {
      const fl = b.hitFlash > 0;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const s of [-1, 1]) glowRaw(b.x + s * 62, b.y - 54, 30 + Math.sin(b.t * 20) * 3, '#5ac8ff', 0.8);
      ctx.restore();
      ctx.save(); ctx.translate(b.x, b.y);
      const g = ctx.createLinearGradient(0, -55, 0, 60);
      g.addColorStop(0, fl ? '#d5e2f5' : '#6b7b93'); g.addColorStop(1, fl ? '#7f90a8' : '#27303f');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-122, -30); ctx.lineTo(-70, -56); ctx.lineTo(70, -56); ctx.lineTo(122, -30);
      ctx.lineTo(100, 22); ctx.lineTo(42, 62); ctx.lineTo(-42, 62); ctx.lineTo(-100, 22); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#b8c9dd'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = '#0d1219'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-60, -50); ctx.lineTo(-40, 40); ctx.moveTo(60, -50); ctx.lineTo(40, 40);
      ctx.moveTo(-100, -10); ctx.lineTo(100, -10); ctx.stroke();
      // Kanonen
      for (const s of [-1, 1]) {
        const ca = Math.atan2(player.y - (b.y + 34), player.x - (b.x + s * 92));
        ctx.save(); ctx.translate(s * 92, 34); ctx.rotate(ca - 0);
        ctx.fillStyle = '#1a212d'; ctx.fillRect(0, -5, 34, 10);
        ctx.fillStyle = '#9fb3c8'; ctx.fillRect(28, -6, 8, 12);
        ctx.restore();
        circle(s * 92, 34, 12, '#3a465a');
        circle(s * 92, 34, 6, b.enraged ? '#ff4d4d' : '#ffd27a');
      }
      // Brücke
      circle(0, -8, 20, '#161c26');
      circle(0, -8, 12, b.enraged ? '#ff4d4d' : '#7fe8ff');
      ctx.restore();
    },
  },
];

// Ein Bosskampf besteht aus einem oder mehreren Gegnern (Index in BOSSES)
const ENCOUNTERS = [
  { name: 'WÄCHTER', title: 'Hüter der Spiralen', color: '#ffb347', defs: [0] },
  { name: 'SCHWARMKÖNIGIN', title: 'Mutter der Drohnen', color: '#8dff6a', defs: [1] },
  { name: 'LASERKOLOSS', title: 'Der rote Strahl', color: '#ff4a5a', defs: [2] },
  { name: 'PHANTOM', title: 'Schatten zwischen den Sternen', color: '#c77dff', defs: [3] },
  { name: 'IGNIS & GLACIES', title: 'Die Zwillinge aus Feuer und Eis', color: '#ff9a5e', defs: [4, 5] },
  { name: 'GRAVITON', title: 'Der Schlund', color: '#7aa2ff', defs: [6] },
  { name: 'DREADNOUGHT', title: 'Flaggschiff der Flotte', color: '#9fb3c8', defs: [7] },
];

function twinMove(b, dt) {
  let tx, ty;
  if (b.partner && !b.partner.dead) {
    tx = W / 2 + b.side * (W * 0.22 + Math.sin(b.t * 0.7 + (b.side > 0 ? 1.5 : 0)) * W * 0.1);
    ty = H * 0.2 + Math.sin(b.t * 1.1 + b.side) * H * 0.07;
  } else { // allein: wilder
    tx = W / 2 + Math.sin(b.t * 0.9) * W * 0.32;
    ty = H * 0.22 + Math.sin(b.t * 1.4) * H * 0.1;
  }
  b.x += (tx - b.x) * Math.min(1, dt * 1.8);
  b.y += (ty - b.y) * Math.min(1, dt * 1.8);
}

function spawnBoss() {
  const enc = ENCOUNTERS[game.bossesDefeated % ENCOUNTERS.length];
  const tier = Math.floor(game.bossesDefeated / ENCOUNTERS.length); // spätere Runden: stärker
  const made = [];
  enc.defs.forEach((di, k) => {
    const def = BOSSES[di];
    const hp = def.hp * (1 + 0.3 * game.bossesDefeated) * (1 + 0.5 * tier);
    const duo = enc.defs.length > 1;
    const b = {
      def, boss: true, name: def.name, color: def.color,
      x: W / 2 + (duo ? (k ? 1 : -1) * W * 0.2 : 0), y: -100, vx: 0, vy: 0, r: def.r, hp, maxHp: hp,
      score: Math.round(def.score * (1 + 0.5 * game.bossesDefeated)),
      t: 0, rot: 0, spin: 0, hitFlash: 0, enraged: false, side: duo ? (k ? 1 : -1) : 0,
      co: null, wait: 2.2 + k * 0.8, lastPattern: -1, entering: true, fade: 0,
    };
    enemies.push(b);
    made.push(b);
  });
  if (made.length > 1) { made[0].partner = made[1]; made[1].partner = made[0]; }
  game.boss = made[0];
}


function updateBoss(b, dt) {
  b.t += dt;
  b.hitFlash = Math.max(0, b.hitFlash - dt);
  if (b.pulling > 0) b.pulling -= dt;
  if (b.entering) {
    b.y += (H * 0.22 - b.y) * Math.min(1, dt * 1.5);
    if (Math.abs(b.y - H * 0.22) < 4) b.entering = false;
    b.wait -= dt;
    return;
  }
  if (!b.enraged && b.hp < b.maxHp * 0.5) {
    b.enraged = true;
    addText(b.x, b.y - b.r - 20, 'WÜTEND!', '#ff4d4d', 22);
    shake = Math.max(shake, 10);
    burst(b.x, b.y, b.color, 30, 260);
  }
  b.def.move(b, dt);
  b.x = clamp(b.x, -40, W + 40); b.y = clamp(b.y, -40, H + 40);

  // Angriffsmuster über Generatoren abarbeiten
  b.wait -= dt;
  let guard = 0;
  while (b.wait <= 0 && guard++ < 50) {
    if (!b.co) {
      let i;
      do { i = randInt(0, b.def.patterns.length - 1); } while (i === b.lastPattern && b.def.patterns.length > 1);
      b.lastPattern = i;
      b.co = b.def.patterns[i](b);
    }
    const r = b.co.next();
    if (r.done) {
      b.co = null;
      b.wait += b.enraged ? 0.7 : 1.2;
    } else {
      b.wait += r.value;
    }
  }
}

/* ---------------- Laser ---------------- */
function addLaser(owner, angle, warm, dur, width, rotSpeed, warnOnly = false) {
  lasers.push({ owner, angle, warm, dur, width, rotSpeed, t: 0, warnOnly });
}
function laserEnds(l) {
  const len = Math.hypot(W, H) * 1.2;
  return { x1: l.owner.x, y1: l.owner.y, x2: l.owner.x + Math.cos(l.angle) * len, y2: l.owner.y + Math.sin(l.angle) * len };
}

/* ---------------- Partikel & Texte ---------------- */
function addParticle(x, y, vx, vy, life, color, size) {
  if (particles.length > 900) return;
  particles.push({ x, y, vx, vy, life, max: life, color, size });
}
function burst(x, y, color, n, spd) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), s = rand(0.2, 1) * spd;
    addParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.3, 0.9), color, rand(1.5, 4));
  }
}
function addText(x, y, text, color, size = 14) {
  texts.push({ x, y, text, color, size, life: 1.1 });
}
function circle(x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}

/* ---------------- Spieler ---------------- */
function updatePlayer(dt) {
  const p = player;
  if (p.dead) return;
  let mx = 0, my = 0;
  if (keys.KeyW || keys.ArrowUp) my -= 1;
  if (keys.KeyS || keys.ArrowDown) my += 1;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1;
  if (keys.KeyD || keys.ArrowRight) mx += 1;
  const l = Math.hypot(mx, my) || 1;
  const tx = (mx / l) * p.speed, ty = (my / l) * p.speed;
  p.vx += (tx - p.vx) * Math.min(1, dt * 12);
  p.vy += (ty - p.vy) * Math.min(1, dt * 12);
  p.x = clamp(p.x + p.vx * dt, p.r, W - p.r);
  p.y = clamp(p.y + p.vy * dt, p.r, H - p.r);
  p.aim = Math.atan2(mouse.y - p.y, mouse.x - p.x);

  // Triebwerksflamme
  if (mx || my) {
    const ba = p.aim + Math.PI;
    addParticle(p.x + Math.cos(ba) * 12, p.y + Math.sin(ba) * 12,
      Math.cos(ba + rand(-0.3, 0.3)) * 120, Math.sin(ba + rand(-0.3, 0.3)) * 120, 0.25, pick(['#59c7ff', '#a0e6ff', '#ffffff']), 2.5);
  }

  p.invuln = Math.max(0, p.invuln - dt);
  p.fireT -= dt;
  p.surgeT = Math.max(0, p.surgeT - dt);
  if (game.phase !== 'zoom' && p.ultCharge < p.ultCD) p.ultCharge = Math.min(p.ultCD, p.ultCharge + dt);
  if (!p.ultReady && p.ultCharge >= p.ultCD) { p.ultReady = true; addText(p.x, p.y - 36, 'ULTIMATE BEREIT [Q]', '#7fe8ff', 15); }
  if ((mouse.down || keys.Space || autoFire) && p.fireT <= 0) {
    p.fireT = p.fireDelay * (p.surgeT > 0 ? 0.5 : 1);
    shoot();
  }

  if (p.shield < p.shieldMax) {
    p.shieldT += dt;
    if (p.shieldT >= 8) { p.shieldT = 0; p.shield++; }
  }
  if (p.regen > 0 && p.hp < p.maxHp) {
    p.regenT += dt;
    if (p.regenT >= 24 / p.regen) { p.regenT = 0; p.hp++; addText(p.x, p.y - 24, '+1 ❤', '#ff7a9c', 14); }
  }
}

function shoot() {
  const p = player;
  const spread = 0.11;
  const mk = (a) => {
    const crit = Math.random() < p.crit;
    bullets.push({
      x: p.x + Math.cos(a) * 14, y: p.y + Math.sin(a) * 14,
      vx: Math.cos(a) * p.bulletSpeed, vy: Math.sin(a) * p.bulletSpeed,
      r: p.bulletSize + (crit ? 1 : 0), dmg: p.dmg * (crit ? 2 : 1), crit,
      pierce: p.pierce, hit: new Set(), life: 1.6,
    });
  };
  for (let i = 0; i < p.shots; i++) mk(p.aim + (i - (p.shots - 1) / 2) * spread);
  for (let i = 0; i < p.rear; i++) mk(p.aim + Math.PI + (i - (p.rear - 1) / 2) * 0.25);
}

function hurtPlayer() {
  const p = player;
  if (p.invuln > 0 || p.dead || game.phase === 'zoom') return;
  if (p.shield > 0) {
    p.shield--; p.shieldT = 0; p.invuln = 0.6;
    burst(p.x, p.y, '#6fd6ff', 16, 180);
    addText(p.x, p.y - 26, 'Schild!', '#6fd6ff', 14);
    return;
  }
  p.hp--;
  p.invuln = 1.3;
  shake = Math.max(shake, 9);
  flash = 0.25;
  burst(p.x, p.y, '#ff6b6b', 20, 220);
  if (p.hp <= 0) {
    p.dead = true;
    burst(p.x, p.y, '#ffffff', 60, 380);
    burst(p.x, p.y, '#59c7ff', 60, 260);
    shake = 20;
    game.phase = 'dying';
    game.phaseT = 1.8;
  }
}

/* ---------------- Ultimate: Nova ---------------- */
function useUlt() {
  const p = player;
  if (state !== 'playing' || !p || p.dead || game.phase === 'zoom' || p.ultCharge < p.ultCD) return;
  p.ultCharge = 0; p.ultReady = false;
  const maxR = 480 + 110 * p.ultPow;
  const dmg = (20 + 8 * p.dmg) * (1 + 0.5 * p.ultPow);
  novas.push({ x: p.x, y: p.y, r: 0, maxR, dmg, hit: new Set(), delay: 0 });
  for (let i = 1; i <= p.ultEcho; i++) novas.push({ x: p.x, y: p.y, r: 0, maxR, dmg: dmg * 0.6, hit: new Set(), delay: 0.4 * i });
  p.invuln = Math.max(p.invuln, 0.7 + 1.3 * p.ultInv);
  if (p.ultSurge) p.surgeT = 3 + 2 * p.ultSurge;
  shake = Math.max(shake, 16); flash = Math.max(flash, 0.35);
  burst(p.x, p.y, '#7fe8ff', 50, 520);
  burst(p.x, p.y, '#ffffff', 30, 380);
  addText(p.x, p.y - 34, 'NOVA!', '#7fe8ff', 24);
}

function updateNovas(dt) {
  for (const n of novas) {
    if (n.delay > 0) {
      n.delay -= dt;
      if (n.delay <= 0) { n.x = player.x; n.y = player.y; shake = Math.max(shake, 8); }
      continue;
    }
    n.r += 1300 * dt;
    for (const e of enemies) {
      if (e.dead || n.hit.has(e) || e.entering || e.fade) continue;
      if (Math.hypot(e.x - n.x, e.y - n.y) < n.r + e.r) {
        n.hit.add(e);
        damageEnemy(e, e.boss ? n.dmg * 0.6 : n.dmg, false);
        burst(e.x, e.y, '#7fe8ff', 8, 200);
      }
    }
    for (const b of eBullets) {
      if (b.life > 0 && dist2(b.x, b.y, n.x, n.y) < n.r * n.r) {
        b.life = 0;
        addParticle(b.x, b.y, rand(-60, 60), rand(-60, 60), 0.3, '#bff3ff', 3);
      }
    }
  }
  novas = novas.filter(n => n.delay > 0 || n.r < n.maxR);
}

/* ---------------- Boss-Mechaniken ---------------- */
function applyPull(dt) { // Graviton zieht das Schiff an
  if (player.dead) return;
  for (const e of enemies) {
    if (!e.boss || !(e.pulling > 0)) continue;
    const dx = e.x - player.x, dy = e.y - player.y, d = Math.hypot(dx, dy) || 1;
    const sp = 70 + 170 * (1 - clamp(d / 900, 0, 1));
    player.x = clamp(player.x + dx / d * sp * dt, player.r, W - player.r);
    player.y = clamp(player.y + dy / d * sp * dt, player.r, H - player.r);
  }
}
function linkBeam() { // Zwillinge: der Strahl zwischen ihnen verletzt
  if (player.dead) return;
  for (const e of enemies) {
    if (!e.boss || !e.partner || e.partner.dead || e.side > 0 || e.entering || e.partner.entering) continue;
    if (segDist2(player.x, player.y, e.x, e.y, e.partner.x, e.partner.y) < (8 + player.r * 0.6) ** 2) hurtPlayer();
  }
}

/* ---------------- Zoom-Sequenz nach dem ersten Phantom ---------------- */
const ZOOM_T = 5.2;
function startZoom() {
  game.phase = 'zoom'; game.zoomT = 0; game.zoomFrom = zoom; game.ringT = 0; game.zoomFlash = false;
  addStarsForZoom(ZOOM_TARGET);
  eBullets.length = 0; lasers.length = 0;
}
function applyZoom(z) { // skaliert das Spielfeld um die Bildmitte
  const ow = W, oh = H;
  setZoom(z);
  const dx = (W - ow) / 2, dy = (H - oh) / 2;
  const sh = o => { o.x += dx; o.y += dy; };
  sh(player);
  for (const list of [stars, bullets, eBullets, enemies, particles, texts, pickups, novas, rings]) list.forEach(sh);
}
function updateZoom(dt) {
  game.zoomT += dt;
  const t = game.zoomT;
  const k = clamp((t - 1.3) / 3.0, 0, 1);
  const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  applyZoom(game.zoomFrom + (ZOOM_TARGET - game.zoomFrom) * e);
  if (t < 4.4) shake = Math.max(shake, 2 + 4 * Math.sin(Math.PI * clamp(t / 4.4, 0, 1)));
  game.ringT -= dt;
  if (game.ringT <= 0 && t > 0.6 && t < 4.2) { game.ringT = 0.65; rings.push({ x: player.x, y: player.y, r: 20, a: 1 }); }
  if (t > 2.9 && !game.zoomFlash) { game.zoomFlash = true; flash = 0.55; burst(player.x, player.y, '#7fe8ff', 60, 600); }
  if (t >= ZOOM_T) {
    applyZoom(ZOOM_TARGET);
    game.zoomed = true;
    game.phase = 'upgrading';
    offerUpgrade('Boss', 'Das Schlachtfeld ist gewachsen – größere Kämpfe erwarten dich.', () => nextRound());
  }
}


/* ---------------- Treffer & Tod ---------------- */
function damageEnemy(e, dmg, crit) {
  e.hp -= dmg;
  e.hitFlash = 0.06;
  if (crit) addParticle(e.x + rand(-6, 6), e.y + rand(-6, 6), 0, -40, 0.4, '#ffe066', 4);
  if (e.hp <= 0 && !e.dead) killEnemy(e);
}

function killEnemy(e) {
  e.dead = true;
  game.score += e.score;
  addText(e.x, e.y, '+' + e.score, e.boss ? '#ffe066' : '#ffffff', e.boss ? 26 : 13);
  if (e.boss) {
    const rest = enemies.filter(x => x.boss && !x.dead);
    if (rest.length) { // Zwillingskampf: der Überlebende wird wütend
      for (let i = 0; i < 4; i++) burst(e.x + rand(-30, 30), e.y + rand(-30, 30), pick([e.color, '#ffffff']), 30, 340);
      shake = 20; flash = 0.25;
      eBullets.length = 0;
      for (const r of rest) {
        r.enraged = true; r.co = null; r.wait = 1.2;
        addText(r.x, r.y - r.r - 20, 'ALLEIN!', '#ff4d4d', 22);
      }
      return;
    }
    for (let i = 0; i < 6; i++) burst(e.x + rand(-40, 40), e.y + rand(-40, 40), pick([e.color, '#ffffff', '#ffe066']), 40, 420);
    shake = 28;
    flash = 0.5;
    eBullets.length = 0;
    lasers.length = 0;
    for (const m of enemies) if (m.minion && !m.dead) { m.dead = true; burst(m.x, m.y, m.color, 10, 150); }
    game.bossesDefeated++;
    game.lastBossName = e.name;
    game.boss = null;
    game.phase = 'clear';
    game.phaseT = 2.2;
    game.banner = { text: 'BOSS BESIEGT!', sub: '+' + e.score + ' Punkte', t: 2.2, color: '#ffe066' };
    player.hp = Math.min(player.maxHp, player.hp + 2);
  } else {
    burst(e.x, e.y, e.color, e.type === 'tank' ? 34 : 16, e.type === 'tank' ? 260 : 190);
    shake = Math.max(shake, e.type === 'tank' ? 7 : 2);
    if (!e.minion && Math.random() < 0.06) pickups.push({ x: e.x, y: e.y, t: 0, life: 9 });
  }
}

/* ---------------- Haupt-Update ---------------- */
function update(dt) {
  game.time += dt;
  updatePlayer(dt);
  applyPull(dt);

  // Rundenlogik
  if (game.banner) { game.banner.t -= dt; if (game.banner.t <= 0) game.banner = null; }
  if (game.phase === 'wave') {
    if (game.spawnQueue.length) {
      game.spawnT -= dt;
      if (game.spawnT <= 0) {
        const group = Math.min(game.spawnQueue.length, randInt(1, 2 + Math.floor(game.normalWaves / 3)));
        for (let i = 0; i < group; i++) spawnEnemy(game.spawnQueue.shift());
        game.spawnT = Math.max(0.35, 1.3 - game.normalWaves * 0.07) * rand(0.7, 1.3);
      }
    } else if (!enemies.length) {
      game.phase = 'idle';
      game.phaseT = 1.6;
      game.banner = { text: 'Welle geschafft!', sub: '', t: 1.5, color: '#9dffb0' };
    }
  } else if (game.phase === 'idle') {
    game.phaseT -= dt;
    if (game.phaseT <= 0) nextRound();
  } else if (game.phase === 'boss') {
    if (!game.boss) {
      game.phaseT -= dt;
      if (game.phaseT <= 0) spawnBoss();
    }
  } else if (game.phase === 'clear') {
    game.phaseT -= dt;
    if (game.phaseT <= 0) {
      if (game.lastBossName === 'PHANTOM' && !game.zoomed) {
        startZoom();
      } else {
        game.phase = 'upgrading';
        offerUpgrade('Boss', `${game.bossesDefeated}. Boss besiegt – dein Schiff wird verbessert.`, () => nextRound());
        return;
      }
    }
  } else if (game.phase === 'zoom') {
    updateZoom(dt);
    if (state !== 'playing') return;
  } else if (game.phase === 'dying') {
    game.phaseT -= dt;
    if (game.phaseT <= 0) { gameOver(); return; }
  }

  // Spieler-Geschosse
  for (const b of bullets) {
    if (player.homing > 0) {
      let best = null, bd = 1e12;
      for (const e of enemies) {
        if (e.dead || b.hit.has(e)) continue;
        const d = dist2(b.x, b.y, e.x, e.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (best && bd < 380 * 380) {
        const cur = Math.atan2(b.vy, b.vx);
        const want = Math.atan2(best.y - b.y, best.x - b.x);
        const turn = clamp(angDiff(cur, want), -1, 1) * player.homing * 3.2 * dt;
        const sp = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(cur + turn) * sp; b.vy = Math.sin(cur + turn) * sp;
      }
    }
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    for (const e of enemies) {
      if (e.dead || b.hit.has(e) || (e.boss && (e.entering || e.fade))) continue;
      if (dist2(b.x, b.y, e.x, e.y) < (b.r + e.r) ** 2) {
        b.hit.add(e);
        damageEnemy(e, b.dmg, b.crit);
        addParticle(b.x, b.y, -b.vx * 0.05, -b.vy * 0.05, 0.2, b.crit ? '#ffe066' : '#bff3ff', 2);
        if (b.pierce-- <= 0) { b.life = 0; break; }
      }
    }
  }
  bullets = bullets.filter(b => b.life > 0 && onScreen(b, 30));

  // Gegner
  for (const e of enemies) {
    if (e.dead) continue;
    if (e.boss) updateBoss(e, dt); else updateEnemy(e, dt);
    if (!player.dead && !(e.boss && e.fade) && dist2(e.x, e.y, player.x, player.y) < (e.r * 0.85 + player.r) ** 2) {
      hurtPlayer();
      if (!e.boss) damageEnemy(e, 6, false);
    }
  }
  enemies = enemies.filter(e => !e.dead);

  linkBeam();
  updateNovas(dt);

  // Gegner-Geschosse
  for (const b of eBullets) {
    if (b.orbit) { // kreisende Geschosse (Graviton)
      const o = b.orbit;
      o.t -= dt; o.a += o.w * dt; o.r += o.grow * dt;
      if (o.owner.dead) b.life = 0;
      b.x = o.owner.x + Math.cos(o.a) * o.r; b.y = o.owner.y + Math.sin(o.a) * o.r;
      if (o.t <= 0) { b.vx = Math.cos(o.a) * o.release; b.vy = Math.sin(o.a) * o.release; b.orbit = null; }
    }
    if (b.homing && !player.dead) {
      const cur = Math.atan2(b.vy, b.vx);
      const want = Math.atan2(player.y - b.y, player.x - b.x);
      const turn = clamp(angDiff(cur, want), -1, 1) * b.homing * dt;
      const sp = Math.min(b.maxSpeed, Math.hypot(b.vx, b.vy) + 80 * dt);
      b.vx = Math.cos(cur + turn) * sp; b.vy = Math.sin(cur + turn) * sp;
      if (Math.random() < 0.6) addParticle(b.x, b.y, -b.vx * 0.2, -b.vy * 0.2, 0.3, '#fff59d', 2);
    }
    if (b.accel) {
      const sp = Math.hypot(b.vx, b.vy) || 1;
      const ns = Math.min(b.maxSpeed, sp + b.accel * dt);
      b.vx *= ns / sp; b.vy *= ns / sp;
    }
    if (b.mine !== undefined) {
      b.mine -= dt;
      if (b.mine <= 0) {
        b.life = 0;
        const off = rand(0, TAU), n = b.splitN || 6;
        for (let k = 0; k < n; k++) fireEnemy(b.x, b.y, off + k * TAU / n, 150, b.splitColor || '#e0b0ff', 5);
        continue;
      }
    }
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (!player.dead && dist2(b.x, b.y, player.x, player.y) < (b.r + player.r * 0.7) ** 2) {
      b.life = 0;
      hurtPlayer();
    }
  }
  eBullets = eBullets.filter(b => b.life > 0 && onScreen(b, 80));

  // Laser
  for (const l of lasers) {
    l.t += dt;
    if (l.owner.dead) l.t = 1e9;
    if (l.t > l.warm) l.angle += l.rotSpeed * dt;
    if (!l.warnOnly && l.t > l.warm && l.t < l.warm + l.dur && !player.dead) {
      const s = laserEnds(l);
      if (segDist2(player.x, player.y, s.x1, s.y1, s.x2, s.y2) < (l.width / 2 + player.r * 0.6) ** 2) hurtPlayer();
    }
  }
  lasers = lasers.filter(l => l.t < l.warm + l.dur);

  // Heil-Pickups
  for (const pk of pickups) {
    pk.t += dt;
    const d = Math.hypot(player.x - pk.x, player.y - pk.y);
    if (d < 120 && !player.dead) { pk.x += (player.x - pk.x) / d * 260 * dt; pk.y += (player.y - pk.y) / d * 260 * dt; }
    if (d < player.r + 10 && !player.dead) {
      pk.t = 1e9;
      if (player.hp < player.maxHp) { player.hp++; addText(player.x, player.y - 24, '+1 ❤', '#ff7a9c', 15); }
      else { game.score += 50; addText(player.x, player.y - 24, '+50', '#ffffff', 13); }
    }
  }
  pickups = pickups.filter(pk => pk.t < pk.life);

  // Partikel & Texte
  for (const p of particles) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= Math.pow(0.12, dt); p.vy *= Math.pow(0.12, dt);
    p.life -= dt;
  }
  particles = particles.filter(p => p.life > 0);
  for (const r of rings) { r.r += 760 * dt; r.a -= dt * 0.55; }
  rings = rings.filter(r => r.a > 0);
  for (const t of texts) { t.y -= 35 * dt; t.life -= dt; }
  texts = texts.filter(t => t.life > 0);
}

/* ---------------- Zeichnen ---------------- */
function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function poly(pts) {
  ctx.beginPath();
  pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]));
  ctx.closePath();
}

let shooters = [];
function drawBackground(dt) {
  ctx.fillStyle = '#03040d';
  ctx.fillRect(0, 0, W, H);
  const live = game && player && state !== 'menu';
  const px = live ? player.x / W - 0.5 : 0, py = live ? player.y / H - 0.5 : 0;
  if (nebula) {
    const ow = W * 1.12, oh = H * 1.12;
    ctx.drawImage(nebula, -(ow - W) / 2 - px * 34, -(oh - H) / 2 - py * 24, ow, oh);
  }
  // Ringplanet
  const pr = Math.min(W, H) * 0.15, pcx = W * 0.85 - px * 16, pcy = H * 0.82 - py * 12;
  let g = ctx.createRadialGradient(pcx, pcy, pr * 0.9, pcx, pcy, pr * 1.7);
  g.addColorStop(0, 'rgba(90,120,255,0.28)'); g.addColorStop(1, 'rgba(90,120,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(pcx, pcy, pr * 1.7, 0, TAU); ctx.fill();
  g = ctx.createRadialGradient(pcx - pr * 0.4, pcy - pr * 0.4, pr * 0.1, pcx, pcy, pr);
  g.addColorStop(0, '#5a72c9'); g.addColorStop(0.55, '#2a3a85'); g.addColorStop(1, '#070a1f');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(pcx, pcy, pr, 0, TAU); ctx.fill();
  ctx.save(); ctx.translate(pcx, pcy); ctx.rotate(-0.4);
  ctx.strokeStyle = 'rgba(170,190,255,0.22)'; ctx.lineWidth = pr * 0.09;
  ctx.beginPath(); ctx.ellipse(0, 0, pr * 1.65, pr * 0.34, 0, 0, TAU); ctx.stroke();
  ctx.restore();

  // Sterne
  const moving = state !== 'paused' && state !== 'upgrade' && !(game && game.phase === 'zoom');
  const pvx = live && state === 'playing' ? player.vx : 0;
  const pvy = live && state === 'playing' ? player.vy : 0;
  for (const s of stars) {
    if (moving) {
      s.y += (25 + 60 * s.z) * s.z * dt - pvy * 0.04 * s.z * dt;
      s.x -= pvx * 0.04 * s.z * dt;
      s.tw += dt * 2;
      if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
      if (s.y < 0) s.y = H;
      if (s.x > W) s.x = 0;
      if (s.x < 0) s.x = W;
    }
    ctx.globalAlpha = 0.35 + 0.65 * s.z * (0.75 + 0.25 * Math.sin(s.tw));
    ctx.fillStyle = s.col;
    const sz = s.z * 2;
    ctx.fillRect(s.x, s.y, sz, sz);
    if (s.z === 1) { ctx.globalAlpha *= 0.25; ctx.fillRect(s.x - 1.5, s.y - 1.5, sz + 3, sz + 3); }
  }
  ctx.globalAlpha = 1;

  // Sternschnuppen
  if (moving && Math.random() < dt * 0.3) shooters.push({ x: rand(0, W), y: rand(0, H * 0.5), vx: rand(500, 800), vy: rand(200, 400), life: 0.6 });
  ctx.lineWidth = 1.5;
  for (const s of shooters) {
    if (moving) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; }
    ctx.strokeStyle = `rgba(200,220,255,${Math.max(0, s.life)})`;
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 0.06, s.y - s.vy * 0.06); ctx.stroke();
  }
  shooters = shooters.filter(s => s.life > 0);
}

function drawPlayer() {
  const p = player;
  if (p.dead) return;
  if (p.invuln > 0 && p.invuln < 2.5 && Math.floor(p.invuln * 20) % 2 === 0) return;
  const moving = Math.hypot(p.vx, p.vy) > 30, t = game.time;
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.aim);
  // Triebwerk
  ctx.globalCompositeOperation = 'lighter';
  const fl = (moving ? 16 : 9) + Math.sin(t * 60) * 3 + Math.random() * 3;
  glowRaw(-12, 0, moving ? 32 : 24, '#3fa9ff', 0.85);
  ctx.fillStyle = '#7fd4ff'; poly([[-8, -4.5], [-8 - fl, 0], [-8, 4.5]]); ctx.fill();
  ctx.fillStyle = '#ffffff'; poly([[-8, -2], [-8 - fl * 0.55, 0], [-8, 2]]); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  // Rumpf
  const g = ctx.createLinearGradient(0, -15, 0, 15);
  g.addColorStop(0, '#7f95c9'); g.addColorStop(0.5, '#eef4ff'); g.addColorStop(1, '#7f95c9');
  ctx.fillStyle = g;
  poly([[20, 0], [4, -5], [-8, -15], [-13, -13], [-7, -4], [-11, 0], [-7, 4], [-13, 13], [-8, 15], [4, 5]]);
  ctx.fill();
  ctx.strokeStyle = '#2c5bd6'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = '#2f6bff'; poly([[10, 0], [-4, -3], [-4, 3]]); ctx.fill();
  ctx.fillStyle = '#aef0ff'; ctx.beginPath(); ctx.ellipse(3, 0, 5, 2.6, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = Math.floor(t * 3) % 2 ? '#ff4d6d' : '#4dffb0';
  ctx.beginPath(); ctx.arc(-10, -14, 1.7, 0, TAU); ctx.arc(-10, 14, 1.7, 0, TAU); ctx.fill();
  ctx.restore();
  if (p.shield > 0) {
    ctx.strokeStyle = `rgba(111,214,255,${0.4 + 0.2 * Math.sin(t * 6)})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 9, 0, TAU); ctx.stroke();
  }
  if (p.ultCharge >= p.ultCD) { // Ultimate bereit
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(127,232,255,${0.25 + 0.2 * Math.sin(t * 8)})`;
    ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 17 + Math.sin(t * 8) * 2, 0, TAU); ctx.stroke();
    ctx.restore();
  }
}

function drawEnemy(e) {
  if (e.boss) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    glowRaw(e.x, e.y, e.r * 2.6, e.color, (e.enraged ? 0.4 : 0.22) + 0.08 * Math.sin(e.t * 5));
    ctx.restore();
    e.def.draw(e);
    return;
  }
  const c = e.hitFlash > 0 ? '#ffffff' : e.color, r = e.r;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  glowRaw(e.x, e.y, r * 2.1, e.color, 0.28);
  ctx.restore();
  ctx.save();
  ctx.translate(e.x, e.y); ctx.rotate(e.rot);
  ctx.lineJoin = 'round';
  ctx.fillStyle = c; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.3;
  const shade = 'rgba(0,0,0,0.32)';
  if (e.type === 'drone' || e.type === 'minion') {
    poly([[r, 0], [-r * .15, -r * .5], [-r * .95, -r * .95], [-r * .55, 0], [-r * .95, r * .95], [-r * .15, r * .5]]);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = shade; poly([[r * .55, 0], [-r * .2, -r * .25], [-r * .45, 0], [-r * .2, r * .25]]); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(r * .2, 0, r * .16, 0, TAU); ctx.fill();
  } else if (e.type === 'dart') {
    if (e.mode === 1) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowRaw(-r, 0, r * 2.4, '#ffcc33', 0.9); ctx.restore(); }
    poly([[r * 1.5, 0], [r * .1, -r * .45], [-r * 1.05, -r * .7], [-r * .6, 0], [-r * 1.05, r * .7], [r * .1, r * .45]]);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = shade; poly([[r, 0], [-r * .3, -r * .15], [-r * .3, r * .15]]); ctx.fill();
  } else if (e.type === 'gunner') {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r * .62, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#0b2a3a'; ctx.fillRect(0, -3, r + 7, 6);
    ctx.beginPath(); ctx.arc(0, 0, r * .4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#aef0ff'; ctx.beginPath(); ctx.arc(0, 0, r * .2, 0, TAU); ctx.fill();
  } else if (e.type === 'tank') {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8, rad = i % 2 ? r * .8 : r; ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2b1550'; ctx.beginPath(); ctx.arc(0, 0, r * .62, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, r * .62, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#e0c4ff'; ctx.beginPath(); ctx.arc(0, 0, r * .26, 0, TAU); ctx.fill();
  }
  ctx.restore();
  if (e.maxHp > 3 && e.hp < e.maxHp) {
    ctx.fillStyle = '#00000099'; ctx.fillRect(e.x - e.r, e.y - e.r - 10, e.r * 2, 4);
    ctx.fillStyle = e.color; ctx.fillRect(e.x - e.r, e.y - e.r - 10, e.r * 2 * (e.hp / e.maxHp), 4);
  }
}

function drawLasers() {
  for (const l of lasers) {
    const s = laserEnds(l);
    if (l.t < l.warm) {
      const k = l.t / l.warm;
      ctx.strokeStyle = `rgba(255,70,90,${0.25 + 0.5 * k * (0.5 + 0.5 * Math.sin(l.t * 40))})`;
      ctx.lineWidth = 1 + k * 3;
      ctx.setLineDash([12, 10]);
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
      ctx.setLineDash([]);
    } else if (!l.warnOnly) {
      const k = Math.min(1, (l.warm + l.dur - l.t) / 0.15);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(255,40,70,${0.45 * k})`;
      ctx.lineWidth = l.width * 1.9;
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
      ctx.strokeStyle = `rgba(255,120,140,${0.6 * k})`;
      ctx.lineWidth = l.width * 1.1;
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
      ctx.strokeStyle = `rgba(255,235,238,${0.95 * k})`;
      ctx.lineWidth = l.width * 0.42;
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
      glowRaw(s.x1, s.y1, l.width * 2.6, '#ff3a55', 0.9 * k);
      ctx.restore();
    }
  }
}

function drawLinkBeam() {
  for (const e of enemies) {
    if (!e.boss || !e.partner || e.partner.dead || e.side > 0) continue;
    const a = e, b = e.partner, live = !a.entering && !b.entering;
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (const [col, w, amp] of [['rgba(255,150,90,0.35)', 9, 5], ['rgba(140,220,255,0.35)', 9, -5], ['rgba(255,255,255,0.95)', 2.2, 2]]) {
      ctx.strokeStyle = live ? col : 'rgba(255,255,255,0.15)'; ctx.lineWidth = live ? w : 1;
      ctx.beginPath();
      for (let i = 0; i <= 28; i++) {
        const f = i / 28, off = Math.sin(f * 18 + game.time * 14) * amp * Math.sin(f * Math.PI);
        const x = a.x + dx * f + nx * off, y = a.y + dy * f + ny * off;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawNovas() {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const n of novas) {
    if (n.delay > 0) continue;
    const k = 1 - n.r / n.maxR;
    const gr = ctx.createRadialGradient(n.x, n.y, Math.max(0, n.r * 0.4), n.x, n.y, n.r + 1);
    gr.addColorStop(0, 'rgba(80,180,255,0)');
    gr.addColorStop(1, `rgba(120,220,255,${0.32 * k})`);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(110,210,255,${0.7 * k})`; ctx.lineWidth = 16 * k + 4;
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${0.95 * k})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, TAU); ctx.stroke();
  }
  for (const r of rings) {
    ctx.strokeStyle = `rgba(140,215,255,${0.6 * r.a})`; ctx.lineWidth = 3 + 10 * r.a;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

function drawHeart(x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.6, y - s * 1.2, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.6, y - s * 1.2, x + s * 1.4, y - s * 0.1, x, y + s * 0.9);
  ctx.fill();
}

/* ---- HUD (Bildschirmkoordinaten) ---- */
function txt(s, x, y, size, color, align = 'left', weight = '600') {
  ctx.font = `${weight} ${size}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}
function panel(x, y, w, h) {
  rr(x, y, w, h, 12);
  ctx.fillStyle = 'rgba(8,11,32,0.62)'; ctx.fill();
  ctx.strokeStyle = 'rgba(130,150,255,0.28)'; ctx.lineWidth = 1; ctx.stroke();
}

function drawHUD() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const p = player;

  // Links oben: Punkte & Leben
  const hRows = Math.ceil(p.maxHp / 10), sRow = p.shieldMax ? 1 : 0;
  const ph = 96 + hRows * 22 + sRow * 22 - 22;
  panel(14, 12, 250, ph);
  txt('PUNKTE', 30, 30, 11, '#7f8ac6');
  txt(game.score.toLocaleString('de-DE'), 30, 56, 30, '#ffffff', 'left', '800');
  txt(`${stageLabel()}  ·  Bosse: ${game.bossesDefeated}`, 30, 84, 13, '#9fb0ff');
  for (let i = 0; i < p.maxHp; i++) {
    ctx.fillStyle = i < p.hp ? '#ff4d6d' : '#3a2030';
    drawHeart(38 + (i % 10) * 21, 108 + Math.floor(i / 10) * 22, 8);
  }
  for (let i = 0; i < p.shieldMax; i++) {
    const x = 38 + i * 21, y = 108 + hRows * 22;
    ctx.strokeStyle = '#6fd6ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.stroke();
    if (i < p.shield) { ctx.fillStyle = '#6fd6ff'; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, TAU); ctx.fill(); }
  }

  // Rechts oben: Highscore
  panel(SW - 214, 12, 200, 62);
  txt('HIGHSCORE', SW - 28, 30, 11, '#a99b5a', 'right');
  txt(Math.max(bestScore(), game.score).toLocaleString('de-DE'), SW - 28, 52, 20, '#ffd76a', 'right', '800');
  txt((autoFire ? 'Auto-Feuer AN' : 'Auto-Feuer aus') + ' [F]', SW - 28, 86, 12, '#7f8ac6', 'right');

  // Links unten: Upgrades
  const ups = UPGRADES.filter(u => p.levels[u.id]);
  if (ups.length) {
    const per = 9, cols = Math.ceil(ups.length / per), rowsN = Math.min(per, ups.length);
    const pw = 168 * cols + 8, phh = rowsN * 20 + 16;
    panel(14, SH - phh - 14, pw, phh);
    ups.forEach((u, i) => {
      const cx = 26 + Math.floor(i / per) * 168, cy = SH - phh - 14 + 18 + (i % per) * 20;
      txt(`${u.icon} ${u.name}`, cx, cy, 12, u.id.startsWith('ult') ? '#7fe8ff' : '#aab6ff');
      txt(String(p.levels[u.id]), cx + 150, cy, 12, '#ffffff', 'right', '800');
    });
  }

  // Unten Mitte: Ultimate
  {
    const cx = SW / 2, cy = SH - 56, R = 28, prog = clamp(p.ultCharge / p.ultCD, 0, 1), ready = prog >= 1;
    const pulse = 0.5 + 0.5 * Math.sin(game.time * 7);
    if (ready) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      glowRaw(cx, cy, R * 2.6, '#4fc3ff', 0.5 + 0.3 * pulse);
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(8,11,32,0.75)'; ctx.beginPath(); ctx.arc(cx, cy, R + 4, 0, TAU); ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(90,110,200,0.3)';
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ctx.strokeStyle = ready ? '#8ff0ff' : '#4f8cff'; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + TAU * prog); ctx.stroke();
    ctx.lineCap = 'butt';
    txt(ready ? 'Q' : Math.ceil(p.ultCD - p.ultCharge) + '', cx, cy + 1, ready ? 22 : 18, ready ? '#ffffff' : '#9fb0ff', 'center', '800');
    txt(ready ? 'ULTIMATE BEREIT' : 'ULTIMATE', cx, cy - R - 14, 11, ready ? '#8ff0ff' : '#7f8ac6', 'center', '700');
  }

  // Bossleisten
  const bosses = enemies.filter(e => e.boss && !e.dead);
  const bw = Math.min(560, SW - 540);
  bosses.forEach((b, i) => {
    const bx = (SW - bw) / 2, by = 16 + i * 40;
    panel(bx - 10, by - 6, bw + 20, 36);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(bx, by + 14, bw, 8);
    ctx.fillStyle = b.enraged ? '#ff3b3b' : b.color;
    ctx.fillRect(bx, by + 14, bw * Math.max(0, b.hp / b.maxHp), 8);
    txt(b.name + (b.enraged ? '  · WÜTEND' : ''), SW / 2, by + 5, 12, '#ffffff', 'center', '700');
  });

  // Banner
  const bn = game.banner;
  if (bn) {
    ctx.globalAlpha = Math.min(1, bn.t / 0.4);
    txt(bn.text, SW / 2, SH * 0.4, 48, bn.color, 'center', '800');
    if (bn.sub) txt(bn.sub, SW / 2, SH * 0.4 + 44, 20, '#d6dcff', 'center', '500');
    ctx.globalAlpha = 1;
  }

  // Kino-Sequenz: Das Schlachtfeld wächst
  if (game.phase === 'zoom') {
    const t = game.zoomT, bk = Math.min(clamp(t / 0.7, 0, 1), clamp((ZOOM_T - t) / 0.7, 0, 1));
    const warp = Math.sin(Math.PI * clamp((t - 0.6) / 3.8, 0, 1));
    if (warp > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 1.5;
      const maxR = Math.hypot(SW, SH) / 2;
      for (let i = 0; i < 80; i++) {
        const a = (i * 2.399963) % TAU, sp = 500 + (i % 7) * 140;
        const r0 = 90 + ((i * 97 + t * sp) % maxR), len = 30 + 170 * warp * (0.4 + (i % 5) / 5);
        ctx.strokeStyle = `rgba(170,205,255,${0.38 * warp})`;
        ctx.beginPath();
        ctx.moveTo(SW / 2 + Math.cos(a) * r0, SH / 2 + Math.sin(a) * r0);
        ctx.lineTo(SW / 2 + Math.cos(a) * (r0 + len), SH / 2 + Math.sin(a) * (r0 + len));
        ctx.stroke();
      }
      ctx.restore();
    }
    const bh = SH * 0.12 * bk;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SW, bh); ctx.fillRect(0, SH - bh, SW, bh);
    const ta = clamp((t - 0.9) / 0.5, 0, 1) * clamp((ZOOM_T - 0.6 - t) / 0.5, 0, 1);
    if (ta > 0) {
      ctx.globalAlpha = ta;
      ctx.save(); ctx.letterSpacing = '8px';
      txt('SEKTOR ERWEITERT', SW / 2, SH * 0.42, Math.min(54, SW / 14), '#bfe9ff', 'center', '800');
      ctx.restore();
      txt('Das Schlachtfeld wächst. Größere Kämpfe erwarten dich.', SW / 2, SH * 0.42 + 46, Math.min(20, SW / 36), '#d6dcff', 'center', '500');
      ctx.globalAlpha = 1;
    }
  }
}

function draw(dt) {
  ctx.setTransform(DPR * zoom, 0, 0, DPR * zoom, 0, 0);
  ctx.save();
  if (shake > 0 && state === 'playing') ctx.translate(rand(-shake, shake), rand(-shake, shake));
  drawBackground(dt);
  if (!game || state === 'menu') { ctx.restore(); return; }

  // Heil-Pickups
  for (const pk of pickups) {
    if (pk.life - pk.t < 2 && Math.floor(pk.t * 8) % 2 === 0) continue;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowRaw(pk.x, pk.y, 22, '#ff5a86', 0.7); ctx.restore();
    ctx.fillStyle = '#ff7a9c';
    drawHeart(pk.x, pk.y + Math.sin(pk.t * 4) * 3, 7);
  }

  drawLasers();
  drawLinkBeam();
  for (const e of enemies) drawEnemy(e);

  // Partikel (additiv)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const q of particles) {
    ctx.globalAlpha = Math.max(0, q.life / q.max);
    ctx.fillStyle = q.color;
    ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
  }
  ctx.restore();

  // Spieler-Geschosse
  ctx.save(); ctx.lineCap = 'round';
  ctx.globalCompositeOperation = 'lighter';
  for (const b of bullets) {
    const col = b.crit ? '#ffe066' : '#6fe3ff';
    glowRaw(b.x, b.y, b.r * 4.5, col, 0.7);
    ctx.strokeStyle = col; ctx.lineWidth = b.r * 1.6;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.022, b.y - b.vy * 0.022); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = b.r * 0.7;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012); ctx.stroke();
  }
  ctx.restore();

  // Gegner-Geschosse: erst Glow, dann Körper
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const b of eBullets) glowRaw(b.x, b.y, b.r * 3.4, b.color, b.missile ? 0.5 : 0.65);
  ctx.restore();
  for (const b of eBullets) {
    if (b.mine !== undefined && !b.split) {
      const pulse = b.mine < 0.4 && Math.floor(b.mine * 20) % 2 === 0;
      circle(b.x, b.y, b.r, pulse ? '#ffffff' : '#5a189a');
      ctx.strokeStyle = b.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke();
      continue;
    }
    if (b.missile) {
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -5); ctx.lineTo(-6, 5); ctx.closePath(); ctx.fill();
      ctx.restore();
      continue;
    }
    circle(b.x, b.y, b.r, b.color);
    circle(b.x, b.y, b.r * 0.5, '#ffffff');
  }

  drawPlayer();
  drawNovas();

  // Schwebende Texte
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const t of texts) {
    ctx.globalAlpha = Math.min(1, t.life * 2);
    ctx.font = `bold ${t.size}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flash * 0.6})`;
    ctx.fillRect(0, 0, SW, SH);
  }
  drawHUD();

  // Fadenkreuz
  if (state === 'playing') {
    const mx = mouse.sx, my = mouse.sy;
    ctx.strokeStyle = '#ffffffaa'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(mx, my, 8, 0, TAU); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx - 13, my); ctx.lineTo(mx - 4, my);
    ctx.moveTo(mx + 4, my); ctx.lineTo(mx + 13, my);
    ctx.moveTo(mx, my - 13); ctx.lineTo(mx, my - 4);
    ctx.moveTo(mx, my + 4); ctx.lineTo(mx, my + 13);
    ctx.stroke();
  }
}

/* ---------------- Spielschleife ---------------- */
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  mouse.x = mouse.sx / zoom; mouse.y = mouse.sy / zoom;
  if (state === 'playing') {
    update(dt);
    shake = Math.max(0, shake - dt * 40);
    flash = Math.max(0, flash - dt);
  }
  draw(dt);
  requestAnimationFrame(frame);
}

window.addEventListener('resize', resize);
resize();
mouse.sx = SW / 2; mouse.sy = SH / 3;
buildNebula();
toMenu();
requestAnimationFrame(frame);

// Für automatisierte Tests
window.__julshot = { get state() { return state; }, get game() { return game; }, get player() { return player; },
  get enemies() { return enemies; }, get zoom() { return zoom; }, get novas() { return novas; },
  chooseUpgrade, startGame, spawnBoss: () => spawnBoss(), nextRound: () => nextRound(), useUlt: () => useUlt(), damageEnemy: (e, d) => damageEnemy(e, d, false) };
