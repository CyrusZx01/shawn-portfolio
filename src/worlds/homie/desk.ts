import * as THREE from "three";
import type { Kit } from "./parts";

// HOMIE · desktop (poster, left): a big soft cream head that is almost all black glass
// face, orange-ringed ear discs and a pill button on top; a short black neck; a small
// speaker body with "⁘ – ⁘", a black H and a punched grille; stubby puck arms; and two
// chunky shoes with black toe caps. Standing height ≈ 1.45 units.

export const DESK_SCREEN = [0.56, 0.35] as const;

export type DeskRig = {
  root: THREE.Group;
  /** rotates with the gaze; pivot at the top of the neck */
  head: THREE.Group;
  button: THREE.Mesh;
  /** shoulder pivots, [right, left] (robot's own sides; right = +x) */
  arms: THREE.Group[];
  body: THREE.Group;
  /** anchor for the screen (for gaze projection) */
  face: THREE.Object3D;
};

export function buildDesk(kit: Kit, screenMat: THREE.Material): DeskRig {
  const { mat, rounded, mesh, g } = kit;
  const root = new THREE.Group();

  // ── shoes ──
  for (const side of [1, -1]) {
    const x = side * 0.175;
    mesh(rounded(0.29, 0.19, 0.44, 0.09, 5), mat.cream, x, 0.095, -0.01, root);
    mesh(rounded(0.3, 0.14, 0.2, 0.068, 5), mat.black, x, 0.1, 0.13, root);
    // orange tab on the outer heel
    mesh(rounded(0.012, 0.075, 0.03, 0.006, 2), mat.orange, x + side * 0.142, 0.12, -0.1, root);
  }

  // ── body ──
  const body = new THREE.Group();
  body.position.set(0, 0.44, 0);
  root.add(body);
  const BW = 0.64;
  const BD = 0.5;
  mesh(rounded(BW, 0.5, BD, 0.13, 5), mat.cream, 0, 0, 0, body);
  const front = BD / 2;
  mesh(rounded(0.095, 0.032, 0.03, 0.015, 2), mat.orange, 0, 0.14, front - 0.004, body);
  kit.dots(body, -0.125, 0.14, front - 0.002);
  kit.dots(body, 0.125, 0.14, front - 0.002);
  mesh(g(new THREE.PlaneGeometry(0.1, 0.1)), mat.letter, 0.13, 0.045, front + 0.001, body);
  mesh(rounded(0.44, 0.15, 0.05, 0.03, 3), mat.black, 0, -0.1, front - 0.012, body);
  mesh(g(new THREE.PlaneGeometry(0.42, 0.135)), mat.grille, 0, -0.1, front + 0.0135, body);

  // ── puck arms: cream stub with a black joint face and an orange ring ──
  const arms: THREE.Group[] = [];
  const armBody = g(new THREE.CapsuleGeometry(0.08, 0.06, 6, 20));
  const armFace = g(new THREE.CylinderGeometry(0.058, 0.058, 0.03, 28));
  const armRing = g(new THREE.CylinderGeometry(0.07, 0.07, 0.014, 28));
  const shoulder = g(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 24));
  for (const side of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * (BW / 2 - 0.01), 0.07, 0);
    body.add(pivot);
    mesh(shoulder, mat.black, side * 0.02, 0, 0, pivot).rotation.z = Math.PI / 2;
    const arm = new THREE.Group();
    arm.position.set(side * 0.085, -0.07, 0);
    arm.rotation.z = side * 0.18;
    pivot.add(arm);
    mesh(armBody, mat.cream, 0, 0, 0, arm).scale.set(0.95, 1, 0.9);
    mesh(armRing, mat.orange, side * 0.068, -0.01, 0, arm).rotation.z = Math.PI / 2;
    mesh(armFace, mat.black, side * 0.08, -0.01, 0, arm).rotation.z = Math.PI / 2;
    arms.push(pivot);
  }

  // ── neck ──
  mesh(g(new THREE.CylinderGeometry(0.15, 0.17, 0.1, 32)), mat.black, 0, 0.735, 0, root);

  // ── head ──
  const head = new THREE.Group();
  head.position.set(0, 0.755, 0);
  root.add(head);
  const HW = 1.0;
  const HH = 0.66;
  const HD = 0.74;
  const hy = HH / 2 + 0.01;
  mesh(rounded(HW, HH, HD, 0.2, 6), mat.cream, 0, hy, 0, head);
  // glossy black face: nearly the whole front
  const hz = HD / 2;
  mesh(rounded(0.78, 0.51, 0.1, 0.09, 5), mat.glass, 0, hy - 0.01, hz - 0.042, head);
  const face = mesh(g(new THREE.PlaneGeometry(DESK_SCREEN[0], DESK_SCREEN[1])), screenMat, 0, hy - 0.03, hz + 0.0085, head);
  kit.camera(head, 0, hy + 0.2, hz + 0.009, 0.022);
  // ears: black disc on an orange flange
  const earDisc = g(new THREE.CylinderGeometry(0.115, 0.115, 0.07, 36));
  const earRing = g(new THREE.CylinderGeometry(0.132, 0.132, 0.03, 36));
  for (const side of [1, -1]) {
    mesh(earRing, mat.orange, side * (HW / 2 - 0.005), hy - 0.02, -0.02, head).rotation.z = Math.PI / 2;
    mesh(earDisc, mat.black, side * (HW / 2 + 0.022), hy - 0.02, -0.02, head).rotation.z = Math.PI / 2;
  }
  // pill button on a black base
  mesh(rounded(0.25, 0.04, 0.13, 0.02, 3), mat.black, 0, hy + HH / 2 + 0.008, -0.02, head);
  const button = mesh(rounded(0.2, 0.06, 0.1, 0.03, 4), mat.orange, 0, hy + HH / 2 + 0.035, -0.02, head);

  return { root, head, button, arms, body, face };
}
