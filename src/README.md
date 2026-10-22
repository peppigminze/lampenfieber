# Lampenfieber

Ein Schattentheater in fünf Akten. Top-down-Action-Roguelite für den Browser, ohne Framework, ohne Server, ohne externe Dateien.

## Spielidee
Du trägst eine Laterne und hast **keine Waffe**. Schaden entsteht nur durch Geometrie: Hindernisse werfen echte Schatten deiner Laterne.

- **Funken** (Lichtwesen) verglühen, solange sie im Schatten stehen. Stell Bäume, Grabsteine oder Zahnräder zwischen dich und sie.
- **Schemen** (Schattenwesen) verbrennen in deinem Licht, je näher, desto schneller.
- **Wechselbälger** nehmen nur Schaden, wenn sie zwischen Licht und Schatten *wechseln*.
- **Aufflackern** (Leertaste / ✺): Lichtstoß. Verbrennt Schemen, stößt Funken zurück, löscht Geschosse.
- **Abdunkeln** (Shift / ◐): Laterne kurz aus, alles in deinem Radius wird Schatten.
- **Flamme** = Leben *und* Lichtradius. Verletzt hast du eine kleinere Bühne.
- **Fieber**: Schnelle Siege heizen ein (mehr Licht, +Schaden, Punkte ×3). Treffer kühlen ab.
- **Wachs** bringt Stufen, jede Stufe einen **Kniff** (26 Karten, u. a. umkreisende Mondsteine, die als rotierende Schattenklingen wirken).
- **Glut** aus jeder Vorstellung gibst du in der **Werkstatt** aus (13 permanente Upgrades und Kartenfreischaltungen).

## Inhalt
- 5 Akte mit eigenem Hindernistyp: Kerzenwald (Bäume), Rabenacker (Grabsteine), Uhrwerkhalle (kreisende Zahnräder), Spiegelsee (treibende Eisschollen), Sonnenkammer (zerfallende Säulen)
- 12 Gegnertypen + 5 Bosse, goldene Elite-Varianten
- 5 Laternen (u. a. Grubenlampe mit Lichtkegel: alles hinter dir ist Schatten)
- Modi: Vorstellung (5 Akte), Tagesvorstellung (täglicher Seed), Zugabe (endlos, nach dem ersten Sieg), Fiebergrade 1–5
- 16 Erfolge, Programmheft mit Statistik, Bestenliste und Ensemble (Bestiarium)
- Tutorial in den ersten 60 Sekunden, kontextuelle Hinweise bei neuen Gegnern
- Einstellungen: Sound, Musik, Lautstärke, Wackeln, Blitze, Partikel, Hinweise, Knöpfe links/rechts

## Steuerung
| | Tastatur | Touch | Gamepad |
|---|---|---|---|
| Gehen | WASD / Pfeile | irgendwo ziehen | linker Stick / Steuerkreuz |
| Aufflackern | Leertaste, J | ✺ | A, RB, RT |
| Abdunkeln | Shift, K | ◐ | B, LB, LT |
| Pause | Esc, P | ❚❚ | Start |
| Karte wählen | 1, 2, 3 (R = neu ziehen) | antippen | Steuerkreuz + A |

## Projektstruktur
```
data/    JSON-Inhalte (Gegner, Akte, Kniffe, Laternen, Werkstatt, Erfolge)
logic/   reine Spiellogik ohne DOM (Run-Simulation, Licht/Schatten, KI, Director, Meta, Screen-FSM, Bot)
ui/      Canvas-Renderer, Partikel/Juice, WebAudio-Synth, Eingabe, DOM-Menüs, Speicher
main.js  Verdrahtung und Game-Loop (fester 60-Hz-Takt)
tests/   Logik-Tests und Balance-Simulator
tools/   Bundler, Browser-Smoke- und Flow-Tests
dist/    gebündelte, eigenständige index.html
```

## Befehle
```
node tests/test_logic.mjs        # Logik-Tests
node tests/sim.mjs 24 20         # Balance-Simulation (24 Runs je Konfiguration, 20 Hz)
node tools/bundle.mjs            # -> dist/index.html (eine Datei, alles inline)
python3 tools/smoke.py <url>     # Browser-Smoke-Test (Playwright)
python3 tools/flow.py <url>      # Menü-/Meta-/Modus-Flow-Test
```
Entwicklungsversion: `python3 -m http.server` im Projektordner, dann `http://localhost:8000` (ES-Module brauchen einen Server).
Die Datei `dist/index.html` läuft auch direkt per Doppelklick.

## GitHub Pages
`dist/index.html` als `index.html` ins Repo-Root legen, pushen, unter *Settings → Pages* „Deploy from branch: main / root“ wählen.
