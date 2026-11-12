'use strict';
/* =========================================================
   Erweiterungen: Eingabe (Gamepad/Touch), Schiffe, Waffen,
   Synergien, Drohnen, Power-ups, Elite- und neue Gegner,
   Hazards, Modifikatoren, Ultimates, neue Bosse, Kombo,
   Menüs (Hangar, Erfolge), Boss-Intro
   ========================================================= */

/* ===================== Eingabe: Gamepad & Touch ===================== */
const input = { mx: 0, my: 0, aim: null, fire: false };
const touch = { on: false, move: null, aim: null };
const padPrev = {};
const TOUCH_R = 56;
const ultBtn = () => ({ x: SW - 74, y: SH - 160, r: 40 });
const pauseBtn = () => ({ x: SW - 34, y: 108, r: 18 });

function touchVec(s) {
  if (!s) return null;
  const dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy) || 1, m = Math.min(1, d / TOUCH_R);
  return { x: dx / d * m, y: dy / d * m, m: Math.hypot(dx, dy) ? m : 0 };
}
canvas.addEventListener('touchstart', e => {
  e.preventDefault(); touch.on = true;
  for (const t of e.changedTouches) {
    const x = t.clientX, y = t.clientY, ub = ultBtn(), pb = pauseBtn();
    if (dist2(x, y, ub.x, ub.y) < ub.r ** 2) { useUlt(); continue; }
    if (dist2(x, y, pb.x, pb.y) < (pb.r + 10) ** 2) { setPause(true); continue; }
    const s = { id: t.identifier, ox: x, oy: y, x, y };
    if (x < SW / 2) { if (!touch.move) touch.move = s; } else if (!touch.aim) touch.aim = s;
  }
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) for (const k of ['move', 'aim']) {
    const s = touch[k];
    if (s && s.id === t.identifier) { s.x = t.clientX; s.y = t.clientY; }
  }
}, { passive: false });
const touchEnd = e => {
  for (const t of e.changedTouches) for (const k of ['move', 'aim']) {
    if (touch[k] && touch[k].id === t.identifier) touch[k] = null;
  }
};
canvas.addEventListener('touchend', touchEnd);
canvas.addEventListener('touchcancel', touchEnd);

function pollInput() {
  input.mx = 0; input.my = 0; input.aim = null; input.fire = false;
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = pads && [...pads].find(g => g && g.connected);
  if (gp) {
    const dz = v => Math.abs(v) < 0.22 ? 0 : v;
    input.mx += dz(gp.axes[0] || 0); input.my += dz(gp.axes[1] || 0);
    const ax = gp.axes[2] || 0, ay = gp.axes[3] || 0;
    if (Math.hypot(ax, ay) > 0.35) { input.aim = Math.atan2(ay, ax); input.fire = true; }
    const btn = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
    if (btn(7) || btn(0)) input.fire = true;
    const ult = btn(1) || btn(4) || btn(5) || btn(6);
    if (ult && !padPrev.ult) useUlt();
    padPrev.ult = ult;
    const st = btn(9);
    if (st && !padPrev.start) { if (state === 'playing') setPause(true); else if (state === 'paused') setPause(false); }
    padPrev.start = st;
  }
  const mv = touchVec(touch.move);
  if (mv) { input.mx += mv.x; input.my += mv.y; }
  const am = touchVec(touch.aim);
  if (am && am.m > 0.15) { input.aim = Math.atan2(am.y, am.x); input.fire = true; }
}

/* ===================== Schiff-Loadout ===================== */
function applyLoadout(p) {
  const sh = SHIPS[meta.sel.ship] || SHIPS.falke;
  p.maxHp = sh.hp + meta.perm.hp; p.hp = p.maxHp;
  p.speed = sh.speed; p.fireDelay = sh.fireDelay;
  p.dmg = sh.dmg * (1 + 0.06 * meta.perm.dmg);
  p.shieldMax = sh.shield; p.shield = sh.shield;
  p.droneCount = sh.drones;
  p.ultType = ULTS[meta.sel.ult] && meta.ults.includes(meta.sel.ult) ? meta.sel.ult : 'nova';
  p.ultCharge = p.ultCD * 0.25 * meta.perm.ult;
  p.hull = HULLS.find(h => h.id === meta.sel.hull && meta.hulls.includes(h.id)) || HULLS[0];
  p.weapon = 'blaster';
  p.syn = {};
}

/* ===================== Neue Upgrades ===================== */
UPGRADES.push(
  { id: 'w_spread', icon: '⁞', name: 'Streuschuss', desc: 'Waffe: breiter Fächer kurzer Schrotkugeln.', max: 1, solo: true, weapon: true, apply: p => { p.weapon = 'spread'; } },
  { id: 'w_laser', icon: '│', name: 'Laserstrahl', desc: 'Waffe: sehr schnelle, durchschlagende Strahlen.', max: 1, solo: true, weapon: true, apply: p => { p.weapon = 'laser'; } },
  { id: 'w_rocket', icon: '➳', name: 'Raketenwerfer', desc: 'Waffe: langsame Lenkraketen mit Flächenschaden.', max: 1, solo: true, weapon: true, apply: p => { p.weapon = 'rocket'; } },
  { id: 'w_chain', icon: 'ϟ', name: 'Kettenblitz', desc: 'Waffe: Treffer springen auf bis zu 3 weitere Gegner über.', max: 1, solo: true, weapon: true, apply: p => { p.weapon = 'chain'; } },
  { id: 'drone', icon: '⚙', name: 'Begleitdrohne', desc: '+1 Drohne, die schießt und Geschosse abfängt.', max: 4, apply: p => { p.droneCount += 1; } },
);

const SYNERGIES = [
  { id: 'ricochet', name: 'Querschläger', needs: ['homing', 'pierce'], desc: 'Geschosse prallen 2× an den Rändern ab.' },
  { id: 'storm', name: 'Geschosssturm', needs: ['multi', 'rate'], desc: '+1 zusätzliches Geschoss pro Schuss.', on: p => { p.shots += 1; } },
  { id: 'bulwark', name: 'Bollwerk', needs: ['shield', 'regen'], desc: 'Das Schild lädt doppelt so schnell.' },
  { id: 'deathblow', name: 'Todesstoß', needs: ['crit', 'dmg'], desc: 'Kritische Treffer richten 3× statt 2× Schaden an.' },
  { id: 'doublenova', name: 'Supernova', needs: ['ultpow', 'ultecho'], desc: 'Ultimate-Echos richten vollen Schaden an.' },
  { id: 'retreat', name: 'Rückzugsgefecht', needs: ['speed', 'rear'], desc: 'Heckschüsse richten doppelten Schaden an.' },
  { id: 'swarmlord', name: 'Schwarmgeist', needs: ['drone', 'bspeed'], desc: 'Drohnen feuern doppelt so schnell.' },
];
function checkSynergies(p) {
  for (const s of SYNERGIES) {
    if (p.syn[s.id] || !s.needs.every(n => p.levels[n] > 0)) continue;
    p.syn[s.id] = true;
    if (s.on) s.on(p);
    toast('Synergie: ' + s.name, s.desc, 'syn');
    sfx('ach');
    ach('synergy');
  }
}
function synHint(u) { // Karte würde eine Synergie vervollständigen?
  for (const s of SYNERGIES) {
    if (player.syn[s.id] || !s.needs.includes(u.id)) continue;
    if (s.needs.every(n => n === u.id || player.levels[n] > 0)) return s.name;
  }
  return null;
}

/* ===================== Upgrade-Auswahl (Seltenheit, Synergien) ===================== */
const RARITY = [null, { name: '', cls: '' }, { name: 'SELTEN', cls: 'rar2' }, { name: 'LEGENDÄR', cls: 'rar3' }];
let upgradeRar = [];
function rollRarity() { const r = rng(); return r < 0.08 ? 3 : r < 0.32 ? 2 : 1; }

function offerUpgrade(title, sub, cb) {
  state = 'upgrade';
  mouse.down = false; touch.move = touch.aim = null;
  SND.music('menu');
  const avail = UPGRADES.filter(u => (player.levels[u.id] || 0) < u.max);
  upgradeChoices = rshuffle(avail.slice()).slice(0, UPGRADE_OFFER);
  upgradeRar = upgradeChoices.map(u => (u.solo || u.max <= 1) ? 1 : rollRarity());
  picksLeft = Math.min(gameMode === 'rush' ? 3 : UPGRADE_PICKS, upgradeChoices.length);
  taken = [];
  upgradeCallback = cb;
  $('upTitle').textContent = title === 'Start' ? 'Wähle deine Start-Upgrades' : 'Boss besiegt! Wähle deine Upgrades';
  $('upSub').textContent = sub;
  const cards = $('cards');
  cards.innerHTML = '';
  if (!upgradeChoices.length) { player.hp = player.maxHp; state = 'playing'; showOverlay(null); cb(); return; }
  upgradeChoices.forEach((u, i) => {
    const lvl = player.levels[u.id] || 0, rar = upgradeRar[i];
    const div = document.createElement('div');
    div.className = 'card ' + RARITY[rar].cls;
    div.innerHTML = '<div class="key"></div><div class="icon"></div><div class="name"></div><div class="desc"></div><div class="syn"></div><div class="lvl"></div>';
    div.querySelector('.key').textContent = `[${i + 1}]` + (RARITY[rar].name ? '  ' + RARITY[rar].name : u.weapon ? '  WAFFE' : '');
    div.querySelector('.icon').textContent = u.icon;
    div.querySelector('.name').textContent = u.name;
    div.querySelector('.desc').textContent = u.desc + (rar > 1 ? ` (${rar}× Effekt)` : '');
    const add = Math.min(rar, u.max - lvl);
    div.querySelector('.lvl').textContent = u.max > 1 ? `Stufe ${lvl} → ${lvl + add} (max ${u.max})` : (u.weapon ? 'Ersetzt deine Waffe' : 'Einmalig');
    div.addEventListener('click', () => chooseUpgrade(i));
    cards.appendChild(div);
  });
  updatePicksUI();
  showOverlay('upgrade');
}
function updatePicksUI() {
  $('upSub').textContent = `Wähle ${picksLeft === 1 ? 'noch 1 Upgrade' : picksLeft + ' Upgrades'} aus ${upgradeChoices.length} Karten.`;
  [...$('cards').children].forEach((el, i) => {
    el.classList.toggle('taken', taken.includes(i));
    const h = taken.includes(i) ? null : synHint(upgradeChoices[i]);
    const s = el.querySelector('.syn');
    s.textContent = h ? '★ Synergie: ' + h : '';
  });
}
function chooseUpgrade(i) {
  if (state !== 'upgrade') return;
  const u = upgradeChoices[i];
  if (!u || taken.includes(i)) return;
  const lvl = player.levels[u.id] || 0;
  const times = Math.min(upgradeRar[i], u.max - lvl);
  for (let k = 0; k < times; k++) u.apply(player);
  player.levels[u.id] = lvl + times;
  if (player.levels[u.id] >= u.max && u.max > 1) ach('maxperk');
  checkSynergies(player);
  taken.push(i);
  picksLeft--;
  sfx('card');
  addText(player.x, player.y - 30 - taken.length * 18, u.name + '!', upgradeRar[i] === 3 ? '#ffd35a' : '#7fe8ff', 18);
  if (picksLeft > 0) { updatePicksUI(); return; }
  showOverlay(null);
  state = 'playing';
  const cb = upgradeCallback;
  upgradeCallback = null;
  if (cb) cb();
}

