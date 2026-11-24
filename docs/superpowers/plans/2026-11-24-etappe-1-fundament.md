# Etappe 1 – Fundament: Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Am Ende von Etappe 1 läuft im Browser ein Welt-Editor im Look von Entwurf B. Man legt Projekte an, speichert sie und öffnet sie wieder. Man importiert Tilesets, setzt Kacheln und Blöcke, füllt, radiert, wählt aus, biegt Formen und arbeitet mit Ebenen und Rückgängig. Mit „Play“ läuft man in Ego-Sicht durch die Welt, mit Kollision. Eine 500 × 500 m große Test-Insel läuft flüssig.

**Architecture:** Ein npm-Workspace mit drei Paketen. `@rgm/engine` enthält Mathe, Welt-Daten in Chunks, Geometrie, Mesher, Picking, WebGL2-Renderer, Kollision und Serialisierung, ohne DOM-Annahmen außer im Renderer. `@rgm/runtime` enthält die Spielfigur und die Play-Sitzung und nutzt nur die Engine. `@rgm/editor` ist eine Vite-Preact-App mit Werkzeugen, Undo-System, Speicher-Backends und Oberfläche. Play im Editor nutzt exakt den Runtime-Code, den später auch der Export nutzt.

**Tech Stack:** TypeScript 7 (strict), Vite 8, Preact 11 + @preact/signals 2, Vitest 5, Playwright 1.65, fflate, idb-keyval, fake-indexeddb (Tests), @fontsource/inter, @fontsource/jetbrains-mono, Node ≥ 22.12, WebGL2.

**Spec:** `docs/superpowers/specs/2026-11-24-retro-game-maker-design.md` (Abschnitte 6.1–6.3, 6.8, 6.15, 7, 8 „Etappe 1“). Oberflächen-Vorlage: `docs/design/entwurf-b-klar-dunkel.dc.html` (Markup, Farben und Icon-Pfade aus Entwurf B).

## Global Constraints

- Sprache der Oberfläche: Deutsch. Alle sichtbaren Texte stehen in `packages/editor/src/strings/de.ts`, keine Texte direkt in Komponenten.
- Eigener Code: kein three.js, keine Game-Engine. Erlaubte Laufzeit-Bibliotheken: preact, @preact/signals, fflate, idb-keyval, @fontsource/inter, @fontsource/jetbrains-mono. Weitere nur mit Begründung im Commit.
- Paketgrenzen: `engine` importiert weder `runtime` noch `editor`; `runtime` importiert nur `engine`. `engine` und `runtime` greifen nicht auf `window`/`document` zu (Ausnahme: `engine/src/render/*`).
- Koordinaten: rechtshändig, **Y zeigt nach oben**, 1 Einheit = 1 Meter = 1 Rasterzelle. Spielfigur 1,7 m. `CHUNK_SIZE = 32`.
- Performance (Spec 6.15): 60 fps auf normalem Laptop; Play-Start unter 1 s; Projekt öffnen unter 2 s (typisch), unter 5 s (voll bebaute Insel); rund 200 Zeichenaufrufe pro Bild höchstens; automatisches Speichern schreibt nur geänderte Chunks; „Kachel setzen: sichtbare Reaktion im selben Bild“.
- Grenzen pro Operation: höchstens **65.536 Kacheln** (Rechteck, Füllen, Radieren-Rechteck), höchstens **4.096 Blöcke**. Darüber passiert nichts, und die Statusleiste zeigt `t.status.zuGross`.
- Undo-Verlauf: 200 Schritte oder 256 MB (geschätzt mit 96 Byte pro Kachel-Datensatz), ältere Schritte fallen weg.
- Design-Tokens aus Entwurf B (CSS-Variablen in `theme.css`): `--bg #111214`, `--panel #17181b`, `--panel-2 #1f2126`, `--border #2a2d33`, `--border-strong #2f333a`, `--text #e7e9ee`, `--muted #9aa0ab`, `--muted-2 #b4bac4`, `--icon #c3c8d0`, `--accent #4d9fff`, `--accent-soft #24364f`, `--accent-text #8cc2ff`, `--tab-active #2c3a50`, `--on-accent #08111f`, `--viewport-bg #16181b`, `--warn #ffb36b`. Schriften: Inter (400/500/600), JetBrains Mono (400/500) für Zahlen.
- Bedienelemente mindestens 44 px hoch (wie in Entwurf B). Alle Maße in `rem`, `html { font-size: calc(16px * var(--ui-scale)) }`, UI-Größe 100–200 %.
- Werkzeug-Tasten: B Kachel malen, K Block setzen, A Auswählen, G Füllen, I Pipette, E Radieren (M Modell platzieren erst ab Etappe 3, in Etappe 1 nicht sichtbar). F5 Play, Strg+Z Rückgängig, Strg+Y / Strg+Umschalt+Z Wiederholen, Strg+S Speichern.
- Clean Room: kein Code, keine Grafiken, keine Oberflächen aus Crocotile 3D oder picoCAD.
- Browser: aktuelles Chrome/Edge; ohne WebGL2 erscheint `t.fehler.keinWebgl2`.
- Commit-Nachrichten enden mit den Attribution-Zeilen, die die Sitzung vorgibt.

## Review Focus

1. **Browser-Standardtasten und Tippen in Textfeldern:** F5, Strg+S und Strg+R dürfen nie die Seite neu laden oder „Seite speichern“ öffnen. Werkzeug-Tasten dürfen nicht auslösen, während jemand in ein Textfeld tippt (Ebenen-Name, Projektname). Erwartung: Arbeit geht nie durch einen versehentlichen Reload verloren. → Test in Task 10 und Task 16.
2. **Tileset-Dateien mit Sonderfällen:** Bildgröße nicht durch die Kachelgröße teilbar, Bild größer als die maximale Texturgröße, Datei ist kein Bild, Bild kleiner als eine Kachel. Erwartung: klare deutsche Meldung, kein Absturz; Ränder werden ignoriert und gemeldet. → Tests in Task 11.
3. **Speichern schlägt fehl:** Speicher voll, Ordner-Berechtigung entzogen, Schreibfehler mitten im Speichern. Erwartung: Status „Nicht gespeichert“, nichts geht im Speicher verloren, der nächste Versuch schreibt alles Ausstehende. → Test in Task 9.
4. **Kaputte Geometrie durch Formen biegen:** zusammengeführte Ecken (Dreieck, Linie, Punkt), Flächen mit Fläche 0, NaN-Koordinaten aus alten Dateien. Erwartung: Mesher, Picking und Kollision laufen weiter, es entsteht nie NaN in Kamera oder Spielfigur. → Tests in Task 4, 5, 7 und 15.
5. **Riesige Operationen:** Rechteck über die halbe Insel, Füllen einer riesigen Fläche, Rückgängig davon. Erwartung: Ablehnen mit Meldung über der Grenze; darunter bleibt die Oberfläche bedienbar, und Rückgängig stellt alles exakt wieder her. → Tests in Task 8, 13 und 14.

---

## Konventionen (gelten für alle Tasks)

**K1 Kachel-Ecken.** `corners: Float32Array(12)` = c0, c1, c2, c3 (je x, y, z), gegen den Uhrzeigersinn **von der Vorderseite** gesehen, c0 = unten links. Normale = normalize((c1−c0) × (c3−c0)). Dreiecke: (c0, c1, c2) und (c0, c2, c3). Eine Fläche ist **vorne**, wenn `dot(Blickrichtung, Normale) < 0`.

**K2 Zellen-Viereck `cellQuad(plane, u, v, s)`.** Eine Ebene ist `{ axis: 'x'|'y'|'z', offset: number, facing: 1|-1 }` (alle Punkte mit `p[axis] = offset`, Normale = `facing` entlang `axis`). Ebenen-Koordinaten: axis y → (u = x, v = z); axis z → (u = x, v = y); axis x → (u = z, v = y). Mit o = offset:

| axis | facing | c0 | c1 | c2 | c3 |
|---|---|---|---|---|---|
| y | +1 | (u, o, v+s) | (u+s, o, v+s) | (u+s, o, v) | (u, o, v) |
| y | −1 | (u, o, v) | (u+s, o, v) | (u+s, o, v+s) | (u, o, v+s) |
| z | +1 | (u, v, o) | (u+s, v, o) | (u+s, v+s, o) | (u, v+s, o) |
| z | −1 | (u+s, v, o) | (u, v, o) | (u, v+s, o) | (u+s, v+s, o) |
| x | +1 | (o, v, u+s) | (o, v, u) | (o, v+s, u) | (o, v+s, u+s) |
| x | −1 | (o, v, u) | (o, v, u+s) | (o, v+s, u+s) | (o, v+s, u) |

Muster-Abbildung für mehrteilige Pinsel (Textur-rechts / Textur-unten je Ebene): `du = i`, außer bei (z, −1) und (x, +1): `du = w−1−i`. `dv = j` bei (y, +1), sonst `dv = h−1−j`.

**K3 UV-Regel.** BASE = [[0,1],[1,1],[1,0],[0,0]] (u nach rechts, v nach unten, innerhalb einer Kachel). Für Ecke i: `(u,v) = BASE[(i + rot) % 4]`, dann `flipX → u = 1−u`, `flipY → v = 1−v`. `rot = k` bedeutet k × 90° **im Uhrzeigersinn**. Pixel → normiert mit Einzug 0,01 px: `U = (tx·ts + clamp(u·ts, 0.01, ts−0.01)) / imgW`, `V = (ty·ts + clamp(v·ts, 0.01, ts−0.01)) / imgH`. Texturen werden ohne Y-Flip hochgeladen (V = 0 ist die oberste Bildzeile).

**K4 Bit-Feld einer Kachel.** Bits 0–1 `rot`, Bit 2 `flipX`, Bit 3 `flipY`, Bit 4 `doubleSided`, Bit 5 `ghost` (keine Kollision). Bit 6 ist für „nicht begehbar“ reserviert; das Flag kommt mit der Wegfindung in Etappe 2. In Etappe 1 entscheidet allein die Hangneigung (Task 7), ob eine Fläche begehbar ist.

**K5 Chunks.** Eine Kachel gehört zu dem Chunk, der ihren Schwerpunkt enthält. `cx = floor(x / 32)` usw., zulässig −512 … 511. Schlüssel = `((cx+512) << 20) | ((cy+512) << 10) | (cz+512)` (nicht negativ, < 2³⁰). Dateiname `${cx}_${cy}_${cz}.json`.

**K6 Schattierung.** `faceShade(n) = clamp(0.55 + 0.45·dot(n, L), 0.4, 1)` mit `L = normalize(0.35, 1, 0.6)`.

**K7 Kamera.** `yaw = 0` blickt nach −Z. `forward = (−sin yaw·cos pitch, sin pitch, −cos yaw·cos pitch)`, `pitch ∈ [−89°, 89°]`. Sichtfeld: Editor 70°, Play 75°; near 0,05, far 1000. Ortho-Ansichten: `top` blickt nach −Y (Bild-oben = −Z), `front` blickt nach −Z, `side` blickt nach −X; `scale` = halbe sichtbare Höhe in Metern. Sichtweite standardmäßig 160 m, Nebel von 110 bis 160 m in `--viewport-bg`.

**K8 Projekt-Dateien.** `projekt.json`, `welten/<welt>/welt.json`, `welten/<welt>/chunks/<cx>_<cy>_<cz>.json`, `tilesets/<name>.png`, Sicherungen unter `.sicherung/<0–9>/<pfad>` plus `.sicherung/zaehler.txt`.

---

## Dateistruktur

```
retro-game-maker/
  package.json · tsconfig.base.json · vitest.config.ts · playwright.config.ts · .gitignore · README.md
  .github/workflows/ci.yml
  scripts/make-fixtures.mjs
  docs/design/entwurf-b-klar-dunkel.dc.html            (Vorlage, schon vorhanden)
  packages/engine/
    package.json · tsconfig.json
    src/index.ts
    src/math/vec3.ts · mat4.ts · intersect.ts           (Vektoren, Matrizen, Strahl-Tests)
    src/world/keys.ts · types.ts · chunk.ts · world.ts  (Chunk-Schlüssel, Datentypen, Kachel-Speicher)
    src/world/serialize.ts · testIsland.ts
    src/geometry/plane.ts · quad.ts · uv.ts · block.ts · adjacency.ts · transform.ts · extrude.ts
    src/mesh/chunkMesher.ts
    src/pick/raycast.ts
    src/render/camera.ts · frustum.ts · gl.ts · shaders.ts · tileRenderer.ts · lineRenderer.ts
    src/collision/closest.ts · capsule.ts · triangles.ts
    tests/*.test.ts · bench/*.bench.ts
  packages/runtime/
    package.json · tsconfig.json · src/index.ts
    src/player/playerConfig.ts · fpsController.ts
    src/play/playSession.ts
    tests/*.test.ts
  packages/editor/
    package.json · tsconfig.json · vite.config.ts · index.html
    src/main.tsx · src/strings/de.ts · src/app/theme.css · src/app/App.tsx · src/app/session.ts · src/app/testHooks.ts
    src/state/editorState.ts · src/state/prefs.ts
    src/commands/command.ts · history.ts · tileCommands.ts · layerCommands.ts · tilesetCommands.ts
    src/project/projectModel.ts · storage.ts · memoryStorage.ts · idbStorage.ts · folderStorage.ts · projectIO.ts · zip.ts · autosave.ts · recentProjects.ts · testTileset.ts
    src/tileset/validateTileset.ts · importTileset.ts
    src/viewport/viewportController.ts · cameraController.ts · keyboard.ts · Viewport.tsx · AxisGizmo.tsx
    src/tools/tool.ts · brush.ts · drawPlane.ts · paintTool.ts · eyedropperTool.ts · eraseTool.ts · blockTool.ts · fillTool.ts · selectTool.ts · selection.ts · registry.ts
    src/play/playController.ts · PlayOverlay.tsx
    src/ui/TopBar.tsx · ToolRail.tsx · RightPanel.tsx · TilesetPanel.tsx · BrushPanel.tsx · SelectionPanel.tsx · LayersPanel.tsx · StatusBar.tsx · HintCard.tsx · StartScreen.tsx · Dialogs.tsx · SettingsDialog.tsx · StatsOverlay.tsx · icons.tsx
    tests/*.test.ts
    e2e/*.spec.ts · e2e/helpers.ts · e2e/fixtures/*.png
```

---

### Task 1: Workspace, Mathe-Bibliothek und CI

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `vitest.config.ts`, `.gitignore`, `.github/workflows/ci.yml`, `packages/engine/package.json`, `packages/engine/tsconfig.json`, `packages/engine/src/index.ts`, `packages/engine/src/math/vec3.ts`, `packages/engine/src/math/mat4.ts`, `packages/engine/src/math/intersect.ts`
- Test: `packages/engine/tests/math.test.ts`

**Interfaces:**
- Produces:
  - `type Vec3 = Float32Array` (Länge 3). `vec3`: `create(x=0,y=0,z=0)`, `set(out,x,y,z)`, `copy(out,a)`, `add(out,a,b)`, `sub(out,a,b)`, `scale(out,a,s)`, `scaleAndAdd(out,a,b,s)`, `dot(a,b)`, `cross(out,a,b)`, `length(a)`, `distance(a,b)`, `normalize(out,a)` (Nullvektor bleibt 0), `lerp(out,a,b,t)`. Eingaben sind `ArrayLike<number>`, Rückgabe ist `out`.
  - `type Mat4 = Float32Array` (16, spaltenweise wie WebGL). `mat4`: `create()`, `identity(out)`, `multiply(out,a,b)`, `perspective(out,fovYRad,aspect,near,far)`, `ortho(out,l,r,b,t,n,f)`, `lookAt(out,eye,target,up)`, `invert(out,a): boolean`, `transformPoint(out,m,p)` (mit w-Division).
  - `rayTriangle(o, d, a, b, c, cullBack: boolean): number` gibt t ≥ 0 oder −1 zurück (Möller–Trumbore, Toleranz 1e-7).
  - `rayAabb(o, invD, min, max): number` gibt den Eintritts-t (≥ 0, 0 wenn innen) oder −1 zurück.
  - Root-Skripte: `typecheck`, `test`, `test:e2e`, `build`, `dev`, `bench`.

- [ ] **Step 1: Workspace anlegen und den fehlschlagenden Test schreiben**

`package.json`: `"private": true, "type": "module", "workspaces": ["packages/*"]`, Skripte:
`"typecheck": "tsc -p packages/engine && tsc -p packages/runtime && tsc -p packages/editor"` (Pakete, die es noch nicht gibt, kommen in ihren Tasks dazu; bis dahin nur engine), `"test": "vitest run"`, `"bench": "vitest bench --run"`, `"test:e2e": "playwright test"`, `"build": "npm run build -w @rgm/editor"`, `"dev": "npm run dev -w @rgm/editor"`. Dev-Abhängigkeiten: `typescript@^7`, `vitest@^5`, `@types/node@^22`.
`tsconfig.base.json`: `strict`, `target ES2022`, `module ESNext`, `moduleResolution bundler`, `lib [ES2023, DOM, DOM.Iterable]`, `noEmit`, `isolatedModules`, `skipLibCheck`.
`packages/engine/package.json`: `name @rgm/engine`, `"exports": { ".": "./src/index.ts" }`.
`vitest.config.ts`: `include: ['packages/*/tests/**/*.test.{ts,tsx}']`, `environment: 'node'`, `testTimeout: 10000`.

```ts
// packages/engine/tests/math.test.ts
import { describe, it, expect } from 'vitest';
import { vec3, mat4, rayTriangle, rayAabb } from '../src';

describe('vec3', () => {
  it('cross und normalize', () => {
    const c = vec3.cross(vec3.create(), [1, 0, 0], [0, 1, 0]);
    expect(Array.from(c)).toEqual([0, 0, 1]);
    expect(Array.from(vec3.normalize(vec3.create(), [0, 0, 0]))).toEqual([0, 0, 0]);
    expect(vec3.length(vec3.normalize(vec3.create(), [3, 4, 0]))).toBeCloseTo(1, 6);
  });
});
describe('mat4', () => {
  it('lookAt + perspective bilden einen Punkt vor der Kamera in die Bildmitte ab', () => {
    const v = mat4.lookAt(mat4.create(), [0, 0, 5], [0, 0, 0], [0, 1, 0]);
    const p = mat4.perspective(mat4.create(), Math.PI / 2, 1, 0.1, 100);
    const vp = mat4.multiply(mat4.create(), p, v);
    const ndc = mat4.transformPoint(vec3.create(), vp, [0, 0, 0]);
    expect(ndc[0]).toBeCloseTo(0, 6); expect(ndc[1]).toBeCloseTo(0, 6);
    expect(ndc[2]).toBeGreaterThan(-1); expect(ndc[2]).toBeLessThan(1);
  });
  it('invert(m)·m = Einheit', () => {
    const m = mat4.lookAt(mat4.create(), [1, 2, 3], [4, 0, -2], [0, 1, 0]);
    const inv = mat4.create(); expect(mat4.invert(inv, m)).toBe(true);
    const id = mat4.multiply(mat4.create(), inv, m);
    for (let i = 0; i < 16; i++) expect(id[i]).toBeCloseTo(i % 5 === 0 ? 1 : 0, 5);
  });
});
describe('Strahltests', () => {
  const a = [0, 0, 0], b = [1, 0, 0], c = [0, 0, -1]; // Normale +Y
  it('trifft das Dreieck von oben bei t = 2', () => {
    expect(rayTriangle([0.2, 2, -0.2], [0, -1, 0], a, b, c, true)).toBeCloseTo(2, 6);
  });
  it('cullBack ignoriert die Rückseite', () => {
    expect(rayTriangle([0.2, -2, -0.2], [0, 1, 0], a, b, c, true)).toBe(-1);
    expect(rayTriangle([0.2, -2, -0.2], [0, 1, 0], a, b, c, false)).toBeCloseTo(2, 6);
  });
  it('rayAabb', () => {
    expect(rayAabb([-5, 0.5, 0.5], [1, Infinity, Infinity], [0, 0, 0], [1, 1, 1])).toBeCloseTo(5, 6);
    expect(rayAabb([-5, 2, 0.5], [1, Infinity, Infinity], [0, 0, 0], [1, 1, 1])).toBe(-1);
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npm install && npx vitest run packages/engine/tests/math.test.ts`
Expected: FAIL, weil `../src` keine Exporte `vec3`, `mat4`, `rayTriangle`, `rayAabb` hat.

