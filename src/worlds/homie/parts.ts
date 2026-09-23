import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

// Homie's kit of parts: materials, geometries and canvas textures, built once and shared.
// Dimensions follow the poster: boxy screen head, speaker body, black-toed feet.

export const ACCENT = "#f08a3c";
export const SCREEN_YELLOW = "#ffc93c";

export const DIM = {
  head: [1.0, 0.72, 0.66] as const,
  screen: [0.8, 0.5] as const,
  body: [0.84, 0.66, 0.56] as const,
  foot: [0.26, 0.12, 0.4] as const,
  femur: 0.6,
  tibia: 0.76,
};

export type Kit = ReturnType<typeof createKit>;

function rounded(w: number, h: number, d: number, r: number, seg = 4) {
  return new RoundedBoxGeometry(w, h, d, seg, r);
}

/** Hole pattern for the speaker grille (dark dots on transparent). */
function grilleTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 320;
  const ctx = c.getContext("2d")!;
  const cols = 17;
  const rows = 10;
  const sx = c.width / cols;
  const sy = c.height / rows;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = (i + 0.5 + (j % 2 ? 0.25 : -0.25)) * sx;
      const y = (j + 0.5) * sy;
      // round the pattern's corners like a rounded rect
      const nx = (x / c.width) * 2 - 1;
      const ny = (y / c.height) * 2 - 1;
      if (Math.pow(Math.abs(nx), 6) + Math.pow(Math.abs(ny), 6) > 0.92) continue;
      ctx.beginPath();
      ctx.arc(x, y, sx * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(24,22,21,0.92)";
      ctx.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** The "H" mark: orange rounded tile with a cream H. */
function logoTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.roundRect(8, 8, 240, 240, 64);
  ctx.fill();
  ctx.fillStyle = "#f6f1e8";
  const bar = 40;
  ctx.fillRect(66, 62, bar, 132);
  ctx.fillRect(150, 62, bar, 132);
  ctx.fillRect(66, 108, 124, bar);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function createKit() {
  const cream = new THREE.MeshPhysicalMaterial({
    color: "#efe9de",
    roughness: 0.46,
    clearcoat: 0.55,
    clearcoatRoughness: 0.28,
    sheen: 0.2,
    sheenColor: new THREE.Color("#fff6ea"),
  });
  const creamShade = new THREE.MeshPhysicalMaterial({
    color: "#ddd5c8",
    roughness: 0.5,
    clearcoat: 0.3,
    clearcoatRoughness: 0.35,
  });
  const orange = new THREE.MeshPhysicalMaterial({
    color: ACCENT,
    roughness: 0.34,
    clearcoat: 0.6,
    clearcoatRoughness: 0.2,
    emissive: new THREE.Color(ACCENT),
    emissiveIntensity: 0,
  });
  const black = new THREE.MeshStandardMaterial({ color: "#19191b", roughness: 0.48, metalness: 0.15 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#0a0a0b",
    roughness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    metalness: 0.2,
  });
  const grille = new THREE.MeshStandardMaterial({
    map: grilleTexture(),
    transparent: true,
    roughness: 0.6,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const logo = new THREE.MeshStandardMaterial({
    map: logoTexture(),
    transparent: true,
    roughness: 0.4,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });

  const [hw, hh, hd] = DIM.head;
  const [bw, bh, bd] = DIM.body;
  const [fw, fh, fd] = DIM.foot;

  const femur = rounded(0.13, DIM.femur, 0.16, 0.055, 3);
  femur.translate(0, DIM.femur / 2, 0);
  const tibia = new THREE.CylinderGeometry(0.036, 0.066, DIM.tibia, 16, 1);
  tibia.translate(0, DIM.tibia / 2, 0);
  const tibiaCuff = new THREE.CylinderGeometry(0.074, 0.074, 0.07, 20);
  tibiaCuff.translate(0, 0.11, 0);

  const geo = {
    head: rounded(hw, hh, hd, 0.13, 5),
    bezel: rounded(DIM.screen[0] + 0.08, DIM.screen[1] + 0.08, 0.04, 0.05, 3),
    screen: new THREE.PlaneGeometry(DIM.screen[0], DIM.screen[1]),
    button: new THREE.CylinderGeometry(0.085, 0.09, 0.05, 28),
    buttonBase: new THREE.CylinderGeometry(0.11, 0.11, 0.02, 28),
    ledStrip: rounded(0.34, 0.025, 0.03, 0.012, 2),
    logo: new THREE.PlaneGeometry(0.2, 0.2),
    bodyUpper: rounded(bw, bh * 0.62, bd, 0.11, 5),
    bodyLower: rounded(bw * 0.97, bh * 0.36, bd * 0.97, 0.09, 4),
    bodyCore: new THREE.BoxGeometry(bw * 0.9, bh * 0.1, bd * 0.88),
    grille: new THREE.PlaneGeometry(0.56, 0.35),
    sideStrip: rounded(0.02, 0.05, 0.3, 0.01, 2),
    neck: new THREE.CylinderGeometry(0.12, 0.14, 0.1, 24),
    foot: rounded(fw, fh, fd, 0.05, 3),
    toe: rounded(fw * 1.02, fh * 1.02, 0.12, 0.05, 3),
    femur,
    tibia,
    tibiaCuff,
    knee: new THREE.CylinderGeometry(0.085, 0.085, 0.17, 24),
    kneeCap: new THREE.CylinderGeometry(0.038, 0.038, 0.175, 16),
    hip: new THREE.CylinderGeometry(0.1, 0.11, 0.16, 24),
    hipCap: new THREE.CylinderGeometry(0.06, 0.06, 0.02, 20),
    toeTip: new THREE.SphereGeometry(0.066, 18, 14),
  };

  const mat = { cream, creamShade, orange, black, glass, grille, logo };
  return {
    mat,
    geo,
    dispose() {
      Object.values(geo).forEach((g) => g.dispose());
      Object.values(mat).forEach((m) => {
        (m as THREE.MeshStandardMaterial).map?.dispose();
        m.dispose();
      });
    },
  };
}
