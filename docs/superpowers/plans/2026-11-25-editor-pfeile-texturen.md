# Editor-Feinschliff (Zeichenebene links, Pfeile, Texturen ohne Dehnen, kein Flackern) – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die vier freigegebenen Wünsche nach Etappe 1 umsetzen: Zeichenebene als Knopf mit Ausklapp-Menü links, Unity-artiger Gizmo (Pfeile, Quadrate, Drehringe) für die Auswahl, Texturen mit fester Größe statt Dehnen, und kein Überlappen/Flackern.

**Architecture:** Texturkoordinaten entstehen neu beim Vernetzen aus einem Rahmen in der Ebene jeder Kachel (Meter, 1 Kachel = 1 m); der Tile-Shader holt per `texelFetch` das Texel innerhalb der Kachel im Tileset (Wiederholung). Der Vernetzer vergibt für in derselben Fläche überlappende Kacheln Rangstufen 0–3 (Ebene, dann Kachel-id), der Vertex-Shader rückt sie um feste Tiefen-Schritte nach vorn. Werkzeuge entfernen exakt verdeckte Kacheln derselben Ebene im selben Befehl. Der Gizmo ist reine Rechnung in `tools/gizmo.ts`; das Auswahl-Werkzeug nutzt sie für Treffer und Ziehen, die Ansicht zeichnet ihn jedes Bild.

**Tech Stack:** wie Etappe 1 (TypeScript 7, eigene WebGL2-Engine, Preact 11 + Signals, Vitest 5, Playwright 1.65).

**Spec:** `docs/superpowers/specs/2026-11-25-editor-pfeile-texturen-design.md` (Bezug: `docs/superpowers/specs/2026-11-24-retro-game-maker-design.md` 6.2/6.3; Konventionen K1–K8 aus `docs/superpowers/plans/2026-11-24-etappe-1-fundament.md`).

## Global Constraints

- Alle sichtbaren Texte stehen in `packages/editor/src/strings/de.ts` (Deutsch); Komponenten enthalten keine festen Texte.
- Paketgrenzen: `@rgm/engine` importiert weder Runtime noch Editor; Runtime nur Engine.
- Unverformte 1×1-Kacheln bleiben **pixelgleich** (jede Drehung, jedes Spiegeln).
- Kein neues Dateiformat (Texturkoordinaten und Rangstufen sind abgeleitet).
- Leistung: Test-Insel (275.161 Kacheln) in unter 5 s bereit, 60 Bilder/s; Vernetzen aller 256 Chunks bleibt unter 200 ms im Benchmark.
- Gizmo-Farben: X `#E24B4A`, Y `#63B32E`, Z `#378ADD`, hervorgehoben `#F2C94C`; Pfeillänge 90 CSS-px, Trefferzone 8 px, Quadrat 22 px.
- Einrasten: Verschieben im Raster `state.snap` (1, 0,5, 0,25 m), Drehen 15°; Alt = frei. Grenze 65.536 Kacheln pro Aktion (`MAX_TILES_PER_OP`).
- Tiefen-Schritt je Rangstufe: `DEPTH_STEP_NDC = 2 * 8 / 2 ** 24` (≈ 9,54e-7), höchste Stufe 3, Geister-Vorschau +3.

## Review Focus

1. **Kaputte und extreme Kacheln:** zusammengefallene Ecken, Fläche 0, NaN-Koordinaten, sehr kleine (0,01 m) und sehr große (100 m) Kacheln. Erwartung: endliche Texturkoordinaten, keine Naht der Wiederholung an Kanten, Rangstufen ohne Absturz. → Tests in Task 1 und Task 2.
2. **Gizmo in Grenzlagen:** Kamera genau entlang einer Achse, Drehpunkt hinter der Kamera, Strahl parallel zur Zugachse. Erwartung: kein NaN in Kachel oder Anzeige, betroffene Griffe ausgeblendet statt springend. → Tests in Task 5.
3. **Verschieben auf Fremdes:** bewegte Kacheln landen exakt auf Kacheln einer anderen oder gesperrten Ebene bzw. mit anderer Blickrichtung. Erwartung: dort wird nichts gelöscht; nur in derselben Ebene ersetzt die bewegte Kachel die verdeckte; Rückgängig stellt alles exakt wieder her. → Tests in Task 3.
4. **Große Mengen:** Gizmo-Ziehen mit Strg+A auf der Test-Insel; Vernetzen von Chunks mit vielen überlappenden Kacheln. Erwartung: Ablehnung beim Ansetzen mit Meldung, Oberfläche bleibt bedienbar; Vernetzen bleibt im Budget. → Tests in Task 2 und Task 6.
5. **Ausklapp-Menü und Tastatur:** Menü offen, dann Q, Werkzeug-Taste, Esc, Klick daneben, Wechsel ins Spiel. Erwartung: nichts bleibt hängen, Fokus kehrt zum Knopf zurück, Tasten wirken wie gewohnt. → Tests in Task 7.