/* ===================== Waffen ===================== */
const WEAPON_MULT = { blaster: 1, spread: 1.35, laser: 0.5, rocket: 2.4, chain: 1.1 };
let arcs = [];

function fireWeapon(p) {
  const w = p.weapon;
  const critMul = p.syn.deathblow ? 3 : 2;
  const mk = (a, o = {}) => {
    const crit = Math.random() < p.crit;
    const spd = o.spd || p.bulletSpeed;
    const b = {
      x: p.x + Math.cos(a) * 14 + (o.ox || 0), y: p.y + Math.sin(a) * 14 + (o.oy || 0),
      vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      r: o.r || p.bulletSize + (crit ? 1 : 0), dmg: p.dmg * (o.dm || 1) * (crit ? critMul : 1), crit,
      pierce: p.pierce + (o.pierce || 0), hit: new Set(), life: o.life || 1.6, kind: o.kind || w,
      bounce: p.syn.ricochet ? 2 : 0, homeTurn: o.homeTurn, homeRange: o.homeRange, blast: o.blast,
    };
    bullets.push(b);
    return b;
  };
  if (w === 'spread') {
    const n = 5 + 2 * (p.shots - 1);
    for (let i = 0; i < n; i++) mk(p.aim + (i - (n - 1) / 2) * 0.12 + rand(-0.03, 0.03), { spd: p.bulletSpeed * rand(0.8, 1), life: 0.55, dm: 0.55, r: Math.max(2, p.bulletSize - 1) });
    sfx('shoot');
  } else if (w === 'laser') {
    for (let i = 0; i < p.shots; i++) {
      const off = (i - (p.shots - 1) / 2) * 9;
      mk(p.aim, { spd: 1300, r: 2, dm: 0.5, pierce: 4, life: 0.9, ox: -Math.sin(p.aim) * off, oy: Math.cos(p.aim) * off });
    }
    sfx('laser');
  } else if (w === 'rocket') {
    const n = Math.ceil(p.shots / 2);
    for (let i = 0; i < n; i++) mk(p.aim + (i - (n - 1) / 2) * 0.25, { spd: 380, r: 5, dm: 2.2, life: 2.6, homeTurn: 3.4, homeRange: 700, blast: 85 });
    sfx('rocket');
  } else {
    for (let i = 0; i < p.shots; i++) mk(p.aim + (i - (p.shots - 1) / 2) * 0.11);
    sfx('shoot');
  }
  for (let i = 0; i < p.rear; i++) mk(p.aim + Math.PI + (i - (p.rear - 1) / 2) * 0.25, { kind: 'blaster', dm: p.syn.retreat ? 2 : 1 });
}

function bulletColor(b) {
  if (b.crit) return '#ffe066';
  return { spread: '#ffb86b', laser: '#ff7ae6', rocket: '#ffd25a', chain: '#b49cff', drone: '#9dffc9', swarm: '#ff9a5a' }[b.kind] || '#6fe3ff';
}

function platedFactor(e, b) {
  const ang = Math.atan2(-b.vy, -b.vx);
  if (Math.abs(angDiff(e.rot, ang)) < 1.25) {
    addParticle(b.x, b.y, rand(-80, 80), rand(-80, 80), 0.25, '#ffffff', 2);
    return 0.1;
  }
  return 1.4;
}

function blast(x, y, rad, dmg, skip, color) {
  burst(x, y, color || '#ffb347', 22, 300);
  burst(x, y, '#ffffff', 8, 180);
  shake = Math.max(shake, 3);
  for (const e of enemies) {
    if (e.dead || e === skip || (e.boss && (e.entering || e.fade))) continue;
    if (Math.hypot(e.x - x, e.y - y) < rad + e.r) damageEnemy(e, dmg, false);
  }
}

function onBulletHit(b, e, x, y) {
  sfx('hit');
  if ((b.kind === 'rocket' || b.kind === 'swarm') && b.blast) { blast(x, y, b.blast, b.dmg * 0.6, e); b.life = 0; }
  else if (b.kind === 'chain') {
    let from = e, count = 0;
    const used = new Set([e]);
    while (count < 3) {
      let best = null, bd = 230 * 230;
      for (const o of enemies) {
        if (o.dead || used.has(o) || (o.boss && (o.entering || o.fade))) continue;
        const d = dist2(from.x, from.y, o.x, o.y);
        if (d < bd) { bd = d; best = o; }
      }
      if (!best) break;
      used.add(best); arcs.push({ x1: from.x, y1: from.y, x2: best.x, y2: best.y, life: 0.2 });
      damageEnemy(best, b.dmg * 0.6, false);
      from = best; count++;
    }
  }
}

function updatePlayerBullets(dt) {
  for (const b of bullets) {
    const hr = b.homeTurn || (player.homing > 0 ? player.homing * 3.2 : 0), range = b.homeRange || 380;
    if (hr) {
      let best = null, bd = range * range;
      for (const e of enemies) {
        if (e.dead || b.hit.has(e)) continue;
        const d = dist2(b.x, b.y, e.x, e.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) {
        const cur = Math.atan2(b.vy, b.vx), want = Math.atan2(best.y - b.y, best.x - b.x);
        const turn = clamp(angDiff(cur, want), -1, 1) * hr * dt * (b.homeTurn ? 1.6 : 1), sp = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(cur + turn) * sp; b.vy = Math.sin(cur + turn) * sp;
      }
    }
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.bounce > 0) {
      if (b.x < 0 || b.x > W) { b.vx = -b.vx; b.x = clamp(b.x, 0, W); b.bounce--; }
      if (b.y < 0 || b.y > H) { b.vy = -b.vy; b.y = clamp(b.y, 0, H); b.bounce--; }
    }
    if (b.kind === 'rocket' && Math.random() < 0.7) addParticle(b.x, b.y, -b.vx * 0.1, -b.vy * 0.1, 0.3, '#ffb347', 3);
    for (const e of enemies) {
      if (b.life <= 0) break;
      if (e.dead || (e.boss && (e.entering || e.fade))) continue;
      if (e.parts) {
        let hitP = false;
        for (const pt of e.parts) {
          if (pt.dead || b.hit.has(pt)) continue;
          const px = e.x + pt.ox, py = e.y + pt.oy;
          if (dist2(b.x, b.y, px, py) < (b.r + pt.r) ** 2) {
            b.hit.add(pt); damagePart(e, pt, b.dmg); onBulletHit(b, e, px, py); hitP = true;
            if (b.pierce-- <= 0) b.life = 0;
            break;
          }
        }
        if (hitP) continue;
      }
      if (b.hit.has(e)) continue;
      if (dist2(b.x, b.y, e.x, e.y) < (b.r + e.r) ** 2) {
        b.hit.add(e);
        damageEnemy(e, e.type === 'plated' ? b.dmg * platedFactor(e, b) : b.dmg, b.crit, false);
        addParticle(b.x, b.y, -b.vx * 0.05, -b.vy * 0.05, 0.2, b.crit ? '#ffe066' : '#bff3ff', 2);
        onBulletHit(b, e, b.x, b.y);
        if (b.pierce-- <= 0) b.life = 0;
      }
    }
  }
  bullets = bullets.filter(b => b.life > 0 && onScreen(b, 30));
}

function drawArcs() {
  if (!arcs.length) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (const a of arcs) {
    const al = clamp(a.life / 0.2, 0, 1);
    for (const [w, c] of [[6, `rgba(150,120,255,${0.5 * al})`], [1.8, `rgba(255,255,255,${al})`]]) {
      ctx.strokeStyle = c; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(a.x1, a.y1);
      const n = 6, dx = a.x2 - a.x1, dy = a.y2 - a.y1, l = Math.hypot(dx, dy) || 1;
      for (let i = 1; i < n; i++) ctx.lineTo(a.x1 + dx * i / n + (-dy / l) * rand(-9, 9), a.y1 + dy * i / n + (dx / l) * rand(-9, 9));
      ctx.lineTo(a.x2, a.y2); ctx.stroke();
    }
  }
  ctx.restore();
}

/* ===================== Spieler-Update ===================== */
function updatePlayer(dt) {
  const p = player;
  if (p.dead) return;
  let mx = input.mx, my = input.my;
  if (keys.KeyW || keys.ArrowUp) my -= 1;
  if (keys.KeyS || keys.ArrowDown) my += 1;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1;
  if (keys.KeyD || keys.ArrowRight) mx += 1;
  const l = Math.hypot(mx, my), k = l > 1 ? 1 / l : 1;
  const tx = mx * k * p.speed, ty = my * k * p.speed;
  p.vx += (tx - p.vx) * Math.min(1, dt * 12);
  p.vy += (ty - p.vy) * Math.min(1, dt * 12);
  p.x = clamp(p.x + p.vx * dt, p.r, W - p.r);
  p.y = clamp(p.y + p.vy * dt, p.r, H - p.r);
  p.aim = input.aim !== null ? input.aim : Math.atan2(mouse.y - p.y, mouse.x - p.x);

  if (l > 0.15) {
    const ba = p.aim + Math.PI;
    addParticle(p.x + Math.cos(ba) * 12, p.y + Math.sin(ba) * 12,
      Math.cos(ba + rand(-0.3, 0.3)) * 120, Math.sin(ba + rand(-0.3, 0.3)) * 120, 0.25, pick([p.hull.flame, '#a0e6ff', '#ffffff']), 2.5);
  }

  p.invuln = Math.max(0, p.invuln - dt);
  p.fireT -= dt;
  p.surgeT = Math.max(0, p.surgeT - dt);
  if (game.phase !== 'zoom' && p.ultCharge < p.ultCD) p.ultCharge = Math.min(p.ultCD, p.ultCharge + dt);
  if (!p.ultReady && p.ultCharge >= p.ultCD) { p.ultReady = true; addText(p.x, p.y - 36, 'ULTIMATE BEREIT [Q]', '#7fe8ff', 15); sfx('ultready'); }
  if ((mouse.down || keys.Space || autoFire || input.fire) && p.fireT <= 0) {
    p.fireT = p.fireDelay * (WEAPON_MULT[p.weapon] || 1) * (p.surgeT > 0 ? 0.5 : 1);
    fireWeapon(p);
  }

  if (p.shield < p.shieldMax) {
    p.shieldT += dt;
    if (p.shieldT >= (p.syn.bulwark ? 4 : 8)) { p.shieldT = 0; p.shield++; }
  }
  if (p.regen > 0 && p.hp < p.maxHp) {
    p.regenT += dt;
    if (p.regenT >= 24 / p.regen) { p.regenT = 0; p.hp++; addText(p.x, p.y - 24, '+1 ❤', '#ff7a9c', 14); }
  }
}

