'use strict';
/* =========================================================
   JUL SHOT – ein kleiner Weltraum-Shooter
   Steuerung: WASD fliegen, Maus zielen, Klick/Leertaste schießen
   ========================================================= */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
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
const mouse = { x: 0, y: 0, down: false };
let autoFire = false;

window.addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  onKey(e.code);
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
canvas.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('mousedown', e => { if (e.button === 0) mouse.down = true; });
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
function initStars() {
  stars = [];
  const n = Math.floor((W * H) / 3500);
  for (let i = 0; i < n; i++) {
    const layer = Math.random();
    stars.push({
      x: Math.random() * W, y: Math.random() * H,
      z: layer < 0.6 ? 0.25 : layer < 0.9 ? 0.55 : 1,
      tw: Math.random() * TAU,
    });
  }
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
];

/* ---------------- Spielzustand ---------------- */
let state = 'menu'; // menu | upgrade | playing | paused | gameover
let player, bullets, eBullets, enemies, particles, texts, lasers, pickups;
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
    levels: {},
  };
}

function resetGame() {
  player = newPlayer();
  bullets = []; eBullets = []; enemies = []; particles = []; texts = []; lasers = []; pickups = [];
  game = {
    round: 0, normalWaves: 0, bossesDefeated: 0,
    score: 0, time: 0,
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
  renderScores($('menuScores'));
  showOverlay('menu');
}

function startGame() {
  resetGame();
  offerUpgrade('Start', 'Wähle dein erstes Upgrade für den Flug.', () => nextRound());
}

let upgradeChoices = [];
let upgradeCallback = null;
function offerUpgrade(title, sub, cb) {
  state = 'upgrade';
  mouse.down = false;
  const avail = UPGRADES.filter(u => (player.levels[u.id] || 0) < u.max);
  upgradeChoices = shuffle(avail.slice()).slice(0, 3);
  upgradeCallback = cb;
  $('upTitle').textContent = title === 'Start' ? 'Wähle ein Start-Upgrade' : 'Boss besiegt! Wähle ein Upgrade';
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
  showOverlay('upgrade');
}
function chooseUpgrade(i) {
  if (state !== 'upgrade') return;
  const u = upgradeChoices[i];
  if (!u) return;
  u.apply(player);
  player.levels[u.id] = (player.levels[u.id] || 0) + 1;
  showOverlay(null);
  state = 'playing';
  addText(player.x, player.y - 30, u.name + '!', '#7fe8ff', 18);
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
  else if (state === 'upgrade' && ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].includes(code)) {
    chooseUpgrade(parseInt(code.slice(-1), 10) - 1);
  } else if (code === 'KeyP' || code === 'Escape') {
    if (state === 'playing') setPause(true);
    else if (state === 'paused') setPause(false);
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
    const def = BOSSES[game.bossesDefeated % BOSSES.length];
    game.banner = { text: 'BOSS: ' + def.name, sub: def.title, t: 2.6, color: def.color };
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
  const count = 8 + n * 3;
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
];

function spawnBoss() {
  const idx = game.bossesDefeated % BOSSES.length;
  const def = BOSSES[idx];
  const tier = Math.floor(game.bossesDefeated / BOSSES.length); // spätere Runden: stärker
  const hp = def.hp * (1 + 0.45 * game.bossesDefeated) * (1 + 0.5 * tier);
  const b = {
    def, boss: true, name: def.name, color: def.color,
    x: W / 2, y: -100, vx: 0, vy: 0, r: def.r, hp, maxHp: hp,
    score: Math.round(def.score * (1 + 0.5 * game.bossesDefeated)),
    t: 0, rot: 0, spin: 0, hitFlash: 0, enraged: false,
    co: null, wait: 2.2, lastPattern: -1, entering: true, fade: 0,
  };
  enemies.push(b);
  game.boss = b;
}

function updateBoss(b, dt) {
  b.t += dt;
  b.hitFlash = Math.max(0, b.hitFlash - dt);
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
  if ((mouse.down || keys.Space || autoFire) && p.fireT <= 0) {
    p.fireT = p.fireDelay;
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
  if (p.invuln > 0 || p.dead) return;
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
    for (let i = 0; i < 6; i++) burst(e.x + rand(-40, 40), e.y + rand(-40, 40), pick([e.color, '#ffffff', '#ffe066']), 40, 420);
    shake = 28;
    flash = 0.5;
    eBullets.length = 0;
    lasers.length = 0;
    for (const m of enemies) if (m.minion && !m.dead) { m.dead = true; burst(m.x, m.y, m.color, 10, 150); }
    game.bossesDefeated++;
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
      game.phase = 'upgrading';
      offerUpgrade('Boss', `${game.bossesDefeated}. Boss besiegt – dein Schiff wird verbessert.`, () => nextRound());
      return;
    }
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

  // Gegner-Geschosse
  for (const b of eBullets) {
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
        const off = rand(0, TAU);
        for (let k = 0; k < 6; k++) fireEnemy(b.x, b.y, off + k * TAU / 6, 150, '#e0b0ff', 5);
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
  for (const t of texts) { t.y -= 35 * dt; t.life -= dt; }
  texts = texts.filter(t => t.life > 0);
}

/* ---------------- Zeichnen ---------------- */
function drawBackground(dt) {
  const g = ctx.createRadialGradient(W * 0.5, H * 0.4, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.8);
  g.addColorStop(0, '#0d0f2b');
  g.addColorStop(1, '#03030a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const pvx = player && state === 'playing' ? player.vx : 0;
  const pvy = player && state === 'playing' ? player.vy : 0;
  for (const s of stars) {
    if (state !== 'paused' && state !== 'upgrade') {
      s.y += (25 + 60 * s.z) * s.z * dt - pvy * 0.04 * s.z * dt;
      s.x -= pvx * 0.04 * s.z * dt;
      s.tw += dt * 2;
      if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
      if (s.y < 0) s.y = H;
      if (s.x > W) s.x = 0;
      if (s.x < 0) s.x = W;
    }
    const a = 0.35 + 0.65 * s.z * (0.75 + 0.25 * Math.sin(s.tw));
    ctx.fillStyle = `rgba(200,215,255,${a})`;
    const sz = s.z * 2;
    ctx.fillRect(s.x, s.y, sz, sz);
  }
}

function drawPlayer() {
  const p = player;
  if (p.dead) return;
  if (p.invuln > 0 && Math.floor(p.invuln * 20) % 2 === 0) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.aim);
  // Rumpf
  ctx.fillStyle = '#dfe9ff';
  ctx.beginPath();
  ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-5, 0); ctx.lineTo(-10, 12); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3d7bff';
  ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -6); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#7fe8ff';
  ctx.beginPath(); ctx.arc(4, 0, 3, 0, TAU); ctx.fill();
  ctx.restore();
  if (p.shield > 0) {
    ctx.strokeStyle = `rgba(111,214,255,${0.4 + 0.2 * Math.sin(game.time * 6)})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 9, 0, TAU); ctx.stroke();
  }
}

function drawEnemy(e) {
  if (e.boss) { e.def.draw(e); return; }
  const c = e.hitFlash > 0 ? '#ffffff' : e.color;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.rot);
  ctx.fillStyle = c;
  ctx.strokeStyle = c;
  if (e.type === 'drone' || e.type === 'minion') {
    ctx.beginPath(); ctx.moveTo(e.r, 0); ctx.lineTo(-e.r * 0.7, -e.r * 0.8); ctx.lineTo(-e.r * 0.3, 0); ctx.lineTo(-e.r * 0.7, e.r * 0.8); ctx.closePath(); ctx.fill();
  } else if (e.type === 'dart') {
    ctx.beginPath(); ctx.moveTo(e.r * 1.4, 0); ctx.lineTo(-e.r, -e.r * 0.55); ctx.lineTo(-e.r, e.r * 0.55); ctx.closePath(); ctx.fill();
  } else if (e.type === 'gunner') {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6; ctx.lineTo(Math.cos(a) * e.r, Math.sin(a) * e.r); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#0b2a3a'; ctx.fillRect(0, -3, e.r + 6, 6);
    ctx.beginPath(); ctx.arc(0, 0, e.r * 0.45, 0, TAU); ctx.fill();
  } else if (e.type === 'tank') {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8; const r = i % 2 ? e.r * 0.8 : e.r; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2b1550';
    ctx.beginPath(); ctx.arc(0, 0, e.r * 0.5, 0, TAU); ctx.fill();
  }
  ctx.restore();
  // Lebensbalken für zähere Gegner
  if (e.maxHp > 3 && e.hp < e.maxHp) {
    ctx.fillStyle = '#00000088'; ctx.fillRect(e.x - e.r, e.y - e.r - 9, e.r * 2, 4);
    ctx.fillStyle = e.color; ctx.fillRect(e.x - e.r, e.y - e.r - 9, e.r * 2 * (e.hp / e.maxHp), 4);
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
      ctx.lineWidth = l.width * 1.6;
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
      ctx.strokeStyle = `rgba(255,220,225,${0.95 * k})`;
      ctx.lineWidth = l.width * 0.45;
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
      ctx.restore();
    }
  }
}

function drawHUD() {
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.font = 'bold 22px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Punkte: ' + game.score.toLocaleString('de-DE'), 18, 14);
  ctx.font = '15px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#9fb0ff';
  ctx.fillText(stageLabel() + '  ·  Bosse besiegt: ' + game.bossesDefeated, 18, 42);

  // Leben
  for (let i = 0; i < player.maxHp; i++) {
    const x = 26 + i * 22, y = 76;
    ctx.fillStyle = i < player.hp ? '#ff4d6d' : '#3a2030';
    drawHeart(x, y, 8);
  }
  for (let i = 0; i < player.shieldMax; i++) {
    ctx.strokeStyle = '#6fd6ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(26 + i * 22, 102, 7, 0, TAU); ctx.stroke();
    if (i < player.shield) circle(26 + i * 22, 102, 4.5, '#6fd6ff');
  }

  // Scoreboard rechts oben
  ctx.textAlign = 'right';
  ctx.font = '15px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#ffd76a';
  const hi = Math.max(bestScore(), game.score);
  ctx.fillText('Highscore: ' + hi.toLocaleString('de-DE'), W - 18, 16);
  ctx.fillStyle = '#7f8ac6';
  ctx.fillText((autoFire ? 'Auto-Feuer: AN' : 'Auto-Feuer: AUS') + '  [F]', W - 18, 38);

  // Upgrade-Liste unten links
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.font = '13px "Segoe UI", system-ui, sans-serif';
  let y = H - 14;
  for (const u of UPGRADES) {
    const lv = player.levels[u.id];
    if (!lv) continue;
    ctx.fillStyle = '#aab6ff';
    ctx.fillText(`${u.icon} ${u.name} ${lv}`, 18, y);
    y -= 18;
  }

  // Bossleiste
  const b = game.boss;
  if (b && !b.dead) {
    const bw = Math.min(520, W - 260), bx = (W - bw) / 2, by = 22;
    ctx.fillStyle = '#00000099'; ctx.fillRect(bx - 2, by - 2, bw + 4, 18);
    ctx.fillStyle = b.enraged ? '#ff3b3b' : b.color;
    ctx.fillRect(bx, by, bw * Math.max(0, b.hp / b.maxHp), 14);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(b.name, W / 2, by + 20);
  }

  // Banner
  const bn = game.banner;
  if (bn) {
    const a = Math.min(1, bn.t / 0.4);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 48px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = bn.color;
    ctx.fillText(bn.text, W / 2, H * 0.4);
    if (bn.sub) {
      ctx.font = '20px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = '#d6dcff';
      ctx.fillText(bn.sub, W / 2, H * 0.4 + 44);
    }
    ctx.globalAlpha = 1;
  }
}

function drawHeart(x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.6, y - s * 1.2, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.6, y - s * 1.2, x + s * 1.4, y - s * 0.1, x, y + s * 0.9);
  ctx.fill();
}

function draw(dt) {
  ctx.save();
  if (shake > 0 && state === 'playing') ctx.translate(rand(-shake, shake), rand(-shake, shake));
  drawBackground(dt);
  if (!game || state === 'menu') { ctx.restore(); return; }

  // Pickups
  for (const pk of pickups) {
    const blink = pk.life - pk.t < 2 && Math.floor(pk.t * 8) % 2 === 0;
    if (blink) continue;
    ctx.fillStyle = '#ff7a9c';
    drawHeart(pk.x, pk.y + Math.sin(pk.t * 4) * 3, 7);
  }

  drawLasers();
  for (const e of enemies) drawEnemy(e);

  // Partikel (additiv)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.restore();

  // Spieler-Geschosse
  for (const b of bullets) {
    ctx.strokeStyle = b.crit ? '#ffe066' : '#8ff0ff';
    ctx.lineWidth = b.r * 1.3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 0.018, b.y - b.vy * 0.018);
    ctx.stroke();
  }

  // Gegner-Geschosse
  for (const b of eBullets) {
    if (b.mine !== undefined) {
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
    circle(b.x, b.y, b.r + 2, b.color + '55');
    circle(b.x, b.y, b.r, b.color);
    circle(b.x, b.y, b.r * 0.45, '#ffffff');
  }

  drawPlayer();

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

  if (flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flash * 0.6})`;
    ctx.fillRect(0, 0, W, H);
  }
  drawHUD();

  // Fadenkreuz
  if (state === 'playing') {
    ctx.strokeStyle = '#ffffffaa'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 8, 0, TAU); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mouse.x - 13, mouse.y); ctx.lineTo(mouse.x - 4, mouse.y);
    ctx.moveTo(mouse.x + 4, mouse.y); ctx.lineTo(mouse.x + 13, mouse.y);
    ctx.moveTo(mouse.x, mouse.y - 13); ctx.lineTo(mouse.x, mouse.y - 4);
    ctx.moveTo(mouse.x, mouse.y + 4); ctx.lineTo(mouse.x, mouse.y + 13);
    ctx.stroke();
  }
}

/* ---------------- Spielschleife ---------------- */
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
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
mouse.x = W / 2; mouse.y = H / 3;
toMenu();
requestAnimationFrame(frame);

// Für automatisierte Tests
window.__julshot = { get state() { return state; }, get game() { return game; }, get player() { return player; },
  get enemies() { return enemies; }, chooseUpgrade, startGame, spawnBoss: () => spawnBoss() };
