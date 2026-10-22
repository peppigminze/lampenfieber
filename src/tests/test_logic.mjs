import assert from 'node:assert/strict';
import { loadData } from '../tools/data-node.mjs';
import { makeRng } from '../logic/rng.js';
import { segCircle, pointInPoly, pushOut, rectLocal, syncPoly } from '../logic/geom.js';
import { classify, shadowPoly, occluded, LIT, UMB, ELIT, INK } from '../logic/light.js';
import { buildArena, updateWorld } from '../logic/world.js';
import { computeStats, rollChoices, availableCards } from '../logic/upgrades.js';
import { createRun, step, choose, nextAct, summary, reroll, abandon, xpFor } from '../logic/run.js';
import { spawnEnemy } from '../logic/core.js';
import { defaultMeta, sanitize, applyRun, buy, lanternUnlocked, glutFor } from '../logic/meta.js';
import { createApp, go, canGo } from '../logic/app.js';

const data = loadData();
let n = 0;
const t = (name, fn) => { try { fn(); n++; } catch (e) { console.error('FAIL', name); throw e; } };

t('data integrity', () => {
  for (const a of data.acts.acts) {
    assert.ok(data.enemies[a.boss]?.boss, a.boss);
    for (const [id] of a.pool) assert.ok(data.enemies[id], id);
    for (const b of a.bursts) assert.ok(data.enemies[b[1]], b[1]);
  }
  for (const [id] of data.acts.encore.pool) assert.ok(data.enemies[id]);
  for (const k in data.upgrades) { const u = data.upgrades[k]; assert.ok(u.fx.length && u.max >= 1 && u.name && u.desc, k); if (u.req) assert.ok(data.upgrades[u.req]); }
  for (const k in data.lanterns) { for (const s of data.lanterns[k].start) assert.ok(data.upgrades[s]); const u = data.lanterns[k].unlock; if (u) assert.ok(data.achievements[u], u); }
  for (const k in data.workshop) if (data.workshop[k].card) assert.ok(data.upgrades[data.workshop[k].card].locked);
  const variants = Object.keys(data.enemies).length + Object.keys(data.upgrades).length + data.acts.acts.length + Object.keys(data.lanterns).length;
  assert.ok(variants >= 40, 'variants ' + variants);
});

t('rng deterministic', () => { const a = makeRng(42), b = makeRng(42); for (let i = 0; i < 50; i++) assert.equal(a(), b()); const r = makeRng(1); for (let i = 0; i < 200; i++) { const v = r.int(2, 5); assert.ok(v >= 2 && v <= 5); } });

t('geom', () => {
  assert.ok(segCircle(0, 0, 100, 0, 50, 5, 10));
  assert.ok(!segCircle(0, 0, 100, 0, 50, 30, 10));
  assert.ok(pointInPoly(5, 5, [0, 0, 10, 0, 10, 10, 0, 10]));
  assert.ok(!pointInPoly(15, 5, [0, 0, 10, 0, 10, 10, 0, 10]));
  const e = { x: 52, y: 0 }; assert.ok(pushOut(e, 10, { kind: 'c', x: 50, y: 0, r: 20 })); assert.ok(Math.abs(e.x - 80) < 1e-6);
  const p = { kind: 'p', x: 0, y: 0, rot: 0.3, pts: rectLocal(40, 60) }; syncPoly(p);
  const e2 = { x: 2, y: 2 }; pushOut(e2, 8, p); assert.ok(!pointInPoly(e2.x, e2.y, p.w));
});

const ctx0 = (o) => Object.assign({ lx: 0, ly: 0, R: 200, uR: 200, dark: false, cone: null, occ: [], wisps: [], embers: [], zones: [], elights: [], beams: [], inten: 0 }, o);
t('light classify', () => {
  const tree = { kind: 'c', x: 60, y: 0, r: 20 };
  const c = ctx0({ occ: [tree] });
  assert.ok(classify(c, 120, 0) & UMB, 'behind tree is umbra');
  assert.ok(classify(c, 0, 120) & LIT, 'open is lit');
  assert.ok(c.inten > 0.5);
  assert.equal(classify(c, 400, 0), 0, 'beyond radius = dusk');
  assert.ok(classify(ctx0({ dark: true }), 50, 50) & UMB, 'douse makes umbra');
  const cone = ctx0({ cone: { dx: 1, dy: 0, cos: Math.cos(0.9) } });
  assert.ok(classify(cone, 100, 0) & LIT); assert.ok(classify(cone, -100, 0) & UMB);
  assert.ok(classify(ctx0({ zones: [{ x: 100, y: 0, r: 30, ink: true }] }), 100, 0) & INK);
  const el = ctx0({ occ: [tree], elights: [{ id: 7, x: 120, y: 0, r: 40 }] });
  assert.ok(classify(el, 120, 0, 3) & ELIT); assert.ok(!(classify(el, 120, 0, 7) & ELIT), 'own light ignored');
  assert.ok(!occluded(0, 0, 0, 100, [tree]));
  const sp = shadowPoly(0, 0, tree, 500); assert.ok(sp && sp.length >= 8);
  const g = { kind: 'p', x: 80, y: 0, rot: 0, pts: rectLocal(20, 60) }; syncPoly(g);
  assert.ok(classify(ctx0({ occ: [g] }), 150, 0) & UMB); assert.ok(shadowPoly(0, 0, g, 500));
  assert.equal(shadowPoly(60, 0, tree, 500), null, 'light inside obstacle');
});

