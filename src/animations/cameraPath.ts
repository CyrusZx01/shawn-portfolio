import * as THREE from "three";

// Facts from portfolio.glb (see docs/CONTEXT.md §3).
export const GLB_FOV = THREE.MathUtils.radToDeg(0.8028514559173916); // 46°
/** CameraAction keys are identical from key 50 (t = 2.0833 s) on — skip the dead half. */
export const CAMERA_ACTION_ACTIVE = 50 / 24;

/** Exponential damping rates (per second) for the camera rig. */
export const DAMP = {
  path: 6,
  stop: 2.6,
  pointer: 3,
};

/** Returns a camera pose that frames a decal close-up, with the sticker pushed
 * right of centre so the project copy on the left stays readable. */
export function decalPose(
  center: THREE.Vector3,
  aspect: number,
  out: { position: THREE.Vector3; quaternion: THREE.Quaternion },
) {
  // Stickers sit on the front of the face/neck; lean the view toward the side they're on.
  const dir = new THREE.Vector3(center.x * 1.6 + 0.12, 0.08, 1).normalize();
  const portrait = aspect < 1;
  const distance = portrait ? 1.05 : 0.72;
  out.position.copy(center).addScaledVector(dir, distance);

  const look = new THREE.Matrix4().lookAt(out.position, center, new THREE.Vector3(0, 1, 0));
  out.quaternion.setFromRotationMatrix(look);

  // Pan the view so the sticker lands at ~65% of the width (desktop) or upper third (portrait).
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(out.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(out.quaternion);
  if (portrait) out.position.addScaledVector(up, -0.12);
  else out.position.addScaledVector(right, -0.17);
  return out;
}

/** Wide frontal pose used for the outro / contact section. */
export const OUTRO_POSE = {
  position: new THREE.Vector3(0, 0.55, 3.1),
  target: new THREE.Vector3(0, 0.35, 0),
};
