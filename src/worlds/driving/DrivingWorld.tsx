"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Label } from "../Label";
import { scroll, worldActive } from "@/animations/store";
import type { WorldDef } from "../types";
import { BlobShadow, StageFloor, beat } from "../shared";
import { Car, CAR_LENGTH } from "./Car";

// Illustrative ADAS scene: no internal data, no real road-test footage.
// The ego car stays near the origin facing -z; the road scrolls under it.

const ACCENT = "#e2463a";
const LANE = 1.2;
const ROAD_HALF = LANE * 1.5;
const ROAD_NEAR = 10;
const ROAD_FAR = -46;
const SPEED = 12; // world units / s of road scroll
const SCRUB = 60; // road units per unit of story progress

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Ego lateral position: lane 0 → lane +1 during the lane change. */
const egoX = (p: number) => LANE * beat(p, 0.52, 0.7);
/** Distance of the speed sign ahead of the ego nose (scroll-coupled like the road). */
const signZ = (p: number) => -30 + (p - 0.7) * SCRUB;

// ── Road ────────────────────────────────────────────────────────────────────

function useRoadMaterial() {
  return useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        uniforms: {
          uOffset: { value: 0 },
          uEgoX: { value: 0 },
          uLcc: { value: 0 },
          uAccent: { value: new THREE.Color(ACCENT) },
        },
        vertexShader: /* glsl */ `
          varying vec2 vP;
          void main() {
            // plane is rotated -90° about x and centred at ROAD_MID: local y → -z
            vP = vec2(position.x, ${((ROAD_NEAR + ROAD_FAR) / 2).toFixed(2)} - position.y);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uOffset, uEgoX, uLcc;
          uniform vec3 uAccent;
          varying vec2 vP;
          float line(float d, float w) {
            float aa = fwidth(d) * 1.2;
            return 1.0 - smoothstep(w - aa, w + aa, abs(d));
          }
          void main() {
            float x = vP.x;
            float z = vP.y;
            float halfW = ${ROAD_HALF.toFixed(3)};
            // asphalt: a faint lift from the studio ground, fading at both ends and sides
            float along = smoothstep(${ROAD_FAR.toFixed(1)}, ${(ROAD_FAR + 26).toFixed(1)}, z) * (1.0 - smoothstep(4.0, ${ROAD_NEAR.toFixed(1)}, z));
            float side = 1.0 - smoothstep(halfW, halfW + 0.9, abs(x));
            vec3 col = vec3(0.03, 0.029, 0.028); // linear: reads as dark asphalt after output encoding
            float a = 0.9 * side;

            // micro texture streaks moving with the road
            float s = fract(sin(floor((z + uOffset) * 6.0) * 91.7 + floor(x * 14.0) * 12.3) * 4375.5);
            col += (s - 0.5) * 0.004;

            // lane markings
            float edges = line(abs(x) - halfW + 0.08, 0.02);
            float dashOn = step(fract((z + uOffset) / 4.0), 0.45);
            float dashes = (line(x - ${(LANE * 0.5).toFixed(3)}, 0.022) + line(x + ${(LANE * 0.5).toFixed(3)}, 0.022)) * dashOn;
            vec3 paint = vec3(0.3, 0.29, 0.27);
            col = mix(col, paint, clamp(edges * 0.55 + dashes * 0.6, 0.0, 1.0));

            // LCC: ego-lane boundaries light up ahead of the car
            float ahead = smoothstep(1.2, -0.4, z) * smoothstep(-30.0, -10.0, z);
            float laneL = line(x - (uEgoX - ${(LANE * 0.5).toFixed(3)}), 0.03);
            float laneR = line(x - (uEgoX + ${(LANE * 0.5).toFixed(3)}), 0.03);
            float glowL = exp(-abs(x - (uEgoX - ${(LANE * 0.5).toFixed(3)})) * 18.0);
            float glowR = exp(-abs(x - (uEgoX + ${(LANE * 0.5).toFixed(3)})) * 18.0);
            float lcc = uLcc * ahead;
            col = mix(col, uAccent * 1.4, clamp((laneL + laneR) * lcc, 0.0, 1.0));
            col += uAccent * (glowL + glowR) * 0.35 * lcc;
            // soft lane fill
            float inLane = 1.0 - smoothstep(${(LANE * 0.42).toFixed(3)}, ${(LANE * 0.5).toFixed(3)}, abs(x - uEgoX));
            col += uAccent * inLane * 0.05 * lcc;

            gl_FragColor = vec4(col, a * along);
          }
        `,
        extensions: { derivatives: true } as never,
      }),
    [],
  );
}

