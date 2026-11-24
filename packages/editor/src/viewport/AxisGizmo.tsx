import { vec3 } from '@rgm/engine';
import { t } from '../strings/de';
import type { ViewportController } from './viewportController';

const AXES = [
  { label: 'X', color: '#ff7a7a', dir: [1, 0, 0] },
  { label: 'Y', color: '#7ee08f', dir: [0, 1, 0] },
  { label: 'Z', color: '#6fb2ff', dir: [0, 0, 1] },
] as const;

const C = 36;
const LEN = 22;
const right = vec3.create();
const up = vec3.create();
const fwd = vec3.create();

/** Achsen-Anzeige oben rechts; dreht sich mit der Kamera (Y zeigt nach oben). */
export function AxisGizmo({ ctrl }: { ctrl: ViewportController }) {
  void ctrl.cameraInfo.value;
  const cam = ctrl.camera;
  cam.right(right);
  cam.up(up);
  cam.forward(fwd);
  // vom Betrachter weg zeigende Achsen zuerst, damit die nahen oben liegen
  const items = AXES.map((a) => ({
    ...a,
    x: C + vec3.dot(a.dir, right) * LEN,
    y: C - vec3.dot(a.dir, up) * LEN,
    depth: vec3.dot(a.dir, fwd),
  })).sort((a, b) => b.depth - a.depth);
  return (
    <svg class="axis-gizmo" width="72" height="72" viewBox="0 0 72 72" role="img" aria-label={t.ansicht.achsen}>
      {items.map((a) => {
        const dx = a.x - C, dy = a.y - C;
        const len = Math.hypot(dx, dy) || 1;
        const lx = C + (dx / len) * Math.max(len + 9, 9);
        const ly = C + (dy / len) * Math.max(len + 9, 9);
        return (
          <g key={a.label} opacity={a.depth > 0.35 ? 0.55 : 1}>
            <path d={`M${C} ${C}L${a.x.toFixed(1)} ${a.y.toFixed(1)}`} stroke={a.color} stroke-width="2.5" stroke-linecap="round" />
            <text x={lx.toFixed(1)} y={(ly + 4).toFixed(1)} fill={a.color} font-size="12" font-weight="600" text-anchor="middle">
              {a.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
