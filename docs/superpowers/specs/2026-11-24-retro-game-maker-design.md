# Retro-Game-Maker – Design

Stand: 24.11.2026 · Status: Entwurf, wartet auf Freigabe

Kennzeichnung in diesem Dokument:
- **[Nutzer]**: hat der Nutzer selbst gesagt oder ausgewählt.
- **[bestätigt]**: mein Vorschlag, den der Nutzer ausdrücklich bestätigt hat („perfekt“, „passt“).
- **[Builder]**: meine Entscheidung, nicht mit dem Nutzer besprochen. Darf beim Bauen geändert werden, wenn es einen guten Grund gibt.

---

## 1. Worum es geht

Ein eigenes Programm, mit dem man **komplette, spielbare Spiele im Retro-Low-Poly-Pixel-Stil** baut: im Stil der Modelle und Szenen aus Crocotile 3D und picoCAD 2, aber mit eigenem Look und eigenem Code. Es soll effizient programmiert, schnell und leicht zu bedienen sein. **[Nutzer]**

Das erste Spiel, das der Nutzer damit bauen will, ist „so eine Art Queen's Domain“: ein Action-Rollenspiel in Ego-Perspektive in der Tradition von King's Field. Ausdauer-Nahkampf, aufgeladene Angriffe, Wurfwaffen, eine verschachtelte Welt mit verschlossenen Türen und versteckten Wegen, Bosse. **[Nutzer]** Dazu soll eine eigene Signatur-Mechanik kommen, „so eine Mechanik, aber nicht 1:1 wie Queen's Domain“. Gemeint ist so etwas wie das fliegende Schwert dort. **[Nutzer]**

**Warum:** Der Nutzer will sein eigenes Spiel dieser Art bauen, und zwar in **einem** Werkzeug, vom Modell über das Level bis zum exportierten, spielbaren Spiel. Heute braucht man dafür mehrere Programme: Crocotile und picoCAD modellieren nur, gespielt wird in einer Engine wie Godot oder Unity. Genau dieser Schritt „zum spielbaren Spiel“ ist das Neue. *(Abgeleitet aus dem Gespräch.)*

**Hauptnutzer:** der Nutzer selbst. Die Bedienung soll so einfach sein, dass Einsteiger ohne Handbuch zurechtkommen. **[Nutzer: „benutzerfreundlich“]**

**Clean Room:** Crocotile 3D und picoCAD 2 sind kommerzielle Programme. Wir bauen nach ihrem öffentlich sichtbaren Verhalten (Doku, Videos, Feature-Listen). Wir dekompilieren nichts und übernehmen weder Code noch Grafiken noch Oberflächen. **[bestätigt]**

---

## 2. Ziele, Nicht-Ziele, Anti-Ziele

### Ziele
1. Ein Projekt mit drei Werkbänken (**Modelle**, **Welt**, **Regeln**), dazu **Play** und **Export**. **[bestätigt]**
2. Mit „Play“ steht man sofort in Ego-Sicht an der Stelle, an der man gerade baut, und kann das Spiel ausprobieren. **[bestätigt]** Der Start dauert unter 1 Sekunde. **[bestätigt]**
3. Spiele im Stil von Queen's Domain lassen sich ohne Programmieren bauen, inklusive einer eigenen Signatur-Mechanik über den Fähigkeiten-Baukasten. **[bestätigt]**
4. Das Spiel läuft mit 60 Bildern pro Sekunde auf einem normalen Laptop. **[bestätigt]**
5. Export als Browser-Version (z. B. für itch.io) und als Windows-Programm. **[bestätigt]**
6. Eine Oberfläche im Stil von Entwurf B „Klar & dunkel“, plus zwei Hilfen aus Entwurf C. **[Nutzer: B; Hilfen aus C bestätigt]**
7. Eine Spielwelt aus einem Stück: Man läuft ohne Ladepause von der Küste in Ruinen und Dungeons. **[Nutzer]**

### Nicht-Ziele für Version 1 **[bestätigt]**
- Mehrspieler
- Musik komponieren (kein Tracker; Musik wird importiert)
- Export für Handys
- Eine Skriptsprache. Alles geht über Bausteine. *(Kommt nur dazu, wenn der Nutzer selbst programmiert und es will; bisher hat er das nicht gesagt.)*

Außerdem nicht in Version 1 **[Builder]**:
- Andere Genres als Action-RPG in Ego-Sicht (Plattformer, Top-down). Die Spiel-Seite ist bewusst auf dieses Genre zugeschnitten. **[bestätigt]** Andere Genres können später kommen.
- Realistische Grafik (PBR, Schatten, Echtzeit-Spiegelungen)
- Mac und Linux als offiziell getestete Plattformen (Editor und Browser-Export laufen dort wahrscheinlich, werden aber nicht gezielt getestet)
- Export einzelner Modelle als glTF/OBJ, Import von OBJ-Modellen (vielleicht später)
- Asset-Marktplatz, Cloud-Speicher, Zusammenarbeit mit mehreren Leuten

### Anti-Ziele: Das wäre ein Fehlschlag, auch wenn es technisch funktioniert **[Builder]**
- Das Programm wird so kompliziert wie Blender oder Unity.
- Es ruckelt, lädt lange oder „Play“ dauert spürbar.
- Arbeit geht verloren (Absturz ohne Wiederherstellung, kein Rückgängig).
- Es wirkt wie ein Klon von Crocotile oder picoCAD statt wie ein eigenes Werkzeug.
- Was man im Editor mit „Play“ testet, verhält sich im exportierten Spiel anders.

---

## 3. Rahmenbedingungen

