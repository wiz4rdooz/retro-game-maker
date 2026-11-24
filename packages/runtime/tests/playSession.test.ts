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
