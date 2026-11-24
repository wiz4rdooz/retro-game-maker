import { World } from '@rgm/engine';

export interface TilesetMeta {
  id: number;
  name: string;
  /** Pfad im Projekt, z. B. `tilesets/wald.png`. */
  file: string;
  tileSize: number;
  imageWidth: number;
  imageHeight: number;
  columns: number;
  rows: number;
}

export interface EditorPrefs {
  /** Kameraposition; yaw und pitch in rad. */
  camera: { x: number; y: number; z: number; yaw: number; pitch: number };
  activeLayer: number;
  snap: 1 | 0.5 | 0.25;
  drawPlane: 'auto' | 'x' | 'y' | 'z';
}

export interface ProjectFile {
  format: 'rgm-projekt';
  version: 1;
  name: string;
  /** ISO-8601 */
  created: string;
  activeWorld: string;
  worlds: string[];
  tilesets: TilesetMeta[];
  /** Nächste freie Tileset-id (−1 ist die eingebaute Prüftextur). */
  nextTilesetId: number;
  editor: EditorPrefs;
}

export const DEFAULT_WORLD = 'insel';

/** Neues Projekt mit einer leeren Welt „insel“ und der Ebene „Ebene 1“. */
export function newProject(name: string, now: Date): { project: ProjectFile; world: World } {
  const world = new World();
  const layer = world.addLayer('Ebene 1');
  const project: ProjectFile = {
    format: 'rgm-projekt',
    version: 1,
    name,
    created: now.toISOString(),
    activeWorld: DEFAULT_WORLD,
    worlds: [DEFAULT_WORLD],
    tilesets: [],
    nextTilesetId: 0,
    editor: {
      camera: { x: 0, y: 6, z: 12, yaw: 0, pitch: (-25 * Math.PI) / 180 },
      activeLayer: layer.id,
      snap: 1,
      drawPlane: 'auto',
    },
  };
  return { project, world };
}
