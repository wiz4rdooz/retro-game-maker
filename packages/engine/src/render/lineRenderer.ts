import * as mat4 from '../math/mat4';
import type { Camera } from './camera';
import { createProgram, type Program } from './gl';
import { LINE_FS, LINE_VS } from './shaders';

type Rgba = [number, number, number, number];

/** Einfarbige Linien und Punkte für Raster, 3D-Cursor, Umrisse und Ecken. */
export class LineRenderer {
  private readonly gl: WebGL2RenderingContext;
  private prog!: Program;
  private vao!: WebGLVertexArrayObject;
  private buffer!: WebGLBuffer;
  private readonly viewProj = mat4.create();

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.restore();
  }

  restore(): void {
    const gl = this.gl;
    this.prog = createProgram(gl, LINE_VS, LINE_FS, ['aPos'], ['uViewProj', 'uColor', 'uPointSize']);
    this.vao = gl.createVertexArray()!;
    this.buffer = gl.createBuffer()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    const loc = this.prog.attribs.aPos;
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  drawLines(camera: Camera, aspect: number, segments: Float32Array, rgba: Rgba, depthTest: boolean): void {
    this.drawArrays(camera, aspect, segments, rgba, depthTest, this.gl.LINES, 1);
  }

  drawPoints(camera: Camera, aspect: number, points: Float32Array, rgba: Rgba, sizePx: number): void {
    this.drawArrays(camera, aspect, points, rgba, false, this.gl.POINTS, sizePx);
  }

  /** Flächen (je 3 Ecken), beidseitig sichtbar – z. B. die Füllung ausgewählter Kacheln. */
  drawTriangles(camera: Camera, aspect: number, triangles: Float32Array, rgba: Rgba, depthTest: boolean): void {
    const gl = this.gl;
    gl.disable(gl.CULL_FACE);
    this.drawArrays(camera, aspect, triangles, rgba, depthTest, gl.TRIANGLES, 1);
    gl.enable(gl.CULL_FACE);
  }

  private drawArrays(camera: Camera, aspect: number, data: Float32Array, rgba: Rgba, depthTest: boolean, mode: number, size: number): void {
    const count = Math.floor(data.length / 3);
    if (count === 0) return;
    const gl = this.gl;
    camera.viewProj(this.viewProj, aspect);
    gl.useProgram(this.prog.program);
    gl.uniformMatrix4fv(this.prog.uniforms.uViewProj, false, this.viewProj);
    gl.uniform4fv(this.prog.uniforms.uColor, rgba);
    gl.uniform1f(this.prog.uniforms.uPointSize, size);
    if (depthTest) gl.enable(gl.DEPTH_TEST);
    else gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.drawArrays(mode, 0, count);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
  }
}
