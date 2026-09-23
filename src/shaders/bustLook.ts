import * as THREE from "three";

// Makes the static bust look at the cursor without a rig.
//
// Vertex: the head is turned around a neck pivot. Each vertex gets a weight
// (0 on the body, 1 on the head, blended across the neck) and is rotated by
// weight × (yaw, pitch). Decals run the same deformation in the bust's space
// so the stickers stay glued to the skin.
//
// Fragment: the eyes are painted into an auto-generated UV atlas, so they are
// located analytically in *object* space (see scripts used to measure them:
// centre, major axis, up axis, normal). Inside each eye aperture the painted
// sclera/iris is replaced by a procedural one whose iris slides with the gaze,
// and a lid can sweep down for blinks.
//
// All coordinates below are in Mesh_0's (undeformed) geometry space.

export const NECK_PIVOT = new THREE.Vector3(-0.03, 0.15, 0.0);
/** Point between the eyes, used as the gaze origin. */
export const EYE_MID = new THREE.Vector3(-0.05, 0.53, 0.19);
/** Direction the bust faces at rest (the painted gaze). */
export const REST_DIR = new THREE.Vector3(-0.17, -0.07, 0.95).normalize();

/** Head weight for a Mesh_0-space point — mirrored in GLSL below. */
export function headWeight(p: THREE.Vector3) {
  const s = p.y + Math.max(p.z, 0) * 0.25;
  const t = Math.min(1, Math.max(0, (s - 0.08) / (0.27 - 0.08)));
  return t * t * (3 - 2 * t);
}

export type LookUniforms = {
  uYaw: { value: number };
  uPitch: { value: number };
  uEyeU: { value: number };
  uEyeV: { value: number };
  uBlink: { value: number };
};

export function createLookUniforms(): LookUniforms {
  return {
    uYaw: { value: 0 },
    uPitch: { value: 0 },
    uEyeU: { value: 0 },
    uEyeV: { value: 0 },
    uBlink: { value: 0 },
  };
}

/** Rotation applied to a Mesh_0-space point with head weight `w`. */
export function headMatrix(yaw: number, pitch: number, w: number, out = new THREE.Matrix4()) {
  const r = new THREE.Matrix4().makeRotationY(yaw * w).multiply(new THREE.Matrix4().makeRotationX(-pitch * w));
  const t1 = new THREE.Matrix4().makeTranslation(NECK_PIVOT.x, NECK_PIVOT.y, NECK_PIVOT.z);
  const t0 = new THREE.Matrix4().makeTranslation(-NECK_PIVOT.x, -NECK_PIVOT.y, -NECK_PIVOT.z);
  return out.copy(t1).multiply(r).multiply(t0);
}

const vertexHeader = /* glsl */ `
uniform float uYaw;
uniform float uPitch;
uniform mat4 uToMesh;
uniform mat4 uFromMesh;
varying vec3 vMeshPos;
float lookWeight(vec3 p) {
  float s = p.y + max(p.z, 0.0) * 0.25;
  return smoothstep(0.08, 0.27, s);
}
mat3 lookRot(float w) {
  float a = uYaw * w, b = -uPitch * w;
  float ca = cos(a), sa = sin(a), cb = cos(b), sb = sin(b);
  mat3 ry = mat3(ca, 0.0, -sa,  0.0, 1.0, 0.0,  sa, 0.0, ca);
  mat3 rx = mat3(1.0, 0.0, 0.0,  0.0, cb, sb,  0.0, -sb, cb);
  return ry * rx;
}
`;

