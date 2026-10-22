// Arena generation per act + moving obstacles. Pure.
import { d2, makeConvex, rectLocal, syncPoly, clamp } from './geom.js';

let OID = 1;

function circle(type, x, y, r, extra) { return Object.assign({ id: OID++, kind: 'c', type, x, y, r, r0: r, solid: true }, extra || {}); }
function poly(type, x, y, pts, rot, extra) {
  let br = 0;
  for (let i = 0; i < pts.length; i += 2) br = Math.max(br, Math.hypot(pts[i], pts[i + 1]));
  const o = Object.assign({ id: OID++, kind: 'p', type, x, y, pts, rot, r: br, solid: true }, extra || {});
  syncPoly(o);
  return o;
}

function fits(list, x, y, r, w, h, gap, cx, cy) {
  if (x - r < 60 || y - r < 60 || x + r > w - 60 || y + r > h - 60) return false;
  if (d2(x, y, cx, cy) < (170 + r) * (170 + r)) return false;
  for (const o of list) {
    const rr = o.r + r + gap;
    const ox = o.ax !== undefined ? o.ax : o.x, oy = o.ay !== undefined ? o.ay : o.y;
    const extra = (o.or || 0);
    if (d2(x, y, ox, oy) < (rr + extra) * (rr + extra)) return false;
  }
  return true;
}

export function buildArena(act, rng, opts = {}) {
  const w = act.arena.w, h = act.arena.h, cx = w / 2, cy = h / 2;
  const g = act.obstacles, obs = [];
  const tries = 600;
  const place = (r, make, gap = 80, extraR = 0) => {
    for (let i = 0; i < tries; i++) {
      const x = rng.range(80, w - 80), y = rng.range(80, h - 80);
      if (fits(obs, x, y, r + extraR, w, h, gap, cx, cy)) { obs.push(make(x, y)); return true; }
    }
    return false;
  };
  if (opts.tutorial) obs.push(circle('tree', cx + 120, cy - 6, 36));
  if (g.gen === 'trees') {
    for (let i = 0; i < g.count; i++) { const r = rng.range(g.rMin, g.rMax); place(r, (x, y) => circle('tree', x, y, r, { seed: rng() })); }
  } else if (g.gen === 'graves') {
    for (let i = 0; i < g.count; i++) {
      const gw = rng.range(g.wMin, g.wMax), gh = rng.range(g.hMin, g.hMax), rot = rng.range(-0.35, 0.35) + (rng.chance(0.3) ? Math.PI / 2 : 0);
      place(Math.hypot(gw, gh) / 2, (x, y) => poly('grave', x, y, rectLocal(gw, gh), rot, { seed: rng() }));
    }
    for (let i = 0; i < 4; i++) { const r = rng.range(16, 22); place(r, (x, y) => circle('urn', x, y, r)); }
  } else if (g.gen === 'gears') {
    for (let i = 0; i < g.count; i++) {
      const r = rng.range(g.rMin, g.rMax), orr = rng.range(g.orbit[0], g.orbit[1]);
      place(r, (x, y) => circle('gear', x + orr, y, r, { ax: x, ay: y, or: orr, ang: rng() * 6.283, w: rng.sign() * rng.range(0.35, 0.7), solid: true }), 70, orr);
    }
    for (let i = 0; i < g.static; i++) { const r = rng.range(24, 36); place(r, (x, y) => circle('pillar', x, y, r)); }
  } else if (g.gen === 'floes') {
    for (let i = 0; i < g.count; i++) {
      const r = rng.range(g.rMin, g.rMax), a = rng() * 6.283, sp = rng.range(0.4, 1) * g.drift;
      place(r, (x, y) => poly('floe', x, y, makeConvex(rng, r, rng.int(5, 7), rng.range(0.8, 1.3)), rng() * 6.283, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vr: rng.range(-0.08, 0.08), solid: true }));
    }
  } else if (g.gen === 'pillars') {
    for (let i = 0; i < g.count; i++) { const r = rng.range(g.rMin, g.rMax); place(r, (x, y) => circle('pillar', x, y, r, { crumble: g.crumble || 0, seed: rng() })); }
  }
  for (const o of obs) if (o.ax !== undefined) { o.x = o.ax + Math.cos(o.ang) * o.or; o.y = o.ay + Math.sin(o.ang) * o.or; }
  return { w, h, cx, cy, obstacles: obs };
}

export function updateWorld(world, dt, progress) {
  for (const o of world.obstacles) {
    if (o.ax !== undefined) {
      o.ang += o.w * dt;
      o.x = o.ax + Math.cos(o.ang) * o.or; o.y = o.ay + Math.sin(o.ang) * o.or;
    } else if (o.vx !== undefined) {
      o.x += o.vx * dt; o.y += o.vy * dt; o.rot += o.vr * dt;
      if (o.x < 90 + o.r || o.x > world.w - 90 - o.r) { o.vx = -o.vx; o.x = clamp(o.x, 90 + o.r, world.w - 90 - o.r); }
      if (o.y < 90 + o.r || o.y > world.h - 90 - o.r) { o.vy = -o.vy; o.y = clamp(o.y, 90 + o.r, world.h - 90 - o.r); }
      syncPoly(o);
    }
    if (o.crumble) o.r = o.r0 * (1 - o.crumble * clamp(progress, 0, 1));
  }
}
