// Enemy AI + light/shadow damage. Pure.
import { classify, rayDist, LIT, UMB, ELIT, INK } from './light.js';
import { d2, clamp, pushOut, segPointD2 } from './geom.js';
import { emit, spawnEnemy, spawnProj, ring, hurtPlayer, addZone, insideSolid, inArena } from './core.js';

const OFFS = [0, -0.6, 0.6, -1.2, 1.2, -1.9, 1.9];
const TAU = Math.PI * 2;

export function isBad(pol, f) {
  if (pol === 'L') return !!(f & UMB) && !(f & ELIT);
  if (pol === 'S') return !!(f & LIT) && !(f & INK);
  return false;
}

function steer(run, e, tx, ty, dt, avoidOverride) {
  e.steerT -= dt;
  if (e.steerT > 0) return;
  e.steerT = 0.2 + run.rng() * 0.1;
  const want = Math.atan2(ty - e.y, tx - e.x);
  const av = avoidOverride !== undefined ? avoidOverride : (e.def.avoid || 0);
  if (d2(e.x, e.y, run.p.x, run.p.y) > 760 * 760) { e.head = want; return; }
  let best = want, bc = Infinity;
  for (let i = 0; i < OFFS.length; i++) {
    const o = OFFS[i], a = want + o;
    let c = Math.abs(o) * 0.45;
    if (c >= bc) continue;
    const sx = e.x + Math.cos(a) * 46, sy = e.y + Math.sin(a) * 46;
    if (insideSolid(run, sx, sy, e.r * 0.8)) c += 3;
    if (av > 0 && c < bc && isBad(e.pol, classify(run.ctx, sx, sy, e.id))) c += av * 2.4;
    if (c < bc) { bc = c; best = a; }
  }
  e.head = best;
}

const go = (e, sp, a = e.head) => { e.vx = Math.cos(a) * sp; e.vy = Math.sin(a) * sp; };
const stop = (e) => { e.vx = 0; e.vy = 0; };

function teleportNear(run, e, cx, cy, rMin, rMax, avoidBad) {
  for (let i = 0; i < 10; i++) {
    const a = run.rng() * TAU, r = run.rng.range(rMin, rMax);
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (!inArena(run, x, y, 60) || insideSolid(run, x, y, e.r + 4)) continue;
    if (avoidBad && isBad(e.pol, classify(run.ctx, x, y, e.id))) continue;
    emit(run, 'blink', { x0: e.x, y0: e.y, x, y, pol: e.pol });
    e.x = x; e.y = y; return true;
  }
  return false;
}

const aim = (e, p) => Math.atan2(p.y - e.y, p.x - e.x);

