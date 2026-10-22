// Headless balance simulator: plays many runs with different bot strategies.
// Usage: node tests/sim.mjs [runsPerConfig=40] [hz=20] [filter]
import { loadData } from '../tools/data-node.mjs';
import { createRun, step, choose, nextAct, summary } from '../logic/run.js';
import { createBot, botInput, botChoose } from '../logic/bot.js';

const data = loadData();
const N = +(process.argv[2] || 40), HZ = +(process.argv[3] || 20), FILTER = process.argv[4] || '';
const DT = 1 / HZ;
const FULL_META = { flamme: 5, schein: 5, schatten: 5, licht: 5, gier: 5, karten: 3, zweiter: 1, requisite: 1 };
const MID_META = { flamme: 3, schein: 2, schatten: 3, licht: 3, gier: 2, karten: 1 };
const ALL_CARDS = Object.keys(data.upgrades).filter((k) => data.upgrades[k].locked);

export function play(cfg, seed) {
  const run = createRun(data, { seed, lantern: cfg.lantern || 'oellampe', workshop: cfg.meta || {}, grade: cfg.grade || 0, unlockedCards: cfg.cards || [], mode: cfg.mode || 'story' });
  const bot = createBot(cfg.strat, cfg.pick || 'prio');
  const bossT = {}, actEnd = [];
  let bossStart = 0, steps = 0;
  const maxSteps = (cfg.maxTime || 1500) * HZ;
  while (steps++ < maxSteps) {
    if (run.choices) choose(run, botChoose(run, bot));
    if (run.phase === 'interlude') { actEnd.push({ act: run.actIdx, t: run.t, level: run.level, flame: run.p.flame / run.stats.maxFlame }); nextAct(run); }
    if (run.phase === 'dead' || run.phase === 'won') break;
    step(run, botInput(run, bot, DT), DT);
    for (const e of run.ev) {
      if (e.type === 'boss') bossStart = run.t;
      if (e.type === 'bossdead') bossT[e.id] = run.t - bossStart;
    }
    run.ev.length = 0;
  }
  return { sum: summary(run), bossT, actEnd, hurtBy: run.hurtBy, timedOut: steps >= maxSteps };
}

function agg(cfg, label) {
  const res = [];
  const t0 = Date.now();
  for (let i = 0; i < N; i++) res.push(play(cfg, 1000 + i * 7919));
  const ms = Date.now() - t0;
  const wins = res.filter((r) => r.sum.won).length;
  const actDist = [0, 0, 0, 0, 0, 0];
  for (const r of res) actDist[r.sum.won ? 5 : r.sum.act - 1]++;
  const avg = (f) => res.reduce((a, r) => a + f(r), 0) / res.length;
  const bossAvg = {};
  for (const r of res) for (const k in r.bossT) { (bossAvg[k] = bossAvg[k] || []).push(r.bossT[k]); }
  const killers = {};
  for (const r of res) if (r.sum.killedBy) killers[r.sum.killedBy] = (killers[r.sum.killedBy] || 0) + 1;
  const dmg = {};
  for (const r of res) for (const k in r.hurtBy) dmg[k] = (dmg[k] || 0) + r.hurtBy[k] / res.length;
  const picks = {};
  for (const r of res) for (const k in r.sum.picks) picks[k] = (picks[k] || 0) + r.sum.picks[k];
  const kills = {};
  for (const r of res) for (const k in r.sum.killsBy) kills[k] = (kills[k] || 0) + r.sum.killsBy[k] / res.length;
  const lvlAct = [0, 0, 0, 0, 0].map((_, a) => { const xs = res.flatMap((r) => r.actEnd.filter((x) => x.act === a)); return xs.length ? (xs.reduce((s, x) => s + x.level, 0) / xs.length).toFixed(1) : '-'; });
  const out = {
    label, n: N, ms: Math.round(ms / N), winrate: +(wins / N * 100).toFixed(1), actDist,
    avgTime: Math.round(avg((r) => r.sum.time)), avgScore: Math.round(avg((r) => r.sum.score)), avgLevel: +avg((r) => r.sum.level).toFixed(1),
    lvlAtActEnd: lvlAct, timedOut: res.filter((r) => r.timedOut).length,
    bossSecs: Object.fromEntries(Object.entries(bossAvg).map(([k, v]) => [k, Math.round(v.reduce((a, b) => a + b, 0) / v.length)])),
    topKillers: Object.entries(killers).sort((a, b) => b[1] - a[1]).slice(0, 6),
    dmgBySource: Object.entries(dmg).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => [k, Math.round(v)]),
    kills: Object.fromEntries(Object.entries(kills).map(([k, v]) => [k, Math.round(v)])),
    picks: Object.entries(picks).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' '),
  };
  return out;
}

const CONFIGS = [
  ['idle', { strat: 'idle' }],
  ['random', { strat: 'random', pick: 'random' }],
  ['kite', { strat: 'kite' }],
  ['smart-fresh', { strat: 'smart' }],
  ['smart-randcards', { strat: 'smart', pick: 'random' }],
  ['smart-mid', { strat: 'smart', meta: MID_META }],
  ['smart-full', { strat: 'smart', meta: FULL_META, cards: ALL_CARDS }],
  ['smart-full-g3', { strat: 'smart', meta: FULL_META, cards: ALL_CARDS, grade: 3 }],
  ['smart-full-g5', { strat: 'smart', meta: FULL_META, cards: ALL_CARDS, grade: 5 }],
  ['teelicht-mid', { strat: 'smart', meta: MID_META, lantern: 'teelicht' }],
  ['grube-mid', { strat: 'smart', meta: MID_META, lantern: 'grubenlampe' }],
  ['laterna-mid', { strat: 'smart', meta: MID_META, lantern: 'laterna' }],
  ['irrlicht-mid', { strat: 'smart', meta: MID_META, lantern: 'irrlicht' }],
  ['encore-full', { strat: 'smart', meta: FULL_META, cards: ALL_CARDS, mode: 'encore', maxTime: 900 }],
];

if (process.argv[1] && process.argv[1].endsWith('sim.mjs')) {
  const results = [];
  for (const [label, cfg] of CONFIGS) {
    if (FILTER && !label.includes(FILTER)) continue;
    const r = agg(cfg, label);
    results.push(r);
    console.log(JSON.stringify(r));
  }
}