- [ ] **Step 3: `vec3.ts`, `mat4.ts`, `intersect.ts` implementieren und in `src/index.ts` als `export * as vec3`, `export * as mat4`, `export { rayTriangle, rayAabb }` freigeben**

- [ ] **Step 4: Tests und Typprüfung laufen lassen**

Run: `npx vitest run packages/engine/tests/math.test.ts && npm run typecheck`
Expected: PASS, keine Typfehler.

- [ ] **Step 5: CI-Workflow anlegen**

`.github/workflows/ci.yml`: bei `push` und `pull_request` auf `ubuntu-latest`: `actions/checkout@v5`, `actions/setup-node@v5` (Node 22, npm-Cache), `npm ci`, `npm run typecheck`, `npm test`. Die Schritte für Build, E2E und Upload ergänzt Task 10. `.gitignore`: `node_modules`, `dist`, `test-results`, `playwright-report`, `.vite`.

- [ ] **Step 6: Git einrichten und committen**

```bash
git init -b main && git add -A && git commit -m "chore: Workspace, Mathe-Bibliothek und CI"
```
Danach (Koordinator): `gh auth status` prüfen. Wenn angemeldet: `gh repo create retro-game-maker --private --source . --push`. Wenn nicht: den Nutzer bitten, GitHub mit Claude zu verbinden und ein leeres privates Repository `retro-game-maker` anzulegen; dann `git remote add origin …` und `git push -u origin main`. Lokal kann ohne Remote weitergearbeitet werden; gepusht wird, sobald es geht.

---

### Task 2: Welt-Daten in Chunks

**Files:**
- Create: `packages/engine/src/world/keys.ts`, `types.ts`, `chunk.ts`, `world.ts`
- Test: `packages/engine/tests/world.test.ts`

**Interfaces:**
- Consumes: `vec3` (Task 1).
- Produces:
  - `CHUNK_SIZE = 32`; `chunkKey(cx,cy,cz): number` (RangeError außerhalb −512…511); `chunkCoords(key): [number, number, number]`; `chunkKeyForPoint(x,y,z): number`.
  - `interface TileData { layer: number; tileset: number; tx: number; ty: number; rot: 0|1|2|3; flipX: boolean; flipY: boolean; doubleSided: boolean; ghost: boolean; corners: Float32Array }`
  - `interface Layer { id: number; name: string; visible: boolean; locked: boolean }`
  - `packBits(t): number` / `unpackBits(bits): Pick<TileData,'rot'|'flipX'|'flipY'|'doubleSided'|'ghost'>` nach K4.
  - `class Chunk { readonly key: number; count: number; ids: Uint32Array; layer: Uint16Array; tileset: Int16Array /*−1 = eingebaute Prüftextur*/; txy: Uint16Array /*2 je Kachel*/; bits: Uint8Array; corners: Float32Array /*12 je Kachel*/; readonly min: Float32Array; readonly max: Float32Array; indexOf(id): number /* -1 */; read(index): TileData }`. Typisierte Arrays wachsen durch Verdoppeln (Start 64); Entfernen mit Swap-Remove; `min`/`max` werden beim Hinzufügen erweitert und erst bei `count === 0` zurückgesetzt.
  - `class World { constructor(chunkSize = CHUNK_SIZE); readonly chunkSize; readonly chunks: ReadonlyMap<number, Chunk>; layers: Layer[]; nextTileId: number /*ab 1*/; nextLayerId: number /*ab 1*/; addTile(t, id?): number; removeTile(id): TileData | null; getTile(id): TileData | null; setTile(id, t): void; hasTile(id): boolean; tileCount(): number; chunkKeyOf(id): number | undefined; findCoincident(corners, facing: 'same'|'opposite'|'any', eps = 1e-4): number | null; queryAabb(min, max, cb: (id, chunk, index) => void): void; takeRenderDirty(): Set<number>; takeSaveDirty(): Set<number>; markAllRenderDirty(): void; addLayer(name, id?): Layer; removeLayer(id): void; layerTileCount(id): number; bounds(): { min: Float32Array; max: Float32Array } | null }`
  - `addTile` mit vorhandener id wirft einen Fehler; mit `id ≥ nextTileId` wird `nextTileId = id + 1`. `findCoincident` sucht nur im Chunk des Schwerpunkts: gleiche vier Eckpunkte als Menge (Reihenfolge egal); `'same'`/`'opposite'` vergleicht die Normalen (dot > 0,99 bzw. < −0,99). `removeLayer` wirft, solange die Ebene Kacheln hat. Jede Änderung trägt die betroffenen Chunk-Schlüssel in beide Dirty-Mengen ein.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

```ts
// packages/engine/tests/world.test.ts
import { describe, it, expect } from 'vitest';
import { World, chunkKey, chunkCoords, chunkKeyForPoint, type TileData } from '../src';

const floor = (x: number, y: number, z: number, layer = 1): TileData => ({
  layer, tileset: 0, tx: 1, ty: 2, rot: 0, flipX: false, flipY: false, doubleSided: false, ghost: false,
  corners: new Float32Array([x, y, z + 1, x + 1, y, z + 1, x + 1, y, z, x, y, z]),
});

describe('Chunk-Schlüssel', () => {
  it('negative Koordinaten runden nach unten', () => {
    expect(chunkCoords(chunkKeyForPoint(-0.5, 0, -0.5))).toEqual([-1, 0, -1]);
    expect(chunkCoords(chunkKey(511, -512, 3))).toEqual([511, -512, 3]);
    expect(() => chunkKey(512, 0, 0)).toThrow(RangeError);
  });
});
describe('World', () => {
  it('add/get/remove mit stabilen ids', () => {
    const w = new World(); w.addLayer('Ebene 1');
    const id = w.addTile(floor(2, 0, 3));
    expect(id).toBe(1);
    expect(w.getTile(id)!.tx).toBe(1);
    expect(Array.from(w.getTile(id)!.corners)).toEqual(Array.from(floor(2, 0, 3).corners));
    expect(w.removeTile(id)!.ty).toBe(2);
    expect(w.hasTile(id)).toBe(false);
    expect(w.addTile(floor(0, 0, 0), 7)).toBe(7);
    expect(w.nextTileId).toBe(8);
    expect(() => w.addTile(floor(1, 0, 0), 7)).toThrow();
  });
  it('Kachel liegt im Chunk ihres Schwerpunkts und wandert bei setTile', () => {
    const w = new World(); w.addLayer('Ebene 1');
    const id = w.addTile(floor(40, 0, 5));
    expect(chunkCoords(w.chunkKeyOf(id)!)).toEqual([1, 0, 0]);
    w.setTile(id, floor(-3, 0, 5));
    expect(chunkCoords(w.chunkKeyOf(id)!)).toEqual([-1, 0, 0]);
    expect(w.chunks.get(chunkKey(1, 0, 0))?.count ?? 0).toBe(0);
  });
  it('findCoincident erkennt gleiche Ecken in anderer Reihenfolge und Richtung', () => {
    const w = new World(); w.addLayer('Ebene 1');
    const id = w.addTile(floor(0, 0, 0));
    const c = floor(0, 0, 0).corners;
    const rotated = new Float32Array([...c.slice(3), ...c.slice(0, 3)]);
    const reversed = new Float32Array([c[9], c[10], c[11], c[6], c[7], c[8], c[3], c[4], c[5], c[0], c[1], c[2]]);
    expect(w.findCoincident(rotated, 'same')).toBe(id);
    expect(w.findCoincident(reversed, 'opposite')).toBe(id);
    expect(w.findCoincident(reversed, 'same')).toBeNull();
  });
  it('Dirty-Mengen und queryAabb', () => {
    const w = new World(); w.addLayer('Ebene 1');
    const id = w.addTile(floor(5, 0, 5));
    expect(w.takeRenderDirty().size).toBe(1);
    expect(w.takeRenderDirty().size).toBe(0);
    expect(w.takeSaveDirty().size).toBe(1);
    const hits: number[] = [];
    w.queryAabb([4.5, -1, 4.5], [5.5, 1, 5.5], (i) => hits.push(i));
    expect(hits).toEqual([id]);
  });
  it('Ebene mit Kacheln lässt sich nicht entfernen', () => {
    const w = new World(); const l = w.addLayer('Ebene 1'); w.addTile(floor(0, 0, 0, l.id));
    expect(() => w.removeLayer(l.id)).toThrow();
  });
  it('200.000 Kacheln ohne quadratische Laufzeit', () => {
    const w = new World(); w.addLayer('Ebene 1');
    for (let x = 0; x < 500; x++) for (let z = 0; z < 400; z++) w.addTile(floor(x, 0, z));
    expect(w.tileCount()).toBe(200_000);
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run packages/engine/tests/world.test.ts`
Expected: FAIL, weil `World` usw. nicht exportiert sind.

- [ ] **Step 3: `keys.ts`, `types.ts`, `chunk.ts`, `world.ts` nach dem Interfaces-Block implementieren und exportieren**

`World` hält zusätzlich `Map<id, chunkKey>` für `chunkKeyOf`. `setTile` mit neuem Chunk entspricht Entfernen plus Hinzufügen mit derselben id.

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run packages/engine/tests/world.test.ts`
Expected: PASS (der 200.000er-Test unter dem Timeout von 10 s).

- [ ] **Step 5: Commit**

```bash
git add packages/engine && git commit -m "feat(engine): Kachel-Speicher in Chunks"
```

---

### Task 3: Kachel-Geometrie (Ebenen, Vierecke, UVs, Blöcke)

**Files:**
- Create: `packages/engine/src/geometry/plane.ts`, `quad.ts`, `uv.ts`, `block.ts`
- Test: `packages/engine/tests/geometry.test.ts`

**Interfaces:**
- Consumes: `vec3`, `TileData` (Task 1–2).
- Produces:
  - `type PlaneAxis = 'x'|'y'|'z'`; `interface DrawPlane { axis: PlaneAxis; offset: number; facing: 1 | -1 }`
  - `cellQuad(plane, u, v, size = 1): Float32Array` nach K2; `worldToPlane(plane, p): [u, v]`; `planeToWorld(plane, u, v, out?): Float32Array`; `planeOfQuad(corners): DrawPlane | null` (nur achsparallel, Toleranz 1e-4, sonst null).
  - `quadNormal(corners, out)`, `quadCentroid(corners, out)`, `quadIsDegenerate(corners): boolean` (Fläche < 1e-8 oder nicht endlich), `quadIsFinite(corners): boolean`.
  - `interface TilesetInfo { id: number; tileSize: number; imageWidth: number; imageHeight: number }`
  - `tileUVs(tx, ty, rot, flipX, flipY, ts: TilesetInfo, out: Float32Array /*8*/): Float32Array` nach K3.
  - `enum BlockFace { Top, Bottom, PosX, NegX, PosZ, NegZ }`; `blockQuads(x, y, z, size = 1): Float32Array[]` in dieser Reihenfolge, alle nach außen: Top = (y, y+s, +1, u=x, v=z), Bottom = (y, y, −1), PosX = (x, x+s, +1, u=z, v=y), NegX = (x, x, −1), PosZ = (z, z+s, +1, u=x, v=y), NegZ = (z, z, −1).

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

```ts
// packages/engine/tests/geometry.test.ts
import { describe, it, expect } from 'vitest';
import { cellQuad, quadNormal, worldToPlane, planeToWorld, planeOfQuad, tileUVs, blockQuads, quadIsDegenerate, vec3, type DrawPlane } from '../src';