const eyeFunctions = /* glsl */ `
uniform float uEyeU;
uniform float uEyeV;
uniform float uBlink;
varying vec3 vMeshPos;

vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }

// returns rgb in .xyz, coverage in .w
vec4 paintEye(vec3 p, vec3 c, vec3 ax, vec3 ay, vec3 nz, float irisU0, vec3 texel) {
  vec3 d = p - c;
  if (abs(dot(d, nz)) > 0.03) return vec4(0.0);
  float u = dot(d, ax);
  float v = dot(d, ay);
  float aa = max(fwidth(u), 1e-4);

  // aperture ellipse (measured) with the painted upper lid line kept
  vec2 e = vec2((u + 0.004) / 0.052, (v + 0.001) / 0.0135);
  float inside = 1.0 - smoothstep(1.0 - aa * 30.0, 1.0, length(e));
  inside *= 1.0 - smoothstep(0.0085 - aa, 0.0085 + aa, v);
  // only where the painting actually is eye (sclera or iris), never skin
  vec3 s = pow(texel, vec3(1.0 / 2.2));
  float mx = max(s.r, max(s.g, s.b));
  float mn = min(s.r, min(s.g, s.b));
  float isSclera = step(0.72, mx) * step(mx - mn, 0.18);
  float isIris = step(mx, 0.59);
  inside *= max(isSclera, isIris);
  if (inside <= 0.0) return vec4(0.0);

  vec3 sclera = toLinear(vec3(0.87, 0.79, 0.74));
  // soft shade under the upper lid
  sclera *= mix(1.0, 0.72, smoothstep(-0.004, 0.009, v));
  sclera *= mix(1.0, 0.85, smoothstep(0.03, 0.05, abs(u + 0.004)));

  vec2 ic = vec2(irisU0 + uEyeU, uEyeV - 0.001);
  float r = length(vec2(u, v) - ic);
  float iris = 1.0 - smoothstep(0.0165 - aa, 0.0165 + aa, r);
  float pupil = 1.0 - smoothstep(0.0068 - aa, 0.0068 + aa, r);
  vec3 irisCol = toLinear(vec3(0.29, 0.15, 0.09));
  irisCol = mix(irisCol * 1.5, irisCol * 0.6, smoothstep(0.004, 0.0165, r)); // limbal darkening
  irisCol *= mix(1.0, 0.55, smoothstep(0.0, 0.009, v));                      // lid shadow
  vec3 col = mix(sclera, irisCol, iris);
  col = mix(col, toLinear(vec3(0.05, 0.03, 0.025)), pupil);
  float spec = 1.0 - smoothstep(0.0018, 0.0028, length(vec2(u, v) - ic - vec2(0.0045, 0.0035)));
  col = mix(col, vec3(1.0), spec * 0.85);

  // blink: skin lid sweeps down from the top of the aperture
  float lidEdge = mix(0.012, -0.016, uBlink);
  float lid = smoothstep(lidEdge - aa, lidEdge + aa, v);
  float lash = (1.0 - smoothstep(0.0, 0.0022, abs(v - lidEdge))) * step(0.02, uBlink);
  col = mix(col, toLinear(vec3(0.68, 0.40, 0.30)), lid);
  col = mix(col, toLinear(vec3(0.16, 0.07, 0.05)), lash);

  return vec4(col, inside);
}
`;

const eyeApply = /* glsl */ `
#include <map_fragment>
{
  vec3 texel = diffuseColor.rgb;
  vec4 L = paintEye(vMeshPos, vec3(-0.1484, 0.5012, 0.1703), vec3(0.904, 0.261, 0.338),
                    vec3(-0.211, 0.961, -0.178), vec3(-0.372, 0.09, 0.924), 0.006, texel);
  vec4 R = paintEye(vMeshPos, vec3(0.0504, 0.5633, 0.1979), vec3(0.98, 0.198, 0.013),
                    vec3(-0.196, 0.954, 0.228), vec3(0.033, -0.226, 0.974), -0.014, texel);
  diffuseColor.rgb = mix(diffuseColor.rgb, L.rgb, L.a);
  diffuseColor.rgb = mix(diffuseColor.rgb, R.rgb, R.a);
}
`;

const vertexNormal = /* glsl */ `
#include <beginnormal_vertex>
vec3 lookMeshPos = (uToMesh * vec4(position, 1.0)).xyz;
vMeshPos = lookMeshPos;
float lookW = lookWeight(lookMeshPos);
mat3 lookR = lookRot(lookW);
objectNormal = lookR * objectNormal;
`;

const vertexBegin = /* glsl */ `
#include <begin_vertex>
{
  vec3 q = lookR * (lookMeshPos - vec3(${NECK_PIVOT.x}, ${NECK_PIVOT.y}, ${NECK_PIVOT.z}))
         + vec3(${NECK_PIVOT.x}, ${NECK_PIVOT.y}, ${NECK_PIVOT.z});
  transformed = (uFromMesh * vec4(q, 1.0)).xyz;
}
`;

/** Patch a bust material. `toMesh` maps the mesh's geometry space into Mesh_0's
 * (identity for Mesh_0 itself). Set `eyes` only on the skin material. */
export function patchLookMaterial(
  material: THREE.MeshStandardMaterial,
  uniforms: LookUniforms,
  toMesh: THREE.Matrix4,
  eyes: boolean,
) {
  const uToMesh = { value: toMesh.clone() };
  const uFromMesh = { value: toMesh.clone().invert() };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, { uToMesh, uFromMesh });
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${vertexHeader}`)
      .replace("#include <beginnormal_vertex>", vertexNormal)
      .replace("#include <begin_vertex>", vertexBegin);
    if (eyes) {
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\n${eyeFunctions}`)
        .replace("#include <map_fragment>", eyeApply);
    }
  };
  material.customProgramCacheKey = () => (eyes ? "bust-look-eyes" : "bust-look");
  material.needsUpdate = true;
}
