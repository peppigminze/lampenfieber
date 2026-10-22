# Browser smoke test (Playwright/Chromium). Usage: python3 tools/smoke.py <url> [outdir] [mobile]
import sys, time, os
from playwright.sync_api import sync_playwright
url = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/index.html'
out = sys.argv[2] if len(sys.argv) > 2 else '/tmp/shots'
mobile = len(sys.argv) > 3 and sys.argv[3] == 'mobile'
os.makedirs(out, exist_ok=True)
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 760}, device_scale_factor=2 if mobile else 1, has_touch=mobile, is_mobile=mobile)
    pg = ctx.new_page()
    pg.on('console', lambda m: errors.append('console.' + m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    t0 = time.time(); pg.goto(url); pg.wait_for_selector('body.ready', timeout=10000)
    print('load ms', int((time.time() - t0) * 1000))
    time.sleep(1.5); pg.screenshot(path=f'{out}/1_title.png')
    pg.click('text=Vorstellung beginnen'); time.sleep(0.3); pg.screenshot(path=f'{out}/2_select.png')
    pg.click('text=Vorhang auf'); time.sleep(1.2)
    seq = [('KeyD', 1.2), ('KeyS', 0.8), ('KeyA', 1.5), ('KeyW', 1.0)]
    for i in range(6):
        for k, d in seq:
            pg.keyboard.down(k); time.sleep(d / 3); 
            if i % 2 == 0: pg.keyboard.press('Space')
            else: pg.keyboard.press('ShiftLeft')
            time.sleep(d / 3); pg.keyboard.up(k)
            st = pg.evaluate('window.__G.app.screen')
            if st == 'levelup': pg.screenshot(path=f'{out}/4_levelup.png'); pg.keyboard.press('Digit1'); time.sleep(0.2)
        if i == 2: pg.screenshot(path=f'{out}/3_run.png')
    pg.screenshot(path=f'{out}/5_run.png')
    info = pg.evaluate('(() => { const r = window.__G.run; return { screen: window.__G.app.screen, t: r && r.t, enemies: r && r.enemies.length, kills: r && r.kills, level: r && r.level, flame: r && r.p.flame, act: r && r.actIdx, fps: 0 }; })()')
    print('state', info)
    pg.keyboard.press('Escape'); time.sleep(0.3); pg.screenshot(path=f'{out}/6_pause.png')
    print('pause screen', pg.evaluate('window.__G.app.screen'))
    pg.click('text=Vorstellung abbrechen'); time.sleep(2.2); pg.screenshot(path=f'{out}/7_over.png')
    print('over screen', pg.evaluate('window.__G.app.screen'))
    for name in ['Zum Titel']:
        pg.click(f'text={name}'); time.sleep(0.4)
    for nav in ['Werkstatt', 'Erfolge', 'Programmheft', 'Anleitung', 'Einstellungen']:
        pg.click(f'#ui >> text={nav}'); time.sleep(0.3); pg.screenshot(path=f'{out}/8_{nav}.png'); pg.keyboard.press('Escape'); time.sleep(0.2)
    fps = pg.evaluate('new Promise(r => { let n = 0; const s = performance.now(); function f(){ n++; if (performance.now() - s < 1000) requestAnimationFrame(f); else r(n); } requestAnimationFrame(f); })')
    print('fps(title)', fps)
    b.close()
print('ERRORS', len(errors))
for e in errors[:20]: print(' ', e)