---

### Task 1: Texturkoordinaten ohne Dehnen (Engine)

**Files:**
- Create: `packages/engine/src/geometry/tileFrame.ts`
- Modify: `packages/engine/src/mesh/chunkMesher.ts`, `packages/engine/src/render/shaders.ts`, `packages/engine/src/render/tileRenderer.ts`, `packages/engine/src/index.ts`
- Test: `packages/engine/tests/tileFrame.test.ts`, `packages/engine/tests/mesher.test.ts`

**Interfaces:**
- Consumes: `quadNormal` (geometry/quad.ts), `TilesetInfo`, `tileUVs` (nur noch im Vergleichstest).
- Produces:
  - `tileLocalUVs(corners: ArrayLike<number>, base: number, rot: 0 | 1 | 2 | 3, flipX: boolean, flipY: boolean, out: Float32Array): Float32Array` – 8 Werte (u, v je Ecke) in Kachel-Einheiten, v nach unten wie K3.
  - `ChunkMeshPart` ohne `uvs`, neu: `locals: Float32Array` (2/Ecke), `cells: Float32Array` (2/Ecke: tx, ty), `ranks: Float32Array` (1/Ecke, in Task 1 überall 0).
  - Shader-Eingänge `aLocal`, `aCell`, `aShade`, `aRank`; Uniforms `uTileSize`, `uDepthStep`, `uRankAdd`.

- [ ] **Step 1: Failing tests** in `tileFrame.test.ts`:
  - `1×1-Boden rot 0 = BASE`: `tileLocalUVs(cellQuad(boden, 0, 0), 0, 0, false, false, out)` ≈ `[0,1, 1,1, 1,0, 0,0]` (±1e-3).
  - `2 m breite Kachel wiederholt statt zu dehnen`: Ecken c1, c2 um +1 in u-Richtung → u-Werte `[0, 2, 2, 0]`.
  - `Rampe läuft den Hang entlang`: Boden 1×1, c2 und c3 um 1 m angehoben → v-Werte `[1, 1, 1 − √2, 1 − √2]`.
  - `Drehen/Spiegeln wie K3`: rot 1 bildet (u, v) → (v, 1 − u); rot 2 → (1 − u, 1 − v); rot 3 → (1 − v, u); flipX danach u → 1 − u, flipY v → 1 − v.
  - `zusammengefallene Ecken und NaN → endlich` (Review Focus 1): Dreieck (c3 = c2), Fläche 0, eine NaN-Ecke → alle 8 Werte `Number.isFinite`.
  - `Werte liegen um 1/10.000 innen`: 1×1 → kein Wert genau 0 oder 1.
