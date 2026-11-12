'use strict';
/* =========================================================
   Sound: alle Effekte und die Musik werden per Web Audio
   synthetisiert – es werden keine Audiodateien geladen.
   ========================================================= */
const SND = (() => {
  let ac = null, master = null, sfxBus = null, musBus = null, noiseBuf = null;
  let muted = false;
  try { muted = localStorage.getItem('julshot_mute') === '1'; } catch (e) { /* ignorieren */ }
  let mode = 'off', step = 0, nextT = 0, timer = null;
  const lastPlay = {};

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
    musBus = ac.createGain(); musBus.gain.value = 0.32; musBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    timer = setInterval(schedule, 40);
  }

  function env(g, t, a, d, v) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function tone(type, f0, f1, dur, vol, bus, t0, filt) {
    const t = t0 || ac.currentTime;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    env(g, t, 0.005, dur, vol);
    let node = o;
    if (filt) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filt; o.connect(f); node = f; }
    node.connect(g); g.connect(bus || sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, f0, f1, type, bus, t0) {
    const t = t0 || ac.currentTime;
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = type || 'lowpass';
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ac.createGain(); env(g, t, 0.003, dur, vol);
    s.connect(f); f.connect(g); g.connect(bus || sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  const SFX = {
    shoot() { tone('square', 900 + Math.random() * 120, 380, 0.06, 0.05, null, 0, 3000); },
    laser() { tone('sawtooth', 1400, 500, 0.05, 0.035, null, 0, 4000); },
    rocket() { noise(0.18, 0.1, 1800, 300, 'bandpass'); tone('sawtooth', 200, 90, 0.18, 0.06); },
    hit() { noise(0.04, 0.05, 6000, 2000, 'highpass'); },
    kill() { noise(0.18, 0.12, 2600, 200); tone('triangle', 260, 70, 0.16, 0.08); },
    bigkill() { noise(0.5, 0.25, 1800, 80); tone('sine', 140, 40, 0.5, 0.22); },
    boom() { noise(0.9, 0.35, 1500, 50); tone('sine', 110, 30, 0.9, 0.3); },
    hurt() { tone('sawtooth', 320, 50, 0.3, 0.16, null, 0, 1200); noise(0.2, 0.12, 900, 100); },
    shield() { tone('sine', 900, 1500, 0.2, 0.1); tone('triangle', 1200, 600, 0.2, 0.06); },
    pickup() { const t = ac.currentTime; [660, 880, 1320].forEach((f, i) => tone('triangle', f, f, 0.1, 0.09, null, t + i * 0.06)); },
    ult() { tone('sine', 90, 1100, 0.7, 0.25); noise(0.9, 0.25, 400, 6000, 'bandpass'); tone('sawtooth', 60, 30, 0.9, 0.15, null, 0, 400); },
    ultready() { const t = ac.currentTime; [523, 784, 1046].forEach((f, i) => tone('sine', f, f, 0.2, 0.09, null, t + i * 0.08)); },
    card() { tone('triangle', 520, 780, 0.12, 0.1); },
    boss() { tone('sawtooth', 55, 40, 2.2, 0.22, null, 0, 300); tone('sawtooth', 58, 42, 2.2, 0.18, null, 0, 300); noise(2.0, 0.12, 200, 40); },
    whoosh() { noise(2.4, 0.3, 200, 5000, 'bandpass'); tone('sine', 80, 600, 2.4, 0.15); },
    combo() { tone('square', 1200, 1800, 0.05, 0.04); },
    ach() { const t = ac.currentTime; [784, 988, 1175, 1568].forEach((f, i) => tone('triangle', f, f, 0.18, 0.1, null, t + i * 0.09)); },
    gameover() { const t = ac.currentTime; [392, 330, 262, 196].forEach((f, i) => tone('sawtooth', f, f * 0.98, 0.4, 0.1, null, t + i * 0.22, 900)); },
  };
  const MIN_GAP = { shoot: 0.035, laser: 0.03, hit: 0.04, kill: 0.04, combo: 0.08 };

  function sfx(name) {
    if (!ac || muted || !SFX[name]) return;
    const now = ac.currentTime;
    if (MIN_GAP[name] && now - (lastPlay[name] || 0) < MIN_GAP[name]) return;
    lastPlay[name] = now;
    try { SFX[name](); } catch (e) { /* ignorieren */ }
  }

  // ---- Musik: generativer Loop (Moll-Progression, Bass + Arpeggio + Schlagzeug) ----
  const ROOTS = [57, 53, 48, 55];                 // A F C G (MIDI)
  const MIN = [0, 3, 7, 12, 15, 19], MAJ = [0, 4, 7, 12, 16, 19];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function playStep(t, s, md) {
    const boss = md === 'boss';
    const bar = Math.floor(s / 16) % 4, i = s % 16;
    const root = ROOTS[bar] - (boss ? 12 : 0);
    const scale = bar === 2 || bar === 3 ? MAJ : MIN;
    if (md === 'menu') {
      if (i === 0) { for (const k of [0, 7, 12]) tone('sine', mtof(root + 12 + k), mtof(root + 12 + k), 2.4, 0.07, musBus, t); }
      if (i % 4 === 2) tone('triangle', mtof(root + 24 + scale[(i / 2 | 0) % 6]), mtof(root + 24 + scale[(i / 2 | 0) % 6]), 0.5, 0.04, musBus, t);
      return;
    }
    // Kick & Hi-Hat
    if (i % 4 === 0) tone('sine', 140, 45, 0.18, boss ? 0.5 : 0.38, musBus, t);
    if (i % 2 === 1) noise(0.04, boss ? 0.09 : 0.06, 8000, 6000, 'highpass', musBus, t);
    if (boss && i % 8 === 4) noise(0.12, 0.14, 3000, 1000, 'bandpass', musBus, t);   // Snare
    // Bass
    if (i % 2 === 0 || boss) {
      const bn = root - 12 + (i % 8 === 6 ? 7 : 0);
      tone('sawtooth', mtof(bn), mtof(bn), boss ? 0.14 : 0.2, 0.15, musBus, t, boss ? 700 : 500);
    }
    // Arpeggio
    const arpPattern = [0, 2, 4, 2, 3, 1, 4, 5];
    if (boss || i % 2 === 0) {
      const n = root + 24 + scale[arpPattern[(i >> (boss ? 0 : 1)) % 8]];
      tone(boss ? 'sawtooth' : 'square', mtof(n), mtof(n), 0.12, 0.05, musBus, t, 2600);
    }
    // Pad zu Taktbeginn
    if (i === 0) for (const k of [0, scale[1], scale[2]]) tone('triangle', mtof(root + 12 + k), mtof(root + 12 + k), 2.2, 0.05, musBus, t);
  }

  function schedule() {
    if (!ac || mode === 'off') return;
    const bpm = mode === 'boss' ? 148 : mode === 'menu' ? 80 : 118;
    const dur = 60 / bpm / 4;
    if (nextT < ac.currentTime) nextT = ac.currentTime + 0.05;
    while (nextT < ac.currentTime + 0.18) {
      if (!muted) playStep(nextT, step, mode);
      step++; nextT += dur;
    }
  }

  return {
    init,
    sfx,
    music(m) { if (m !== mode) { mode = m; step = 0; if (ac) nextT = ac.currentTime + 0.05; } },
    toggleMute() {
      muted = !muted;
      try { localStorage.setItem('julshot_mute', muted ? '1' : '0'); } catch (e) { /* ignorieren */ }
      if (master) master.gain.value = muted ? 0 : 0.8;
      return muted;
    },
    get muted() { return muted; },
  };
})();
const sfx = n => SND.sfx(n);

// Browser erlauben Audio erst nach einer Nutzeraktion
['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, () => SND.init(), { passive: true }));
