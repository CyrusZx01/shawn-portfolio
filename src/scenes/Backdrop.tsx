"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { createBackdropMaterial } from "@/shaders/backdrop";
import { getUi } from "@/animations/store";
import { projects } from "@/sections/content";

export function Backdrop() {
  const material = useMemo(createBackdropMaterial, []);
  const size = useThree((s) => s.size);
  const white = useMemo(() => new THREE.Color("#ffffff"), []);
  const tint = useMemo(() => new THREE.Color(), []);

  useFrame((state, dt) => {
    const u = material.uniforms;
    u.uAspect.value = size.width / size.height;
    u.uTime.value = state.clock.elapsedTime;
    const { stage, active } = getUi();
    const on = stage === "projects" && active >= 0;
    // A faint halo in the project's accent colour replaces the flat studio grey.
    tint.set(on ? projects[active].accent : "#ffffff");
    (u.uGlow.value as THREE.Color).lerp(on ? tint : white, 1 - Math.exp(-3 * dt));
    u.uGlowStrength.value = THREE.MathUtils.damp(u.uGlowStrength.value, on ? 0.05 : 0.006, 3, dt);
    (u.uGlowPos.value as THREE.Vector2).lerp(
      on ? new THREE.Vector2(0.66, 0.55) : new THREE.Vector2(0.62, 0.5),
      1 - Math.exp(-3 * dt),
    );
  });

  return (
    <mesh frustumCulled={false} renderOrder={-1000} raycast={() => null}>
      <planeGeometry args={[2, 2]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