function hurtPlayer() {
  const p = player;
  if (p.invuln > 0 || p.dead || game.phase === 'zoom') return;
  if (p.shield > 0) {
    p.shield--; p.shieldT = 0; p.invuln = 0.6;
    burst(p.x, p.y, '#6fd6ff', 16, 180);
    addText(p.x, p.y - 26, 'Schild!', '#6fd6ff', 14);
    sfx('shield');
    return;
  }
  p.hp--;
  game.hits++;
  game.combo.n = Math.floor(game.combo.n / 2);
  p.invuln = 1.3;
  shake = Math.max(shake, 9);
  flash = 0.25;
  burst(p.x, p.y, '#ff6b6b', 20, 220);
  sfx('hurt');
  if (p.hp <= 0) {
    p.dead = true;
    burst(p.x, p.y, '#ffffff', 60, 380);
    burst(p.x, p.y, '#59c7ff', 60, 260);
    shake = 20;
    sfx('boom');
    game.phase = 'dying';
    game.phaseT = 1.8;
  }
}

/* ===================== Drohnen ===================== */
let drones = [];
function updateDrones(dt) {
  const p = player, n = p.dead ? 0 : p.droneCount;
  while (drones.length < n) drones.push({ x: p.x, y: p.y, fireT: rand(0, 0.5) });
  drones.length = n;
  drones.forEach((d, i) => {
    const a = game.time * 2.2 + i * TAU / n;
    d.x += (p.x + Math.cos(a) * 48 - d.x) * Math.min(1, dt * 14);
    d.y += (p.y + Math.sin(a) * 48 - d.y) * Math.min(1, dt * 14);
    d.fireT -= dt;
    if (d.fireT <= 0) {
      let best = null, bd = 400 * 400;
      for (const e of enemies) {
        if (e.dead || (e.boss && (e.entering || e.fade))) continue;
        const dd = dist2(d.x, d.y, e.x, e.y);
        if (dd < bd) { bd = dd; best = e; }
      }
      if (best) {
        d.fireT = p.syn.swarmlord ? 0.35 : 0.7;
        const ang = Math.atan2(best.y - d.y, best.x - d.x);
        bullets.push({ x: d.x, y: d.y, vx: Math.cos(ang) * 620, vy: Math.sin(ang) * 620, r: 2.5, dmg: p.dmg * 0.5, crit: false, pierce: 0, hit: new Set(), life: 1, kind: 'drone', bounce: 0 });
      } else d.fireT = 0.15;
    }
    for (const b of eBullets) {
      if (b.life > 0 && dist2(b.x, b.y, d.x, d.y) < (b.r + 9) ** 2) {
        b.life = 0; burst(b.x, b.y, '#9dffc9', 4, 120);
      }
    }
  });
}
function drawDrones() {
  for (const d of drones) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowRaw(d.x, d.y, 16, '#6dffb0', 0.7); ctx.restore();
    ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(game.time * 3);
    ctx.fillStyle = '#d6ffe9'; poly([[0, -6], [5, 0], [0, 6], [-5, 0]]); ctx.fill();
    ctx.strokeStyle = '#3ddc97'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
  }
}

/* ===================== Power-ups ===================== */
const PICKUP_TYPES = {
  heart: { color: '#ff5a86', label: '♥', name: '+1 ❤' },
  magnet: { color: '#ffd35a', label: 'M', name: 'MAGNET' },
  slow: { color: '#7fd4ff', label: '⏱', name: 'ZEITLUPE' },
  bomb: { color: '#ff8c42', label: '✹', name: 'BOMBE' },
};
function dropPickup(x, y, force) {
  const r = Math.random();
  const type = force && player.hp < player.maxHp && r < 0.3 ? 'heart' : r < 0.42 ? 'heart' : r < 0.62 ? 'magnet' : r < 0.82 ? 'slow' : 'bomb';
  pickups.push({ x, y, t: 0, life: 11, type });
}
function maybeDrop(e) {
  if (e.minion) return;
  if (e.elite || Math.random() < 0.06) dropPickup(e.x, e.y, !!e.elite);
}
function collectPickup(pk) {
  const p = player;
  sfx('pickup');
  if (pk.type === 'heart') {
    if (p.hp < p.maxHp) { p.hp++; addText(p.x, p.y - 24, '+1 ❤', '#ff7a9c', 15); }
    else { game.score += 50; addText(p.x, p.y - 24, '+50', '#ffffff', 13); }
  } else if (pk.type === 'magnet') {
    game.magnetT = 10; addText(p.x, p.y - 28, 'MAGNET! Punkte ×1,5', '#ffd35a', 16);
  } else if (pk.type === 'slow') {
    game.slowT = 5; addText(p.x, p.y - 28, 'ZEITLUPE!', '#7fd4ff', 18);
  } else if (pk.type === 'bomb') {
    eBullets.length = 0; flash = 0.4; shake = Math.max(shake, 14);
    burst(p.x, p.y, '#ff8c42', 50, 520);
    addText(p.x, p.y - 28, 'BOMBE!', '#ff8c42', 20);
    for (const e of enemies.slice()) if (!e.dead && !(e.boss && (e.entering || e.fade))) damageEnemy(e, e.boss ? 10 : 14, false);
  }
}
function updatePickups(dt) {
  for (const pk of pickups) {
    pk.t += dt;
    const d = Math.hypot(player.x - pk.x, player.y - pk.y) || 1;
    const pull = game.magnetT > 0 ? 700 : (d < 120 ? 260 : 0);
    if (pull && !player.dead) { pk.x += (player.x - pk.x) / d * pull * dt; pk.y += (player.y - pk.y) / d * pull * dt; }
    if (d < player.r + 12 && !player.dead) { pk.t = 1e9; collectPickup(pk); }
  }
  pickups = pickups.filter(pk => pk.t < pk.life);
}
function drawPickups() {
  for (const pk of pickups) {
    if (pk.life - pk.t < 2 && Math.floor(pk.t * 8) % 2 === 0) continue;
    const def = PICKUP_TYPES[pk.type], y = pk.y + Math.sin(pk.t * 4) * 3;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowRaw(pk.x, y, 26, def.color, 0.75); ctx.restore();
    if (pk.type === 'heart') { ctx.fillStyle = '#ff7a9c'; drawHeart(pk.x, y, 7); }
    else {
      circle(pk.x, y, 10, '#0b0e26');
      ctx.strokeStyle = def.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pk.x, y, 10, 0, TAU); ctx.stroke();
      txt(def.label, pk.x, y + 1, 12, def.color, 'center', '800');
    }
  }
}

/* ===================== Neue Gegner & Elite ===================== */
Object.assign(ENEMY_DEFS, {
  layer:  { r: 18, hp: 6, speed: 70,  score: 200, color: '#ff9a5e' },
  swarm:  { r: 8,  hp: 1, speed: 290, score: 60,  color: '#ff4fd8' },
  plated: { r: 20, hp: 9, speed: 85,  score: 260, color: '#9fb3c8' },
});
const hasMod = id => game.mods.includes(id);

function buildWave(n) {
  const q = [];
  const count = Math.round((8 + n * 3) * (game.zoomed ? 1.45 : 1));
  for (let i = 0; i < count; i++) {
    const pool = ['drone', 'drone', 'drone'];
    if (n >= 1) pool.push('gunner');
    if (n >= 2) pool.push('dart', 'dart');
    if (n >= 3) pool.push('gunner');
    if (n >= 4) pool.push('tank');
    if (n >= 6) pool.push('tank', 'dart');
    q.push(rpick(pool));
  }
  const insert = (t, c) => { for (let i = 0; i < c; i++) q.splice(Math.floor(rng() * (q.length + 1)), 0, t); };
  if (n >= 2) insert('swarm', Math.min(3, 1 + Math.floor(n / 4)));
  if (n >= 3) insert('layer', Math.min(2, Math.floor(n / 3)));
  if (n >= 4) insert('plated', Math.min(3, Math.floor(n / 3)));
  if (n >= 3) q.push('tank');
  if (n >= 5) q.push('tank');
  return q;
}

function spawnWaveUnit(type) {
  if (type === 'swarm') {
    const base = spawnPos(30);
    for (let i = 0; i < 6; i++) spawnEnemy('swarm', base.x + rand(-40, 40), base.y + rand(-40, 40));
    return;
  }
  const e = spawnEnemy(type);
  if (type === 'plated') e.rot = Math.atan2(player.y - e.y, player.x - e.x);
  if (['drone', 'gunner', 'dart', 'tank', 'plated'].includes(type) && game.round >= 3) {
    const chance = clamp(0.04 + 0.015 * game.normalWaves + (hasMod('elite') ? 0.2 : 0), 0, 0.4);
    if (rng() < chance) makeElite(e);
  }
}
function makeElite(e) {
  e.elite = rpick(['shield', 'blink', 'fast']);
  e.hp *= 3.2; e.maxHp = e.hp; e.r *= 1.25; e.score *= 3;
  if (e.elite === 'fast') e.speed *= 1.5;
  if (e.elite === 'shield') e.shieldUp = true;
  if (e.elite === 'blink') e.blinkT = rand(2, 3);
}

