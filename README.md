# Jul Shot

Ein kleiner Weltraum-Shooter im Browser (HTML5 Canvas, kein Build nötig).

## Starten
`index.html` im Browser öffnen – fertig.

## Steuerung
| Taste | Aktion |
|---|---|
| W A S D | Fliegen |
| Maus | Zielen |
| Linksklick / Leertaste (halten) | Schießen |
| Q / Rechtsklick | **Ultimate** (Nova, alle 20 Sek. bereit) |
| F | Auto-Feuer an/aus |
| P / Esc | Pause |
| 1–8 | Upgrade wählen |

## Ablauf
- Zu Beginn wählst du ein **Upgrade** aus acht zufälligen Karten (du nimmst fünf davon).
- Nach **2 Wellen** kommt immer ein **Bossgegner**, danach gibt es wieder ein Upgrade.
- Jeder besiegte Gegner bringt **Punkte**. Am Ende trägst du deinen Namen ins **Scoreboard** ein (Top 10, lokal im Browser gespeichert).

## Gegner
- **Drohne** – fliegt auf dich zu
- **Pfeil** – zielt kurz und stürzt sich dann auf dich
- **Schütze** – hält Abstand und schießt gezielt
- **Panzer** – langsam, zäh, feuert Fächer-Salven

## Bosse (rotieren, werden jedes Mal stärker, ab 50 % HP „wütend“)
1. **Wächter** – Spiralfeuer, Ringexplosionen, gezielte Fächer
2. **Schwarmkönigin** – spuckt Drohnen aus, Lenkraketen, Säureregen
3. **Laserkoloss** – angekündigte Ziellaser, rotierendes Laserkreuz, Geschosshagel
4. **Phantom** – Teleport mit Ringschuss, Sturmangriff mit Minenspur, Schattensalven
   - Nach dem **ersten Phantom** läuft eine Sequenz ab: der Bildschirm zoomt heraus und das Schlachtfeld wird größer (mehr Gegner pro Welle).
5. **Ignis & Glacies** (Duo-Boss) – Feuer- und Eiszwilling mit eigenen Angriffen, dazwischen ein Strahl, der verletzt. Stirbt einer, wird der andere wütend.
6. **Graviton** – Schwarzes Loch: kreisende Geschosse, Gravitationssog, Meteoritenregen
7. **Dreadnought** – Flaggschiff: Breitseiten, Hangar mit Schützen, Schwenklaser, Lenkraketen

## Upgrades
Schnellfeuer, Mehrfachschuss, Schwere Munition, Triebwerk, Railgun-Läufe, Panzerung,
Durchschlag, Zielsuchend, Energieschild, Nanobots, Heckkanone, Kritische Treffer.

Ultimate-Perks: Schnelle Ladung, Nova-Verstärker, Nova-Echo, Nova-Panzer, Nachbrenner.
