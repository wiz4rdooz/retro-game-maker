import type { TilesetInfo } from '../geometry/uv';
import * as mat4 from '../math/mat4';
import type { ChunkMeshPart } from '../mesh/chunkMesher';
import type { Camera } from './camera';
import { extractFrustum, selectVisibleChunks, type ChunkBounds } from './frustum';
import { createProgram, type Program } from './gl';
import { TILE_FS, TILE_VS } from './shaders';

export interface RenderStats {
  drawCalls: number;
  visibleChunks: number;
  triangles: number;
}

export interface FogOptions {
  color: [number, number, number];
  start: number;
  end: number;
  viewDistance: number;
}

/** Eingebaute Prüftextur für Tileset −1 (8-px-Schachbrett in #5a5f6a / #3d414a). */
export const CHECKER_TILESET: TilesetInfo = { id: -1, tileSize: 16, imageWidth: 32, imageHeight: 32 };

interface GpuPart {
  tileset: number;
  vao: WebGLVertexArrayObject;
  buffers: WebGLBuffer[];
  indexCount: number;
  triangles: number;
}

interface GpuChunk extends ChunkBounds {
  min: Float32Array;
  max: Float32Array;
  parts: GpuPart[];
  cpu: ChunkMeshPart[];
}

interface Texture {
  tex: WebGLTexture;
  info: TilesetInfo;
  image: TexImageSource;
}

const ATTRIBS = ['aPos', 'aUv', 'aShade'];
const UNIFORMS = ['uViewProj', 'uCamPos', 'uTex', 'uFogColor', 'uFogStart', 'uFogEnd', 'uAlpha'];