- **Technik:** TypeScript, eigene schlanke 3D-Engine auf WebGL2, Oberfläche in HTML/CSS, als Windows-Programm verpackt mit Tauri. **[Nutzer: Weg 1]**
- **Eigener Code:** keine große Fremd-Engine (kein three.js, Godot, Unity). Kleine, gut gepflegte Hilfsbibliotheken sind erlaubt (UI-Framework, Testwerkzeuge, ZIP, PNG). **[Builder]**
- **Sprache der Oberfläche:** Deutsch. Alle Texte liegen zentral in einer Datei, damit später Übersetzungen möglich sind. **[Builder]**
- **Code-Ort:** Der Code liegt in einem **privaten GitHub-Repository** des Nutzers. **[Nutzer]**
- **Bauen und Ausliefern:** Entwickelt wird in einer Linux-Umgebung. Dort lässt sich die Browser-Version komplett bauen und automatisch testen (Headless-Chromium). Automatische Builds bei GitHub (GitHub Actions) führen bei jeder Änderung die Tests aus, bauen Editor und Abspiel-Hülle für Windows und stellen Testversionen bereit. Der Nutzer muss nichts installieren. **[Builder]**
- **Schriften:** Nur frei lizenzierte Schriften (z. B. OFL), die mit ausgeliefert werden dürfen, auch in exportierten Spielen. **[Builder]**

---

## 4. Ansätze

Betrachtet wurden drei Wege. Der Nutzer hat Weg 1 gewählt.

| Weg | Kurz | Stärken | Schwächen |
|---|---|---|---|
| **1. Web-Technik als Desktop-Programm** (gewählt) | TypeScript, eigene WebGL2-Engine, HTML/CSS-Oberfläche, Tauri-Hülle | Am schnellsten zu einer schönen, leicht bedienbaren Oberfläche. Play startet sofort, weil Editor und Spiel dieselbe Engine im selben Fenster nutzen. Browser-Export ist fast geschenkt. Retro-Grafik ist leicht, 60 fps sind gut erreichbar. Alles lässt sich automatisch testen. | Kollision, Physik und Audio müssen selbst gebaut werden (für Ego-Sicht in Kachel-Welten überschaubar). JavaScript ist langsamer als nativer Code, bei diesem Grafikstil aber nicht spürbar. |
| 2. Auf Godot aufbauen | Editor als Godot-Programm, Spiele laufen auf Godot | Physik, Audio und Export sind fertig und erprobt. | Eine Oberfläche wie B ist mit Godots Bausteinen deutlich mühsamer. Die Browser-Version wird viel größer. Großteils kein eigener Code. |
| 3. Nativ in C++ mit Dear ImGui | Maximale Leistung | Winzige, sehr schnelle Programme. | Die Oberfläche wirkt wie ein Werkzeug für Entwickler. Mit Abstand am langsamsten zu bauen. Browser-Export nur über Umwege. |

Aussortiert: **Love2D** (darauf läuft picoCAD 2). 3D und Oberfläche müssten fast komplett selbst gebaut werden, und die Browser-Version ist unausgereift. **Unity/Unreal**: zu schwer, fremde Lizenzbindung, passt nicht zu „eigener Code“.

**Warum Weg 1:** „Benutzerfreundlich“ ist die wichtigste Anforderung, und die Oberfläche ist die halbe Miete. Die Leistung reicht für diesen Grafikstil locker.

---

## 5. Was der Nutzer entschieden hat (im Überblick)

1. Ein **Programm, um ein Spiel zu bauen** in diesem Stil, kein fertiges Spiel. **[Nutzer]**
2. Erstes Zielspiel: **„so eine Art Queen's Domain“**. **[Nutzer]**
3. Eine **eigene Signatur-Mechanik**, ähnlich der aus Queen's Domain, aber nicht gleich. **[Nutzer]** Lösung: der Fähigkeiten-Baukasten. **[bestätigt]**
4. Drei Werkbänke, Play an der aktuellen Stelle, Export. Die Spiel-Seite ist gezielt für Ego-Action-RPGs gebaut. **[bestätigt]**
5. Spiel-Seite: Nahkampf mit Ausdauer, aufgeladene Angriffe, Wurfwaffen, Gegner (patrouillieren, verfolgen, angreifen), Bosse mit Mustern und Phasen, Ausrüstung, Stufenaufstieg, Schlüssel, Türen, Geheimgänge, Speicherpunkte, Feinschliff mit Reglern beim Spielen. **[bestätigt]**
6. Oberfläche: **Entwurf B „Klar & dunkel“**. **[Nutzer]** Dazu kommen Tastenkürzel direkt an den Werkzeugen und ein Hinweis-Kärtchen zum aktiven Werkzeug (aus C). **[bestätigt]** Entwürfe: https://claude.ai/artifact/5D2Y4XXjzCYrUzkPjx2ubL#artboard-Klar-Dunkel
7. Die Welt besteht aus **Kacheln, nicht aus Würfeln**: Kacheln frei setzen, Formen biegen, Modelle für alles Runde, Gelände-Pinsel. Das Raster ist eine Hilfe, kein Zwang. **[bestätigt]**
8. Drumherum: Look-Regler (Retro-Grundeinstellung), Licht, Sound-Import plus Retro-Sound-Generator, Menüs und Anzeige aus Vorlagen, drei Spielstände, Tastatur/Maus und Gamepad, Export für Browser und Windows, 60 fps. **[bestätigt]**
9. Technik: **Weg 1** (Web-Technik als Desktop-Programm). **[Nutzer]**
10. Reihenfolge in **sechs Etappen** (Abschnitt 8). **[Builder, dem Nutzer mitgeteilt]**
11. Die Welt ist **aus einem Stück**, eine nahtlose Insel bis etwa 500 × 500 m. Getrennte Bereiche sind zusätzlich möglich. **[Nutzer]**
12. Der Code liegt in einem **privaten GitHub-Repository**, und das Windows-Programm wird automatisch gebaut. **[Nutzer]**