- [ ] **Step 2:** In `mesher.test.ts` Test `1×1-Kacheln pixelgleich zu vorher`: für rot 0–3 × flipX × flipY und 3×3 innere Punkte (bilinear aus den Ecken) liefert `cell·ts + clamp(floor(fract(local)·ts))` dasselbe Texel wie `floor(alteUV · Bildgröße)` aus `tileUVs`. Bestehende UV-Erwartungen auf `locals`/`cells` umstellen.
- [ ] **Step 3:** Run `npx vitest run packages/engine/tests/tileFrame.test.ts packages/engine/tests/mesher.test.ts` → Expected: FAIL (`tileLocalUVs` fehlt).
- [ ] **Step 4:** `tileLocalUVs` implementieren: u-Richtung t = längere der Kanten c0→c1 / c3→c2, auf die Newell-Ebene projiziert; b = normalize(n × t), Vorzeichen so, dass b zu c3/c2 zeigt; u_i = (c_i − c0)·t, w_i = (c_i − c0)·b, (u, v) = (u_i, 1 − w_i); dann rot/flip wie oben; zuletzt zur Mitte ziehen: p' = m + (p − m)·(1 − 2e-4). Ungültige Rahmen (keine Kante > 1e-9, NaN) → BASE.
- [ ] **Step 5:** Vernetzer schreibt `locals`, `cells` (Ersatz-Tileset −1: Zelle 0, 0), `ranks` (0). Shader: VS reicht `vLocal`, `flat vCell` weiter, `gl_Position.z -= (aRank + uRankAdd) * uDepthStep * gl_Position.w`; FS `texelFetch(uTex, ivec2(vCell * uTileSize + clamp(floor(fract(vLocal) * uTileSize), 0.0, uTileSize - 1.0)), 0)`. TileRenderer setzt `uTileSize` je Tileset aus `TilesetInfo`, `uDepthStep = DEPTH_STEP_NDC`, `uRankAdd` 0 (Geister 3).
- [ ] **Step 6:** Run die Tests aus Step 3 → PASS; `npm test` und `CHROME_PATH=/usr/bin/google-chrome npx playwright test` → alle grün (Pixeltests in paint.spec unverändert).
- [ ] **Step 7:** Commit `feat(engine): Texturen behalten ihre Größe statt sich zu dehnen`.

### Task 2: Feste Reihenfolge statt Flackern (Engine)

**Files:**
- Create: `packages/engine/src/mesh/overlapRanks.ts`
- Modify: `packages/engine/src/mesh/chunkMesher.ts`, `packages/editor/src/viewport/viewportController.ts` (Ebenen-Reihenfolge übergeben)
- Test: `packages/engine/tests/overlapRanks.test.ts`, `packages/engine/bench/world.bench.ts`

**Interfaces:**
- Consumes: Task 1 (`ranks`, `uDepthStep`).
- Produces: `overlapRanks(chunk: Chunk, layerOrder: (layer: number) => number): Uint8Array` (Rang 0–3 je Kachel-Index); `buildChunkMesh(chunk, tilesets, layerVisible, layerOrder?: (layer: number) => number)` (Standard: Ebenen-id).

- [ ] **Step 1: Failing tests** `overlapRanks.test.ts`:
  - `zwei gleiche Kacheln einer Ebene → [0, 1]` (neuere id oben).
  - `halb versetzt in derselben Fläche → [0, 1]`; `nur Kante an Kante → [0, 0]`; `übereinander gestapelte Böden y = 0 / y = 1 → [0, 0]`; `gegenüberliegende Blickrichtung, gleiche Fläche → [0, 1]`.
  - `höhere Ebene schlägt neuere Kachel`: ältere Kachel auf Ebene mit größerer Reihenfolge → Rang 1, neuere → 0.
  - `Kette A–B–C → [0, 1, 2]` (A und C überlappen sich nicht); `fünf gleiche → [0, 1, 2, 3, 3]`.
  - `kaputte Kacheln (NaN, Fläche 0) → Rang 0, kein Wurf` (Review Focus 1).
- [ ] **Step 2:** Run `npx vitest run packages/engine/tests/overlapRanks.test.ts` → FAIL (fehlt).
- [ ] **Step 3:** Implementieren: Flächen-Schlüssel = Normale (Vorzeichen so, dass die größte Komponente positiv ist) auf 1e-3 gerundet + Abstand auf 1 mm; je Fläche 2D-Projektion auf die Hauptachse, Raster-Hash der Bounding-Boxen (um 1e-4 geschrumpft); Überlappung = Schnittfläche der konvexen Vierecke (Sutherland–Hodgman) > 1e-6 m²; Reihenfolge nach (layerOrder(layer), id) aufsteigend, Rang = min(3, 1 + max Rang der überlappenden Vorgänger), sonst 0. Vernetzer schreibt den Rang in `ranks`; die Ansicht übergibt `layerOrder = Index in world.layers`.
- [ ] **Step 4:** Run Tests → PASS; `npm run bench` → „alle 256 Chunks meshen“ Median < 200 ms (Review Focus 4, Wert ins Ledger).
- [ ] **Step 5:** Commit `feat(engine): überlappende Kacheln flackern nicht mehr`.

