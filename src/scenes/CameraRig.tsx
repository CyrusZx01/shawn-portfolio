"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { usePortfolioModel } from "@/models/usePortfolioModel";
import { scroll, getUi } from "@/animations/store";
import {
  CAMERA_ACTION_ACTIVE,
  DAMP,
  GLB_FOV,
  OUTRO_POSE,
  decalPose,
} from "@/animations/cameraPath";
import { projects } from "@/sections/content";

/** World-space point the depth-of-field effect focuses on; written here, read by Effects. */
export const focusTarget = new THREE.Vector3(0, 0.55, 0);

/** Drives the R3F camera from the GLB's own `CameraAction`, scrubbed by scroll,
 * then hands off to designed stops (sticker close-ups, outro). */
export function CameraRig() {
  const { root, camera: glbCamera, clip, decals } = usePortfolioModel();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);

  const mixer = useMemo(() => new THREE.AnimationMixer(root), [root]);
  useEffect(() => {
    const action = mixer.clipAction(clip);
    action.play();
    mixer.setTime(0);
    return () => {
      action.stop();
      mixer.uncacheRoot(root);
    };
  }, [mixer, clip, root]);

  const path = useRef(0);
  const first = useRef(true);
  const pose = useMemo(
    () => ({ position: new THREE.Vector3(), quaternion: new THREE.Quaternion() }),
    [],
  );
  const decalByName = useMemo(() => new Map(decals.map((d) => [d.name, d])), [decals]);
  const outroQuat = useMemo(() => {
    const m = new THREE.Matrix4().lookAt(OUTRO_POSE.position, OUTRO_POSE.target, camera.up);
    return new THREE.Quaternion().setFromRotationMatrix(m);
  }, [camera]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const aspect = size.width / size.height;
    const portrait = aspect < 1;

    // Keep the bust's width on screen when the viewport is narrower than the 46° design frame.
    const fov = portrait ? Math.min(72, GLB_FOV * (1 + (1 - aspect) * 0.9)) : GLB_FOV;
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    path.current = THREE.MathUtils.damp(path.current, scroll.path, DAMP.path, dt);
    mixer.setTime(path.current * CAMERA_ACTION_ACTIVE);
    glbCamera.updateMatrix();

    const { stage, active } = getUi();
    let rate = DAMP.path;
    if (stage === "projects" && active >= 0) {
      const d = decalByName.get(projects[active].decal)!;
      decalPose(d.center, aspect, pose);
      focusTarget.copy(d.center);
      rate = DAMP.stop;
    } else if (stage === "outro") {
      pose.position.copy(OUTRO_POSE.position);
      pose.quaternion.copy(outroQuat);
      focusTarget.copy(OUTRO_POSE.target);
      rate = DAMP.stop;
    } else {
      pose.position.copy(glbCamera.position);
      pose.quaternion.copy(glbCamera.quaternion);
      // The authored hero frame puts the bust right of centre; on portrait screens that
      // pushes it off-canvas, so slide the camera over while the hero is showing.
      if (portrait) {
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(pose.quaternion);
        pose.position.addScaledVector(right, 0.55 * (1 - path.current));
        pose.position.z += 0.9;
        pose.position.y -= 0.35;
      }
      focusTarget.set(0, 0.55, 0);
    }

    if (first.current) {
      camera.position.copy(pose.position);
      camera.quaternion.copy(pose.quaternion);
      first.current = false;
      return;
    }
    const k = 1 - Math.exp(-rate * dt);
    camera.position.lerp(pose.position, k);
    camera.quaternion.slerp(pose.quaternion, k);
  });

  return null;
}
