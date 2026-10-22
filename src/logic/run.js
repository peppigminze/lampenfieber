// Run simulation: createRun / step / choose / reroll / nextAct / summary. Pure, no DOM.
import { makeRng } from './rng.js';
import { clamp, d2, angDiff, pushOut } from './geom.js';
import { classify, LIT, UMB, ELIT, INK } from './light.js';
import { buildArena, updateWorld } from './world.js';
import { computeStats, rollChoices, FALLBACK, availableCards } from './upgrades.js';
import { emit, spawnEnemy, addZone, hurtPlayer } from './core.js';
import { updateEnemy } from './enemies.js';
import { directorStep } from './director.js';

const TAU = Math.PI * 2;
export const PLAYER_R = 11;

export function xpFor(level) { return Math.round(4 + level * 2.2 + Math.pow(level, 1.45)); }

export function createRun(data, o = {}) {
  const seed = (o.seed !== undefined ? o.seed : (Date.now() ^ (Math.random() * 1e9))) >>> 0;
  const rng = makeRng(seed);
  const grades = data.acts.grades;
  const gradeIdx = clamp(o.grade | 0, 0, grades.length - 1);
  const lanternId = data.lanterns[o.lantern] ? o.lantern : 'oellampe';
  const run = {
    data, seed, rng, mode: o.mode || 'story', lanternId, gradeIdx, grade: grades[gradeIdx],
    workshop: o.workshop || {}, unlockedCards: o.unlockedCards || [],
    stacks: {}, picks: {}, stats: null,
    t: 0, actIdx: 0, actT: 0, phase: 'play', clearT: 0, act: null, world: null,
    p: { x: 0, y: 0, vx: 0, vy: 0, flame: 100, inv: 0, slowT: 0, face: 0, flareCd: 0, douseCd: 0, douse: 0, flareAnim: 0, flare2: 0, orbitA: 0, menhirT: 3, trailT: 0, moving: false },
    fever: 0, feverIdle: 9, feverTier: 0, maxTier: 0, dmgMul: 1,
    enemies: [], proj: [], pickups: [], zones: [], ash: [], menhirs: [], embers: [], orbs: [], wisps: [], beams: [],
    level: 1, xp: 0, xpNext: xpFor(1), pendingLv: 0, choices: null, rerolls: 0, revives: 0,
    kills: 0, killsBy: {}, killsShadow: 0, killsLight: 0, killsFlip: 0, score: 0, dmgTaken: 0, dmgDealt: 0, hurtBy: {},
    hitsAct: 0, hitlessActs: 0, actsCleared: 0, bossIds: [], bossKills: [], douseKills: 0, maxDouseKills: 0, maxOrbit: 0,
    flares: 0, douses: 0, bonusGlut: 0, spawnAcc: 0, burstsDone: [], nextId: 1, seen: {},
    tut: { on: !!o.tutorial && (o.mode || 'story') === 'story', done: {} },
    encoreBossT: 0, encoreBossN: 0, encoreMin: 0, killedBy: null, won: false,
    ev: [], ctx: null,
  };
  if (run.mode === 'encore') run.encoreBossT = data.acts.encore.bossEvery;
  const lan = data.lanterns[lanternId];
  for (const id of lan.start || []) run.stacks[id] = (run.stacks[id] || 0) + 1;
  run.stats = computeStats(data, lanternId, run.workshop, run.stacks);
  if (run.stats.startCard) {
    const commons = availableCards(data, run.stacks, run.unlockedCards).filter((k) => data.upgrades[k].rar === 'common' && k !== 'wachsmantel');
    if (commons.length) { const k = rng.pick(commons); run.stacks[k] = (run.stacks[k] || 0) + 1; run.picks[k] = 1; }
    run.stats = computeStats(data, lanternId, run.workshop, run.stacks);
  }
  run.rerolls = Math.round(run.stats.rerolls);
  run.revives = Math.round(run.stats.revive);
  run.p.flame = run.stats.maxFlame;
  setupAct(run, 0);
  return run;
}