/** Zeichnet Chunks aus Kacheln (ein VAO je Chunk und Tileset) plus Geister-Vorschau. */
export class TileRenderer {
  private readonly gl: WebGL2RenderingContext;
  private prog!: Program;
  private readonly textures = new Map<number, Texture>();
  private readonly chunks = new Map<number, GpuChunk>();
  private ghost: GpuPart[] = [];
  private readonly viewProj = mat4.create();
  private readonly planes = new Float32Array(24);

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.prog = createProgram(gl, TILE_VS, TILE_FS, ATTRIBS, UNIFORMS);
    this.setTileset(-1, checkerImage(), CHECKER_TILESET);
  }

  setTileset(id: number, image: TexImageSource, info: TilesetInfo): void {
    const gl = this.gl;
    const old = this.textures.get(id);
    if (old) gl.deleteTexture(old.tex);
    this.textures.set(id, { tex: this.upload(image), info, image });
  }

  removeTileset(id: number): void {
    const t = this.textures.get(id);
    if (!t || id === -1) return;
    this.gl.deleteTexture(t.tex);
    this.textures.delete(id);
  }

  updateChunk(key: number, parts: ChunkMeshPart[], min: ArrayLike<number>, max: ArrayLike<number>): void {
    this.removeChunk(key);
    if (parts.length === 0) return;
    this.chunks.set(key, {
      key,
      min: Float32Array.from(min),
      max: Float32Array.from(max),
      parts: parts.map((p) => this.uploadPart(p)),
      cpu: parts,
    });
  }

  removeChunk(key: number): void {
    const ch = this.chunks.get(key);
    if (!ch) return;
    for (const p of ch.parts) this.deletePart(p);
    this.chunks.delete(key);
  }

  draw(camera: Camera, aspect: number, fog: FogOptions): RenderStats {
    const gl = this.gl;
    const stats: RenderStats = { drawCalls: 0, visibleChunks: 0, triangles: 0 };
    camera.viewProj(this.viewProj, aspect);
    extractFrustum(this.viewProj, this.planes);
    const ortho = camera.view !== 'perspective';
    const visible = selectVisibleChunks(this.chunks.values(), this.planes, camera.position, ortho ? Infinity : fog.viewDistance);
    this.begin(camera, fog, ortho, 1);
    for (const key of visible) {
      const ch = this.chunks.get(key)!;
      stats.visibleChunks++;
      for (const part of ch.parts) {
        if (!this.bindTexture(part.tileset)) continue;
        gl.bindVertexArray(part.vao);
        gl.drawElements(gl.TRIANGLES, part.indexCount, gl.UNSIGNED_INT, 0);
        stats.drawCalls++;
        stats.triangles += part.triangles;
      }
    }
    gl.bindVertexArray(null);
    return stats;
  }

  /** Halbtransparente Vorschau (z. B. der nächste Block); wird jedes Mal neu hochgeladen. */
  drawGhosts(camera: Camera, aspect: number, parts: ChunkMeshPart[], alpha: number): void {
    const gl = this.gl;
    for (const p of this.ghost) this.deletePart(p);
    this.ghost = parts.map((p) => this.uploadPart(p));
    if (this.ghost.length === 0) return;
    camera.viewProj(this.viewProj, aspect);
    this.begin(camera, { color: [0, 0, 0], start: 1e9, end: 1e9 + 1, viewDistance: Infinity }, true, alpha);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    for (const part of this.ghost) {
      if (!this.bindTexture(part.tileset)) continue;
      gl.bindVertexArray(part.vao);
      gl.drawElements(gl.TRIANGLES, part.indexCount, gl.UNSIGNED_INT, 0);
    }
    gl.bindVertexArray(null);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  /** Nach webglcontextrestored: Programme, Texturen und Puffer aus den CPU-Kopien neu anlegen. */
  restore(): void {
    this.prog = createProgram(this.gl, TILE_VS, TILE_FS, ATTRIBS, UNIFORMS);
    for (const [id, t] of this.textures) this.textures.set(id, { ...t, tex: this.upload(t.image) });
    for (const ch of this.chunks.values()) ch.parts = ch.cpu.map((p) => this.uploadPart(p));
    this.ghost = [];
  }

  private begin(camera: Camera, fog: FogOptions, noFog: boolean, alpha: number): void {
    const gl = this.gl;
    const u = this.prog.uniforms;
    gl.useProgram(this.prog.program);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);
    gl.uniformMatrix4fv(u.uViewProj, false, this.viewProj);
    gl.uniform3fv(u.uCamPos, camera.position);
    gl.uniform3fv(u.uFogColor, fog.color);
    gl.uniform1f(u.uFogStart, noFog ? 1e9 : fog.start);
    gl.uniform1f(u.uFogEnd, noFog ? 1e9 + 1 : fog.end);
    gl.uniform1f(u.uAlpha, alpha);
    gl.uniform1i(u.uTex, 0);
    gl.activeTexture(gl.TEXTURE0);
  }

  private bindTexture(id: number): boolean {
    const t = this.textures.get(id) ?? this.textures.get(-1);
    if (!t) return false;
    this.gl.bindTexture(this.gl.TEXTURE_2D, t.tex);
    return true;
  }

  private upload(image: TexImageSource): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  private uploadPart(p: ChunkMeshPart): GpuPart {
    const gl = this.gl;
    const a = this.prog.attribs;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buffers: WebGLBuffer[] = [];
    const attrib = (data: Float32Array, loc: number, size: number) => {
      const b = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      if (loc >= 0) {
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      }
      buffers.push(b);
    };
    attrib(p.positions, a.aPos, 3);
    attrib(p.uvs, a.aUv, 2);
    attrib(p.shades, a.aShade, 1);
    const ib = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, p.indices, gl.STATIC_DRAW);
    buffers.push(ib);
    gl.bindVertexArray(null);
    return { tileset: p.tileset, vao, buffers, indexCount: p.indices.length, triangles: p.triangles };
  }

  private deletePart(p: GpuPart): void {
    const gl = this.gl;
    gl.deleteVertexArray(p.vao);
    for (const b of p.buffers) gl.deleteBuffer(b);
  }
}

function checkerImage(): ImageData {
  const size = 32;
  const data = new Uint8ClampedArray(size * size * 4);
  const a = [0x5a, 0x5f, 0x6a];
  const b = [0x3d, 0x41, 0x4a];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = ((x >> 3) + (y >> 3)) % 2 === 0 ? a : b;
      const i = (y * size + x) * 4;
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
      data[i + 3] = 255;
    }
  }
  return new ImageData(data, size, size);
}