function updateEnemyExtra(e, dt, a, dist) {
  if (e.type === 'layer') { // wandert am Rand und legt Minen
    const ph = e.t * 0.3;
    const tx = W / 2 + Math.cos(ph) * W * 0.42, ty = H / 2 + Math.sin(ph) * H * 0.4;
    const d = Math.hypot(tx - e.x, ty - e.y) || 1;
    e.vx += ((tx - e.x) / d * e.speed - e.vx) * Math.min(1, dt * 1.5);
    e.vy += ((ty - e.y) / d * e.speed - e.vy) * Math.min(1, dt * 1.5);
    e.rot = e.t * 1.2;
    e.fireT -= dt;
    if (e.fireT <= 0 && onScreen(e, 0)) {
      e.fireT = rand(1.3, 2) / Math.sqrt(difficulty());
      fireEnemy(e.x, e.y, 0, 0, '#ff9a5e', 8, { mine: 5.5, life: 9 });
    }
  } else if (e.type === 'swarm') { // Kamikaze
    e.vx += (Math.cos(a) * e.speed - e.vx) * Math.min(1, dt * 4);
    e.vy += (Math.sin(a) * e.speed - e.vy) * Math.min(1, dt * 4);
    e.rot = Math.atan2(e.vy, e.vx);
  } else if (e.type === 'plated') { // Frontpanzerung: nur von hinten verwundbar
    e.rot += clamp(angDiff(e.rot, a), -1.1 * dt, 1.1 * dt);
    e.vx += (Math.cos(e.rot) * e.speed - e.vx) * Math.min(1, dt * 2);
    e.vy += (Math.sin(e.rot) * e.speed - e.vy) * Math.min(1, dt * 2);
  }
  if (e.elite === 'blink') {
    e.blinkT -= dt;
    if (e.blinkT <= 0) {
      e.blinkT = rand(2.5, 3.5);
      burst(e.x, e.y, e.color, 12, 160);
      const ang = rand(0, TAU), d = rand(180, 320);
      e.x = clamp(player.x + Math.cos(ang) * d, 30, W - 30); e.y = clamp(player.y + Math.sin(ang) * d, 30, H - 30);
      burst(e.x, e.y, '#ffd35a', 12, 160);
    }
  }
  if (e.elite === 'shield') e.shieldUp = e.hp > e.maxHp * 0.55;
}

function drawEliteAura(e) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  glowRaw(e.x, e.y, e.r * 3, '#ffd35a', 0.35 + 0.15 * Math.sin(e.t * 6));
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,211,90,0.85)'; ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]); ctx.lineDashOffset = -e.t * 20;
  ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 7, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  if (e.shieldUp) {
    ctx.strokeStyle = 'rgba(111,168,255,0.8)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 12, 0, TAU); ctx.stroke();
  }
}

/* ===================== Schaden / Tod ===================== */
function adjustDamage(e, dmg) {
  if (e.parts && e.parts.some(p => !p.dead)) dmg *= 0.12;
  if (e.boss && e.group && e.def.role !== 'shield' && e.group.some(x => !x.dead && x.def.role === 'shield')) dmg *= 0.4;
  if (e.elite === 'shield' && e.shieldUp) dmg *= 0.4;
  return dmg;
}
function damageEnemy(e, dmg, crit, splash = true) {
  if (e.dead) return;
  const hadParts = e.parts && e.parts.some(p => !p.dead);
  if (hadParts && splash) for (const pt of e.parts) if (!pt.dead) damagePart(e, pt, dmg * 0.5);
  e.hp -= adjustDamage(e, dmg);
  e.hitFlash = 0.06;
  if (crit) addParticle(e.x + rand(-6, 6), e.y + rand(-6, 6), 0, -40, 0.4, '#ffe066', 4);
  if (e.hp <= 0 && !e.dead) killEnemy(e);
}
function damagePart(e, pt, dmg) {
  if (pt.dead) return;
  pt.hp -= dmg; pt.flash = 0.06;
  if (pt.hp <= 0) {
    pt.dead = true;
    const px = e.x + pt.ox, py = e.y + pt.oy;
    burst(px, py, '#ffb347', 30, 320); burst(px, py, '#ffffff', 10, 200);
    shake = Math.max(shake, 12);
    game.score += 250; addText(px, py, '+250', '#ffe066', 16);
    dropPickup(px, py, true);
    sfx('bigkill');
  }
}

function comboMult() { return 1 + Math.min(40, game.combo.n) * 0.1; }
function addCombo() {
  game.combo.n++; game.combo.t = 2.6;
  if (comboMult() >= 5) ach('combo');
}

function killEnemy(e) {
  e.dead = true;
  let gain = e.score;
  if (!e.boss) { addCombo(); gain = Math.round(e.score * comboMult() * (game.magnetT > 0 ? 1.5 : 1)); }
  game.score += gain;
  addText(e.x, e.y, '+' + gain, e.boss ? '#ffe066' : (e.elite ? '#ffd35a' : '#ffffff'), e.boss ? 26 : 13);
  if (e.boss) {
    const rest = enemies.filter(x => x.boss && !x.dead);
    if (rest.length) { // Mehrfachkampf: Überlebende werden wütend
      for (let i = 0; i < 4; i++) burst(e.x + rand(-30, 30), e.y + rand(-30, 30), pick([e.color, '#ffffff']), 30, 340);
      shake = 20; flash = 0.25;
      eBullets.length = 0;
      sfx('bigkill');
      for (const r of rest) {
        r.enraged = true; r.co = null; r.wait = 1.2;
        addText(r.x, r.y - r.r - 20, 'ALLEIN!', '#ff4d4d', 22);
      }
      return;
    }
    for (let i = 0; i < 6; i++) burst(e.x + rand(-40, 40), e.y + rand(-40, 40), pick([e.color, '#ffffff', '#ffe066']), 40, 420);
    shake = 28; flash = 0.5;
    eBullets.length = 0; lasers.length = 0;
    for (const m of enemies) if (m.minion && !m.dead) { m.dead = true; burst(m.x, m.y, m.color, 10, 150); }
    stopHazard();
    sfx('boom');
    const encName = ENCOUNTERS[game.bossesDefeated % ENCOUNTERS.length].name;
    game.bossesDefeated++;
    game.lastBossName = e.name;
    game.boss = null;
    game.phase = 'clear';
    game.phaseT = 2.2;
    let sub = '+' + gain + ' Punkte';
    if (game.hits === 0) {
      const bonus = Math.round(1500 * (1 + 0.25 * game.bossesDefeated));
      game.score += bonus; sub += `  ·  KEIN TREFFER! +${bonus}`;
      ach('nohit');
    }
    game.banner = { text: 'BOSS BESIEGT!', sub, t: 2.2, color: '#ffe066' };
    player.hp = Math.min(player.maxHp, player.hp + 2);
    meta.stats.bosses++; saveMeta();
    ach('first_boss');
    if (encName === 'PHANTOM') ach('phantom');
    if (encName === 'IGNIS & GLACIES') ach('duo');
    if (encName === 'TRIARCHIE') ach('trio');
    if (gameMode === 'rush' && game.bossesDefeated >= 5) ach('rush5');
    if (gameMode !== 'rush' && game.bossesDefeated >= ENCOUNTERS.length) addModifier();
  } else {
    const big = e.type === 'tank' || e.elite;
    burst(e.x, e.y, e.color, big ? 34 : 16, big ? 260 : 190);
    shake = Math.max(shake, big ? 7 : 2);
    sfx(big ? 'bigkill' : 'kill');
    maybeDrop(e);
    if (hasMod('split') && !e.minion && e.type !== 'swarm' && e.type !== 'minion') {
      for (let i = 0; i < 2; i++) { const m = spawnEnemy('minion', e.x + rand(-14, 14), e.y + rand(-14, 14)); m.minion = true; }
    }
  }
}

/* ===================== Modifikatoren (Endlos) ===================== */
const MODS = [
  { id: 'fastb', name: 'Schnelle Geschosse', desc: 'Gegnergeschosse sind 25% schneller.' },
  { id: 'split', name: 'Splitter', desc: 'Gegner zerfallen beim Tod in Drohnen.' },
  { id: 'dark', name: 'Dunkelheit', desc: 'Deine Sicht ist eingeschränkt.' },
  { id: 'tough', name: 'Panzerung', desc: 'Gegner haben 40% mehr Leben.' },
  { id: 'elite', name: 'Elite-Flut', desc: 'Viel mehr Elite-Gegner.' },
  { id: 'rage', name: 'Raserei', desc: 'Gegner sind 25% schneller.' },
];
function addModifier() {
  const left = MODS.filter(m => !game.mods.includes(m.id));
  if (!left.length) return;
  const m = rpick(left);
  game.mods.push(m.id);
  toast('Neuer Modifikator: ' + m.name, m.desc, 'mod');
}