### Task 3: Exakt verdeckte Kacheln ersetzen (Editor)

**Files:**
- Create: `packages/engine/src/world/coveredTiles.ts`
- Modify: `packages/editor/src/tools/selection.ts`, `packages/editor/src/tools/selectTool.ts`, `packages/engine/src/index.ts`
- Test: `packages/engine/tests/coveredTiles.test.ts`, `packages/editor/tests/selectTool.test.ts`

**Interfaces:**
- Consumes: `TileEdit`, `editTilesCmd`, `execWithSelection`.
- Produces:
  - `coveredTiles(world: World, tiles: readonly TileData[], exclude: ReadonlySet<number>): number[]` – ids exakt deckungsgleicher Kacheln (gleiche Ecken ±1e-4 in beliebiger Reihenfolge, **gleiche Ebene**, gleiche Blickrichtung oder eine von beiden beidseitig), nicht in `exclude`; ein Hash je betroffenem Chunk (kein `findCoincident` pro Kachel).
  - `commitSelectionEdit(c: ToolContext, edit: TileEdit, label: string, after: Selection): void` in selection.ts – ergänzt `edit.remove` um `coveredTiles(…)` der `update[].after` und `add`, nur auf bearbeitbaren Ebenen, und führt per `execWithSelection` aus.
- [ ] **Step 1: Failing tests:** `coveredTiles`: deckungsgleich gleiche Ebene → id; andere Ebene → []; entgegengesetzte Blickrichtung → []; mit beidseitig → id; ausgeschlossene ids → []. `selectTool.test`: `Kachel auf eine andere schieben ersetzt sie, Rückgängig holt beide zurück` (Tastatur → nach rechts, danach 1 Kachel mit der id der bewegten; undo → 2 Kacheln an alter Stelle); `auf Kachel einer anderen oder gesperrten Ebene schieben löscht nichts` (Review Focus 3); `Extrudieren neben vorhandener Wand legt keine doppelte Seitenfläche an`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implementieren und alle Auswahl-Befehle (Verschieben per Taste und Ziehen, Drehen, Skalieren, Extrudieren, Zusammenführen) über `commitSelectionEdit` führen.
- [ ] **Step 4:** Run `npm test` → grün.
- [ ] **Step 5:** Commit `fix(editor): bewegte Kacheln ersetzen verdeckte statt doppelt zu liegen`.

### Task 4: Freies Drehen (Engine)

**Files:**
- Modify: `packages/engine/src/geometry/transform.ts`, `packages/engine/src/index.ts`
- Test: `packages/engine/tests/transform.test.ts`

**Interfaces:**
- Produces: `rotateTiles(world: World, ids: Iterable<number>, axis: 'x' | 'y' | 'z', radians: number, pivot: ArrayLike<number>): TileChange[]` (Ecken auf 1e-6 gerundet; nicht endlicher Winkel → `[]`).

- [ ] **Step 1: Failing tests:** `90° = rotateTiles90` (Ecken ±1e-6, alle drei Achsen); `15° um Y dreht (1, 0, 0) nach (cos 15°, 0, −sin 15°)` (Rechte-Hand-Regel wie `rotateTiles90`); `360° lässt alles gleich`; `NaN-Winkel → []`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** implementieren. **Step 4:** Run → PASS. **Step 5:** Commit `feat(engine): Kacheln um beliebige Winkel drehen`.

### Task 5: Gizmo-Rechnung (Editor, ohne Oberfläche)

**Files:**
- Create: `packages/editor/src/tools/gizmo.ts`
- Test: `packages/editor/tests/gizmo.test.ts`

