// Entry point: wires logic, rendering, input, audio and screens together.
import { createRun, step, choose, reroll, nextAct, abandon, summary, setupAct } from './logic/run.js';
import { createApp, go } from './logic/app.js';
import { applyRun, buy, lanternUnlocked, encoreUnlocked } from './logic/meta.js';
import { hashStr, dayKey } from './logic/rng.js';
import { createBot, botInput, botChoose } from './logic/bot.js';
import { createRenderer } from './ui/render.js';
import { createFx } from './ui/fx.js';
import { createInput } from './ui/input.js';
import { createAudio } from './ui/audio.js';
import { createScreens, hintText } from './ui/screens.js';
import { handleEvents, tickJuice } from './ui/juice.js';
import { loadMeta, saveMeta, wipeMeta } from './ui/storage.js';

const STEP = 1 / 60;
const $ = (s) => document.querySelector(s);
const MUTE = { sfx() {}, setFever() {} };

async function loadData() {
  if (window.__GAME_DATA__) return window.__GAME_DATA__;
  const out = {};
  await Promise.all(['enemies', 'acts', 'upgrades', 'lanterns', 'workshop', 'achievements'].map(async (n) => { const r = await fetch(`data/${n}.json`); out[n] = await r.json(); }));
  return out;
}

async function boot() {
  const data = await loadData();
  const canvas = $('#stage');
  const G = {
    data, meta: loadMeta(data), app: createApp(), run: null, attract: null, bot: createBot('smart'), pend: { flare: false, douse: false },
    acc: 0, last: performance.now(), overAt: 0, returnTo: 'title', sel: { lantern: 'oellampe', grade: 0, mode: 'story' }, newShown: {},
    hintQ: [], hintT: 0, cdCache: [-1, -1], t: 0,
  };
  if (!G.meta.stats.runs && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { G.meta.settings.shake = false; G.meta.settings.flash = false; }
  G.sel.lantern = lanternUnlocked(G.meta, data, G.meta.lastLantern) ? G.meta.lastLantern : 'oellampe';
  G.sel.grade = Math.min(G.meta.lastGrade, G.meta.maxGrade);
  const R = createRenderer(canvas), fx = createFx(), input = createInput(canvas), au = createAudio();
  const hint = $('#hint'), banner = $('#banner'), pad = $('#pad'), pauseBtn = $('#btnPause'), cL = $('#curtainL'), cR = $('#curtainR');
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const device = () => (input.lastDevice === 'touch' || (coarse && input.lastDevice !== 'pad') ? 'touch' : 'keys');
  const save = () => saveMeta(G.meta);
  const applySettings = () => {
    const s = G.meta.settings;
    au.settings(s); fx.setQuality(s.fx);
    document.body.classList.toggle('hand-left', s.hand === 'links');
    resize();
  };

  const screens = createScreens($('#ui'), {
    click: () => au.sfx('ui'),
    focusable: () => input.lastDevice !== 'touch',
    action: (a, arg, el) => onAction(a, arg, el),
  });
  input.bindButton($('#btnFlare'), 'flare');
  input.bindButton($('#btnDouse'), 'douse');
  pauseBtn.addEventListener('click', () => pause());

  function curtain(closed) { cL.classList.toggle('closed', closed); cR.classList.toggle('closed', closed); }
  function show(name, extra) {
    const p = Object.assign({ meta: G.meta, data, run: G.run, lantern: G.sel.lantern, grade: G.sel.grade, mode: G.sel.mode }, extra || {});
    screens.show(name, p);
  }
  function to(screen, extra) {
    if (G.app.screen !== screen && !go(G.app, screen)) { G.app.screen = screen; }
    const inRun = screen === 'run';
    input.enabled = inRun; if (!inRun) input.reset();
    else if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    pad.hidden = !inRun; pauseBtn.hidden = !inRun;
    document.body.classList.toggle('in-run', inRun);
    show(inRun ? null : screen, extra);
    if (screen === 'title' || screen === 'select') au.setMusic(data.acts.acts[0].music, 'title');
  }

  // ------------- run lifecycle -------------
  function startRun(mode) {
    au.init(); au.settings(G.meta.settings);
    const daily = mode === 'daily';
    G.sel.mode = mode;
    G.run = createRun(data, {
      seed: daily ? hashStr('lampenfieber-' + dayKey()) : undefined, mode,
      lantern: daily ? 'oellampe' : G.sel.lantern, grade: daily ? 0 : G.sel.grade,
      workshop: G.meta.workshop, unlockedCards: G.meta.cards, tutorial: mode === 'story' && !G.meta.tutorialDone && G.meta.settings.hints,
    });
    if (!daily) { G.meta.lastLantern = G.sel.lantern; G.meta.lastGrade = G.sel.grade; save(); }
    G.acc = 0; G.overAt = 0; G.newShown = {}; G.hintQ = []; hideHint();
    fx.clear(); au.setFever(0);
    curtain(true);
    setTimeout(() => curtain(false), 380);
    to('run');
    drain(G.run, au);
    au.setMusic(G.run.act.music, 'run');
  }

  function finishRun() {
    const run = G.run; G.overAt = 0;
    const sum = summary(run);
    const res = applyRun(G.meta, data, sum);
    save();
    to('over', { sum, res, best: G.meta });
  }

  function pause() {
    if (G.app.screen !== 'run' || !G.run || G.overAt) return;
    G.returnTo = 'pause'; to('pause');
  }

  function onAction(a, arg, el) {
    au.init();
    const m = G.meta;
    switch (a) {
      case 'play': G.sel.mode = 'story'; to('select'); break;
      case 'daily': startRun('daily'); break;
      case 'encore': if (encoreUnlocked(m)) { G.sel.mode = 'encore'; to('select'); } break;
      case 'nav': G.returnTo = G.app.screen === 'pause' ? 'pause' : 'title'; to(arg); break;
      case 'back': to(['workshop', 'achievements', 'stats', 'howto', 'settings'].includes(G.app.screen) ? G.returnTo : 'title'); break;
      case 'lantern': if (lanternUnlocked(m, data, arg)) { G.sel.lantern = arg; show('select'); } break;
      case 'grade': G.sel.grade = Math.min(+arg, m.maxGrade); show('select'); break;
      case 'start': startRun(G.sel.mode); break;
      case 'choose': if (G.run && choose(G.run, +arg)) { drain(G.run, au); if (G.run.choices) show('levelup'); else to('run'); } break;
      case 'reroll': if (G.run && reroll(G.run)) show('levelup'); break;
      case 'resume': to('run'); break;
      case 'abandon': if (G.run) { abandon(G.run); to('run'); drain(G.run, au); } break;
      case 'nextact': if (G.run && nextAct(G.run)) { curtain(false); au.setMusic(G.run.act.music, 'run'); drain(G.run, au); to(G.run.choices ? 'levelup' : 'run'); } break;
      case 'totitle': G.run = null; to('title'); break;
      case 'toselect': G.run = null; to('select'); break;
      case 'again': startRun(G.sel.mode); break;
      case 'buy': if (buy(data, m, arg)) { save(); au.sfx('pick'); show('workshop'); } break;
      case 'set': {
        const s = m.settings;
        if (el.type === 'checkbox') s[arg] = el.checked; else if (el.type === 'range') s[arg] = +el.value; else s[arg] = el.value;
        applySettings(); save(); break;
      }
      case 'wipe': if (window.confirm('Spielstand, Glut und Erfolge wirklich löschen?')) { G.meta = wipeMeta(); G.sel.lantern = 'oellampe'; G.sel.grade = 0; applySettings(); to('title'); } break;
      default: break;
    }
  }

  // ------------- hints & banners -------------
  function hideHint() { hint.classList.remove('on'); G.hintT = 0; }
  function queueHint(key, tut) {
    const s = G.meta.settings;
    if (!s.hints) return;
    if (!tut && G.meta.hints[key]) return;
    if (!tut) G.meta.hints[key] = true;
    const txt = hintText(key, data, device());
    if (txt && !G.hintQ.includes(txt)) G.hintQ.push(txt);
  }
  function tickHint(dt) {
    if (G.hintT > 0) { G.hintT -= dt; if (G.hintT <= 0) hideHint(); return; }
    if (G.hintQ.length && G.app.screen === 'run') { hint.textContent = G.hintQ.shift(); hint.classList.add('on'); G.hintT = Math.max(4.5, hint.textContent.length / 14); }
  }
  function showBanner(small, big) {
    banner.innerHTML = `<small>${small}</small><span>${big}</span>`;
    banner.classList.remove('on'); void banner.offsetWidth; banner.classList.add('on');
  }

  const hooks = {
    levelup: () => {},
    banner: (name, what) => showBanner(what, name),
    actclear: () => { setTimeout(() => curtain(true), 200); },
    win: () => { G.overAt = performance.now() + 1800; input.enabled = false; },
    gameover: () => { G.overAt = performance.now() + 1500; input.enabled = false; },
    hint: (e) => queueHint(e.key, e.tut),
    act: (e) => { G.hintQ.length = 0; hideHint(); const a = G.run && G.run.act; if (a) showBanner(G.run.mode === 'encore' ? 'Zugabe' : a.sub, a.name); },
  };

  function drain(run, audio) {
    if (!run.ev.length) return;
    if (run === G.run) {
      for (const e of run.ev) if (e.type === 'spawn' && !e.boss && !G.meta.seen[e.id] && !G.newShown[e.id] && !['funke', 'schemen'].includes(e.id)) { G.newShown[e.id] = true; queueHint('new_' + e.id); }
      handleEvents(run, run.ev, fx, audio, hooks);
    } else handleEvents(run, run.ev, fx, MUTE, {});
    run.ev.length = 0;
  }

  // ------------- attract mode -------------
  let attractN = 0;
  function newAttract() {
    const r = createRun(data, { seed: (Math.random() * 1e9) | 0, workshop: { schatten: 5, licht: 5 } });
    setupAct(r, attractN++ % data.acts.acts.length);
    r.stacks.mondstein = 2; r.stacks.docht = 1; r.stats.orbit = 2; r.stats.radius *= 1.12;
    r.ev.length = 0; G.attract = r; G.attractT = 0;
  }

  // ------------- input for menus -------------
  input.onKey = (e) => {
    const sc = G.app.screen;
    if (sc === 'run') { if (e.code === 'Escape' || e.code === 'KeyP') pause(); return; }
    if (sc === 'levelup') {
      const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
      if (i >= 0) onAction('choose', i);
      if (e.code === 'KeyR') onAction('reroll');
      return;
    }
    if (e.code === 'Escape') {
      if (sc === 'pause') onAction('resume');
      else if (sc === 'select' || ['workshop', 'achievements', 'stats', 'howto', 'settings'].includes(sc)) onAction('back');
      return;
    }
    if (e.code === 'ArrowDown' || e.code === 'ArrowUp' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') moveFocus(e.code === 'ArrowDown' || e.code === 'ArrowRight' ? 1 : -1);
  };
  input.onPad = (b) => {
    const sc = G.app.screen;
    if (sc === 'run') { if (b === 9) pause(); return; }
    input.lastDevice = 'pad';
    if (b === 12 || b === 14) moveFocus(-1);
    if (b === 13 || b === 15) moveFocus(1);
    if (b === 0 && document.activeElement && document.activeElement.closest('#ui')) document.activeElement.click();
    if (b === 1 || b === 9) { if (sc === 'pause') onAction('resume'); else if (sc !== 'title' && sc !== 'levelup' && sc !== 'over' && sc !== 'interlude') onAction('back'); }
  };
  function moveFocus(d) {
    const list = [...document.querySelectorAll('#ui button:not([disabled]), #ui input, #ui select')];
    if (!list.length) return;
    const i = list.indexOf(document.activeElement);
    list[(i + d + list.length) % list.length].focus();
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('pointerdown', () => au.init(), { once: true });
  window.addEventListener('keydown', () => au.init(), { once: true });

  // ------------- layout -------------
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;inset:0;pointer-events:none;visibility:hidden;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
  document.body.appendChild(probe);
  function resize() {
    const cs = getComputedStyle(probe);
    const safe = { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
    const dpr = Math.min(window.devicePixelRatio || 1, G.meta.settings.fx === 'niedrig' ? 1.25 : 2);
    R.resize(window.innerWidth, window.innerHeight, dpr, safe);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));

  // ------------- main loop -------------
  function setCd(i, el, v) { const q = Math.round(v * 50) / 50; if (G.cdCache[i] !== q) { G.cdCache[i] = q; el.style.setProperty('--cd', q); el.classList.toggle('ready', q <= 0); } }
  const bF = $('#btnFlare'), bD = $('#btnDouse');

  function frame(now) {
    const rdt = Math.min(0.1, (now - G.last) / 1000);
    G.last = now; G.t += rdt;
    fx.update(rdt);
    let sdt = rdt * fx.slow;
    if (fx.freeze > 0) { fx.freeze -= rdt; sdt = 0; }
    const sc = G.app.screen;
    let shown = null;
    const pt0 = performance.now();
    if (G.run && ['run', 'levelup', 'pause', 'interlude', 'over'].includes(sc)) {
      const run = G.run;
      shown = run;
      if (sc === 'run') {
        const inp = input.read();
        if (inp.flare) G.pend.flare = true;
        if (inp.douse) G.pend.douse = true;
        G.acc += sdt;
        let n = 0;
        while (G.acc >= STEP && n < 6) {
          step(run, { mx: inp.mx, my: inp.my, flare: G.pend.flare, douse: G.pend.douse }, STEP);
          G.pend.flare = G.pend.douse = false;
          G.acc -= STEP; n++;
          drain(run, au);
          if (run.choices || run.phase === 'interlude') break;
        }
        if (n === 6) G.acc = 0;
        tickJuice(run, fx, sdt);
        if (run.choices && G.app.screen === 'run' && !G.overAt) to('levelup');
        else if (run.phase === 'interlude' && G.app.screen === 'run') to('interlude');
        const s = run.stats, p = run.p;
        setCd(0, bF, Math.max(0, p.flareCd / s.flareCd));
        setCd(1, bD, Math.max(0, p.douseCd / (s.douseCd + s.douseDur)));
        au.setMusic(null, run.phase === 'boss' ? 'boss' : 'run');
        au.setFever(run.feverTier);
      }
      if (G.overAt && now >= G.overAt) finishRun();
    } else {
      if (!G.attract) newAttract();
      const r = G.attract;
      shown = r;
      G.attractT += rdt;
      r.p.flame = r.stats.maxFlame; r.p.inv = 1;
      if (r.choices) choose(r, botChoose(r, G.bot));
      step(r, botInput(r, G.bot, STEP), STEP);
      drain(r, MUTE);
      tickJuice(r, fx, rdt);
      if (G.attractT > 40 || (r.phase !== 'play' && r.phase !== 'boss')) newAttract();
    }
    const pt1 = performance.now();
    if (shown && shown.ctx) {
      R.render(shown, { t: G.t, dt: rdt, fx, settings: G.meta.settings, snap: false });
      if (shown === G.run) R.hud(shown, { t: G.t, joy: input.joy });
    }
    const pt2 = performance.now();
    G.perf = G.perf || { sim: 0, draw: 0 };
    G.perf.sim += (pt1 - pt0 - G.perf.sim) * 0.05; G.perf.draw += (pt2 - pt1 - G.perf.draw) * 0.05;
    tickHint(rdt);
    requestAnimationFrame(frame);
  }

  applySettings();
  to('title');
  setTimeout(() => curtain(false), 120);
  document.body.classList.add('ready');
  window.__G = G;
  requestAnimationFrame(frame);
}

boot().catch((e) => {
  console.error(e);
  const el = document.getElementById('ui');
  if (el) { el.hidden = false; el.innerHTML = `<div class="panel"><h2>Die Lampe will nicht brennen</h2><p>${String(e && e.message || e)}</p><p class="fine">Lade die Seite neu. Hilft das nicht, lösche den Spielstand im Browser.</p></div>`; }
});