---

## 6. Das Produkt im Detail

### 6.1 Grundaufbau

- Ein **Projekt** ist ein Ordner mit allen Dateien eines Spiels (Abschnitt 7.4). **[Builder]**
- Die Spielwelt ist **eine zusammenhängende Welt aus einem Stück**, z. B. eine Insel bis etwa 500 × 500 m. Man läuft ohne Ladepause von der Küste in Ruinen und Dungeons. **[Nutzer]** Ein Projekt kann zusätzlich weitere, getrennte Welten haben, etwa einen tiefen Dungeon oder eine Traumwelt. Man erreicht sie über einen Bereichswechsel. **[Builder]**
- **Regionen** sind benannte Teile der Welt, z. B. „Strand“, „Ruinen“ oder „Gruft“. Sie haben eigene Einstellungen für Look, Nebel und Musik und lösen beim Betreten das automatische Speichern aus. **[Builder]**
- Oben im Fenster liegen die drei **Werkbänke** als Reiter: Modelle (1), Welt (2), Regeln (3). Alle arbeiten am selben Projekt. **[bestätigt]**
- **Play** (F5) startet das Spiel. Ist die Welt-Werkbank offen, startet man an der aktuellen Kameraposition, sonst am Spielerstart. Esc bzw. Stop führt zurück in den Editor, an dieselbe Stelle. **[bestätigt / Details Builder]**
- **Export** über das Projektmenü (Abschnitt 6.14).

### 6.2 Editor-Oberfläche **[Nutzer: B; Details Builder]**

Aufbau wie im Entwurf B:
- **Obere Leiste:** Projektname mit Speicherstatus, Reiter der Werkbänke, Rückgängig/Wiederholen, „Spielen“-Knopf mit Kürzel F5.
- **Werkzeugleiste links:** Werkzeuge der aktiven Werkbank, nach Gruppen getrennt. Die Taste steht direkt am Werkzeug **[bestätigt]**, beim Überfahren erscheint ein Tooltip.
- **Ansicht in der Mitte:** 3D-Ansicht mit Umschalter Perspektive / Oben / Vorne / Seite und Achsen-Anzeige.
- **Seitenleiste rechts:** passt sich an Werkzeug und Werkbank an (z. B. Tileset, Pinsel, Szenen-Liste).
- **Statusleiste:** Position, Raster, aktiver Pinsel, kurze Bedienhinweise.
- **Hinweis-Kärtchen** **[bestätigt]**: erklärt das aktive Werkzeug in einem Satz („Klick setzt · Rechtsklick nimmt eine Kachel auf · Shift + Ziehen füllt eine Fläche“). Lässt sich einzeln oder für immer ausblenden.
- Farben, Schrift und Abstände wie in B: neutrales Dunkel, ein blauer Akzent, Inter für die Oberfläche, JetBrains Mono für Zahlen.
- **Für alle bedienbar** **[Builder]**: Oberfläche skalierbar von 100 bis 200 %, ausreichende Kontraste, alle Funktionen auch per Tastatur erreichbar.
- **Erster Start** **[Builder]**: Startbildschirm mit „Neues Projekt“, „Beispielprojekt öffnen“ und den zuletzt geöffneten Projekten. Leere Bereiche erklären, was man dort tun kann (z. B. „Noch kein Tileset. Ziehe ein PNG hierher.“).
- **Rückgängig/Wiederholen** in allen Werkbänken, **automatisches Speichern** und Wiederherstellung nach einem Absturz. **[Builder]**

### 6.3 Welt-Editor (Crocotile-Prinzip, eigener Code) **[bestätigt / Details Builder]**

**Grundidee:** Die Welt besteht aus **Kacheln**: flache, viereckige Flächen, auf die ein Ausschnitt aus einem Tileset (PNG) gelegt ist. Eine Kachel ist ein frei positionierbares Viereck im Raum. Fallen zwei Ecken zusammen, wird es ein Dreieck, z. B. für Giebel oder Bögen.

**Tilesets:**
- PNG importieren (Ziehen und Ablegen). Kachelgröße wählbar (8, 16, 32 px oder eigene). Mehrere Tilesets pro Projekt.
- Im Tileset wählt man eine oder mehrere Kacheln aus. Ein Bereich von z. B. 2×2 Kacheln wird zu einem größeren Pinsel.
- **Tileset bemalen:** eingebauter Pixel-Mal-Editor, derselbe wie in der Modell-Werkstatt (Etappe 5).
- **Animierte Kacheln:** Eine Kachel kann aus mehreren Bildern bestehen, z. B. für Wasser oder Fackeln (Etappe 5).

**Werkzeuge** (Tasten wie im Entwurf):
- **Kachel malen (B):** setzt die Pinsel-Kachel auf eine Ebene am 3D-Cursor. Die Ebene ist Boden, Wand X, Wand Z oder an einer vorhandenen Fläche ausgerichtet. Drehen (R), Spiegeln (X), Pinselgröße 1–3. Rechtsklick nimmt die Kachel unter dem Cursor auf (Pipette).
- **Block setzen (K):** setzt einen Würfel aus Kacheln, alle Seiten mit der Pinsel-Kachel (oder Deckel und Seiten getrennt wählbar). Verdeckte Innenflächen entfernt das Programm automatisch. Der Block ist danach eine Gruppe normaler Kacheln.
- **Auswählen (A):** Kacheln, Ecken, Kanten oder ganze Objekte auswählen. Verschieben, drehen und skalieren mit Einrasten am Raster (ganze, halbe und viertel Schritte; Einrasten mit Alt abschaltbar).
- **Formen biegen:** Ecken und Kanten verschieben macht aus Flächen Rampen, Schrägdächer, Bögen und Klippen. Gemeinsame Ecken bewegen sich mit. Flächen lassen sich herausziehen (Extrudieren).
- **Füllen (G):** füllt eine zusammenhängende Fläche oder ein aufgezogenes Rechteck mit der Pinsel-Kachel.
- **Pipette (I)** und **Radieren (E)**.
- **Modell platzieren (M):** stellt Modelle aus der Modell-Werkstatt in die Welt (Säulen, Bäume, Statuen, Requisiten).
- **Sprites:** Kacheln, die sich immer zur Kamera drehen. Gut für Pflanzen, Fackeln und Gegenstände. **[Builder]**
- **Gelände-Pinsel** **[bestätigt]**: ein Geländestück aus einem Raster von Bodenkacheln. Pinsel zum Anheben, Absenken, Glätten und Ebnen „wie Ton“, dazu Bemalen mit Kacheln. Für Küste und Hügel (Etappe 5).