export function setupAct(run, idx) {
  const acts = run.data.acts.acts;
  run.actIdx = idx;
  run.act = run.mode === 'encore' ? acts[run.rng.int(0, acts.length - 1)] : acts[idx];
  run.world = buildArena(run.act, run.rng, { tutorial: run.tut.on && idx === 0 });
  const p = run.p;
  p.x = run.world.cx; p.y = run.world.cy; p.vx = p.vy = 0; p.inv = 1.2;
  run.enemies.length = 0; run.proj.length = 0; run.pickups.length = 0; run.zones.length = 0; run.ash.length = 0; run.menhirs.length = 0; run.embers.length = 0; run.beams.length = 0;
  run.actT = 0; run.phase = 'play'; run.burstsDone = []; run.hitsAct = 0; run.spawnAcc = 0; run.bossIds = [];
  run.ctx = buildCtx(run);
  emit(run, 'act', { idx, id: run.act.id });
  if (run.stats.cone && idx === 0) emit(run, 'hint', { key: 'cone' });
}

export function currentRadius(run) {
  const p = run.p, s = run.stats;
  let dim = 1;
  for (const e of run.enemies) if (e.def.dim && d2(e.x, e.y, p.x, p.y) < e.def.dimR * e.def.dimR) dim = Math.min(dim, e.def.dim);
  const ff = clamp(p.flame / s.maxFlame, 0, 1);
  return s.radius * (0.62 + 0.38 * ff) * (1 + run.feverTier * 0.05 * s.feverBonus) * dim * (1 + 0.4 * Math.max(0, p.flareAnim) / 0.5);
}

function buildCtx(run) {
  const p = run.p, s = run.stats;
  const R = currentRadius(run);
  const occ = run.world.obstacles.concat(run.orbs, run.menhirs);
  const elights = [];
  for (const e of run.enemies) if (e.def.aura) elights.push({ id: e.id, x: e.x, y: e.y, r: e.def.aura });
  return {
    lx: p.x, ly: p.y, R, uR: R * Math.max(1, s.shadowLen), dark: p.douse > 0,
    cone: s.cone ? { dx: Math.cos(p.face), dy: Math.sin(p.face), cos: Math.cos(s.cone / 2), half: s.cone / 2 } : null,
    occ, wisps: run.wisps, embers: run.embers, zones: run.zones, elights, beams: run.beams, inten: 0,
  };
}

function doFlare(run) {
  const p = run.p, s = run.stats;
  const fr = currentRadius(run) * s.flareR + 40;
  for (const e of run.enemies) {
    const dd = d2(e.x, e.y, p.x, p.y);
    if (dd > fr * fr) continue;
    const a = Math.atan2(e.y - p.y, e.x - p.x), kb = e.boss ? 0.15 : 1;
    if (e.pol === 'S') { e.hp -= s.flareDmg * run.dmgMul; e.hurtT = 0; e.lastCause = 'light'; e.kx += Math.cos(a) * 200 * kb; e.ky += Math.sin(a) * 200 * kb; if (e.dormant) e.dormant = false; }
    else if (e.pol === 'L') { e.kx += Math.cos(a) * 300 * kb; e.ky += Math.sin(a) * 300 * kb; }
    else if (e.flipS !== 1) { e.hp -= s.flipMul; e.flipS = 1; e.hurtT = 0; e.lastCause = 'flip'; emit(run, 'flip', { x: e.x, y: e.y, boss: e.boss }); }
    if (e.st === 'pounce' || e.st === 'dive' || (e.st === 'dash' && !e.boss)) e.st = 'walk';
  }
  for (let i = run.proj.length - 1; i >= 0; i--) { const q = run.proj[i]; if (d2(q.x, q.y, p.x, p.y) < fr * fr) { emit(run, 'fizzle', { x: q.x, y: q.y, pol: q.pol }); run.proj.splice(i, 1); } }
  p.flareAnim = 0.5; run.flares++;
  emit(run, 'flare', { x: p.x, y: p.y, r: fr });
}

