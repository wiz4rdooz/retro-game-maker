export const TILE_VS = `#version 300 es
in vec3 aPos;
in vec2 aLocal;
in vec2 aCell;
in float aShade;
in float aRank;
uniform mat4 uViewProj;
uniform vec3 uCamPos;
uniform float uDepthStep;
uniform float uRankAdd;
out vec2 vLocal;
flat out vec2 vCell;
out float vShade;
out float vDist;
void main() {
  vLocal = aLocal;
  vCell = aCell;
  vShade = aShade;
  vDist = distance(aPos, uCamPos);
  gl_Position = uViewProj * vec4(aPos, 1.0);
  // feste Reihenfolge überlappender Kacheln: höhere Stufe minimal nach vorn (kein Flackern)
  gl_Position.z -= (aRank + uRankAdd) * uDepthStep * gl_Position.w;
}`;

export const TILE_FS = `#version 300 es
precision highp float;
in vec2 vLocal;
flat in vec2 vCell;
in float vShade;
in float vDist;
uniform sampler2D uTex;
uniform float uTileSize;
uniform vec3 uFogColor;
uniform float uFogStart;
uniform float uFogEnd;
uniform float uAlpha;
out vec4 outColor;
void main() {
  // Texel innerhalb der Kachel im Tileset: Wiederholung statt Dehnen, pixelgenau
  vec2 inCell = clamp(floor(fract(vLocal) * uTileSize), 0.0, uTileSize - 1.0);
  ivec2 texel = clamp(ivec2(vCell * uTileSize + inCell), ivec2(0), textureSize(uTex, 0) - 1);
  vec4 c = texelFetch(uTex, texel, 0);
  if (c.a < 0.5) discard;
  vec3 rgb = c.rgb * vShade;
  float f = clamp((vDist - uFogStart) / max(uFogEnd - uFogStart, 0.0001), 0.0, 1.0);
  outColor = vec4(mix(rgb, uFogColor, f), uAlpha);
}`;

export const LINE_VS = `#version 300 es
in vec3 aPos;
uniform mat4 uViewProj;
uniform float uPointSize;
void main() {
  gl_Position = uViewProj * vec4(aPos, 1.0);
  gl_PointSize = uPointSize;
}`;

export const LINE_FS = `#version 300 es
precision mediump float;
uniform vec4 uColor;
out vec4 outColor;
void main() {
  outColor = uColor;
}`;