**Weiteres:**
- **Ebenen** mit Sichtbar- und Sperr-Schalter. Neue Kacheln landen in der aktiven Ebene.
- **Kamera:** rechte Maustaste halten zum Umsehen, Mausrad zum Zoomen, Leertaste zum Verschieben, WASD zum Fliegen.
- **Raster:** Standard ist 1 Kachel = 1 Meter, die Spielfigur ist 1,7 m groß. Pro Projekt einstellbar. **[Builder]**
- **Kollision entsteht automatisch** aus den Kacheln und Modellen **[bestätigt]**. Jede Kachel bekommt dazu Eigenschaften: begehbar oder nicht, beidseitig, „Geist“ (ohne Kollision). **[Builder]**

### 6.4 Modell-Werkstatt (picoCAD-Prinzip, eigener Code) **[bestätigt / Details Builder]**

- **Grundformen:** Würfel, Ebene, Zylinder, Kegel, Kugel (Low-Poly), Prisma.
- **Bearbeiten:** Ecken, Kanten und Flächen verschieben, drehen und skalieren. Extrudieren, Spiegeln (auch als Live-Spiegel-Modus), Zusammenführen, Unterteilen, alles mit Raster.
- **Eine Textur pro Modell** (64, 128 oder 256 px). **Direkt auf dem Modell malen** **[bestätigt]**: Die Pixel erscheinen beim Malen sofort auf dem Modell. Daneben gibt es eine 2D-Ansicht der Textur. Pixel-Werkzeuge: Stift, Linie, Rechteck, Füllen, Pipette, Farbpalette (optional auf eine Palette begrenzt).
- **UVs:** automatische Abwicklung pro Fläche plus Bearbeitung von Hand mit Einrasten auf Texturpixel.
- **Animation** **[bestätigt: „einfache Animationen“]**: Ein Modell besteht aus Teilen mit Drehpunkten, z. B. Kopf, Arm, Schwert. Animiert wird über Keyframes für Position, Drehung und Größe je Teil. Übergänge stufig (Retro-Look) oder weich. Benannte Clips wie Ruhe, Laufen, Angriff, Treffer, Tod, Tür auf. Clips können **Markierungen** haben, etwa „Trefferfenster“ (wann ein Angriff Schaden macht) oder „Schritt“ (Sound). **[Builder]** Ein Skelett mit verformbarer Haut gibt es in Version 1 nicht. **[Builder]**
- **Wofür:** Gegner, Bosse, NPCs, Waffen (in Ego-Sicht in der Hand sichtbar), Truhen, Türen, Requisiten.

### 6.5 Spielregeln-Werkbank: Logik ohne Programmieren **[bestätigt / Details Builder]**

**Spiel-Objekte**, die man in die Welt setzt und rechts in einer Eigenschaften-Liste einstellt:
- Spielerstart
- Gegner, Boss, NPC
- Truhe (Inhalt), Gegenstand zum Aufheben (Schlüssel, Heiltrank, Wurfwaffen, Ausrüstung)
- Tür (normal, braucht Schlüssel, per Schalter, nur von einer Seite)
- Hebel/Schalter, Druckplatte
- Speicherpunkt
- Geheimwand (per Schlag oder beim Benutzen öffnen)
- Schadenszone (Falle, Stacheln, Lava)
- Auslöser-Zone (unsichtbarer Bereich)
- Ankerpunkt (für Fähigkeiten, z. B. zum Heranziehen)
- Fähigkeits-Altar (schaltet eine Fähigkeit frei)
- Bereichswechsel (Teleport innerhalb der Welt oder in eine andere Welt)
- Texttafel
- Lichtquelle, Geräuschquelle
- Region (ein Bereich der Welt mit eigenem Look, Nebel und eigener Musik)

**Verbindungen** **[Builder]**: Logik baut man, indem man Objekte miteinander verbindet. Klick auf „Verbinden“, dann aufs Ziel. Im Editor sieht man die Verbindung als Linie.
- **Auslöser:** betreten, verlassen, benutzt, geöffnet, besiegt, Schalter an/aus, Gegenstand aufgehoben, Spieler gesehen, nach Zeit.
- **Bedingungen** (optional): hat Gegenstand X, Merker Y gesetzt/nicht gesetzt, Fähigkeit Z freigeschaltet.
- **Aktionen:** öffnen/schließen, an/aus, erscheinen/verschwinden, Gegner aufwecken, Text zeigen, Sound abspielen, Musik wechseln, Kamera wackeln, Gegenstand geben, Fähigkeit freischalten, Merker setzen, Bereich wechseln, Speicherpunkt aktivieren.
- Beispiele: Hebel öffnet Tor. Boss besiegt öffnet Ausgang, setzt Merker und wechselt die Musik. Wer die Arena betritt, schließt die Türen und weckt den Boss.

### 6.6 Spielfigur, Kampf, Gegner **[bestätigt / Details Builder]**

