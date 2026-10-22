// WebAudio synthesis: sound effects + generative music. No external files.
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function createAudio() {
  const A = { ctx: null, sfxOn: true, musicOn: true, vol: 0.7, music: { root: 50, scale: [0, 2, 3, 7, 9], bpm: 80 }, mode: 'off', fever: 0, step: 0, next: 0, timer: null, last: {}, killIdx: 0 };
  let master, sfxBus, musBus, delay, noiseBuf;

  A.init = () => {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { A.ctx = new AC(); } catch (e) { A.ctx = null; return; }
    const c = A.ctx;
    master = c.createGain(); master.gain.value = A.vol;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
    master.connect(comp); comp.connect(c.destination);
    sfxBus = c.createGain(); sfxBus.gain.value = A.sfxOn ? 1 : 0; sfxBus.connect(master);
    musBus = c.createGain(); musBus.gain.value = A.musicOn ? 0.8 : 0; musBus.connect(master);
    delay = c.createDelay(1); delay.delayTime.value = 0.33;
    const fb = c.createGain(); fb.gain.value = 0.38; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(musBus);
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    A.timer = setInterval(schedule, 50);
  };

  A.settings = (s) => {
    A.sfxOn = !!s.sfx; A.musicOn = !!s.music; A.vol = s.vol;
    if (!A.ctx) return;
    const t = A.ctx.currentTime;
    master.gain.setTargetAtTime(A.vol, t, 0.05);
    sfxBus.gain.setTargetAtTime(A.sfxOn ? 1 : 0, t, 0.05);
    musBus.gain.setTargetAtTime(A.musicOn ? 0.8 : 0, t, 0.2);
  };

  function env(g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
  }
  function tone(f, dur, type, vol, o = {}) {
    if (!A.ctx) return;
    const c = A.ctx, t = (o.at || c.currentTime) + 0.005;
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = type; osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + (o.slide || dur));
    if (o.detune) osc.detune.value = o.detune;
    env(g, t, o.a || 0.005, vol, dur);
    let node = osc;
    if (o.lp) { const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = o.lp; node.connect(f2); node = f2; }
    node.connect(g); g.connect(o.bus || sfxBus);
    if (o.echo) g.connect(delay);
    osc.start(t); osc.stop(t + (o.a || 0.005) + dur + 0.05);
  }
  function noise(dur, vol, o = {}) {
    if (!A.ctx) return;
    const c = A.ctx, t = (o.at || c.currentTime) + 0.005;
    const src = c.createBufferSource(); src.buffer = noiseBuf;
    const f = c.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.f || 1000, t); f.Q.value = o.q || 1;
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    const g = c.createGain(); env(g, t, o.a || 0.005, vol, dur);
    src.connect(f); f.connect(g); g.connect(o.bus || sfxBus);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.1);
  }
  const deg = (i, oct = 0) => { const s = A.music.scale, n = s.length; const o = Math.floor(i / n); return A.music.root + oct * 12 + o * 12 + s[((i % n) + n) % n]; };
  function limited(name, gap) { const now = performance.now(); if (A.last[name] && now - A.last[name] < gap) return true; A.last[name] = now; return false; }

  const SFX = {
    flare() { noise(0.45, 0.35, { f: 700, to: 5000, q: 0.8 }); tone(300, 0.3, 'sine', 0.22, { to: 1300 }); tone(mtof(deg(4, 2)), 0.6, 'triangle', 0.06, { echo: true }); },
    douse() { tone(520, 0.55, 'sine', 0.25, { to: 55 }); noise(0.6, 0.18, { type: 'lowpass', f: 2400, to: 160 }); },
    douseEnd() { tone(90, 0.25, 'sine', 0.12, { to: 240 }); },
    killL() { if (limited('kL', 55)) return; A.killIdx = (A.killIdx + 1 + Math.floor(Math.random() * 2)) % 10; tone(mtof(deg(A.killIdx, 2)), 0.22, 'triangle', 0.1, { echo: true }); tone(mtof(deg(A.killIdx, 3)), 0.08, 'sine', 0.04); },
    killS() { if (limited('kS', 50)) return; tone(130, 0.16, 'sine', 0.26, { to: 45 }); noise(0.1, 0.12, { type: 'lowpass', f: 900 }); },
    flip() { if (limited('fl', 60)) return; tone(mtof(deg(2, 2)), 0.06, 'square', 0.04, { lp: 2500 }); tone(mtof(deg(4, 2)), 0.1, 'square', 0.04, { lp: 2500, at: A.ctx.currentTime + 0.05 }); },
    hurt() { tone(220, 0.3, 'sawtooth', 0.22, { to: 60, lp: 1200 }); noise(0.15, 0.2, { f: 400 }); },
    pickup(o) { if (limited('pk', 35)) return; tone(mtof(deg((o.n || 0) % 15, 2)), 0.07, 'sine', 0.05); },
    levelup() { const t = A.ctx.currentTime; for (let i = 0; i < 4; i++) tone(mtof(deg(i * 2, 1)), 0.4, 'triangle', 0.08, { at: t + i * 0.07, echo: true }); },
    pick() { const t = A.ctx.currentTime; [0, 2, 4].forEach((d, i) => tone(mtof(deg(d, 1)), 0.5, 'triangle', 0.06, { at: t + i * 0.02 })); },
    boss() { tone(55, 2.2, 'sawtooth', 0.18, { a: 0.8, lp: 400 }); tone(82.4, 2.2, 'sawtooth', 0.1, { a: 0.9, lp: 300 }); noise(1.8, 0.12, { type: 'lowpass', f: 300, a: 0.8 }); },
    bossdead() { const t = A.ctx.currentTime; noise(1.2, 0.35, { type: 'lowpass', f: 3000, to: 100 }); for (let i = 0; i < 5; i++) tone(mtof(deg(8 - i, 1)), 0.6, 'triangle', 0.09, { at: t + i * 0.09, echo: true }); },
    clear() { const t = A.ctx.currentTime; [0, 2, 4, 7].forEach((d, i) => tone(mtof(deg(d, 1)), 0.9, 'triangle', 0.09, { at: t + i * 0.13, echo: true })); },
    win() { const t = A.ctx.currentTime; [0, 2, 4, 5, 7, 9].forEach((d, i) => { tone(mtof(deg(d, 1)), 1.2, 'triangle', 0.09, { at: t + i * 0.16, echo: true }); tone(mtof(deg(d, 0)), 1.2, 'sine', 0.06, { at: t + i * 0.16 }); }); },
    gameover() { const t = A.ctx.currentTime; [4, 3, 1, 0].forEach((d, i) => tone(mtof(deg(d, 0)), 0.8, 'triangle', 0.1, { at: t + i * 0.22, lp: 1400 })); },
    shoot() { if (limited('sh', 80)) return; tone(880, 0.08, 'square', 0.025, { to: 600, lp: 2000 }); },
    charge() { tone(140, 0.6, 'sawtooth', 0.08, { to: 500, lp: 1500 }); },
    blink() { if (limited('bl', 80)) return; tone(600, 0.12, 'sine', 0.05, { to: 1800 }); },
    ui() { tone(1200, 0.04, 'triangle', 0.05); },
    fever(o) { tone(300 + o.tier * 120, 0.5, 'sawtooth', 0.06, { to: 900 + o.tier * 300, lp: 3000 }); tone(mtof(deg(7, 2)), 0.6, 'triangle', 0.07, { echo: true }); },
    puddle() { if (limited('pu', 150)) return; tone(160, 0.2, 'sine', 0.08, { to: 80 }); },
    menhir() { tone(80, 0.25, 'sine', 0.2, { to: 40 }); noise(0.1, 0.1, { type: 'lowpass', f: 500 }); },
    revive() { const t = A.ctx.currentTime; [0, 4, 7, 11].forEach((d, i) => tone(mtof(deg(d, 2)), 0.8, 'sine', 0.08, { at: t + i * 0.05, echo: true })); },
    fizzle() { if (limited('fz', 40)) return; noise(0.12, 0.06, { type: 'highpass', f: 3000 }); },
    pounce() { if (limited('po', 120)) return; noise(0.15, 0.07, { f: 300, to: 900 }); },
  };

  A.sfx = (name, o = {}) => { if (!A.ctx || !A.sfxOn || A.ctx.state !== 'running') return; const f = SFX[name]; if (f) try { f(o); } catch (e) { /* ignore */ } };

  A.setMusic = (m, mode) => { if (m) A.music = m; A.mode = mode; };
  A.setFever = (t) => { A.fever = t; };

  function schedule() {
    const c = A.ctx;
    if (!c || c.state !== 'running' || A.mode === 'off' || !A.musicOn) { if (c) A.next = c.currentTime + 0.1; return; }
    const bpm = A.mode === 'title' ? 66 : A.music.bpm * (1 + A.fever * 0.04);
    const st = 60 / bpm / 4;
    if (A.next < c.currentTime) A.next = c.currentTime + 0.05;
    while (A.next < c.currentTime + 0.25) {
      const s = A.step % 32, at = A.next, bar = Math.floor(A.step / 16) % 4;
      const prog = [0, 3, 4, 2][bar];
      if (s % 16 === 0) { tone(mtof(deg(prog, -1)), st * 15, 'triangle', 0.07, { at, a: 0.05, bus: musBus, lp: 600 }); }
      if (s === 0) [0, 2, 4].forEach((d) => tone(mtof(deg(prog + d, 0)), st * 30, 'sine', 0.022, { at, a: 0.9, bus: musBus }));
      const pl = A.mode === 'title' ? 0.12 : 0.22 + A.fever * 0.12 + (A.mode === 'boss' ? 0.1 : 0);
      if (s % 2 === 0 && Math.random() < pl) tone(mtof(deg(prog + Math.floor(Math.random() * 7), 1)), st * 2.5, 'triangle', 0.035, { at, bus: musBus, echo: true });
      if (A.mode !== 'title') {
        if (A.fever >= 1 && s % 4 === 2) noise(0.04, 0.025, { type: 'highpass', f: 6000, at, bus: musBus });
        if ((A.fever >= 2 || A.mode === 'boss') && s % 8 === 0) tone(95, 0.18, 'sine', 0.13, { to: 40, at, bus: musBus });
        if (A.mode === 'boss' && s % 16 === 8) tone(mtof(deg(prog, -2)), st * 6, 'sawtooth', 0.04, { at, lp: 300, bus: musBus });
      }
      A.step++; A.next += st;
    }
  }
  return A;
}