t('arenas', () => {
  for (const a of data.acts.acts) {
    const w = buildArena(a, makeRng(7), { tutorial: true });
    assert.ok(w.obstacles.length >= 8, a.id + ' ' + w.obstacles.length);
    for (const o of w.obstacles) assert.ok(o.x > 0 && o.y > 0 && o.x < w.w && o.y < w.h);
    updateWorld(w, 0.5, 0.5);
  }
});

t('stats & cards', () => {
  const s = computeStats(data, 'oellampe', {}, {});
  assert.equal(s.maxFlame, 110); assert.equal(s.orbit, 0);
  const s2 = computeStats(data, 'laterna', { flamme: 2 }, { mondstein: 2, docht: 1 });
  assert.equal(s2.orbit, 2); assert.equal(s2.maxFlame, 102); assert.ok(Math.abs(s2.radius - 215 * 1.12) < 1e-6);
  const av = availableCards(data, {}, []);
  assert.ok(!av.includes('doppeldocht') && !av.includes('schwerermond'));
  assert.ok(availableCards(data, { mondstein: 1 }, ['doppeldocht']).includes('schwerermond'));
  const ch = rollChoices(data, makeRng(3), {}, []); assert.equal(ch.length, 3); assert.equal(new Set(ch).size, 3);
  const maxed = {}; for (const k in data.upgrades) maxed[k] = data.upgrades[k].max;
  assert.deepEqual(rollChoices(data, makeRng(3), maxed, Object.keys(data.upgrades)), ['_wachs', '_wachs', '_wachs']);
});

t('run basics', () => {
  const r = createRun(data, { seed: 11, tutorial: true });
  assert.equal(r.phase, 'play');
  const hints = [];
  for (let i = 0; i < 60 * 30; i++) { step(r, { mx: 0, my: 0 }, 1 / 60); for (const e of r.ev) if (e.type === 'hint') hints.push(e.key); r.ev.length = 0; if (r.choices) choose(r, 0); }
  assert.ok(hints.includes('move') && hints.includes('shadow') && hints.includes('light'), hints.join());
  assert.ok(r.t > 29 || r.phase === 'dead', 'phase ' + r.phase + ' t ' + r.t);
});

t('shadow kills funke, light burns schemen, flip hurts wechselbalg', () => {
  const r = createRun(data, { seed: 5 });
  r.world.obstacles = [{ id: 999, kind: 'c', type: 'tree', x: r.p.x + 60, y: r.p.y, r: 25, r0: 25, solid: true }];
  const f = spawnEnemy(r, 'funke', r.p.x + 130, r.p.y); f.spd = 0;
  const s = spawnEnemy(r, 'schemen', r.p.x, r.p.y + 120); s.spd = 0;
  const w = spawnEnemy(r, 'wechselbalg', r.p.x - 120, r.p.y); w.spd = 0;
  r.director = false;
  const fh = f.hp, sh = s.hp;
  for (let i = 0; i < 20; i++) { step(r, {}, 1 / 60); f.x = r.p.x + 130; f.y = r.p.y; s.x = r.p.x; s.y = r.p.y + 120; }
  assert.ok(f.hp < fh, 'funke damaged in shadow'); assert.ok(s.hp < sh, 'schemen burned in light');
  const wh = w.hp;
  step(r, { douse: true }, 1 / 60); w.x = r.p.x - 120; w.y = r.p.y;
  for (let i = 0; i < 200; i++) { step(r, {}, 1 / 60); w.x = r.p.x - 120; w.y = r.p.y; w.vx = w.vy = 0; }
  assert.ok(w.hp < wh || !r.enemies.includes(w), 'wechselbalg took flip damage');
});