function updatePlayer(run, input, dt) {
  const p = run.p, s = run.stats, W = run.world;
  p.inv -= dt; p.slowT -= dt; p.flareCd -= dt; p.douseCd -= dt; p.flareAnim = Math.max(0, p.flareAnim - dt);
  if (p.douse > 0) {
    p.douse -= dt;
    if (p.douse <= 0) {
      p.douse = 0;
      if (s.douseCloud > 0) addZone(run, { x: p.x, y: p.y, r: currentRadius(run) * 0.55, t: s.douseCloud, max: s.douseCloud, cloud: true });
      emit(run, 'douseEnd', { x: p.x, y: p.y, kills: run.douseKills });
    }
  }
  let mx = input.mx || 0, my = input.my || 0;
  const m = Math.hypot(mx, my);
  if (m > 1) { mx /= m; my /= m; }
  const spd = s.speed * (p.slowT > 0 ? 0.55 : 1) * (p.douse > 0 && s.douseDash ? 1.45 : 1);
  const k = 1 - Math.exp(-14 * dt);
  p.vx += (mx * spd - p.vx) * k; p.vy += (my * spd - p.vy) * k;
  p.x += p.vx * dt; p.y += p.vy * dt;
  for (const o of W.obstacles) if (o.solid) pushOut(p, PLAYER_R, o);
  p.x = clamp(p.x, 24, W.w - 24); p.y = clamp(p.y, 24, W.h - 24);
  p.moving = m > 0.15;
  if (p.moving) { const tgt = Math.atan2(my, mx); p.face += clamp(angDiff(p.face, tgt), -9 * dt, 9 * dt); }
  if (s.regen && run.feverTier >= 1) p.flame = Math.min(s.maxFlame, p.flame + s.regen * dt);
  if (input.flare && p.flareCd <= 0) { doFlare(run); p.flareCd = s.flareCd; if (s.doubleFlare) p.flare2 = 0.35; }
  if (p.flare2 > 0) { p.flare2 -= dt; if (p.flare2 <= 0) doFlare(run); }
  if (input.douse && p.douseCd <= 0 && p.douse <= 0) {
    p.douse = s.douseDur; p.douseCd = s.douseCd + s.douseDur; run.douseKills = 0; run.douses++;
    emit(run, 'douse', { x: p.x, y: p.y, r: currentRadius(run) });
  }
}

function updateOwned(run, dt) {
  const p = run.p, s = run.stats;
  p.orbitA += s.orbitSpeed * dt;
  const n = s.orbit;
  while (run.orbs.length < n) run.orbs.push({ id: -1 - run.orbs.length, kind: 'c', type: 'orb', x: p.x, y: p.y, r: s.orbitSize, own: true });
  run.orbs.length = n;
  run.maxOrbit = Math.max(run.maxOrbit, n);
  for (let i = 0; i < n; i++) {
    const a = p.orbitA + (i / n) * TAU, o = run.orbs[i];
    o.r = s.orbitSize; o.x = p.x + Math.cos(a) * (s.orbitDist + s.orbitSize); o.y = p.y + Math.sin(a) * (s.orbitDist + s.orbitSize);
  }
  if (s.menhir > 0) {
    p.menhirT -= dt;
    if (p.menhirT <= 0) {
      p.menhirT = Math.max(3.5, 9 - 1.8 * (s.menhir - 1));
      const x = p.x - Math.cos(p.face) * 34, y = p.y - Math.sin(p.face) * 34;
      run.menhirs.push({ id: -100 - run.nextId++, kind: 'c', type: 'menhir', x, y, r: 17, t: 6 + 2 * s.menhir, max: 6 + 2 * s.menhir, own: true, solid: true });
      emit(run, 'menhir', { x, y });
    }
  }
  for (let i = run.menhirs.length - 1; i >= 0; i--) { const m = run.menhirs[i]; m.t -= dt; if (m.t <= 0) { run.menhirs.splice(i, 1); emit(run, 'crumble', { x: m.x, y: m.y }); } }
  run.wisps.length = 0;
  for (let i = 0; i < s.wisps; i++) { const a = -p.orbitA * 0.6 + i * Math.PI; run.wisps.push({ x: p.x + Math.cos(a) * 100, y: p.y + Math.sin(a) * 100, r: 78 }); }
  if (s.trail > 0) {
    p.trailT -= dt;
    if (p.trailT <= 0 && p.moving) { p.trailT = 0.32; run.embers.push({ x: p.x, y: p.y, r: 26 + 6 * s.trail, t: 2 + s.trail, max: 2 + s.trail }); if (run.embers.length > 24) run.embers.shift(); }
  }
  for (let i = run.embers.length - 1; i >= 0; i--) if ((run.embers[i].t -= dt) <= 0) run.embers.splice(i, 1);
  for (let i = run.zones.length - 1; i >= 0; i--) if ((run.zones[i].t -= dt) <= 0) run.zones.splice(i, 1);
  for (let i = run.ash.length - 1; i >= 0; i--) if ((run.ash[i].t -= dt) <= 0) run.ash.splice(i, 1);
}

