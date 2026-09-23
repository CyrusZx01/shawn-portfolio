"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { getUi } from "@/animations/store";
import { projects } from "@/sections/content";

/** Soft studio light matching the reference: large diffuse key from front-left,
 * dim fill, cool top. Built from local Lightformers, so no HDR download. */
export function Lighting() {
  const rim = useRef<THREE.PointLight>(null);
  const tint = useMemo(() => new THREE.Color(), []);

  useFrame((_, dt) => {
    const r = rim.current;
    if (!r) return;
    const { stage, active } = getUi();
    const on = stage === "projects" && active >= 0;
    tint.set(on ? projects[active].accent : "#ffffff");
    r.color.lerp(tint, 1 - Math.exp(-3 * dt));
    r.intensity = THREE.MathUtils.damp(r.intensity, on ? 6 : 0.8, 3, dt);
  });

  return (
    <>
      <ambientLight intensity={0.15} />
      <directionalLight position={[-2.5, 3, 3.5]} intensity={1.6} color="#fff4ea" />
      <directionalLight position={[3, 1, 2]} intensity={0.35} color="#dfe8ff" />
      {/* Accent rim from behind — shifts to the active project's colour. */}
      <pointLight ref={rim} position={[1.4, 1.2, -1.6]} intensity={0.8} distance={6} />
      <Environment resolution={256} frames={1}>
        <color attach="background" args={["#141414"]} />
        <Lightformer form="rect" intensity={2.2} position={[-3, 2.5, 4]} scale={[5, 4, 1]} target={[0, 0.4, 0]} />
        <Lightformer form="rect" intensity={0.7} position={[4, 1, 3]} scale={[3, 3, 1]} target={[0, 0.4, 0]} />
        <Lightformer form="rect" intensity={1.2} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[6, 6, 1]} />
        <Lightformer form="rect" intensity={0.4} position={[0, 1, -4]} scale={[6, 3, 1]} target={[0, 0.4, 0]} />
      </Environment>
    </>
  );
}