/* ===================== Hazards ===================== */
let rocks = [];
function startHazard(kind) { game.hazard = kind || null; game.hazT = 0; game.rockT = 2; game.edgeT = 3; game.stormHurt = 0; rocks.length = 0; }
function stopHazard() { game.hazard = null; rocks.length = 0; }
function stormRadius() {
  const maxR = Math.hypot(W, H) * 0.52, minR = Math.min(W, H) * 0.3;
  return maxR + (minR - maxR) * clamp(game.hazT / 50, 0, 1);
}
function updateHazards(dt) {
  if (!game.hazard) return;
  if (!enemies.some(e => e.boss && !e.dead && !e.entering)) return;
  game.hazT += dt;
  if (game.hazard === 'rocks') {
    game.rockT -= dt;
    if (game.rockT <= 0 && rocks.length < 9) {
      game.rockT = rand(1.1, 1.8);
      const s = spawnPos(40), tx = rand(W * 0.2, W * 0.8), ty = rand(H * 0.2, H * 0.8), a = Math.atan2(ty - s.y, tx - s.x), sp = rand(90, 170), r = rand(18, 34);
      rocks.push({ x: s.x, y: s.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r, hp: r / 7, rot: rand(0, TAU), vr: rand(-1, 1), seed: rand(0, 100) });
    }
    for (const k of rocks) {
      k.x += k.vx * dt; k.y += k.vy * dt; k.rot += k.vr * dt;
      if (!player.dead && dist2(k.x, k.y, player.x, player.y) < (k.r + player.r * 0.8) ** 2) { hurtPlayer(); k.hp = 0; }
      for (const b of bullets) {
        if (b.life > 0 && dist2(b.x, b.y, k.x, k.y) < (k.r + b.r) ** 2) { k.hp -= b.dmg; if (b.pierce-- <= 0) b.life = 0; }
      }
      if (k.hp <= 0) { burst(k.x, k.y, '#b9a58a', 16, 200); k.dead = true; }
    }
    rocks = rocks.filter(k => !k.dead && k.x > -150 && k.x < W + 150 && k.y > -150 && k.y < H + 150);
  } else if (game.hazard === 'edge') {
    game.edgeT -= dt;
    if (game.edgeT <= 0) {
      game.edgeT = rand(4, 6);
      const n = 1 + (rng() < 0.4 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        if (rng() < 0.5) addLaser({ x: rand(W * 0.1, W * 0.9), y: 0 }, Math.PI / 2, 1.1, 0.5, 34, 0);
        else addLaser({ x: 0, y: rand(H * 0.1, H * 0.9) }, 0, 1.1, 0.5, 34, 0);
      }
    }
  } else if (game.hazard === 'storm') {
    const R = stormRadius();
    if (!player.dead && Math.hypot(player.x - W / 2, player.y - H / 2) > R) {
      game.stormHurt -= dt;
      if (game.stormHurt <= 0) { game.stormHurt = 1.1; hurtPlayer(); }
    } else game.stormHurt = Math.min(game.stormHurt + dt, 0.6);
  }
}
function drawHazards() {
  if (!game || !game.hazard) return;
  if (game.hazard === 'storm') {
    const R = stormRadius();
    ctx.save();
    ctx.fillStyle = 'rgba(150,20,60,0.32)';
    ctx.beginPath(); ctx.rect(-80, -80, W + 160, H + 160); ctx.arc(W / 2, H / 2, R, 0, TAU, true); ctx.fill('evenodd');
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,90,130,${0.55 + 0.2 * Math.sin(game.time * 5)})`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, R, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  for (const k of rocks) {
    ctx.save(); ctx.translate(k.x, k.y); ctx.rotate(k.rot);
    ctx.beginPath();
    for (let i = 0; i < 9; i++) { const a = i * TAU / 9, r = k.r * (0.78 + 0.22 * Math.sin(i * 12.9 + k.seed)); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath();
    const g = ctx.createRadialGradient(-k.r * 0.3, -k.r * 0.3, 2, 0, 0, k.r);
    g.addColorStop(0, '#9a8b78'); g.addColorStop(1, '#3b332b');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(k.r * 0.2, k.r * 0.15, k.r * 0.22, 0, TAU); ctx.fill();
    ctx.restore();
  }
}
function drawDarkness() {
  if (!game || !game.mods || !game.mods.includes('dark') || !player || player.dead) return;
  const x = player.x * zoom, y = player.y * zoom, r = 230 * zoom;
  const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 1.8);
  g.addColorStop(0, 'rgba(0,0,6,0)'); g.addColorStop(1, 'rgba(0,0,6,0.94)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, SW, SH);
}

/* ===================== Ultimates ===================== */
let holes = [], beams = [], ultCasts = [];

function useUlt() {
  const p = player;
  if (state !== 'playing' || !p || p.dead || game.phase === 'zoom' || p.ultCharge < p.ultCD) return;
  p.ultCharge = 0; p.ultReady = false;
  game.ultUses++;
  if (game.ultUses >= 10) ach('ultmaster');
  ultCasts.push({ delay: 0, mult: 1 });
  for (let i = 1; i <= p.ultEcho; i++) ultCasts.push({ delay: 0.4 * i, mult: p.syn.doublenova ? 1 : 0.6 });
  p.invuln = Math.max(p.invuln, 0.7 + 1.3 * p.ultInv);
  if (p.ultSurge) p.surgeT = 3 + 2 * p.ultSurge;
  sfx('ult');
}

function castUlt(mult) {
  const p = player, pow = p.ultPow;
  const dmg = (20 + 8 * p.dmg) * (1 + 0.5 * pow) * mult;
  shake = Math.max(shake, 14); flash = Math.max(flash, 0.3);
  if (p.ultType === 'blackhole') {
    const hx = clamp(p.x + Math.cos(p.aim) * 300, 90, W - 90), hy = clamp(p.y + Math.sin(p.aim) * 300, 90, H - 90);
    holes.push({ x: hx, y: hy, t: 0, dur: 3.4 + 0.5 * pow, R: 300 + 55 * pow, dmg, tick: 0 });
    addText(p.x, p.y - 34, 'SCHWARZES LOCH!', '#b49cff', 20);
  } else if (p.ultType === 'laser') {
    beams.push({ t: 0, dur: 1.9, a0: p.aim - 0.95, a1: p.aim + 0.95, width: 56 + 10 * pow, dmg, tick: 0 });
    addText(p.x, p.y - 34, 'ORBITALLASER!', '#ff7ae6', 20);
  } else if (p.ultType === 'swarm') {
    const n = 10 + 4 * pow;
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + rand(-0.2, 0.2);
      bullets.push({ x: p.x, y: p.y, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, r: 4, dmg: (6 + 3 * p.dmg) * (1 + 0.5 * pow) * mult, crit: false, pierce: 0, hit: new Set(), life: 4, kind: 'swarm', bounce: 0, homeTurn: 7, homeRange: 900, blast: 60 });
    }
    burst(p.x, p.y, '#ff9a5a', 30, 400);
    addText(p.x, p.y - 34, 'SCHWARM!', '#ff9a5a', 20);
  } else {
    novas.push({ x: p.x, y: p.y, r: 0, maxR: 480 + 110 * pow, dmg, hit: new Set(), delay: 0 });
    burst(p.x, p.y, '#7fe8ff', 50, 520); burst(p.x, p.y, '#ffffff', 30, 380);
    addText(p.x, p.y - 34, 'NOVA!', '#7fe8ff', 24);
  }
}

function updateNovas(dt) {
  for (const c of ultCasts) { c.delay -= dt; if (c.delay <= 0 && !c.done) { c.done = true; castUlt(c.mult); } }
  ultCasts = ultCasts.filter(c => !c.done);

  for (const n of novas) {
    if (n.delay > 0) { n.delay -= dt; continue; }
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
      if (b.life > 0 && dist2(b.x, b.y, n.x, n.y) < n.r * n.r) { b.life = 0; addParticle(b.x, b.y, rand(-60, 60), rand(-60, 60), 0.3, '#bff3ff', 3); }
    }
  }
  novas = novas.filter(n => n.delay > 0 || n.r < n.maxR);

  // Schwarzes Loch
  for (const h of holes) {
    h.t += dt; h.tick -= dt;
    const doTick = h.tick <= 0; if (doTick) h.tick = 0.2;
    for (const e of enemies) {
      if (e.dead || e.entering) continue;
      const d = Math.hypot(h.x - e.x, h.y - e.y);
      if (d > h.R + e.r) continue;
      if (!e.boss) { const k = 260 * (1 - d / h.R * 0.5) * dt / (d || 1); e.x += (h.x - e.x) * k; e.y += (h.y - e.y) * k; }
      if (doTick) damageEnemy(e, h.dmg * 0.12 * (e.boss ? 0.5 : 1), false);
    }
    for (const b of eBullets) {
      const d = Math.hypot(h.x - b.x, h.y - b.y);
      if (b.life <= 0 || d > h.R) continue;
      if (d < h.R * 0.55) { b.life = 0; addParticle(b.x, b.y, (h.x - b.x) * 2, (h.y - b.y) * 2, 0.25, '#b49cff', 2); }
      else { b.x += (h.x - b.x) / (d || 1) * 220 * dt; b.y += (h.y - b.y) / (d || 1) * 220 * dt; }
    }
    if (h.t >= h.dur) { // Implosion
      h.done = true;
      burst(h.x, h.y, '#b49cff', 60, 600); shake = Math.max(shake, 12);
      for (const e of enemies) if (!e.dead && !e.entering && Math.hypot(h.x - e.x, h.y - e.y) < h.R + e.r) damageEnemy(e, h.dmg * 1.2 * (e.boss ? 0.5 : 1), false);
    }
  }
  holes = holes.filter(h => !h.done);

  // Orbitallaser
  const len = Math.hypot(W, H) * 1.2;
  for (const bm of beams) {
    bm.t += dt; bm.tick -= dt;
    bm.x = player.x; bm.y = player.y;
    bm.a = bm.a0 + (bm.a1 - bm.a0) * clamp(bm.t / bm.dur, 0, 1);
    const x2 = bm.x + Math.cos(bm.a) * len, y2 = bm.y + Math.sin(bm.a) * len;
    bm.x2 = x2; bm.y2 = y2;
    if (bm.tick <= 0) {
      bm.tick = 0.08;
      for (const e of enemies) {
        if (e.dead || e.entering || e.fade) continue;
        if (segDist2(e.x, e.y, bm.x, bm.y, x2, y2) < (bm.width / 2 + e.r) ** 2) damageEnemy(e, bm.dmg * 0.4 * (e.boss ? 0.6 : 1), false);
      }
      for (const b of eBullets) if (b.life > 0 && segDist2(b.x, b.y, bm.x, bm.y, x2, y2) < (bm.width / 2 + b.r) ** 2) b.life = 0;
    }
    if (bm.t >= bm.dur) bm.done = true;
  }
  beams = beams.filter(b => !b.done);
}

function drawUltExtras() {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const h of holes) {
    const k = clamp(h.t / 0.3, 0, 1) * clamp((h.dur - h.t) / 0.4, 0, 1);
    ctx.globalAlpha = k;
    ctx.strokeStyle = 'rgba(160,120,255,0.25)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(h.x, h.y, h.R, 0, TAU); ctx.stroke();
    glowRaw(h.x, h.y, 120, '#6a3dff', 0.8);
    for (let i = 0; i < 4; i++) {
      ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.t * (2 + i * 0.7) * (i % 2 ? -1 : 1));
      ctx.strokeStyle = `rgba(190,160,255,${0.55 - i * 0.1})`; ctx.lineWidth = 5 - i;
      ctx.beginPath(); ctx.ellipse(0, 0, 48 + i * 26, 18 + i * 9, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  for (const h of holes) { ctx.globalAlpha = clamp(h.t / 0.3, 0, 1) * clamp((h.dur - h.t) / 0.4, 0, 1); circle(h.x, h.y, 28 + Math.sin(h.t * 20) * 2, '#000'); ctx.globalAlpha = 1; }

  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (const bm of beams) {
    if (bm.x2 === undefined) continue;
    const k = clamp(bm.t / 0.15, 0, 1) * clamp((bm.dur - bm.t) / 0.2, 0, 1);
    ctx.strokeStyle = `rgba(255,70,220,${0.35 * k})`; ctx.lineWidth = bm.width * 1.7;
    ctx.beginPath(); ctx.moveTo(bm.x, bm.y); ctx.lineTo(bm.x2, bm.y2); ctx.stroke();
    ctx.strokeStyle = `rgba(255,160,240,${0.6 * k})`; ctx.lineWidth = bm.width;
    ctx.beginPath(); ctx.moveTo(bm.x, bm.y); ctx.lineTo(bm.x2, bm.y2); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${0.95 * k})`; ctx.lineWidth = bm.width * 0.35;
    ctx.beginPath(); ctx.moveTo(bm.x, bm.y); ctx.lineTo(bm.x2, bm.y2); ctx.stroke();
    glowRaw(bm.x, bm.y, bm.width * 2.2, '#ff5ae0', k);
  }
  ctx.restore();
}

