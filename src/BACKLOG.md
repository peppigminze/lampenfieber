# BACKLOG

## Ideen für V2
- Spiegel-Kniff: reflektiert Licht als zweiten Strahl (echte Reflexion an Eisschollen im Spiegelsee)
- Prismen-Hindernisse, die Licht in Farben aufteilen und neue Gegnerpolaritäten erzeugen
- Akt-Ereignisse: Sturm (Laterne flackert), Mondfinsternis (Radius halbiert), Feuerwerk
- Weitere Laternen: Kronleuchter (3 kleine Lichtquellen), Scheinwerfer (schmaler, sehr langer Kegel)
- Boss-Varianten pro Fiebergrad, zweite Phase für alle Bosse
- Ghost-Replay der besten Tagesvorstellung
- Lokaler Zwei-Spieler-Modus: zwei Laternen, Schatten des einen trifft die Funken des anderen
- Sprachen: Englisch, Französisch

## Technische Schulden
- Bewegungs-KI nutzt lokale Abtastung statt Pfadsuche; große konkave Hindernisgruppen können Gegner kurz aufhalten
- Laternchen-Aura und Strahlen werden pro Gegner linear geprüft; ab ~200 Gegnern lohnt ein Spatial Hash
- Musik ist generativ, aber ohne Übergänge zwischen Akten (harter Wechsel)
- Bundler unterstützt nur benannte `import { … } from` und `export function/const/class`
- Barrierefreiheit: Spielbühne selbst ist nicht screenreader-tauglich (Menüs schon)

## Bekannte Grenzen
- Headless-Chromium misst nur ~35–45 FPS (Software-Rendering); auf echter Hardware unkritisch, auf sehr alten Handys „Partikel: Wenige“ wählen
- Tagesvorstellung: Arena und Startbedingungen sind für alle gleich, der weitere Verlauf hängt vom Spiel ab
