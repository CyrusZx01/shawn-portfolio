"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { worldActive } from "@/animations/store";
import { worlds, worldOrigin } from "@/worlds";

function WorldSlot({ index }: { index: number }) {
  const group = useRef<THREE.Group>(null);
  const World = worlds[index].Component;
  // Runs before the worlds' own frames (lower priority first), so hidden worlds cost nothing to draw.
  useFrame(() => {
    if (group.current) group.current.visible = worldActive(index);
  }, -1);
  return (
    <group ref={group} name="world-slot" position={worldOrigin(index).toArray()} visible={false}>
      <World index={index} />
    </group>
  );
}

/** Every project world lives in the same scene, far from the bust and from each
 * other; only the active one is visible. */
export function Worlds() {
  return (
    <>
      {worlds.map((w, i) => (
        <WorldSlot key={w.id} index={i} />
      ))}
    </>
  );
}
