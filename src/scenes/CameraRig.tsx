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
import { worlds, worldOrigin } from "@/worlds";
import type { WorldCamera } from "@/worlds/types";

/** World-space point the depth-of-field effect focuses on; written here, read by Effects. */
export const focusTarget = new THREE.Vector3(0, 0.55, 0);

const UP = new THREE.Vector3(0, 1, 0);

/** Drives the R3F camera:
 *  - hero/chapter: the GLB's own `CameraAction`, scrubbed by scroll
 *  - projects: fly to the sticker, push into it (the DOM cover opens from its
 *    screen position), then cut to the project's world and follow its story camera
 *  - outro: a wide frontal pose. */
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
  const mode = useRef<"bust" | number>("bust");
  const s = useMemo(
    () => ({
      pose: { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() },
      world: { position: new THREE.Vector3(), target: new THREE.Vector3() } as WorldCamera,
      origin: new THREE.Vector3(),
      offset: new THREE.Vector3(),
      right: new THREE.Vector3(),
      up: new THREE.Vector3(),
      m: new THREE.Matrix4(),
      screen: new THREE.Vector3(),
      worldP: 0,
      orbitYaw: 0,
      orbitPitch: 0,
    }),
    [],
  );
  const decalByName = useMemo(() => new Map(decals.map((d) => [d.name, d])), [decals]);
  const outroQuat = useMemo(() => {
    const m = new THREE.Matrix4().lookAt(OUTRO_POSE.position, OUTRO_POSE.target, camera.up);
    return new THREE.Quaternion().setFromRotationMatrix(m);
  }, [camera]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const aspect = size.width / size.height;
    const portrait = aspect < 1;
    const { pose } = s;

    // Keep the subject's width on screen when the viewport is narrower than the 46° design frame.
    const fov = portrait ? Math.min(72, GLB_FOV * (1 + (1 - aspect) * 0.9)) : GLB_FOV;
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    path.current = THREE.MathUtils.damp(path.current, scroll.path, DAMP.path, dt);
    mixer.setTime(path.current * CAMERA_ACTION_ACTIVE);
    glbCamera.updateMatrix();

    const { stage, active, phase } = getUi();
    const inWorld = stage === "projects" && active >= 0 && phase === "world";
    const nextMode = inWorld ? active : "bust";
    // Mode switches always happen under a full cover, so jump instead of flying.
    const cut = nextMode !== mode.current;
    mode.current = nextMode;

    let rate = DAMP.path;
    if (inWorld) {
      const def = worlds[active];
      worldOrigin(active, s.origin);
      s.worldP = cut ? scroll.world : THREE.MathUtils.damp(s.worldP, scroll.world, 7, dt);
      def.camera(s.worldP, state.clock.elapsedTime, s.world);

      // Pointer parallax + drag orbit around the story target. Drag eases home when released.
      if (!scroll.dragging) {
        scroll.dragYaw = THREE.MathUtils.damp(scroll.dragYaw, 0, 1.2, dt);
        scroll.dragPitch = THREE.MathUtils.damp(scroll.dragPitch, 0, 1.2, dt);
      }
      const yaw = scroll.dragYaw + (scroll.pointerSeen ? -scroll.pointerX * 0.1 : 0);
      const pitch = scroll.dragPitch + (scroll.pointerSeen ? -scroll.pointerY * 0.05 : 0);
      s.orbitYaw = cut ? yaw : THREE.MathUtils.damp(s.orbitYaw, yaw, 5, dt);
      s.orbitPitch = cut ? pitch : THREE.MathUtils.damp(s.orbitPitch, pitch, 5, dt);
      s.offset.subVectors(s.world.position, s.world.target);
      s.right.crossVectors(UP, s.offset).normalize();
      s.offset.applyAxisAngle(UP, s.orbitYaw).applyAxisAngle(s.right.applyAxisAngle(UP, s.orbitYaw), s.orbitPitch);
      pose.position.copy(s.world.target).add(s.offset).add(s.origin);
      s.m.lookAt(pose.position, s.offset.set(0, 0, 0).add(s.world.target).add(s.origin), UP);
      pose.quaternion.setFromRotationMatrix(s.m);

      // Frame the subject right of centre (landscape) or in the top half (portrait): the card owns the rest.
      const dist = s.world.position.distanceTo(s.world.target);
      const halfH = dist * Math.tan(THREE.MathUtils.degToRad(fov / 2));
      s.right.set(1, 0, 0).applyQuaternion(pose.quaternion);
      s.up.set(0, 1, 0).applyQuaternion(pose.quaternion);
      if (portrait) pose.position.addScaledVector(s.up, -0.3 * halfH);
      else pose.position.addScaledVector(s.right, -0.24 * halfH * aspect);

      focusTarget.copy(s.world.target).add(s.origin);
      rate = 9;
    } else if (stage === "projects" && active >= 0) {
      const d = decalByName.get(projects[active].decal)!;
      decalPose(d.center, aspect, pose);
      // Dive: push through the sticker. The cover circle hides the moment we'd clip into the skin.
      if (scroll.dive > 0) {
        s.offset.subVectors(pose.position, d.center);
        pose.position.copy(d.center).addScaledVector(s.offset, 1 - 0.72 * scroll.dive);
      }
      focusTarget.copy(d.center);
      rate = phase === "dive" ? 7 : DAMP.stop;
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
        s.right.set(1, 0, 0).applyQuaternion(pose.quaternion);
        pose.position.addScaledVector(s.right, 0.55 * (1 - path.current));
        pose.position.z += 0.9;
        pose.position.y -= 0.35;
      }
      focusTarget.set(0, 0.55, 0);
    }

    if (first.current || cut) {
      camera.position.copy(pose.position);
      camera.quaternion.copy(pose.quaternion);
      first.current = false;
    } else {
      const k = 1 - Math.exp(-rate * dt);
      camera.position.lerp(pose.position, k);
      camera.quaternion.slerp(pose.quaternion, k);
    }

    // Where the dive circle grows from: the active sticker on screen.
    if (stage === "projects" && active >= 0 && !inWorld) {
      camera.updateMatrixWorld();
      const d = decalByName.get(projects[active].decal)!;
      s.screen.copy(d.center).project(camera);
      scroll.coverX = (s.screen.x * 0.5 + 0.5) * size.width;
      scroll.coverY = (-s.screen.y * 0.5 + 0.5) * size.height;
    }
  });

  return null;
}
