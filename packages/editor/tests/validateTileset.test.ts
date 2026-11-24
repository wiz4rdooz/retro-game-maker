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