function separate(run) {
  const E = run.enemies, n = E.length;
  for (let i = 0; i < n; i++) {
    const a = E[i];
    if (a.boss || a.dormant) continue;
    for (let j = i + 1; j < n; j++) {
      const b = E[j];
      if (b.boss || b.dormant) continue;
      const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r;
      if (dx > rr || dx < -rr || dy > rr || dy < -rr) continue;
      const dd = dx * dx + dy * dy;
      if (dd >= rr * rr || dd === 0) continue;
      const d = Math.sqrt(dd), push = (rr - d) * 0.5, nx = dx / d, ny = dy / d;
      a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
    }
  }
}

function updateProj(run, dt) {
  const p = run.p, W = run.world;
  for (let i = run.proj.length - 1; i >= 0; i--) {
    const q = run.proj[i];
    if (!q) continue;
    q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt;
    let dead = q.life <= 0 || q.x < 0 || q.y < 0 || q.x > W.w || q.y > W.h;
    if (!dead) {
      const f = classify(run.ctx, q.x, q.y, -999);
      if ((q.pol === 'L' && (f & UMB) && !(f & ELIT)) || (q.pol === 'S' && (f & LIT) && !(f & INK))) { dead = true; emit(run, 'fizzle', { x: q.x, y: q.y, pol: q.pol }); }
    }
    if (!dead) for (const o of W.obstacles) { if (o.kind === 'c' ? d2(q.x, q.y, o.x, o.y) < o.r * o.r : (q.x > o.bx0 && q.x < o.bx1 && q.y > o.by0 && q.y < o.by1)) { dead = true; break; } }
    if (!dead && d2(q.x, q.y, p.x, p.y) < (q.r + PLAYER_R) * (q.r + PLAYER_R)) {
      if (run.phase === 'play' || run.phase === 'boss') { hurtPlayer(run, q.dmg, q.pol === 'L' ? 'lichtkugel' : 'schattenkugel'); }
      dead = true;
    }
    if (dead && run.proj[i] === q) run.proj.splice(i, 1);
  }
}

function kill(run, e) {
  const s = run.stats, def = e.def, p = run.p;
  const mult = 1 + run.fever / 50;
  run.score += def.score * (e.elite ? 3 : 1) * mult;
  run.kills++;
  run.killsBy[e.type] = (run.killsBy[e.type] || 0) + 1;
  if (def.pol === 'X') run.killsFlip++;
  else if (e.pol === 'L' && e.lastCause === 'umbra') run.killsShadow++;
  else if (e.pol === 'S' && e.lastCause === 'light') run.killsLight++;
  run.fever = Math.min(100, run.fever + (e.boss ? 40 : e.elite ? 12 : 4));
  run.feverIdle = 0;
  if (s.healKills && run.kills % 10 === 0) p.flame = Math.min(s.maxFlame, p.flame + s.healKills);
  if (p.douse > 0) { run.douseKills++; run.maxDouseKills = Math.max(run.maxDouseKills, run.douseKills); }
  const n = Math.round(def.xp * (e.elite ? 3 : 1));
  const drops = Math.min(n, e.boss ? 14 : 5), per = n / drops;
  for (let i = 0; i < drops; i++) {
    const a = run.rng() * TAU, v = run.rng.range(40, 140) * (e.boss ? 2 : 1);
    run.pickups.push({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, v: per, age: 0, mag: false });
  }
  if (def.split) for (let i = 0; i < def.splitN; i++) { const a = (i / def.splitN) * TAU + run.rng(); spawnEnemy(run, def.split, e.x + Math.cos(a) * 14, e.y + Math.sin(a) * 14, { hpMul: 0.8 }); }
  if (e.pol === 'L' && s.ember > 0) for (const o of run.enemies) if (o !== e && o.hp > 0 && d2(o.x, o.y, e.x, e.y) < 75 * 75) { o.hp -= s.ember * (o.boss ? 0.3 : 1); o.hurtT = 0; if (!o.lastCause) o.lastCause = 'umbra'; }
  if (e.pol === 'S' && s.ash) run.ash.push({ x: e.x, y: e.y, r: 55, t: 3, max: 3 });
  if (e.elite) run.bonusGlut += 4;
  emit(run, 'kill', { x: e.x, y: e.y, id: e.type, pol: e.pol, elite: e.elite, boss: e.boss, cause: e.lastCause, r: e.r });
  if (e.boss) {
    run.bossKills.push(e.type);
    run.bossIds = run.bossIds.filter((id) => id !== e.id);
    emit(run, 'bossdead', { id: e.type, x: e.x, y: e.y });
    if (run.mode !== 'encore' && run.phase === 'boss' && run.bossIds.length === 0) startClear(run);
  }
}