**Spielfigur (Ego-Sicht):**
- Gehen, Rennen (kostet Ausdauer), Springen, Umsehen mit der Maus. Stufen bis zu einer einstellbaren Höhe steigt die Figur automatisch hoch, rutscht aber an zu steilen Hängen ab.
- Werte: Leben, Ausdauer (regeneriert sich), Stärke, Verteidigung, Stufe und Erfahrungspunkte.
- **Stufenaufstieg:** Erfahrungspunkte von Gegnern. Bei jedem Aufstieg verteilt man Punkte auf Leben, Ausdauer oder Stärke. **[bestätigt: „Stufenaufstieg“; Verteilung Builder]**
- **Ausrüstung:** Nahkampfwaffe, Wurfwaffe, Rüstung, 2 Schmuckstücke mit passiven Boni. Dazu ein Inventar. **[Builder]**
- **Tod:** zurück zum letzten Speicherpunkt. Gegner erscheinen beim Ausruhen am Speicherpunkt wieder (pro Gegner einstellbar). **[Builder]**

**Kampf:**
- **Leichter Angriff** (Klick), **aufgeladener Angriff** (gedrückt halten und loslassen), **Spezialangriff der Waffe** (eine Fähigkeit aus dem Baukasten), **Wurfwaffen** mit begrenzter Anzahl. Alles kostet Ausdauer. **[bestätigt]**
- Jede **Waffe** hat Werte für Schaden, Reichweite, Schlagwinkel, Tempo (Ausholen, Treffer, Erholung), Ausdauerkosten, Aufladezeit und Aufladebonus, Spezialangriff, Modell mit Animationen sowie Treffer-Sound. **[Builder]**
- **Schaden:** Angriff minus Verteidigung, mindestens 1. Treffer-Feedback durch kurzes Einfrieren, Rückstoß, Sound und Aufblitzen. **[Builder]**
- Blocken und Parieren gibt es nicht als festes System. Wer es will, baut es als Fähigkeit (vielleicht später). **[Builder]**

**Gegner** **[bestätigt: patrouillieren, verfolgen, angreifen]**:
- Verhalten: Ruhe oder Patrouille (Wegpunkte), Bemerken (Sichtkegel, Geräusche), Verfolgen, Angreifen, Rückkehr zum Ausgangspunkt, optional Flucht bei wenig Leben.
- **Wegfindung** über ein Laufraster, das automatisch aus den begehbaren Flächen entsteht. Es wird pro Chunk berechnet und bei Änderungen nur dort neu. **[Builder]**
- **Nur in der Nähe aktiv:** Gegner und Logik laufen nur in einem Umkreis um den Spieler. Weiter entfernte Gegner ruhen und behalten ihren Zustand. Bosse und verbundene Objekte, die gerade an einer Abfolge beteiligt sind, bleiben aktiv. **[Builder]**
- **Angriffe:** Nahkampf, Fernkampf (Geschoss), Sprung. Jeweils mit Reichweite, Vorwarnzeit (damit man ausweichen kann), Abklingzeit und Schaden.
- Werte, Beute (was fallen gelassen wird, mit Wahrscheinlichkeit), Erfahrungspunkte.
- Bis Etappe 3 haben Gegner eine Platzhalter-Optik.

**Bosse** **[bestätigt]**:
- Ein Boss ist ein Gegner mit **Phasen**. Eine neue Phase beginnt, wenn das Leben unter einen Grenzwert fällt, und jede Phase hat ihr eigenes Angriffsmuster (Abfolge oder Zufallsauswahl).
- Dazu Boss-Leiste und Arena-Auslöser (Türen zu, Musik an).

### 6.7 Fähigkeiten-Baukasten **[bestätigt]**

Eine Fähigkeit setzt sich zusammen aus:
- **Bewegung:** Schub in Blickrichtung, Gleiten, zu einem Punkt ziehen, zu einem geworfenen Gegenstand springen bzw. teleportieren, von Wänden abstoßen, kurz schweben. Zusätzlich **[Builder]**: Doppelsprung, Stampfen nach unten.
- **Auslöser:** Taste, nur in der Luft, nach dem Aufladen, bei einem Treffer.
- **Kosten und Grenzen:** Ausdauer, Abklingzeit, nur mit einer bestimmten Waffe, nur an markierten Ankerpunkten. Zusätzlich **[Builder]**: **Ladungen**, z. B. zwei Schübe hintereinander, die sich am Boden wieder aufladen. Spätere Verbesserungen können Ladungen hinzufügen. Damit lässt sich ein Schwert-Schub bauen, der am Boden ein Sprint ist und in der Luft zum Gleiten wird.
- **Effekte:** Animation, Partikel, Sound, Kamera-Wackeln. **[bestätigt; Partikel und Kamera Builder]**
- **Parameter** je Baustein: Kraft, Dauer, Richtung, Reichweite.
- **Abfolgen** **[Builder]**: Bausteine lassen sich hintereinander schalten, z. B. „Waffe werfen → beim Aufprall dorthin teleportieren“ oder „an Ankerpunkt einhaken → hinziehen → in der Luft gleiten“.
- **Freischalten im Spiel** über Altar, Gegenstand oder Merker. Dadurch sind manche Wege erst später erreichbar. **[bestätigt]**
- Der Spieler hat bis zu 3 Fähigkeitstasten plus den Spezialangriff der Waffe. **[Builder]**

### 6.8 Play-Modus und Feinschliff **[bestätigt]**

