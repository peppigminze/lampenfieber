// Particles, rings, floating text, screenshake, flash, hitstop.
const TAU = Math.PI * 2;
export const ease = { outCubic: (t) => 1 - Math.pow(1 - t, 3), outBack: (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2), inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2) };

export function createFx() {
  const P = [], rings = [], texts = [];
  const fx = { trauma: 0, flashA: 0, flashCol: '255,255,255', freeze: 0, slow: 1, slowT: 0, max: 600, t: 0 };

  fx.setQuality = (q) => { fx.max = q === 'niedrig' ? 220 : 600; };
  fx.clear = () => { P.length = 0; rings.length = 0; texts.length = 0; fx.trauma = 0; fx.flashA = 0; };
  fx.shake = (a) => { fx.trauma = Math.min(1, fx.trauma + a); };
  fx.flash = (rgb, a) => { fx.flashCol = rgb; fx.flashA = Math.max(fx.flashA, a); };
  fx.hitstop = (s) => { fx.freeze = Math.max(fx.freeze, s); };
  fx.slowmo = (k, s) => { fx.slow = k; fx.slowT = s; };

  fx.emit = (type, x, y, o = {}) => {
    if (P.length >= fx.max) return;
    const a = o.a !== undefined ? o.a + (Math.random() - 0.5) * (o.spread || 0) : Math.random() * TAU;
    const sp = (o.speed || 60) * (0.4 + Math.random() * 0.8);
    P.push({ type, x, y, vx: Math.cos(a) * sp + (o.vx || 0), vy: Math.sin(a) * sp + (o.vy || 0), life: 0, max: (o.life || 0.6) * (0.7 + Math.random() * 0.6), size: (o.size || 3) * (0.7 + Math.random() * 0.6), col: o.col || '255,220,150', drag: o.drag !== undefined ? o.drag : 3, grav: o.grav || 0, add: o.add !== undefined ? o.add : type === 'spark' || type === 'ember' });
  };
  fx.burst = (type, x, y, n, o) => { for (let i = 0; i < n; i++) fx.emit(type, x, y, o); };
  fx.ring = (x, y, r0, r1, life, col, w = 3, add = true) => rings.push({ x, y, r0, r1, life: 0, max: life, col, w, add });
  fx.text = (x, y, str, col = '255,226,170', size = 14) => texts.push({ x, y, str, col, size, life: 0, max: 1.1 });

  fx.update = (dt) => {
    fx.t += dt;
    fx.trauma = Math.max(0, fx.trauma - dt * 1.6);
    fx.flashA = Math.max(0, fx.flashA - dt * 3);
    if (fx.slowT > 0) { fx.slowT -= dt; if (fx.slowT <= 0) fx.slow = 1; }
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.life += dt;
      if (p.life >= p.max) { P[i] = P[P.length - 1]; P.pop(); continue; }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vy = p.vy * k + p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (let i = rings.length - 1; i >= 0; i--) { rings[i].life += dt; if (rings[i].life >= rings[i].max) rings.splice(i, 1); }
    for (let i = texts.length - 1; i >= 0; i--) { texts[i].life += dt; texts[i].y -= 28 * dt; if (texts[i].life >= texts[i].max) texts.splice(i, 1); }
  };

  fx.shakeOffset = (on) => {
    if (!on || fx.trauma <= 0) return [0, 0];
    const m = fx.trauma * fx.trauma * 16;
    return [Math.sin(fx.t * 61.3) * m + (Math.random() - 0.5) * m * 0.6, Math.cos(fx.t * 53.7) * m + (Math.random() - 0.5) * m * 0.6];
  };

  fx.drawWorld = (ctx, drawGlow) => {
    ctx.globalCompositeOperation = 'lighter';
    for (const p of P) {
      if (p.type !== 'spark' && p.type !== 'ember') continue;
      const k = 1 - p.life / p.max;
      drawGlow(p.col, p.x, p.y, p.size * 2.4 * (0.4 + k * 0.6), k);
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const p of P) {
      const k = 1 - p.life / p.max;
      if (p.type === 'spark' || p.type === 'ember') continue;
      if (p.type === 'smoke') {
        ctx.fillStyle = `rgba(${p.col},${0.35 * k})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.8 - k), 0, TAU); ctx.fill();
      } else if (p.type === 'ink') {
        ctx.fillStyle = `rgba(${p.col},${0.85 * k})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + k * 0.5), 0, TAU); ctx.fill();
      } else if (p.type === 'shard') {
        ctx.strokeStyle = `rgba(${p.col},${k})`; ctx.lineWidth = p.size * 0.5;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05); ctx.stroke();
      }
    }
    for (const r of rings) {
      const k = r.life / r.max, e = ease.outCubic(k);
      ctx.globalCompositeOperation = r.add ? 'lighter' : 'source-over';
      ctx.strokeStyle = `rgba(${r.col},${1 - k})`; ctx.lineWidth = r.w * (1 - k * 0.6);
      ctx.beginPath(); ctx.arc(r.x, r.y, Math.max(1, r.r0 + (r.r1 - r.r0) * e), 0, TAU); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.textAlign = 'center';
    for (const t of texts) {
      const k = t.life / t.max, s = t.size * (k < 0.15 ? ease.outBack(k / 0.15) : 1);
      ctx.font = `italic ${s}px "Bodoni 72", "Bodoni MT", Didot, Georgia, serif`;
      ctx.fillStyle = `rgba(${t.col},${1 - k * k})`; ctx.fillText(t.str, t.x, t.y);
    }
    ctx.textAlign = 'left';
  };

  fx.drawScreen = (ctx, W, H, settings) => {
    if (fx.flashA > 0 && settings.flash) { ctx.fillStyle = `rgba(${fx.flashCol},${fx.flashA * 0.35})`; ctx.fillRect(0, 0, W, H); }
  };
  fx.count = () => P.length;
  return fx;
}
