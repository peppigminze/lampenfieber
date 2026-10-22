// Shared run helpers used by run/enemies/director. Pure (mutates run state only).
import { d2, clamp } from './geom.js';
import { contains } from './light.js';

export function emit(run, type, o) { const e = o || {}; e.type = type; run.ev.push(e); return e; }

export function insideSolid(run, x, y, pad = 0) {
  for (const o of run.world.obstacles) {
    if (o.kind === 'c') { if (d2(x, y, o.x, o.y) < (o.r + pad) * (o.r + pad)) return true; }
    else if (x > o.bx0 - pad && x < o.bx1 + pad && y > o.by0 - pad && y < o.by1 + pad && (pad > 0 || contains(o, x, y))) return true;
  }
  return false;
}

export function inArena(run, x, y, m = 40) { return x > m && y > m && x < run.world.w - m && y < run.world.h - m; }

export function spawnPoint(run, ang, dist, jitter = 0) {
  const p = run.p, W = run.world;
  for (let i = 0; i < 12; i++) {
    const a = ang + (i ? run.rng.range(-0.9, 0.9) : 0) + run.rng.range(-jitter, jitter);
    const dd = dist * (i ? run.rng.range(0.85, 1.15) : 1);
    let x = clamp(p.x + Math.cos(a) * dd, 50, W.w - 50), y = clamp(p.y + Math.sin(a) * dd, 50, W.h - 50);
    if (d2(x, y, p.x, p.y) < 260 * 260) continue;
    if (!insideSolid(run, x, y, 16)) return [x, y];
  }
  // fallback: farthest corner region
  const x = p.x < W.w / 2 ? W.w - 80 : 80, y = p.y < W.h / 2 ? W.h - 80 : 80;
  return [x, y];
}

export function spawnEnemy(run, type, x, y, o = {}) {
  const def = run.data.enemies[type];
  if (!def) return null;
  const g = run.grade;
  const elite = !!o.elite && !def.boss;
  let hpMul = g.hp * (elite ? 3 : 1) * (o.hpMul || 1);
  if (run.mode === 'encore') hpMul *= 1 + run.t * run.data.acts.encore.hpRamp;
  else if (!def.boss) hpMul *= run.act.hpMul || 1;
  if (def.boss && run.mode === 'encore') hpMul *= 0.7;
  const e = {
    id: run.nextId++, type, def, pol: def.pol, x, y, vx: 0, vy: 0, kx: 0, ky: 0,
    r: def.r * (elite ? 1.3 : 1), hp: def.hp * hpMul, maxHp: def.hp * hpMul,
    spd: def.speed * g.speed * (o.spdMul || 1), dmg: def.dmg * (elite ? 1.3 : 1),
    elite, boss: !!def.boss, st: 'walk', stT: 0, age: 0, cd: { a: 1 + run.rng() * 2, b: 2 + run.rng() * 2, c: 3 + run.rng() * 2 },
    head: Math.atan2(run.p.y - y, run.p.x - x), steerT: run.rng() * 0.25, flags: 0, hurtT: 9, flipS: 0, flipCd: 0,
    seed: run.rng(), dormant: def.beh === 'ambush', ang: run.rng() * 6.283, slowT: 0, dir: [0, 0], warn: 0, phase: 0,
  };
  run.enemies.push(e);
  run.seen[type] = true;
  emit(run, 'spawn', { x, y, id: type, elite, boss: e.boss });
  return e;
}

export function spawnProj(run, x, y, ang, speed, pol, dmg) {
  run.proj.push({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, pol, dmg, r: 6, life: 7 });
}

export function ring(run, x, y, n, speed, polFn, dmg, off = 0) {
  for (let i = 0; i < n; i++) spawnProj(run, x, y, off + (i / n) * Math.PI * 2, speed, polFn(i), dmg);
  emit(run, 'shoot', { x, y, ring: true });
}

export function hurtPlayer(run, amt, src) {
  const p = run.p;
  if (p.inv > 0 || run.phase === 'dead' || run.phase === 'won' || run.phase === 'clear' || run.phase === 'interlude') return false;
  if (p.douse > 0 && run.stats.douseDash) return false;
  amt *= run.grade.dmg;
  p.flame -= amt; p.inv = 0.75;
  run.fever *= 0.5; run.hitsAct++; run.dmgTaken += amt;
  run.hurtBy[src] = (run.hurtBy[src] || 0) + amt;
  emit(run, 'hurt', { amt, x: p.x, y: p.y, src });
  if (p.flame <= 0) {
    if (run.revives > 0) {
      run.revives--; p.flame = run.stats.maxFlame * 0.5; p.inv = 2.5;
      for (const e of run.enemies) if (!e.boss) { const a = Math.atan2(e.y - p.y, e.x - p.x); if (d2(e.x, e.y, p.x, p.y) < 300 * 300) { e.kx += Math.cos(a) * 420; e.ky += Math.sin(a) * 420; } }
      run.proj.length = 0;
      emit(run, 'revive', { x: p.x, y: p.y });
    } else {
      p.flame = 0; run.phase = 'dead'; run.killedBy = src;
      emit(run, 'gameover', { x: p.x, y: p.y });
    }
  }
  return true;
}

export function addZone(run, z) { run.zones.push(z); if (run.zones.length > 40) run.zones.shift(); }