- Start in unter 1 Sekunde, an der aktuellen Kameraposition oder am Spielerstart.
- **Startzustand** **[Builder]**: Die Spielfigur beginnt mit den Startwerten und der Startausrüstung aus den Projekteinstellungen, alle Merker sind frisch. Wahlweise lässt sich ein gespeicherter **Testzustand** laden, z. B. „Schlüssel 1 und Fähigkeit Schub schon da“, um eine späte Stelle direkt zu testen.
- **Feinschliff-Regler:** Während man spielt, öffnet eine Taste (z. B. Tab) ein Seitenpanel mit Reglern für Bewegung, die aktuelle Waffe, aktive Fähigkeiten und den anvisierten Gegner. Änderungen wirken sofort. „Übernehmen“ schreibt sie ins Projekt, als ein Rückgängig-Schritt. „Verwerfen“ setzt sie zurück. **[bestätigt; Bedienung Builder]**
- Einblendbare Hilfsanzeigen: Kollisionsformen, Gegnerzustände, Laufraster. **[Builder]**
- **Was man testet, ist was man ausliefert:** Play nutzt exakt denselben Spiel-Code wie der Export. **[Builder, Anti-Ziel]**

### 6.9 Look und Licht **[bestätigt]**

- Grundeinstellung „Retro“: niedrige interne Auflösung (Vorgaben z. B. 320×180, 426×240, 640×360), pixelgenau hochskaliert. Texturen ohne Weichzeichnen. Nebel in der Ferne (Farbe, Start, Ende).
- **Regler, live im Editor sichtbar:** Auflösung, Nebel, Farbpalette begrenzen (z. B. auf die Farben des Tilesets), Dithering, wackelnde Ecken wie auf der PS1, optional die typisch verzerrten Texturen der PS1. **[bestätigt; letzter Punkt Builder]**
- **Licht:** Fackeln und Lichtquellen, die man in die Welt setzt, mit Farbe, Reichweite und optionalem Flackern, dazu Umgebungslicht. Beleuchtet wird pro Ecke, im Retro-Stil. Echtzeit-Schatten gibt es nicht. **[Builder]**
- **Himmel:** Farbverlauf oder eine Himmelstextur aus einem Tileset. **[Builder]**
- Die Einstellungen gelten pro Projekt und lassen sich pro **Region** überschreiben, z. B. ein dunkler Dungeon mit dichtem Nebel. Beim Wechsel der Region gibt es einen weichen Übergang. **[Builder]**

### 6.10 Sound **[bestätigt]**

- Import von WAV und OGG für Effekte und Musik.
- **Retro-Sound-Generator**: erzeugt Effekte über Regler, mit Vorlagen (Schlag, Treffer, Sprung, Truhe, Münze, Explosion) sowie „Zufall“ und „Abwandeln“. Gespeichert wird als WAV im Projekt. **[bestätigt; Details Builder]**
- Sounds werden Ereignissen zugeordnet: Schritte je Untergrund, Angriffe, Treffer, Türen, Truhen, Menüs. **[Builder]**
- **3D-Geräuschquellen** in der Welt (z. B. Wasserfall, Feuer) und **Musik pro Region** mit weichem Übergang. **[Builder]**
- Getrennte Lautstärken für Musik und Effekte.

### 6.11 Menüs und Anzeige **[bestätigt]**

- **Vorlagen:** Titelbild, Pause, Inventar und Ausrüstung, Stufenaufstieg, Optionen (Tasten, Lautstärke, Grafik), Spielstände.
- **Anzeige im Spiel:** Lebens- und Ausdauerleiste, Boss-Leiste, Fundmeldungen („Rostiger Schlüssel erhalten“), Fähigkeitstasten mit Abklingzeit.
- **Texttafeln und einfache Dialoge:** mehrere Seiten, optional eine Ja/Nein-Frage, die einen Merker setzt. **[Builder]**
- **Anpassen:** Farben, Schrift (mitgelieferte Pixel-Schriften oder eigene TTF/OTF), Rahmen aus einer Tileset-Kachel (9-Slice), Hintergrundbild. Ein freier Menü-Designer gehört nicht zu Version 1. **[Builder]**
- **Texte im Spiel** schreibt der Nutzer selbst, z. B. Namen, Tafeln und Dialoge. Die Menü-Vorlagen sind auf Deutsch vorbelegt, und jeder Text lässt sich ändern. **[Builder]**

### 6.12 Speichern **[bestätigt]**

- Speicherpunkte und 3 Spielstände.
- Gespeichert wird alles: Position, Werte, Inventar, Ausrüstung, freigeschaltete Fähigkeiten, Merker, geöffnete Türen, geplünderte Truhen, besiegte Bosse, aktivierte Speicherpunkte.
- Zusätzlich automatisches Speichern beim Betreten einer neuen Region und beim Bereichswechsel. **[Builder]**
- Ablage: im Windows-Programm als Datei im Benutzerordner, in der Browser-Version im Browser-Speicher (IndexedDB). **[Builder]**

### 6.13 Steuerung **[bestätigt]**

- Tastatur und Maus (Maus wird für die Ego-Sicht gefangen) sowie Gamepad (Standardbelegung).
- Tasten frei umlegbar im Optionsmenü des Spiels. Maus-Empfindlichkeit einstellbar, Y-Achse umkehrbar.

### 6.14 Export **[bestätigt]**

- **Browser-Version:** ein Ordner bzw. eine ZIP-Datei mit `index.html`, Spiel-Code und Projektdaten. Läuft ohne Internet und lässt sich direkt bei itch.io hochladen. Der Spiel-Code ohne Projektdaten soll unter 2 MB bleiben. **[Builder]**
- **Windows-Programm:** Dem Editor liegt eine fertige Abspiel-Hülle bei (ein kleines Tauri-Programm, das die Spieldaten neben sich lädt). Beim Export kopiert der Editor diese Hülle und schreibt die Spieldaten dazu. Der Nutzer braucht **keinen Compiler**. Ergebnis ist ein Ordner bzw. eine ZIP mit `.exe`. **[Builder]**
- Beim Export lassen sich Titel, Symbol, Startbild und Version des Spiels einstellen. **[Builder]**

