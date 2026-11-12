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
| F | Auto-Feuer an/aus |
| P / Esc | Pause |
| 1–6 | Upgrade wählen |

## Ablauf
- Zu Beginn wählst du ein **Upgrade** aus sechs zufälligen Karten (du nimmst drei davon).
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

## Upgrades
Schnellfeuer, Mehrfachschuss, Schwere Munition, Triebwerk, Railgun-Läufe, Panzerung,
Durchschlag, Zielsuchend, Energieschild, Nanobots, Heckkanone, Kritische Treffer.
