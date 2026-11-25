# Editor-Feinschliff: Zeichenebene links, Pfeile an der Auswahl, Texturen ohne Dehnen, kein Flackern – Design

**Stand:** vom Nutzer freigegeben am 2026-11-25 („mach A … rot blau grün pfeile“, „starte“).
**Bezug:** Haupt-Design `2026-11-24-retro-game-maker-design.md`, Abschnitte 6.2 und 6.3. Danach folgen Regeln (Etappe 2) und Modelle (Etappe 3) mit eigenem Design.

## Warum

Nach dem ersten Ausprobieren von Etappe 1 will der Nutzer **(1)** die Zeichenebene bei den anderen Werkzeugen links haben, **(2)** Ecken mit der Maus exakt hoch, tief, links, rechts, vor und zurück ziehen können – „das typische Ding wie in Unity, rot, blau, grün, Pfeile“ –, **(3)** dass Texturen beim Biegen und Strecken nicht mehr gezogen werden, sondern „immer gleich bleiben“, und **(4)** dass sich nichts überlappt und flackert. **[Nutzer]**

## Ziele

1. **Zeichenebene links** **[Nutzer; Details Builder]**: In der Werkzeugleiste unter den Werkzeugen steht ein Knopf, der die aktuelle Ebene zeigt (Auto, Boden, Wand X, Wand Z) und das Kürzel Q trägt. Ein Klick klappt rechts daneben ein Menü auf: die vier Ebenen, darunter „Höher“ (Bild↑) und „Tiefer“ (Bild↓) mit der aktuellen Höhe. Esc oder ein Klick daneben schließt es, Pfeiltasten wählen. Q und Bild↑/↓ wirken weiter. Die Ebenen-Wahl rechts im Pinsel-Bereich entfällt.
2. **Pfeile an der Auswahl** **[Nutzer: Variante A, Farben wie Unity; Drehringe als Vorschlag mit „starte“ angenommen]**: Hat das Auswahl-Werkzeug eine Auswahl (Ecken, Kanten oder Kacheln), steht an ihrem Drehpunkt ein Gizmo:
   - Pfeile **rot = X**, **grün = Y** (hoch/runter), **blau = Z**. Einen Pfeil ziehen verschiebt die Auswahl exakt entlang dieser Achse.
   - Kleine **Quadrate** zwischen je zwei Pfeilen verschieben in dieser Fläche (zwei Achsen).
   - Bei Kachel-Auswahl zusätzlich **Drehringe** in denselben Farben (Ring um X, Y, Z); ziehen dreht um den Drehpunkt.
   - Verschieben rastet im eingestellten Raster ein (1, ½, ¼ m), Drehen in 15°-Schritten; **Alt** schaltet das Einrasten ab. Am Zeiger und in der Statusleiste steht die Strecke in Metern bzw. der Winkel.
   - Vorschau beim Ziehen wie heute (Geister); Loslassen = **ein** Rückgängig-Schritt, die Auswahl geht mit.
   - Der Gizmo bleibt auf dem Bildschirm gleich groß, liegt immer obenauf und hebt den Griff unter dem Zeiger hervor. In den Ansichten Oben, Vorne und Seite fehlen Pfeil und Ringe, die auf die Kamera zeigen bzw. nur als Strich zu sehen wären.
   - Grenzen wie heute: mehr als 65.536 Kacheln werden beim Ansetzen abgelehnt. Pfeiltasten und Bild↑/↓ bleiben.
3. **Texturen dehnen sich nie** **[Nutzer; Verfahren Builder]**: Jede Kachel zeigt ihre Textur immer in derselben Größe: **1 Kachel = 1 m** (Projekt-Raster). Wird eine Kachel größer gezogen, **wiederholt** sich die Textur; an Rampen und Schrägen läuft sie unverzerrt den Hang entlang; ist eine Kachel kleiner, zeigt sie einen Ausschnitt. Die Textur hängt an der Kachel: Verschieben oder Drehen der ganzen Kachel nimmt sie mit. Drehen (R) und Spiegeln (X) des Pinsels wirken wie bisher. Unverformte 1×1-Kacheln sehen **pixelgleich** aus wie vorher. Gilt sofort für alle Projekte (kein neues Dateiformat). Dieselbe Regel gilt später für die automatische Abwicklung der Modelle.
4. **Nichts überlappt, nichts flackert** **[Nutzer; Verfahren Builder]**:
   - Exakt aufeinanderliegende Kacheln (gleiche vier Ecken, gleiche Blickrichtung, gleiche Ebene) **entstehen nicht mehr**: Beim Verschieben, Drehen, Skalieren, Extrudieren und Zusammenführen ersetzt die bewegte bzw. neue Kachel die alte – im selben Rückgängig-Schritt. Malen, Block und Füllen tun das schon.
   - Wo Kacheln trotzdem teilweise in derselben Fläche überlappen (halbe Raster-Schritte, gebogene Ecken, verschiedene Ebenen), ist die Reihenfolge **fest**: die später angelegte Ebene (in der Liste weiter unten) vor der früheren, in derselben Ebene die neuere Kachel vor der älteren – was zuletzt dazukam, liegt vorn. Es flackert nie, auch nicht in der Vorschau beim Ziehen.

