"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { GLB_FOV } from "@/animations/cameraPath";
import { scroll, setUi } from "@/animations/store";
import { Lighting } from "@/scenes/Lighting";
import { worlds, stepAt } from "@/worlds";
import type { WorldCamera } from "@/worlds/types";

// Dev-only page: /lab?w=homie&p=0.4 renders one world in isolation.
// `p` fixes story progress; omit it to get a scrubber. `&play=1` loops p over time.

function readParams() {
  const q = new URLSearchParams(window.location.search);
  const id = q.get("w") ?? worlds[0].id;
  const index = Math.max(0, worlds.findIndex((w) => w.id === id));
  const p = q.get("p");
  return { index, p: p == null ? null : Number(p), play: q.get("play") === "1" };
}

function LabCamera({ index, progress }: { index: number; progress: React.RefObject<number> }) {
  const camera = useThree((s) => s.camera);
  const pose = useMemo<WorldCamera>(() => ({ position: new THREE.Vector3(), target: new THREE.Vector3() }), []);
  const def = worlds[index];
  const right = useMemo(() => new THREE.Vector3(), []);
  useFrame((state) => {
    const p = progress.current ?? 0;
    scroll.world = p;
    setUi({ step: stepAt(def, p) });
    def.camera(p, state.clock.elapsedTime, pose);
    camera.position.copy(pose.position);
    camera.lookAt(pose.target);
    // Same framing as the site: in landscape the subject sits right of centre (the card is on the left).
    const cam = camera as THREE.PerspectiveCamera;
    if (cam.aspect > 1) {
      const dist = pose.position.distanceTo(pose.target);
      const halfW = dist * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.aspect;
      right.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(-0.24 * halfW);
      camera.position.add(right);
    }
  });
  return null;
}

export default function Lab() {
  const [{ index, p, play }] = useState(readParams);
  const [value, setValue] = useState(p ?? 0.5);
  const progress = useRef(value);
  progress.current = value;
  const def = worlds[index];
  const World = def.Component;

  useEffect(() => {
    setUi({ loaded: true, stage: "projects", active: index, phase: "world" });
    document.documentElement.classList.remove("is-loading");
  }, [index]);

  useEffect(() => {
    if (!play) return;
    let raf = 0;
    const t0 = performance.now();
    const loop = () => {
      setValue(((performance.now() - t0) / 12000) % 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [play]);

  const step = def.steps[stepAt(def, value)];

  return (
    <div style={{ position: "fixed", inset: 0, background: "#1d1d1d" }}>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ fov: GLB_FOV, near: 0.05, far: 200, position: [0, 2, 6] }}
        gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping }}
        onCreated={({ scene }) => {
          scene.background = new THREE.Color("#1d1d1d");
        }}
      >
        <Lighting />
        <Suspense fallback={null}>
          <World index={index} />
        </Suspense>
        <LabCamera index={index} progress={progress} />
      </Canvas>
      {/* where the project card sits on the real page */}
      <div
        style={{
          position: "absolute",
          left: "4vw",
          top: "18vh",
          width: "min(420px, 34vw)",
          height: "52vh",
          border: "1px dashed rgba(243,239,233,0.18)",
          borderRadius: 16,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 24,
          bottom: 24,
          right: 24,
          display: "flex",
          gap: 16,
          alignItems: "center",
          color: "#f3efe9",
          font: "12px var(--font-text), sans-serif",
        }}
      >
        <span style={{ opacity: 0.6, minWidth: 64 }}>{def.id}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <span style={{ minWidth: 220 }}>
          {value.toFixed(3)} · {step?.label}
        </span>
      </div>
    </div>
  );
}
