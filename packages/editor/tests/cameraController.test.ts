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