### 6.15 Performance-Ziele **[bestätigt: 60 fps, Play < 1 s; Rest Builder]**

- 60 fps auf einem normalen Laptop mit integrierter Grafik, bei 640×360 interner Auflösung, mit einer ganzen Insel bis etwa 500 × 500 m. Das sind insgesamt bis etwa 1 Million Kacheln plus Gelände, davon bis etwa 100.000 gleichzeitig in Sichtweite.
- Gezeichnet wird nur, was in Sichtweite liegt (der Nebel begrenzt sie). Gegner, Logik und Kollision laufen nur in der Nähe des Spielers.
- Kachel setzen: sichtbare Reaktion im selben Bild. Play-Start unter 1 s, auch auf der ganzen Insel. Projekt öffnen: unter 2 s bei typischen Projekten, unter 5 s mit einer voll bebauten Insel.
- Höchstens rund 200 Zeichenaufrufe pro Bild in typischen Szenen.
- Automatisches Speichern schreibt nur die geänderten Chunks und ist deshalb auch bei großen Welten nicht spürbar.

---

## 7. Technischer Aufbau **[Builder, im Rahmen von Weg 1]**

### 7.1 Bausteine (ein Repository, mehrere Pakete)
- **engine**: Mathe (eigene kleine Vektor- und Matrix-Bibliothek auf Float32Array), WebGL2-Renderer, Szenen-Daten, Kollision, Audio (Web Audio), Eingabe (Tastatur, Maus, Gamepad).
- **runtime**: die Spiel-Regeln. Spielfigur, Kampf, Gegner-KI, Fähigkeiten, Verbindungen und Logik, Menüs, Anzeige, Speichern. Dieselbe Runtime läuft im Editor (Play) und im exportierten Spiel.
- **editor**: Oberfläche, Werkbänke, Werkzeuge, Rückgängig-System, Projektverwaltung, Exporter.
- **desktop**: Tauri-Hülle für den Editor (Dateizugriff, Fenster).
- **player**: Tauri-Abspiel-Hülle für exportierte Windows-Spiele.

### 7.2 Renderer
- Eine niedrige interne Render-Auflösung, danach pixelgenaues Hochskalieren und ein Nachbearbeitungsschritt für Palette und Dithering.
- Die Welt ist in Blöcke (Chunks, z. B. 16×16×16 Rastereinheiten) aufgeteilt. Pro Chunk und Tileset gibt es einen zusammengefassten Mesh. Gezeichnet werden nur Chunks im Sichtfeld und innerhalb der Nebel-Sichtweite. Geänderte Chunks baut der Renderer schnell neu.
- Das Gelände ist ein Höhenraster, ebenfalls in Chunks. Es wird wie Kacheln texturiert und gezeichnet.
- Die ganze Welt bleibt im Speicher, bei diesem Grafikstil passt das bequem. Aktiv sind nur die Teile in der Nähe des Spielers. Echtes Nachladen von der Festplatte während des Spielens ist in Version 1 nicht nötig, das Format lässt es aber später zu.
- Nearest-Filter, Beleuchtung pro Ecke, Nebel und PS1-Effekte laufen im Shader.
- Im Editor nutzt die Ansicht dieselbe Engine, mit Hilfsebenen für Raster, 3D-Cursor, Auswahl und Vorschau.

### 7.3 Kollision und Physik
- Die Spielfigur ist eine Kapsel. Kollidiert wird mit den Dreiecken aus Kacheln, Gelände und Modellen, die nach Chunks organisiert sind. Geprüft werden nur die Chunks um Spieler und aktive Gegner. Dazu automatisches Hochsteigen von Stufen und eine Grenze für steile Hänge.
- Gegner sind ebenfalls Kapseln. Waffentreffer werden über Schlagbögen bzw. Strahlen geprüft.
- Physik nur so weit nötig: Schwerkraft, Sprünge und Schübe aus Fähigkeiten, Geschosse. Keine allgemeine Physik-Engine.

### 7.4 Daten und Dateien
- Projektordner: `projekt.json` (Einstellungen, Liste der Inhalte), `welten/<name>/welt.json` (Regionen, Objekte, Verbindungen), `welten/<name>/chunks/<x>_<y>_<z>.*` (Kacheln und Gelände je Chunk), `modelle/*.json`, `tilesets/*.png`, `texturen/*.png`, `sounds/*`, `spiel/*.json` (Waffen, Gegner, Fähigkeiten, Gegenstände, Menüs).
- Weil jeder Chunk eine eigene Datei ist, bleiben die Dateien klein, und das automatische Speichern schreibt nur Geändertes.
- Jedes Format hat eine **Versionsnummer** und Umwandlungen, damit alte Projekte nach Updates weiter funktionieren.
- Große Geometrie darf kompakt gespeichert werden (z. B. als Zahlenreihen). Die Dateien bleiben lesbar und gut für Versionsverwaltung geeignet.
- Automatisches Speichern alle paar Sekunden und vor jedem Play. Die letzten 10 Versionen bleiben als Sicherung erhalten.
- Im Browser (Etappen vor dem Windows-Programm) wird über die File System Access API gespeichert, wenn verfügbar, sonst im Browser-Speicher mit ZIP-Export und -Import.

### 7.5 Oberfläche
- HTML/CSS mit einem kleinen, schnellen UI-Framework (z. B. Solid oder Preact mit Signals). Die Wahl trifft der Builder.
- Design-Werte aus Entwurf B (Farben, Schrift, Abstände) zentral als CSS-Variablen.

### 7.6 Qualität
- Unit-Tests für Geometrie (Kachel-Operationen, Formen biegen, Extrudieren), Kollision, Kampfregeln, Fähigkeiten, Verbindungen, Speichern und Laden sowie Projektformat-Umwandlungen.
- Browser-Tests (Playwright, Headless-Chromium) für die Hauptabläufe jeder Etappe sowie Bildvergleichs-Tests für den Renderer.
- Eine feste Test-Szene als Leistungsmessung für die Performance-Ziele.

