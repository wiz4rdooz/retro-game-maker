export const TILE_VS = `#version 300 es
in vec3 aPos;
in vec2 aUv;
in float aShade;
uniform mat4 uViewProj;
uniform vec3 uCamPos;
out vec2 vUv;
out float vShade;
out float vDist;
void main() {
  vUv = aUv;
  vShade = aShade;
  vDist = distance(aPos, uCamPos);
  gl_Position = uViewProj * vec4(aPos, 1.0);
}`;

export const TILE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
in float vShade;
in float vDist;
uniform sampler2D uTex;
uniform vec3 uFogColor;
uniform float uFogStart;
uniform float uFogEnd;
uniform float uAlpha;
out vec4 outColor;
void main() {
  vec4 c = texture(uTex, vUv);
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