**Interfaces:**
- Consumes: `Camera` (Engine), `ToolContext.project`/`screenRay`.
- Produces:
  - `type GizmoHandle = { kind: 'axis' | 'plane' | 'ring'; axis: 0 | 1 | 2 }` (bei 'plane' = Normalen-Achse).
  - `GIZMO_COLORS: readonly [Rgba, Rgba, Rgba]`, `GIZMO_HOVER: Rgba`.
  - `gizmoLayout(pivot: ArrayLike<number>, camera: Camera, heightPx: number, project: (p: ArrayLike<number>, out: Float32Array) => boolean, rings: boolean): GizmoLayout | null` – Welt-Strecken der Pfeile (Länge = 90 px am Drehpunkt), Quadrate (4 Ecken), Ringe (48 Punkte); `visible`-Flags: Pfeil < 12 px projiziert oder Drehpunkt hinter der Kamera → ausgeblendet; Ring mit projizierter kleiner Halbachse < 12 px → ausgeblendet; Quadrat nur, wenn beide Achsen sichtbar. `null` bei nicht endlichem Drehpunkt.
  - `hitGizmo(layout: GizmoLayout, px: number, py: number): GizmoHandle | null` – Vorrang Pfeil (≤ 8 px) vor Quadrat (innen) vor Ring (≤ 8 px).
  - `axisDragDelta(pivot, axis, o0, d0, o1, d1, snap: number | null): number`; `planeDragDelta(pivot, normalAxis, o0, d0, o1, d1, snap: number | null): [number, number, number]`; `ringDragAngle(pivot, axis, o0, d0, o1, d1, snapRad: number | null): number` – parallele Strahlen / kein Schnitt → 0.
- [ ] **Step 1: Failing tests** (echte Engine-`Camera`, Perspektive von (3, 3, 6) auf den Ursprung, 800×600): Pfeil-Spitzen ≈ 90 px vom projizierten Drehpunkt; Treffer an der Y-Spitze → `{ kind: 'axis', axis: 1 }`, 40 px daneben → `null`; `axisDragDelta` für 1,3 m entlang +Y: Raster 1 → 1, 0,25 → 1,25, frei → 1,3; `planeDragDelta` mit Normalachse Y verschiebt nur x/z; `ringDragAngle` Viertelkreis → π/2, 20° mit 15°-Raster → 15°; Draufsicht (Ortho oben): Y-Pfeil und X/Z-Ringe ausgeblendet; Grenzlagen (Review Focus 2): Kamera genau auf der X-Achse, Drehpunkt hinter der Kamera, Strahl parallel zur Achse → keine NaN, Griffe ausgeblendet bzw. Delta 0.
- [ ] **Step 2:** Run `npx vitest run packages/editor/tests/gizmo.test.ts` → FAIL. **Step 3:** implementieren. **Step 4:** Run → PASS. **Step 5:** Commit `feat(editor): Gizmo-Rechnung für Pfeile, Quadrate und Drehringe`.

### Task 6: Gizmo im Auswahl-Werkzeug und in der Ansicht

**Files:**
- Modify: `packages/editor/src/tools/selectTool.ts`, `packages/editor/src/tools/selection.ts` (`selectionCenter`), `packages/editor/src/tools/tool.ts` (`viewportHeight()`), `packages/editor/src/state/editorState.ts` (`gizmoHandle`), `packages/editor/src/viewport/viewportController.ts` (Zeichnen, Beschriftung), `packages/editor/src/strings/de.ts` (Hinweis-Kärtchen, Anzeige), `packages/editor/tests/toolHarness.ts`
- Test: `packages/editor/tests/selectTool.test.ts`, `packages/editor/e2e/gizmo.spec.ts`

**Interfaces:**
- Consumes: Task 3 `commitSelectionEdit`, Task 4 `rotateTiles`, Task 5 alles.
- Produces: `selectionCenter(sel: Selection, c: ToolContext): Float32Array | null` (Kacheln: `selectionPivot`, Ecken/Kanten: Mittel der Punkte); `ToolContext.viewportHeight(): number`; `EditorState.gizmoHandle: Signal<GizmoHandle | null>` (Griff unter dem Zeiger oder gerade gezogen); `Preview.label?: { x: number; y: number; text: string }`.