const n = (c: Float32Array) => Array.from(quadNormal(c, vec3.create())).map((v) => Math.round(v));
const combos: [DrawPlane, number[]][] = [
  [{ axis: 'y', offset: 1, facing: 1 }, [0, 1, 0]], [{ axis: 'y', offset: 1, facing: -1 }, [0, -1, 0]],
  [{ axis: 'x', offset: 1, facing: 1 }, [1, 0, 0]], [{ axis: 'x', offset: 1, facing: -1 }, [-1, 0, 0]],
  [{ axis: 'z', offset: 1, facing: 1 }, [0, 0, 1]], [{ axis: 'z', offset: 1, facing: -1 }, [0, 0, -1]],
];
describe('cellQuad', () => {
  it.each(combos)('Normale %o', (plane, normal) => expect(n(cellQuad(plane, 2, 3))).toEqual(normal));
  it('Boden-Zelle (2,3) auf Höhe 1', () => {
    expect(Array.from(cellQuad({ axis: 'y', offset: 1, facing: 1 }, 2, 3))).toEqual([2, 1, 4, 3, 1, 4, 3, 1, 3, 2, 1, 3]);
  });
  it('worldToPlane ist die Umkehrung von planeToWorld', () => {
    const p: DrawPlane = { axis: 'x', offset: 4, facing: -1 };
    expect(worldToPlane(p, planeToWorld(p, 2.5, 7))).toEqual([2.5, 7]);
    expect(planeOfQuad(cellQuad(p, 0, 0))).toEqual(p);
  });
});
describe('tileUVs (Tileset 64×32, Kachel 16 px, Kachel (1,1))', () => {
  const ts = { id: 0, tileSize: 16, imageWidth: 64, imageHeight: 32 };
  const L = (16 + 0.01) / 64, R = (32 - 0.01) / 64, T = (16 + 0.01) / 32, B = (32 - 0.01) / 32;
  const uv = (rot: 0 | 1 | 2 | 3, fx = false, fy = false) => Array.from(tileUVs(1, 1, rot, fx, fy, ts, new Float32Array(8)));
  it('rot 0', () => uv(0).forEach((v, i) => expect(v).toBeCloseTo([L, B, R, B, R, T, L, T][i], 6)));
  it('rot 1 (90° im Uhrzeigersinn)', () => uv(1).forEach((v, i) => expect(v).toBeCloseTo([R, B, R, T, L, T, L, B][i], 6)));
  it('flipX', () => uv(0, true).forEach((v, i) => expect(v).toBeCloseTo([R, B, L, B, L, T, R, T][i], 6)));
});
describe('Blöcke und Sonderfälle', () => {
  it('alle sechs Seiten zeigen nach außen', () => {
    const q = blockQuads(0, 0, 0);
    expect(q.map(n)).toEqual([[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]);
  });
  it('zusammengefallene Ecken und NaN gelten als entartet', () => {
    expect(quadIsDegenerate(new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0]))).toBe(true);
    expect(quadIsDegenerate(new Float32Array([NaN, 0, 0, 1, 0, 0, 1, 0, -1, 0, 0, -1]))).toBe(true);
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run packages/engine/tests/geometry.test.ts`
Expected: FAIL (Exporte fehlen).

- [ ] **Step 3: `plane.ts`, `quad.ts`, `uv.ts`, `block.ts` nach K2/K3 und Interfaces implementieren**

Ein Dreieck (zwei gleiche Ecken) gilt **nicht** als entartet, solange seine Fläche ≥ 1e-8 ist.

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run packages/engine/tests/geometry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/engine && git commit -m "feat(engine): Ebenen, Kachel-Vierecke, UVs und Blöcke"
```

---

### Task 4: Chunk-Mesher

**Files:**
- Create: `packages/engine/src/mesh/chunkMesher.ts`
- Test: `packages/engine/tests/mesher.test.ts`

**Interfaces:**
- Consumes: `Chunk`, `TilesetInfo`, `tileUVs`, `quadNormal`, `quadIsDegenerate`.
- Produces:
  - `faceShade(nx, ny, nz): number` nach K6.
  - `interface ChunkMeshPart { tileset: number; positions: Float32Array; uvs: Float32Array; shades: Float32Array; indices: Uint32Array; triangles: number }`
  - `buildChunkMesh(chunk: Chunk, tilesets: ReadonlyMap<number, TilesetInfo>, layerVisible: (layer: number) => boolean): ChunkMeshPart[]`: ein Teil pro Tileset, 4 Ecken je Kachel, Indizes (0,1,2, 0,2,3). `doubleSided` erzeugt eine zweite, umgedrehte Kopie (Reihenfolge c0, c3, c2, c1) mit Schattierung der Gegen-Normale. Übersprungen werden Kacheln verborgener Ebenen, Kacheln mit unbekanntem Tileset und entartete bzw. nicht endliche Kacheln.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

```ts
// packages/engine/tests/mesher.test.ts
import { describe, it, expect } from 'vitest';
import { World, buildChunkMesh, faceShade, tileUVs, chunkKeyForPoint, type TileData } from '../src';

const ts = new Map([[0, { id: 0, tileSize: 16, imageWidth: 64, imageHeight: 32 }], [1, { id: 1, tileSize: 16, imageWidth: 32, imageHeight: 32 }]]);
const tile = (p: Partial<TileData> = {}): TileData => ({ layer: 1, tileset: 0, tx: 1, ty: 1, rot: 0, flipX: false, flipY: false, doubleSided: false, ghost: false,
  corners: new Float32Array([0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0]), ...p });
const mesh = (tiles: TileData[], visible = () => true) => {
  const w = new World(); w.addLayer('a'); w.addLayer('b'); tiles.forEach((t) => w.addTile(t));
  return buildChunkMesh(w.chunks.get(chunkKeyForPoint(0.5, 0, 0.5))!, ts, visible);
};
describe('buildChunkMesh', () => {
  it('eine Bodenkachel: 4 Ecken, 6 Indizes, UVs und Schattierung', () => {
    const [p] = mesh([tile()]);
    expect(p.positions.length).toBe(12); expect(Array.from(p.indices)).toEqual([0, 1, 2, 0, 2, 3]);
    expect(Array.from(p.uvs)).toEqual(Array.from(tileUVs(1, 1, 0, false, false, ts.get(0)!, new Float32Array(8))));
    expect(p.shades[0]).toBeCloseTo(faceShade(0, 1, 0), 6);
  });
  it('beidseitig: zweite, umgedrehte Kopie', () => {
    const [p] = mesh([tile({ doubleSided: true })]);
    expect(p.positions.length).toBe(24); expect(p.triangles).toBe(4);
    expect(p.shades[4]).toBeCloseTo(faceShade(0, -1, 0), 6);
  });
  it('ein Teil pro Tileset, verborgene Ebenen fehlen', () => {
    expect(mesh([tile(), tile({ tileset: 1, layer: 2 })]).length).toBe(2);
    expect(mesh([tile(), tile({ tileset: 1, layer: 2 })], (l) => l !== 2).length).toBe(1);
  });
  it('NaN- und entartete Kacheln werden übersprungen (Review Focus 4)', () => {
    const bad = tile({ corners: new Float32Array([NaN, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0]) });
    const line = tile({ corners: new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0]) });
    const parts = mesh([tile(), bad, line]);
    expect(parts[0].triangles).toBe(2);
    expect(parts[0].positions.every(Number.isFinite)).toBe(true);
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run packages/engine/tests/mesher.test.ts`
Expected: FAIL.

- [ ] **Step 3: `faceShade` und `buildChunkMesh` implementieren**

Zuerst zählen, dann Zielarrays in exakter Größe anlegen (keine Zwischen-Arrays pro Kachel).

- [ ] **Step 4: Tests laufen lassen und Benchmark anlegen**

`packages/engine/bench/mesh.bench.ts`: Chunk mit 32×32 Bodenkacheln plus 3.000 Wandkacheln, `buildChunkMesh` messen (nur zur Information).
Run: `npx vitest run packages/engine/tests/mesher.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/engine && git commit -m "feat(engine): Chunk-Mesher"
```

---

### Task 5: Picking per Strahl

**Files:**
- Create: `packages/engine/src/pick/raycast.ts`
- Test: `packages/engine/tests/raycast.test.ts`

**Interfaces:**
- Consumes: `World`, `rayTriangle`, `rayAabb`, `quadNormal`, `quadIsDegenerate`, `DrawPlane`.
- Produces:
  - `interface RayHit { tileId: number; t: number; point: Float32Array; normal: Float32Array /*Vorderseiten-Normale*/; front: boolean }`
  - `raycastWorld(world, origin, dir, maxDist, layerFilter: (layer: number) => boolean): RayHit | null`: Grobphase über alle Chunk-AABBs (Eintritts-t sortiert), Abbruch, sobald der beste Treffer näher ist als der nächste Chunk. Eine Kachel zählt, wenn sie von vorne getroffen wird oder `doubleSided` ist. Entartete Kacheln werden übersprungen.
  - `rayPlane(origin, dir, plane): Float32Array | null` (null bei parallelem Strahl oder Treffer hinter dem Ursprung).

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

```ts
// packages/engine/tests/raycast.test.ts
import { describe, it, expect } from 'vitest';
import { World, raycastWorld, rayPlane, cellQuad, type TileData } from '../src';

const T = (corners: Float32Array, p: Partial<TileData> = {}): TileData => ({ layer: 1, tileset: 0, tx: 0, ty: 0, rot: 0, flipX: false, flipY: false, doubleSided: false, ghost: false, corners, ...p });
const all = () => true;
const setup = () => { const w = new World(); w.addLayer('a'); w.addLayer('b'); return w; };

describe('raycastWorld', () => {
  it('trifft die Bodenkachel von oben', () => {
    const w = setup(); const id = w.addTile(T(cellQuad({ axis: 'y', offset: 0, facing: 1 }, 2, 3)));
    const h = raycastWorld(w, [2.5, 10, 3.5], [0, -1, 0], 100, all)!;
    expect(h.tileId).toBe(id); expect(h.t).toBeCloseTo(10, 5); expect(h.front).toBe(true);
    expect(Array.from(h.point).map((v) => +v.toFixed(3))).toEqual([2.5, 0, 3.5]);
  });
  it('Rückseite nur bei beidseitigen Kacheln', () => {
    const w = setup(); w.addTile(T(cellQuad({ axis: 'y', offset: 0, facing: 1 }, 0, 0)));
    expect(raycastWorld(w, [0.5, -5, 0.5], [0, 1, 0], 100, all)).toBeNull();
    const w2 = setup(); w2.addTile(T(cellQuad({ axis: 'y', offset: 0, facing: 1 }, 0, 0), { doubleSided: true }));
    expect(raycastWorld(w2, [0.5, -5, 0.5], [0, 1, 0], 100, all)!.front).toBe(false);
  });
  it('nimmt den nächsten Treffer und beachtet den Ebenen-Filter', () => {
    const w = setup();
    const low = w.addTile(T(cellQuad({ axis: 'y', offset: 0, facing: 1 }, 0, 0)));
    const high = w.addTile(T(cellQuad({ axis: 'y', offset: 2, facing: 1 }, 0, 0), { layer: 2 }));
    expect(raycastWorld(w, [0.5, 9, 0.5], [0, -1, 0], 100, all)!.tileId).toBe(high);
    expect(raycastWorld(w, [0.5, 9, 0.5], [0, -1, 0], 100, (l) => l !== 2)!.tileId).toBe(low);
  });
  it('trifft eine gestreckte Kachel weit außerhalb ihres Chunks', () => {
    const w = setup(); const id = w.addTile(T(cellQuad({ axis: 'y', offset: 0, facing: 1 }, 0, 0, 100)));
    expect(raycastWorld(w, [95, 3, 95], [0, -1, 0], 100, all)!.tileId).toBe(id);
  });
  it('überspringt entartete Kacheln ohne Fehler (Review Focus 4)', () => {
    const w = setup(); w.addTile(T(new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0])));
    expect(raycastWorld(w, [0.5, 5, 0], [0, -1, 0], 100, all)).toBeNull();
  });
});
describe('rayPlane', () => {
  it('Schnitt, parallel, dahinter', () => {
    const p = { axis: 'y' as const, offset: 1, facing: 1 as const };
    expect(Array.from(rayPlane([0, 5, 0], [0, -1, 0], p)!)).toEqual([0, 1, 0]);
    expect(rayPlane([0, 5, 0], [1, 0, 0], p)).toBeNull();
    expect(rayPlane([0, 5, 0], [0, 1, 0], p)).toBeNull();
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run packages/engine/tests/raycast.test.ts`
Expected: FAIL.

- [ ] **Step 3: `raycastWorld` und `rayPlane` implementieren**

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run packages/engine/tests/raycast.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/engine && git commit -m "feat(engine): Picking per Strahl"
```

---

### Task 6: Kamera, Sichtfeld und WebGL2-Renderer

**Files:**
- Create: `packages/engine/src/render/camera.ts`, `frustum.ts`, `gl.ts`, `shaders.ts`, `tileRenderer.ts`, `lineRenderer.ts`
- Test: `packages/engine/tests/camera.test.ts` (GL-Teile prüft Task 10 per E2E)

**Interfaces:**
- Consumes: `vec3`, `mat4`, `ChunkMeshPart`, `TilesetInfo`.
- Produces:
  - `type ViewKind = 'perspective'|'top'|'front'|'side'`
  - `class Camera { position: Float32Array; yaw: number; pitch: number; fovY: number; near: number; far: number; view: ViewKind; orthoScale: number; forward(out); right(out); up(out); viewMatrix(out); projMatrix(out, aspect); viewProj(out, aspect); screenRay(ndcX, ndcY, aspect, outOrigin, outDir): void }` nach K7. `pitch` wird beim Setzen auf ±89° begrenzt.
  - `extractFrustum(viewProj, out: Float32Array /*24*/): Float32Array`; `aabbInFrustum(planes, min, max): boolean`.
  - `interface ChunkBounds { key: number; min: ArrayLike<number>; max: ArrayLike<number> }`; `selectVisibleChunks(chunks: Iterable<ChunkBounds>, planes, camPos, viewDistance): number[]` (im Sichtfeld und AABB-Abstand ≤ viewDistance).
  - `interface RenderStats { drawCalls: number; visibleChunks: number; triangles: number }`
  - `interface FogOptions { color: [number, number, number]; start: number; end: number; viewDistance: number }`
  - `class TileRenderer { constructor(gl: WebGL2RenderingContext); setTileset(id: number, image: TexImageSource, info: TilesetInfo): void; removeTileset(id): void; updateChunk(key: number, parts: ChunkMeshPart[], min: ArrayLike<number>, max: ArrayLike<number>): void; removeChunk(key): void; draw(camera: Camera, aspect: number, fog: FogOptions): RenderStats; drawGhosts(camera, aspect, parts: ChunkMeshPart[], alpha: number): void; restore(): void }`. Texturen mit NEAREST, CLAMP_TO_EDGE, ohne Mipmaps. Back-Face-Culling an. Im Fragment-Shader: `discard` bei Alpha < 0,5, Farbe × Schattierung, linearer Nebel. Nach `webglcontextrestored` baut `restore()` alle Programme, Texturen und Puffer aus behaltenen CPU-Kopien neu auf. Tileset-id **−1** ist fest eingebaut: eine 32 × 32-Prüftextur aus 2 × 2 Kacheln zu 16 px (`#5a5f6a` / `#3d414a`) mit `TilesetInfo { id: -1, tileSize: 16, imageWidth: 32, imageHeight: 32 }`. Der Editor gibt diese Info beim Meshen immer mit.
  - `class LineRenderer { constructor(gl); drawLines(camera, aspect, segments: Float32Array /*xyz,xyz*/, rgba: [number, number, number, number], depthTest: boolean): void; drawPoints(camera, aspect, points: Float32Array, rgba, sizePx: number): void }`
  - `createGl(canvas): WebGL2RenderingContext | null`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

```ts
// packages/engine/tests/camera.test.ts
import { describe, it, expect } from 'vitest';
import { Camera, extractFrustum, aabbInFrustum, selectVisibleChunks, mat4, vec3 } from '../src';

const r = (a: ArrayLike<number>) => Array.from(a).map((v) => +v.toFixed(4) + 0);
describe('Camera', () => {
  it('yaw 0 blickt nach −Z, yaw 90° nach −X, pitch ist begrenzt', () => {
    const c = new Camera(); expect(r(c.forward(vec3.create()))).toEqual([0, 0, -1]);
    c.yaw = Math.PI / 2; expect(r(c.forward(vec3.create()))).toEqual([-1, 0, 0]);
    c.pitch = 3; expect(c.pitch).toBeCloseTo((89 * Math.PI) / 180, 6);
  });
  it('Strahl durch die Bildmitte = Blickrichtung; top-Ansicht blickt nach unten', () => {
    const c = new Camera(); c.yaw = 0.3; c.pitch = -0.4;
    const o = vec3.create(), d = vec3.create(); c.screenRay(0, 0, 1.6, o, d);
    expect(r(d)).toEqual(r(c.forward(vec3.create())));
    c.view = 'top'; c.screenRay(0.5, 0.5, 1.6, o, d); expect(r(d)).toEqual([0, -1, 0]);
  });
});
describe('Sichtfeld', () => {
  const c = new Camera(); c.position.set([0, 2, 10]);
  const planes = extractFrustum(c.viewProj(mat4.create(), 1.6), new Float32Array(24));
  it('Box vor der Kamera sichtbar, hinter ihr nicht', () => {
    expect(aabbInFrustum(planes, [-1, 0, -1], [1, 1, 1])).toBe(true);
    expect(aabbInFrustum(planes, [-1, 0, 20], [1, 1, 22])).toBe(false);
  });
  it('selectVisibleChunks beachtet die Sichtweite', () => {
    const chunks = [{ key: 1, min: [-16, 0, -16], max: [16, 32, 16] }, { key: 2, min: [-16, 0, -400], max: [16, 32, -368] }];
    expect(selectVisibleChunks(chunks, planes, c.position, 160)).toEqual([1]);
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run packages/engine/tests/camera.test.ts`
Expected: FAIL.

- [ ] **Step 3: `camera.ts` und `frustum.ts` implementieren**

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run packages/engine/tests/camera.test.ts`
Expected: PASS.

- [ ] **Step 5: `gl.ts`, `shaders.ts`, `tileRenderer.ts`, `lineRenderer.ts` implementieren**

GLSL ES 3.00. Attribute: `aPos` (vec3), `aUv` (vec2), `aShade` (float). Uniforms: `uViewProj`, `uCamPos`, `uTex`, `uFogColor`, `uFogStart`, `uFogEnd`, `uAlpha`. Pro Chunk und Tileset ein VAO. `draw` ruft `selectVisibleChunks` auf und zählt `drawCalls`, `visibleChunks` und `triangles`. Geprüft wird das per E2E in Task 10 (Pixeltest).

Run: `npm run typecheck`
Expected: keine Typfehler.

- [ ] **Step 6: Commit**

```bash
git add packages/engine && git commit -m "feat(engine): Kamera, Sichtfeld und WebGL2-Renderer"
```

---

### Task 7: Kollision und Spielfigur in Ego-Sicht

**Files:**
- Create: `packages/engine/src/collision/closest.ts`, `capsule.ts`, `triangles.ts`; `packages/runtime/package.json`, `tsconfig.json`, `src/index.ts`, `src/player/playerConfig.ts`, `src/player/fpsController.ts`
- Modify: `package.json` (Typecheck um runtime ergänzen)
- Test: `packages/engine/tests/capsule.test.ts`, `packages/runtime/tests/fpsController.test.ts`

**Interfaces:**
- Consumes: `World`, `vec3`, `quadIsDegenerate`, `raycastWorld`.
- Produces:
  - `closestPointOnTriangle(p, a, b, c, out): Float32Array`; `closestSegmentTriangle(p0, p1, a, b, c, outSeg, outTri): number` (Abstand²).
  - `collectTriangles(world, min, max, out: number[]): number`: Dreiecke (je 9 Zahlen) aller Kacheln **aller Ebenen** im AABB, ohne `ghost` und ohne entartete Kacheln; Rückgabe = Anzahl.
  - `resolveCapsule(feet: Float32Array, radius, height, tris: ArrayLike<number>, triCount): { pushed: boolean; groundNy: number /*größtes n.y der Kontakte, −1 ohne Kontakt*/ }`: bis zu 4 Durchläufe, Achse von feet+r bis feet+height−r, Herausschieben entlang (Kapselpunkt − Dreieckspunkt).
  - `interface PlayerConfig { radius: number; height: number; eyeHeight: number; stepHeight: number; maxSlopeDeg: number; gravity: number; jumpSpeed: number; walkSpeed: number; runSpeed: number; fallRespawnDepth: number }`; `DEFAULT_PLAYER = { radius: 0.3, height: 1.7, eyeHeight: 1.6, stepHeight: 0.35, maxSlopeDeg: 50, gravity: 20, jumpSpeed: 6.5, walkSpeed: 4, runSpeed: 6.5, fallRespawnDepth: 60 }`.
  - `interface PlayerInput { moveX: number /*−1…1, rechts +*/; moveZ: number /*−1…1, vorwärts +*/; run: boolean; jump: boolean; lookDX: number; lookDY: number /*rad*/ }`
  - `class FpsController { position: Float32Array /*Füße*/; velocity: Float32Array; yaw: number; pitch: number; grounded: boolean; constructor(world: World, spawn: ArrayLike<number>, yaw: number, cfg?: PlayerConfig); update(dt: number, input: PlayerInput): void; eye(out): Float32Array; respawn(): void }`
  - Ablauf von `update`: Blick anwenden; dt in Teilschritte ≤ 1/120 s und Bewegung pro Teilschritt ≤ radius/2 aufteilen. Horizontal Richtung aus yaw, Geschwindigkeit walk/run; vertikal Schwerkraft, Sprung nur wenn grounded. Nach dem Bewegen `resolveCapsule`. `grounded = groundNy ≥ cos(maxSlope)`. **Stufe**: Wird die horizontale Bewegung blockiert und die Figur steht, versucht der Controller: um stepHeight anheben, horizontal bewegen, wieder absenken; das gilt, wenn die Figur dabei weiter kommt. Steile Kontakte (n.y < cos(maxSlope)) gelten als Wand. **Absturz**: y < (Welt-Bounds.min.y − fallRespawnDepth) → `respawn()`. Ist ein Ergebnis nicht endlich, gilt die letzte gültige Position.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

```ts
// packages/engine/tests/capsule.test.ts
import { describe, it, expect } from 'vitest';
import { World, collectTriangles, resolveCapsule, cellQuad, vec3, type TileData } from '../src';
const T = (corners: Float32Array, ghost = false): TileData => ({ layer: 1, tileset: 0, tx: 0, ty: 0, rot: 0, flipX: false, flipY: false, doubleSided: false, ghost, corners });
describe('Kapsel', () => {
  it('drückt eine eingesunkene Kapsel aus dem Boden', () => {
    const w = new World(); w.addLayer('a');
    for (let x = -2; x < 2; x++) for (let z = -2; z < 2; z++) w.addTile(T(cellQuad({ axis: 'y', offset: 0, facing: 1 }, x, z)));
    const tris: number[] = []; const n = collectTriangles(w, [-3, -3, -3], [3, 3, 3], tris);
    expect(n).toBe(32);
    const feet = vec3.create(0, -0.1, 0); const r = resolveCapsule(feet, 0.3, 1.7, tris, n);
    expect(feet[1]).toBeCloseTo(0, 2); expect(r.groundNy).toBeCloseTo(1, 3);
  });
  it('Geist-Kacheln liefern keine Dreiecke', () => {
    const w = new World(); w.addLayer('a'); w.addTile(T(cellQuad({ axis: 'y', offset: 0, facing: 1 }, 0, 0), true));
    expect(collectTriangles(w, [-1, -1, -1], [2, 2, 2], [])).toBe(0);
  });
});
```

```ts
// packages/runtime/tests/fpsController.test.ts
import { describe, it, expect } from 'vitest';
import { World, cellQuad, type TileData, type DrawPlane } from '@rgm/engine';
import { FpsController, DEFAULT_PLAYER } from '../src';

const T = (c: Float32Array, ghost = false): TileData => ({ layer: 1, tileset: 0, tx: 0, ty: 0, rot: 0, flipX: false, flipY: false, doubleSided: false, ghost, corners: c });
const floorWorld = (ghost = false) => { const w = new World(); w.addLayer('a');
  for (let x = -10; x < 10; x++) for (let z = -10; z < 10; z++) w.addTile(T(cellQuad({ axis: 'y', offset: 0, facing: 1 }, x, z), ghost)); return w; };
const idle = { moveX: 0, moveZ: 0, run: false, jump: false, lookDX: 0, lookDY: 0 };
const fwd = { ...idle, moveZ: 1 };
const run = (p: FpsController, secs: number, input = idle) => { for (let i = 0; i < secs * 60; i++) p.update(1 / 60, input); };

describe('FpsController', () => {
  it('steht still auf dem Boden', () => { const p = new FpsController(floorWorld(), [0, 0.5, 0], 0); run(p, 1); expect(p.position[1]).toBeCloseTo(0, 2); expect(p.grounded).toBe(true); });
  it('stoppt an einer Wand (yaw 0 = Richtung −Z)', () => {
    const w = floorWorld(); for (let x = -3; x < 3; x++) for (let y = 0; y < 3; y++) w.addTile(T(cellQuad({ axis: 'z', offset: -3, facing: 1 }, x, y)));
    const p = new FpsController(w, [0, 0, 0], 0); run(p, 2, fwd); expect(p.position[2]).toBeGreaterThan(-3 + DEFAULT_PLAYER.radius - 0.02);
  });
  const riser = (x: number, h: number) => { const c = cellQuad({ axis: 'z', offset: -2, facing: 1 }, x, 0); c[7] = h; c[10] = h; return c; };
  const stepWorld = (h: number) => { const w = floorWorld(); const top: DrawPlane = { axis: 'y', offset: h, facing: 1 };
    for (let x = -3; x < 3; x++) { for (let z = -10; z < -2; z++) w.addTile(T(cellQuad(top, x, z))); w.addTile(T(riser(x, h))); } return w; };
  // stepWorld: die Stirnseite der Stufe ist genau h hoch (obere Ecken c2/c3 auf y = h), nicht 1 m
  it('steigt eine Stufe von 0,25 m hoch', () => { const p = new FpsController(stepWorld(0.25), [0, 0, 0], 0); run(p, 2, fwd); expect(p.position[1]).toBeCloseTo(0.25, 1); });
  it('bleibt an einer Kante von 0,6 m hängen', () => { const p = new FpsController(stepWorld(0.6), [0, 0, 0], 0); run(p, 2, fwd); expect(p.position[1]).toBeLessThan(0.1); });
  it('Sprunghöhe ≈ v²/(2g) = 1,06 m', () => {
    const p = new FpsController(floorWorld(), [0, 0, 0], 0); run(p, 0.5); let peak = 0;
    p.update(1 / 60, { ...idle, jump: true }); for (let i = 0; i < 90; i++) { p.update(1 / 60, idle); peak = Math.max(peak, p.position[1]); }
    expect(peak).toBeGreaterThan(0.95); expect(peak).toBeLessThan(1.15);
  });
  it('fällt durch Geist-Kacheln und erscheint am Startpunkt wieder', () => {
    const p = new FpsController(floorWorld(true), [0, 1, 0], 0); run(p, 6);
    expect(p.position[1]).toBeGreaterThan(-61);
  });
  it('NaN-Kacheln erzeugen kein NaN (Review Focus 4)', () => {
    const w = floorWorld(); w.addTile(T(new Float32Array([NaN, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1])));
    w.addTile(T(new Float32Array([0, 0, -1, 1, 0, -1, 1, 0, -1, 0, 0, -1])));
    const p = new FpsController(w, [0.5, 0.2, 0.5], 0); run(p, 2, fwd);
    expect(Array.from(p.position).every(Number.isFinite)).toBe(true);
  });
});
```
Dazu für die Rampe (30° begehbar, 60° nicht): eine 4 m lange Rampe aus Kacheln mit angehobener Hinterkante (`corners` direkt setzen). Bei 30° ist y nach 2 s Vorwärtslaufen größer als 0,5; bei 60° kleiner als 0,6.

- [ ] **Step 2: Tests laufen lassen, sie müssen fehlschlagen**

Run: `npx vitest run packages/engine/tests/capsule.test.ts packages/runtime/tests/fpsController.test.ts`
Expected: FAIL (Module fehlen).

- [ ] **Step 3: `closest.ts`, `capsule.ts`, `triangles.ts`, `playerConfig.ts`, `fpsController.ts` nach dem Interfaces-Block implementieren**

`@rgm/runtime`: `package.json` mit `"exports": { ".": "./src/index.ts" }` und Abhängigkeit `"@rgm/engine": "*"`.

- [ ] **Step 4: Tests und Typprüfung laufen lassen**

Run: `npx vitest run packages/engine/tests/capsule.test.ts packages/runtime/tests && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages package.json && git commit -m "feat: Kapsel-Kollision und Spielfigur in Ego-Sicht"
```

---

### Task 8: Rückgängig-System und Welt-Befehle

**Files:**
- Create: `packages/editor/package.json`, `packages/editor/tsconfig.json`, `src/commands/command.ts`, `history.ts`, `tileCommands.ts`, `layerCommands.ts`, `tilesetCommands.ts`, `src/project/projectModel.ts` (nur Typen und `newProject`)
- Modify: `package.json` (Typecheck um editor ergänzen)
- Test: `packages/editor/tests/history.test.ts`

**Interfaces:**
- Consumes: `World`, `TileData`, `Layer`.
- Produces:
  - `projectModel.ts`: `interface TilesetMeta { id: number; name: string; file: string; tileSize: number; imageWidth: number; imageHeight: number; columns: number; rows: number }`; `interface EditorPrefs { camera: { x: number; y: number; z: number; yaw: number; pitch: number }; activeLayer: number; snap: 1 | 0.5 | 0.25; drawPlane: 'auto' | 'x' | 'y' | 'z' }`; `interface ProjectFile { format: 'rgm-projekt'; version: 1; name: string; created: string; activeWorld: string; worlds: string[]; tilesets: TilesetMeta[]; nextTilesetId: number; editor: EditorPrefs }`; `newProject(name, now: Date): { project: ProjectFile; world: World }` (Welt `insel`, Ebene „Ebene 1“, Kamera (0, 6, 12, yaw 0, pitch −25°), snap 1, drawPlane 'auto').
  - `interface DocCtx { world: World; project: ProjectFile }`
  - `interface Command<C> { readonly label: string; readonly bytes: number; do(ctx: C): void; undo(ctx: C): void }`
  - `class History<C> { constructor(ctx: C, opts?: { maxSteps?: number /*200*/; maxBytes?: number /*256 MB*/ }); exec(cmd): void; begin(label): void; end(): void; undo(): boolean; redo(): boolean; get canUndo(): boolean; get canRedo(): boolean; subscribe(fn: () => void): () => void }`. `begin`/`end` dürfen verschachtelt sein; das äußerste `end` legt **einen** Schritt ab, ein leerer Schritt entfällt. `exec` führt sofort aus und löscht den Wiederholen-Stapel.
  - `interface TileChange { id: number; before: TileData; after: TileData }`
  - `addTilesCmd(tiles: TileData[], label?): Command<DocCtx> & { readonly addedIds: readonly number[] }` (beim ersten `do` neue ids, bei Wiederholen dieselben)
  - `removeTilesCmd(ids: number[], label?)`, `updateTilesCmd(changes: TileChange[], label?)`, `editTilesCmd(op: { add: TileData[]; remove: number[]; update: TileChange[] }, label): Command<DocCtx> & { readonly addedIds: readonly number[] }`
  - `addLayerCmd(name): Command<DocCtx> & { readonly layerId: number }`, `removeLayerCmd(id)` (entfernt die Kacheln der Ebene mit), `updateLayerCmd(id, patch: Partial<Omit<Layer, 'id'>>)`, `addTilesetCmd(meta: TilesetMeta)`
  - `bytes` = 96 × Anzahl betroffener Kachel-Datensätze (mindestens 64).

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

```ts
// packages/editor/tests/history.test.ts
import { describe, it, expect } from 'vitest';
import { cellQuad, type TileData } from '@rgm/engine';
import { newProject } from '../src/project/projectModel';
import { History } from '../src/commands/history';
import { addTilesCmd, removeTilesCmd, updateTilesCmd } from '../src/commands/tileCommands';
import { removeLayerCmd } from '../src/commands/layerCommands';

const doc = () => newProject('Test', new Date('2026-11-24T10:00:00Z'));
const T = (x: number, z: number, tx = 0): TileData => ({ layer: 1, tileset: 0, tx, ty: 0, rot: 0, flipX: false, flipY: false, doubleSided: false, ghost: false, corners: cellQuad({ axis: 'y', offset: 0, facing: 1 }, x, z) });

describe('History', () => {
  it('hinzufügen → rückgängig → wiederholen mit derselben id', () => {
    const d = doc(); const h = new History(d); const cmd = addTilesCmd([T(0, 0)]);
    h.exec(cmd); const id = cmd.addedIds[0];
    expect(h.undo()).toBe(true); expect(d.world.hasTile(id)).toBe(false);
    expect(h.redo()).toBe(true); expect(d.world.getTile(id)!.tx).toBe(0);
  });
  it('entfernen und ändern lassen sich exakt zurücknehmen', () => {
    const d = doc(); const h = new History(d); const add = addTilesCmd([T(1, 1, 3)]); h.exec(add); const id = add.addedIds[0];
    const before = d.world.getTile(id)!; h.exec(updateTilesCmd([{ id, before, after: { ...before, tx: 5 } }]));
    h.exec(removeTilesCmd([id])); h.undo(); h.undo();
    expect(d.world.getTile(id)!.tx).toBe(3);
  });
  it('begin/end bündelt zu einem Schritt; exec nach undo leert redo', () => {
    const d = doc(); const h = new History(d);
    h.begin('Strich'); h.exec(addTilesCmd([T(0, 0)])); h.exec(addTilesCmd([T(1, 0)])); h.end();
    h.undo(); expect(d.world.tileCount()).toBe(0);
    h.exec(addTilesCmd([T(5, 5)])); expect(h.canRedo).toBe(false);
  });
  it('maxSteps verwirft die ältesten Schritte', () => {
    const d = doc(); const h = new History(d, { maxSteps: 3 });
    for (let i = 0; i < 5; i++) h.exec(addTilesCmd([T(i, 0)]));
    let n = 0; while (h.undo()) n++; expect(n).toBe(3); expect(d.world.tileCount()).toBe(2);
  });
  it('Ebene löschen entfernt ihre Kacheln, undo stellt beides wieder her', () => {
    const d = doc(); const h = new History(d); h.exec(addTilesCmd([T(0, 0), T(1, 0)]));
    h.exec(removeLayerCmd(1)); expect(d.world.layers.length).toBe(0); expect(d.world.tileCount()).toBe(0);
    h.undo(); expect(d.world.layers[0].name).toBe('Ebene 1'); expect(d.world.tileCount()).toBe(2);
  });
  it('65.536 Kacheln: rückgängig und wiederholen exakt (Review Focus 5)', () => {
    const d = doc(); const h = new History(d); const tiles: TileData[] = [];
    for (let x = 0; x < 256; x++) for (let z = 0; z < 256; z++) tiles.push(T(x, z));
    const cmd = addTilesCmd(tiles); h.exec(cmd); expect(cmd.bytes).toBe(96 * 65_536);
    h.undo(); expect(d.world.tileCount()).toBe(0); h.redo(); expect(d.world.tileCount()).toBe(65_536);
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npm install && npx vitest run packages/editor/tests/history.test.ts`
Expected: FAIL.

- [ ] **Step 3: `projectModel.ts` (Typen und `newProject`), `command.ts`, `history.ts` und die Befehlsdateien implementieren**

`packages/editor/package.json`: `name @rgm/editor`, Abhängigkeiten `@rgm/engine`, `@rgm/runtime`, `preact@^11`, `@preact/signals@^2`, `fflate`, `idb-keyval`, `@fontsource/inter`, `@fontsource/jetbrains-mono`; dev: `vite@^8`, `@preact/preset-vite`, `@babel/core@^7`, `fake-indexeddb`. `tsconfig.json`: `jsx: react-jsx`, `jsxImportSource: preact`.

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run packages/editor/tests/history.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages package.json package-lock.json && git commit -m "feat(editor): Rückgängig-System und Welt-Befehle"
```

---

### Task 9: Dateiformate, Speicher-Backends und automatisches Speichern

**Files:**
- Create: `packages/engine/src/world/serialize.ts`; `packages/editor/src/project/storage.ts`, `memoryStorage.ts`, `idbStorage.ts`, `folderStorage.ts`, `projectIO.ts`, `zip.ts`, `autosave.ts`, `recentProjects.ts`
- Test: `packages/engine/tests/serialize.test.ts`, `packages/editor/tests/projectIO.test.ts`, `packages/editor/tests/autosave.test.ts`

**Interfaces:**
- Consumes: `World`, `Chunk`, `packBits`/`unpackBits`, `chunkCoords`, `ProjectFile`, `newProject`.
- Produces:
  - Engine: `FORMAT_VERSION = 1`; `encodeWorldMeta(world): string` → `{"format":"rgm-welt","version":1,"chunkSize":32,"layers":[…],"nextTileId":n,"nextLayerId":m}`; `decodeWorldMeta(text): { chunkSize; layers; nextTileId; nextLayerId }`; `encodeChunk(chunk): string` → `{"format":"rgm-chunk","version":1,"tiles":[[id,layer,tileset,tx,ty,bits,x0,y0,z0,…,z3],…]}` mit Koordinaten auf 1e-4 gerundet; `decodeChunkInto(world, text): number`; `chunkFileName(key): string`; `class FormatError extends Error`. Eine unbekannte höhere Version wirft `FormatError(t.fehler.neuereVersion)`; der Text kommt als Parameter herein, die Engine kennt keine Strings: `decodeWorldMeta(text, messages: { newerVersion: string; broken: string })`, ebenso `decodeChunkInto`.
  - Editor: `interface ProjectStorage { readonly kind: 'memory'|'indexeddb'|'folder'; readText(path): Promise<string|null>; readBytes(path): Promise<Uint8Array|null>; writeText(path, text): Promise<void>; writeBytes(path, bytes): Promise<void>; remove(path): Promise<void>; list(prefix): Promise<string[]> }`
  - `class MemoryStorage implements ProjectStorage` (zusätzlich `failNextWrites(n: number, error: Error)` für Tests); `class IdbStorage { constructor(projectId: string) }` (idb-keyval, eigener Store `rgm-projekt-<id>`/`dateien`); `class FolderStorage { constructor(dir: FileSystemDirectoryHandle) }` (Unterordner je Pfadsegment, Schreiben über `createWritable()`).
  - `type FehlerTexte = typeof t.fehler`. `class ProjectIO { constructor(storage, messages: FehlerTexte); load(): Promise<{ project; world; tilesetBytes: Map<number, Uint8Array>; warnings: string[] }>;` Für die Engine übersetzt `ProjectIO` intern auf `{ newerVersion: messages.neuereVersion, broken: messages.kaputt }`. saveAll(project, world): Promise<void>; saveChanges(project, world, dirtyChunks: ReadonlySet<number>, newFiles?: ReadonlyMap<string, Uint8Array>): Promise<void> }`. `saveChanges` schreibt `projekt.json`, `welt.json`, alle Dateien geänderter Chunks (leerer Chunk → Datei löschen) und neue Dateien. Vorher wird jede vorhandene Datei, die überschrieben wird, nach `.sicherung/<slot>/<pfad>` kopiert; `slot = zaehler % 10`, der Slot wird vorher geleert und der Zähler steht in `.sicherung/zaehler.txt`. Fehlende Tileset-Datei beim Laden → Eintrag in `warnings` (`t.fehler.tilesetFehlt(file)`), kein Abbruch.
  - `exportZip(storage): Promise<Uint8Array>` (ohne `.sicherung/`), `importZip(bytes, storage): Promise<void>` (fflate `zipSync`/`unzipSync`).
  - `type SaveStatus = 'gespeichert'|'ungespeichert'|'speichert'|'fehler'`; `class Autosave { constructor(o: { io: ProjectIO; getDoc: () => DocCtx; debounceMs?: number /*3000*/; maxIntervalMs?: number /*30000*/; onStatus: (s: SaveStatus, error?: string) => void }); markDirty(): void; addFile(path, bytes): void; flush(): Promise<boolean>; dispose(): void }`. `flush` holt `world.takeSaveDirty()` und vereinigt es mit offenen Resten. Bei Fehler bleiben **alle** Chunks und Dateien vorgemerkt, der Status wird `'fehler'`, und der nächste `markDirty`/`flush` versucht es erneut. Es läuft nie mehr als ein Speichervorgang gleichzeitig.
  - `recentProjects.ts`: `interface RecentEntry { id: string; name: string; kind: 'indexeddb'|'folder'; handle?: FileSystemDirectoryHandle; lastOpened: number }`; `listRecent()`, `upsertRecent(e)`, `removeRecent(id)` (Store `rgm-register`/`projekte`).

- [ ] **Step 1: Die fehlschlagenden Tests schreiben**

```ts
// packages/engine/tests/serialize.test.ts
import { describe, it, expect } from 'vitest';
import { World, encodeChunk, decodeChunkInto, encodeWorldMeta, decodeWorldMeta, chunkFileName, chunkKey, cellQuad, FormatError } from '../src';
const msg = { newerVersion: 'neuer', broken: 'kaputt' };
describe('Serialisierung', () => {
  it('Chunk-Rundreise erhält alle Felder', () => {
    const w = new World(); w.addLayer('a');
    const id = w.addTile({ layer: 1, tileset: 2, tx: 3, ty: 4, rot: 3, flipX: true, flipY: false, doubleSided: true, ghost: true, corners: cellQuad({ axis: 'x', offset: 1.25, facing: -1 }, 2, 0) });
    const w2 = new World(); w2.layers = decodeWorldMeta(encodeWorldMeta(w), msg).layers;
    for (const c of w.chunks.values()) decodeChunkInto(w2, encodeChunk(c), msg);
    expect(w2.getTile(id)).toEqual(w.getTile(id));
  });
  it('Dateiname mit negativen Koordinaten; neuere Version wird abgelehnt', () => {
    expect(chunkFileName(chunkKey(-1, 0, -2))).toBe('-1_0_-2.json');
    expect(() => decodeWorldMeta('{"format":"rgm-welt","version":2}', msg)).toThrow(FormatError);
  });
});
```

```ts
// packages/editor/tests/projectIO.test.ts
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { cellQuad } from '@rgm/engine';
import { newProject } from '../src/project/projectModel';
import { MemoryStorage } from '../src/project/memoryStorage';
import { IdbStorage } from '../src/project/idbStorage';
import { ProjectIO } from '../src/project/projectIO';
import { exportZip, importZip } from '../src/project/zip';
import { t } from '../src/strings/de';

const tile = (x: number) => ({ layer: 1, tileset: 0, tx: 0, ty: 0, rot: 0 as const, flipX: false, flipY: false, doubleSided: false, ghost: false, corners: cellQuad({ axis: 'y', offset: 0, facing: 1 }, x, 0) });
describe('ProjectIO', () => {
  it('saveAll/load-Rundreise', async () => {
    const s = new MemoryStorage(); const { project, world } = newProject('Insel', new Date());
    world.addTile(tile(0)); world.addTile(tile(40));
    await new ProjectIO(s, t.fehler).saveAll(project, world);
    const loaded = await new ProjectIO(s, t.fehler).load();
    expect(loaded.project.name).toBe('Insel'); expect(loaded.world.tileCount()).toBe(2);
  });
  it('saveChanges schreibt nur geänderte Chunks und löscht leere', async () => {
    const s = new MemoryStorage(); const { project, world } = newProject('Insel', new Date());
    const a = world.addTile(tile(0)); world.addTile(tile(40)); const io = new ProjectIO(s, t.fehler);
    await io.saveAll(project, world); world.takeSaveDirty();
    world.removeTile(a); await io.saveChanges(project, world, world.takeSaveDirty());
    expect(await s.list('welten/insel/chunks/')).toEqual(['welten/insel/chunks/1_0_0.json']);
  });
  it('Sicherungen: höchstens 10 Slots', async () => {
    const s = new MemoryStorage(); const { project, world } = newProject('Insel', new Date()); const io = new ProjectIO(s, t.fehler);
    await io.saveAll(project, world);
    for (let i = 0; i < 12; i++) { world.addTile(tile(i)); await io.saveChanges(project, world, world.takeSaveDirty()); }
    const slots = new Set((await s.list('.sicherung/')).map((p) => p.split('/')[1]).filter((x) => x !== 'zaehler.txt'));
    expect(slots.size).toBe(10);
  });
  it('ZIP-Export/Import und IndexedDB-Speicher', async () => {
    const s = new MemoryStorage(); const { project, world } = newProject('Insel', new Date()); world.addTile(tile(3));
    await new ProjectIO(s, t.fehler).saveAll(project, world);
    const idb = new IdbStorage('test-1'); await importZip(await exportZip(s), idb);
    expect((await new ProjectIO(idb, t.fehler).load()).world.tileCount()).toBe(1);
  });
});
```

```ts
// packages/editor/tests/autosave.test.ts
import { describe, it, expect, vi } from 'vitest';
import { cellQuad } from '@rgm/engine';
import { newProject } from '../src/project/projectModel';
import { MemoryStorage } from '../src/project/memoryStorage';
import { ProjectIO } from '../src/project/projectIO';
import { Autosave, type SaveStatus } from '../src/project/autosave';
import { t } from '../src/strings/de';

describe('Autosave', () => {
  it('entprellt und speichert nach 3 s', async () => {
    vi.useFakeTimers(); const s = new MemoryStorage(); const d = newProject('A', new Date()); const io = new ProjectIO(s, t.fehler);
    const states: SaveStatus[] = []; const a = new Autosave({ io, getDoc: () => d, onStatus: (st) => states.push(st) });
    a.markDirty(); await vi.advanceTimersByTimeAsync(2900); expect(await s.readText('projekt.json')).toBeNull();
    await vi.advanceTimersByTimeAsync(200); expect(states.at(-1)).toBe('gespeichert'); vi.useRealTimers();
  });
  it('Fehler beim Speichern: Status fehler, nichts geht verloren (Review Focus 3)', async () => {
    const s = new MemoryStorage(); const d = newProject('A', new Date()); const io = new ProjectIO(s, t.fehler);
    const states: SaveStatus[] = []; const a = new Autosave({ io, getDoc: () => d, onStatus: (st) => states.push(st) });
    d.world.addTile({ layer: 1, tileset: 0, tx: 0, ty: 0, rot: 0, flipX: false, flipY: false, doubleSided: false, ghost: false, corners: cellQuad({ axis: 'y', offset: 0, facing: 1 }, 0, 0) });
    s.failNextWrites(1, new DOMException('voll', 'QuotaExceededError'));
    expect(await a.flush()).toBe(false); expect(states.at(-1)).toBe('fehler');
    expect(await a.flush()).toBe(true); expect(await s.list('welten/insel/chunks/')).toEqual(['welten/insel/chunks/0_0_0.json']);
  });
});
```

- [ ] **Step 2: Tests laufen lassen, sie müssen fehlschlagen**

Run: `npx vitest run packages/engine/tests/serialize.test.ts packages/editor/tests/projectIO.test.ts packages/editor/tests/autosave.test.ts`
Expected: FAIL.

- [ ] **Step 3: `strings/de.ts` mit dem Abschnitt `t.fehler` anlegen und die Dateien nach dem Interfaces-Block implementieren**

`t.fehler` enthält mindestens: `neuereVersion: 'Dieses Projekt stammt aus einer neueren Version des Programms.'`, `kaputt: 'Die Datei ist beschädigt und kann nicht gelesen werden.'`, `tilesetFehlt: (f: string) => \`Tileset fehlt: ${f}\``, `speichernFehlgeschlagen: 'Nicht gespeichert – der nächste Versuch läuft automatisch.'`, `keinWebgl2: 'Dein Browser unterstützt kein WebGL2. Bitte nutze eine aktuelle Version von Chrome oder Edge.'`. `ProjectIO` gibt `t.fehler` als `messages` an die Engine weiter.

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run packages/engine/tests/serialize.test.ts packages/editor/tests/projectIO.test.ts packages/editor/tests/autosave.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages && git commit -m "feat: Dateiformate, Speicher-Backends und automatisches Speichern"
```

---

### Task 10: Editor-Rahmen (Entwurf B), Sitzung, Ansicht und E2E-Grundlage

**Files:**
- Create: `packages/editor/vite.config.ts`, `index.html`, `src/main.tsx`, `src/app/theme.css`, `src/app/App.tsx`, `src/app/session.ts`, `src/app/testHooks.ts`, `src/state/editorState.ts`, `src/state/prefs.ts`, `src/viewport/viewportController.ts`, `src/viewport/keyboard.ts`, `src/viewport/Viewport.tsx`, `src/viewport/AxisGizmo.tsx`, `src/ui/TopBar.tsx`, `ToolRail.tsx`, `RightPanel.tsx`, `StatusBar.tsx`, `HintCard.tsx`, `StartScreen.tsx`, `Dialogs.tsx`, `icons.tsx`, `src/tools/registry.ts` (Name, Taste, Icon je Werkzeug), `src/tools/brush.ts` (nur `BrushState` und Standardwert); `playwright.config.ts`; `scripts/make-fixtures.mjs`; `packages/editor/e2e/helpers.ts`, `e2e/shell.spec.ts`
- Modify: `src/strings/de.ts`, `.github/workflows/ci.yml` (Build, `npx playwright install --with-deps chromium`, `npm run test:e2e`, Upload `packages/editor/dist` als Artefakt `editor-web`)

**Interfaces:**
- Consumes: alles aus Task 1–9.
- Produces:
  - `type ToolId = 'paint'|'block'|'select'|'fill'|'eyedropper'|'erase'`; `TOOL_KEYS: Record<ToolId, string> = { paint: 'b', block: 'k', select: 'a', fill: 'g', eyedropper: 'i', erase: 'e' }`.
  - `interface BrushState { tileset: number; tx: number; ty: number; w: number; h: number; rot: 0|1|2|3; flipX: boolean; flipY: boolean; size: 1|2|3; doubleSided: boolean; ghost: boolean; topTile: { tx: number; ty: number } | null }` (in `src/tools/brush.ts`; Standard `{ tileset: -1, tx: 0, ty: 0, w: 1, h: 1, rot: 0, flipX: false, flipY: false, size: 1, doubleSided: false, ghost: false, topTile: null }`).
  - `interface Preview { ghosts: TileData[]; lines: Float32Array; points: Float32Array }` (in `src/viewport/viewportController.ts`).
  - `editorState.ts`: `createEditorState(): EditorState` mit Signals `mode: 'start'|'edit'|'play'`, `tool: ToolId` (Start `'paint'`), `view: ViewKind`, `drawPlane: 'auto'|'x'|'y'|'z'`, `snap: 1|0.5|0.25`, `selectMode: 'vertices'|'edges'|'tiles'`, `brush: BrushState`, `activeLayer: number`, `hover: HoverInfo | null` (`{ point: [x,y,z]; planeLabel: string; tileId: number | null }`), `status: string | null`, `saveStatus: SaveStatus`, `docVersion: number`, `statsVisible: boolean`.
  - `prefs.ts`: `loadPrefs()/savePrefs()` (localStorage `rgm.prefs`): `{ uiScale: number /*1–2*/; hintsEnabled: boolean; hintsHiddenFor: ToolId[] }`.
  - `class EditorSession { static create(name: string, kind: 'indexeddb' | 'folder', dir?: FileSystemDirectoryHandle): Promise<EditorSession> /*legt Speicher an, speichert alles, trägt in „Zuletzt geöffnet“ ein*/; static open(entry: RecentEntry): Promise<EditorSession>; readonly project; readonly world; readonly history: History<DocCtx>; readonly autosave: Autosave; readonly tilesetImages: Map<number, ImageBitmap>; exec(cmd): void /*History + Autosave.markDirty + docVersion++*/; undo(); redo(); close(): Promise<void> }`. Bei `create` mit `kind 'indexeddb'` ist die Projekt-id `crypto.randomUUID()`.
  - `class ViewportController { constructor(canvas: HTMLCanvasElement, session: EditorSession, state: EditorState); camera: Camera; requestRender(): void; setPreview(p: Preview | null): void; readPixel(cssX, cssY): [number, number, number, number]; stats(): RenderStats; dispose(): void }`. Gerendert wird nur bei Bedarf (Kamera, Welt, Hover, Vorschau). Vor jedem Bild werden die Chunks aus `world.takeRenderDirty()` neu gemesht: zuerst die zuletzt bearbeiteten, insgesamt höchstens 8 ms pro Bild, Rest im nächsten Bild. Kein WebGL2 → `t.fehler.keinWebgl2` statt Canvas. Canvas-Auflösung = CSS-Größe × min(devicePixelRatio, 2). Nebel K7.
  - `keyboard.ts`: `installKeyboard(handlers: { onTool(id); onUndo(); onRedo(); onSave(); onPlay(); onKey(e: KeyboardEvent): boolean }): () => void`. Ignoriert Ereignisse aus `input`, `textarea`, `select`, `[contenteditable]`. Unterdrückt **immer** den Browser-Standard für F5, Strg+S, Strg+R, Strg+Z, Strg+Y (auch in Textfeldern; dort lösen sie aber keine Editor-Aktion aus).
  - `testHooks.ts`: wenn `import.meta.env.DEV` oder `?testhooks` in der URL: `window.__rgm = { state(), renderStats(), pixelAt(x, y), tiles(): number, tile(id), exec(name: 'addFloor'|'addWall', args: number[]), setCamera(x, y, z, yaw, pitch), player(), flushSave() }`. `addFloor [x0, z0, w, d, y]` legt w × d Bodenkacheln (facing +1) auf Höhe y an. `addWall [x0, z, w, h]` legt eine Wand (axis z, offset z, facing +1) von x0 bis x0 + w und y = 0 bis h an. Beide nutzen die aktive Ebene und den aktuellen Pinsel und laufen über die History (ein Undo-Schritt). `player()` liefert in Task 17 `{ x, y, z, grounded }`, bis dahin `null`.
  - Oberfläche wie Entwurf B (`docs/design/entwurf-b-klar-dunkel.dc.html`): obere Leiste (Projektname mit Speicherstatus als Menüknopf, Reiter Modelle/Welt/Regeln, wobei Modelle und Regeln deaktiviert sind mit `title = t.reiter.kommtEtappe3` bzw. `kommtEtappe2`, Rückgängig/Wiederholen, „Spielen“ mit `F5`), Werkzeugleiste links (sechs Werkzeuge, Taste als kleines Kürzel am Knopf, Tooltip mit Name und Taste), Ansicht (Ansichts-Umschalter, Achsen-Anzeige mit X rot `#ff7a7a`, Y grün `#7ee08f` nach oben, Z blau `#6fb2ff`, Kamera-Hinweis unten links), Seitenleiste rechts (Abschnitte, die spätere Tasks füllen), Statusleiste, Hinweis-Kärtchen über der Ansicht unten Mitte.
  - Startbildschirm: „Neues Projekt“ (Dialog: Name, Vorgabe „Mein Spiel“; Speicherort „Im Browser“ oder, wenn `showDirectoryPicker` existiert, „In einem Ordner auf dem PC“), „Ordner öffnen…“, „ZIP importieren…“, Liste „Zuletzt geöffnet“. Jeder Eintrag ist ein Knopf (`aria-label = t.start.oeffnen(name)` = `${name} öffnen`) mit Ort und Datum, dazu ein Entfernen-Knopf (`t.start.entfernen(name)` = `${name} aus der Liste entfernen`). Ordner-Projekte fragen beim Öffnen per `requestPermission({ mode: 'readwrite' })` nach. Den Knopf „Test-Insel (Leistungstest)“ ergänzt Task 18.
  - Texte (`de.ts`): Werkzeugnamen; Hinweise `t.hinweis.paint = 'Klick setzt eine Kachel · Ziehen malt weiter · Shift + Ziehen füllt ein Rechteck · Rechtsklick nimmt eine Kachel auf · R dreht, X spiegelt'`, `block = 'Klick setzt einen Block · Shift + Ziehen setzt eine Fläche aus Blöcken · Rechtsklick nimmt eine Kachel auf'`, `select = 'Klick wählt aus · Shift + Klick fügt hinzu · Ziehen verschiebt · 1 Ecken, 2 Kanten, 3 Kacheln · Bild↑/Bild↓ hebt und senkt'`, `fill = 'Klick füllt zusammenhängende gleiche Kacheln · Ziehen auf freier Fläche füllt ein Rechteck'`, `eyedropper = 'Klick nimmt Kachel, Drehung und Spiegelung auf'`, `erase = 'Klick oder Ziehen entfernt Kacheln · Shift + Ziehen entfernt ein Rechteck'`; `t.kamera = 'Rechte Maustaste: umsehen · mit WASD fliegen · Rad: zoomen · Leertaste: verschieben'`; Speicherstatus `t.speichern = { gespeichert: 'Gespeichert', ungespeichert: 'Nicht gespeichert', speichert: 'Speichert …', fehler: 'Nicht gespeichert – Fehler' }`.

- [ ] **Step 1: Fixtures, Playwright-Konfiguration und den fehlschlagenden E2E-Test schreiben**

`scripts/make-fixtures.mjs` (Node, nur `zlib`) schreibt nach `packages/editor/e2e/fixtures/`: `kacheln-16.png` (64×32 px, 4×2 Kacheln mit gut unterscheidbaren Vollfarben und 1 px dunklem Rand), `ungerade-50x40.png`, `zu-gross-20000x16.png`, `kein-bild.png` (zufällige Bytes).
`playwright.config.ts`: `testDir: 'packages/editor/e2e'`, `use.baseURL: 'http://localhost:4173/?testhooks'`, Viewport 1440×900, `launchOptions: { executablePath: process.env.CHROME_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }`, `webServer: { command: 'npm run build -w @rgm/editor && npm run preview -w @rgm/editor -- --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI, timeout: 180000 }`.
`e2e/helpers.ts`: `newProject(page, name = 'E2E')` (Dialog „Neues Projekt“, Speicherort „Im Browser“), `hooks(page, name: string, ...args)` (ruft `window.__rgm[name](...args)` per `page.evaluate` auf und gibt das Ergebnis zurück), `importTileset(page, file)` (`setInputFiles` auf das Datei-Feld im Bereich „Tileset“ mit `e2e/fixtures/<file>`).

```ts
// packages/editor/e2e/shell.spec.ts
import { test, expect } from '@playwright/test';
import { newProject } from './helpers';

test('Startbildschirm → neues Projekt → Editor im Aufbau von B', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Neues Projekt' })).toBeVisible();
  await newProject(page, 'Insel-Test');
  await expect(page.getByRole('navigation', { name: 'Werkbänke' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Welt' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: 'Regeln' })).toBeDisabled();
  await expect(page.getByRole('navigation', { name: 'Werkzeuge' }).getByRole('button')).toHaveCount(6);
  await expect(page.locator('canvas')).toBeVisible();
});
test('Werkzeug-Tasten schalten um, das Hinweis-Kärtchen folgt', async ({ page }) => {
  await page.goto('/'); await newProject(page);
  await page.keyboard.press('k');
  await expect(page.getByRole('button', { name: /Block setzen/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('note')).toContainText('Klick setzt einen Block');
});
test('Tasten lösen beim Tippen nicht aus, F5/Strg+S/Strg+R laden nicht neu (Review Focus 1)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Neues Projekt' }).click();
  await page.getByLabel('Name').fill(''); await page.getByLabel('Name').click(); await page.keyboard.type('kabine');
  await page.getByRole('button', { name: 'Anlegen' }).click();
  await expect(page.getByRole('button', { name: /Kachel malen/ })).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => ((window as any).__marker = 42));
  await page.keyboard.press('F5'); await page.keyboard.press('Escape');
  await page.keyboard.press('Control+s'); await page.keyboard.press('Control+r');
  expect(await page.evaluate(() => (window as any).__marker)).toBe(42);
});
test('speichern, neu laden, aus „Zuletzt geöffnet“ wieder öffnen', async ({ page }) => {
  await page.goto('/'); await newProject(page, 'Wiederkehr');
  await page.evaluate(() => (window as any).__rgm.exec('addFloor', [0, 0, 3, 2, 0]));
  expect(await page.evaluate(() => (window as any).__rgm.flushSave())).toBe(true);
  await page.reload();
  await page.getByRole('button', { name: 'Wiederkehr öffnen' }).click();
  await expect.poll(async () => (await page.evaluate(() => (window as any).__rgm.state())).tiles).toBe(6);
});
test('die Ansicht rendert eine Kachel (Pixeltest)', async ({ page }) => {
  await page.goto('/'); await newProject(page);
  await page.evaluate(() => (window as any).__rgm.exec('addFloor', [-1, -1, 3, 3, 0]));
  await page.evaluate(() => (window as any).__rgm.setCamera(0.5, 5, 0.5, 0, -Math.PI / 2 + 0.01));
  const box = (await page.locator('canvas').boundingBox())!;
  const px = await page.evaluate(([x, y]) => (window as any).__rgm.pixelAt(x, y), [box.width / 2, box.height / 2]);
  expect(px.slice(0, 3)).not.toEqual([0x16, 0x18, 0x1b]);
});
```
Der Dialog „Neues Projekt“ hat ein Feld mit dem Label „Name“ und den Knopf „Anlegen“. Im Play-Modus beendet Escape das Spiel; den Play-Modus selbst baut erst Task 17. Bis dahin ist F5 nur ein abgefangener Tastendruck ohne Wirkung, Escape ebenfalls. Ohne Tileset hat der Pinsel `tileset: -1`; der Renderer zeichnet `tileset -1` mit einer eingebauten 2×2-Prüftextur (Grau `#5a5f6a` / `#3d414a`).

- [ ] **Step 2: E2E-Test laufen lassen, er muss fehlschlagen**

Run: `node scripts/make-fixtures.mjs && CHROME_PATH=/usr/bin/google-chrome npx playwright test packages/editor/e2e/shell.spec.ts`
Expected: FAIL (Build bzw. Seite fehlt).

- [ ] **Step 3: App, Sitzung, Zustand, Ansicht, Tastatur, Test-Hooks und Oberfläche implementieren**

Schriften über `@fontsource/inter/{400,500,600}.css` und `@fontsource/jetbrains-mono/{400,500}.css` in `main.tsx`. Icons als Preact-Komponenten mit den Pfaden aus Entwurf B. Das Hinweis-Kärtchen hat `role="note"` und einen ×-Knopf (`aria-label = t.hinweis.ausblenden`), der den Hinweis für das aktuelle Werkzeug in `prefs.hintsHiddenFor` merkt. Der Dialog „Neues Projekt“ liegt in `Dialogs.tsx`.

- [ ] **Step 4: E2E- und Unit-Tests laufen lassen**

Run: `npm run typecheck && npm test && CHROME_PATH=/usr/bin/google-chrome npx playwright test packages/editor/e2e/shell.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(editor): Editor-Rahmen nach Entwurf B, Sitzung, Ansicht und E2E-Grundlage"
```

---

### Task 11: Tileset importieren und Tileset-Bereich

**Files:**
- Create: `packages/editor/src/tileset/validateTileset.ts`, `importTileset.ts`, `src/ui/TilesetPanel.tsx`
- Modify: `src/ui/RightPanel.tsx`, `src/app/session.ts` (Tileset laden und an den Renderer geben), `src/strings/de.ts`
- Test: `packages/editor/tests/validateTileset.test.ts`, `packages/editor/e2e/tileset.spec.ts`

**Interfaces:**
- Consumes: `addTilesetCmd`, `TilesetMeta`, `Autosave.addFile`, `TileRenderer.setTileset`.
- Produces:
  - `validateTilesetImage(width, height, tileSize, maxTextureSize): { ok: true; columns: number; rows: number; warnings: string[] } | { ok: false; error: string }`. Regeln: tileSize ganzzahlig 4…256, sonst `t.tileset.kachelgroesseUngueltig`. Bild kleiner als eine Kachel → `t.tileset.zuKlein`. Breite oder Höhe > maxTextureSize → `t.tileset.zuGross(max)`. Nicht teilbar → Warnung `t.tileset.randIgnoriert(restX, restY)`, und columns/rows werden abgerundet.
  - `importTilesetFile(file: File, tileSize: number, session: EditorSession): Promise<TilesetMeta>`: Dekodieren mit `createImageBitmap`, bei Fehler `t.tileset.keinBild`. Dateiname wird bereinigt (`[^a-z0-9-_]` → `-`, eindeutig mit `-2`, `-3`, …) und als `tilesets/<name>.png` über `Autosave.addFile` gespeichert. Danach `addTilesetCmd`, und der Pinsel wird auf (neues Tileset, 0, 0) gesetzt.
  - `TilesetPanel` (`<section role="region" aria-label="Tileset">`): Auswahl des Tilesets, Kachelgröße (8 / 16 / 32 / Eigene; nur änderbar, solange keine Kachel das Tileset nutzt; ein neuer Import nutzt die eingestellte Größe, Standard 16), Knopf „Tileset laden“ (verstecktes `<input type="file" accept="image/png">`), PNG per Ziehen und Ablegen ins Fenster. Das Bild ist ein `<canvas role="img" aria-label="Tileset {name}">`. Das Bild wird pixelgenau (`image-rendering: pixelated`) mit Raster angezeigt. Klick wählt eine Kachel, Ziehen ein Rechteck (→ `brush.w/h`), **Alt+Klick setzt die Deckel-Kachel für Blöcke** (`brush.topTile`). Leerer Zustand: `t.tileset.leer = 'Noch kein Tileset. Ziehe ein PNG hierher oder klicke auf „Tileset laden“.'`

- [ ] **Step 1: Die fehlschlagenden Tests schreiben**

```ts
// packages/editor/tests/validateTileset.test.ts
import { describe, it, expect } from 'vitest';
import { validateTilesetImage } from '../src/tileset/validateTileset';
import { t } from '../src/strings/de';
describe('validateTilesetImage (Review Focus 2)', () => {
  it('passend', () => expect(validateTilesetImage(64, 32, 16, 16384)).toEqual({ ok: true, columns: 4, rows: 2, warnings: [] }));
  it('Rand wird ignoriert und gemeldet', () => {
    const r = validateTilesetImage(50, 40, 16, 16384);
    expect(r).toEqual({ ok: true, columns: 3, rows: 2, warnings: [t.tileset.randIgnoriert(2, 8)] });
  });
  it('zu groß, zu klein, ungültige Kachelgröße', () => {
    expect(validateTilesetImage(20000, 16, 16, 16384)).toEqual({ ok: false, error: t.tileset.zuGross(16384) });
    expect(validateTilesetImage(8, 8, 16, 16384)).toEqual({ ok: false, error: t.tileset.zuKlein });
    expect(validateTilesetImage(64, 64, 3, 16384)).toEqual({ ok: false, error: t.tileset.kachelgroesseUngueltig });
  });
});
```

```ts
// packages/editor/e2e/tileset.spec.ts
import { test, expect } from '@playwright/test';
import { newProject, importTileset, hooks } from './helpers';
test('Tileset importieren und Rechteck als Pinsel wählen', async ({ page }) => {
  await page.goto('/'); await newProject(page);
  await importTileset(page, 'kacheln-16.png');
  const panel = page.getByRole('region', { name: 'Tileset' });
  await expect(panel.getByRole('img', { name: /kacheln-16/ })).toBeVisible();
  const img = panel.getByRole('img', { name: /kacheln-16/ }); const b = (await img.boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.1, b.y + b.height * 0.25); await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.4, b.y + b.height * 0.25); await page.mouse.up();
  expect((await hooks(page, 'state')).brush).toMatchObject({ tx: 0, ty: 0, w: 2, h: 1 });
});
test('kein Bild und zu großes Bild melden sich verständlich (Review Focus 2)', async ({ page }) => {
  await page.goto('/'); await newProject(page);
  await importTileset(page, 'kein-bild.png');
  await expect(page.getByRole('alert')).toContainText('Das ist kein Bild');
  await importTileset(page, 'zu-gross-20000x16.png');
  await expect(page.getByRole('alert')).toContainText('zu groß');
});
```

- [ ] **Step 2: Tests laufen lassen, sie müssen fehlschlagen**

Run: `npx vitest run packages/editor/tests/validateTileset.test.ts && CHROME_PATH=/usr/bin/google-chrome npx playwright test packages/editor/e2e/tileset.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Validierung, Import und Tileset-Bereich implementieren**

Texte: `t.tileset.keinBild = 'Das ist kein Bild, das ich lesen kann. Bitte wähle eine PNG-Datei.'`, `zuGross = (max) => \`Das Bild ist zu groß (höchstens ${max} px Breite und Höhe).\``, `zuKlein = 'Das Bild ist kleiner als eine Kachel.'`, `randIgnoriert = (x, y) => \`Der Rand passt nicht ins Raster und wird ignoriert: ${x} px rechts, ${y} px unten.\``, `kachelgroesseUngueltig = 'Die Kachelgröße muss zwischen 4 und 256 px liegen.'`. Meldungen erscheinen als Toast mit `role="alert"`. `maxTextureSize` liefert `gl.getParameter(gl.MAX_TEXTURE_SIZE)`.

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run packages/editor/tests/validateTileset.test.ts && CHROME_PATH=/usr/bin/google-chrome npx playwright test packages/editor/e2e/tileset.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(editor): Tileset importieren und Tileset-Bereich"
```

---

### Task 12: Editor-Kamera

**Files:**
- Create: `packages/editor/src/viewport/cameraController.ts`
- Modify: `src/viewport/viewportController.ts`, `src/ui/StatusBar.tsx` (Ansichts-Umschalter verbinden)
- Test: `packages/editor/tests/cameraController.test.ts`

**Interfaces:**
- Consumes: `Camera`, `ViewKind`.
- Produces: `class CameraController { constructor(camera: Camera, onChange: () => void); pointerDown(button: number, x: number, y: number, spaceHeld: boolean): boolean; pointerMove(x, y): boolean; pointerUp(button): void; wheel(deltaY: number, focusDistance: number | null): void; setView(v: ViewKind): void; focus(point: ArrayLike<number>): void; update(dt: number, keys: ReadonlySet<string>): boolean; readonly looking: boolean }`. Werte: Umsehen 0,0025 rad pro Pixel (rechte Maustaste); Fliegen mit W/A/S/D/Q/E nur bei gehaltener rechter Maustaste, 10 m/s, mit Shift × 3; Rad in Perspektive: 10 % der Fokusdistanz (mindestens 0,5 m) pro Raste entlang der Blickrichtung, in Ortho `orthoScale × 1,1` bzw. `÷ 1,1`; Verschieben mit Leertaste + linke Maustaste oder mittlere Maustaste, in Perspektive 0,02 m pro Pixel × Fokusdistanz/10, in Ortho mit dem Bildmaßstab; F rückt die Kamera auf 6 m vor den Punkt.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

```ts
// packages/editor/tests/cameraController.test.ts
import { describe, it, expect } from 'vitest';
import { Camera } from '@rgm/engine';
import { CameraController } from '../src/viewport/cameraController';
describe('CameraController', () => {
  it('rechte Maustaste: 100 px nach rechts dreht yaw um −0,25 rad', () => {
    const c = new Camera(); const k = new CameraController(c, () => {});
    k.pointerDown(2, 0, 0, false); k.pointerMove(100, 0); expect(c.yaw).toBeCloseTo(-0.25, 6);
  });
  it('WASD fliegt nur mit gehaltener rechter Taste, 10 m/s', () => {
    const c = new Camera(); const k = new CameraController(c, () => {});
    k.update(1, new Set(['w'])); expect(c.position[2]).toBeCloseTo(0, 6);
    k.pointerDown(2, 0, 0, false); k.update(1, new Set(['w'])); expect(c.position[2]).toBeCloseTo(-10, 4);
  });
  it('Rad in Ortho ändert den Maßstab um den Faktor 1,1', () => {
    const c = new Camera(); const k = new CameraController(c, () => {}); k.setView('top'); const s = c.orthoScale;
    k.wheel(100, null); expect(c.orthoScale).toBeCloseTo(s * 1.1, 6);
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run packages/editor/tests/cameraController.test.ts`
Expected: FAIL.

- [ ] **Step 3: `CameraController` implementieren und im `ViewportController` an die Zeiger- und Rad-Ereignisse anschließen**

Die Kamera wird bei jeder Änderung in `project.editor.camera` gespiegelt.

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run packages/editor/tests/cameraController.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(editor): Editor-Kamera mit Umsehen, Fliegen, Zoom und Ortho-Ansichten"
```

---

### Task 13: Werkzeug-Gerüst, Kachel malen, Pipette, Radieren und Pinsel-Bereich

**Files:**
- Create: `packages/editor/src/tools/tool.ts`, `drawPlane.ts`, `paintTool.ts`, `eyedropperTool.ts`, `eraseTool.ts`, `src/ui/BrushPanel.tsx`, `tests/toolHarness.ts`
- Modify: `src/tools/brush.ts` (`stampCells`, `brushTile`), `src/tools/registry.ts`, `src/viewport/viewportController.ts` (Ereignisse an Werkzeuge, Vorschau zeichnen: Geister mit Alpha 0,6, Raster auf der Zeichenebene in ±24 Zellen mit `rgba(255,255,255,0.22)`, 3D-Cursor-Linien in `--accent`), `src/ui/RightPanel.tsx`, `src/ui/StatusBar.tsx`, `src/strings/de.ts`
- Test: `packages/editor/tests/brush.test.ts`, `packages/editor/tests/paintTool.test.ts`, `packages/editor/e2e/paint.spec.ts`

**Interfaces:**
- Consumes: `World`, `History`, Befehle aus Task 8, `raycastWorld`, `rayPlane`, `cellQuad`, `planeOfQuad`, `worldToPlane`, `Camera`, `BrushState` und `Preview` (Task 10).
- Produces:
  - `interface StampCell { du: number; dv: number; tx: number; ty: number }`; `stampCells(brush, plane): StampCell[]`. Muster w×h in Textur-Koordinaten (i rechts, j unten) wird `rot`-mal im Uhrzeigersinn gedreht (`(i, j) → (h−1−j, i)`, Maße werden getauscht), über K2 auf (du, dv) abgebildet und `size × size`-mal wiederholt.
  - `brushTile(brush, cell, corners, layer): TileData` (übernimmt rot/flip/doubleSided/ghost).
  - `interface ToolPointer { ndcX: number; ndcY: number; px: number; py: number; button: 0|2; shift: boolean; alt: boolean; ctrl: boolean }` (NDC wird nicht auf ±1 begrenzt)
  - `interface ToolContext { world: World; exec(cmd: Command<DocCtx>): void; history: History<DocCtx>; state: EditorState; camera: Camera; aspect(): number; raycast(ndcX, ndcY): RayHit | null /*nur sichtbare Ebenen*/; screenRay(ndcX, ndcY, o, d): void; editable(layer): boolean /*sichtbar und nicht gesperrt*/; setPreview(p: Preview | null): void; notify(msg: string): void; project(p, out: Float32Array): boolean /*Welt → Canvas-px*/ }`
  - `interface Tool { readonly id: ToolId; pointerDown(p, c): void; pointerMove(p, c): void; pointerUp(p, c): void; key(e: KeyboardEvent, c): boolean; deactivate?(c): void }`
  - `drawPlane.ts`: `class PlaneResolver { sticky: DrawPlane /*Start: Boden y=0, facing +1*/; cursor: Float32Array /*3D-Cursor*/; resolve(mode, hit: RayHit | null, world: World, camPos): DrawPlane; setCursor(p, snap): void; offsetCursor(steps: number, snap): void }`. `auto`: Ein Treffer auf eine achsparallele Kachel liefert deren Ebene (und `sticky` wird diese Ebene), sonst gilt `sticky`. `x`/`y`/`z`: Ebene durch den 3D-Cursor senkrecht zur Achse, `facing` zur Kamera hin. **Strg+Klick** setzt den 3D-Cursor auf den getroffenen Punkt (gerastert). **Bild↑/Bild↓** verschiebt die Ebene um einen Rasterschritt entlang ihrer Normalen. **Q** wechselt `auto → y → x → z → auto`.
  - `cellAt(plane, point, snap, free: boolean): [u, v]`: `floor(u/snap)·snap` bzw. mit Alt (`free`) `u − 0,5`.
  - Malen auf eine **nicht achsparallele** Kachel (z. B. Rampe): Nur diese Kachel wird mit der oberen linken Pinsel-Kachel umgemalt; es entsteht keine neue Kachel.
  - Malen: Für jede Stempelzelle `cellQuad` berechnen. Liegt dort schon eine Kachel mit gleicher Richtung (`findCoincident(…, 'same')`) auf einer bearbeitbaren Ebene, wird sie umgemalt (`updateTilesCmd`), sonst neu angelegt in `state.activeLayer`. Ein Strich ist **ein** Undo-Schritt (`begin`/`end`); je Strich wird jede Zelle nur einmal gestempelt. Shift + Ziehen spannt ein Rechteck von der Start- zur aktuellen Zelle auf und setzt es beim Loslassen; über 65.536 Kacheln → nichts setzen, `notify(t.status.zuGross)`. Rechtsklick = Pipette. R dreht den Pinsel, X spiegelt horizontal, Shift+X vertikal. Ist die aktive Ebene gesperrt oder verborgen: `notify(t.status.ebeneGesperrt)`.
  - Pipette: Treffer → `brush = { …, tileset, tx, ty, w: 1, h: 1, rot, flipX, flipY }`.
  - Radieren: Klick/Ziehen entfernt getroffene, bearbeitbare Kacheln (ein Undo-Schritt je Strich). Shift + Ziehen entfernt alle bearbeitbaren Kacheln, deren Schwerpunkt im Rechteck auf der Zeichenebene liegt (Abstand zur Ebene < 0,01; höchstens 65.536).
  - `BrushPanel`: Vorschau, Name `t.pinsel.kachel(tx, ty)`, Knöpfe Drehen (R) und Spiegeln (X), Größe 1/2/3, Schalter „Beidseitig“ und „Ohne Kollision“, Deckel-Kachel mit ×, Zeichenebene als Umschalter Auto / Boden / Wand X / Wand Z (Q).
  - Statusleiste: `x … · z … · Höhe …` (Mono), Ebenen-Name, Rasterschritt (Klick wechselt 1 → ½ → ¼), Pinsel, Kurzhinweis. Texte: `t.status.zuGross = 'Zu groß: höchstens 65.536 Kacheln auf einmal.'`, `t.status.ebeneGesperrt = 'Diese Ebene ist gesperrt oder ausgeblendet.'`.

- [ ] **Step 1: Die fehlschlagenden Tests schreiben**

```ts
// packages/editor/tests/brush.test.ts
import { describe, it, expect } from 'vitest';
import { stampCells } from '../src/tools/brush';
const b = { tileset: 0, tx: 4, ty: 1, w: 2, h: 1, rot: 0 as const, flipX: false, flipY: false, size: 1 as const, doubleSided: false, ghost: false, topTile: null };
const floor = { axis: 'y' as const, offset: 0, facing: 1 as const };
const wall = { axis: 'z' as const, offset: 0, facing: 1 as const };
describe('stampCells', () => {
  it('2×1-Pinsel auf dem Boden', () => expect(stampCells(b, floor)).toEqual([{ du: 0, dv: 0, tx: 4, ty: 1 }, { du: 1, dv: 0, tx: 5, ty: 1 }]));
  it('gedreht (rot 1) liegt er quer', () => expect(stampCells({ ...b, rot: 1 }, floor)).toEqual([{ du: 0, dv: 0, tx: 4, ty: 1 }, { du: 0, dv: 1, tx: 5, ty: 1 }]));
  it('1×2-Pinsel an der Wand: obere Zeile oben', () => expect(stampCells({ ...b, w: 1, h: 2 }, wall)).toEqual([{ du: 0, dv: 1, tx: 4, ty: 1 }, { du: 0, dv: 0, tx: 4, ty: 2 }]));
  it('Größe 2 wiederholt das Muster', () => expect(stampCells({ ...b, w: 1, size: 2 }, floor).length).toBe(4));
});
```

```ts
// packages/editor/tests/paintTool.test.ts
import { describe, it, expect } from 'vitest';
import { makeToolHarness } from './toolHarness'; // Helfer: Welt, History, Zustand, Kamera über dem Ursprung (Blick senkrecht nach unten), pointer(ndc→Zelle)
describe('Kachel malen', () => {
  it('Klick auf freien Boden setzt eine Kachel; zweiter Klick malt um statt zu stapeln', () => {
    const h = makeToolHarness('paint'); h.clickCell(2, 3);
    expect(h.world.tileCount()).toBe(1);
    h.state.brush.value = { ...h.state.brush.value, tx: 3 }; h.clickCell(2, 3);
    expect(h.world.tileCount()).toBe(1); expect(h.onlyTile().tx).toBe(3);
  });
  it('Ziehen über 3 Zellen = 3 Kacheln = ein Undo-Schritt', () => {
    const h = makeToolHarness('paint'); h.dragCells([0, 0], [2, 0]);
    expect(h.world.tileCount()).toBe(3); h.history.undo(); expect(h.world.tileCount()).toBe(0);
  });
  it('Shift + Ziehen 4×3 = 12 Kacheln; 300×300 wird abgelehnt (Review Focus 5)', () => {
    const h = makeToolHarness('paint'); h.dragCells([0, 0], [3, 2], { shift: true }); expect(h.world.tileCount()).toBe(12);
    h.dragCells([0, 10], [299, 309], { shift: true });
    expect(h.world.tileCount()).toBe(12); expect(h.lastNotice).toBe('Zu groß: höchstens 65.536 Kacheln auf einmal.');
  });
  it('Rechtsklick übernimmt Kachel, Drehung und Spiegelung', () => {
    const h = makeToolHarness('paint'); h.state.brush.value = { ...h.state.brush.value, tx: 2, rot: 3, flipX: true }; h.clickCell(0, 0);
    h.state.brush.value = { ...h.state.brush.value, tx: 0, rot: 0, flipX: false }; h.clickCell(0, 0, { button: 2 });
    expect(h.state.brush.value).toMatchObject({ tx: 2, rot: 3, flipX: true });
  });
  it('gesperrte Ebene: nichts passiert, Meldung erscheint', () => {
    const h = makeToolHarness('paint'); h.world.layers[0].locked = true; h.clickCell(0, 0);
    expect(h.world.tileCount()).toBe(0); expect(h.lastNotice).toBe('Diese Ebene ist gesperrt oder ausgeblendet.');
  });
  it('Radieren entfernt die getroffene Kachel', () => {
    const h = makeToolHarness('paint'); h.clickCell(1, 1); h.useTool('erase'); h.clickCell(1, 1); expect(h.world.tileCount()).toBe(0);
  });
  it('auf eine Rampe malen: nur umfärben, keine neue Kachel', () => {
    const h = makeToolHarness('paint'); h.clickCell(0, 0);
    const id = h.tileIds()[0]; const t = h.world.getTile(id)!; t.corners[7] = 1; t.corners[10] = 1; h.world.setTile(id, t);
    h.state.brush.value = { ...h.state.brush.value, tx: 3 }; h.clickCell(0, 0, { onTile: true });
    expect(h.world.tileCount()).toBe(1); expect(h.onlyTile().tx).toBe(3);
  });
});
```
`packages/editor/tests/toolHarness.ts` (in diesem Task anlegen): baut `ToolContext` ohne DOM. Die Kamera steht bei (0, 50, 0) und blickt senkrecht nach unten, in Ortho `top` mit `orthoScale = 20`, `aspect = 1` und einem gedachten Canvas von 1000 × 1000 px. `clickCell(u, v, opts)` rechnet die Zellmitte in NDC um; auch Werte außerhalb von ±1 sind erlaubt. `opts.onTile` setzt den Treffpunkt auf die Oberfläche der dortigen Kachel statt auf y = 0, und `opts.button`/`opts.shift` werden durchgereicht. Dazu `dragCells`, `useTool`, `onlyTile()`, `lastNotice` und `tileIds()` (alle ids sortiert, gesammelt über `world.chunks`).

```ts
// packages/editor/e2e/paint.spec.ts
import { test, expect } from '@playwright/test';
import { newProject, importTileset, hooks } from './helpers';
test('malen, rückgängig, wiederholen in der echten Oberfläche', async ({ page }) => {
  await page.goto('/'); await newProject(page); await importTileset(page, 'kacheln-16.png');
  await page.keyboard.press('b');
  const c = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(c.x + c.width / 2, c.y + c.height / 2 + 120);
  expect((await hooks(page, 'state')).tiles).toBe(1);
  await page.keyboard.press('Control+z'); expect((await hooks(page, 'state')).tiles).toBe(0);
  await page.keyboard.press('Control+y'); expect((await hooks(page, 'state')).tiles).toBe(1);
});
```

- [ ] **Step 2: Tests laufen lassen, sie müssen fehlschlagen**

Run: `npx vitest run packages/editor/tests/brush.test.ts packages/editor/tests/paintTool.test.ts`
Expected: FAIL.

- [ ] **Step 3: Werkzeug-Gerüst, Pinsel, Zeichenebene, Malen, Pipette, Radieren, Vorschau und Pinsel-Bereich implementieren**

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run packages/editor/tests && CHROME_PATH=/usr/bin/google-chrome npx playwright test packages/editor/e2e/paint.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(editor): Kachel malen, Pipette, Radieren und Pinsel-Bereich"
```

---

### Task 14: Block setzen und Füllen

**Files:**
- Create: `packages/engine/src/geometry/adjacency.ts`; `packages/editor/src/tools/blockTool.ts`, `fillTool.ts`
- Modify: `src/tools/registry.ts`, `packages/engine/src/index.ts`
- Test: `packages/engine/tests/adjacency.test.ts`, `packages/editor/tests/blockFill.test.ts`

**Interfaces:**
- Consumes: `blockQuads`, `BlockFace`, `World.findCoincident`, `editTilesCmd`, `updateTilesCmd`, `stampCells`, `ToolContext`.
- Produces:
  - `floodCoplanar(world, startId, accept: (id: number, t: TileData) => boolean, cap: number): { ids: number[]; capped: boolean }`: Breitensuche über Kacheln in derselben Ebene (Normalen-dot > 0,999, Ebenenabstand < 1e-3) mit gemeinsamer Kante (zwei Ecken gleich, 1e-4). Kandidaten kommen über `queryAabb` aus dem um 0,01 vergrößerten AABB der aktuellen Kachel.
  - Block setzen: Zielzelle bei Treffer auf eine achsparallele Fläche = `floor(Trefferpunkt + Normale·0,5)` je Achse; ohne Treffer auf der Zeichenebene direkt vor ihr (Boden facing +1 → y = offset; facing −1 → y = offset − 1; Wände entsprechend). Blöcke liegen immer auf dem 1-m-Raster; `size` ergibt eine Fläche aus size × size Blöcken. Je Fläche des Blocks: Gibt es eine deckungsgleiche Kachel **mit Gegenrichtung** auf bearbeitbarer Ebene, werden beide entfernt (verdeckte Innenfläche). Gibt es eine **mit gleicher Richtung**, wird sie umgemalt, sonst angelegt. Der Deckel (BlockFace.Top) nutzt `brush.topTile ?? (tx, ty)`, alle anderen `(brush.tx, brush.ty)`. Mehrere Blöcke einer Aktion werden nacheinander als `editTilesCmd` innerhalb von `begin`/`end` ausgeführt (ein Undo-Schritt). Shift + Ziehen = Rechteck aus Blöcken, höchstens 4.096.
  - Füllen: Klick auf eine bearbeitbare Kachel → `floodCoplanar` mit gleichem (tileset, tx, ty) und gleicher Ebene; Obergrenze 65.536 (darüber `notify(t.status.zuGross)`, nichts ändern). Alle gefundenen Kacheln werden mit dem Pinsel umgemalt; bei mehrteiligem Pinsel nimmt jede Kachel die Musterzelle `(floor(u0) mod W', floor(v0) mod H')` (u0, v0 = kleinste Ebenen-Koordinate ihrer Ecken). Ziehen auf freier Fläche (kein Treffer beim Drücken) = Rechteck wie bei Kachel malen.

- [ ] **Step 1: Die fehlschlagenden Tests schreiben**

```ts
// packages/engine/tests/adjacency.test.ts
import { describe, it, expect } from 'vitest';
import { World, cellQuad, floodCoplanar, type TileData } from '../src';
const T = (x: number, z: number, tx = 0): TileData => ({ layer: 1, tileset: 0, tx, ty: 0, rot: 0, flipX: false, flipY: false, doubleSided: false, ghost: false, corners: cellQuad({ axis: 'y', offset: 0, facing: 1 }, x, z) });
describe('floodCoplanar', () => {
  it('5×5 gleiche Kacheln, umrandet von anderen', () => {
    const w = new World(); w.addLayer('a'); let start = 0;
    for (let x = -1; x <= 5; x++) for (let z = -1; z <= 5; z++) { const inner = x >= 0 && x < 5 && z >= 0 && z < 5; const id = w.addTile(T(x, z, inner ? 0 : 1)); if (x === 2 && z === 2) start = id; }
    const r = floodCoplanar(w, start, (_, t) => t.tx === 0, 65536); expect(r.ids.length).toBe(25); expect(r.capped).toBe(false);
  });
  it('bricht an der Obergrenze ab', () => {
    const w = new World(); w.addLayer('a'); const s = w.addTile(T(0, 0)); for (let x = 1; x < 20; x++) w.addTile(T(x, 0));
    expect(floodCoplanar(w, s, () => true, 10)).toMatchObject({ capped: true });
  });
});
```

```ts
// packages/editor/tests/blockFill.test.ts
import { describe, it, expect } from 'vitest';
import { makeToolHarness } from './toolHarness';
describe('Block setzen', () => {
  it('ein Block = 6 Kacheln, zwei Nachbarn = 10, undo = 0', () => {
    const h = makeToolHarness('block'); h.clickCell(0, 0); expect(h.world.tileCount()).toBe(6);
    h.clickCell(1, 0); expect(h.world.tileCount()).toBe(10);
    h.history.undo(); h.history.undo(); expect(h.world.tileCount()).toBe(0);
  });
  it('Block auf eine Bodenkachel entfernt die verdeckte Bodenkachel', () => {
    const h = makeToolHarness('paint'); h.dragCells([0, 0], [2, 0], { shift: true }); h.useTool('block'); h.clickCell(1, 0, { onTile: true });
    expect(h.world.tileCount()).toBe(3 - 1 + 5);
  });
  it('Deckel-Kachel', () => {
    const h = makeToolHarness('block'); h.state.brush.value = { ...h.state.brush.value, tx: 1, topTile: { tx: 3, ty: 0 } }; h.clickCell(0, 0);
    expect(h.tilesFacing([0, 1, 0])[0].tx).toBe(3); expect(h.tilesFacing([1, 0, 0])[0].tx).toBe(1);
  });
});
describe('Füllen', () => {
  it('malt eine zusammenhängende gleiche Fläche um, Nachbarn bleiben', () => {
    const h = makeToolHarness('paint'); h.dragCells([0, 0], [4, 4], { shift: true });
    h.state.brush.value = { ...h.state.brush.value, tx: 1 }; h.dragCells([5, 0], [5, 4], { shift: true });
    h.state.brush.value = { ...h.state.brush.value, tx: 2 }; h.useTool('fill'); h.clickCell(2, 2, { onTile: true });
    expect(h.countWhere((t) => t.tx === 2)).toBe(25); expect(h.countWhere((t) => t.tx === 1)).toBe(5);
  });
});
```
`toolHarness` bekommt dazu `tilesFacing(normal)` und `countWhere(pred)`.

- [ ] **Step 2: Tests laufen lassen, sie müssen fehlschlagen**

Run: `npx vitest run packages/engine/tests/adjacency.test.ts packages/editor/tests/blockFill.test.ts`
Expected: FAIL.

- [ ] **Step 3: `floodCoplanar`, `blockTool`, `fillTool` implementieren und registrieren**

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run packages/engine/tests/adjacency.test.ts packages/editor/tests`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: Block setzen mit verdeckten Innenflächen und Füllen"
```

---

### Task 15: Auswählen, Verschieben, Drehen, Skalieren und Formen biegen

**Files:**
- Create: `packages/engine/src/geometry/transform.ts`, `extrude.ts`; `packages/editor/src/tools/selection.ts`, `selectTool.ts`, `src/ui/SelectionPanel.tsx`
- Modify: `packages/engine/src/index.ts`, `src/state/editorState.ts` (Signal `selection`, Start: leere Kachel-Auswahl), `src/tools/registry.ts`, `src/ui/RightPanel.tsx`, `src/viewport/viewportController.ts` (Auswahl zeichnen: Kacheln mit `--accent`-Umriss und 25 % Füllung, Ecken als 6-px-Punkte, Kanten als Linien)
- Test: `packages/engine/tests/transform.test.ts`, `packages/editor/tests/selectTool.test.ts`

**Interfaces:**
- Consumes: `World`, `TileChange`, `updateTilesCmd`, `editTilesCmd`, `removeTilesCmd`, `selectVisibleChunks`, `ToolContext`.
- Produces (Engine, alle ohne Änderung der Welt, Rückgabe für Befehle):
  - `translateTiles(world, ids: Iterable<number>, delta): TileChange[]`
  - `rotateTiles90(world, ids, axis: 'x'|'y'|'z', turns: 1 | -1, pivot): TileChange[]`: Winkel = −turns · 90° nach der Rechte-Hand-Regel um die Achse. Für turns = 1 um Y also im Uhrzeigersinn von oben: `(dx, dz) → (−dz, dx)` relativ zum Pivot. Die Texturen drehen mit.
  - `scaleTiles(world, ids, factor, pivot): TileChange[]`
  - `moveVertices(world, positions: ArrayLike<number>[], delta, editable: (layer) => boolean, eps = 1e-4): TileChange[]`: Alle Ecken bearbeitbarer Kacheln an diesen Positionen bewegen sich gemeinsam.
  - `mergeVertices(world, positions, target, editable): TileChange[]`
  - `extrudeTiles(world, ids: number[], distance): { update: TileChange[]; add: TileData[] }`: n = normalisierte Summe der Normalen. Randkanten = Kanten, die nur in **einer** ausgewählten Kachel vorkommen (Schlüssel aus gerundeten Endpunkten), mit der Richtung (a → b) aus der Eckreihenfolge dieser Kachel. Ausgewählte Kacheln wandern um n · distance. Je Randkante entsteht eine neue Seitenkachel mit `corners = [a, b, b + n·d, a + n·d]` (zeigt so nach außen) und Textur, Ebene und Flags der Ursprungskachel, `rot = 0`, ohne Spiegelung.
  - `selectionPivot(world, ids, snap): Float32Array` (Mitte des AABB, auf `snap/2` gerastert).
- Produces (Editor):
  - `type Selection = { mode: 'tiles'; ids: Set<number> } | { mode: 'vertices'; positions: Float32Array[] } | { mode: 'edges'; edges: [Float32Array, Float32Array][] }`; Signal `state.selection`.
  - `pickVertex`/`pickEdge`: Nimmt die Ecken bzw. Kanten der getroffenen Kachel, gewählt wird die nächste innerhalb von 12 px auf dem Bildschirm. `tilesInRect(world, viewProj, rectNdc, filter, camPos, viewDistance): number[]`, `cornersInRect(...): Float32Array[]` (Rechteck-Auswahl über Schwerpunkte bzw. Ecken in sichtbaren Chunks).
  - Bedienung im Auswahl-Werkzeug: Klick wählt, Shift + Klick schaltet um, Ziehen auf freier Fläche = Rechteck-Auswahl, Ziehen auf Ausgewähltem verschiebt auf der Zeichenebene (gerastert, Alt = frei, Shift = nur senkrecht). Pfeiltasten bewegen in X/Z, Bild↑/Bild↓ in Y, jeweils um einen Rasterschritt. 1/2/3 = Ecken/Kanten/Kacheln. R dreht um Y, Shift+R um X, Alt+R um Z. `+`/`-` skaliert × 2 / × ½. Strg+E extrudiert um einen Rasterschritt. Strg+M führt Ecken zusammen (auf ihren gerasterten Mittelpunkt). Entf/Rücktaste löscht, Strg+A wählt alle sichtbaren bearbeitbaren Kacheln, Esc hebt die Auswahl auf. Jede Aktion = ein Undo-Schritt. `SelectionPanel` zeigt Anzahl und Modus und hat Knöpfe für Drehen, ×2, ×½, Extrudieren, Zusammenführen und Löschen.

- [ ] **Step 1: Die fehlschlagenden Tests schreiben**

```ts
// packages/engine/tests/transform.test.ts
import { describe, it, expect } from 'vitest';
import { World, cellQuad, quadNormal, vec3, translateTiles, rotateTiles90, scaleTiles, moveVertices, mergeVertices, extrudeTiles, buildChunkMesh, raycastWorld, type TileData } from '../src';
const T = (x: number, z: number, layer = 1): TileData => ({ layer, tileset: 0, tx: 0, ty: 0, rot: 0, flipX: false, flipY: false, doubleSided: false, ghost: false, corners: cellQuad({ axis: 'y', offset: 0, facing: 1 }, x, z) });
const apply = (w: World, ch: { id: number; after: TileData }[]) => ch.forEach((c) => w.setTile(c.id, c.after));
const r = (a: ArrayLike<number>) => Array.from(a).map((v) => +v.toFixed(4) + 0);
const W = () => { const w = new World(); w.addLayer('a'); w.addLayer('b'); return w; };

describe('Transformationen', () => {
  it('verschieben ändert Ecken und Chunk', () => { const w = W(); const id = w.addTile(T(0, 0)); apply(w, translateTiles(w, [id], [40, 0, 0])); expect(w.getTile(id)!.corners[0]).toBe(40); });
  it('drehen um Y: +X wird zu +Z', () => {
    const w = W(); const id = w.addTile(T(1, 0)); apply(w, rotateTiles90(w, [id], 'y', 1, [0, 0, 0]));
    expect(r(w.getTile(id)!.corners.slice(0, 3))).toEqual([-1, 0, 1]);
  });
  it('skalieren × 2 um den Pivot', () => { const w = W(); const id = w.addTile(T(0, 0)); apply(w, scaleTiles(w, [id], 2, [0, 0, 0])); expect(r(w.getTile(id)!.corners.slice(3, 6))).toEqual([2, 0, 2]); });
  it('Kante anheben ergibt eine Rampe; gesperrte Ebenen bleiben', () => {
    const w = W(); const id = w.addTile(T(0, 0)); const other = w.addTile(T(0, -1, 2));
    apply(w, moveVertices(w, [[0, 0, 0], [1, 0, 0]], [0, 1, 0], (l) => l === 1));
    expect(quadNormal(w.getTile(id)!.corners, vec3.create())[1]).toBeCloseTo(Math.SQRT1_2, 4);
    expect(w.getTile(other)!.corners[1]).toBe(0);
  });
  it('zusammengeführte Ecken: Dreieck bleibt zeichen- und treffbar (Review Focus 4)', () => {
    const w = W(); const id = w.addTile(T(0, 0)); apply(w, mergeVertices(w, [[0, 0, 0], [1, 0, 0]], [0.5, 0, 0], () => true));
    const [part] = buildChunkMesh(w.chunks.values().next().value!, new Map([[0, { id: 0, tileSize: 16, imageWidth: 16, imageHeight: 16 }]]), () => true);
    expect(part.positions.every(Number.isFinite)).toBe(true);
    expect(raycastWorld(w, [0.5, 5, 0.7], [0, -1, 0], 50, () => true)!.tileId).toBe(id);
  });
  it('Extrudieren einer Kachel: Deckel auf y = 1 und 4 Seiten nach außen', () => {
    const w = W(); const id = w.addTile(T(0, 0)); const res = extrudeTiles(w, [id], 1);
    expect(res.add.length).toBe(4); expect(res.update[0].after.corners[1]).toBe(1);
    const normals = res.add.map((t) => r(quadNormal(t.corners, vec3.create()))).sort();
    expect(normals).toEqual([[-1, 0, 0], [0, 0, -1], [0, 0, 1], [1, 0, 0]].sort());
  });
  it('Extrudieren von 2×1: innere Kante bleibt ohne Seite', () => { const w = W(); const a = w.addTile(T(0, 0)); const b = w.addTile(T(1, 0)); expect(extrudeTiles(w, [a, b], 1).add.length).toBe(6); });
});
```

```ts
// packages/editor/tests/selectTool.test.ts
import { describe, it, expect } from 'vitest';
import { makeToolHarness } from './toolHarness';
describe('Auswahl-Werkzeug', () => {
  it('Klick wählt, Pfeil rechts verschiebt um 1, Entf löscht, undo stellt her', () => {
    const h = makeToolHarness('paint'); h.clickCell(0, 0); h.useTool('select'); h.clickCell(0, 0, { onTile: true });
    h.key('ArrowRight'); expect(h.onlyTile().corners[0]).toBe(1);
    h.key('Delete'); expect(h.world.tileCount()).toBe(0); h.history.undo(); expect(h.world.tileCount()).toBe(1);
  });
  it('Kanten-Modus: Bild↑ hebt die Kante zur Rampe', () => {
    const h = makeToolHarness('paint'); h.clickCell(0, 0); h.useTool('select'); h.key('2'); h.clickEdgeOf(0, 0, 'north');
    h.key('PageUp'); expect(Math.max(...h.onlyTile().corners.filter((_, i) => i % 3 === 1))).toBe(1);
  });
  it('Strg+E extrudiert', () => { const h = makeToolHarness('paint'); h.clickCell(0, 0); h.useTool('select'); h.clickCell(0, 0, { onTile: true }); h.key('e', { ctrl: true }); expect(h.world.tileCount()).toBe(5); });
});
```
`toolHarness` bekommt dazu `key(key, mods?)` und `clickEdgeOf(u, v, 'north'|'south'|'east'|'west')`.

- [ ] **Step 2: Tests laufen lassen, sie müssen fehlschlagen**

Run: `npx vitest run packages/engine/tests/transform.test.ts packages/editor/tests/selectTool.test.ts`
Expected: FAIL.

- [ ] **Step 3: Transformationen, Extrudieren, Auswahl-Werkzeug und Auswahl-Bereich implementieren**

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run packages/engine/tests packages/editor/tests && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: Auswählen, Transformieren, Formen biegen und Extrudieren"
```

---

### Task 16: Ebenen, Projektmenü, Einstellungen und Statistik-Anzeige

**Files:**
- Create: `packages/editor/src/ui/LayersPanel.tsx`, `SettingsDialog.tsx`, `StatsOverlay.tsx`
- Modify: `src/ui/RightPanel.tsx`, `src/ui/TopBar.tsx` (Projektmenü), `src/ui/Dialogs.tsx`, `src/state/prefs.ts`, `src/app/theme.css`, `src/strings/de.ts`, `src/viewport/viewportController.ts` (F3)
- Test: `packages/editor/e2e/layers.spec.ts`

**Interfaces:**
- Consumes: `addLayerCmd`, `removeLayerCmd`, `updateLayerCmd`, `exportZip`, `Autosave.flush`, `prefs`.
- Produces:
  - `LayersPanel` (Bereich „Ebenen“, `role="region"`): Liste mit Auge (`aria-label = t.ebenen.ausblenden(name)` = `${name} ausblenden`), Schloss (`t.ebenen.sperren(name)` = `${name} sperren`) und Name (Klick = aktiv mit `aria-current="true"`, Doppelklick = Umbenennen inline mit Enter/Esc). Knopf „Ebene hinzufügen“ mit Vorgabe `Ebene n`; die neue Ebene wird sofort aktiv. Löschen (Papierkorb, `aria-label = t.ebenen.loeschen(name)` = `${name} löschen`) mit Bestätigung `t.ebenen.loeschenFrage(name, n)` = `Ebene „${name}“ mit ${n} Kacheln löschen?`, Knöpfe „Löschen“ / „Abbrechen“. Die letzte Ebene lässt sich nicht löschen (`t.ebenen.letzte = 'Mindestens eine Ebene muss bleiben.'`). Neue Kacheln landen in der aktiven Ebene; verborgene Ebenen fehlen beim Zeichnen und Picking, gesperrte sind sichtbar, aber nicht bearbeitbar.
  - Projektmenü (Klick auf den Projektnamen, `role="menu"`): „Speichern“ (Strg+S → `autosave.flush()`), „Als ZIP exportieren“ (Download `<name>.zip`), „Einstellungen …“, „Projekt schließen“ (flush, dann Startbildschirm).
  - `SettingsDialog`: Oberflächengröße 100–200 % (Schritt 10, Zahlenfeld mit Schieberegler, setzt `--ui-scale`), Schalter „Hinweise anzeigen“, Knopf „Alle Hinweise wieder zeigen“.
  - `StatsOverlay` (F3): fps (Mittel über 1 s), Zeichenaufrufe, sichtbare Chunks, Dreiecke, Kacheln gesamt. Test-Hook `renderStats()` liefert dieselben Werte.

- [ ] **Step 1: Den fehlschlagenden E2E-Test schreiben**

```ts
// packages/editor/e2e/layers.spec.ts
import { test, expect } from '@playwright/test';
import { newProject, hooks } from './helpers';
test('Ebenen: anlegen, umbenennen, aktiv, ausblenden, sperren, löschen mit undo', async ({ page }) => {
  await page.goto('/'); await newProject(page);
  const panel = page.getByRole('region', { name: 'Ebenen' });
  await panel.getByRole('button', { name: 'Ebene hinzufügen' }).click();
  await panel.getByRole('button', { name: 'Ebene 2' }).dblclick();
  await page.keyboard.type('Ruine'); await page.keyboard.press('Enter');   // tippt „k“-freien Text, Werkzeug bleibt
  await expect(panel.getByRole('button', { name: 'Ruine' })).toHaveAttribute('aria-current', 'true');
  await page.evaluate(() => (window as any).__rgm.exec('addFloor', [0, 0, 2, 2, 0]));
  expect((await hooks(page, 'state')).layers.find((l: any) => l.name === 'Ruine')).toBeTruthy();
  await panel.getByRole('button', { name: 'Ruine ausblenden' }).click();
  expect((await hooks(page, 'renderStats')).triangles).toBe(0);
  await panel.getByRole('button', { name: 'Ruine löschen' }).click();
  await page.getByRole('button', { name: 'Löschen' }).click();
  expect((await hooks(page, 'state')).tiles).toBe(0);
  await page.keyboard.press('Control+z'); expect((await hooks(page, 'state')).tiles).toBe(4);
});
test('beim Umbenennen schalten Buchstaben kein Werkzeug um (Review Focus 1)', async ({ page }) => {
  await page.goto('/'); await newProject(page);
  const panel = page.getByRole('region', { name: 'Ebenen' });
  await panel.getByRole('button', { name: 'Ebene 1' }).dblclick(); await page.keyboard.type('kabige'); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /Kachel malen/ })).toHaveAttribute('aria-pressed', 'true');
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `CHROME_PATH=/usr/bin/google-chrome npx playwright test packages/editor/e2e/layers.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Ebenen-Bereich, Projektmenü, Einstellungen und Statistik implementieren**

- [ ] **Step 4: Tests laufen lassen**

Run: `CHROME_PATH=/usr/bin/google-chrome npx playwright test packages/editor/e2e/layers.spec.ts packages/editor/e2e/shell.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(editor): Ebenen, Projektmenü, Einstellungen und Statistik"
```

---

### Task 17: Play-Modus

**Files:**
- Create: `packages/runtime/src/play/playSession.ts`; `packages/editor/src/play/playController.ts`, `PlayOverlay.tsx`
- Modify: `packages/runtime/src/index.ts`, `src/app/App.tsx`, `src/viewport/viewportController.ts` (Dauer-Render im Play), `src/app/testHooks.ts` (`player()`), `src/strings/de.ts`
- Test: `packages/runtime/tests/playSession.test.ts`, `packages/editor/e2e/play.spec.ts`

**Interfaces:**
- Consumes: `FpsController`, `DEFAULT_PLAYER`, `raycastWorld`, `Camera`, `Autosave.flush`.
- Produces:
  - `findSpawn(world, from: ArrayLike<number>): Float32Array`: Strahl senkrecht nach unten (alle Ebenen, max. 200 m). Bei Treffer Füße = Trefferpunkt + 0,01 in y, sonst `from`.
  - `class PlaySession { constructor(world: World, spawn: ArrayLike<number>, yaw: number, cfg?: PlayerConfig); readonly player: FpsController; update(dt: number, input: PlayerInput): void; applyCamera(cam: Camera): void /*Augenposition, yaw, pitch, fovY = 75°, view = 'perspective'*/ }`
  - `class PlayController { constructor(viewport: ViewportController, session: EditorSession, state: EditorState); start(): void; stop(): void; readonly active: boolean }`. `start()`: `autosave.flush()` im Hintergrund **ohne** zu warten (Play-Start < 1 s), Editor-Kamera merken, `PlaySession` mit `findSpawn(camera.position)` und `camera.yaw`, `state.mode = 'play'`, Editor-Helfer aus, `canvas.requestPointerLock()`. Klappt das nicht: Umsehen mit gedrückter linker Maustaste. Eingaben: W/S/A/D und Pfeiltasten, Shift = rennen, Leertaste = springen (Flanke), Maus 0,0022 rad/px. `stop()` bei Esc, bei Verlust des Pointer-Locks während Play und bei F5: Editor-Kamera wiederherstellen, `mode = 'edit'`. Die Spielschleife läuft per requestAnimationFrame mit dt ≤ 0,1 s.
  - `PlayOverlay`: Fadenkreuz (Punkt), Hinweis `t.play.hinweisLock = 'Esc: zurück zum Editor'` bzw. `t.play.hinweisZiehen = 'Linke Maustaste halten zum Umsehen · Esc: zurück zum Editor'`.

- [ ] **Step 1: Die fehlschlagenden Tests schreiben**

```ts
// packages/runtime/tests/playSession.test.ts
import { describe, it, expect } from 'vitest';
import { World, cellQuad, Camera } from '@rgm/engine';
import { PlaySession, findSpawn } from '../src';
const w = () => { const x = new World(); x.addLayer('a'); for (let i = -5; i < 5; i++) for (let j = -5; j < 5; j++) x.addTile({ layer: 1, tileset: 0, tx: 0, ty: 0, rot: 0, flipX: false, flipY: false, doubleSided: false, ghost: false, corners: cellQuad({ axis: 'y', offset: 2, facing: 1 }, i, j) }); return x; };
describe('PlaySession', () => {
  it('Startpunkt liegt auf dem Boden unter der Kamera', () => expect(findSpawn(w(), [0.5, 30, 0.5])[1]).toBeCloseTo(2.01, 3));
  it('ohne Boden bleibt der Startpunkt die Kamera', () => expect(Array.from(findSpawn(w(), [50, 30, 50]))).toEqual([50, 30, 50]));
  it('Kamera sitzt auf Augenhöhe, Sichtfeld 75°', () => {
    const s = new PlaySession(w(), [0.5, 2.01, 0.5], 0); const c = new Camera(); s.applyCamera(c);
    expect(c.position[1]).toBeCloseTo(3.6, 1); expect(c.fovY).toBeCloseTo((75 * Math.PI) / 180, 6);
  });
});
```

```ts
// packages/editor/e2e/play.spec.ts
import { test, expect } from '@playwright/test';
import { newProject, hooks } from './helpers';
test('F5 startet Play, W läuft, Wand stoppt, Esc kehrt an dieselbe Stelle zurück', async ({ page }) => {
  await page.goto('/'); await newProject(page);
  await page.evaluate(() => { const r = (window as any).__rgm; r.exec('addFloor', [-5, -10, 10, 15, 0]); r.exec('addWall', [-5, -6, 10, 3]); r.setCamera(0.5, 1.7, 0.5, 0, 0); });
  const camBefore = (await hooks(page, 'state')).camera;
  await page.keyboard.press('F5'); await expect.poll(async () => (await hooks(page, 'state')).mode).toBe('play');
  await page.keyboard.down('w'); await page.waitForTimeout(2500); await page.keyboard.up('w');
  const p = await hooks(page, 'player'); expect(p.z).toBeLessThan(-4); expect(p.z).toBeGreaterThan(-6 + 0.28);
  await page.keyboard.press('Escape'); await expect.poll(async () => (await hooks(page, 'state')).mode).toBe('edit');
  expect((await hooks(page, 'state')).camera).toEqual(camBefore);
});
```
`addFloor` und `addWall` sind die Test-Hooks aus Task 10.

- [ ] **Step 2: Tests laufen lassen, sie müssen fehlschlagen**

Run: `npx vitest run packages/runtime/tests/playSession.test.ts && CHROME_PATH=/usr/bin/google-chrome npx playwright test packages/editor/e2e/play.spec.ts`
Expected: FAIL.

- [ ] **Step 3: `findSpawn`, `PlaySession`, `PlayController` und `PlayOverlay` implementieren**

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run packages/runtime/tests && CHROME_PATH=/usr/bin/google-chrome npx playwright test packages/editor/e2e/play.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: Play-Modus in Ego-Sicht mit Rückkehr an dieselbe Stelle"
```

---

### Task 18: Test-Insel und Leistungsprüfung

**Files:**
- Create: `packages/engine/src/world/testIsland.ts`, `packages/editor/src/project/testTileset.ts`, `packages/engine/bench/world.bench.ts`
- Modify: `packages/engine/src/index.ts`, `src/ui/StartScreen.tsx` (Knopf „Test-Insel (Leistungstest)“), `src/app/session.ts` (Fortschrittsanzeige `t.welt.aufbau(prozent)` beim ersten Meshen), `src/strings/de.ts`
- Test: `packages/engine/tests/testIsland.test.ts`, `packages/editor/e2e/performance.spec.ts`

**Interfaces:**
- Consumes: `World`, `cellQuad`, `blockQuads`, Renderer-Statistik.
- Produces:
  - `generateTestIsland(world, o: { size?: number /*500*/; seed?: number /*1*/; layer: number; tileset: number; columns: number; rows: number }): { tiles: number; checksum: number }`. Höhenkarte aus Value-Noise (Zufall: mulberry32 mit `seed`), auf ganze Meter 0–6 terrassiert, je Zelle eine Bodenkachel auf ihrer Höhe. Senkrechte Seitenkacheln an Höhensprüngen hinunter bis zur Nachbarhöhe. Dazu 400 Ruinen: Mauern aus beidseitigen Wandkacheln, 3–8 m lang, 2–4 m hoch, sowie Blöcke. Ziel: 300.000 ± 60.000 Kacheln. `checksum` = (Σ über alle Kacheln von tx·31 + ty·17 + gerundete Eckensumme) mod 2³².
  - `makeTestTileset(): Promise<{ bytes: Uint8Array; width: 128; height: 64; tileSize: 16 }>`: per OffscreenCanvas erzeugte 8×4 Kacheln mit Farbrauschen (Gras, Erde, Stein, Sand, Wasser …), alles original.
  - Startbildschirm-Knopf: legt ein Browser-Projekt „Test-Insel“ an, erzeugt Tileset und Insel und setzt die Kamera auf (250, 30, 250, yaw 0, pitch −20°).

- [ ] **Step 1: Die fehlschlagenden Tests schreiben**

```ts
// packages/engine/tests/testIsland.test.ts
import { describe, it, expect } from 'vitest';
import { World, generateTestIsland } from '../src';
describe('generateTestIsland', () => {
  it('ist reproduzierbar und hat die Zielgröße', () => {
    const a = new World(); a.addLayer('a'); const b = new World(); b.addLayer('a');
    const o = { layer: 1, tileset: 0, columns: 8, rows: 4 };
    const ra = generateTestIsland(a, o); const rb = generateTestIsland(b, o);
    expect(ra).toEqual(rb); expect(ra.tiles).toBeGreaterThan(240_000); expect(ra.tiles).toBeLessThan(360_000);
  });
});
```

```ts
// packages/editor/e2e/performance.spec.ts
import { test, expect } from '@playwright/test';
import { hooks } from './helpers';
test('Test-Insel: Aufbau, Zeichenaufrufe und Dreiecke im Budget', async ({ page }) => {
  await page.goto('/');
  const t0 = Date.now(); await page.getByRole('button', { name: 'Test-Insel (Leistungstest)' }).click();
  await expect.poll(async () => (await hooks(page, 'state')).mode, { timeout: 30_000 }).toBe('edit');
  await expect.poll(async () => (await hooks(page, 'renderStats')).visibleChunks, { timeout: 30_000 }).toBeGreaterThan(0);
  const ms = Date.now() - t0; console.log(`Insel bereit nach ${ms} ms`);
  expect(ms).toBeLessThan(10_000); // Regressionsschutz in CI; Spec-Ziel (< 5 s) prüft Task 19 auf echter Hardware
  await page.evaluate(() => (window as any).__rgm.setCamera(250, 12, 250, 0.7, -0.2));
  const s = await hooks(page, 'renderStats'); console.log(JSON.stringify(s));
  expect(s.drawCalls).toBeLessThanOrEqual(200); expect(s.triangles).toBeLessThanOrEqual(200_000);
});
```

- [ ] **Step 2: Tests laufen lassen, sie müssen fehlschlagen**

Run: `npx vitest run packages/engine/tests/testIsland.test.ts && CHROME_PATH=/usr/bin/google-chrome npx playwright test packages/editor/e2e/performance.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Generator, Test-Tileset, Startknopf und Fortschrittsanzeige implementieren; `world.bench.ts` (Hinzufügen von 300.000 Kacheln, Meshen aller Chunks, 1.000 Raycasts, 600 Controller-Schritte) anlegen**

- [ ] **Step 4: Tests und Benchmark laufen lassen**

Run: `npx vitest run packages/engine/tests/testIsland.test.ts && npm run bench && CHROME_PATH=/usr/bin/google-chrome npx playwright test packages/editor/e2e/performance.spec.ts`
Expected: PASS; Benchmark-Zahlen und „Insel bereit nach … ms“ erscheinen in der Ausgabe.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: Test-Insel und Leistungsprüfung"
```

---

### Task 19: Abschluss, Testversion und Übergabe (Koordinator)

**Files:**
- Create: `README.md` (Deutsch: Was das ist, `npm install`, `npm run dev`, `npm test`, `npm run test:e2e` mit `CHROME_PATH`, `npm run build`, Verweise auf Spec und Plan)

- [ ] **Step 1: Alles grün**

Run: `npm run typecheck && npm test && CHROME_PATH=/usr/bin/google-chrome npm run test:e2e && npm run build`
Expected: alles PASS, `packages/editor/dist/index.html` existiert.

- [ ] **Step 2: Pushen und CI prüfen**

Run: `git push && gh run watch --exit-status`
Expected: CI-Lauf erfolgreich, Artefakt `editor-web` vorhanden. (Ohne Remote: Schritt nachholen, sobald das Repository verbunden ist.)

- [ ] **Step 3: Testversion als Link bereitstellen**

`packages/editor/dist` per Artifact-Werkzeug als private Seite „Retro-Game-Maker – Etappe 1 (Testversion)“ veröffentlichen (alle Dateien aus `dist`, `index.html` als Einstieg). Seite öffnen und prüfen: Startbildschirm erscheint, Projekt anlegen, Kachel setzen. In der eingebetteten Seite ist kein Ordner-Zugriff verfügbar; dann gelten „Im Browser“ und der ZIP-Export.

- [ ] **Step 4: Abnahme durch den Nutzer**

Dem Nutzer den Link geben und um zwei Prüfungen auf seinem Laptop bitten: (1) „Test-Insel (Leistungstest)“ öffnen und mit F3 die fps ansehen (Ziel 60, Insel bereit unter 5 s). (2) Ein kleines Level bauen und mit F5 hindurchlaufen. Rückmeldungen gehen in die Planung von Etappe 2 ein.

- [ ] **Step 5: Commit**

```bash
git add README.md && git commit -m "docs: README für Etappe 1" && git push
```
