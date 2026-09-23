"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Label } from "../Label";
import { scroll, worldActive } from "@/animations/store";
import type { WorldDef } from "../types";
import { BlobShadow, StageFloor, beat } from "../shared";
import { buildVolume, HEAD_Y, LESION, lesionRadius } from "./volume";

// Concept only: a synthetic, procedurally generated head volume. No patient data.

const ACCENT = "#f4c43a";

/** Slice height (volume-local y) over story progress: sweep down, then park on the region. */
function sliceY(p: number) {
  const sweep = THREE.MathUtils.lerp(0.95, -0.55, beat(p, 0.26, 0.46));
  return THREE.MathUtils.lerp(sweep, LESION.center.y, beat(p, 0.46, 0.56));
}

function usePointsMaterial() {
  return useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uAssemble: { value: 0 },
          uSliceY: { value: 1 },
          uSliceOn: { value: 0 },
          uCut: { value: 0 },
          uSeg: { value: 0 },
          uTime: { value: 0 },
          uScale: { value: 1000 },
          uAccent: { value: new THREE.Color(ACCENT) },
        },
        vertexShader: /* glsl */ `
          uniform float uAssemble, uSliceY, uSliceOn, uCut, uSeg, uTime, uScale;
          uniform vec3 uAccent;
          attribute vec3 aStart;
          attribute float aKind;   // 0 shell · 1 brain
          attribute float aSeg;    // 1 inside the segmented region
          attribute float aRand;
          varying vec3 vColor;
          varying float vAlpha;
          void main() {
            // staggered assembly: points arrive from their scattered start
            float k = clamp(uAssemble * 1.6 - aRand * 0.6, 0.0, 1.0);
            k = k * k * (3.0 - 2.0 * k);
            vec3 drift = vec3(sin(uTime * 0.3 + aRand * 40.0), cos(uTime * 0.25 + aRand * 31.0), sin(uTime * 0.2 + aRand * 17.0)) * 0.06;
            vec3 pos = mix(aStart + drift, position, k);

            float d = position.y - uSliceY;
            float band = exp(-abs(d) * 55.0) * uSliceOn * k;
            float above = smoothstep(-0.005, 0.02, d);

            vec3 shell = vec3(0.62, 0.6, 0.57);
            vec3 brain = mix(vec3(0.56, 0.54, 0.5), vec3(0.95, 0.93, 0.89), aRand);
            vec3 col = mix(shell, brain, aKind);
            float alpha = mix(0.22, 0.34, aKind);
            float size = mix(0.009, 0.012, aKind);

            // cutaway: everything above the slice fades so the cross-section reads
            float seg = aSeg * uSeg;
            alpha *= mix(1.0, mix(0.06, 0.25, 1.0 - aKind), uCut * above * (1.0 - seg));

            // the slice itself glows
            col = mix(col, vec3(1.0, 0.98, 0.94), band);
            alpha += band * 0.55 * aKind;
            size += band * 0.006;

            // segmented region
            col = mix(col, uAccent * (1.2 + band * 0.8), seg);
            // region stays readable, but thins above the slice so contour + section read
            alpha = mix(alpha, mix(0.62, 0.3, above * uCut) + band * 0.4, seg);
            size += seg * 0.004;

            // scattered points are dimmer and smaller
            alpha *= mix(0.9, 1.0, k);
            size *= mix(1.25, 1.0, k);

            vec4 mv = modelViewMatrix * vec4(pos, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = max(1.0, size * uScale / -mv.z);
            vColor = col;
            vAlpha = alpha;
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vColor;
          varying float vAlpha;
          void main() {
            vec2 c = gl_PointCoord - 0.5;
            float r = length(c);
            float a = (1.0 - smoothstep(0.25, 0.5, r)) * vAlpha;
            if (a < 0.003) discard;
            gl_FragColor = vec4(vColor * a, a);
          }
        `,
      }),
    [],
  );
}

