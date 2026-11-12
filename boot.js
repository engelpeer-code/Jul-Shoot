'use strict';
window.addEventListener('resize', resize);
resize();
mouse.sx = SW / 2; mouse.sy = SH / 3;
buildNebula();
toMenu();
requestAnimationFrame(frame);

// Für automatisierte Tests
window.__julshot = {
  get state() { return state; }, get game() { return game; }, get player() { return player; },
  get enemies() { return enemies; }, get zoom() { return zoom; }, get novas() { return novas; },
  get meta() { return meta; }, get holes() { return holes; }, get beams() { return beams; }, get bullets() { return bullets; },
  get pickups() { return pickups; }, get rocks() { return rocks; }, get drones() { return drones; },
  set gameMode(m) { gameMode = m; },
  chooseUpgrade, startMode, startGame, nextRound: () => nextRound(), useUlt: () => useUlt(),
  spawnBoss: () => spawnBoss(), damageEnemy: (e, d) => damageEnemy(e, d, false), spawnEnemy, spawnWaveUnit, makeElite,
  addModifier, checkSynergies, dropPickup, ENCOUNTERS, UPGRADES,
};