function startClear(run) {
  run.phase = 'clear'; run.clearT = 2.6;
  for (const e of run.enemies) if (e.hp > 0) { e.hp = 0; e.vanish = true; emit(run, 'vanish', { x: e.x, y: e.y, pol: e.pol, r: e.r }); }
  run.proj.length = 0;
  for (const k of run.pickups) k.mag = true;
  run.actsCleared++;
  run.score += 600 * (run.actIdx + 1);
  if (run.hitsAct === 0) { run.hitlessActs++; run.score += 800; }
}

function updatePickups(run, dt) {
  const p = run.p, s = run.stats;
  for (let i = run.pickups.length - 1; i >= 0; i--) {
    const k = run.pickups[i];
    k.age += dt;
    const dd = d2(k.x, k.y, p.x, p.y);
    if (!k.mag && k.age > 0.25 && dd < s.magnet * s.magnet) k.mag = true;
    if (k.mag) {
      const d = Math.sqrt(dd) || 1, sp = 380 + k.age * 200;
      k.vx = ((p.x - k.x) / d) * sp; k.vy = ((p.y - k.y) / d) * sp;
    } else { const f = Math.exp(-4 * dt); k.vx *= f; k.vy *= f; }
    k.x += k.vx * dt; k.y += k.vy * dt;
    if (dd < 18 * 18 && k.age > 0.15) {
      run.xp += k.v * s.xpMul; run.score += k.v * 2;
      run.pickups.splice(i, 1);
      run.pickN = (run.pickN || 0) + 1;
      emit(run, 'pickup', { x: k.x, y: k.y, n: run.pickN });
      continue;
    }
    if (k.age > 45) run.pickups.splice(i, 1);
  }
  while (run.xp >= run.xpNext) { run.xp -= run.xpNext; run.level++; run.xpNext = xpFor(run.level); run.pendingLv++; }
  if (run.pendingLv > 0 && !run.choices && run.phase !== 'dead' && run.phase !== 'clear') {
    run.choices = rollChoices(run.data, run.rng, run.stacks, run.unlockedCards);
    emit(run, 'levelup', { level: run.level });
  }
}

function updateFever(run, dt) {
  run.feverIdle += dt;
  if (run.feverIdle > 1.8) run.fever = Math.max(0, run.fever - 9 * run.stats.feverDecay * dt);
  const tier = run.fever >= 100 ? 3 : run.fever >= 66 ? 2 : run.fever >= 33 ? 1 : 0;
  if (tier > run.feverTier) emit(run, 'fever', { tier });
  run.feverTier = tier; run.maxTier = Math.max(run.maxTier, tier);
  run.dmgMul = 1 + tier * 0.08;
}

export function step(run, input, dt) {
  if (run.choices || run.phase === 'dead' || run.phase === 'won' || run.phase === 'interlude') return;
  run.t += dt; run.actT += dt;
  if (run.phase === 'clear') {
    run.clearT -= dt;
    run.enemies.length = 0;
    updatePickups(run, dt);
    if (run.clearT <= 0) finishAct(run);
    return;
  }
  updatePlayer(run, input || {}, dt);
  updateWorld(run.world, dt, run.actT / run.act.duration);
  updateOwned(run, dt);
  const prevBeams = run.beams; run.beams = [];
  run.ctx = buildCtx(run); run.ctx.beams = prevBeams;
  const E = run.enemies;
  for (let i = 0; i < E.length; i++) updateEnemy(run, E[i], dt);
  separate(run);
  updateProj(run, dt);
  for (let i = 0; i < E.length; i++) if (E[i].hp <= 0 && !E[i].vanish) kill(run, E[i]);
  if (run.phase !== 'clear') { for (let i = E.length - 1; i >= 0; i--) if (E[i].hp <= 0) E.splice(i, 1); }
  updatePickups(run, dt);
  if (run.phase === 'play' || run.phase === 'boss') directorStep(run, dt);
  updateFever(run, dt);
  if (run.mode === 'encore') run.score += 10 * dt;
}

