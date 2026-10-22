// DOM overlay screens. Pure view: receives state, calls handlers.
import { cardInfo } from '../logic/upgrades.js';
import { lanternUnlocked, workshopCost, encoreUnlocked } from '../logic/meta.js';
import { dayKey } from '../logic/rng.js';

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const num = (n) => Math.floor(n).toLocaleString('de-CH');
const RAR = { common: 'Gewöhnlich', rare: 'Selten', epic: 'Episch' };

export const HINTS = {
  move: { touch: 'Zieh mit dem Finger irgendwo auf der Bühne, um zu gehen.', keys: 'Gehe mit WASD oder den Pfeiltasten.' },
  shadow: { all: 'Funken verglühen im Schatten. Stell den Baum zwischen dich und sie.' },
  light: { all: 'Schemen verbrennen in deinem Licht. Lass sie ruhig näher kommen.' },
  flare: { touch: '✺ Aufflackern: ein Lichtstoß. Verbrennt Schemen, stößt Funken zurück, löscht Geschosse.', keys: 'Leertaste: Aufflackern. Verbrennt Schemen, stößt Funken zurück, löscht Geschosse.' },
  douse: { touch: '◐ Abdunkeln: Für einen Moment liegt alles um dich im Schatten. Perfekt gegen Funkenschwärme.', keys: 'Shift: Abdunkeln. Für einen Moment liegt alles um dich im Schatten.' },
  wax: { all: 'Sammle Wachs. Jede neue Stufe bringt dir einen Kniff.' },
  cone: { all: 'Die Grubenlampe leuchtet nach vorn. Alles hinter dir liegt im Schatten.' },
};

export function hintText(key, data, device) {
  if (key.startsWith('boss_')) { const d = data.enemies[key.slice(5)]; return d ? `${d.name}: ${d.desc}` : ''; }
  if (key.startsWith('new_')) { const d = data.enemies[key.slice(4)]; return d ? `Neu im Ensemble: ${d.name}. ${d.desc}` : ''; }
  const h = HINTS[key]; if (!h) return '';
  return h.all || (device === 'touch' ? h.touch : h.keys);
}

const ICONS = {
  shadow: '<svg viewBox="0 0 120 70" aria-hidden="true"><circle cx="18" cy="35" r="7" fill="#ffd27a"/><circle cx="18" cy="35" r="16" fill="#ffd27a" opacity=".25"/><circle cx="52" cy="35" r="11" fill="#07060f" stroke="#ffcf87" stroke-width="2"/><path d="M52 24 L118 10 L118 60 L52 46Z" fill="#2f2453" opacity=".9"/><circle cx="92" cy="35" r="5" fill="#fff3c4"/><circle cx="92" cy="35" r="10" fill="#ffd36b" opacity=".35"/></svg>',
  light: '<svg viewBox="0 0 120 70" aria-hidden="true"><circle cx="18" cy="35" r="7" fill="#ffd27a"/><path d="M18 35 L118 5 L118 65Z" fill="#ffcf87" opacity=".22"/><circle cx="80" cy="35" r="10" fill="#140f24" stroke="#ff9a3c" stroke-width="2"/><circle cx="77" cy="33" r="2" fill="#ece6ff"/><circle cx="83" cy="33" r="2" fill="#ece6ff"/></svg>',
  flip: '<svg viewBox="0 0 120 70" aria-hidden="true"><rect x="0" y="0" width="60" height="70" fill="#ffcf87" opacity=".18"/><rect x="60" y="0" width="60" height="70" fill="#2f2453"/><circle cx="60" cy="35" r="12" fill="#ece6ff"/><path d="M60 23 A12 12 0 0 1 60 47Z" fill="#120d22"/><path d="M40 58 C52 66 68 66 80 58" stroke="#c9b8ff" fill="none" stroke-width="2"/></svg>',
};

