// Meta progression: save schema, sanitizing, rewards, achievements, workshop. Pure.
import { dayKey } from './rng.js';

export const SAVE_KEY = 'lampenfieber.save.v1';

export function defaultMeta() {
  return {
    v: 1, glut: 0, workshop: {}, cards: [], ach: {}, seen: {}, hints: {}, maxGrade: 0, tutorialDone: false, lastLantern: 'oellampe', lastGrade: 0,
    stats: { runs: 0, wins: 0, kills: 0, killsBy: {}, killsShadow: 0, killsLight: 0, killsFlip: 0, bestScore: 0, bestAct: 0, time: 0, encoreBest: 0, encoreScore: 0, dailyKey: '', dailyBest: 0, bossKills: {}, picks: {}, glutTotal: 0 },
    highscores: [],
    settings: { sfx: true, music: true, vol: 0.7, shake: true, fx: 'hoch', flash: true, hints: true, hand: 'rechts' },
  };
}

const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);
const num = (v, d, lo = -Infinity, hi = Infinity) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
function numMap(o) { const out = {}; if (isObj(o)) for (const k in o) { const v = num(o[k], null, 0); if (v !== null) out[k] = v; } return out; }

export function sanitize(raw, data) {
  const d = defaultMeta();
  if (!isObj(raw)) return d;
  d.glut = Math.floor(num(raw.glut, 0, 0, 1e9));
  if (isObj(raw.workshop)) for (const k in raw.workshop) { const w = data && data.workshop[k]; if (!data || w) d.workshop[k] = Math.floor(num(raw.workshop[k], 0, 0, w ? w.cost.length : 9)); }
  if (Array.isArray(raw.cards)) d.cards = raw.cards.filter((c) => typeof c === 'string' && (!data || data.upgrades[c]));
  for (const key of ['ach', 'seen', 'hints']) if (isObj(raw[key])) for (const k in raw[key]) if (raw[key][k]) d[key][k] = true;
  d.maxGrade = Math.floor(num(raw.maxGrade, 0, 0, 5));
  d.tutorialDone = !!raw.tutorialDone;
  if (typeof raw.lastLantern === 'string' && (!data || data.lanterns[raw.lastLantern])) d.lastLantern = raw.lastLantern;
  d.lastGrade = Math.floor(num(raw.lastGrade, 0, 0, d.maxGrade));
  if (isObj(raw.stats)) {
    const s = raw.stats, t = d.stats;
    for (const k of ['runs', 'wins', 'kills', 'killsShadow', 'killsLight', 'killsFlip', 'bestScore', 'bestAct', 'time', 'encoreBest', 'encoreScore', 'dailyBest', 'glutTotal']) t[k] = num(s[k], 0, 0);
    t.killsBy = numMap(s.killsBy); t.bossKills = numMap(s.bossKills); t.picks = numMap(s.picks);
    t.dailyKey = typeof s.dailyKey === 'string' ? s.dailyKey.slice(0, 12) : '';
  }
  if (Array.isArray(raw.highscores)) d.highscores = raw.highscores.filter(isObj).map((h) => ({ score: Math.floor(num(h.score, 0, 0)), lantern: String(h.lantern || 'oellampe').slice(0, 20), act: num(h.act, 1, 1, 9), mode: String(h.mode || 'story').slice(0, 10), grade: num(h.grade, 0, 0, 5), won: !!h.won, date: String(h.date || '').slice(0, 12) })).slice(0, 10);
  if (isObj(raw.settings)) {
    const s = raw.settings, t = d.settings;
    for (const k of ['sfx', 'music', 'shake', 'flash', 'hints']) if (typeof s[k] === 'boolean') t[k] = s[k];
    t.vol = num(s.vol, t.vol, 0, 1);
    if (s.fx === 'hoch' || s.fx === 'niedrig') t.fx = s.fx;
    if (s.hand === 'links' || s.hand === 'rechts') t.hand = s.hand;
  }
  return d;
}

export function lanternUnlocked(meta, data, id) { const l = data.lanterns[id]; return !!l && (!l.unlock || !!meta.ach[l.unlock]); }
export function encoreUnlocked(meta) { return !!meta.ach.sieg; }

export function workshopCost(data, meta, id) {
  const w = data.workshop[id]; if (!w) return null;
  const lv = meta.workshop[id] || 0;
  return lv < w.cost.length ? w.cost[lv] : null;
}

