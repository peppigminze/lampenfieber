# Browser flow test for meta/menus. Usage: python3 tools/flow.py <url> [outdir]
import sys, time, os, json
from playwright.sync_api import sync_playwright
url = sys.argv[1]; out = sys.argv[2] if len(sys.argv) > 2 else '/tmp/flow'
os.makedirs(out, exist_ok=True)
errors = []; checks = []
def ok(name, cond): checks.append((name, bool(cond))); print(('PASS ' if cond else 'FAIL ') + name)
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1100, 'height': 720})
    pg = ctx.new_page()
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    # corrupt save must not break boot
    pg.goto(url); pg.evaluate("localStorage.setItem('lampenfieber.save.v1', '{broken json')"); pg.reload(); pg.wait_for_selector('body.ready')
    ok('boot with corrupt save', pg.evaluate("window.__G.meta.glut === 0"))
    # inject a rich save
    save = {'glut': 2000, 'ach': {'sieg': True, 'akt2': True, 'rabenkoenig': True}, 'maxGrade': 2, 'tutorialDone': True, 'settings': {'music': False}}
    pg.evaluate(f"localStorage.setItem('lampenfieber.save.v1', JSON.stringify({json.dumps(save)}))"); pg.reload(); pg.wait_for_selector('body.ready'); time.sleep(0.5)
    ok('encore unlocked', not pg.is_disabled('button[data-act=encore]'))
    pg.click('#ui >> text=Werkstatt'); time.sleep(0.2)
    pg.click('button[data-arg=flamme]'); time.sleep(0.2)
    ok('workshop buy', pg.evaluate("window.__G.meta.workshop.flamme === 1 && window.__G.meta.glut === 1970"))
    pg.click('button[data-arg=u_doppeldocht]'); ok('card unlock', pg.evaluate("window.__G.meta.cards.includes('doppeldocht')"))
    pg.screenshot(path=f'{out}/workshop.png')
    pg.keyboard.press('Escape'); time.sleep(0.2)
    pg.click('#ui >> text=Einstellungen'); time.sleep(0.2)
    pg.click('input[data-set=shake]'); pg.select_option('select[data-set=hand]', 'links')
    pg.reload(); pg.wait_for_selector('body.ready'); time.sleep(0.3)
    ok('settings persist', pg.evaluate("window.__G.meta.settings.shake === false && window.__G.meta.settings.hand === 'links'"))
    ok('purchase persists', pg.evaluate("window.__G.meta.workshop.flamme === 1"))
    # select screen: lanterns and grades
    pg.click('text=Vorstellung beginnen'); time.sleep(0.2)
    ok('teelicht selectable', not pg.is_disabled('button[data-arg=teelicht]'))
    ok('laterna locked', pg.is_disabled('button[data-arg=laterna]'))
    pg.click('button[data-arg=grubenlampe]'); pg.click('button[data-act=grade][data-arg="2"]'); pg.screenshot(path=f'{out}/select.png')
    pg.click('text=Vorhang auf'); time.sleep(1)
    ok('run with grubenlampe g2', pg.evaluate("window.__G.run.lanternId === 'grubenlampe' && window.__G.run.gradeIdx === 2 && window.__G.run.stats.cone > 0"))
    pg.keyboard.down('KeyD'); time.sleep(1.2); pg.keyboard.up('KeyD')
    pg.screenshot(path=f'{out}/cone.png')
    # force level up
    pg.evaluate("window.__G.run.xp = window.__G.run.xpNext * 3"); time.sleep(0.4)
    ok('levelup screen', pg.evaluate("window.__G.app.screen === 'levelup'"))
    pg.screenshot(path=f'{out}/levelup.png')
    pg.keyboard.press('Digit2'); time.sleep(0.3); pg.keyboard.press('Digit1'); time.sleep(0.3)
    while pg.evaluate("window.__G.app.screen") == 'levelup': pg.keyboard.press('Digit1'); time.sleep(0.25)
    ok('back to run after picks', pg.evaluate("window.__G.app.screen === 'run' && Object.keys(window.__G.run.picks).length >= 1"))
    # force boss + kill -> interlude
    pg.evaluate("(() => { const r = window.__G.run; r.actT = r.act.duration + 0.1; })()"); time.sleep(0.5)
    ok('boss spawned', pg.evaluate("window.__G.run.enemies.some(e => e.boss)"))
    pg.screenshot(path=f'{out}/boss.png')
    pg.evaluate("window.__G.run.enemies.filter(e => e.boss).forEach(e => e.hp = 0)")
    for _ in range(40):
        time.sleep(0.2)
        if pg.evaluate("window.__G.app.screen") == 'interlude': break
    ok('interlude', pg.evaluate("window.__G.app.screen === 'interlude'"))
    pg.screenshot(path=f'{out}/interlude.png')
    pg.click('text=Weiter'); time.sleep(1.2)
    ok('act 2', pg.evaluate("window.__G.run.actIdx === 1 && ['run','levelup'].includes(window.__G.app.screen)"))
    while pg.evaluate("window.__G.app.screen") == 'levelup': pg.keyboard.press('Digit1'); time.sleep(0.25)
    time.sleep(2); pg.screenshot(path=f'{out}/act2.png')
    pg.evaluate("window.__G.run.p.flame = -1; window.__G.run.p.inv = 0"); 
    pg.evaluate("(() => { const r = window.__G.run; const e = r.enemies[0]; if (e) { e.x = r.p.x; e.y = r.p.y; } })()"); time.sleep(3)
    ok('gameover screen', pg.evaluate("window.__G.app.screen === 'over'"))
    pg.screenshot(path=f'{out}/over.png')
    ok('stats recorded', pg.evaluate("window.__G.meta.stats.runs === 1 && window.__G.meta.highscores.length === 1"))
    # daily + encore start
    pg.click('text=Zum Titel'); time.sleep(0.3); pg.click('text=Tagesvorstellung'); time.sleep(0.8)
    ok('daily run', pg.evaluate("window.__G.run.mode === 'daily' && window.__G.run.lanternId === 'oellampe'"))
    pg.keyboard.press('Escape'); time.sleep(0.2); pg.click('text=Vorstellung abbrechen'); time.sleep(2.2); pg.click('text=Zum Titel'); time.sleep(0.3)
    pg.click('button[data-act=encore]'); time.sleep(0.2); pg.click('text=Vorhang auf'); time.sleep(1.5)
    ok('encore run', pg.evaluate("window.__G.run.mode === 'encore'"))
    pg.screenshot(path=f'{out}/encore.png')
    ok('no console errors', not errors)
    b.close()
for e in errors[:10]: print('  ERR', e)
print('RESULT', sum(c for _, c in checks), '/', len(checks))