- [ ] **Step 1: Failing tests:** Harness (Ortho oben, X- und Z-Pfeil sichtbar): `X-Pfeil ziehen verschiebt genau im Raster` (Kachel wählen, an der projizierten X-Pfeilmitte drücken, 60 px nach rechts → Kachel um ganze Meter nach +x, ein Rückgängig-Schritt, Auswahl geht mit); `Alt ziehen ist frei`; `zu große Auswahl am Pfeil → Meldung beim Ansetzen` (Review Focus 4); `Esc bricht ab, nichts geändert`. E2E `gizmo.spec.ts` (Perspektive): Kachel anklicken, grünen Pfeil um 120 px nach oben ziehen → Ecken-y steigt um ganze Meter, Strg+Z stellt her; Hinweis-Kärtchen nennt die Pfeile.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Auswahl-Werkzeug: Gizmo-Treffer vor allem anderen; Ziehen erzeugt Vorschau-Geister (Pfeil/Quadrat über `selectionMoveChanges`, Ring über `rotateTiles` auf die Kacheln), Beschriftung „1,25 m“ bzw. „15°“ am Zeiger und als Status, Loslassen → `commitSelectionEdit` mit verschobener/gedrehter Auswahl; Hover setzt `gizmoHandle`. Ansicht: zeichnet den Gizmo jedes Bild ohne Tiefentest (Linien je Achsfarbe, Quadrate als halbtransparente Dreiecke, aktiver Griff in `GIZMO_HOVER`), nur im Bearbeiten-Modus mit Auswahl-Werkzeug und nicht leerer Auswahl; Ringe nur im Kachel-Modus.
- [ ] **Step 4:** Run `npm test` und die E2E-Suite → grün.
- [ ] **Step 5:** Commit `feat(editor): Pfeile und Drehringe an der Auswahl wie in Unity`.

### Task 7: Zeichenebene links mit Ausklapp-Menü

**Files:**
- Create: `packages/editor/src/ui/PlaneMenu.tsx`
- Modify: `packages/editor/src/ui/ToolRail.tsx`, `packages/editor/src/ui/BrushPanel.tsx` (Ebenen-Wahl entfernen), `packages/editor/src/state/editorState.ts` (`planeLabel: Signal<string>`), `packages/editor/src/viewport/viewportController.ts` (`offsetPlane`, `planeLabel` pflegen), `packages/editor/src/app/testHooks.ts` (`drawPlane`, `planeLabel` in `state()`), `packages/editor/src/app/theme.css`, `packages/editor/src/strings/de.ts`
- Test: `packages/editor/e2e/plane.spec.ts`

**Interfaces:**
- Consumes: `nextPlaneMode`, `planeLabel`, `PlaneResolver.offsetCursor`.
- Produces: `ViewportController.offsetPlane(steps: 1 | -1): void`; Texte `t.ebene.knopf` („Zeichenebene“), `t.ebene.hoeher` („Höher“), `t.ebene.tiefer` („Tiefer“).

- [ ] **Step 1: Failing E2E** `plane.spec.ts`: Knopf „Zeichenebene“ in der Werkzeugleiste zeigt „Auto“ und Q; Klick öffnet `role="menu"`; „Wand X“ wählen → `menuitemradio` geprüft, Menü zu, Knopf zeigt „Wand X“, `state().drawPlane === 'x'`; „Höher“ ändert `state().planeLabel` (z. B. „Wand X = 1“); Q schaltet weiter und der Knopf folgt; rechts gibt es keine Gruppe „Zeichenebene“ mehr. Review Focus 5: Menü offen → Esc schließt, Fokus auf dem Knopf; Klick in die Ansicht schließt; Werkzeug-Taste (K) bei offenem Menü wird ignoriert, nach dem Schließen wirkt sie; F5 bei offenem Menü schließt es und startet das Spiel.
- [ ] **Step 2:** Run → FAIL. **Step 3:** implementieren (Menü rechts neben dem Knopf, Pfeiltasten wechseln den Eintrag). **Step 4:** Run → PASS, ganze Suite grün. **Step 5:** Commit `feat(editor): Zeichenebene als Knopf mit Ausklapp-Menü in der Werkzeugleiste`.

### Task 8: Abschluss

**Files:** Modify `README.md` (Bedienung: Pfeile, Zeichenebene, Texturen).

- [ ] **Step 1:** README ergänzen. **Step 2:** `npm run typecheck`, `npm test`, E2E, `npm run bench`, `npm run build -w @rgm/editor` → alles grün, Benchmark-Werte ins Ledger. **Step 3:** Commit `docs: Bedienung für Pfeile, Zeichenebene und Texturen`.
