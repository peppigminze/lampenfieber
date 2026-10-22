# PLAN / Fortschrittsprotokoll

- [x] M1 Fundament: Struktur, Datenschema, RNG, Geometrie, Licht-/Schatten-Kern, Tests
- [x] M2 Kernschleife: Run-Logik (Spieler, Gegner, Schaden, Pickups, Level-Ups, Akte), Tests
- [x] M3 Darstellung & Eingabe: Renderer, Touch/Tastatur/Gamepad, Loop, HUD → spielbar
- [x] M4 Inhalte: alle Gegner/Bosse/Akte/Kniffe, Director, Tutorial, Simulations-Bot v1
- [x] M5 Meta & Menüs: Speicher, Werkstatt, Laternen, Erfolge, Statistik, Einstellungen, Pause, Modi
- [x] M6 Klang & Juice: WebAudio-Synth, Musik, Partikel, Shake, Hitstop, Übergänge
- [x] M7 Balance & Polish: Bot-Läufe, Balance, Code-Review, Edge-Cases, Mobile
- [x] M8 Bundle & Auslieferung: Single-File-Build, Smoke-Test im Browser, ZIP, Live-Link

## Protokoll
- Logik-Tests: 15 Gruppen grün (`node tests/test_logic.mjs`)
- Simulator: 14 Konfigurationen × 24 Runs, Ergebnisse in BALANCE.md; 2 Bugs durch den Simulator gefunden und gefixt
- Browser: Smoke-Test Desktop + Mobile (390×844, Touch) und 19 Flow-Checks gegen dev und gebündelte Datei, 0 Konsolenfehler
- Performance (Headless, 45 Gegner + 3 Mondsteine + Partikel): Simulation ~0,3 ms, Zeichnen ~0,8 ms CPU pro Frame
- Bundle: dist/index.html, ~186 KB, 20 Module + Daten + CSS inline, läuft per file://
