// Erzeugt die Testbilder für die E2E-Tests (nur Node, zlib). Ausgabe ist deterministisch.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'editor', 'e2e', 'fixtures');
mkdirSync(out, { recursive: true });

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** RGBA-PNG; pixel(x, y) liefert [r, g, b, a]. */
function png(w, h, pixel) {
  const raw = Buffer.alloc(h * (1 + w * 4));
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = pixel(x, y);
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
      raw[o++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // Bittiefe
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// 4 × 2 Kacheln à 16 px, gut unterscheidbare Vollfarben, 1 px dunkler Rand
const COLORS = [
  [224, 68, 62], [62, 168, 75], [62, 126, 224], [224, 194, 62],
  [166, 62, 224], [62, 212, 224], [224, 122, 62], [224, 62, 166],
];
writeFileSync(
  join(out, 'kacheln-16.png'),
  png(64, 32, (x, y) => {
    const lx = x % 16, ly = y % 16;
    if (lx === 0 || ly === 0 || lx === 15 || ly === 15) return [16, 16, 16, 255];
    return [...COLORS[Math.floor(y / 16) * 4 + Math.floor(x / 16)], 255];
  }),
);
writeFileSync(join(out, 'ungerade-50x40.png'), png(50, 40, (x, y) => [x * 5, y * 6, 128, 255]));
writeFileSync(join(out, 'zu-gross-20000x16.png'), png(20000, 16, () => [90, 95, 106, 255]));

// „kein Bild“: Pseudo-Zufallsbytes (fester Startwert)
const noise = Buffer.alloc(512);
let s = 0x2545f491;
for (let i = 0; i < noise.length; i++) {
  s = (Math.imul(s, 1103515245) + 12345) >>> 0;
  noise[i] = s >>> 24;
}
writeFileSync(join(out, 'kein-bild.png'), noise);
console.log(`Fixtures geschrieben nach ${out}`);
