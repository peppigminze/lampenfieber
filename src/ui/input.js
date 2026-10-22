// Input: keyboard, floating touch joystick, on-screen buttons, gamepad.
export function createInput(canvas) {
  const keys = new Set();
  const I = { flare: false, douse: false, joy: { active: false, id: null, x0: 0, y0: 0, dx: 0, dy: 0 }, enabled: false, onKey: null, lastDevice: 'keys', gpPrev: [] };
  const KM = { KeyW: 'u', ArrowUp: 'u', KeyS: 'd', ArrowDown: 'd', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };

  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    I.lastDevice = 'keys';
    if (KM[e.code]) { keys.add(KM[e.code]); if (I.enabled) e.preventDefault(); }
    if (!e.repeat && I.enabled) {
      if (e.code === 'Space' || e.code === 'KeyJ' || e.code === 'KeyZ') { I.flare = true; e.preventDefault(); }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyK' || e.code === 'KeyX') { I.douse = true; e.preventDefault(); }
    }
    if (I.onKey && !e.repeat) I.onKey(e);
  });
  window.addEventListener('keyup', (e) => { if (KM[e.code]) keys.delete(KM[e.code]); });
  window.addEventListener('blur', () => { keys.clear(); release(); });

  const R = 56;
  function release() { I.joy.active = false; I.joy.id = null; I.joy.dx = I.joy.dy = 0; }
  canvas.addEventListener('pointerdown', (e) => {
    if (!I.enabled || I.joy.active) return;
    I.lastDevice = e.pointerType === 'mouse' ? 'keys' : 'touch';
    I.joy.active = true; I.joy.id = e.pointerId; I.joy.x0 = e.clientX; I.joy.y0 = e.clientY; I.joy.dx = I.joy.dy = 0;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!I.joy.active || e.pointerId !== I.joy.id) return;
    let dx = e.clientX - I.joy.x0, dy = e.clientY - I.joy.y0;
    const d = Math.hypot(dx, dy);
    if (d > R * 1.3) { const k = (d - R * 1.3) / d; I.joy.x0 += dx * k; I.joy.y0 += dy * k; dx = e.clientX - I.joy.x0; dy = e.clientY - I.joy.y0; }
    const m = Math.min(1, Math.hypot(dx, dy) / R), a = Math.atan2(dy, dx);
    const dz = m < 0.12 ? 0 : (m - 0.12) / 0.88;
    I.joy.dx = Math.cos(a) * dz; I.joy.dy = Math.sin(a) * dz;
  });
  const up = (e) => { if (e.pointerId === I.joy.id) release(); };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('lostpointercapture', up);

  I.bindButton = (el, which) => {
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (I.enabled) { I[which] = true; I.lastDevice = 'touch'; } });
  };

  function pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp) continue;
      const b = gp.buttons.map((x) => x.pressed);
      const edge = (i) => b[i] && !I.gpPrev[i];
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      const out = { mx: Math.abs(ax) > 0.18 ? ax : 0, my: Math.abs(ay) > 0.18 ? ay : 0 };
      if (b[14]) out.mx = -1; if (b[15]) out.mx = 1; if (b[12]) out.my = -1; if (b[13]) out.my = 1;
      if (I.enabled) { if (edge(0) || edge(5) || edge(7)) I.flare = true; if (edge(1) || edge(4) || edge(6)) I.douse = true; }
      if (I.onPad) for (const i of [0, 1, 9, 12, 13, 14, 15]) if (edge(i)) I.onPad(i);
      I.gpPrev = b;
      if (out.mx || out.my || b.some(Boolean)) I.lastDevice = 'pad';
      return out;
    }
    return null;
  }

  I.read = () => {
    let mx = 0, my = 0;
    if (keys.has('l')) mx -= 1; if (keys.has('r')) mx += 1; if (keys.has('u')) my -= 1; if (keys.has('d')) my += 1;
    if (mx && my) { mx *= Math.SQRT1_2; my *= Math.SQRT1_2; }
    if (I.joy.active) { mx = I.joy.dx; my = I.joy.dy; }
    const gp = pollPad();
    if (gp && (gp.mx || gp.my)) { mx = gp.mx; my = gp.my; }
    const out = { mx, my, flare: I.flare, douse: I.douse };
    I.flare = false; I.douse = false;
    return out;
  };
  I.pollMenu = () => pollPad();
  I.reset = () => { keys.clear(); release(); I.flare = I.douse = false; };
  return I;
}
