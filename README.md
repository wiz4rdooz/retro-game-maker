# Retro-Game-Maker

Ein eigenes Programm, um Retro-3D-Spiele zu bauen – im Stil von Crocotile 3D und picoCAD, aber mit eigenem Code und eigener Oberfläche. Welten entstehen aus Kacheln (Tiles), die man direkt in 3D malt; mit **F5** läuft man sofort in Ego-Sicht hindurch.

**Stand: Etappe 1 (Fundament).** Welten bauen und darin herumlaufen:

- Tileset-PNG laden, Kacheln malen, Blöcke setzen, füllen, radieren, Pipette
- Auswählen, verschieben, drehen, skalieren, Ecken und Kanten biegen (Rampen), extrudieren
- Ebenen (ausblenden, sperren, umbenennen), Rückgängig/Wiederholen (Strg+Z / Strg+Y)
- Automatisches Speichern im Browser oder in einem Ordner auf dem PC, ZIP-Export/-Import
- Play-Modus (F5): Laufen, Rennen, Springen, Kollision mit Wänden, Stufen und Hängen
- Test-Insel (Leistungstest) mit rund 275.000 Kacheln, Statistik mit F3

Gegner, Kampf und die Regel-Werkbank folgen in Etappe 2, die Modell-Werkstatt in Etappe 3.

## Loslegen

Voraussetzung: Node.js 22 und ein aktueller Chrome oder Edge (WebGL2).

```bash
npm install
npm run dev        # Editor im Browser unter http://localhost:5173
```

## Prüfen und bauen

```bash
npm run typecheck  # TypeScript für engine, runtime und editor
npm test           # Unit-Tests (Vitest)
npm run bench      # Leistungsmessungen (Test-Insel, Vernetzen, Raycasts, Spielfigur)
CHROME_PATH=/usr/bin/google-chrome npm run test:e2e   # Oberflächen-Tests (Playwright)
npm run build      # fertige Web-Version in packages/editor/dist
```

`CHROME_PATH` zeigt auf einen installierten Chrome. Ohne die Variable nutzt Playwright seinen eigenen Browser (`npx playwright install chromium`).

## Aufbau

| Paket | Inhalt |
|---|---|
| `packages/engine` | Welt aus Kachel-Chunks, Geometrie, Vernetzen, WebGL2-Renderer, Picking, Kollision, Dateiformat |
| `packages/runtime` | Spielfigur in Ego-Sicht und Play-Sitzung |
| `packages/editor` | Oberfläche (Preact), Werkzeuge, Rückgängig-System, Speichern, Play-Modus |

Grenzen: Die Engine importiert weder Runtime noch Editor, die Runtime nur die Engine.

## Bedienung in Kürze

| Taste | Wirkung |
|---|---|
| B / K / A / G / I / E | Kachel malen / Block setzen / Auswählen / Füllen / Pipette / Radieren |
| Rechte Maustaste + Ziehen | Umsehen, dazu W/A/S/D/Q/E zum Fliegen |
| Rad · Leertaste + Ziehen | Zoomen · Verschieben |
| Q · Bild↑/Bild↓ | Zeichenebene wechseln · Ebene verschieben |
| R · X | Pinsel drehen · spiegeln |
| F5 · Esc | Spielen · zurück zum Editor |
| F3 | Statistik (Bilder/s, Zeichenaufrufe, Dreiecke) |

## Unterlagen

- Spezifikation: [`docs/superpowers/specs/2026-11-24-retro-game-maker-design.md`](docs/superpowers/specs/2026-11-24-retro-game-maker-design.md)
- Plan Etappe 1: [`docs/superpowers/plans/2026-11-24-etappe-1-fundament.md`](docs/superpowers/plans/2026-11-24-etappe-1-fundament.md)
- Oberflächen-Entwurf: [`docs/design/entwurf-b-klar-dunkel.dc.html`](docs/design/entwurf-b-klar-dunkel.dc.html)
