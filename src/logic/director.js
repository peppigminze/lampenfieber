// Spawning director: waves, bursts, bosses, tutorial, encore. Pure.
import { lerp, clamp, d2 } from './geom.js';
import { emit, spawnEnemy, spawnPoint, insideSolid } from './core.js';

const TAU = Math.PI * 2;

export const TUTORIAL = [
  { t: 0.3, hint: 'move' },
  { t: 5, hint: 'shadow', spawn: [['funke', 4, 'east']] },
  { t: 19, hint: 'light', spawn: [['schemen', 3, 'west']] },
  { t: 33, hint: 'flare', spawn: [['schemen', 3, 'ring'], ['funke', 2, 'ring']] },
  { t: 45, hint: 'douse', spawn: [['motte', 8, 'ring']] },
  { t: 57, hint: 'wax' },
];
export const TUT_END = 62;

function eliteChance(run) {
  if (run.mode === 'encore') return 0.03 + Math.min(0.07, run.t / 3000);
  return run.actIdx >= 1 ? 0.02 + run.actIdx * 0.01 : 0;
}

export function spawnOne(run, id, how = 'edge', ang) {
  const p = run.p;
  if (id === 'schattenhand') {
    const cands = run.world.obstacles.filter((o) => { const dd = d2(o.x, o.y, p.x, p.y); return dd > 230 * 230 && dd < 650 * 650; });
    if (cands.length) {
      const o = run.rng.pick(cands), a = Math.atan2(o.y - p.y, o.x - p.x), r = o.r + 26;
      const x = o.x + Math.cos(a) * r, y = o.y + Math.sin(a) * r;
      if (!insideSolid(run, x, y, 12)) return spawnEnemy(run, id, x, y, { elite: run.rng.chance(eliteChance(run)) });
    }
  }
  const a = ang !== undefined ? ang : run.rng() * TAU;
  const [x, y] = spawnPoint(run, a, how === 'near' ? 420 : run.rng.range(560, 690));
  return spawnEnemy(run, id, x, y, { elite: run.rng.chance(eliteChance(run)) });
}

export function spawnGroup(run, id, n, how) {
  const p = run.p;
  if (how === 'ring') { const off = run.rng() * TAU; for (let i = 0; i < n; i++) { const a = off + (i / n) * TAU; const [x, y] = spawnPoint(run, a, 430, 0.05); spawnEnemy(run, id, x, y); } return; }
  let base = run.rng() * TAU;
  if (how === 'east') base = 0; else if (how === 'west') base = Math.PI;
  for (let i = 0; i < n; i++) {
    const a = base + run.rng.range(-0.35, 0.35);
    const [x, y] = spawnPoint(run, a, (how === 'east' || how === 'west') ? 470 : 560, 0);
    spawnEnemy(run, id, x, y);
  }
  void p;
}

function poolPick(run, pool, t) {
  const avail = pool.filter((e) => e[2] <= t);
  return run.rng.weighted(avail, (e) => e[1])[0];
}

function trickle(run, dt, rate, cap, pool, t) {
  run.spawnAcc += rate * dt;
  let guard = 0;
  while (run.spawnAcc >= 1 && guard++ < 6) {
    run.spawnAcc -= 1;
    if (run.enemies.length >= cap) { run.spawnAcc = Math.min(run.spawnAcc, 1); break; }
    spawnOne(run, poolPick(run, pool, t));
  }
}

function spawnBoss(run, id) {
  const p = run.p, W = run.world;
  const a = Math.atan2(W.cy - p.y, W.cx - p.x) + run.rng.range(-0.6, 0.6);
  const [x, y] = spawnPoint(run, a, 430);
  const b = spawnEnemy(run, id, x, y);
  run.bossIds.push(b.id);
  emit(run, 'boss', { id, x, y });
  emit(run, 'hint', { key: 'boss_' + id });
  return b;
}

export function directorStep(run, dt) {
  if (run.mode === 'encore') return encoreStep(run, dt);
  const act = run.act, g = run.grade;
  let rateMul = 1;
  if (run.tut.on && run.actIdx === 0 && run.actT < TUT_END) {
    for (const s of TUTORIAL) {
      if (!run.tut.done[s.t] && run.actT >= s.t) {
        run.tut.done[s.t] = true;
        if (s.hint) emit(run, 'hint', { key: s.hint, tut: true });
        for (const [id, n, how] of s.spawn || []) spawnGroup(run, id, n, how);
      }
    }
    rateMul = 0.15;
  }
  const prog = clamp(run.actT / act.duration, 0, 1);
  if (run.phase === 'play') {
    const rate = lerp(act.rate[0], act.rate[1], prog) * g.spawn * rateMul;
    const cap = lerp(act.cap[0], act.cap[1], prog) * g.spawn;
    trickle(run, dt, rate, cap, act.pool, run.actT);
    for (let i = 0; i < act.bursts.length; i++) {
      const b = act.bursts[i];
      if (!run.burstsDone[i] && run.actT >= b[0]) { run.burstsDone[i] = true; spawnGroup(run, b[1], Math.round(b[2] * g.spawn), b[3]); emit(run, 'burst', {}); }
    }
    if (run.actT >= act.duration) { run.phase = 'boss'; spawnBoss(run, act.boss); }
  } else if (run.phase === 'boss') {
    trickle(run, dt, act.rate[0] * 0.32 * g.spawn, act.cap[0] * 0.5, act.pool, act.duration);
  }
}

function encoreStep(run, dt) {
  const E = run.data.acts.encore, g = run.grade, t = run.t;
  const rate = (E.rate[0] + E.rate[1] * t) * g.spawn;
  const cap = Math.min(E.cap[2], E.cap[0] + E.cap[1] * t) * g.spawn;
  trickle(run, dt, rate, cap, E.pool, t);
  run.encoreBossT -= dt;
  if (run.encoreBossT <= 0) {
    run.encoreBossT = E.bossEvery;
    spawnBoss(run, E.bosses[run.encoreBossN++ % E.bosses.length]);
  }
  if (Math.floor(t / 60) > run.encoreMin) { run.encoreMin = Math.floor(t / 60); spawnGroup(run, run.rng.pick(['motte', 'rabe', 'funke', 'schemen']), 10 + run.encoreMin * 2, 'ring'); }
}