/* ===================== Neue Bosse ===================== */
function trioMove(b, dt) {
  const alive = b.group.filter(o => !o.dead).length;
  let tx, ty;
  if (alive > 1) {
    tx = W / 2 + b.side * W * 0.26 + Math.sin(b.t * 0.6 + b.slot) * W * 0.06;
    ty = H * (b.side === 0 ? 0.27 : 0.17) + Math.sin(b.t + b.slot) * H * 0.04;
  } else {
    tx = W / 2 + Math.sin(b.t * 0.9) * W * 0.3; ty = H * 0.22 + Math.sin(b.t * 1.3) * H * 0.08;
  }
  b.x += (tx - b.x) * Math.min(1, dt * 1.8);
  b.y += (ty - b.y) * Math.min(1, dt * 1.8);
  if (b.def.role === 'heal') {
    for (const o of b.group) if (o !== b && !o.dead) o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.012 * dt);
  }
}
function spikeShape(r, n, inner, rot) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, rad = i % 2 ? r * inner : r; ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); }
  ctx.closePath();
}

BOSSES.push(
  // ---------- 8: ALPHA (Trio, Angreifer) ----------
  {
    name: 'ALPHA', title: 'Der Zorn', color: '#ff4d6d', role: 'attack', r: 40, hp: 120, score: 3000,
    move(b, dt) { trioMove(b, dt); b.rot += dt * 1.5; },
    patterns: [
      function* fans(b) {
        for (let r = 0; r < 4; r++) {
          const a = angTo(b, player), n = b.enraged ? 9 : 7;
          for (let k = 0; k < n; k++) fireEnemy(b.x, b.y, a + (k - (n - 1) / 2) * 0.13, 270, '#ff4d6d', 6);
          yield 0.5;
        }
      },
      function* spiral(b) {
        for (let i = 0; i < 36; i++) {
          for (let k = 0; k < 3; k++) fireEnemy(b.x, b.y, b.spin + k * TAU / 3, 200, '#ff8fa3', 6);
          b.spin += 0.2; yield 0.06;
        }
      },
    ],
    draw(b) {
      const fl = b.hitFlash > 0;
      ctx.save(); ctx.translate(b.x, b.y);
      spikeShape(b.r * 1.25, 5, 0.5, b.rot); ctx.fillStyle = fl ? '#fff' : '#b01e3c'; ctx.fill();
      ctx.strokeStyle = '#ffb3c1'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
      circle(b.x, b.y, b.r * 0.6, '#3a0612'); circle(b.x, b.y, b.r * 0.38, b.enraged ? '#ffffff' : '#ff4d6d');
    },
  },
  // ---------- 9: BETA (Trio, Heiler) ----------
  {
    name: 'BETA', title: 'Die Heilerin', color: '#6dff9d', role: 'heal', r: 36, hp: 100, score: 3000,
    move(b, dt) { trioMove(b, dt); },
    patterns: [
      function* orbs(b) {
        const n = b.enraged ? 5 : 4;
        for (let i = 0; i < n; i++) {
          fireEnemy(b.x, b.y, Math.PI / 2 + (i - (n - 1) / 2) * 0.5, 140, '#6dff9d', 7, { homing: 1.4, life: 6, missile: true, maxSpeed: 210 });
          yield 0.45;
        }
        yield 0.5;
      },
      function* petals(b) {
        for (let r = 0; r < 3; r++) {
          const n = 20, off = r * 0.17;
          for (let k = 0; k < n; k++) fireEnemy(b.x, b.y, off + k * TAU / n, 160, '#a8ffc6', 6);
          yield 0.7;
        }
      },
    ],
    draw(b) {
      const fl = b.hitFlash > 0;
      // Heilstrahlen zu verletzten Partnern
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.setLineDash([8, 8]); ctx.lineDashOffset = -b.t * 40;
      for (const o of b.group) {
        if (o === b || o.dead || o.hp >= o.maxHp) continue;
        ctx.strokeStyle = 'rgba(109,255,157,0.55)'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(o.x, o.y); ctx.stroke();
      }
      ctx.restore();
      circle(b.x, b.y, b.r, fl ? '#fff' : '#12633a');
      ctx.fillStyle = '#6dff9d';
      ctx.fillRect(b.x - 5, b.y - b.r * 0.7, 10, b.r * 1.4); ctx.fillRect(b.x - b.r * 0.7, b.y - 5, b.r * 1.4, 10);
      ctx.strokeStyle = '#d5ffe4'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke();
    },
  },
  // ---------- 10: GAMMA (Trio, Schildträger) ----------
  {
    name: 'GAMMA', title: 'Der Schild', color: '#6fa8ff', role: 'shield', r: 36, hp: 100, score: 3000,
    move(b, dt) { trioMove(b, dt); b.rot += dt * 0.8; },
    patterns: [
      function* lances(b) {
        for (let i = 0; i < 3; i++) { addLaser(b, angTo(b, player), 0.9, 0.35, 22, 0); yield 0.7; }
        yield 0.8;
      },
      function* rings(b) {
        for (let r = 0; r < 2; r++) {
          const n = 26, gap = angTo(b, player);
          for (let k = 0; k < n; k++) { const a = k * TAU / n; if (Math.abs(angDiff(a, gap)) < 0.4) continue; fireEnemy(b.x, b.y, a, 170, '#9cc2ff', 6); }
          yield 0.8;
        }
      },
    ],
    draw(b) {
      const fl = b.hitFlash > 0;
      // Schutzblasen um die Partner
      ctx.save(); ctx.setLineDash([10, 8]); ctx.lineDashOffset = -b.t * 30;
      for (const o of b.group) {
        if (o === b || o.dead) continue;
        ctx.strokeStyle = 'rgba(111,168,255,0.8)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r + 16, 0, TAU); ctx.stroke();
        ctx.strokeStyle = 'rgba(111,168,255,0.25)'; ctx.lineWidth = 1.5; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(o.x, o.y); ctx.stroke(); ctx.setLineDash([10, 8]);
      }
      ctx.restore();
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
      ctx.beginPath(); for (let i = 0; i < 6; i++) ctx.lineTo(Math.cos(i * TAU / 6) * b.r * 1.15, Math.sin(i * TAU / 6) * b.r * 1.15); ctx.closePath();
      ctx.fillStyle = fl ? '#fff' : '#1b3f8a'; ctx.fill(); ctx.strokeStyle = '#bcd5ff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
      circle(b.x, b.y, b.r * 0.5, '#6fa8ff'); circle(b.x, b.y, b.r * 0.25, '#ffffff');
    },
  },
  // ---------- 11: FESTUNG (zerstörbare Teile) ----------
  {
    name: 'FESTUNG', title: 'Zerschlage die Geschütztürme', color: '#c9a45a', r: 64, hp: 170, score: 7000,
    makeParts(scale) {
      return [[-124, -6], [124, -6], [-68, 56], [68, 56]].map(([ox, oy]) => ({ ox, oy, r: 24, hp: 48 * scale, maxHp: 48 * scale, dead: false, flash: 0 }));
    },
    move(b, dt) {
      b.x += (W / 2 + Math.sin(b.t * 0.3) * W * 0.28 - b.x) * Math.min(1, dt * 1.2);
      b.y += (H * 0.2 - b.y) * Math.min(1, dt * 1.2);
      for (const pt of b.parts) pt.flash = Math.max(0, pt.flash - dt);
      b.exposed = b.parts.every(p => p.dead);
      if (b.exposed && !b.wasExposed) {
        b.wasExposed = true; b.enraged = true; shake = Math.max(shake, 16);
        addText(b.x, b.y - b.r - 24, 'KERN FREIGELEGT!', '#ff6a6a', 24);
      }
    },
    patterns: [
      function* barrage(b) {
        for (let r = 0; r < 8; r++) {
          for (const pt of b.parts) {
            if (pt.dead) continue;
            const px = b.x + pt.ox, py = b.y + pt.oy;
            fireEnemy(px, py, Math.atan2(player.y - py, player.x - px) + rand(-0.1, 0.1), 300, '#ffd27a', 5);
          }
          yield b.exposed ? 0.25 : 0.4;
        }
      },
      function* shells(b) {
        for (let r = 0; r < 3; r++) {
          for (const pt of b.parts) {
            if (pt.dead) continue;
            const px = b.x + pt.ox, py = b.y + pt.oy;
            fireEnemy(px, py, Math.atan2(player.y - py, player.x - px), 200, '#ff9a5a', 9, { mine: 0.9, split: true, splitN: 7, splitColor: '#ffb36b' });
          }
          yield 0.9;
        }
      },
      function* seekers(b) {
        for (const pt of b.parts) {
          if (pt.dead) continue;
          fireEnemy(b.x + pt.ox, b.y + pt.oy, Math.PI / 2, 140, '#ff9a5a', 7, { homing: 1.7, life: 5.5, missile: true, maxSpeed: 250 });
          yield 0.4;
        }
        yield 0.6;
      },
      function* core(b) {
        if (!b.exposed) {
          for (let i = 0; i < 3; i++) { const a = angTo(b, player); for (let k = -2; k <= 2; k++) fireEnemy(b.x, b.y, a + k * 0.14, 260, '#ffd27a', 6); yield 0.5; }
          return;
        }
        for (let i = 0; i < 40; i++) { for (let k = 0; k < 3; k++) fireEnemy(b.x, b.y, b.spin + k * TAU / 3, 210, '#ff7a7a', 6); b.spin += 0.2; yield 0.06; }
        for (let r = 0; r < 3; r++) { const n = 26, off = r * 0.2; for (let k = 0; k < n; k++) fireEnemy(b.x, b.y, off + k * TAU / n, 180, '#ffb3b3', 6); yield 0.6; }
      },
    ],
    draw(b) {
      const fl = b.hitFlash > 0;
      ctx.save(); ctx.translate(b.x, b.y);
      ctx.beginPath();
      ctx.moveTo(-150, -20); ctx.lineTo(-100, -62); ctx.lineTo(100, -62); ctx.lineTo(150, -20); ctx.lineTo(120, 40); ctx.lineTo(60, 80); ctx.lineTo(-60, 80); ctx.lineTo(-120, 40); ctx.closePath();
      const g = ctx.createLinearGradient(0, -62, 0, 80); g.addColorStop(0, fl ? '#fff' : '#7a6a48'); g.addColorStop(1, fl ? '#ddd' : '#2e2819');
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#e0c88a'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = '#1a150b'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-90, -55); ctx.lineTo(-70, 60); ctx.moveTo(90, -55); ctx.lineTo(70, 60); ctx.moveTo(-130, 0); ctx.lineTo(130, 0); ctx.stroke();
      ctx.restore();
      // Geschütztürme
      for (const pt of b.parts) {
        const px = b.x + pt.ox, py = b.y + pt.oy;
        if (pt.dead) { circle(px, py, pt.r * 0.7, '#1a150b'); ctx.fillStyle = 'rgba(255,120,40,0.5)'; ctx.beginPath(); ctx.arc(px, py, pt.r * 0.4, 0, TAU); ctx.fill(); continue; }
        const ca = Math.atan2(player.y - py, player.x - px);
        ctx.save(); ctx.translate(px, py); ctx.rotate(ca);
        ctx.fillStyle = '#1a212d'; ctx.fillRect(0, -5, pt.r + 14, 10); ctx.fillStyle = '#c9d6e6'; ctx.fillRect(pt.r + 8, -6, 7, 12);
        ctx.restore();
        circle(px, py, pt.r, pt.flash > 0 ? '#fff' : '#4a566b'); circle(px, py, pt.r * 0.55, b.enraged ? '#ff6a6a' : '#ffd27a');
        ctx.strokeStyle = '#7fe8ff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(px, py, pt.r + 5, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(pt.hp / pt.maxHp, 0, 1)); ctx.stroke();
      }
      // Kern
      const pulse = 0.5 + 0.5 * Math.sin(b.t * 6);
      circle(b.x, b.y - 4, 36, '#120d06');
      circle(b.x, b.y - 4, 26, b.exposed ? `rgb(255,${80 + pulse * 60},${60})` : '#8a7440');
      if (!b.exposed) { ctx.strokeStyle = '#e0c88a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(b.x, b.y - 4, 33, 0, TAU); ctx.stroke(); }
    },
  },
);
ENCOUNTERS.push(
  { name: 'TRIARCHIE', title: 'Töte zuerst den Schildträger', color: '#ff6ea8', defs: [8, 9, 10] },
  { name: 'FESTUNG', title: 'Zerschlage die Geschütztürme', color: '#c9a45a', defs: [11] },
);
// Umweltgefahren pro Bosskampf
const HAZARDS = { 'SCHWARMKÖNIGIN': 'rocks', 'LASERKOLOSS': 'edge', 'PHANTOM': 'storm', 'GRAVITON': 'rocks', 'DREADNOUGHT': 'edge', 'TRIARCHIE': 'storm', 'FESTUNG': 'rocks' };
ENCOUNTERS.forEach(e => { e.hazard = HAZARDS[e.name] || null; });

function spawnBoss() {
  const enc = ENCOUNTERS[game.bossesDefeated % ENCOUNTERS.length];
  const tier = Math.floor(game.bossesDefeated / ENCOUNTERS.length);
  const n = enc.defs.length, made = [];
  const scale = (1 + 0.3 * game.bossesDefeated) * (1 + 0.5 * tier);
  enc.defs.forEach((di, k) => {
    const def = BOSSES[di], hp = def.hp * scale;
    const side = n === 2 ? (k ? 1 : -1) : n === 3 ? k - 1 : 0;
    const b = {
      def, boss: true, name: def.name, color: def.color,
      x: W / 2 + (n === 2 ? side * W * 0.2 : n === 3 ? side * W * 0.26 : 0), y: -100, vx: 0, vy: 0, r: def.r, hp, maxHp: hp,
      score: Math.round(def.score * (1 + 0.5 * game.bossesDefeated)),
      t: 0, rot: 0, spin: 0, hitFlash: 0, enraged: false, side, slot: k,
      co: null, wait: 2.2 + k * 0.8, lastPattern: -1, entering: true, fade: 0,
    };
    if (def.makeParts) b.parts = def.makeParts(scale);
    enemies.push(b); made.push(b);
  });
  made.forEach(b => { b.group = made; if (n === 2) b.partner = made[1 - made.indexOf(b)]; });
  game.boss = made[0];
  game.hits = 0;
  game.bossIntro = null;
  startHazard(enc.hazard);
}

/* ===================== Runden, Modi, Start ===================== */
function isBossRound(r) { return gameMode === 'rush' || r % 3 === 0; }

function nextRound() {
  game.round++;
  if (isBossRound(game.round)) {
    const enc = ENCOUNTERS[game.bossesDefeated % ENCOUNTERS.length];
    game.bossIntro = { name: enc.name, title: enc.title, color: enc.color, t: 0, dur: 3.4 };
    game.banner = null;
    game.phase = 'boss';
    game.phaseT = 3.4;
    game.boss = null;
    sfx('boss'); SND.music('boss');
  } else {
    game.normalWaves++;
    const n = game.normalWaves;
    game.banner = { text: 'Welle ' + n, sub: n === 1 ? 'Viel Glück, Pilot!' : '', t: 2.0, color: '#7fe8ff' };
    game.phase = 'wave';
    game.spawnQueue = buildWave(n);
    game.spawnT = 1.4;
    if (game.mods.length) ach('endless');
    SND.music('wave');
  }
}

function startGame() {
  resetGame();
  SND.music('menu');
  offerUpgrade('Start', 'Wähle dein erstes Upgrade für den Flug.', () => nextRound());
}
function startMode(mode) {
  SND.init();
  gameMode = mode; cachedBest = null;
  if (mode === 'daily') seedRng(todaySeed()); else rng = Math.random;
  startGame();
}

let lastSavedT = null;
function gameOver() {
  state = 'gameover';
  lastSavedT = null;
  SND.music('off'); sfx('gameover');
  const earned = Math.round((game.score / 40 + game.bossesDefeated * 60) * (1 + 0.15 * meta.perm.loot));
  meta.credits += earned; meta.stats.runs++; saveMeta();
  if (game.score >= 10000) ach('score10k');
  $('finalScore').textContent = game.score.toLocaleString('de-DE');
  $('finalInfo').textContent = `${MODES[gameMode]} · ${stageLabel()} · ${game.bossesDefeated} Boss${game.bossesDefeated === 1 ? '' : 'e'} besiegt · +${earned} Credits`;
  $('nameForm').classList.remove('hidden');
  let lastName = '';
  try { lastName = localStorage.getItem('julshot_name') || ''; } catch (e) { /* ignorieren */ }
  $('nameInput').value = lastName;
  renderScores($('overScores'));
  showOverlay('gameover');
  setTimeout(() => $('nameInput').focus(), 50);
}

function resetExtras() {
  drones = []; rocks = []; holes = []; beams = []; ultCasts = []; arcs = [];
  SND.music('off');
}

function updateExtras(dt) {
  const g = game;
  if (g.combo.t > 0) { g.combo.t -= dt; if (g.combo.t <= 0) g.combo.n = 0; }
  if (g.slowT > 0) g.slowT -= dt;
  if (g.magnetT > 0) g.magnetT -= dt;
  if (g.bossIntro) g.bossIntro.t += dt;
  if (g.score >= 10000) ach('score10k');
  for (const a of arcs) a.life -= dt;
  arcs = arcs.filter(a => a.life > 0);
  updateDrones(dt);
  updateHazards(dt);
  if (g.phase === 'boss' || g.boss) SND.music('boss'); else if (g.phase !== 'zoom') SND.music('wave');
}

/* ===================== HUD-Erweiterungen ===================== */
function drawBossIntro() {
  const bi = game.bossIntro;
  if (!bi) return;
  const t = bi.t, k = clamp(t / 0.5, 0, 1) * clamp((bi.dur - t) / 0.5, 0, 1);
  ctx.fillStyle = `rgba(0,0,0,${0.35 * k})`; ctx.fillRect(0, 0, SW, SH);
  const bh = SH * 0.13 * k;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SW, bh); ctx.fillRect(0, SH - bh, SW, bh);
  const slide = (1 - clamp(t / 0.9, 0, 1)) ** 3;
  ctx.save();
  ctx.globalAlpha = k;
  ctx.letterSpacing = '6px';
  txt('WARNUNG', SW / 2 - slide * 200, SH * 0.36, 16, '#ff6a6a', 'center', '700');
  txt(bi.name, SW / 2 + slide * SW * 0.4, SH * 0.45, Math.min(64, SW / 11), bi.color, 'center', '800');
  ctx.letterSpacing = '2px';
  txt(bi.title, SW / 2 - slide * SW * 0.4, SH * 0.45 + Math.min(56, SW / 14), Math.min(22, SW / 32), '#d6dcff', 'center', '500');
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawBossExtras(b, bx, by, bw) {
  if (b.parts) {
    b.parts.forEach((pt, i) => {
      ctx.fillStyle = pt.dead ? '#3a2a18' : '#ffd27a';
      ctx.beginPath(); ctx.arc(bx + bw - 8 - i * 16, by + 5, 5, 0, TAU); ctx.fill();
    });
    if (b.parts.some(p => !p.dead)) txt('Kern geschützt', bx + 4, by + 5, 11, '#c9a45a', 'left', '600');
  }
  if (b.def.role) {
    const shielded = b.def.role !== 'shield' && b.group.some(x => !x.dead && x.def.role === 'shield');
    const lbl = { attack: 'ANGREIFER', heal: 'HEILERIN', shield: 'SCHILDTRÄGER' }[b.def.role] + (shielded ? ' · GESCHÜTZT' : '');
    txt(lbl, bx + 4, by + 5, 10, shielded ? '#6fa8ff' : '#aab6ff', 'left', '700');
  }
}

function drawExtrasHUD() {
  const p = player;
  // Kombo
  if (game.combo.n >= 2) {
    const k = clamp(game.combo.t / 2.6, 0, 1), y = 12 + (96 + Math.ceil(p.maxHp / 10) * 22 - 22 + (p.shieldMax ? 22 : 0)) + 18;
    panel(14, y, 250, 44);
    txt(`KOMBO  ×${comboMult().toFixed(1)}`, 28, y + 15, 16, comboMult() >= 4 ? '#ffd35a' : '#ffffff', 'left', '800');
    txt(String(game.combo.n), 250, y + 15, 14, '#9fb0ff', 'right', '700');
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(28, y + 30, 222, 5);
    ctx.fillStyle = '#ffd35a'; ctx.fillRect(28, y + 30, 222 * k, 5);
  }
  // Status-Effekte & Modifikatoren (rechts)
  let ry = 100;
  const chip = (t, c) => { txt(t, SW - 28, ry, 12, c, 'right', '700'); ry += 18; };
  if (game.slowT > 0) chip(`⏱ ZEITLUPE ${game.slowT.toFixed(1)}s`, '#7fd4ff');
  if (game.magnetT > 0) chip(`M MAGNET ${game.magnetT.toFixed(1)}s`, '#ffd35a');
  if (p.surgeT > 0) chip(`✹ NACHBRENNER ${p.surgeT.toFixed(1)}s`, '#ff9a5a');
  for (const id of game.mods) chip('⚠ ' + MODS.find(m => m.id === id).name, '#ff8fa3');
  // Waffe & Synergien (unten rechts)
  const syns = SYNERGIES.filter(s => p.syn[s.id]);
  const wname = { blaster: 'Blaster', spread: 'Streuschuss', laser: 'Laserstrahl', rocket: 'Raketenwerfer', chain: 'Kettenblitz' }[p.weapon];
  const lines = [['Waffe: ' + wname, '#aab6ff'], ...syns.map(s => ['★ ' + s.name, '#ffd35a'])];
  const ph = lines.length * 19 + 14, pw = 190;
  panel(SW - pw - 14, SH - ph - 14, pw, ph);
  lines.forEach(([t, c], i) => txt(t, SW - 28, SH - ph - 14 + 17 + i * 19, 12, c, 'right', '600'));
  drawBossIntro();
  // Touch-Steuerung
  if (touch.on && state === 'playing') {
    const ub = ultBtn(), pb = pauseBtn(), prog = clamp(p.ultCharge / p.ultCD, 0, 1);
    ctx.fillStyle = 'rgba(8,11,32,0.6)'; ctx.beginPath(); ctx.arc(ub.x, ub.y, ub.r, 0, TAU); ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = prog >= 1 ? '#8ff0ff' : '#4f8cff';
    ctx.beginPath(); ctx.arc(ub.x, ub.y, ub.r - 3, -Math.PI / 2, -Math.PI / 2 + TAU * prog); ctx.stroke();
    txt('ULT', ub.x, ub.y, 15, '#ffffff', 'center', '800');
    ctx.fillStyle = 'rgba(8,11,32,0.6)'; ctx.beginPath(); ctx.arc(pb.x, pb.y, pb.r, 0, TAU); ctx.fill();
    txt('II', pb.x, pb.y, 13, '#ffffff', 'center', '800');
    for (const s of [touch.move, touch.aim]) {
      if (!s) continue;
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.ox, s.oy, TOUCH_R, 0, TAU); ctx.stroke();
      const v = touchVec(s);
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.arc(s.ox + v.x * TOUCH_R, s.oy + v.y * TOUCH_R, 22, 0, TAU); ctx.fill();
    }
  }
}

