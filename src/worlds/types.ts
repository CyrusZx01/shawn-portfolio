import type { ComponentType } from "react";
import type * as THREE from "three";

/** Camera pose in the world's *local* space (the rig adds the world origin,
 * pointer parallax, drag orbit and the "subject sits right of the card" shift). */
export type WorldCamera = {
  position: THREE.Vector3;
  target: THREE.Vector3;
};

export type WorldStep = {
  /** story progress (0..1) at which this step becomes current */
  at: number;
  label: string;
  caption: string;
};

export type WorldDef = {
  /** matches `projects[i].id` */
  id: string;
  steps: WorldStep[];
  /** write the camera pose for story progress `p` (0..1) and elapsed time `t` (s) */
  camera: (p: number, t: number, out: WorldCamera) => void;
  /** rendered at the world's local origin; reads `scroll.world` for story progress */
  Component: ComponentType<{ index: number }>;
};