---

## 8. Etappen

Jede Etappe endet mit etwas Benutzbarem. Bis zum Windows-Programm läuft der Editor im Browser (Chrome oder Edge). Jede Etappe gibt es als Testversion, als Link zum Ausprobieren im Browser. Windows-Testversionen kommen dazu, sobald die Desktop-Hülle steht. **[Builder]**

**Etappe 1 – Fundament.** Zuerst wird das private GitHub-Repository mit automatischen Builds (Tests und Testversion) eingerichtet. Fertig ist die Etappe, wenn man:
- ein Projekt anlegt, speichert und wieder öffnet (mit automatischem Speichern),
- ein Tileset importiert und Kacheln auswählt,
- Kacheln auf Boden, Wänden und schrägen Flächen setzt, dreht und spiegelt, Blöcke setzt, füllt, radiert und aufnimmt,
- auswählt, verschiebt und Ecken und Kanten biegt (Rampe, Schrägdach, Giebel),
- mit Ebenen arbeitet und alles rückgängig machen kann,
- mit „Play“ in Ego-Sicht durch das Level läuft und springt, mit Kollision an Wänden, Rampen und Stufen,
- das alles in der Oberfläche von B mit Kürzeln und Hinweis-Kärtchen tut, bei 60 fps,
- und eine große, automatisch erzeugte Test-Welt (etwa 500 × 500 m aus Kacheln) im Editor und im Play-Modus flüssig läuft. Damit ist gesichert, dass das Chunk-Format von Anfang an für eine ganze Insel taugt.

**Etappe 2 – Erster spielbarer Dungeon.** Fertig, wenn:
- es die Regeln-Werkbank mit Spielerstart, Gegner (Platzhalter), Truhe, Gegenstand, Tür, Schlüssel, Hebel, Druckplatte, Speicherpunkt, Auslöser-Zone und Texttafel gibt, plus Verbindungen,
- man Nahkampf (leicht und aufgeladen) mit Ausdauer machen kann,
- Gegner patrouillieren, bemerken, verfolgen und angreifen,
- Tod und Neustart am Speicherpunkt funktionieren und Leben und Ausdauer angezeigt werden,
- der Browser-Export ohne Internet läuft.

**Etappe 3 – Modell-Werkstatt.** Fertig, wenn:
- es Grundformen gibt, man Ecken, Kanten und Flächen bearbeiten, extrudieren und spiegeln kann,
- man direkt auf dem Modell malen und UVs bearbeiten kann,
- Teile und Animations-Clips mit Markierungen funktionieren,
- Modelle als Requisiten in der Welt, als Gegner (mit Animationen) und als Waffen in der Hand nutzbar sind.

**Etappe 4 – Tiefe.** Fertig, wenn es Folgendes gibt:
- den Fähigkeiten-Baukasten mit allen Bausteinen, Abfolgen und Freischalten, plus Ankerpunkte,
- Wurfwaffen und Spezialangriffe,
- Ausrüstung, Inventar, Erfahrungspunkte und Stufenaufstieg,
- Bosse mit Phasen, Boss-Leiste und Arena,
- die Feinschliff-Regler im Play-Modus samt Übernehmen und Verwerfen.

**Etappe 5 – Atmosphäre.** Fertig, wenn es Folgendes gibt:
- Look-Regler (Auflösung, Nebel, Palette, Dithering, PS1-Effekte) live im Editor und im Spiel,
- Lichtquellen mit Flackern, Himmel, Einstellungen pro Bereich,
- animierte Kacheln und Sprites,
- Sound-Import, Zuordnung zu Ereignissen, 3D-Geräuschquellen, Musik pro Region und den Retro-Sound-Generator,
- den Gelände-Pinsel,
- den Pixel-Mal-Editor für Tilesets.

**Etappe 6 – Fertig machen.** Fertig, wenn es Folgendes gibt:
- Menü-Vorlagen (Titel, Pause, Inventar, Optionen, Spielstände) zum Anpassen,
- 3 Spielstände und automatisches Speichern beim Betreten von Regionen und bei Bereichswechseln,
- Gamepad-Unterstützung und frei belegbare Tasten,
- den Windows-Export über die Abspiel-Hülle,
- den Editor als Windows-Programm,
- das Beispielprojekt „Inselruine“ mit eigenem Start-Tileset, Modellen und Sounds, alles original.

---

## 9. Dem Builder überlassen

- Genaue Zahlen und Grenzen: Chunk-Größe, Auflösungs-Vorgaben, Standardwerte für Bewegung, Kampf und KI, Speicher-Takt.
- Dateiformate im Detail, Aufbau des Rückgängig-Systems, Wahl des UI-Frameworks und kleiner Hilfsbibliotheken.
- Genaue Tastenbelegung (Grundlage sind die Tasten aus Entwurf B), Texte und Beschriftungen, Symbole.
- Aussehen der Modell- und Regeln-Werkbank im Stil von B. Die bisherigen Entwürfe zeigen nur die Welt-Werkbank.
- Reihenfolge innerhalb einer Etappe, solange das Ergebnis am Ende der Etappe steht.
- Welche Pixel-Schriften mitgeliefert werden (frei lizenziert).

---

## 10. Offene Punkte

1. **GitHub einrichten.** Vor Etappe 1 braucht der Nutzer ein GitHub-Konto, das mit Claude verbunden ist, und ein privates Repository für das Projekt. Das wird beim Start von Etappe 1 gemeinsam erledigt.
2. **Name des Programms.** Noch offen, bis dahin Arbeitstitel „Retro-Game-Maker“. Das ändert nichts am Bauen.
