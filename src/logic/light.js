// Light & shadow core: occlusion, classification, shadow polygons. Pure.
import { segCircle, segPoly, pointInPoly, segPointD2, d2 } from './geom.js';

export const LIT = 1, UMB = 2, ELIT = 4, INK = 8;

export function contains(o, x, y) {
  if (o.kind === 'c') return d2(x, y, o.x, o.y) < o.r * o.r;
  if (x < o.bx0 || x > o.bx1 || y < o.by0 || y > o.by1) return false;
  return pointInPoly(x, y, o.w);
}

export function occluded(ax, ay, bx, by, occ) {
  const minx = ax < bx ? ax : bx, maxx = ax < bx ? bx : ax, miny = ay < by ? ay : by, maxy = ay < by ? by : ay;
  for (let i = 0; i < occ.length; i++) {
    const o = occ[i];
    if (o.kind === 'c') {
      const r = o.r * 0.94;
      if (o.x + r < minx || o.x - r > maxx || o.y + r < miny || o.y - r > maxy) continue;
      if (segCircle(ax, ay, bx, by, o.x, o.y, r) && !contains(o, ax, ay) && d2(bx, by, o.x, o.y) > r * r * 0.25) return true;
    } else {
      if (o.bx1 < minx || o.bx0 > maxx || o.by1 < miny || o.by0 > maxy) continue;
      if (segPoly(ax, ay, bx, by, o.w) && !contains(o, ax, ay)) return true;
    }
  }
  return false;
}

/**
 * ctx: { lx, ly, R, uR, dark, cone:null|{dx,dy,cos}, occ, wisps[], embers[], zones[], elights[], beams[] }
 * Returns flags; ctx.inten set to light intensity (0..1) for LIT.
 */
export function classify(ctx, x, y, selfId) {
  let f = 0, inten = 0;
  const dx = x - ctx.lx, dy = y - ctx.ly, dd = dx * dx + dy * dy;
  const R2 = ctx.R * ctx.R;
  if (dd <= ctx.uR * ctx.uR) {
    if (ctx.dark) { if (dd <= R2) f |= UMB; }
    else {
      let inCone = true;
      if (ctx.cone && dd > 64) {
        const d = Math.sqrt(dd);
        if ((dx * ctx.cone.dx + dy * ctx.cone.dy) / d < ctx.cone.cos) inCone = false;
      }
      if (!inCone) { if (dd <= R2) f |= UMB; }
      else if (occluded(ctx.lx, ctx.ly, x, y, ctx.occ)) f |= UMB;
      else if (dd <= R2) { f |= LIT; const t = 1.25 - Math.sqrt(dd) / ctx.R; inten = t > 1 ? 1 : t; }
    }
  }
  for (let i = 0; i < ctx.wisps.length; i++) {
    const w = ctx.wisps[i];
    if (d2(x, y, w.x, w.y) <= w.r * w.r && !occluded(w.x, w.y, x, y, ctx.occ)) { f |= LIT; if (inten < 0.75) inten = 0.75; }
  }
  for (let i = 0; i < ctx.embers.length; i++) {
    const e = ctx.embers[i];
    if (d2(x, y, e.x, e.y) <= e.r * e.r) { f |= LIT; if (inten < 0.55) inten = 0.55; }
  }
  for (let i = 0; i < ctx.zones.length; i++) {
    const z = ctx.zones[i];
    if (d2(x, y, z.x, z.y) <= z.r * z.r) { f |= UMB; if (z.ink) f |= INK; }
  }
  for (let i = 0; i < ctx.elights.length; i++) {
    const l = ctx.elights[i];
    if (l.id !== selfId && d2(x, y, l.x, l.y) <= l.r * l.r) { f |= ELIT; break; }
  }
  for (let i = 0; i < ctx.beams.length; i++) {
    const b = ctx.beams[i];
    if (b.id !== selfId && segPointD2(b.x1, b.y1, b.x2, b.y2, x, y) <= b.w * b.w) { f |= ELIT; break; }
  }
  ctx.inten = inten;
  return f;
}

// Distance along a ray until it hits an occluder (or maxLen).
export function rayDist(ox, oy, dx, dy, maxLen, occ) {
  let best = maxLen;
  for (let i = 0; i < occ.length; i++) {
    const o = occ[i];
    if (o.kind === 'c') {
      const fx = ox - o.x, fy = oy - o.y, b = fx * dx + fy * dy, c = fx * fx + fy * fy - o.r * o.r;
      if (c < 0) continue;
      const disc = b * b - c;
      if (disc < 0) continue;
      const t = -b - Math.sqrt(disc);
      if (t > 0 && t < best) best = t;
    } else {
      const w = o.w;
      for (let k = 0, j = w.length - 2; k < w.length; j = k, k += 2) {
        const ex = w[k] - w[j], ey = w[k + 1] - w[j + 1];
        const den = dx * ey - dy * ex;
        if (den === 0) continue;
        const qx = w[j] - ox, qy = w[j + 1] - oy;
        const t = (qx * ey - qy * ex) / den, u = (qx * dy - qy * dx) / den;
        if (t > 0 && u >= 0 && u <= 1 && t < best) best = t;
      }
    }
  }
  return best;
}

// Shadow volume polygon behind obstacle o as seen from (lx,ly), extruded to distance far.
export function shadowPoly(lx, ly, o, far) {
  let a1, a2, p1x, p1y, p2x, p2y;
  if (o.kind === 'c') {
    const dx = o.x - lx, dy = o.y - ly, d = Math.sqrt(dx * dx + dy * dy);
    if (d <= o.r + 0.5) return null;
    const base = Math.atan2(dy, dx), half = Math.asin(o.r / d);
    const tl = Math.sqrt(Math.max(0, d * d - o.r * o.r));
    a1 = base - half; a2 = base + half;
    p1x = lx + Math.cos(a1) * tl; p1y = ly + Math.sin(a1) * tl;
    p2x = lx + Math.cos(a2) * tl; p2y = ly + Math.sin(a2) * tl;
  } else {
    if (contains(o, lx, ly)) return null;
    const w = o.w;
    const ref = Math.atan2(o.y - ly, o.x - lx);
    let mn = Infinity, mx = -Infinity, imn = 0, imx = 0;
    for (let i = 0; i < w.length; i += 2) {
      let a = Math.atan2(w[i + 1] - ly, w[i] - lx) - ref;
      while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2;
      if (a < mn) { mn = a; imn = i; } if (a > mx) { mx = a; imx = i; }
    }
    a1 = ref + mn; a2 = ref + mx;
    p1x = w[imn]; p1y = w[imn + 1]; p2x = w[imx]; p2y = w[imx + 1];
  }
  const out = [p1x, p1y];
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const a = a1 + ((a2 - a1) * i) / steps;
    out.push(lx + Math.cos(a) * far, ly + Math.sin(a) * far);
  }
  out.push(p2x, p2y);
  return out;
}
