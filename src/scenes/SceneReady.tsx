"use client";

import { useEffect } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { scroll, setUi } from "@/animations/store";

/** Mounted inside the Suspense boundary: flips `loaded` once the GLB is in and
 * shaders are compiled, so the loading screen never reveals a half-built frame. */
export function SceneReady() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    // Compile every world too (they start hidden) so the first dive doesn't hitch.
    scroll.compiling = true;
    const slots: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if (o.name === "world-slot") slots.push(o);
    });
    slots.forEach((o) => (o.visible = true));
    gl.compile(scene, camera);
    slots.forEach((o) => (o.visible = false));
    scroll.compiling = false;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setUi({ loaded: true })));
    return () => cancelAnimationFrame(id);
  }, [gl, scene, camera]);

  return null;
}
