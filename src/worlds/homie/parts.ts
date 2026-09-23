import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

// Homie's kit of parts: materials, canvas textures and a geometry tracker, built once.
// Two separate products share it (see desk.ts / spider.ts), in the poster's
// "cream classic" colourway: soft cream shells, glossy black glass, orange accents.

export const ACCENT = "#f08a3c";
export const SCREEN_YELLOW = "#ffc93c";

export type Kit = ReturnType<typeof createKit>;

/** Hole pattern for a speaker grille: dark rounded plate with punched holes. */
function grilleTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 192;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#1c1c1e";
  ctx.beginPath();
  ctx.roundRect(0, 0, c.width, c.height, 70);
  ctx.fill();
  const cols = 22;
  const rows = 7;
  const sx = (c.width - 80) / cols;
  const sy = (c.height - 40) / rows;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = 40 + (i + 0.5 + (j % 2 ? 0.25 : -0.25)) * sx;
      const y = 20 + (j + 0.5) * sy;
      const nx = (x / c.width) * 2 - 1;
      const ny = (y / c.height) * 2 - 1;
      if (Math.pow(Math.abs(nx), 8) + Math.pow(Math.abs(ny), 4) > 0.8) continue;
      ctx.beginPath();
      ctx.arc(x, y + 1.5, sx * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, sx * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = "#050506";
      ctx.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** The "H" mark: a bold black letter on transparent, printed straight on the shell. */
function letterTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#1a1a1c";
  const bar = 22;
  ctx.fillRect(26, 18, bar, 92);
  ctx.fillRect(128 - 26 - bar, 18, bar, 92);
  ctx.fillRect(26, 53, 128 - 52, bar - 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function createKit() {
  const cream = new THREE.MeshPhysicalMaterial({
    color: "#ede6d9",
    roughness: 0.52,
    clearcoat: 0.35,
    clearcoatRoughness: 0.4,
    sheen: 0.3,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color("#fff4e4"),
  });
  const creamShade = new THREE.MeshPhysicalMaterial({
    color: "#ddd4c5",
    roughness: 0.58,
    clearcoat: 0.2,
    clearcoatRoughness: 0.45,
  });
  const orange = new THREE.MeshPhysicalMaterial({
    color: "#f07a26",
    roughness: 0.36,
    clearcoat: 0.6,
    clearcoatRoughness: 0.2,
    emissive: new THREE.Color("#f07a26"),
    emissiveIntensity: 0,
  });
  /** glossy black plastic (bezels, joints, toe caps) */
  const black = new THREE.MeshPhysicalMaterial({
    color: "#161618",
    roughness: 0.3,
    clearcoat: 0.8,
    clearcoatRoughness: 0.15,
  });
  /** matte black (servo bodies, rubber feet) */
  const rubber = new THREE.MeshStandardMaterial({ color: "#121213", roughness: 0.82, metalness: 0 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#070708",
    roughness: 0.06,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    metalness: 0.1,
  });
  const metal = new THREE.MeshStandardMaterial({ color: "#9a9894", roughness: 0.3, metalness: 0.9 });
  const lens = new THREE.MeshPhysicalMaterial({
    color: "#1b2233",
    roughness: 0.05,
    metalness: 0.3,
    clearcoat: 1,
    emissive: new THREE.Color("#2a3a66"),
    emissiveIntensity: 0.25,
  });
  const grille = new THREE.MeshStandardMaterial({ map: grilleTexture(), transparent: true, roughness: 0.55 });
  const letter = new THREE.MeshStandardMaterial({
    map: letterTexture(),
    transparent: true,
    roughness: 0.4,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });

  const tracked: THREE.BufferGeometry[] = [];
  /** register a geometry for disposal */
  const g = <T extends THREE.BufferGeometry>(geo: T) => {
    tracked.push(geo);
    return geo;
  };
  const rounded = (w: number, h: number, d: number, r: number, seg = 4) =>
    g(new RoundedBoxGeometry(w, h, d, seg, Math.min(r, Math.min(w, h, d) / 2 - 1e-4)));

  const mat = { cream, creamShade, orange, black, rubber, glass, metal, lens, grille, letter };

  /** a mesh with shadows-free defaults; raycasting off so it never steals the pointer */
  function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, parent?: THREE.Object3D) {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.raycast = () => null;
    parent?.add(o);
    return o;
  }

  /** little camera module: black housing, glass lens, faint blue glint (faces +Z) */
  function camera(parent: THREE.Object3D, x: number, y: number, z: number, r = 0.028) {
    const ring = mesh(g(new THREE.CylinderGeometry(r, r, 0.012, 24)), black, x, y, z, parent);
    ring.rotation.x = Math.PI / 2;
    const l = mesh(g(new THREE.SphereGeometry(r * 0.62, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2)), lens, x, y, z + 0.004, parent);
    l.rotation.x = Math.PI / 2;
    l.scale.y = 0.45;
    return ring;
  }

  /** four-dot diamond ("⁘") printed on a face, facing +Z */
  const dotGeo = g(new THREE.SphereGeometry(0.0085, 10, 8));
  function dots(parent: THREE.Object3D, x: number, y: number, z: number) {
    const s = 0.018;
    for (const [dx, dy] of [
      [0, s],
      [0, -s],
      [s, 0],
      [-s, 0],
    ]) {
      mesh(dotGeo, black, x + dx, y + dy, z, parent).scale.z = 0.5;
    }
  }

  return {
    mat,
    g,
    rounded,
    mesh,
    camera,
    dots,
    dispose() {
      tracked.forEach((geo) => geo.dispose());
      Object.values(mat).forEach((m) => {
        (m as THREE.MeshStandardMaterial).map?.dispose();
        m.dispose();
      });
    },
  };
}
