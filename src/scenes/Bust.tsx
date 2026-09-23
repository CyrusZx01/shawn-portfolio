"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { usePortfolioModel } from "@/models/usePortfolioModel";
import { scroll, setUi, getUi } from "@/animations/store";
import { projects } from "@/sections/content";
import { scrollToProject } from "@/animations/scrollTo";
import {
  EYE_MID,
  REST_DIR,
  createLookUniforms,
  headMatrix,
  headWeight,
  patchLookMaterial,
} from "@/shaders/bustLook";

const damp = THREE.MathUtils.damp;
const clamp = THREE.MathUtils.clamp;

// One set of uniforms for every bust material (skin + stickers), so the whole head turns as one.
const look = createLookUniforms();
const patched = new WeakSet<THREE.Material>();

/** How much the bust follows the cursor in each stage. */
const LOOK_STRENGTH = { hero: 1, chapter: 0.8, projects: 0.15, outro: 1 } as const;

const REST_YAW = Math.atan2(REST_DIR.x, REST_DIR.z);
const REST_PITCH = Math.asin(REST_DIR.y);

/** The bust from portfolio.glb. Its head and eyes follow the cursor, it blinks,
 * and every sticker is a hotspot that glows on hover and dives into its project. */
export function Bust() {
  const { model, decals } = usePortfolioModel();
  const group = useRef<THREE.Group>(null);

  const skin = useMemo(() => model.getObjectByName("Mesh_0") as THREE.Mesh, [model]);

  const projectByDecal = useMemo(() => {
    const map = new Map<string, number>();
    projects.forEach((p, i) => map.set(p.decal, i));
    return map;
  }, []);

  // Patch materials once; teach sticker raycasts about the head turn.
  useEffect(() => {
    const skinMat = skin.material as THREE.MeshStandardMaterial;
    if (!patched.has(skinMat)) {
      patchLookMaterial(skinMat, look, new THREE.Matrix4(), true);
      patched.add(skinMat);
    }
    const restore: (() => void)[] = [];
    for (const d of decals) {
      if (!patched.has(d.material)) {
        patchLookMaterial(d.material, look, d.mesh.matrix, false);
        patched.add(d.material);
      }
      // Stickers are small, so one head weight per sticker is exact enough for picking.
      d.mesh.geometry.computeBoundingBox();
      const c = d.mesh.geometry.boundingBox!.getCenter(new THREE.Vector3()).applyMatrix4(d.mesh.matrix);
      const w = headWeight(c);
      const m = new THREE.Matrix4();
      const saved = new THREE.Matrix4();
      const raycast = d.mesh.raycast;
      d.mesh.raycast = function (raycaster, intersects) {
        saved.copy(this.matrixWorld);
        headMatrix(look.uYaw.value, look.uPitch.value, w, m);
        this.matrixWorld.copy(skin.matrixWorld).multiply(m).multiply(this.matrix);
        THREE.Mesh.prototype.raycast.call(this, raycaster, intersects);
        this.matrixWorld.copy(saved);
      };
      restore.push(() => void (d.mesh.raycast = raycast));
    }
    return () => {
      restore.forEach((r) => r());
      document.body.style.cursor = "";
    };
  }, [skin, decals]);

  const tmp = useMemo(
    () => ({
      ndc: new THREE.Vector3(),
      head: new THREE.Vector3(),
      target: new THREE.Vector3(),
      inv: new THREE.Matrix4(),
      yaw: 0,
      pitch: 0,
      eyeYaw: 0,
      eyePitch: 0,
      nextBlink: 1.5,
      blinkStart: -1,
      double: false,
    }),
    [],
  );

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const { stage, phase, active, hovered } = getUi();
    g.visible = scroll.compiling || !(stage === "projects" && phase === "world");
    if (!g.visible) return;

    const t = state.clock.elapsedTime;
    const cam = state.camera;

    // ── gaze target: a point along the pointer ray, or the viewer when there is no pointer
    tmp.head.copy(EYE_MID).applyMatrix4(skin.matrixWorld);
    if (scroll.pointerSeen) {
      tmp.ndc.set(scroll.pointerX, -scroll.pointerY, 0.5).unproject(cam).sub(cam.position).normalize();
      tmp.target.copy(cam.position).addScaledVector(tmp.ndc, cam.position.distanceTo(tmp.head) * 0.75);
    } else {
      tmp.target.copy(cam.position);
    }
    tmp.inv.copy(skin.matrixWorld).invert();
    tmp.target.applyMatrix4(tmp.inv).sub(EYE_MID);
    const k = LOOK_STRENGTH[stage];
    const yaw = (Math.atan2(tmp.target.x, tmp.target.z) - REST_YAW) * k;
    const pitch = (Math.atan2(tmp.target.y, Math.hypot(tmp.target.x, tmp.target.z)) - REST_PITCH) * k;

    // Head takes a share of the turn (slow, heavy); eyes take the rest (quick, like saccades).
    const headYaw = clamp(yaw * 0.55, -0.45, 0.45);
    const headPitch = clamp(pitch * 0.55, -0.3, 0.3);
    tmp.yaw = damp(tmp.yaw, headYaw, 3.2, dt);
    tmp.pitch = damp(tmp.pitch, headPitch, 3.2, dt);
    tmp.eyeYaw = damp(tmp.eyeYaw, yaw - tmp.yaw, 14, dt);
    tmp.eyePitch = damp(tmp.eyePitch, pitch - tmp.pitch, 14, dt);
    // a touch of idle sway so it never looks frozen
    look.uYaw.value = tmp.yaw + Math.sin(t * 0.37) * 0.015;
    look.uPitch.value = tmp.pitch + Math.sin(t * 0.53 + 1) * 0.01;
    look.uEyeU.value = clamp(tmp.eyeYaw * 0.05, -0.025, 0.025);
    look.uEyeV.value = clamp(tmp.eyePitch * 0.02, -0.006, 0.006);

    // ── blinking: every 2.5–6 s, sometimes twice
    if (tmp.blinkStart < 0 && t > tmp.nextBlink) tmp.blinkStart = t;
    if (tmp.blinkStart >= 0) {
      const b = (t - tmp.blinkStart) / 0.16;
      look.uBlink.value = b < 1 ? Math.sin(b * Math.PI) : 0;
      if (b >= 1) {
        tmp.blinkStart = -1;
        tmp.double = !tmp.double && Math.random() < 0.25;
        tmp.nextBlink = t + (tmp.double ? 0.12 : 2.5 + Math.random() * 3.5);
      }
    }

    for (const d of decals) {
      const i = projectByDecal.get(d.name) ?? -1;
      const isActive = i === active;
      const isHover = i === hovered;
      // Idle breathing shimmer so visitors discover the stickers are interactive.
      const idle = stage === "chapter" ? 0.06 + 0.06 * Math.sin(t * 2.2 + i * 1.3) : 0;
      const target = isActive ? 0.28 : isHover ? 0.45 : idle;
      d.material.emissiveIntensity = damp(d.material.emissiveIntensity, target, 8, dt);
    }
  });

  const decalIndex = (e: ThreeEvent<PointerEvent | MouseEvent>) =>
    projectByDecal.get(e.object.name) ?? -1;

  return (
    <group ref={group}>
      <primitive
        object={model}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          const i = decalIndex(e);
          e.stopPropagation();
          setUi({ hovered: i });
          document.body.style.cursor = i >= 0 ? "pointer" : "";
        }}
        onPointerOut={() => {
          setUi({ hovered: -1 });
          document.body.style.cursor = "";
        }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          const i = decalIndex(e);
          if (i < 0) return;
          e.stopPropagation();
          scrollToProject(i);
        }}
      />
    </group>
  );
}
