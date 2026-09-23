import * as THREE from "three";
import { projects } from "@/sections/content";
import type { WorldDef } from "./types";
import { homieWorld } from "./homie/HomieWorld";
import { drivingWorld } from "./driving/DrivingWorld";
import { medicalWorld } from "./medical/MedicalWorld";
import { jevWorld } from "./jev/JevWorld";
import { weatherWorld } from "./weather/WeatherWorld";

const byId: Record<string, WorldDef> = {
  homie: homieWorld,
  driving: drivingWorld,
  medical: medicalWorld,
  jev: jevWorld,
  weather: weatherWorld,
};

/** Worlds in the same order as `projects`. */
export const worlds: WorldDef[] = projects.map((p) => byId[p.id]);

/** Worlds live far from the bust (and each other) in the one shared scene. */
export function worldOrigin(index: number, out = new THREE.Vector3()) {
  return out.set(60 * (index + 1), 0, 0);
}

/** Current step for story progress p. */
export function stepAt(def: WorldDef, p: number) {
  let s = 0;
  def.steps.forEach((st, i) => {
    if (p >= st.at) s = i;
  });
  return s;
}