export function createScreens(root, H) {
  let cur = null, payload = null;

  function render(name, p) {
    cur = name; payload = p;
    root.className = 'screen-' + name;
    root.innerHTML = name ? (VIEWS[name] ? VIEWS[name](p) : '') : '';
    root.hidden = !name;
    const first = root.querySelector('[data-focus]') || root.querySelector('button:not([disabled])');
    if (first && H.focusable()) first.focus({ preventScroll: true });
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    H.click();
    H.action(b.dataset.act, b.dataset.arg, b);
  });
  root.addEventListener('input', (e) => { if (e.target.dataset.set) H.action('set', e.target.dataset.set, e.target); });

  const VIEWS = {
    title(p) {
      const { meta, data } = p;
      const enc = encoreUnlocked(meta);
      const daily = meta.stats.dailyKey === dayKey() ? `Bestwert heute: ${num(meta.stats.dailyBest)}` : 'Ein Seed für alle, jeden Tag neu';
      return `<div class="title-wrap">
        <h1 class="title" aria-label="Lampenfieber"><span>Lampenfieber</span></h1>
        <p class="tagline">Ein Schattentheater in fünf Akten</p>
        <nav class="menu">
          <button class="primary" data-act="play" data-focus>Vorstellung beginnen</button>
          <button data-act="daily">Tagesvorstellung<small>${esc(daily)}</small></button>
          <button data-act="encore" ${enc ? '' : 'disabled'}>Zugabe<small>${enc ? `Endlos, Rekord ${fmtT(meta.stats.encoreBest)}` : 'Nach dem ersten Sieg'}</small></button>
          <div class="row2">
            <button data-act="nav" data-arg="workshop">Werkstatt<small>${num(meta.glut)} Glut</small></button>
            <button data-act="nav" data-arg="achievements">Erfolge<small>${Object.keys(meta.ach).length}/${Object.keys(data.achievements).length}</small></button>
            <button data-act="nav" data-arg="stats">Programmheft</button>
            <button data-act="nav" data-arg="howto">Anleitung</button>
          </div>
          <button class="ghost" data-act="nav" data-arg="settings">Einstellungen</button>
        </nav>
      </div>`;
    },
    select(p) {
      const { meta, data, mode } = p;
      const sel = p.lantern;
      const cards = Object.keys(data.lanterns).map((id) => {
        const l = data.lanterns[id], ok = lanternUnlocked(meta, data, id);
        const lock = l.unlock ? data.achievements[l.unlock] : null;
        return `<button class="lantern ${sel === id ? 'on' : ''}" data-act="lantern" data-arg="${id}" ${ok ? '' : 'disabled'} style="--lc:${l.col}">
          <span class="lname">${esc(l.name)}</span>
          <span class="ldesc">${ok ? esc(l.desc) : `Gesperrt: ${esc(lock.desc)}`}</span></button>`;
      }).join('');
      let grades = '';
      if (mode !== 'daily' && meta.maxGrade > 0) {
        grades = `<div class="grades" role="radiogroup" aria-label="Fiebergrad">` + data.acts.grades.slice(0, meta.maxGrade + 1).map((g, i) =>
          `<button role="radio" aria-checked="${p.grade === i}" class="${p.grade === i ? 'on' : ''}" data-act="grade" data-arg="${i}">${i === 0 ? 'Premiere' : ROMAN[i - 1]}</button>`).join('') + `</div>
          <p class="fine">${p.grade ? `Gegner zäher, schneller, zahlreicher. Glut ×${data.acts.grades[p.grade].glut}` : 'Normale Schwierigkeit'}</p>`;
      }
      return `<div class="panel wide">
        <h2>${mode === 'encore' ? 'Zugabe' : 'Wähle deine Laterne'}</h2>
        <div class="lanterns">${cards}</div>${grades}
        <div class="actions"><button class="ghost" data-act="back">Zurück</button><button class="primary" data-act="start" data-focus>Vorhang auf</button></div>
      </div>`;
    },
    levelup(p) {
      const { run, data } = p;
      const cards = run.choices.map((id, i) => {
        const c = cardInfo(data, id), have = run.stacks[id] || 0;
        return `<button class="card rar-${c.rar}" data-act="choose" data-arg="${i}" ${i === 0 ? 'data-focus' : ''}>
          <span class="cicon">${esc(c.icon)}</span><span class="cname">${esc(c.name)}</span>
          <span class="crar">${RAR[c.rar]}${c.max < 99 ? `, ${have}/${c.max}` : ''}</span>
          <span class="cdesc">${esc(c.desc)}</span><kbd>${i + 1}</kbd></button>`;
      }).join('');
      return `<div class="panel cards-wrap"><h2>Stufe ${run.level}: Ein neuer Kniff</h2><div class="cards">${cards}</div>
        <div class="actions center"><button class="ghost" data-act="reroll" ${run.rerolls > 0 ? '' : 'disabled'}>Neu ziehen (${run.rerolls})</button></div></div>`;
    },
    pause(p) {
      const { run, data } = p;
      const kn = Object.keys(run.stacks).map((id) => `<li><span class="kicon">${esc(data.upgrades[id].icon)}</span>${esc(data.upgrades[id].name)} <b>${run.stacks[id]}</b></li>`).join('') || '<li class="fine">Noch keine Kniffe</li>';
      return `<div class="panel"><h2>Pause</h2>
        <p class="fine">${esc(run.act.sub)}, ${esc(run.act.name)}. Zeit ${fmtT(run.t)}, Siege ${run.kills}</p>
        <ul class="kniffe">${kn}</ul>
        <nav class="menu"><button class="primary" data-act="resume" data-focus>Weiterspielen</button>
        <button data-act="nav" data-arg="howto">Anleitung</button>
        <button data-act="nav" data-arg="settings">Einstellungen</button>
        <button class="ghost danger" data-act="abandon">Vorstellung abbrechen</button></nav></div>`;
    },
    interlude(p) {
      const { run, data } = p;
      const next = data.acts.acts[run.actIdx + 1];
      return `<div class="panel interlude"><p class="fine">Vorhang für</p><h2>${esc(run.act.name)}</h2>
        <dl class="kv"><dt>Zeit</dt><dd>${fmtT(run.t)}</dd><dt>Siege</dt><dd>${run.kills}</dd><dt>Punkte</dt><dd>${num(run.score)}</dd><dt>Treffer in diesem Akt</dt><dd>${run.hitsAct === 0 ? 'keiner, +800' : run.hitsAct}</dd></dl>
        <p class="next">Als Nächstes: <b>${esc(next.sub)}, ${esc(next.name)}</b></p><p class="fine">Deine Flamme erholt sich etwas.</p>
        <div class="actions center"><button class="primary" data-act="nextact" data-focus>Weiter</button></div></div>`;
    },
    over(p) {
      const { sum, res, data, best } = p;
      const ach = res.newAch.map((id) => `<li><b>${esc(data.achievements[id].name)}</b> ${esc(data.achievements[id].desc)}${data.achievements[id].unlock ? `<br><span class="fine">Freigeschaltet: ${esc(data.achievements[id].unlock)}</span>` : ''}</li>`).join('');
      const killer = sum.killedBy ? (data.enemies[sum.killedBy]?.name || ({ lichtkugel: 'eine Lichtkugel', schattenkugel: 'eine Schattenkugel', uhrwerk: 'der Uhrwerkleuchter', aufgegeben: 'Abbruch' })[sum.killedBy] || sum.killedBy) : '';
      const head = sum.won ? 'Standing Ovations' : 'Der Vorhang fällt';
      return `<div class="panel over ${sum.won ? 'won' : ''}"><h2>${head}</h2>
        <p class="score">${num(sum.score)}${res.isNewBest ? '<span class="badge">Neuer Rekord</span>' : ''}</p>
        <dl class="kv"><dt>${sum.mode === 'encore' ? 'Überlebt' : 'Akt'}</dt><dd>${sum.mode === 'encore' ? fmtT(sum.time) : sum.won ? 'alle fünf' : `${ROMAN[sum.act - 1]}, ${esc(data.acts.acts[sum.act - 1].name)}`}</dd>
        <dt>Siege</dt><dd>${sum.kills} <span class="fine">(${sum.killsShadow} im Schatten, ${sum.killsLight} im Licht)</span></dd>
        <dt>Stufe</dt><dd>${sum.level}</dd><dt>Zeit</dt><dd>${fmtT(sum.time)}</dd>
        ${killer && !sum.won ? `<dt>Gelöscht von</dt><dd>${esc(killer)}</dd>` : ''}
        <dt>Glut</dt><dd>+${res.glut}</dd></dl>
        ${res.gradeUp ? `<p class="unlock">Fiebergrad ${ROMAN[best.maxGrade - 1]} freigeschaltet.</p>` : ''}
        ${ach ? `<h3>Neue Erfolge</h3><ul class="achlist">${ach}</ul>` : ''}
        <div class="actions"><button class="ghost" data-act="totitle">Zum Titel</button><button data-act="toselect">Laterne wählen</button><button class="primary" data-act="again" data-focus>Noch einmal</button></div></div>`;
    },
    workshop(p) {
      const { meta, data } = p;
      const items = Object.keys(data.workshop).map((id) => {
        const w = data.workshop[id], lv = meta.workshop[id] || 0, cost = workshopCost(data, meta, id);
        const pips = w.cost.length > 1 ? `<span class="pips">${w.cost.map((_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</span>` : '';
        return `<li class="${cost === null ? 'maxed' : ''}"><div><b>${esc(w.name)}</b>${pips}<span class="fine">${esc(w.desc)}</span></div>
          <button data-act="buy" data-arg="${id}" ${cost === null || meta.glut < cost ? 'disabled' : ''}>${cost === null ? 'Fertig' : `${num(cost)} Glut`}</button></li>`;
      }).join('');
      return `<div class="panel wide"><h2>Werkstatt</h2><p class="glut">${num(meta.glut)} Glut</p><p class="fine">Glut bekommst du am Ende jeder Vorstellung, für Bosse, Erfolge und goldene Gegner.</p>
        <ul class="shop">${items}</ul><div class="actions"><button class="ghost" data-act="back" data-focus>Zurück</button></div></div>`;
    },
    achievements(p) {
      const { meta, data } = p;
      const items = Object.keys(data.achievements).map((id) => { const a = data.achievements[id], ok = !!meta.ach[id];
        return `<li class="${ok ? 'ok' : ''}"><b>${esc(a.name)}</b><span>${esc(a.desc)}</span><span class="fine">${ok ? 'Erreicht' : `+${a.glut} Glut`}${a.unlock ? `, schaltet frei: ${esc(a.unlock)}` : ''}</span></li>`; }).join('');
      return `<div class="panel wide"><h2>Erfolge</h2><ul class="achgrid">${items}</ul><div class="actions"><button class="ghost" data-act="back" data-focus>Zurück</button></div></div>`;
    },
    stats(p) {
      const { meta, data } = p, s = meta.stats;
      const hs = meta.highscores.map((h, i) => `<tr><td>${i + 1}</td><td>${num(h.score)}</td><td>${esc(data.lanterns[h.lantern]?.name || h.lantern)}</td><td>${h.mode === 'encore' ? 'Zugabe' : h.won ? 'Sieg' : `Akt ${ROMAN[h.act - 1] || h.act}`}${h.grade ? ` (Grad ${h.grade})` : ''}${h.mode === 'daily' ? ', Tag' : ''}</td><td>${esc(h.date)}</td></tr>`).join('') || '<tr><td colspan="5" class="fine">Noch keine Vorstellung gespielt.</td></tr>';
      const best = Object.keys(data.enemies).map((id) => { const e = data.enemies[id], seen = !!meta.seen[id];
        return `<li class="${seen ? '' : 'unseen'} pol-${e.pol}"><b>${seen ? esc(e.name) : 'Unbekannt'}</b><span class="fine">${seen ? esc(e.desc) : 'Noch nicht aufgetreten.'}</span><span class="cnt">${s.killsBy[id] || 0}</span></li>`; }).join('');
      return `<div class="panel wide"><h2>Programmheft</h2>
        <dl class="kv cols"><dt>Vorstellungen</dt><dd>${s.runs}</dd><dt>Siege</dt><dd>${s.wins}</dd><dt>Bester Wert</dt><dd>${num(s.bestScore)}</dd><dt>Spielzeit</dt><dd>${fmtT(s.time)}</dd>
        <dt>Gegner gelöscht</dt><dd>${num(s.kills)}</dd><dt>davon im Schatten</dt><dd>${num(s.killsShadow)}</dd><dt>davon im Licht</dt><dd>${num(s.killsLight)}</dd><dt>Zugabe-Rekord</dt><dd>${fmtT(s.encoreBest)}</dd></dl>
        <h3>Bestenliste</h3><div class="scroll"><table class="hs"><thead><tr><th>#</th><th>Punkte</th><th>Laterne</th><th>Ende</th><th>Datum</th></tr></thead><tbody>${hs}</tbody></table></div>
        <h3>Ensemble</h3><ul class="bestiary">${best}</ul>
        <div class="actions"><button class="ghost" data-act="back" data-focus>Zurück</button></div></div>`;
    },
    settings(p) {
      const s = p.meta.settings;
      const tg = (k, label) => `<label class="tog"><span>${label}</span><input type="checkbox" data-set="${k}" ${s[k] ? 'checked' : ''}></label>`;
      return `<div class="panel"><h2>Einstellungen</h2>
        ${tg('sfx', 'Soundeffekte')}${tg('music', 'Musik')}
        <label class="tog"><span>Lautstärke</span><input type="range" min="0" max="1" step="0.05" value="${s.vol}" data-set="vol"></label>
        ${tg('shake', 'Bildschirmwackeln')}${tg('flash', 'Blitze bei Treffern')}${tg('hints', 'Hinweise anzeigen')}
        <label class="tog"><span>Partikel</span><select data-set="fx"><option value="hoch" ${s.fx === 'hoch' ? 'selected' : ''}>Viele</option><option value="niedrig" ${s.fx === 'niedrig' ? 'selected' : ''}>Wenige (schneller)</option></select></label>
        <label class="tog"><span>Knöpfe auf der</span><select data-set="hand"><option value="rechts" ${s.hand === 'rechts' ? 'selected' : ''}>rechten Seite</option><option value="links" ${s.hand === 'links' ? 'selected' : ''}>linken Seite</option></select></label>
        <div class="actions"><button class="ghost danger" data-act="wipe">Spielstand löschen</button><button class="primary" data-act="back" data-focus>Fertig</button></div></div>`;
    },
    howto() {
      return `<div class="panel wide howto"><h2>Anleitung</h2>
        <p>Du trägst eine Laterne und hast keine Waffe. Deine Gegner besiegst du mit Licht und Schatten.</p>
        <div class="rule">${ICONS.shadow}<p><b>Funken</b> sind Lichtwesen. Sie verglühen, solange sie im Schatten eines Hindernisses stehen. Stell Bäume, Steine und Zahnräder zwischen dich und sie.</p></div>
        <div class="rule">${ICONS.light}<p><b>Schemen</b> sind Schattenwesen. Sie verbrennen in deinem Licht, je näher sie dir kommen, desto schneller.</p></div>
        <div class="rule">${ICONS.flip}<p><b>Wechselbälger</b> nehmen nur Schaden, wenn sie zwischen Licht und Schatten wechseln.</p></div>
        <p><b>Aufflackern</b> (Leertaste oder ✺) ist ein Lichtstoß: verbrennt Schemen, stößt Funken zurück, löscht Geschosse. <b>Abdunkeln</b> (Shift oder ◐) macht für einen Moment alles um dich zu Schatten.</p>
        <p>Deine <b>Flamme</b> ist Leben und Lichtradius zugleich. Wer verletzt ist, hat eine kleinere Bühne. Schnelle Siege heizen das <b>Fieber</b> an: mehr Licht, mehr Schaden, höherer Punkte-Multiplikator. Treffer kühlen es ab.</p>
        <p>Wachs bringt Stufen, jede Stufe einen Kniff. Glut aus jeder Vorstellung investierst du in der Werkstatt.</p>
        <p class="fine">Steuerung: WASD oder Pfeile, Leertaste, Shift, Esc für Pause. Gamepad: Stick, A, B, Start. Touch: irgendwo ziehen zum Gehen, Knöpfe für die Fähigkeiten.</p>
        <div class="actions"><button class="primary" data-act="back" data-focus>Verstanden</button></div></div>`;
    },
  };

  return { show: render, get current() { return cur; }, refresh() { render(cur, payload); }, root };
}