// ── Ribbon along a lane (LCC centre path / lane-change trajectory) ───────────

const RIBBON_LEN = 16;

function useRibbonMaterial() {
  return useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uFrom: { value: 0 },
          uTo: { value: 0 },
          uBend: { value: 0.4 },
          uOpacity: { value: 0 },
          uReveal: { value: 1 },
          uTime: { value: 0 },
          uAccent: { value: new THREE.Color(ACCENT) },
        },
        vertexShader: /* glsl */ `
          uniform float uFrom, uTo, uBend;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            float v = uv.y; // 0 at the car, 1 far ahead
            float k = smoothstep(0.0, uBend, v);
            float cx = mix(uFrom, uTo, k);
            vec3 p = vec3(cx + position.x, 0.012, -v * ${RIBBON_LEN.toFixed(1)});
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uOpacity, uReveal, uTime;
          uniform vec3 uAccent;
          varying vec2 vUv;
          void main() {
            float across = abs(vUv.x - 0.5) * 2.0;
            float core = 1.0 - smoothstep(0.08, 0.22, across);
            float body = (1.0 - smoothstep(0.2, 1.0, across)) * 0.25;
            // chevrons travelling forward
            float chev = step(0.72, fract(vUv.y * 22.0 - uTime * 1.6 + across * 0.35)) * (1.0 - smoothstep(0.5, 0.9, across));
            float fadeIn = smoothstep(0.0, 0.06, vUv.y);
            float fadeOut = 1.0 - smoothstep(uReveal * 0.75, uReveal, vUv.y);
            float a = (core * 0.9 + body + chev * 0.35) * fadeIn * fadeOut * uOpacity;
            gl_FragColor = vec4(uAccent * a, a);
          }
        `,
      }),
    [],
  );
}

function Ribbon({ material, width = 0.34 }: { material: THREE.ShaderMaterial; width?: number }) {
  return (
    <mesh material={material} frustumCulled={false} renderOrder={2} raycast={() => null}>
      <planeGeometry args={[width, 1, 1, 96]} />
    </mesh>
  );
}

// ── Sensor fan: hairline sector in front of the car ─────────────────────────

