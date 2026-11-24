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
  // Rampe: 4 m lang, Hinterkante angehoben, oben eine Plattform
  const rampWorld = (deg: number) => {
    const w = floorWorld(); const k = Math.tan((deg * Math.PI) / 180);
    for (let x = -3; x < 3; x++) {
      for (let i = 0; i < 4; i++) {
        const z0 = -i, z1 = -(i + 1), y0 = i * k, y1 = (i + 1) * k;
        w.addTile(T(new Float32Array([x, y0, z0, x + 1, y0, z0, x + 1, y1, z1, x, y1, z1])));
      }
      for (let z = -10; z < -4; z++) w.addTile(T(cellQuad({ axis: 'y', offset: 4 * k, facing: 1 }, x, z)));
    }
    return w;
  };
  it('läuft eine 30°-Rampe hoch', () => { const p = new FpsController(rampWorld(30), [0.5, 0, 0.5], 0); run(p, 2, fwd); expect(p.position[1]).toBeGreaterThan(0.5); });
  it('kommt eine 60°-Rampe nicht hoch', () => { const p = new FpsController(rampWorld(60), [0.5, 0, 0.5], 0); run(p, 2, fwd); expect(p.position[1]).toBeLessThan(0.6); });
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
  it('Blick: lookDX nach rechts verkleinert yaw, pitch bleibt in ±89°', () => {
    const p = new FpsController(floorWorld(), [0, 0, 0], 0);
    p.update(1 / 60, { ...idle, lookDX: 0.5, lookDY: 5 });
    expect(p.yaw).toBeCloseTo(-0.5, 6); expect(p.pitch).toBeCloseTo((-89 * Math.PI) / 180, 6);
  });
});
