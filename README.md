# Jul Shot

Ein Weltraum-Shooter im Browser (HTML5 Canvas, kein Build nötig). `index.html` öffnen – fertig.

## Steuerung
| Eingabe | Aktion |
|---|---|
| W A S D | Fliegen |
| Maus | Zielen |
| Linksklick / Leertaste | Schießen |
| Q / Rechtsklick | Ultimate (alle 20 Sek.) |
| F / M / P | Auto-Feuer / Ton / Pause |
| 1–8 | Upgrade wählen |
| Gamepad | Linker Stick fliegen, rechter Stick zielen+schießen, B/LB/RB Ultimate, Start Pause |
| Touch | Linke Bildschirmhälfte fliegen, rechte zielen+schießen, ULT-Knopf |

## Modi
- **Endlos** – Wellen und Bosse; nach einem kompletten Boss-Durchlauf kommt pro Boss ein zufälliger Modifikator dazu (Dunkelheit, Splitter, schnelle Geschosse, …).
- **Boss Rush** – ein Boss nach dem anderen.
- **Täglich** – gleiche Upgrade-Angebote und Wellen für alle am selben Tag, eigenes Scoreboard.

## Ablauf
- Zu Beginn und nach jedem Boss: 5 Upgrades aus 8 Karten (Seltenheiten: selten ×2, legendär ×3; Synergien zwischen Upgrades).
- Nach 2 Wellen kommt ein Boss. Nach dem ersten Phantom zoomt die Kamera heraus (größeres Schlachtfeld).
- Kombo-Multiplikator für schnelle Abschüsse, Bonus für Bosse ohne Treffer.
- Power-ups: Herz, Magnet, Zeitlupe, Bombe.

## Bosse (9)
Wächter, Schwarmkönigin, Laserkoloss, Phantom, **Ignis & Glacies** (Duo), Graviton, Dreadnought, **Triarchie** (Trio: Schildträger zuerst!), **Festung** (zerstörbare Geschütztürme). Mehrere haben Umweltgefahren (Asteroiden, Randlaser, schrumpfender Sturm).

## Gegner
Drohne, Pfeil, Schütze, Panzer, Minenleger, Kamikaze-Schwarm, Gepanzerter (nur von hinten verwundbar) und Elite-Varianten (Schild, Teleport, schnell).

## Ultimates
Nova, Schwarzes Loch, Orbitallaser, Drohnenschwarm – plus 5 Perks (Schnelle Ladung, Nova-Verstärker, Nova-Echo, Nova-Panzer, Nachbrenner).

## Waffen & Upgrades
Blaster, Streuschuss, Laserstrahl, Raketenwerfer, Kettenblitz; Begleitdrohnen und viele Stat-Upgrades.

## Meta-Fortschritt
Credits pro Lauf → Hangar: Schiffe (Falke, Bastion, Wisp), Ultimates, permanente Upgrades. 12 Erfolge schalten Anstriche frei. Alles wird lokal im Browser gespeichert.

## Sound
Effekte und Musik werden per Web Audio live erzeugt (keine Audiodateien).

## Online-Bestenliste
`online.js` nutzt die geteilte Datenbank, wenn die Seite als Claude-Artefakt läuft; sonst ist sie ohne Wirkung.
