"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { EffectComposer, DepthOfField } from "@react-three/postprocessing";
import type { DepthOfFieldEffect } from "postprocessing";
import { getUi } from "@/animations/store";
import { focusTarget } from "./CameraRig";
import { usePortfolioModel } from "@/models/usePortfolioModel";

/** Post stack. Depth of field follows the GLB focus-marker contract
 * (dofBokeh / dofFocusRange); the export ships with dofEnabled:false, so the
 * hero stays sharp and DOF only opens up on sticker close-ups.
 *
 * No ToneMapping effect on purpose: postprocessing's NEUTRAL pass crushes the
 * #1d1d1d ground to near-black; the scene's values already sit in display range. */
export function Effects() {
  const dof = useRef<DepthOfFieldEffect>(null);
  const { focus } = usePortfolioModel();
  const marker = focus[0];
  const bokeh = useRef(0);

  useFrame((_, dt) => {
    const e = dof.current;
    if (!e) return;
    const { stage, active } = getUi();
    const on = marker?.dofEnabled || (stage === "projects" && active >= 0);
    bokeh.current = THREE.MathUtils.damp(bokeh.current, on ? (marker?.dofBokeh ?? 4) * 0.6 : 0, 3, dt);
    e.bokehScale = bokeh.current;
    if (!e.target) e.target = new THREE.Vector3();
    e.target.copy(focusTarget);
  });

  return (
    <EffectComposer multisampling={4}>
      <DepthOfField ref={dof} worldFocusRange={marker?.dofFocusRange ?? 0.5} bokehScale={0} />
    </EffectComposer>
  );
}
