// Canvas renderer: stage, light & shadow volumes, entities, HUD.
import { shadowPoly, UMB, LIT, ELIT } from '../logic/light.js';

const TAU = Math.PI * 2;
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
export const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; };

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const S = { W: 1, H: 1, dpr: 1, cam: { x: 0, y: 0, z: 1, tz: 1 }, glow: new Map(), act: null, ground: null, hatch: null, vig: null, safe: { t: 0, b: 0, l: 0, r: 0 }, ui: 1, font: '"Bodoni 72", "Bodoni MT", Didot, "Iowan Old Style", Georgia, serif' };

  function resize(w, h, dpr, safe) {
    S.W = w; S.H = h; S.dpr = dpr; if (safe) S.safe = safe;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    S.ui = Math.max(0.8, Math.min(1.35, Math.min(w, h) / 420));
    S.vig = null;
  }

  function glow(rgb) {
    let g = S.glow.get(rgb);
    if (!g) {
      g = document.createElement('canvas'); g.width = g.height = 64;
      const c = g.getContext('2d'), gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.35, `rgba(${rgb},0.45)`); gr.addColorStop(1, `rgba(${rgb},0)`);
      c.fillStyle = gr; c.fillRect(0, 0, 64, 64); S.glow.set(rgb, g);
    }
    return g;
  }
  const drawGlow = (rgb, x, y, r, a) => { ctx.globalAlpha = a; ctx.drawImage(glow(rgb), x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1; };

  function buildAct(act) {
    S.act = act.id;
    const pal = act.pal, gen = act.obstacles.gen;
    const g = document.createElement('canvas'); g.width = g.height = 256;
    const c = g.getContext('2d');
    c.fillStyle = pal.ground; c.fillRect(0, 0, 256, 256);
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 520; i++) { c.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.12)'; const s = rnd() * 2.5 + 0.5; c.fillRect(rnd() * 256, rnd() * 256, s, s); }
    c.strokeStyle = 'rgba(255,255,255,0.05)'; c.lineWidth = 1;
    if (gen === 'trees') for (let i = 0; i < 70; i++) { const x = rnd() * 256, y = rnd() * 256; c.beginPath(); c.moveTo(x, y); c.lineTo(x + rnd() * 4 - 2, y - 4 - rnd() * 5); c.stroke(); }
    if (gen === 'graves') for (let i = 0; i < 40; i++) { c.beginPath(); c.arc(rnd() * 256, rnd() * 256, rnd() * 3 + 1, 0, TAU); c.stroke(); }
    if (gen === 'gears') { c.strokeStyle = 'rgba(255,200,120,0.06)'; for (let i = 0; i <= 256; i += 64) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 256); c.moveTo(0, i); c.lineTo(256, i); c.stroke(); } }
    if (gen === 'floes') { c.strokeStyle = 'rgba(190,240,255,0.06)'; for (let i = 0; i < 24; i++) { c.beginPath(); c.arc(rnd() * 256, rnd() * 256, 10 + rnd() * 30, rnd() * 3, rnd() * 3 + 1); c.stroke(); } }
    if (gen === 'pillars') { c.strokeStyle = 'rgba(255,170,120,0.05)'; for (let i = 0; i <= 256; i += 128) { c.strokeRect(i, 0, 128, 128); c.strokeRect(i, 128, 128, 128); } }
    S.ground = ctx.createPattern(g, 'repeat');
    const h = document.createElement('canvas'); h.width = h.height = 10;
    const hc = h.getContext('2d'); hc.strokeStyle = pal.hatch; hc.lineWidth = 1.4;
    hc.beginPath(); hc.moveTo(-2, 12); hc.lineTo(12, -2); hc.moveTo(-2, 2); hc.lineTo(2, -2); hc.moveTo(8, 12); hc.lineTo(12, 8); hc.stroke();
    S.hatch = ctx.createPattern(h, 'repeat');
    S.lightRgb = pal.light; S.rimRgb = hexRgb(pal.rim);
  }

  function vignette() {
    if (S.vig) return S.vig;
    const v = document.createElement('canvas'); v.width = Math.max(1, Math.round(S.W / 2)); v.height = Math.max(1, Math.round(S.H / 2));
    const c = v.getContext('2d'), r = Math.hypot(v.width, v.height) / 2;
    const g = c.createRadialGradient(v.width / 2, v.height / 2, r * 0.45, v.width / 2, v.height / 2, r);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
    c.fillStyle = g; c.fillRect(0, 0, v.width, v.height);
    S.vig = v; return v;
  }

  function camUpdate(run, dt, snap) {
    const p = run.p, R = run.ctx ? run.ctx.R : 230;
    const short = Math.min(S.W, S.H);
    S.cam.tz = short / (Math.max(R, 210) * (S.W < S.H ? 2.3 : 2.75));
    const lead = 0.25;
    const tx = p.x + p.vx * lead, ty = p.y + p.vy * lead;
    const k = snap ? 1 : 1 - Math.exp(-6 * dt);
    S.cam.x += (tx - S.cam.x) * k; S.cam.y += (ty - S.cam.y) * k;
    S.cam.z += (S.cam.tz - S.cam.z) * (snap ? 1 : 1 - Math.exp(-2 * dt));
  }

  // ---------------- world drawing ----------------
  function pathPoly(w) { ctx.moveTo(w[0], w[1]); for (let i = 2; i < w.length; i += 2) ctx.lineTo(w[i], w[i + 1]); ctx.closePath(); }

  function drawObstacle(o, lx, ly, inLight, pal, t) {
    const a = Math.atan2(ly - o.y, lx - o.x);
    ctx.fillStyle = pal.obst;
    if (o.kind === 'p') {
      ctx.beginPath(); pathPoly(o.w); ctx.fill();
      if (o.type === 'grave') { ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(o.x - Math.cos(o.rot) * 6, o.y - Math.sin(o.rot) * 6); ctx.lineTo(o.x + Math.cos(o.rot) * 6, o.y + Math.sin(o.rot) * 6); ctx.stroke(); }
      if (o.type === 'floe') { ctx.strokeStyle = 'rgba(191,234,255,0.12)'; ctx.lineWidth = 1.5; ctx.beginPath(); for (let i = 0; i < o.w.length; i += 2) { const x = o.x + (o.w[i] - o.x) * 0.7, y = o.y + (o.w[i + 1] - o.y) * 0.7; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); ctx.stroke(); }
      if (inLight > 0) {
        ctx.strokeStyle = `rgba(${S.rimRgb},${0.9 * inLight})`; ctx.lineWidth = 2.5; ctx.beginPath();
        const w = o.w;
        for (let i = 0, j = w.length - 2; i < w.length; j = i, i += 2) {
          const mx = (w[i] + w[j]) / 2, my = (w[i + 1] + w[j + 1]) / 2, ex = w[i] - w[j], ey = w[i + 1] - w[j + 1];
          let nx = ey, ny = -ex; if ((mx - o.x) * nx + (my - o.y) * ny < 0) { nx = -nx; ny = -ny; }
          if ((lx - mx) * nx + (ly - my) * ny > 0) { ctx.moveTo(w[j], w[j + 1]); ctx.lineTo(w[i], w[i + 1]); }
        }
        ctx.stroke();
      }
      return;
    }
    const r = o.r;
    if (o.type === 'gear') {
      const teeth = 10; ctx.beginPath();
      for (let i = 0; i < teeth * 2; i++) { const aa = o.ang * 2 + (i / (teeth * 2)) * TAU, rr = i % 2 ? r : r * 1.18; ctx.lineTo(o.x + Math.cos(aa) * rr, o.y + Math.sin(aa) * rr); }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(232,163,61,0.12)'; ctx.setLineDash([4, 8]); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(o.ax, o.ay, o.or, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(232,163,61,0.25)'; ctx.beginPath(); ctx.arc(o.x, o.y, r * 0.25, 0, TAU); ctx.fill();
    } else if (o.type === 'orb') {
      const g = ctx.createRadialGradient(o.x - r * 0.3, o.y - r * 0.3, r * 0.1, o.x, o.y, r);
      g.addColorStop(0, '#8d82b8'); g.addColorStop(1, '#2a2346'); ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, TAU); ctx.fill();
    } else if (o.type === 'menhir') {
      const al = Math.min(1, o.t / 0.8);
      ctx.globalAlpha = al; ctx.fillStyle = '#16121f'; ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(180,160,255,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(o.x - 4, o.y - 6); ctx.lineTo(o.x + 4, o.y); ctx.lineTo(o.x - 4, o.y + 6); ctx.stroke(); ctx.globalAlpha = 1;
    } else {
      ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.045)'; ctx.lineWidth = 1.5;
      if (o.type === 'tree') { ctx.beginPath(); ctx.arc(o.x, o.y, r * 0.62, 0, TAU); ctx.moveTo(o.x + r * 0.3, o.y); ctx.arc(o.x, o.y, r * 0.3, 0, TAU); ctx.stroke(); }
      if (o.type === 'pillar') { ctx.beginPath(); for (let i = 0; i < 8; i++) { const aa = (i / 8) * TAU; ctx.moveTo(o.x + Math.cos(aa) * r * 0.55, o.y + Math.sin(aa) * r * 0.55); ctx.lineTo(o.x + Math.cos(aa) * r * 0.92, o.y + Math.sin(aa) * r * 0.92); } ctx.stroke(); }
    }
    if (inLight > 0 && o.type !== 'menhir') {
      ctx.strokeStyle = `rgba(${S.rimRgb},${0.95 * inLight})`; ctx.lineWidth = o.type === 'orb' ? 2 : 2.8;
      ctx.beginPath(); ctx.arc(o.x, o.y, r - 1, a - 1.15, a + 1.15); ctx.stroke();
    }
    void t;
  }

  function blob(x, y, r, t, seed, n = 12, amp = 0.14) {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU, rr = r * (1 + amp * Math.sin(t * 4 + i * 2.1 + seed * 17) + amp * 0.6 * Math.sin(t * 7 + i * 3.7));
      i ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  }
  function eyes(x, y, r, ang, col = '#ece6ff', sz = 0.22) {
    const ex = Math.cos(ang), ey = Math.sin(ang), px = -ey, py = ex;
    ctx.fillStyle = col;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + ex * r * 0.35 + px * s * r * 0.32, y + ey * r * 0.35 + py * s * r * 0.32, r * sz, r * sz * 0.7, ang, 0, TAU); ctx.fill(); }
  }

  function drawEnemy(e, run, t) {
    const p = run.p, x = e.x, y = e.y, r = e.r, look = Math.atan2(p.y - y, p.x - x);
    const burning = e.hurtT < 0.08;
    const L = e.pol === 'L';
    const ty = e.type, def = e.def;
    if (e.elite) { ctx.strokeStyle = 'rgba(255,215,120,0.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r + 5 + Math.sin(t * 5) * 1.5, 0, TAU); ctx.stroke(); }
    if (ty === 'funke' || ty === 'motte' || ty === 'irrlicht' || ty === 'glutklumpen' || ty === 'brenner' || ty === 'laternchen') {
      const rgb = hexRgb(def.col);
      const dim = burning && L ? 0.45 + 0.4 * Math.random() : 1;
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(rgb, x, y, r * 3.2, 0.55 * dim);
      ctx.globalCompositeOperation = 'source-over';
      if (ty === 'motte') {
        const f = Math.sin(e.age * 32) * 0.6;
        ctx.fillStyle = `rgba(255,246,214,${0.75 * dim})`;
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + Math.cos(look + s * 1.6) * r * 0.7, y + Math.sin(look + s * 1.6) * r * 0.7, r * (0.9 + f * 0.3), r * 0.45, look + s * (1.2 + f), 0, TAU); ctx.fill(); }
      }
      if (ty === 'brenner') {
        const a = e.st === 'dash' || e.st === 'wind' ? e.ang : Math.atan2(e.vy, e.vx) || look;
        ctx.fillStyle = `rgba(255,140,60,${dim})`; ctx.beginPath(); ctx.ellipse(x, y, r * 1.5, r * 0.8, a, 0, TAU); ctx.fill();
        if (e.st === 'wind') { ctx.strokeStyle = `rgba(255,255,255,${0.4 + e.warn * 0.6})`; ctx.lineWidth = 2 + e.warn * 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * (60 + e.warn * 140), y + Math.sin(a) * (60 + e.warn * 140)); ctx.stroke(); }
      }
      if (ty === 'glutklumpen') { ctx.fillStyle = `rgba(255,140,50,${dim})`; blob(x, y, r, t, e.seed, 9, 0.12); ctx.fill(); ctx.strokeStyle = 'rgba(80,20,0,0.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - r * 0.5, y - r * 0.2); ctx.lineTo(x, y + r * 0.1); ctx.lineTo(x + r * 0.4, y - r * 0.3); ctx.stroke(); }
      if (ty === 'irrlicht') { ctx.fillStyle = `rgba(210,240,255,${dim})`; ctx.beginPath(); ctx.moveTo(x, y - r * 1.9 - Math.sin(t * 9 + e.seed * 9) * 3); ctx.quadraticCurveTo(x + r * 1.1, y, x, y + r); ctx.quadraticCurveTo(x - r * 1.1, y, x, y - r * 1.9); ctx.fill(); }
      if (ty === 'laternchen') {
        ctx.strokeStyle = 'rgba(255,190,100,0.28)'; ctx.setLineDash([3, 6]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, def.aura, t * 0.5, t * 0.5 + TAU); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#2a1a0c'; ctx.beginPath(); ctx.arc(x, y + 2, r * 0.8, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffe2a0'; ctx.fillRect(x - 3, y - r - 4, 6, 8);
      }
      ctx.fillStyle = `rgba(255,252,236,${0.95 * dim})`;
      const core = ty === 'funke' ? r * (0.55 + Math.sin(t * 13 + e.seed * 40) * 0.08) : r * 0.42;
      ctx.beginPath(); ctx.arc(x, y, core, 0, TAU); ctx.fill();
      return;
    }
    if (ty === 'wechselbalg' || ty === 'spiegelfrau') {
      const rot = e.age * (ty === 'spiegelfrau' ? 0.8 : 2.4);
      ctx.globalCompositeOperation = 'lighter'; drawGlow('200,184,255', x, y, r * 2.4, 0.35); ctx.globalCompositeOperation = 'source-over';
      if (ty === 'spiegelfrau') {
        ctx.fillStyle = '#1a1430'; ctx.beginPath(); ctx.moveTo(x, y - r * 1.4); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r * 1.4); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill();
        ctx.save(); ctx.clip(); ctx.fillStyle = '#e8e0ff'; ctx.beginPath(); ctx.arc(x, y, r * 1.5, rot, rot + Math.PI); ctx.fill(); ctx.restore();
        ctx.strokeStyle = '#d9ccff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x, y - r * 1.4); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r * 1.4); ctx.lineTo(x - r, y); ctx.closePath(); ctx.stroke();
      } else {
        ctx.fillStyle = '#ece6ff'; ctx.beginPath(); ctx.arc(x, y, r, rot, rot + Math.PI); ctx.fill();
        ctx.fillStyle = '#120d22'; ctx.beginPath(); ctx.arc(x, y, r, rot + Math.PI, rot + TAU); ctx.fill();
        ctx.strokeStyle = '#c9b8ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      }
      if (e.hurtT < 0.12) { ctx.fillStyle = `rgba(255,255,255,${1 - e.hurtT / 0.12})`; ctx.beginPath(); ctx.arc(x, y, r * 1.1, 0, TAU); ctx.fill(); }
      return;
    }
    if (ty === 'kerzenmutter' || ty === 'uhrwerk') {
      ctx.globalCompositeOperation = 'lighter'; drawGlow(hexRgb(def.col), x, y, r * 3, burning ? 0.35 : 0.6); ctx.globalCompositeOperation = 'source-over';
      if (ty === 'kerzenmutter') {
        ctx.fillStyle = '#efe0c0'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.9, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#d9c39a'; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.3; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85, 6, 11, a, 0, TAU); ctx.fill(); }
        for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + t * 0.4; const fx = x + Math.cos(a) * r * 0.5, fy = y + Math.sin(a) * r * 0.5; ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.ellipse(fx, fy, 4, 7 + Math.sin(t * 11 + i) * 2, 0, 0, TAU); ctx.fill(); }
      } else {
        ctx.fillStyle = '#1d140a'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 3; ctx.stroke();
        ctx.lineWidth = 2; for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78); ctx.lineTo(x + Math.cos(a) * r * 0.92, y + Math.sin(a) * r * 0.92); ctx.stroke(); }
        ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(e.ang * 3) * r * 0.6, y + Math.sin(e.ang * 3) * r * 0.6); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(e.ang) * r * 0.8, y + Math.sin(e.ang) * r * 0.8); ctx.stroke();
      }
      return;
    }
    if (ty === 'finsternis') {
      const corona = e.pol === 'L' ? '255,200,110' : '170,120,255';
      ctx.globalCompositeOperation = 'lighter'; drawGlow(corona, x, y, r * (3 + (e.warn ? Math.sin(t * 30) * 0.4 : 0)), 0.75); ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#050208'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(${corona},0.9)`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 2, 0, TAU); ctx.stroke();
      if (e.pol === 'S') eyes(x, y, r, look, '#ffb0a0', 0.16);
      return;
    }
    // shadow creatures
    const ink = def.col;
    if (ty === 'nachtmahr') { ctx.strokeStyle = 'rgba(120,80,200,0.18)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, def.dimR, 0, TAU); ctx.stroke(); }
    if (ty === 'schattenhand' && e.dormant) {
      ctx.globalAlpha = 0.5 + Math.sin(t * 3 + e.seed * 9) * 0.2; eyes(x, y, r, look, '#b9a8ff', 0.18); ctx.globalAlpha = 1; return;
    }
    ctx.fillStyle = ink;
    if (ty === 'rabe' || ty === 'rabenkoenig') {
      const a = e.st === 'dive' || e.st === 'dash' || e.st === 'wind' ? e.ang : Math.atan2(e.vy, e.vx) || look;
      const flap = Math.sin(e.age * (ty === 'rabe' ? 18 : 9)) * 0.5;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(r * 1.4, 0); ctx.lineTo(-r * 0.8, r * 0.45); ctx.lineTo(-r * 1.3, 0); ctx.lineTo(-r * 0.8, -r * 0.45); ctx.closePath(); ctx.fill();
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(r * 0.3, 0); ctx.quadraticCurveTo(-r * 0.2, s * r * (1.6 + flap), -r * 0.9, s * r * (1.9 + flap)); ctx.lineTo(-r * 0.4, s * r * 0.3); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = '#ff5a5a'; ctx.beginPath(); ctx.arc(r * 0.8, -r * 0.12, r * 0.12, 0, TAU); ctx.fill();
      if (ty === 'rabenkoenig') { ctx.fillStyle = '#d9b860'; ctx.beginPath(); ctx.moveTo(r * 0.2, -r * 0.3); ctx.lineTo(r * 0.35, -r * 0.65); ctx.lineTo(r * 0.5, -r * 0.4); ctx.lineTo(r * 0.65, -r * 0.65); ctx.lineTo(r * 0.75, -r * 0.3); ctx.fill(); if (e.st === 'stun') { ctx.fillStyle = '#fff'; for (let i = 0; i < 3; i++) { const aa = t * 4 + (i / 3) * TAU; ctx.beginPath(); ctx.arc(Math.cos(aa) * r * 0.6, Math.sin(aa) * r * 0.6, 3, 0, TAU); ctx.fill(); } } }
      ctx.restore();
      if (e.st === 'wind') { ctx.strokeStyle = `rgba(255,90,90,${0.3 + e.warn * 0.6})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(e.ang) * 300, y + Math.sin(e.ang) * 300); ctx.stroke(); }
    } else {
      blob(x, y, r, t, e.seed, ty === 'tintenfleck' ? 14 : 12, ty === 'tintenfleck' ? 0.2 : 0.14); ctx.fill();
      if (ty === 'nachtmahr') { ctx.beginPath(); for (const s of [-1, 1]) { const a = look + s * 0.9; ctx.moveTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8); ctx.lineTo(x + Math.cos(a + s * 0.3) * r * 1.6, y + Math.sin(a + s * 0.3) * r * 1.6); ctx.lineTo(x + Math.cos(a + s * 0.5) * r * 0.7, y + Math.sin(a + s * 0.5) * r * 0.7); } ctx.fill(); }
      if (ty === 'schattenhand') { ctx.strokeStyle = ink; ctx.lineCap = 'round'; ctx.lineWidth = r * 0.35; ctx.beginPath(); for (let i = -2; i <= 2; i++) { const a = look + i * 0.32; ctx.moveTo(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6); ctx.lineTo(x + Math.cos(a) * r * (1.5 - Math.abs(i) * 0.12), y + Math.sin(a) * r * (1.5 - Math.abs(i) * 0.12)); } ctx.stroke(); ctx.lineCap = 'butt'; }
      ctx.strokeStyle = burning ? 'rgba(255,150,60,0.95)' : 'rgba(150,120,230,0.4)'; ctx.lineWidth = burning ? 2.5 : 1.2;
      blob(x, y, r, t, e.seed, ty === 'tintenfleck' ? 14 : 12, ty === 'tintenfleck' ? 0.2 : 0.14); ctx.stroke();
      eyes(x, y, r, look, ty === 'nachtmahr' ? '#ff6b6b' : '#ece6ff', ty === 'nachtmahr' ? 0.16 : 0.22);
      if (e.st === 'pounce') { ctx.strokeStyle = 'rgba(236,230,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r + 4, 0, TAU); ctx.stroke(); }
    }
  }

  function drawPlayer(run, t) {
    const p = run.p, s = run.stats;
    if (p.inv > 0 && run.phase !== 'clear' && Math.floor(t * 18) % 2 === 0 && p.inv < 2) return;
    const a = p.face, lx = p.x + Math.cos(a) * 7, ly = p.y + Math.sin(a) * 7;
    ctx.fillStyle = '#0a0812'; ctx.beginPath(); ctx.arc(p.x - Math.cos(a) * 3, p.y - Math.sin(a) * 3, 11, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(p.x - Math.cos(a) * 16, p.y - Math.sin(a) * 16); ctx.lineTo(p.x + Math.cos(a + 1.9) * 10, p.y + Math.sin(a + 1.9) * 10); ctx.lineTo(p.x + Math.cos(a - 1.9) * 10, p.y + Math.sin(a - 1.9) * 10); ctx.fill();
    ctx.strokeStyle = `rgba(${S.rimRgb},0.5)`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x - Math.cos(a) * 3, p.y - Math.sin(a) * 3, 11, a - 1.2, a + 1.2); ctx.stroke();
    const tier = run.feverTier, dark = p.douse > 0;
    const fl = (5 + tier * 1.6) * (0.9 + Math.sin(t * 17) * 0.08 + Math.sin(t * 29) * 0.05);
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(dark ? '120,90,200' : (tier >= 3 ? '255,240,220' : S.lightRgb), lx, ly, dark ? 14 : 30 + tier * 6, dark ? 0.4 : 0.9);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#2a2018'; ctx.fillRect(lx - 5, ly - 5, 10, 10);
    ctx.fillStyle = dark ? '#5a4a8a' : tier >= 3 ? '#ffffff' : '#fff1c6';
    ctx.beginPath(); ctx.ellipse(lx, ly - 1, fl * 0.45, fl * 0.75, 0, 0, TAU); ctx.fill();
    void s;
  }

  // ---------------- main render ----------------
  function render(run, view) {
    const { t, dt, fx, settings } = view;
    if (S.act !== run.act.id) { buildAct(run.act); camUpdate(run, dt, true); }
    camUpdate(run, dt, view.snap);
    const pal = run.act.pal, c = run.ctx, W = S.W, H = S.H, z = S.cam.z;
    const sh = fx.shakeOffset(settings.shake);
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    ctx.fillStyle = pal.dusk; ctx.fillRect(0, 0, W, H);
    const ox = W / 2 - S.cam.x * z + sh[0], oy = H / 2 - S.cam.y * z + sh[1];
    ctx.setTransform(S.dpr * z, 0, 0, S.dpr * z, S.dpr * ox, S.dpr * oy);
    const vx0 = -ox / z - 60, vy0 = -oy / z - 60, vx1 = (W - ox) / z + 60, vy1 = (H - oy) / z + 60;
    const vis = (x, y, r) => x + r > vx0 && x - r < vx1 && y + r > vy0 && y - r < vy1;
    // ground
    ctx.fillStyle = S.ground; ctx.fillRect(0, 0, run.world.w, run.world.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 30; ctx.strokeRect(-15, -15, run.world.w + 30, run.world.h + 30);
    // darkness outside the light, then light pool
    const lx = c.lx, ly = c.ly, R = c.R, uR = c.uR;
    const dk = ctx.createRadialGradient(lx, ly, R * 0.7, lx, ly, R * 1.6);
    dk.addColorStop(0, 'rgba(4,2,10,0)'); dk.addColorStop(1, 'rgba(4,2,10,0.55)');
    ctx.fillStyle = dk; ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    if (!c.dark) {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(lx, ly, 4, lx, ly, R);
      const hot = run.feverTier >= 3 ? 0.75 : 0.62;
      g.addColorStop(0, `rgba(${S.lightRgb},${hot})`); g.addColorStop(0.45, `rgba(${S.lightRgb},${hot * 0.42})`); g.addColorStop(1, `rgba(${S.lightRgb},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, R, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = `rgba(${S.lightRgb},0.12)`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(lx, ly, R, 0, TAU); ctx.stroke();
      // shadow volumes
      ctx.save(); ctx.beginPath(); ctx.arc(lx, ly, uR, 0, TAU); ctx.clip();
      ctx.beginPath();
      const far = uR * 2 + 50;
      for (const o of c.occ) {
        const dd = (o.x - lx) ** 2 + (o.y - ly) ** 2;
        if (dd > (uR + o.r) ** 2) continue;
        const sp = shadowPoly(lx, ly, o, far);
        if (sp) pathPoly(sp);
      }
      if (c.cone) { const fa = Math.atan2(c.cone.dy, c.cone.dx); ctx.moveTo(lx, ly); ctx.arc(lx, ly, R, fa + c.cone.half, fa - c.cone.half + TAU); ctx.closePath(); }
      ctx.fillStyle = pal.umbra; ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 0.55; ctx.fillStyle = S.hatch; ctx.fill(); ctx.globalAlpha = 1;
      ctx.restore();
    } else {
      const k = Math.min(1, (run.stats.douseDur - run.p.douse) / 0.12, run.p.douse / 0.15);
      ctx.globalAlpha = 0.85 * k; ctx.fillStyle = pal.umbra; ctx.beginPath(); ctx.arc(lx, ly, R, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.6 * k; ctx.fillStyle = S.hatch; ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = `rgba(170,140,255,${0.5 * k})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(lx, ly, R, 0, TAU); ctx.stroke();
    }
    // zones
    for (const zn of run.zones) {
      if (!vis(zn.x, zn.y, zn.r)) continue;
      const al = Math.min(1, zn.t / 0.6, (zn.max - zn.t) / 0.3 + 0.2);
      ctx.globalAlpha = 0.85 * al; ctx.fillStyle = zn.ink ? '#08060f' : pal.umbra; blob(zn.x, zn.y, zn.r, t * 0.3, zn.x % 7, 14, 0.08); ctx.fill();
      ctx.globalAlpha = 0.5 * al; ctx.fillStyle = S.hatch; ctx.fill(); ctx.globalAlpha = 1;
    }
    for (const a of run.ash) { ctx.globalAlpha = Math.min(1, a.t) * 0.35; ctx.fillStyle = '#9b93a8'; for (let i = 0; i < 7; i++) { const aa = i * 2.4 + a.x; ctx.fillRect(a.x + Math.cos(aa) * a.r * 0.6, a.y + Math.sin(aa) * a.r * 0.6, 3, 3); } ctx.globalAlpha = 1; }
    ctx.globalCompositeOperation = 'lighter';
    for (const em of run.embers) drawGlow('255,140,60', em.x, em.y, em.r, 0.35 * Math.min(1, em.t));
    for (const l of c.elights) drawGlow('255,190,110', l.x, l.y, l.r, 0.22);
    for (const w of run.wisps) { drawGlow('190,230,255', w.x, w.y, w.r, 0.32); drawGlow('230,245,255', w.x, w.y, 10, 1); }
    for (const b of run.beams.length ? run.beams : c.beams) {
      const gr = ctx.createLinearGradient(b.x1, b.y1, b.x2, b.y2);
      gr.addColorStop(0, 'rgba(255,220,140,0.8)'); gr.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.strokeStyle = gr; ctx.lineWidth = b.w * 2; ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,250,230,0.9)'; ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    // obstacles
    for (const o of c.occ) {
      if (!vis(o.x, o.y, o.r + 10)) continue;
      const dd = Math.sqrt((o.x - lx) ** 2 + (o.y - ly) ** 2);
      const inL = c.dark ? 0 : Math.max(0, Math.min(1, (R * 1.15 - dd + o.r) / 60));
      drawObstacle(o, lx, ly, inL, pal, t);
    }
    // pickups
    ctx.globalCompositeOperation = 'lighter';
    for (const k of run.pickups) { if (vis(k.x, k.y, 10)) drawGlow('255,200,110', k.x, k.y, 9, 0.8); }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffe3a3';
    for (const k of run.pickups) { if (!vis(k.x, k.y, 6)) continue; ctx.beginPath(); ctx.moveTo(k.x, k.y - 4); ctx.quadraticCurveTo(k.x + 3, k.y + 1, k.x, k.y + 3); ctx.quadraticCurveTo(k.x - 3, k.y + 1, k.x, k.y - 4); ctx.fill(); }
    // projectiles
    for (const q of run.proj) {
      if (!vis(q.x, q.y, 20)) continue;
      if (q.pol === 'L') { ctx.globalCompositeOperation = 'lighter'; drawGlow('255,230,170', q.x, q.y, 16, 0.9); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.arc(q.x, q.y, 4, 0, TAU); ctx.fill(); }
      else { ctx.fillStyle = 'rgba(150,100,255,0.35)'; ctx.beginPath(); ctx.arc(q.x, q.y, 10, 0, TAU); ctx.fill(); ctx.fillStyle = '#07050d'; ctx.beginPath(); ctx.arc(q.x, q.y, 5.5, 0, TAU); ctx.fill(); }
    }
    // enemies
    for (const e of run.enemies) if (vis(e.x, e.y, e.r * 3 + (e.def.aura || 0))) drawEnemy(e, run, t);
    drawPlayer(run, t);
    fx.drawWorld(ctx, drawGlow);
    // screen space
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    ctx.drawImage(vignette(), 0, 0, W, H);
    if (run.p.douse > 0) { ctx.fillStyle = 'rgba(20,10,40,0.18)'; ctx.fillRect(0, 0, W, H); }
    const fr = run.p.flame / run.stats.maxFlame;
    if (fr < 0.3 && run.phase !== 'dead') {
      const a = (0.3 - fr) / 0.3 * (0.55 + 0.25 * Math.sin(t * 6));
      const rg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      rg.addColorStop(0, 'rgba(160,20,20,0)'); rg.addColorStop(1, `rgba(160,20,20,${a})`);
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    }
    fx.drawScreen(ctx, W, H, settings);
    view.offscreen = [];
    for (const e of run.enemies) if (e.boss || e.elite) {
      const sx = e.x * z + ox, sy = e.y * z + oy;
      if (sx < 0 || sy < 0 || sx > W || sy > H) view.offscreen.push(e);
    }
    drawIndicators(view.offscreen, ox, oy, z);
  }

  function drawIndicators(list, ox, oy, z) {
    const W = S.W, H = S.H, m = 26;
    for (const e of list) {
      const sx = e.x * z + ox, sy = e.y * z + oy, a = Math.atan2(sy - H / 2, sx - W / 2);
      const x = Math.max(m, Math.min(W - m, sx)), y = Math.max(m + S.safe.t + 60, Math.min(H - m - S.safe.b, sy));
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = e.boss ? 'rgba(255,120,90,0.9)' : 'rgba(255,215,120,0.8)';
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, 7); ctx.lineTo(-6, -7); ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }

  // ---------------- HUD ----------------
  function hud(run, view) {
    const u = S.ui, W = S.W, s = run.stats, p = run.p, top = S.safe.t + 12 * u, left = S.safe.l + 14 * u, right = W - S.safe.r - 14 * u;
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    ctx.textBaseline = 'alphabetic';
    // flame bar
    const bw = Math.min(150 * u, W * 0.3), bh = 10 * u, fr = Math.max(0, p.flame / s.maxFlame);
    ctx.fillStyle = 'rgba(8,6,16,0.6)'; ctx.fillRect(left, top + 14 * u, bw, bh);
    const gg = ctx.createLinearGradient(left, 0, left + bw, 0); gg.addColorStop(0, '#ff7b39'); gg.addColorStop(1, '#ffe2a0');
    ctx.fillStyle = fr < 0.3 && Math.floor(view.t * 4) % 2 ? '#ff4d4d' : gg; ctx.fillRect(left, top + 14 * u, bw * fr, bh);
    ctx.strokeStyle = 'rgba(255,226,170,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(left + 0.5, top + 14 * u + 0.5, bw, bh);
    ctx.fillStyle = '#f3e6cf'; ctx.font = `${12 * u}px ${S.font}`;
    ctx.fillText(`Flamme ${Math.ceil(p.flame)}`, left, top + 10 * u);
    // xp
    ctx.fillStyle = 'rgba(8,6,16,0.6)'; ctx.fillRect(left, top + 28 * u, bw, 4 * u);
    ctx.fillStyle = '#c9b8ff'; ctx.fillRect(left, top + 28 * u, bw * Math.min(1, run.xp / run.xpNext), 4 * u);
    ctx.fillStyle = 'rgba(243,230,207,0.75)'; ctx.font = `${11 * u}px ${S.font}`;
    ctx.fillText(`Stufe ${run.level}`, left, top + 46 * u);
    // score & fever
    ctx.textAlign = 'right';
    ctx.fillStyle = '#f3e6cf'; ctx.font = `${22 * u}px ${S.font}`;
    ctx.fillText(Math.floor(run.score).toLocaleString('de-CH'), right - 44 * u, top + 18 * u);
    const tier = run.feverTier, mult = 1 + run.fever / 50;
    ctx.font = `italic ${12 * u}px ${S.font}`; ctx.fillStyle = tier ? `rgba(255,${200 - tier * 40},${120 - tier * 30},1)` : 'rgba(243,230,207,0.6)';
    ctx.fillText(tier ? `Fieber ${ROMAN[tier - 1]}  ×${mult.toFixed(1)}` : `×${mult.toFixed(1)}`, right - 44 * u, top + 36 * u);
    const fw = Math.min(90 * u, W * 0.2);
    for (let i = 0; i < 3; i++) {
      const seg = Math.max(0, Math.min(1, (run.fever - i * 33.4) / 33.3));
      ctx.fillStyle = 'rgba(8,6,16,0.6)'; ctx.fillRect(right - 44 * u - fw + i * (fw / 3), top + 42 * u, fw / 3 - 3, 4 * u);
      ctx.fillStyle = i === 2 ? '#fff4e0' : i === 1 ? '#ffb347' : '#ff7b39'; ctx.fillRect(right - 44 * u - fw + i * (fw / 3), top + 42 * u, (fw / 3 - 3) * seg, 4 * u);
    }
    ctx.textAlign = 'center';
    // act / boss
    const cx = W / 2;
    if (run.mode === 'encore') {
      ctx.fillStyle = 'rgba(243,230,207,0.6)'; ctx.font = `${11 * u}px ${S.font}`; ctx.fillText('Zugabe', cx, top + 8 * u);
      ctx.fillStyle = '#f3e6cf'; ctx.font = `${16 * u}px ${S.font}`; const m = Math.floor(run.t / 60), sec = Math.floor(run.t % 60);
      ctx.fillText(`${m}:${String(sec).padStart(2, '0')}`, cx, top + 26 * u);
    } else {
      ctx.fillStyle = 'rgba(243,230,207,0.6)'; ctx.font = `${11 * u}px ${S.font}`; ctx.fillText(run.act.sub, cx, top + 8 * u);
      ctx.fillStyle = '#f3e6cf'; ctx.font = `${16 * u}px ${S.font}`; ctx.fillText(run.act.name, cx, top + 26 * u);
    }
    const boss = run.enemies.find((e) => e.boss);
    const bw2 = Math.min(260 * u, W * 0.5);
    if (boss) {
      ctx.fillStyle = 'rgba(8,6,16,0.7)'; ctx.fillRect(cx - bw2 / 2, top + 34 * u, bw2, 7 * u);
      ctx.fillStyle = boss.pol === 'S' ? '#9b7bff' : boss.pol === 'X' ? '#d9ccff' : '#ffcf6e';
      ctx.fillRect(cx - bw2 / 2, top + 34 * u, bw2 * Math.max(0, boss.hp / boss.maxHp), 7 * u);
      ctx.fillStyle = '#f3e6cf'; ctx.font = `italic ${11 * u}px ${S.font}`; ctx.fillText(boss.def.name, cx, top + 54 * u);
    } else if (run.mode !== 'encore' && run.phase === 'play') {
      const pr = Math.min(1, run.actT / run.act.duration);
      ctx.fillStyle = 'rgba(8,6,16,0.5)'; ctx.fillRect(cx - bw2 / 4, top + 34 * u, bw2 / 2, 2 * u);
      ctx.fillStyle = 'rgba(255,207,135,0.7)'; ctx.fillRect(cx - bw2 / 4, top + 34 * u, (bw2 / 2) * pr, 2 * u);
    }
    ctx.textAlign = 'left';
    // joystick
    const j = view.joy;
    if (j && j.active) {
      ctx.strokeStyle = 'rgba(243,230,207,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(j.x0, j.y0, 56, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(243,230,207,0.35)'; ctx.beginPath(); ctx.arc(j.x0 + j.dx * 56, j.y0 + j.dy * 56, 22, 0, TAU); ctx.fill();
    }
  }

  return { resize, render, hud, S, buildAct, drawGlow };
}
