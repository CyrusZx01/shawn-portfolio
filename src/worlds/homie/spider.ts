import * as THREE from "three";
import type { Kit } from "./parts";
import type { Leg } from "./gait";

// SPIDER HOMIE · concept (poster, right): a low, wide cream shell with panel seams, a
// wide black face screen with a camera pod above it, the orange button and a black H on
// top; four legs, each black hip servo → cream thigh shell with an orange stripe → black
// knee servo → black shin → rubber foot, knees held high.

export const SPIDER_SCREEN = [0.5, 0.235] as const;
export const FEMUR = 0.44;
export const TIBIA = 0.6;
/** body-centre height when standing / lying on its belly */
export const STAND_Y = 0.58;
export const SIT_Y = 0.255;

export type SpiderRig = {
  /** walker: position + heading */
  root: THREE.Group;
  /** body: height, pitch and roll */
  core: THREE.Group;
  button: THREE.Mesh;
  face: THREE.Object3D;
  /** hip brackets (children of core, yawed towards their foot every frame) */
  hips: THREE.Group[];
  /** world-space leg segments (added at scene root) */
  legs: LegRig[];
  legGroup: THREE.Group;
};

export type LegRig = {
  hipServo: THREE.Object3D;
  femur: THREE.Object3D;
  knee: THREE.Object3D;
  tibia: THREE.Object3D;
  foot: THREE.Object3D;
  hipW: THREE.Vector3;
  kneeW: THREE.Vector3;
  hinge: THREE.Vector3;
  outward: THREE.Vector3;
};

export function buildSpider(kit: Kit, screenMat: THREE.Material, legs: Leg[]): SpiderRig {
  const { mat, rounded, mesh, g } = kit;
  const root = new THREE.Group();
  const core = new THREE.Group();
  root.add(core);

  // ── shell: cream top, dark seam, shaded belly ──
  const W = 1.0;
  const D = 0.86;
  mesh(rounded(W, 0.32, D, 0.15, 6), mat.cream, 0, 0.06, 0, core);
  mesh(rounded(W - 0.07, 0.06, D - 0.07, 0.025, 2), mat.rubber, 0, -0.1, 0, core);
  mesh(rounded(W - 0.08, 0.15, D - 0.08, 0.06, 4), mat.creamShade, 0, -0.17, 0, core);
  const top = 0.22;
  // panel seams across the top (front hood / rear hatch)
  const seam = g(new THREE.BoxGeometry(W - 0.26, 0.006, 0.008));
  mesh(seam, mat.rubber, 0, top - 0.001, 0.2, core);
  mesh(seam, mat.rubber, 0, top - 0.001, -0.27, core);
  const sideSeam = g(new THREE.BoxGeometry(0.008, 0.2, 0.006));
  for (const side of [1, -1]) {
    for (const z of [0.2, -0.27]) mesh(sideSeam, mat.rubber, side * (W / 2 - 0.001), 0.04, z, core);
  }

  // ── face: wide black glass screen + camera pod ──
  const fz = D / 2;
  mesh(rounded(0.6, 0.29, 0.1, 0.075, 5), mat.glass, 0, -0.04, fz - 0.042, core);
  const face = mesh(g(new THREE.PlaneGeometry(SPIDER_SCREEN[0], SPIDER_SCREEN[1])), screenMat, 0, -0.045, fz + 0.0085, core);
  mesh(rounded(0.13, 0.075, 0.09, 0.03, 3), mat.black, 0, 0.145, fz - 0.02, core);
  kit.camera(core, 0, 0.145, fz + 0.026, 0.022);

  // ── top: orange button, black H ──
  mesh(g(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 32)), mat.black, 0, top + 0.006, -0.08, core);
  const button = mesh(rounded(0.16, 0.05, 0.16, 0.024, 4), mat.orange, 0, top + 0.03, -0.08, core);
  const h = mesh(g(new THREE.PlaneGeometry(0.11, 0.11)), mat.letter, 0, top + 0.002, 0.1, core);
  h.rotation.x = -Math.PI / 2;

  // ── hip brackets (yaw with the leg) ──
  const bracket = rounded(0.16, 0.2, 0.15, 0.03, 3);
  const hips = legs.map((leg) => {
    const hip = new THREE.Group();
    hip.position.copy(leg.hip);
    core.add(hip);
    mesh(bracket, mat.rubber, 0, -0.02, 0, hip);
    mesh(rounded(0.1, 0.02, 0.12, 0.008, 2), mat.black, 0, 0.085, 0, hip);
    return hip;
  });

  // ── world-space legs ──
  const legGroup = new THREE.Group();
  const servo = g(new THREE.CylinderGeometry(0.075, 0.075, 0.2, 28));
  const screw = g(new THREE.CylinderGeometry(0.022, 0.022, 0.206, 12));
  const thighShell = rounded(0.17, FEMUR + 0.08, 0.14, 0.065, 5);
  thighShell.translate(0, FEMUR / 2, -0.02);
  const thighRib = rounded(0.1, FEMUR, 0.07, 0.02, 2);
  thighRib.translate(0, FEMUR / 2, 0.05);
  const stripe = rounded(0.01, 0.15, 0.024, 0.005, 2);
  const shinTop = rounded(0.11, TIBIA * 0.5, 0.1, 0.03, 3);
  shinTop.translate(0, TIBIA * 0.25, 0);
  const shinLow = rounded(0.075, TIBIA * 0.62, 0.075, 0.025, 3);
  shinLow.translate(0, TIBIA * 0.66, 0);
  const pad = g(new THREE.CylinderGeometry(0.06, 0.066, 0.08, 24));
  const padCap = g(new THREE.CylinderGeometry(0.045, 0.06, 0.03, 24));

  const segment = (build: (o: THREE.Group) => void) => {
    const o = new THREE.Group();
    build(o);
    legGroup.add(o);
    return o;
  };
  // servo cylinders run along local Y; they're pointed along the hinge at runtime
  const servoPart = () =>
    segment((o) => {
      mesh(servo, mat.rubber, 0, 0, 0, o);
      mesh(screw, mat.metal, 0, 0, 0, o);
    });

  const rigs: LegRig[] = legs.map(() => ({
    hipServo: servoPart(),
    femur: segment((o) => {
      mesh(thighShell, mat.cream, 0, 0, 0, o);
      mesh(thighRib, mat.rubber, 0, 0, 0, o);
      for (const s of [1, -1]) mesh(stripe, mat.orange, s * 0.086, FEMUR * 0.56, -0.025, o).rotation.x = 0.12;
    }),
    knee: servoPart(),
    tibia: segment((o) => {
      mesh(shinTop, mat.black, 0, 0, 0, o);
      mesh(shinLow, mat.black, 0, 0, 0, o);
    }),
    foot: segment((o) => {
      mesh(pad, mat.rubber, 0, 0.037, 0, o);
      mesh(padCap, mat.black, 0, 0.094, 0, o);
    }),
    hipW: new THREE.Vector3(),
    kneeW: new THREE.Vector3(),
    hinge: new THREE.Vector3(),
    outward: new THREE.Vector3(),
  }));

  return { root, core, button, face, hips, legs: rigs, legGroup };
}