## Nicht-Ziele

- Überlappende Kacheln zuschneiden (CSG).
- Achsen sperren per Taste (Variante C) und das Radialmenü (Variante B).
- Drehringe für Ecken- und Kanten-Auswahl.
- Texturkoordinaten für Welt-Kacheln von Hand bearbeiten; eine Option „Textur dehnen“ (später möglich).

## Anti-Ziele (Fehlschlag, auch wenn es technisch läuft)

- Bisherige, unverformte Kacheln sehen anders aus als vorher.
- Der Gizmo springt, verdeckt die Arbeit oder trifft ungenau; ein Ziehen landet neben dem Raster.
- Eine Kachel verschwindet beim Verschieben, ohne dass Rückgängig sie zurückbringt.
- Spürbar langsamer: Die Test-Insel bleibt in unter 5 s bereit und läuft mit 60 Bildern/s.
- Kacheln scheinen durch Wände, die deutlich davor liegen.

## Rahmen

Alle Global Constraints des Haupt-Designs und des Bauplans von Etappe 1 (Deutsch in der Oberfläche, Tasten am Werkzeug, Tests, Paketgrenzen: Engine kennt weder Runtime noch Editor). WebGL2, Texturen pixelgenau (NEAREST, keine Mipmaps).

## Ansätze

**Pfeile:** A Pfeil-Griffe wie Unity (gewählt vom Nutzer) · B Radialmenü (unsichtbar bis zum Aufruf, schwer genau zu treffen) · C Achsen-Sperre per Taste (man muss die Tasten kennen).

**Texturen:**
1. *Rahmen an der Kachel* (gewählt): Texturkoordinaten werden beim Vernetzen aus der Lage der Ecken in der Ebene der Kachel berechnet (Ursprung Ecke c0, u entlang der Kante c0→c1, v senkrecht dazu Richtung c3, in Metern); der Shader holt pro Bildpunkt das passende Texel aus der Kachel im Tileset (Wiederholung innerhalb der Kachel). Textur folgt der Kachel, dehnt nie.
2. *Welt-Projektion* (Textur am Welt-Raster): verworfen – rutscht beim Verschieben um halbe Schritte und dehnt sich an Schrägen doch.
3. *Texturkoordinaten speichern und bearbeiten*: verworfen für jetzt – neues Dateiformat und eigene Oberfläche, gehört zur Modell-Werkstatt.

**Flackern:**
1. *Exakte Doppel ersetzen + feste Reihenfolge* (gewählt): Werkzeuge entfernen exakt verdeckte Kacheln; beim Vernetzen bekommen in derselben Fläche überlappende Kacheln eine Rangstufe (Ebene, dann Alter), der Shader rückt höhere Stufen um einen winzigen, festen Tiefen-Betrag nach vorn.
2. *Zuschneiden (CSG)*: verworfen – aufwendig, zerstückelt Kacheln.
3. *Nur Tiefen-Versatz je Ebene*: verworfen – exakte Doppel blieben unsichtbar, aber fest bestehen.

## Dem Builder überlassen (meine Festlegungen)

- Texturrahmen: robuste Wahl bei zusammengefallenen Ecken (längere der Kanten c0→c1 / c3→c2 als u-Richtung); Texturkoordinaten um 1/10.000 Kachel zur Mitte gezogen, damit an Kanten nie die Nachbar-Wiederholung erscheint; nicht ebene Vierecke werden auf ihre mittlere Ebene projiziert.
- Rangstufen 0–3, je Stufe ein fester Versatz von etwa 8 Tiefen-Einheiten; mehr als drei Überlagerungen teilen sich die oberste Stufe. Überlappung = gleiche Ebene (Normale ±, Abstand ±1 mm) und gemeinsame Fläche über 1 mm².
- Gizmo: Pfeillänge ≈ 90 CSS-px, Trefferzone 8 px, Quadrate ≈ 22 px, Farben X #E24B4A, Y #63B32E, Z #378ADD, hervorgehoben #F2C94C. Drehpunkt = Mitte der Auswahl (wie heute).
- Ausklapp-Menü als `role="menu"` mit `menuitemradio`; die Höhe zeigt den Abstand der aktiven Zeichenebene.
