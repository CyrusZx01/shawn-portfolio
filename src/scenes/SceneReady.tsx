"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { setUi } from "@/animations/store";

/** Mounted inside the Suspense boundary: flips `loaded` once the GLB is in and
 * shaders are compiled, so the loading screen never reveals a half-built frame. */
export function SceneReady() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    gl.compile(scene, camera);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setUi({ loaded: true })));
    return () => cancelAnimationFrame(id);
  }, [gl, scene, camera]);

  return null;
}