const BEH = {
  seek(run, e, dt) { const p = run.p; steer(run, e, p.x, p.y, dt); go(e, e.spd); },
  flutter(run, e, dt) { const p = run.p; steer(run, e, p.x, p.y, dt); go(e, e.spd, e.head + Math.sin(e.age * 5 + e.seed * 20) * 0.8); },
  keepaway(run, e, dt, dist, lo = 150, hi = 235) {
    const p = run.p, dx = p.x - e.x, dy = p.y - e.y;
    let tx = p.x, ty = p.y;
    if (dist < lo) { tx = e.x - dx; ty = e.y - dy; }
    else if (dist < hi) { const s = e.seed > 0.5 ? 1 : -1; tx = e.x - dy * s; ty = e.y + dx * s; }
    steer(run, e, tx, ty, dt); go(e, e.spd);
  },
  blinkshoot(run, e, dt, dist) {
    BEH.keepaway(run, e, dt, dist, 170, 270);
    const p = run.p;
    if (e.cd.a <= 0 && dist < 360) { spawnProj(run, e.x, e.y, aim(e, p), e.def.projSpeed, 'L', e.def.projDmg); e.cd.a = e.def.shootCd * run.rng.range(0.8, 1.2); emit(run, 'shoot', { x: e.x, y: e.y }); }
    if (e.cd.b <= 0) { teleportNear(run, e, e.x, e.y, 90, 150, true); e.cd.b = e.def.blinkCd * run.rng.range(0.8, 1.2); }
  },
  charger(run, e, dt, dist) {
    const p = run.p;
    e.stT -= dt;
    if (e.st === 'wind') { stop(e); e.warn = 1 - e.stT / 0.65; if (e.stT <= 0) { e.st = 'dash'; e.stT = 0.5; e.warn = 0; } }
    else if (e.st === 'dash') { go(e, 340, e.ang); if (e.stT <= 0) { e.st = 'rest'; e.stT = 0.45; } }
    else if (e.st === 'rest') { go(e, e.spd * 0.3); if (e.stT <= 0) { e.st = 'walk'; e.cd.a = e.def.chargeCd; } }
    else {
      BEH.seek(run, e, dt);
      if (dist < 280 && e.cd.a <= 0) { e.st = 'wind'; e.stT = 0.65; e.ang = aim(e, p); emit(run, 'charge', { x: e.x, y: e.y }); }
    }
  },
  lurk(run, e, dt, dist) {
    const p = run.p;
    if (e.st === 'pounce') { e.stT -= dt; go(e, e.spd * 2.6, e.ang); if (e.stT <= 0) e.st = 'walk'; return; }
    steer(run, e, p.x, p.y, dt); go(e, e.spd);
    if (dist < 120 && e.cd.a <= 0) { e.st = 'pounce'; e.stT = 0.45; e.ang = aim(e, p); e.cd.a = 2.4; emit(run, 'pounce', { x: e.x, y: e.y }); }
  },
  swoop(run, e, dt, dist) {
    const p = run.p;
    if (e.st === 'dive') { e.stT -= dt; go(e, 270, e.ang); if (e.stT <= 0) { e.st = 'walk'; e.cd.a = run.rng.range(2.6, 4); e.orb = Math.atan2(e.y - p.y, e.x - p.x); } return; }
    if (e.orb === undefined) e.orb = Math.atan2(e.y - p.y, e.x - p.x);
    e.orb += dt * (e.seed > 0.5 ? 1.2 : -1.2);
    const tx = p.x + Math.cos(e.orb) * 170, ty = p.y + Math.sin(e.orb) * 170;
    e.head = Math.atan2(ty - e.y, tx - e.x); go(e, e.spd);
    if (e.cd.a <= 0 && dist < 260) { e.st = 'dive'; e.stT = 0.75; e.ang = aim(e, p); emit(run, 'pounce', { x: e.x, y: e.y }); }
  },
  ambush(run, e, dt, dist) {
    if (e.dormant) { stop(e); if (dist < 150 || e.hurtT < 0.1) { e.dormant = false; emit(run, 'emerge', { x: e.x, y: e.y }); } return; }
    BEH.seek(run, e, dt);
  },
  inker(run, e, dt) {
    BEH.seek(run, e, dt);
    if (e.cd.a <= 0) { addZone(run, { x: e.x, y: e.y, r: 36, t: 7, max: 7, ink: true }); e.cd.a = e.def.puddleCd; emit(run, 'puddle', { x: e.x, y: e.y }); }
  },
  nightmare(run, e, dt, dist) {
    BEH.seek(run, e, dt);
    if (e.cd.a <= 0 && dist < 380) { spawnProj(run, e.x, e.y, aim(e, run.p), e.def.projSpeed, 'S', e.def.projDmg); e.cd.a = e.def.shootCd; emit(run, 'shoot', { x: e.x, y: e.y, pol: 'S' }); }
  },

  // ---------- bosses ----------
  boss_kerze(run, e, dt) {
    const half = e.hp < e.maxHp * 0.5;
    BEH.seek(run, e, dt);
    if (e.cd.a <= 0) { for (let i = 0; i < 2; i++) { const a = run.rng() * TAU; spawnEnemy(run, 'funke', e.x + Math.cos(a) * (e.r + 18), e.y + Math.sin(a) * (e.r + 18), { hpMul: 0.8 }); } e.cd.a = half ? 3.2 : 4.5; }
    if (e.cd.b <= 0) { ring(run, e.x, e.y, half ? 14 : 10, 100, () => 'L', 9, e.age); e.cd.b = 7; }
  },
  boss_rabe(run, e, dt, dist) {
    const p = run.p;
    e.stT -= dt;
    if (e.st === 'wind') { stop(e); e.warn = 1 - e.stT / 0.7; if (e.stT <= 0) { e.st = 'dash'; e.stT = 0.85; e.warn = 0; } return; }
    if (e.st === 'dash') { go(e, 360, e.ang); if (e.stT <= 0) { e.st = 'stun'; e.stT = 1.4; emit(run, 'stun', { x: e.x, y: e.y }); } return; }
    if (e.st === 'stun') { stop(e); if (e.stT <= 0) e.st = 'walk'; return; }
    if (e.orb === undefined) e.orb = Math.atan2(e.y - p.y, e.x - p.x);
    e.orb += dt * 0.55;
    const tx = p.x + Math.cos(e.orb) * 240, ty = p.y + Math.sin(e.orb) * 240;
    steer(run, e, tx, ty, dt, 0.9); go(e, e.spd);
    if (e.cd.a <= 0) { for (let i = 0; i < 4; i++) { const a = run.rng() * TAU; spawnEnemy(run, 'rabe', e.x + Math.cos(a) * 50, e.y + Math.sin(a) * 50); } e.cd.a = e.hp < e.maxHp * 0.5 ? 4 : 5.5; }
    if (e.cd.b <= 0 && dist < 420) { e.st = 'wind'; e.stT = 0.7; e.ang = aim(e, p); e.cd.b = 4.5; emit(run, 'charge', { x: e.x, y: e.y, boss: true }); }
  },
  boss_uhr(run, e, dt, dist) {
    const half = e.hp < e.maxHp * 0.5;
    BEH.keepaway(run, e, dt, dist, 170, 260);
    e.ang += dt * (half ? 0.55 : 0.36);
    const n = half ? 3 : 2, p = run.p;
    for (let k = 0; k < n; k++) {
      const a = e.ang + (k / n) * TAU, ca = Math.cos(a), sa = Math.sin(a);
      const L = rayDist(e.x + ca * (e.r + 2), e.y + sa * (e.r + 2), ca, sa, 520, run.ctx.occ) + e.r + 2;
      const x2 = e.x + ca * L, y2 = e.y + sa * L;
      run.beams.push({ id: e.id, x1: e.x, y1: e.y, x2, y2, w: 16 });
      if (segPointD2(e.x, e.y, x2, y2, p.x, p.y) < 26 * 26) hurtPlayer(run, 8, 'uhrwerk');
    }
    if (e.cd.a <= 0) { for (let i = 0; i < 2; i++) { const a = run.rng() * TAU; spawnEnemy(run, run.rng.chance(0.5) ? 'brenner' : 'glutklumpen', e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60); } e.cd.a = 6.5; }
    if (e.cd.b <= 0) { ring(run, e.x, e.y, 10, 100, () => 'L', 10, e.age * 1.3); e.cd.b = 8; }
  },
  boss_spiegel(run, e, dt) {
    BEH.flutter(run, e, dt);
    const p = run.p;
    if (e.cd.a <= 0) { teleportNear(run, e, p.x, p.y, 200, 300, false); e.cd.a = e.hp < e.maxHp * 0.5 ? 3.4 : 4.6; }
    if (e.cd.b <= 0) { for (let i = 0; i < 2; i++) { const a = run.rng() * TAU; spawnEnemy(run, 'wechselbalg', e.x + Math.cos(a) * 50, e.y + Math.sin(a) * 50); } e.cd.b = 6.5; }
    if (e.cd.c <= 0) { ring(run, e.x, e.y, 8, 110, (i) => (i % 2 ? 'L' : 'S'), 10, e.age); e.cd.c = 5; }
  },
  boss_finsternis(run, e, dt) {
    const fr = e.hp / e.maxHp;
    let pol;
    if (fr > 0.66) pol = 'L';
    else if (fr > 0.33) pol = 'S';
    else { e.phT = (e.phT || 0) + dt; pol = Math.floor(e.phT / 6) % 2 ? 'S' : 'L'; e.warn = (e.phT % 6) > 5 ? 1 : 0; }
    if (pol !== e.pol) { e.pol = pol; emit(run, 'bossphase', { x: e.x, y: e.y, pol }); }
    BEH.seek(run, e, dt);
    if (e.cd.a <= 0) {
      const kinds = fr > 0.33 ? ['funke', 'schemen'] : ['funke', 'schemen', 'wechselbalg', 'brenner'];
      for (let i = 0; i < 4; i++) { const a = run.rng() * TAU; spawnEnemy(run, kinds[i % kinds.length], e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60); }
      e.cd.a = 5.5;
    }
    if (e.cd.b <= 0) { ring(run, e.x, e.y, 14, 100, (i) => (i % 2 ? 'L' : 'S'), 11, e.age); e.cd.b = 7; }
  },
};

