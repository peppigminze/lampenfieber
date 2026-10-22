// Bot players: used by the Node simulator and the title-screen attract mode. Pure.
import { classify, LIT, UMB, ELIT, INK } from './light.js';
import { d2 } from './geom.js';
import { insideSolid } from './core.js';
import { cardInfo, FALLBACK } from './upgrades.js';

const DIRS = [];
for (let i = 0; i < 12; i++) DIRS.push([Math.cos((i / 12) * Math.PI * 2), Math.sin((i / 12) * Math.PI * 2)]);
DIRS.push([0, 0]);

export function createBot(strategy = 'smart', cards = 'prio') {
  return { strategy, cards, t: 0, dir: [0, 0], think: 0 };
}

function smartMove(run, bot) {
  const p = run.p, c = run.ctx, W = run.world;
  let best = null, bs = -Infinity;
  const near = run.enemies.filter((e) => d2(e.x, e.y, p.x, p.y) < 480 * 480);
  for (const [dx, dy] of DIRS) {
    const cx = p.x + dx * 45, cy = p.y + dy * 45;
    let s = 0;
    if (insideSolid(run, cx, cy, 12)) s -= 100;
    const m = 110;
    if (cx < m || cy < m || cx > W.w - m || cy > W.h - m) s -= 6;
    const v = Object.assign({}, c, { lx: cx, ly: cy, dark: false, cone: c.cone && (dx || dy) ? { dx, dy, cos: c.cone.cos, half: c.cone.half } : c.cone });
    for (const e of near) {
      const dd = Math.sqrt(d2(e.x, e.y, cx, cy));
      const reach = e.r + 12;
      if (dd < 150 + reach) s -= ((150 + reach - dd) / 150) * (e.dmg / 8) * (e.boss ? 4 : 2.2);
      if (dd > c.uR + 10) continue;
      const f = classify(v, e.x, e.y, e.id);
      const w = e.boss ? 4 : 1;
      if (e.pol === 'L') s += (f & UMB) && !(f & ELIT) ? 2.2 * w : 0;
      else if (e.pol === 'S') s += (f & LIT) && !(f & INK) ? 2.2 * v.inten * w : 0;
      else { const st = (f & UMB) ? 2 : (f & LIT) ? 1 : 0; if (st && st !== e.flipS) s += 1.5 * w; }
    }
    for (const q of run.proj) { const dd = d2(q.x, q.y, cx, cy); if (dd < 70 * 70) s -= 6; }
    for (const b of run.beams) { const t = ((cx - b.x1) * (b.x2 - b.x1) + (cy - b.y1) * (b.y2 - b.y1)) / ((b.x2 - b.x1) ** 2 + (b.y2 - b.y1) ** 2); const tt = Math.max(0, Math.min(1, t)); const px = b.x1 + (b.x2 - b.x1) * tt - cx, py = b.y1 + (b.y2 - b.y1) * tt - cy; if (px * px + py * py < 50 * 50) s -= 12; }
    if (dx === bot.dir[0] && dy === bot.dir[1]) s += 0.6;
    if (s > bs) { bs = s; best = [dx, dy]; }
  }
  return best;
}

export function botInput(run, bot, dt) {
  bot.t += dt; bot.think -= dt;
  const p = run.p, s = run.stats, R = run.ctx ? run.ctx.R : 230;
  const out = { mx: bot.dir[0], my: bot.dir[1], flare: false, douse: false };
  if (bot.strategy === 'idle') { out.mx = out.my = 0; }
  else if (bot.strategy === 'random') {
    if (bot.think <= 0) { bot.think = 0.8 + run.rng() * 0.6; const a = run.rng() * Math.PI * 2; bot.dir = [Math.cos(a), Math.sin(a)]; }
    out.mx = bot.dir[0]; out.my = bot.dir[1];
    out.flare = run.rng() < dt * 0.5; out.douse = run.rng() < dt * 0.3;
    return out;
  } else if (bot.strategy === 'kite') {
    if (bot.think <= 0) {
      bot.think = 0.2;
      let vx = 0, vy = 0;
      for (const e of run.enemies) { const dd = d2(e.x, e.y, p.x, p.y); if (dd < 300 * 300) { const d = Math.sqrt(dd) || 1; vx -= (e.x - p.x) / d / d * 100; vy -= (e.y - p.y) / d / d * 100; } }
      vx += (run.world.cx - p.x) * 0.0015; vy += (run.world.cy - p.y) * 0.0015;
      const m = Math.hypot(vx, vy) || 1; bot.dir = [vx / m, vy / m];
    }
    out.mx = bot.dir[0]; out.my = bot.dir[1];
  } else if (bot.think <= 0) { bot.think = 0.16; bot.dir = smartMove(run, bot); out.mx = bot.dir[0]; out.my = bot.dir[1]; }
  if (p.flareCd <= 0) {
    const fr = R * s.flareR + 40;
    let sN = 0, close = 0, pr = 0;
    for (const e of run.enemies) { const dd = d2(e.x, e.y, p.x, p.y); if (dd < fr * fr && e.pol !== 'L') sN += e.boss ? 3 : 1; if (dd < 70 * 70) close++; }
    for (const q of run.proj) if (d2(q.x, q.y, p.x, p.y) < 120 * 120) pr++;
    if (sN >= 3 || close >= 2 || pr >= 2) out.flare = true;
  }
  if (p.douseCd <= 0 && p.douse <= 0 && run.ctx) {
    let lN = 0;
    for (const e of run.enemies) { if (e.pol === 'S') continue; if (d2(e.x, e.y, p.x, p.y) < R * R * 0.7 && !(e.flags & UMB)) lN += e.boss ? 4 : 1; }
    if (lN >= 4) out.douse = true;
  }
  return out;
}

const PRIO = ['mondstein', 'tiefschatten', 'sengend', 'docht', 'langeschatten', 'zwielicht', 'menhir', 'irrwisch', 'wachsmantel', 'schwerermond', 'mondlauf', 'grossfeuer', 'zuendschnur', 'russwolke', 'doppeldocht', 'schattenschritt', 'zunderherz', 'funkenflug', 'brennglas', 'fieberwahn', 'finsternis', 'kerzendieb', 'flinkfuss', 'wachsgier', 'glutspur', 'kalteasche'];

export function botChoose(run, bot) {
  const ch = run.choices;
  if (!ch) return 0;
  if (bot.cards === 'random') return Math.floor(run.rng() * ch.length);
  const low = run.p.flame < run.stats.maxFlame * 0.45;
  let bi = 0, bs = -Infinity;
  ch.forEach((id, i) => {
    let s = id === FALLBACK ? (low ? 50 : -50) : 100 - PRIO.indexOf(id) * 3;
    if (low && id === 'wachsmantel') s += 60;
    if (cardInfo(run.data, id).rar === 'epic') s += 10;
    if (s > bs) { bs = s; bi = i; }
  });
  return bi;
}
