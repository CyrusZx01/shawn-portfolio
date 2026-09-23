"use client";

import { Suspense } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { AdaptiveDpr } from "@react-three/drei";
import { GLB_FOV } from "@/animations/cameraPath";
import { Backdrop } from "./Backdrop";
import { Bust } from "./Bust";
import { CameraRig } from "./CameraRig";
import { Effects } from "./Effects";
import { Lighting } from "./Lighting";
import { SceneReady } from "./SceneReady";
import { Worlds } from "./Worlds";

export default function PortfolioScene() {
  return (
    <Canvas
      className="scene-canvas"
      dpr={[1, 1.75]}
      camera={{ fov: GLB_FOV, near: 0.05, far: 400, position: [-0.564, 0.889, 3.525] }}
      gl={{ antialias: false, powerPreference: "high-performance", toneMapping: THREE.NeutralToneMapping }}
      onCreated={({ gl, scene }) => {
        gl.setClearColor("#1d1d1d");
        scene.background = new THREE.Color("#1d1d1d");
      }}
      eventSource={typeof document !== "undefined" ? document.body : undefined}
      eventPrefix="client"
    >
      <Backdrop />
      <Lighting />
      <Suspense fallback={null}>
        <Bust />
        <Worlds />
        <CameraRig />
        <Effects />
        <SceneReady />
      </Suspense>
      <AdaptiveDpr pixelated={false} />
    </Canvas>
  );
}
