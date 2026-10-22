# BALANCE — Protokoll

Werkzeug: `node tests/sim.mjs [runs] [hz] [filter]`. Bots: `idle` (steht), `random`, `kite` (flieht, ohne Licht-Logik),
`smart` (bewertet 13 Bewegungsrichtungen nach Licht/Schatten-Wirkung, Gefahr, Geschossen, Strahlen; Kartenwahl nach Prioritätsliste).
Meta-Stufen: *fresh* (nichts), *mid* (≈1000 Glut investiert), *full* (alles gekauft + alle Karten).

## Baseline (16 Runs/Konfig, vor Änderungen)
| Konfig | Win | Tod in Akt I | Hauptkiller |
|---|---|---|---|
| idle | 0 % | 100 % (28 s) | Funke |
| kite | 0 % | 100 % | Funke |
| smart-fresh | 0 % | 56 % | Funke (Boss-Phase Akt I) |
| smart-mid | 19 % | 31 % | Uhrwerkleuchter |
| smart-full | 88 % | 0 % | Uhrwerkleuchter |
| teelicht-mid | 0 % | 50 % | Uhrwerkleuchter |

Befunde: Stufenaufstiege zu langsam (Stufe 6–7 nach Akt I), Uhrwerkleuchter dominanter Killer in *allen* Konfigs,
Boss-Phase Akt I zu dicht, Teelicht klar schwächer als Öllampe.

## Änderungen
1. **XP-Kurve** `5+3.4L+L^1.6` → `4+2.2L+L^1.45` (Stufe ~9 nach Akt I, ~26 am Ende bei vollem Meta).
2. **Akt I**: Spawnrate 0.55→0.45/s Start, Kappe 24→22; Funke-Kontaktschaden 8→7; Funken meiden Schatten weniger (0.7→0.45),
   damit Geometrie öfter greift.
3. **Kerzenmutter**: HP 820→700, Kontakt 20→15, beschwört 2 statt 3 Funken (4.5 s statt 4.2 s), Ring 10/14 statt 12/16 Kugeln.
   Nachschub in Boss-Phasen 0.45→0.32 der Grundrate.
4. **Uhrwerkleuchter**: HP 1150→950, Strahlschaden 12→8, Rotation 0.42/0.62→0.36/0.55 rad/s.
   **Strahlen werden jetzt von Hindernissen blockiert** (Raycast) → Deckung hinter Zahnrädern ist echte Gegenstrategie.
5. **Spieler-Basis**: Flamme 100→110, Schattenschaden 32→36, Lichtschaden 30→33.
6. **Akt-Skalierung**: Gegner-HP pro Akt ×1.0 / 1.12 / 1.25 / 1.38 / 1.5 (Bosse ausgenommen).
7. **Fiebergrade** steiler: HP bis ×2.6, Spawn bis ×1.75, Schaden bis ×1.8 (Grad 5).
8. **Meta**: Glut pro Lauf ≈ −35 % (`score/220 + 12/Akt + 8/Boss`), Schatten-/Lichtkunde 8 %→6 % pro Stufe.
9. **Teelicht**: Flamme 75→96, Radius 195→215, Abklingzeiten 4.4 s / 6 s.

## Endstand (24 Runs/Konfig, nach allen Änderungen)
| Konfig | Win | Akt-I-Clear | Ø Stufe | Ø Dauer | Hauptkiller |
|---|---|---|---|---|---|
| idle | 0 % | 0 % | 1.5 | 33 s | Funke |
| random | 0 % | 0 % | 3.4 | 81 s | Funke, Schemen |
| kite | 0 % | 0 % | 5 | 522 s | Funke, Lichtkugel |
| smart-fresh | 8 % | 71 % | 12.2 | 457 s | Funke, Wechselbalg |
| smart-randcards | 8 % | 38 % | 10 | 362 s | Funke, Kerzenmutter |
| smart-mid | 33 % | 79 % | 16.6 | 597 s | Wechselbalg, Kerzenmutter |
| smart-full | 100 % | 100 % | 26.6 | 756 s | – |
| smart-full Grad 3 | 54 % | 96 % | 26 | 741 s | Wechselbalg, Funke |
| smart-full Grad 5 | 12.5 % | 50 % | 14.5 | 359 s | Funke, Kerzenmutter |
| teelicht-mid | 50 % | 75 % | 17.5 | 608 s | Kerzenmutter, Funke |
| grube-mid | 46 % | 100 % | 21 | 699 s | Finsternis, Wechselbalg |
| laterna-mid | 62.5 % | 96 % | 20 | 657 s | Uhrwerk, Glutklumpen |
| irrlicht-mid | 54 % | 83 % | 19.1 | 645 s | Funke, Uhrwerk |
| Zugabe (full) | – | – | 25.2 | 465 s überlebt | Wechselbalg, Brenner |

Lesart:
- Ohne Licht-/Schatten-Positionierung (`kite`) schafft man Akt I nie → die Kernmechanik trägt das Spiel.
- Kartenwahl zählt: Prioritätsliste vs. Zufall = 71 % vs. 38 % Akt-I-Clear.
- Meta-Progression: 8 % → 33 % → 100 % Siegquote; Fiebergrade halten die Spitze offen (Grad 5 ≈ 12 %).
- Alle Laternen liegen im Band 46–62 % (mid) → keine Pflichtwahl; Grubenlampe hat ein klar anderes Risiko-Profil (Bosse von hinten).
- Zugabe: Ø 7:45 min mit vollem Meta, Erfolg „Da capo“ (5 min) ist erreichbar, aber nicht geschenkt.

## Vom Simulator gefundene Bugs
- Absturz, wenn eine Kugel den „Zweiten Docht“ auslöst (Wiederbelebung leert die Kugel-Liste während der Iteration).
  Gefixt in `updateProj`, Regressionstest `revive by projectile does not crash`.
- Level-up während des Akt-Vorhangs blockierte die Pause zwischen den Akten. Level-ups werden jetzt nach dem Akt-Wechsel angeboten.
