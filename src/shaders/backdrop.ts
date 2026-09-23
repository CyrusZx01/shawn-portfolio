import * as THREE from "three";

// Full-screen overlay drawn over the flat #1d1d1d scene background (set via
// scene.background so colour management stays exact): a barely-there vignette,
// a soft accent halo behind the bust and animated film grain. Output is
// premultiplied-free RGBA, so the base colour itself is never re-encoded.

export const backdropVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.9999, 1.0);
  }
`;

export const backdropFragment = /* glsl */ `
  uniform vec3 uGlow;
  uniform vec2 uGlowPos;
  uniform float uGlowStrength;
  uniform float uAspect;
  uniform float uTime;
  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  void main() {
    vec2 p = vUv - 0.5;
    p.x *= uAspect;
    float vignette = smoothstep(1.1, 0.25, length(p));

    vec2 g = vUv - uGlowPos;
    g.x *= uAspect;
    float glow = exp(-dot(g, g) * 5.0) * uGlowStrength;

    float grain = hash(vUv * 1024.0 + fract(uTime) * 91.0) - 0.5;
    // Darken toward the corners, tint toward the halo, flicker a little grain.
    float shade = (1.0 - vignette) * 0.28;
    vec3 col = mix(vec3(0.0), uGlow, glow / max(glow + shade, 1e-4));
    float alpha = clamp(shade + glow + grain * 0.02, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
  }
`;

export function createBackdropMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: backdropVertex,
    fragmentShader: backdropFragment,
    depthWrite: false,
    depthTest: true,
    transparent: true,
    toneMapped: false,
    uniforms: {
      uGlow: { value: new THREE.Color("#ffffff") },
      uGlowPos: { value: new THREE.Vector2(0.64, 0.55) },
      uGlowStrength: { value: 0 },
      uAspect: { value: 1 },
      uTime: { value: 0 },
    },
  });
}