export function lightDamage(run, e, f, dt) {
  const s = run.stats, mult = run.dmgMul;
  let dmg = 0, cause = null;
  if (e.pol === 'L') { if ((f & UMB) && !(f & ELIT)) { dmg = s.umbraDps * mult * dt; cause = 'umbra'; } }
  else if (e.pol === 'S') { if ((f & LIT) && !(f & INK)) { dmg = s.lightDps * run.ctx.inten * mult * dt; cause = 'light'; } }
  else {
    const st = (f & UMB) && !(f & ELIT) ? 2 : (f & LIT ? 1 : 0);
    if (st) {
      if (e.flipS && st !== e.flipS && e.flipCd <= 0) { dmg = s.flipMul; e.flipCd = e.def.flipCd || 0.22; cause = 'flip'; emit(run, 'flip', { x: e.x, y: e.y, boss: e.boss }); }
      e.flipS = st;
    }
  }
  if (dmg > 0) { e.hp -= dmg; e.hurtT = 0; e.lastCause = cause; run.dmgDealt += dmg; }
}

export function updateEnemy(run, e, dt) {
  e.age += dt; e.hurtT += dt; e.flipCd -= dt; e.cd.a -= dt; e.cd.b -= dt; e.cd.c -= dt; e.slowT -= dt;
  const p = run.p;
  const f = (e.flags = classify(run.ctx, e.x, e.y, e.id));
  lightDamage(run, e, f, dt);
  const dist = Math.sqrt(d2(e.x, e.y, p.x, p.y));
  BEH[e.def.beh](run, e, dt, dist);
  let sm = 1;
  if (e.slowT > 0) sm *= 0.6;
  if (e.pol === 'S' && (f & LIT)) sm *= run.stats.schemenSlow;
  for (const a of run.ash) if (d2(e.x, e.y, a.x, a.y) < a.r * a.r) { sm *= 0.6; break; }
  const k = Math.exp(-7 * dt);
  e.x += (e.vx * sm + e.kx) * dt; e.y += (e.vy * sm + e.ky) * dt;
  e.kx *= k; e.ky *= k;
  if (!e.boss || e.st !== 'dash') {
    for (const o of run.world.obstacles) if (o.solid) pushOut(e, e.r, o);
    for (const o of run.menhirs) pushOut(e, e.r, o);
  }
  const W = run.world;
  e.x = clamp(e.x, 20 + e.r, W.w - 20 - e.r); e.y = clamp(e.y, 20 + e.r, W.h - 20 - e.r);
  if (!e.dormant && dist < e.r + 11 && e.hp > 0) {
    if (hurtPlayer(run, e.dmg, e.type)) {
      if (e.type === 'schattenhand') p.slowT = e.def.slow;
      const a = Math.atan2(e.y - p.y, e.x - p.x);
      if (!e.boss) { e.kx += Math.cos(a) * 240; e.ky += Math.sin(a) * 240; }
      if (e.st === 'pounce' || e.st === 'dive') e.st = 'walk';
    }
  }
}