function finishAct(run) {
  for (const k of run.pickups) run.xp += k.v * run.stats.xpMul;
  run.pickups.length = 0;
  const last = run.data.acts.acts.length - 1;
  if (run.actIdx >= last) { run.phase = 'won'; run.won = true; run.score += 5000; emit(run, 'win', {}); }
  else { run.phase = 'interlude'; emit(run, 'actclear', { idx: run.actIdx, hitless: run.hitsAct === 0 }); }
  updatePickupsLevel(run);
}

function updatePickupsLevel(run) {
  while (run.xp >= run.xpNext) { run.xp -= run.xpNext; run.level++; run.xpNext = xpFor(run.level); run.pendingLv++; }
}

export function nextAct(run) {
  if (run.phase !== 'interlude') return false;
  const s = run.stats;
  run.p.flame = Math.min(s.maxFlame, run.p.flame + s.maxFlame * 0.35);
  setupAct(run, run.actIdx + 1);
  if (run.pendingLv > 0 && !run.choices) { run.choices = rollChoices(run.data, run.rng, run.stacks, run.unlockedCards); emit(run, 'levelup', { level: run.level }); }
  return true;
}

export function choose(run, i) {
  if (!run.choices || i < 0 || i >= run.choices.length) return false;
  const id = run.choices[i], s = run.stats;
  if (id === FALLBACK) { run.p.flame = Math.min(s.maxFlame, run.p.flame + 35); run.score += 150; }
  else {
    run.stacks[id] = (run.stacks[id] || 0) + 1;
    run.picks[id] = (run.picks[id] || 0) + 1;
    const oldMax = s.maxFlame;
    run.stats = computeStats(run.data, run.lanternId, run.workshop, run.stacks);
    const heal = (run.data.upgrades[id].fx.find((f) => f[0] === 'heal') || [0, 0, 0])[2];
    run.p.flame = Math.min(run.stats.maxFlame, run.p.flame + heal);
    void oldMax;
  }
  emit(run, 'pick', { id });
  run.pendingLv--;
  run.choices = null;
  if (run.pendingLv > 0) { run.choices = rollChoices(run.data, run.rng, run.stacks, run.unlockedCards); emit(run, 'levelup', { level: run.level }); }
  return true;
}

export function reroll(run) {
  if (!run.choices || run.rerolls <= 0) return false;
  run.rerolls--;
  run.choices = rollChoices(run.data, run.rng, run.stacks, run.unlockedCards);
  return true;
}

export function abandon(run) {
  if (run.phase === 'dead' || run.phase === 'won') return;
  run.phase = 'dead'; run.killedBy = 'aufgegeben'; run.choices = null;
  emit(run, 'gameover', { x: run.p.x, y: run.p.y, abandoned: true });
}

export function summary(run) {
  return {
    mode: run.mode, lantern: run.lanternId, grade: run.gradeIdx, seed: run.seed,
    score: Math.floor(run.score), kills: run.kills, killsBy: Object.assign({}, run.killsBy),
    killsShadow: run.killsShadow, killsLight: run.killsLight, killsFlip: run.killsFlip,
    act: run.actIdx + 1, actsCleared: run.actsCleared, won: run.won, time: run.t, level: run.level,
    bossKills: run.bossKills.slice(), maxTier: run.maxTier, maxOrbit: run.maxOrbit, maxDouseKills: run.maxDouseKills,
    hitlessActs: run.hitlessActs, picks: Object.assign({}, run.picks), bonusGlut: run.bonusGlut, killedBy: run.killedBy,
    dmgTaken: Math.round(run.dmgTaken), flares: run.flares, douses: run.douses, seen: Object.keys(run.seen),
  };
}
