/**
 * Reusable GLSL noise snippets for the WebGL effects.
 *
 * Every symbol is prefixed with `tv_` so several chunks can be concatenated
 * into one shader without colliding with three.js built-ins or user code.
 */

/** 3D simplex noise, based on Stefan Gustavson / Ashima Arts. */
export const GLSL_SIMPLEX_3D = /* glsl */ `
vec3 tv_mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 tv_mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 tv_permute(vec4 x) {
  return tv_mod289(((x * 34.0) + 1.0) * x);
}

vec4 tv_taylorInvSqrt(vec4 r) {
  return 1.79284291400159 - 0.85373472095314 * r;
}

float tv_snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = tv_mod289(i);
  vec4 p = tv_permute(tv_permute(tv_permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = tv_taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`

/** Fractal Brownian motion on top of `tv_snoise`. Requires GLSL_SIMPLEX_3D. */
export const GLSL_FBM_3D = /* glsl */ `
float tv_fbm3(vec3 p, int octaves) {
  float amplitude = 0.5;
  float sum = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    sum += amplitude * tv_snoise(p);
    p *= 2.0;
    amplitude *= 0.5;
  }
  return sum;
}
`

/** Cellular (Worley) distance field in 2D, `tv_worley2` returns F1. */
export const GLSL_WORLEY_2D = /* glsl */ `
vec2 tv_hash22(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

float tv_worley2(vec2 p) {
  vec2 cell = floor(p);
  vec2 local = fract(p);
  float nearest = 8.0;

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y));
      vec2 point = tv_hash22(cell + offset);
      nearest = min(nearest, length(offset + point - local));
    }
  }

  return nearest;
}
`