/* ===================== Menüs, Hangar, Erfolge ===================== */
ui.hangar = $('hangar'); ui.ach = $('achievements');
let scoreTab = 'endless', scoreOnline = false;

function toMenu() {
  state = 'menu';
  setZoom(1); initStars();
  SND.music('menu');
  renderMenu();
  showOverlay('menu');
}
function renderMenu() {
  const ship = SHIPS[meta.sel.ship], ult = ULTS[meta.sel.ult];
  $('loadoutInfo').textContent = `${ship.name} · ${ult.name} · ${meta.credits.toLocaleString('de-DE')} Credits`;
  $('btnMute').textContent = 'Ton: ' + (SND.muted ? 'aus' : 'an');
  $('btnDaily').textContent = 'Täglich ' + todayKey().slice(5).replace('-', '.') + '.';
  const tabs = $('scoreTabs');
  tabs.innerHTML = '';
  for (const m of Object.keys(MODES)) {
    const b = document.createElement('button');
    b.className = 'tab' + (m === scoreTab ? ' on' : '');
    b.textContent = MODES[m];
    b.addEventListener('click', () => { scoreTab = m; renderMenu(); });
    tabs.appendChild(b);
  }
  if (onlineDb) { // geteilte Online-Bestenliste (nur im Artefakt verfügbar)
    const b = document.createElement('button');
    b.className = 'tab' + (scoreOnline ? ' on' : '');
    b.textContent = '🌐 Online';
    b.addEventListener('click', () => { scoreOnline = !scoreOnline; renderMenu(); });
    tabs.appendChild(b);
  }
  if (onlineDb && scoreOnline) renderOnlineScores($('menuScores'), scoreTab);
  else renderScores($('menuScores'), null, scoreTab);
}

