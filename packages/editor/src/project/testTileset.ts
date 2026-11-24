import { mulberry32 } from '@rgm/engine';

type Rgb = [number, number, number];

/**
 * Farben der Test-Kacheln (8 × 4 à 16 px), Zeile für Zeile:
 * 0: Gras ×4, Erde ×4 · 1: Fels ×4, Sand ×4 · 2: Wasser ×4, Ziegel ×4 · 3: Holz ×4, Moos/Dach ×4.
 */
const BASE: Rgb[][] = [
  [[86, 140, 62], [74, 128, 56], [96, 150, 70], [80, 134, 52], [120, 86, 58], [110, 78, 52], [128, 92, 62], [116, 84, 54]],
  [[118, 120, 126], [104, 106, 112], [130, 132, 138], [96, 98, 104], [214, 194, 140], [204, 184, 130], [222, 204, 150], [196, 176, 124]],
  [[52, 104, 168], [46, 96, 160], [58, 112, 176], [42, 90, 150], [150, 74, 58], [140, 68, 52], [160, 82, 64], [132, 64, 50]],
  [[138, 100, 62], [128, 92, 56], [148, 108, 68], [120, 86, 52], [70, 110, 74], [160, 70, 60], [92, 96, 110], [180, 160, 110]],
];

/** Erzeugt das Test-Tileset (128 × 64 px, 16-px-Kacheln) mit Farbrauschen; alles selbst gezeichnet. */
export async function makeTestTileset(): Promise<{ bytes: Uint8Array; width: 128; height: 64; tileSize: 16 }> {
  const width = 128, height = 64, ts = 16;
  const canvas = new OffscreenCanvas(width, height);
  const g = canvas.getContext('2d');
  if (!g) throw new Error('2D-Zeichenfläche fehlt');
  const img = g.createImageData(width, height);
  const rand = mulberry32(7);
  for (let ty = 0; ty < 4; ty++) {
    for (let tx = 0; tx < 8; tx++) {
      const [r, gr, b] = BASE[ty][tx];
      const brick = ty === 2 && tx >= 4;
      const water = ty === 2 && tx < 4;
      for (let y = 0; y < ts; y++) {
        for (let x = 0; x < ts; x++) {
          let k = 0.88 + rand() * 0.24;
          if (brick) {
            const row = Math.floor(y / 4);
            const off = row % 2 === 0 ? 0 : 4;
            if (y % 4 === 3 || (x + off) % 8 === 7) k = 0.55; // Fugen
          } else if (water && (x + y * 2) % 7 === 0) {
            k = 1.18; // Glanz
          } else if (ty === 3 && tx < 4 && x % 5 === 4) {
            k *= 0.8; // Holzmaserung
          }
          const o = ((ty * ts + y) * width + tx * ts + x) * 4;
          img.data[o] = Math.min(255, Math.round(r * k));
          img.data[o + 1] = Math.min(255, Math.round(gr * k));
          img.data[o + 2] = Math.min(255, Math.round(b * k));
          img.data[o + 3] = 255;
        }
      }
    }
  }
  g.putImageData(img, 0, 0);
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width, height, tileSize: 16 };
}