t('full story run can be won with cheat stats', () => {
  const r = createRun(data, { seed: 99 });
  let acts = 0, won = false;
  for (let i = 0; i < 60 * 60 * 20 && !won; i++) {
    r.stats.umbraDps = 5000; r.stats.lightDps = 5000; r.stats.flipMul = 50; r.p.flame = r.stats.maxFlame; r.p.inv = 1;
    const ang = i / 120;
    step(r, { mx: Math.cos(ang), my: Math.sin(ang), douse: i % 90 === 0, flare: i % 50 === 0 }, 1 / 60);
    for (const e of r.ev) { if (e.type === 'actclear') { acts++; nextAct(r); } if (e.type === 'win') won = true; }
    r.ev.length = 0;
    if (r.choices) choose(r, i % 3);
  }
  assert.ok(won, 'won; acts=' + acts + ' act=' + r.actIdx + ' phase=' + r.phase);
  const sum = summary(r);
  assert.equal(sum.bossKills.length, 5); assert.ok(sum.won);
  const m = defaultMeta();
  const res = applyRun(m, data, sum);
  assert.ok(res.newAch.includes('sieg') && res.newAch.includes('premiere'));
  assert.equal(m.maxGrade, 1);
  assert.ok(lanternUnlocked(m, data, 'irrlicht'));
  assert.ok(m.glut > 0 && glutFor(data, sum) > 0);
});

t('death, abandon, reroll, encore', () => {
  const r = createRun(data, { seed: 3, workshop: { karten: 2, zweiter: 1 } });
  assert.equal(r.rerolls, 2); assert.equal(r.revives, 1);
  let over = false;
  for (let i = 0; i < 60 * 600 && !over; i++) { step(r, {}, 1 / 60); for (const e of r.ev) if (e.type === 'gameover') over = true; r.ev.length = 0; if (r.choices) { reroll(r); choose(r, 0); } }
  assert.ok(over, 'idle player eventually dies'); assert.equal(r.revives, 0);
  const e = createRun(data, { seed: 4, mode: 'encore' });
  for (let i = 0; i < 60 * 5; i++) step(e, { mx: 1 }, 1 / 60);
  abandon(e); assert.equal(e.phase, 'dead');
});

t('meta sanitize & buy', () => {
  const m = sanitize({ glut: 'x', workshop: { flamme: 99, nope: 3 }, stats: { runs: -5, killsBy: { a: 'b', funke: 3 } }, settings: { vol: 9, fx: 'mega', sfx: false }, highscores: [null, { score: 5 }] }, data);
  assert.equal(m.glut, 0); assert.equal(m.workshop.flamme, 5); assert.ok(!('nope' in m.workshop)); assert.equal(m.stats.runs, 0);
  assert.equal(m.settings.vol, 1); assert.equal(m.settings.fx, 'hoch'); assert.equal(m.settings.sfx, false); assert.equal(m.highscores.length, 1);
  assert.deepEqual(sanitize('garbage', data).glut, 0); assert.ok(sanitize(null, data).settings);
  const m2 = defaultMeta(); m2.glut = 1000;
  assert.ok(buy(data, m2, 'u_doppeldocht')); assert.ok(m2.cards.includes('doppeldocht')); assert.ok(!buy(data, m2, 'u_doppeldocht'));
  for (let i = 0; i < 5; i++) buy(data, m2, 'flamme'); assert.equal(m2.workshop.flamme, 5); assert.equal(m2.glut, 140); assert.ok(!buy(data, m2, 'flamme'));
});

t('app fsm', () => { const a = createApp(); assert.ok(go(a, 'title')); assert.ok(!go(a, 'pause')); assert.ok(go(a, 'select')); assert.ok(go(a, 'run')); assert.ok(canGo('pause', 'settings')); });
t('xp curve', () => { assert.ok(xpFor(1) < xpFor(10)); });

console.log(`ok ${n} test groups`);
import { rayDist } from '../logic/light.js';
t('rayDist', () => { assert.ok(Math.abs(rayDist(0, 0, 1, 0, 500, [{ kind: 'c', x: 100, y: 0, r: 10 }]) - 90) < 1e-6); assert.equal(rayDist(0, 0, 0, 1, 500, [{ kind: 'c', x: 100, y: 0, r: 10 }]), 500); console.log('ok rayDist'); });
t('revive by projectile does not crash', () => {
  const r = createRun(data, { seed: 8, workshop: { zweiter: 1 } });
  r.p.flame = 1; r.p.inv = 0;
  for (let i = 0; i < 5; i++) r.proj.push({ x: r.p.x + i, y: r.p.y, vx: 0, vy: 0, pol: 'L', dmg: 50, r: 6, life: 5 });
  step(r, {}, 1 / 60);
  assert.equal(r.revives, 0); assert.ok(r.p.flame > 0); assert.equal(r.proj.length, 0);
  console.log('ok revive regression');
});
