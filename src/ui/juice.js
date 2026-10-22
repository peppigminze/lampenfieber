// Maps logic events to particles, shake, hitstop and sounds.
import { hexRgb } from './render.js';
const ROMAN = ['I', 'II', 'III'];

export function handleEvents(run, evs, fx, au, hooks) {
  const p = run.p;
  for (const e of evs) {
    switch (e.type) {
      case 'flare':
        fx.ring(e.x, e.y, 18, e.r, 0.5, '255,226,170', 7); fx.ring(e.x, e.y, 10, e.r * 0.7, 0.35, '255,255,240', 3);
        fx.burst('shard', e.x, e.y, 22, { speed: e.r * 2.2, life: 0.4, size: 4, col: '255,230,170', drag: 5, add: true });
        fx.shake(0.25); fx.flash('255,230,170', 0.25); au.sfx('flare'); break;
      case 'douse':
        fx.ring(e.x, e.y, e.r, 8, 0.4, '150,120,255', 6, false);
        fx.burst('ink', e.x, e.y, 18, { speed: e.r, life: 0.5, size: 6, col: '30,18,56', drag: 4 });
        fx.shake(0.18); au.sfx('douse'); break;
      case 'douseEnd': au.sfx('douseEnd'); if (e.kills >= 4) fx.text(e.x, e.y - 30, `${e.kills} im Dunkeln`, '200,180,255', 15); break;
      case 'kill': {
        const big = e.boss ? 3 : e.elite ? 1.8 : 1;
        if (e.pol === 'L' || (e.pol === 'X' && Math.random() < 0.5)) {
          const col = hexRgb(run.data.enemies[e.id].col);
          fx.burst('spark', e.x, e.y, Math.round(10 * big), { speed: 110 * big, life: 0.6, size: 3, col });
          fx.burst('smoke', e.x, e.y, 3, { speed: 20, life: 0.9, size: 6, col: '60,50,80', vy: -20 });
          au.sfx('killL');
        } else {
          fx.burst('ink', e.x, e.y, Math.round(10 * big), { speed: 90 * big, life: 0.55, size: e.r * 0.45, col: '16,10,30' });
          fx.burst('ember', e.x, e.y, Math.round(5 * big), { speed: 60, life: 0.8, size: 2.5, col: '255,150,70', vy: -40 });
          au.sfx('killS');
        }
        if (e.elite) { fx.ring(e.x, e.y, 6, 60, 0.5, '255,215,120', 3); fx.text(e.x, e.y - 18, '+4 Glut', '255,215,120', 14); fx.shake(0.15); }
        break;
      }
      case 'hurt': fx.shake(0.45); fx.flash('255,60,60', 0.7); fx.hitstop(0.05); au.sfx('hurt'); fx.burst('spark', e.x, e.y, 10, { speed: 140, life: 0.4, size: 3, col: '255,90,70' }); break;
      case 'pickup': au.sfx('pickup', { n: e.n }); if (Math.random() < 0.4) fx.emit('spark', e.x, e.y, { speed: 30, life: 0.3, size: 2, col: '255,220,150' }); break;
      case 'levelup': au.sfx('levelup'); fx.ring(p.x, p.y, 10, 90, 0.6, '201,184,255', 4); hooks.levelup && hooks.levelup(e); break;
      case 'pick': au.sfx('pick'); break;
      case 'boss': au.sfx('boss'); fx.shake(0.5); hooks.banner && hooks.banner(run.data.enemies[e.id].name, 'tritt auf'); break;
      case 'bossdead':
        fx.hitstop(0.14); fx.slowmo(0.3, 1.3); fx.shake(1); fx.flash('255,255,255', 0.8); au.sfx('bossdead');
        fx.ring(e.x, e.y, 20, 420, 1.1, '255,230,190', 9); fx.burst('spark', e.x, e.y, 70, { speed: 320, life: 1.3, size: 4, col: '255,220,160' });
        fx.burst('ink', e.x, e.y, 30, { speed: 220, life: 1, size: 9, col: '20,12,36' }); break;
      case 'actclear': au.sfx('clear'); hooks.actclear && hooks.actclear(e); break;
      case 'win': au.sfx('win'); hooks.win && hooks.win(); break;
      case 'gameover': au.sfx('gameover'); fx.shake(0.8); fx.slowmo(0.25, 1); hooks.gameover && hooks.gameover(e); break;
      case 'shoot': au.sfx('shoot'); break;
      case 'charge': au.sfx('charge'); break;
      case 'blink': fx.burst('spark', e.x0, e.y0, 6, { speed: 60, life: 0.4, size: 2, col: '190,232,255' }); fx.burst('spark', e.x, e.y, 6, { speed: 60, life: 0.4, size: 2, col: '190,232,255' }); au.sfx('blink'); break;
      case 'flip': fx.ring(e.x, e.y, 4, e.boss ? 60 : 28, 0.3, '220,210,255', 2); au.sfx('flip'); break;
      case 'fever': au.sfx('fever', { tier: e.tier }); au.setFever(e.tier); fx.text(p.x, p.y - 36, `Fieber ${ROMAN[e.tier - 1]}`, '255,200,120', 18); fx.ring(p.x, p.y, 20, 140, 0.6, '255,190,110', 4); break;
      case 'puddle': au.sfx('puddle'); break;
      case 'menhir': au.sfx('menhir'); fx.burst('smoke', e.x, e.y, 5, { speed: 40, life: 0.6, size: 6, col: '90,80,110' }); break;
      case 'crumble': fx.burst('smoke', e.x, e.y, 6, { speed: 30, life: 0.7, size: 7, col: '90,80,110' }); break;
      case 'revive': au.sfx('revive'); fx.ring(e.x, e.y, 10, 300, 0.9, '255,240,200', 8); fx.flash('255,240,200', 0.7); fx.text(e.x, e.y - 40, 'Zweiter Docht', '255,240,200', 18); break;
      case 'fizzle': fx.burst(e.pol === 'L' ? 'spark' : 'ink', e.x, e.y, 4, { speed: 40, life: 0.3, size: 2.5, col: e.pol === 'L' ? '255,230,170' : '40,24,70' }); au.sfx('fizzle'); break;
      case 'pounce': au.sfx('pounce'); break;
      case 'vanish': fx.burst(e.pol === 'S' ? 'ink' : 'spark', e.x, e.y, 5, { speed: 50, life: 0.6, size: 3, col: e.pol === 'S' ? '16,10,30' : '255,220,150' }); break;
      case 'emerge': fx.burst('ink', e.x, e.y, 8, { speed: 70, life: 0.5, size: 5, col: '16,10,30' }); break;
      case 'bossphase': fx.ring(e.x, e.y, 30, 160, 0.6, e.pol === 'L' ? '255,200,110' : '170,120,255', 6); fx.shake(0.3); au.sfx('charge'); break;
      case 'stun': fx.text(e.x, e.y - 40, 'benommen', '236,230,255', 15); break;
      case 'hint': hooks.hint && hooks.hint(e); break;
      case 'act': hooks.act && hooks.act(e); break;
      case 'spawn': if (e.elite) fx.ring(e.x, e.y, 4, 40, 0.5, '255,215,120', 3); break;
      default: break;
    }
  }
}

export function tickJuice(run, fx, dt) {
  const k = Math.min(1, dt * 14);
  for (const e of run.enemies) {
    if (e.hurtT > 0.05 || Math.random() > k) continue;
    if (e.pol === 'L') fx.emit('spark', e.x + (Math.random() - 0.5) * e.r, e.y, { speed: 25, a: -Math.PI / 2, spread: 1.2, life: 0.5, size: 2, col: '180,150,255' });
    else if (e.pol === 'S') { fx.emit('smoke', e.x, e.y - e.r * 0.5, { speed: 18, a: -Math.PI / 2, spread: 1, life: 0.7, size: 4, col: '50,40,60' }); if (Math.random() < 0.5) fx.emit('ember', e.x, e.y, { speed: 40, a: -Math.PI / 2, spread: 1.5, life: 0.5, size: 2, col: '255,150,60' }); }
  }
  if (run.feverTier >= 2 && Math.random() < dt * 10) fx.emit('ember', run.p.x, run.p.y - 6, { speed: 30, a: -Math.PI / 2, spread: 1, life: 0.6, size: 2, col: '255,200,120' });
}
