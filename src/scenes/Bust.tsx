"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { usePortfolioModel } from "@/models/usePortfolioModel";
import { scroll, setUi, getUi } from "@/animations/store";
import { DAMP } from "@/animations/cameraPath";
import { projects } from "@/sections/content";
import { scrollToId } from "@/animations/scrollTo";

const damp = THREE.MathUtils.damp;

/** The bust from portfolio.glb. Adds pointer parallax and turns every sticker
 * into a hotspot that glows on hover and flies the camera to its project. */
export function Bust() {
  const { model, decals } = usePortfolioModel();
  const group = useRef<THREE.Group>(null);

  const projectByDecal = useMemo(() => {
    const map = new Map<string, number>();
    projects.forEach((p, i) => map.set(p.decal, i));
    return map;
  }, []);

  useEffect(() => () => void (document.body.style.cursor = ""), []);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const { stage, active, hovered } = getUi();
    // Subtle "the bust notices you" parallax; calmer during close-ups.
    const k = stage === "projects" ? 0.35 : 1;
    g.rotation.y = damp(g.rotation.y, scroll.pointerX * 0.12 * k, DAMP.pointer, dt);
    g.rotation.x = damp(g.rotation.x, -scroll.pointerY * 0.04 * k, DAMP.pointer, dt);

    const t = state.clock.elapsedTime;
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
          scrollToId(`project-${projects[i].id}`);
        }}
      />
    </group>
  );
}