function useSliceMaterial() {
  return useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
        uniforms: { uOpacity: { value: 0 }, uAccent: { value: new THREE.Color(ACCENT) } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          uniform float uOpacity;
          varying vec2 vUv;
          float hair(float d) { float w = fwidth(d); return 1.0 - smoothstep(0.0, w * 1.3, abs(d)); }
          void main() {
            vec2 q = abs(vUv - 0.5);
            float border = hair(max(q.x, q.y) - 0.495);
            // corner ticks only on the border
            float corner = step(0.42, q.x) * step(0.42, q.y);
            vec2 g = fract(vUv * 20.0 + 0.5) - 0.5;
            float grid = max(hair(g.x / 20.0), hair(g.y / 20.0)) * 0.12;
            float fill = 0.035;
            float a = (fill + grid + border * (0.25 + corner * 0.6)) * uOpacity;
            gl_FragColor = vec4(vec3(0.95, 0.93, 0.9) * a, a);
          }
        `,
        extensions: { derivatives: true } as never,
      }),
    [],
  );
}

function MedicalScene({ index }: { index: number }) {
  const volume = useMemo(buildVolume, []);
  const points = usePointsMaterial();
  const sliceMat = useSliceMaterial();

  const slice = useRef<THREE.Mesh>(null);
  const sliceLabel = useRef<HTMLDivElement>(null);
  const sliceText = useRef<HTMLSpanElement>(null);
  const contour = useRef<THREE.LineLoop>(null);
  const measure = useRef<THREE.Group>(null);
  const measureMat = useRef<THREE.LineBasicMaterial>(null);
  const measureLabel = useRef<HTMLDivElement>(null);
  const conceptLabel = useRef<HTMLDivElement>(null);

  // contour of the region in the parked slice plane
  const contourGeo = useMemo(() => {
    const n = 160;
    const pts: number[] = [];
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2;
      const dir = new THREE.Vector3(Math.cos(th), 0, Math.sin(th));
      const r = lesionRadius(dir) * 1.14;
      pts.push(LESION.center.x + dir.x * r, 0, LESION.center.z + dir.z * r);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);

  // measurement: widest chord through the region, with end ticks
  const measureGeo = useMemo(() => {
    let best = 0;
    let bestTh = 0;
    for (let i = 0; i < 90; i++) {
      const th = (i / 90) * Math.PI;
      const a = lesionRadius(new THREE.Vector3(Math.cos(th), 0, Math.sin(th)));
      const b = lesionRadius(new THREE.Vector3(-Math.cos(th), 0, -Math.sin(th)));
      if (a + b > best) {
        best = a + b;
        bestTh = th;
      }
    }
    const dir = new THREE.Vector3(Math.cos(bestTh), 0, Math.sin(bestTh));
    const ra = lesionRadius(dir) * 1.04;
    const rb = lesionRadius(dir.clone().negate()) * 1.04;
    const c = LESION.center;
    const A = new THREE.Vector3(c.x + dir.x * ra, 0, c.z + dir.z * ra);
    const B = new THREE.Vector3(c.x - dir.x * rb, 0, c.z - dir.z * rb);
    // CAD-style dimension line raised above the region, with legs down to the section
    const H = 0.3;
    const up = new THREE.Vector3(0, H, 0);
    const A2 = A.clone().add(up);
    const B2 = B.clone().add(up);
    const perp = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(0.04);
    const pts = [
      A2, B2,
      A, A2.clone().add(new THREE.Vector3(0, 0.04, 0)),
      B, B2.clone().add(new THREE.Vector3(0, 0.04, 0)),
      A2.clone().add(perp), A2.clone().sub(perp),
      B2.clone().add(perp), B2.clone().sub(perp),
    ];
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const mid = A2.clone().add(B2).multiplyScalar(0.5);
    // ~95 mm per unit (the synthetic head is ≈ 190 mm long)
    return { g, mid, lengthMm: Math.round((ra + rb) * 95) };
  }, []);

  useFrame((state) => {
    if (!worldActive(index)) return;
    const p = scroll.world;
    const t = state.clock.elapsedTime;
    const cam = state.camera as THREE.PerspectiveCamera;
    const u = points.uniforms;
    u.uTime.value = t;
    u.uScale.value = (state.size.height * state.viewport.dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
    u.uAssemble.value = beat(p, 0.0, 0.22);
    const y = sliceY(p);
    const sliceOn = beat(p, 0.22, 0.28);
    u.uSliceY.value = y;
    u.uSliceOn.value = sliceOn;
    u.uCut.value = beat(p, 0.28, 0.38);
    const seg = beat(p, 0.54, 0.66);
    u.uSeg.value = seg;

    sliceMat.uniforms.uOpacity.value = sliceOn * (1 - 0.4 * beat(p, 0.6, 0.75));
    if (slice.current) {
      slice.current.position.y = y;
      slice.current.visible = sliceOn > 0.001;
    }
    if (sliceLabel.current) sliceLabel.current.style.opacity = String(sliceOn * (1 - beat(p, 0.52, 0.58)));
    if (sliceText.current) sliceText.current.textContent = String(Math.round((y + 1) * 60)).padStart(3, "0");

    if (contour.current) {
      contour.current.position.y = y + 0.004;
      const c = beat(p, 0.58, 0.7);
      contour.current.geometry.setDrawRange(0, Math.floor(160 * c));
      contour.current.visible = c > 0.001;
      (contour.current.material as THREE.LineBasicMaterial).opacity = 0.95;
    }

    const m = beat(p, 0.76, 0.86);
    if (measure.current) {
      measure.current.position.y = y + 0.006;
      measure.current.visible = m > 0.001;
      measure.current.scale.set(1, 1, 1);
    }
    if (measureMat.current) measureMat.current.opacity = m;
    if (measureLabel.current) measureLabel.current.style.opacity = String(m);
    if (conceptLabel.current) conceptLabel.current.style.opacity = String(1 - beat(p, 0.12, 0.2));
  });

  const accentStyle = { "--accent": ACCENT } as React.CSSProperties;

  return (
    <group>
      <StageFloor radius={4.5} accent="#f3efe9" spacing={0.3} />
      <BlobShadow size={2.2} opacity={0.35} />
      <group position-y={HEAD_Y}>
        <points geometry={volume} material={points} frustumCulled={false} raycast={() => null} />
        <mesh ref={slice} rotation-x={-Math.PI / 2} material={sliceMat} renderOrder={2} raycast={() => null}>
          <planeGeometry args={[2.3, 2.3]} />
        </mesh>
        <Label position={[1.15, 1, -1.15]} center zIndex={20}>
          <div ref={sliceLabel} className="world-label" style={{ ...accentStyle, opacity: 0 }}>
            Axial slice <small><span ref={sliceText}>000</span></small>
          </div>
        </Label>
        <lineLoop ref={contour} geometry={contourGeo} renderOrder={3} raycast={() => null}>
          <lineBasicMaterial color={ACCENT} transparent depthTest={false} toneMapped={false} />
        </lineLoop>
        <group ref={measure} visible={false}>
          <lineSegments geometry={measureGeo.g} renderOrder={4} raycast={() => null}>
            <lineBasicMaterial ref={measureMat} color="#f3efe9" transparent depthTest={false} toneMapped={false} />
          </lineSegments>
          <Label position={[measureGeo.mid.x, measureGeo.mid.y + 0.14, measureGeo.mid.z]} center zIndex={20}>
            <div ref={measureLabel} className="world-label" style={{ ...accentStyle, opacity: 0 }}>
              Region Ø {measureGeo.lengthMm} mm <small>· concept</small>
            </div>
          </Label>
        </group>
        <Label position={[0, 1.25, 0]} center zIndex={20}>
          <div ref={conceptLabel} className="world-label world-label--plain">
            Synthetic volume · concept
          </div>
        </Label>
      </group>
    </group>
  );
}

// ── Camera: slow orbit that rises to look down onto the slice ───────────────

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const target = new THREE.Vector3();

export const medicalWorld: WorldDef = {
  id: "medical",
  steps: [
    { at: 0, label: "Reconstruct", caption: "A volume assembles from scattered samples. Synthetic data, concept only." },
    { at: 0.24, label: "Scan", caption: "An axial slice sweeps through the volume." },
    { at: 0.52, label: "Segment", caption: "A model highlights one region and traces its contour." },
    { at: 0.74, label: "Measure", caption: "Shape and size become numbers a clinician can check." },
  ],
  camera: (p, t, out) => {
    const s1 = beat(p, 0.2, 0.45);
    const s2 = beat(p, 0.5, 0.7);
    const s3 = beat(p, 0.72, 0.95);
    const az = 0.75 - 0.35 * s1 - 0.2 * s2 - 0.15 * s3 + Math.sin(t * 0.12) * 0.07 + (1 - clamp01(p / 0.22)) * 0.25;
    const el = 0.14 + 0.3 * s1 + 0.1 * s2 + 0.12 * s3 + Math.sin(t * 0.09) * 0.02;
    const r = 4.4 - 0.4 * s1 - 0.5 * s2 - 0.4 * s3 + (1 - clamp01(p / 0.22)) * 0.8;
    target.set(0, HEAD_Y + 0.05, 0).lerp(
      new THREE.Vector3(LESION.center.x * 0.6, HEAD_Y + LESION.center.y, LESION.center.z * 0.6),
      0.6 * s2 + 0.2 * s3,
    );
    out.target.copy(target);
    out.position.set(
      target.x + Math.sin(az) * Math.cos(el) * r,
      target.y + Math.sin(el) * r,
      target.z + Math.cos(az) * Math.cos(el) * r,
    );
  },
  Component: MedicalScene,
};