export function buy(data, meta, id) {
  const c = workshopCost(data, meta, id);
  if (c === null || meta.glut < c) return false;
  meta.glut -= c;
  meta.workshop[id] = (meta.workshop[id] || 0) + 1;
  const w = data.workshop[id];
  if (w.card && !meta.cards.includes(w.card)) meta.cards.push(w.card);
  return true;
}

export function glutFor(data, sum) {
  const g = data.acts.grades[sum.grade] || data.acts.grades[0];
  let base = sum.score / 220 + sum.actsCleared * 12 + sum.bossKills.length * 8 + sum.bonusGlut;
  if (sum.mode === 'encore') base += sum.time / 8;
  return Math.max(1, Math.floor(base * g.glut));
}

const ACH = {
  premiere: (m) => m.stats.runs >= 1,
  akt2: (m, s) => s.mode !== 'encore' && s.act >= 2,
  kerzenmutter: (m, s) => s.bossKills.includes('kerzenmutter'),
  rabenkoenig: (m, s) => s.bossKills.includes('rabenkoenig'),
  akt4: (m, s) => s.mode !== 'encore' && s.act >= 4,
  sieg: (m, s) => s.won,
  fieber3: (m, s) => s.maxTier >= 3,
  funken500: (m) => m.stats.killsShadow >= 500,
  schemen500: (m) => m.stats.killsLight >= 500,
  viermonde: (m, s) => s.maxOrbit >= 4,
  unberuehrt: (m, s) => s.hitlessActs >= 1,
  dunkelzehn: (m, s) => s.maxDouseKills >= 10,
  zugabe5: (m, s) => s.mode === 'encore' && s.time >= 300,
  grad3: (m, s) => s.won && s.grade >= 3,
  grubensieg: (m, s) => s.won && s.lantern === 'grubenlampe',
  wechsel100: (m) => (m.stats.killsBy.wechselbalg || 0) >= 100,
};

export function applyRun(meta, data, sum, now = new Date()) {
  const st = meta.stats;
  st.runs++; if (sum.won) st.wins++;
  st.kills += sum.kills; st.killsShadow += sum.killsShadow; st.killsLight += sum.killsLight; st.killsFlip += sum.killsFlip;
  for (const k in sum.killsBy) st.killsBy[k] = (st.killsBy[k] || 0) + sum.killsBy[k];
  for (const b of sum.bossKills) st.bossKills[b] = (st.bossKills[b] || 0) + 1;
  for (const k in sum.picks) st.picks[k] = (st.picks[k] || 0) + sum.picks[k];
  for (const k of sum.seen || []) meta.seen[k] = true;
  st.time += sum.time;
  const isNewBest = sum.score > st.bestScore;
  st.bestScore = Math.max(st.bestScore, sum.score);
  if (sum.mode !== 'encore') st.bestAct = Math.max(st.bestAct, sum.won ? 6 : sum.act);
  else { st.encoreBest = Math.max(st.encoreBest, sum.time); st.encoreScore = Math.max(st.encoreScore, sum.score); }
  if (sum.mode === 'daily') { const k = dayKey(now); if (st.dailyKey !== k) { st.dailyKey = k; st.dailyBest = 0; } st.dailyBest = Math.max(st.dailyBest, sum.score); }
  const entry = { score: sum.score, lantern: sum.lantern, act: sum.act, mode: sum.mode, grade: sum.grade, won: sum.won, date: dayKey(now) };
  meta.highscores.push(entry);
  meta.highscores.sort((a, b) => b.score - a.score);
  meta.highscores = meta.highscores.slice(0, 10);
  const rank = meta.highscores.indexOf(entry);
  let glut = glutFor(data, sum);
  const newAch = [];
  for (const id in data.achievements) {
    if (meta.ach[id] || !ACH[id]) continue;
    if (ACH[id](meta, sum)) { meta.ach[id] = true; newAch.push(id); glut += data.achievements[id].glut || 0; }
  }
  meta.glut += glut; st.glutTotal += glut;
  let gradeUp = false;
  if (sum.won && sum.grade >= meta.maxGrade && meta.maxGrade < data.acts.grades.length - 1) { meta.maxGrade = sum.grade + 1; gradeUp = true; }
  if (sum.mode === 'story') meta.tutorialDone = true;
  return { glut, newAch, rank, isNewBest, gradeUp };
}