function useFanGeometry(radius: number, half: number, rays: number) {
  return useMemo(() => {
    const pts: number[] = [];
    const seg = 48;
    for (const r of [radius * 0.5, radius]) {
      for (let i = 0; i < seg; i++) {
        const a0 = -half + (2 * half * i) / seg;
        const a1 = -half + (2 * half * (i + 1)) / seg;
        pts.push(Math.sin(a0) * r, 0, -Math.cos(a0) * r, Math.sin(a1) * r, 0, -Math.cos(a1) * r);
      }
    }
    for (let i = 0; i <= rays; i++) {
      const a = -half + (2 * half * i) / rays;
      pts.push(0, 0, 0, Math.sin(a) * radius, 0, -Math.cos(a) * radius);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [radius, half, rays]);
}

// ── Speed-limit sign ────────────────────────────────────────────────────────

function useSignTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#f4f1ec";
    ctx.beginPath();
    ctx.arc(128, 128, 124, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 30;
    ctx.strokeStyle = "#d8352b";
    ctx.beginPath();
    ctx.arc(128, 128, 104, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#151515";
    ctx.font = "700 108px Inter, Helvetica, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("80", 128, 136);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, []);
}

/** Wireframe detection box: faint edges plus bright corner brackets. */
function useBracketGeometry(w: number, h: number, d: number) {
  return useMemo(() => {
    const pts: number[] = [];
    const k = 0.28;
    const xs = [-w / 2, w / 2];
    const ys = [-h / 2, h / 2];
    const zs = [-d / 2, d / 2];
    for (const x of xs)
      for (const y of ys)
        for (const z of zs) {
          const sx = -Math.sign(x), sy = -Math.sign(y), sz = -Math.sign(z);
          pts.push(x, y, z, x + sx * w * k, y, z);
          pts.push(x, y, z, x, y + sy * h * k, z);
          pts.push(x, y, z, x, y, z + sz * d * 0.5);
        }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [w, h, d]);
}

// ── World ───────────────────────────────────────────────────────────────────

function DrivingScene({ index }: { index: number }) {
  const road = useRoadMaterial();
  const lcc = useRibbonMaterial();
  const traj = useRibbonMaterial();
  const fan = useFanGeometry(9, 0.42, 4);
  const signTex = useSignTexture();
  const brackets = useBracketGeometry(0.95, 0.95, 0.22);
  const boxEdges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(0.95, 0.95, 0.22)), []);

  const ego = useRef<THREE.Group>(null);
  const egoWheels = useRef<THREE.Group[]>([]);
  const lead = useRef<THREE.Group>(null);
  const leadWheels = useRef<THREE.Group[]>([]);
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const gap = useRef<THREE.Group>(null);
  const gapBand = useRef<THREE.Mesh>(null);
  const gapText = useRef<HTMLSpanElement>(null);
  const gapLabel = useRef<HTMLDivElement>(null);
  const fanMat = useRef<THREE.LineBasicMaterial>(null);
  const sign = useRef<THREE.Group>(null);
  const det = useRef<THREE.Group>(null);
  const detMat = useRef<THREE.LineBasicMaterial>(null);
  const detEdgeMat = useRef<THREE.LineBasicMaterial>(null);
  const chip = useRef<HTMLDivElement>(null);
  const egoLabel = useRef<HTMLDivElement>(null);
  const ray = useRef<THREE.Mesh>(null);

  const bandMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uOpacity: { value: 0 }, uLen: { value: 3 }, uAccent: { value: new THREE.Color(ACCENT) } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          uniform float uOpacity, uLen;
          uniform vec3 uAccent;
          varying vec2 vUv;
          void main() {
            float across = abs(vUv.x - 0.5) * 2.0;
            float ends = max(1.0 - smoothstep(0.0, 0.05 / uLen * 3.0, vUv.y), 1.0 - smoothstep(0.0, 0.05 / uLen * 3.0, 1.0 - vUv.y));
            float ticks = step(0.9, fract(vUv.y * uLen * 2.0)) * 0.5;
            float fill = 0.1 + 0.12 * (1.0 - across);
            float edge = 1.0 - smoothstep(0.9, 1.0, across);
            float a = (fill + ticks * (1.0 - across) + ends * 0.9) * edge * uOpacity;
            gl_FragColor = vec4(uAccent * a, a);
          }
        `,
      }),
    [],
  );

  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    if (!worldActive(index)) return;
    const p = scroll.world;
    const t = state.clock.elapsedTime;
    const offset = t * SPEED + p * SCRUB;

    // ego
    const ex = egoX(p);
    const lcT = beat(p, 0.52, 0.7);
    const steer = Math.sin(lcT * Math.PI) * 0.12; // yaw into the manoeuvre
    if (ego.current) {
      ego.current.position.x = ex;
      ego.current.rotation.y = -steer;
      ego.current.position.y = Math.sin(t * 9) * 0.003;
    }
    const spin = -offset / 0.15;
    for (const w of egoWheels.current) if (w) w.rotation.x = spin;
    for (const w of leadWheels.current) if (w) w.rotation.x = spin;

    // road
    road.uniforms.uOffset.value = offset;
    road.uniforms.uEgoX.value = ex;
    const lccOn = beat(p, 0.2, 0.3) * (1 - beat(p, 0.5, 0.56));
    road.uniforms.uLcc.value = lccOn + beat(p, 0.7, 0.78) * 0.5;

    // lead car (ACC)
    const d = 4.4 + Math.sin(t * 0.55) * 1.1 + Math.sin(t * 1.3) * 0.25;
    const leadZ = -(CAR_LENGTH + d);
    if (lead.current) {
      lead.current.position.z = leadZ;
      lead.current.position.x = Math.sin(t * 0.4) * 0.03;
    }

    // ACC gap band between ego nose and lead tail
    const accVis = Math.max(beat(p, 0.0, 0.05) * (1 - beat(p, 0.26, 0.34)), 0);
    bandMat.uniforms.uOpacity.value = accVis;
    bandMat.uniforms.uLen.value = d;
    if (gap.current) {
      gap.current.position.set(0, 0.015, -CAR_LENGTH / 2 - d / 2);
      gap.current.visible = accVis > 0.001;
    }
    if (gapBand.current) gapBand.current.scale.set(0.9, d, 1);
    if (gapText.current) gapText.current.textContent = `${(d * 0.36).toFixed(1)} s`;
    if (gapLabel.current) gapLabel.current.style.opacity = String(accVis);

    // traffic in neighbouring lanes
    if (left.current) left.current.position.z = -3.2 + Math.sin(t * 0.21) * 2.4;
    if (right.current) right.current.position.z = -17 + Math.sin(t * 0.17 + 1) * 2;

    // LCC centre path
    lcc.uniforms.uFrom.value = ex;
    lcc.uniforms.uTo.value = ex;
    lcc.uniforms.uOpacity.value = lccOn * 0.8;
    lcc.uniforms.uReveal.value = 0.2 + 0.8 * beat(p, 0.2, 0.34);
    lcc.uniforms.uTime.value = t;

    // lane-change trajectory
    const trajOn = beat(p, 0.44, 0.5) * (1 - beat(p, 0.68, 0.76));
    traj.uniforms.uFrom.value = ex;
    traj.uniforms.uTo.value = LANE;
    traj.uniforms.uBend.value = 0.45 * (1 - lcT) + 0.05;
    traj.uniforms.uOpacity.value = trajOn;
    traj.uniforms.uReveal.value = 0.15 + 0.85 * beat(p, 0.44, 0.52);
    traj.uniforms.uTime.value = t;

    // sensor fan: always faintly on, brighter during perception
    if (fanMat.current) fanMat.current.opacity = 0.1 + 0.1 * beat(p, 0.7, 0.8);

    // speed sign + detection
    const sz = signZ(p);
    if (sign.current) {
      sign.current.position.z = sz;
      sign.current.visible = sz < 8 && sz > -46;
    }
    const detected = beat(-sz, 22, 16) * beat(p, 0.72, 0.8);
    const pulse = 0.75 + 0.25 * Math.sin(t * 5);
    if (det.current) {
      det.current.visible = detected > 0.01;
      det.current.scale.setScalar(1 + (1 - detected) * 0.35);
    }
    if (detMat.current) detMat.current.opacity = detected * pulse;
    if (detEdgeMat.current) detEdgeMat.current.opacity = detected * 0.25;
    if (chip.current) chip.current.style.opacity = String(detected);
    if (ray.current && sign.current && ego.current) {
      // hairline from the ego's camera to the detection
      tmp.set(2.55, 1.55, sz).sub(new THREE.Vector3(ex, 0.62, -0.2));
      const len = tmp.length();
      ray.current.position.set(ex, 0.62, -0.2).addScaledVector(tmp, 0.5);
      ray.current.scale.set(1, len, 1);
      ray.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tmp.normalize());
      (ray.current.material as THREE.MeshBasicMaterial).opacity = detected * 0.45;
      ray.current.visible = detected > 0.01;
    }
    if (egoLabel.current) egoLabel.current.style.opacity = String(1 - beat(p, 0.08, 0.16));
  });

  return (
    <group>
      <StageFloor radius={9} spacing={0.4} opacity={0.6} />
      {/* road */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.004, (ROAD_NEAR + ROAD_FAR) / 2]} material={road} renderOrder={0} raycast={() => null}>
        <planeGeometry args={[ROAD_HALF * 2 + 2, ROAD_NEAR - ROAD_FAR]} />
      </mesh>

      <group position-z={0}>
        <Ribbon material={lcc} width={0.26} />
      </group>
      <group position-z={-CAR_LENGTH / 2}>
        <Ribbon material={traj} width={0.42} />
      </group>

      {/* ego */}
      <group ref={ego}>
        <Car wheels={egoWheels} tailGlow={1} />
        <BlobShadow size={[1.3, 2.4]} opacity={0.75} />
        <lineSegments geometry={fan} position={[0, 0.02, -CAR_LENGTH / 2]} raycast={() => null}>
          <lineBasicMaterial ref={fanMat} color={ACCENT} transparent opacity={0.15} depthWrite={false} toneMapped={false} />
        </lineSegments>
        <Label position={[0, 0.95, 0.2]} center zIndex={20}>
          <div ref={egoLabel} className="world-label" style={{ "--accent": ACCENT } as React.CSSProperties}>
            Ego · Illustrative
          </div>
        </Label>
      </group>

      {/* lead vehicle */}
      <group ref={lead} position-z={-6}>
        <Car body="#8c8984" tail={ACCENT} tailGlow={0.6} wheels={leadWheels} />
        <BlobShadow size={[1.3, 2.4]} opacity={0.6} />
      </group>

      {/* ACC gap */}
      <group ref={gap}>
        <mesh ref={gapBand} rotation-x={-Math.PI / 2} material={bandMat} raycast={() => null} renderOrder={3}>
          <planeGeometry args={[1, 1]} />
        </mesh>
        <Label position={[0.78, 0.05, 0]} center zIndex={20}>
          <div ref={gapLabel} className="world-label" style={{ "--accent": ACCENT } as React.CSSProperties}>
            ACC gap <span ref={gapText}>1.8 s</span>
          </div>
        </Label>
      </group>

      {/* neighbouring traffic */}
      <group ref={left} position-x={-LANE}>
        <Car body="#4a4845" tailGlow={0.3} />
        <BlobShadow size={[1.3, 2.4]} opacity={0.5} />
      </group>
      <group ref={right} position-x={LANE}>
        <Car body="#5d5a56" tailGlow={0.3} />
        <BlobShadow size={[1.3, 2.4]} opacity={0.5} />
      </group>

      {/* speed-limit sign on the right verge */}
      <group ref={sign} position={[2.55, 0, -30]}>
        <mesh position-y={0.6}>
          <cylinderGeometry args={[0.025, 0.025, 1.2, 10]} />
          <meshStandardMaterial color="#8b8883" roughness={0.4} metalness={0.7} />
        </mesh>
        <mesh position={[0, 1.55, 0.035]} rotation-y={-0.12}>
          <circleGeometry args={[0.38, 48]} />
          <meshStandardMaterial map={signTex} roughness={0.5} />
        </mesh>
        <BlobShadow size={0.6} opacity={0.5} />
        <group ref={det} position-y={1.55} rotation-y={-0.12}>
          <lineSegments geometry={brackets} raycast={() => null}>
            <lineBasicMaterial ref={detMat} color={ACCENT} transparent depthWrite={false} toneMapped={false} />
          </lineSegments>
          <lineSegments geometry={boxEdges} raycast={() => null}>
            <lineBasicMaterial ref={detEdgeMat} color={ACCENT} transparent depthWrite={false} toneMapped={false} />
          </lineSegments>
          <Label position={[0, 0.72, 0]} center zIndex={20}>
            <div ref={chip} className="world-label" style={{ "--accent": ACCENT, opacity: 0 } as React.CSSProperties}>
              Speed 80 <small>· 0.97</small>
            </div>
          </Label>
        </group>
      </group>

      {/* perception ray */}
      <mesh ref={ray} visible={false} raycast={() => null}>
        <cylinderGeometry args={[0.004, 0.004, 1, 6]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ── Camera ──────────────────────────────────────────────────────────────────

const KEYS: { at: number; pos: [number, number, number]; tgt: [number, number, number] }[] = [
  // ACC: high 3/4 from behind-right, both cars in frame
  { at: 0.0, pos: [3.6, 3.0, 5.6], tgt: [0, 0.2, -2.6] },
  // LCC: lower chase, looking down the lane
  { at: 0.3, pos: [1.8, 2.0, 4.8], tgt: [0, 0.1, -4.5] },
  // lane change: wide from the left rear
  { at: 0.52, pos: [-2.6, 2.6, 5.2], tgt: [0.9, 0.1, -3.2] },
  // perception: low from the left, looking up the road toward the sign
  { at: 0.78, pos: [0.2, 2.4, 6.4], tgt: [0.5, 0.75, -6.0] },
  { at: 1.0, pos: [0.3, 2.1, 6.0], tgt: [0.7, 1.0, -9.0] },
];

const a = new THREE.Vector3();
const b = new THREE.Vector3();

function sampleKeys(p: number, key: "pos" | "tgt", out: THREE.Vector3) {
  let i = 0;
  while (i < KEYS.length - 2 && p > KEYS[i + 1].at) i++;
  const k0 = KEYS[i];
  const k1 = KEYS[i + 1];
  const f = clamp01((p - k0.at) / (k1.at - k0.at));
  const s = f * f * (3 - 2 * f);
  a.fromArray(k0[key]);
  b.fromArray(k1[key]);
  return out.lerpVectors(a, b, s);
}

export const drivingWorld: WorldDef = {
  id: "driving",
  steps: [
    { at: 0, label: "ACC", caption: "Adaptive cruise holds a time gap to the lead car. Illustrative scene, no internal data." },
    { at: 0.24, label: "LCC", caption: "Lane centring keeps the car on the lane's centre line." },
    { at: 0.46, label: "Lane change", caption: "Automatic lane change: plan the trajectory, check the gap, merge." },
    { at: 0.72, label: "Sign recognition", caption: "Speed-limit reads reviewed for misses, false reads and late updates." },
  ],
  camera: (p, t, out) => {
    sampleKeys(p, "pos", out.position);
    sampleKeys(p, "tgt", out.target);
    const ex = egoX(p);
    // keys are relative to the ego lane
    out.position.x += ex;
    out.target.x += ex;
    out.position.x += Math.sin(t * 0.21) * 0.18;
    out.position.y += Math.sin(t * 0.17) * 0.08;
  },
  Component: DrivingScene,
};
