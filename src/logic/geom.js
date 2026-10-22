// Geometry helpers. Polygons are flat arrays [x0,y0,x1,y1,...] in world space.
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const d2 = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
export const len = (x, y) => Math.sqrt(x * x + y * y);
export const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

export function segPointD2(ax, ay, bx, by, px, py) {
  const vx = bx - ax, vy = by - ay;
  const l2 = vx * vx + vy * vy;
  let t = l2 > 0 ? ((px - ax) * vx + (py - ay) * vy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + vx * t - px, cy = ay + vy * t - py;
  return cx * cx + cy * cy;
}

export function segCircle(ax, ay, bx, by, cx, cy, r) {
  return segPointD2(ax, ay, bx, by, cx, cy) < r * r;
}

export function segSeg(ax, ay, bx, by, cx, cy, dx, dy) {
  const r1x = bx - ax, r1y = by - ay, r2x = dx - cx, r2y = dy - cy;
  const den = r1x * r2y - r1y * r2x;
  if (den === 0) return false;
  const qx = cx - ax, qy = cy - ay;
  const t = (qx * r2y - qy * r2x) / den;
  const u = (qx * r1y - qy * r1x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

export function pointInPoly(x, y, p) {
  let inside = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i], yi = p[i + 1], xj = p[j], yj = p[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function segPoly(ax, ay, bx, by, p) {
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    if (segSeg(ax, ay, bx, by, p[j], p[j + 1], p[i], p[i + 1])) return true;
  }
  return false;
}

// Closest point on polygon boundary; returns [x, y, dist2]
export function closestOnPoly(px, py, p) {
  let best = Infinity, bx = 0, by = 0;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const ax = p[j], ay = p[j + 1], vx = p[i] - ax, vy = p[i + 1] - ay;
    const l2 = vx * vx + vy * vy;
    let t = l2 > 0 ? ((px - ax) * vx + (py - ay) * vy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = ax + vx * t, cy = ay + vy * t;
    const dd = (cx - px) * (cx - px) + (cy - py) * (cy - py);
    if (dd < best) { best = dd; bx = cx; by = cy; }
  }
  return [bx, by, best];
}

// Push a circle entity {x,y} with radius r out of obstacle o. Returns true if pushed.
export function pushOut(e, r, o) {
  if (o.kind === 'c') {
    const dx = e.x - o.x, dy = e.y - o.y, rr = r + o.r;
    const dd = dx * dx + dy * dy;
    if (dd >= rr * rr) return false;
    const d = Math.sqrt(dd) || 0.0001;
    e.x = o.x + (dx / d) * rr; e.y = o.y + (dy / d) * rr;
    return true;
  }
  if (e.x < o.bx0 - r || e.x > o.bx1 + r || e.y < o.by0 - r || e.y > o.by1 + r) return false;
  const inside = pointInPoly(e.x, e.y, o.w);
  const [cx, cy, dd] = closestOnPoly(e.x, e.y, o.w);
  if (!inside && dd >= r * r) return false;
  const d = Math.sqrt(dd) || 0.0001;
  let nx = (e.x - cx) / d, ny = (e.y - cy) / d;
  if (inside) { nx = -nx; ny = -ny; }
  e.x = cx + nx * r; e.y = cy + ny * r;
  return true;
}

// Regular-ish convex polygon (points on an ellipse) in local coords.
export function makeConvex(rng, r, sides, stretch) {
  const pts = [];
  const base = rng() * Math.PI * 2;
  const angs = [];
  for (let i = 0; i < sides; i++) angs.push(base + (i / sides) * Math.PI * 2 + rng.range(-0.25, 0.25) * (Math.PI * 2 / sides));
  angs.sort((a, b) => a - b);
  for (const a of angs) pts.push(Math.cos(a) * r * stretch, Math.sin(a) * r);
  return pts;
}

export function rectLocal(w, h) { const x = w / 2, y = h / 2; return [-x, -y, x, -y, x, y, -x, y]; }

// Update world coords + AABB of a polygon obstacle.
export function syncPoly(o) {
  const c = Math.cos(o.rot), s = Math.sin(o.rot), L = o.pts;
  if (!o.w || o.w.length !== L.length) o.w = new Array(L.length);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < L.length; i += 2) {
    const x = o.x + L[i] * c - L[i + 1] * s, y = o.y + L[i] * s + L[i + 1] * c;
    o.w[i] = x; o.w[i + 1] = y;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  o.bx0 = x0; o.by0 = y0; o.bx1 = x1; o.by1 = y1;
}
