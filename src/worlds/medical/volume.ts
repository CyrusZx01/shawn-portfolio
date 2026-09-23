import * as THREE from "three";

// Synthetic head volume, generated procedurally (no scans, no patient data):
// a thin cranial shell, two folded hemispheres, cerebellum and stem, plus a
// dense "region of interest" the story segments and measures.
// Volume-local frame: face toward +z, units ≈ 95 mm.

export const HEAD_Y = 1.35;

export const LESION = {
  center: new THREE.Vector3(0.3, 0.22, 0.2),
  radius: 0.17,
};

/** Irregular region boundary: radius of the region along a unit direction. */
export function lesionRadius(dir: THREE.Vector3) {
  const th = Math.atan2(dir.z, dir.x);
  return (
    LESION.radius *
    (1 + 0.16 * Math.sin(3 * th + 0.7) + 0.08 * Math.sin(5 * th + 2.1) + 0.1 * Math.sin(dir.y * 4 + th))
  );
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cortical folding pattern on the unit sphere, 0 (gyrus) .. 1 (sulcus). */
function fold(d: THREE.Vector3) {
  const a = Math.sin(d.x * 11 + Math.sin(d.y * 7) * 1.6) * Math.sin(d.z * 9 + Math.sin(d.x * 8) * 1.3);
  const b = Math.sin(d.y * 13 + d.z * 5 + Math.sin(d.x * 6));
  const v = Math.abs(a * 0.7 + b * 0.3);
  return 1 - Math.min(1, v * 1.6);
}

export function buildVolume() {
  const rand = mulberry32(7);
  const pos: number[] = [];
  const start: number[] = [];
  const kind: number[] = [];
  const seg: number[] = [];
  const shade: number[] = [];
  const d = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  const randDir = (out: THREE.Vector3) => {
    const u = rand() * 2 - 1;
    const th = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    return out.set(s * Math.cos(th), u, s * Math.sin(th));
  };

  const inLesion = (p: THREE.Vector3) => {
    tmp.subVectors(p, LESION.center);
    const len = tmp.length();
    if (len < 1e-5) return true;
    return len < lesionRadius(tmp.divideScalar(len));
  };

  const push = (p: THREE.Vector3, k: number, s: number, sh: number) => {
    pos.push(p.x, p.y, p.z);
    randDir(d).multiplyScalar(1.6 + rand() * 2.2);
    start.push(d.x, d.y * 0.55 + 0.25, d.z);
    kind.push(k);
    seg.push(s);
    shade.push(sh);
  };

  const p = new THREE.Vector3();

  // cranial shell
  for (let i = 0; i < 7000; i++) {
    randDir(d);
    const j = 1 + (rand() - 0.5) * 0.03;
    p.set(d.x * 0.8 * j, 0.05 + d.y * 0.92 * j, d.z * 1.02 * j);
    if (p.y < -0.5 + Math.max(0, p.z) * 0.25) continue;
    push(p, 0, 0, rand());
  }

  // hemispheres
  const bc = new THREE.Vector3(0, 0.08, -0.02);
  for (let i = 0; i < 19000; i++) {
    randDir(d);
    if (d.y < -0.55) d.y = -0.55 - (d.y + 0.55) * 0.3; // flatter underside
    d.normalize();
    const f = fold(d);
    const surface = rand() < 0.62;
    const frac = surface ? 1 - Math.pow(rand(), 3) * 0.12 : Math.cbrt(rand()) * 0.94;
    const r = (1 - 0.07 * f) * frac;
    p.set(bc.x + d.x * 0.62 * r, bc.y + d.y * 0.55 * r, bc.z + d.z * 0.78 * r);
    // longitudinal fissure
    if (Math.abs(p.x) < 0.03) p.x = Math.sign(p.x || 1) * (0.03 + Math.abs(p.x));
    const sh = surface ? 0.25 + 0.75 * (1 - f) * (0.7 + 0.3 * rand()) : 0.2 + 0.35 * rand();
    push(p, 1, inLesion(p) ? 1 : 0, sh);
  }

  // cerebellum
  const cc = new THREE.Vector3(0, -0.3, -0.5);
  for (let i = 0; i < 2600; i++) {
    randDir(d);
    const frac = rand() < 0.7 ? 0.9 + rand() * 0.1 : Math.cbrt(rand());
    p.set(cc.x + d.x * 0.36 * frac, cc.y + d.y * 0.19 * frac, cc.z + d.z * 0.26 * frac);
    const stripe = 0.5 + 0.5 * Math.sin(p.y * 90);
    push(p, 1, 0, 0.3 + 0.5 * stripe);
  }

  // stem
  for (let i = 0; i < 800; i++) {
    const y = -0.2 - rand() * 0.65;
    const th = rand() * Math.PI * 2;
    const rr = 0.085 * Math.sqrt(0.6 + 0.4 * rand());
    p.set(Math.cos(th) * rr, y, -0.28 + Math.sin(th) * rr - (y + 0.2) * 0.12);
    push(p, 1, 0, 0.3 + 0.4 * rand());
  }

  // dense region of interest
  for (let i = 0; i < 1600; i++) {
    randDir(d);
    const r = lesionRadius(d) * Math.cbrt(rand());
    p.copy(LESION.center).addScaledVector(d, r);
    push(p, 1, 1, 0.5 + 0.5 * rand());
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aStart", new THREE.Float32BufferAttribute(start, 3));
  g.setAttribute("aKind", new THREE.Float32BufferAttribute(kind, 1));
  g.setAttribute("aSeg", new THREE.Float32BufferAttribute(seg, 1));
  g.setAttribute("aRand", new THREE.Float32BufferAttribute(shade, 1));
  g.computeBoundingSphere();
  return g;
}