function makeCard(o) {
  const d = document.createElement('div');
  d.className = 'card small' + (o.selected ? ' selected' : '') + (o.locked ? ' locked' : '');
  d.innerHTML = '<div class="icon"></div><div class="name"></div><div class="desc"></div><div class="lvl"></div>';
  d.querySelector('.icon').textContent = o.icon || '';
  d.querySelector('.name').textContent = o.name;
  d.querySelector('.desc').textContent = o.desc;
  d.querySelector('.lvl').textContent = o.tag || '';
  d.addEventListener('click', o.onClick);
  return d;
}
function buy(cost) {
  if (meta.credits < cost) { toast('Nicht genug Credits', `Dir fehlen ${cost - meta.credits} Credits.`); return false; }
  meta.credits -= cost; saveMeta(); sfx('pickup'); return true;
}
function renderHangar() {
  $('credits').textContent = meta.credits.toLocaleString('de-DE') + ' Credits';
  const fill = (id, nodes) => { const el = $(id); el.innerHTML = ''; nodes.forEach(n => el.appendChild(n)); };
  fill('shipCards', Object.entries(SHIPS).map(([id, s]) => makeCard({
    icon: s.icon, name: s.name, desc: `${s.desc}  ♥ ${s.hp}  ·  Tempo ${s.speed}`,
    selected: meta.sel.ship === id, locked: !meta.ships.includes(id),
    tag: meta.ships.includes(id) ? (meta.sel.ship === id ? 'Ausgewählt' : 'Auswählen') : `Kaufen: ${s.cost} Credits`,
    onClick() {
      if (!meta.ships.includes(id)) { if (!buy(s.cost)) return; meta.ships.push(id); }
      meta.sel.ship = id; saveMeta(); renderHangar();
    },
  })));
  fill('ultCards', Object.entries(ULTS).map(([id, u]) => makeCard({
    icon: u.icon, name: u.name, desc: u.desc,
    selected: meta.sel.ult === id, locked: !meta.ults.includes(id),
    tag: meta.ults.includes(id) ? (meta.sel.ult === id ? 'Ausgewählt' : 'Auswählen') : `Kaufen: ${u.cost} Credits`,
    onClick() {
      if (!meta.ults.includes(id)) { if (!buy(u.cost)) return; meta.ults.push(id); }
      meta.sel.ult = id; saveMeta(); renderHangar();
    },
  })));
  fill('hullCards', HULLS.map(h => {
    const owned = meta.hulls.includes(h.id);
    const d = document.createElement('div');
    d.className = 'hull' + (meta.sel.hull === h.id ? ' selected' : '') + (owned ? '' : ' locked');
    d.style.background = owned ? `linear-gradient(135deg, ${h.main}, ${h.accent})` : '#161a3a';
    d.title = owned ? h.name : h.name + ' – Erfolg: ' + (ACH.find(a => a.hull === h.id) || {}).name;
    d.textContent = owned ? '' : '🔒';
    d.addEventListener('click', () => { if (!owned) { toast('Gesperrt', 'Schalte diesen Anstrich über einen Erfolg frei: ' + ((ACH.find(a => a.hull === h.id) || {}).name || '?')); return; } meta.sel.hull = h.id; saveMeta(); renderHangar(); });
    return d;
  }));
  fill('permCards', PERMS.map(pm => {
    const lv = meta.perm[pm.id], max = pm.costs.length, maxed = lv >= max;
    return makeCard({
      icon: '▲', name: pm.name, desc: pm.desc, selected: maxed,
      tag: maxed ? `Stufe ${lv}/${max} (max)` : `Stufe ${lv}/${max} · Kaufen: ${pm.costs[lv]} Credits`,
      onClick() { if (maxed || !buy(pm.costs[lv])) return; meta.perm[pm.id]++; saveMeta(); renderHangar(); },
    });
  }));
}
function renderAch() {
  const el = $('achList');
  el.innerHTML = '';
  const done = ACH.filter(a => meta.ach[a.id]).length;
  $('achCount').textContent = `${done} / ${ACH.length} freigeschaltet`;
  for (const a of ACH) {
    const d = document.createElement('div');
    d.className = 'ach' + (meta.ach[a.id] ? ' done' : '');
    const h = HULLS.find(x => x.id === a.hull);
    d.innerHTML = '<div class="sw"></div><div><div class="an"></div><div class="ad"></div></div>';
    d.querySelector('.sw').style.background = h ? `linear-gradient(135deg, ${h.main}, ${h.accent})` : '#222';
    d.querySelector('.an').textContent = (meta.ach[a.id] ? '✓ ' : '') + a.name;
    d.querySelector('.ad').textContent = a.desc + (h ? ` · Anstrich: ${h.name}` : '');
    el.appendChild(d);
  }
}
function openOverlay(name) {
  if (name === 'hangar') renderHangar(); else if (name === 'ach') renderAch();
  showOverlay(name);
}

$('btnStart').addEventListener('click', () => startMode('endless'));
$('btnRush').addEventListener('click', () => startMode('rush'));
$('btnDaily').addEventListener('click', () => startMode('daily'));
$('btnHangar').addEventListener('click', () => openOverlay('hangar'));
$('btnAch').addEventListener('click', () => openOverlay('ach'));
$('btnHangarBack').addEventListener('click', toMenu);
$('btnAchBack').addEventListener('click', toMenu);
$('btnMute').addEventListener('click', () => { SND.init(); SND.toggleMute(); renderMenu(); });
$('btnResume').addEventListener('click', () => setPause(false));
$('btnQuit').addEventListener('click', () => { SND.music('off'); toMenu(); });
$('btnRetry').addEventListener('click', () => startMode(gameMode));
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
