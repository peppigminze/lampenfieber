// Stats, upgrade cards and choice rolling. Pure.
export const BASE = {
  maxFlame: 110, radius: 230, speed: 150, umbraDps: 36, lightDps: 33,
  flareCd: 7, flareDmg: 26, flareR: 0.8, douseCd: 9, douseDur: 1.2, shadowLen: 1,
  magnet: 70, xpMul: 1, orbit: 0, orbitSize: 13, orbitSpeed: 1.6, orbitDist: 80,
  menhir: 0, wisps: 0, ember: 0, ash: 0, healKills: 0, feverDecay: 1, feverBonus: 1,
  douseCloud: 0, trail: 0, doubleFlare: 0, douseDash: 0, regen: 0, schemenSlow: 1, flipMul: 1,
  cone: 0, rerolls: 0, revive: 0, startCard: 0,
};

export const RAR_W = { common: 10, rare: 5.5, epic: 2.2 };
export const FALLBACK = '_wachs';

export function applyFx(s, fx, times = 1) {
  if (!fx || times <= 0) return;
  for (const [k, op, v] of fx) {
    if (k === 'heal' || !(k in s)) continue;
    if (op === 'add') s[k] += v * times;
    else if (op === 'mul') s[k] *= Math.pow(v, times);
    else if (op === 'set') s[k] = v;
  }
}

export function computeStats(data, lanternId, workshop, stacks) {
  const s = Object.assign({}, BASE);
  const lan = data.lanterns[lanternId] || data.lanterns.oellampe;
  Object.assign(s, lan.stats || {});
  for (const id in workshop || {}) { const w = data.workshop[id]; if (w && w.fx) applyFx(s, w.fx, workshop[id] | 0); }
  for (const id in stacks || {}) { const u = data.upgrades[id]; if (u) applyFx(s, u.fx, stacks[id]); }
  s.orbit = Math.min(4, Math.round(s.orbit));
  s.flareCd = Math.max(1.5, s.flareCd); s.douseCd = Math.max(2.5, s.douseCd);
  return s;
}

export function availableCards(data, stacks, unlocked) {
  const out = [];
  for (const id in data.upgrades) {
    const u = data.upgrades[id];
    if ((stacks[id] || 0) >= u.max) continue;
    if (u.locked && !(unlocked || []).includes(id)) continue;
    if (u.req && !(stacks[u.req] > 0)) continue;
    out.push(id);
  }
  return out;
}

export function rollChoices(data, rng, stacks, unlocked, n = 3) {
  const pool = availableCards(data, stacks, unlocked);
  const picks = [];
  while (picks.length < n && pool.length) {
    const id = rng.weighted(pool, (k) => RAR_W[data.upgrades[k].rar] || 1);
    picks.push(id);
    pool.splice(pool.indexOf(id), 1);
  }
  while (picks.length < n) picks.push(FALLBACK);
  return picks;
}

export function cardInfo(data, id) {
  if (id === FALLBACK) return { name: 'Wachsklumpen', rar: 'common', icon: '❂', desc: 'Heilt 35 Flamme und gibt 150 Punkte.', max: 99 };
  return data.upgrades[id];
}
