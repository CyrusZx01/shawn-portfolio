"use client";

import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Label } from "../Label";
import { scroll, worldActive } from "@/animations/store";
import type { WorldDef } from "../types";
import { BlobShadow, StageFloor, beat } from "../shared";
import dots from "../data/globeDots.json";
import { CITIES, FOCUS, LEADERBOARD, MOODS, latLng } from "./data";

// Human Weather — a dot globe of 5,967 land cells. Dots stream in, moods rise off
// cities like weather, the camera dives to one city where H3-style hex cells light
// up, and finally the visitor can click the globe to drop a mood of their own.
// All mood data shown here is illustrative (labelled "demo" in the UI).

const ACCENT = "#f7b733";
const R = 1.2;
const GLOBE_Y = 1.5;
const BASE_TILT = 0.32;
const D2R = Math.PI / 180;

const P = {
  formEnd: 0.22,
  moodA: 0.18,
  moodB: 0.34,
  zoomA: 0.46,
  zoomB: 0.6,
  unzoomA: 0.74,
  unzoomB: 0.86,
  dropA: 0.78,
};

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const moodColors = MOODS.map((m) => new THREE.Color(m.color));
const moodInks = MOODS.map((m) => new THREE.Color(m.ink));

/** Rotation that brings (lat, lng) to face +z (toward the default camera). */
const focusYaw = -FOCUS.lng * D2R;
const focusPitch = FOCUS.lat * D2R;

function freeYaw(p: number, t: number) {
  return -0.4 + t * 0.05 + p * 2.2;
}

// ── shaders ────────────────────────────────────────────────────────────────

const dotVert = /* glsl */ `
  uniform float uForm, uMood, uSize, uTime;
  attribute vec3 aScatter;
  attribute vec3 aMood;
  attribute float aSeed, aMoodW;
  varying float vFacing, vF, vW;
  varying vec3 vColor;
  void main() {
    float f = clamp((uForm - aSeed * 0.55) / 0.45, 0.0, 1.0);
    f = f * f * (3.0 - 2.0 * f);
    vec3 p = mix(aScatter, position, f);
    // land under a mood gently "breathes" outward
    p *= 1.0 + aMoodW * uMood * 0.012 * (0.5 + 0.5 * sin(uTime * 2.0 + aSeed * 40.0));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec3 n = normalize(normalMatrix * normalize(position));
    vFacing = dot(n, normalize(-mv.xyz));
    vF = f;
    vW = aMoodW * uMood;
    vColor = aMood;
    gl_PointSize = uSize * (0.6 + 0.4 * f) * (1.0 + vW * 0.35) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const dotFrag = /* glsl */ `
  uniform vec3 uBase;
  varying float vFacing, vF, vW;
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = 1.0 - smoothstep(0.36, 0.5, d);
    float face = mix(0.06, 1.0, smoothstep(-0.05, 0.35, vFacing));
    vec3 col = mix(uBase, vColor, vW * 0.9);
    gl_FragColor = vec4(col, a * face * vF * mix(0.55, 1.0, vW));
    if (gl_FragColor.a < 0.01) discard;
    #include <colorspace_fragment>
  }
`;

const atmoVert = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const atmoFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  uniform float uHalo;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float d = abs(dot(vN, vV));
    // limb: bright at grazing angles. halo (back faces): bright hugging the globe, fading out.
    float a = mix(pow(1.0 - d, 3.0), pow(smoothstep(0.0, 0.62, d), 3.0) * (1.0 - smoothstep(0.62, 0.9, d)), uHalo) * uStrength;
    gl_FragColor = vec4(uColor, a);
    #include <colorspace_fragment>
  }
`;

const moteVert = /* glsl */ `
  uniform float uTime, uMood, uSize;
  attribute vec3 aColor;
  attribute float aSeed;
  attribute vec2 aOff;
  varying float vA;
  varying vec3 vColor;
  void main() {
    vec3 n = normalize(position);
    vec3 t1 = normalize(cross(n, vec3(0.0, 1.0, 0.001)));
    vec3 t2 = cross(n, t1);
    float life = fract(uTime * (0.08 + aSeed * 0.06) + aSeed * 7.0);
    float spread = 0.02 + life * 0.09;
    vec3 p = n * (${R.toFixed(3)} + 0.03 + life * 0.42 * uMood) + (t1 * aOff.x + t2 * aOff.y) * spread;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec3 vn = normalize(normalMatrix * n);
    float facing = smoothstep(-0.1, 0.3, dot(vn, normalize(-mv.xyz)));
    vA = sin(life * 3.14159) * uMood * facing;
    vColor = aColor;
    gl_PointSize = uSize * (1.0 - life * 0.4) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
const moteFrag = /* glsl */ `
  varying float vA;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = exp(-d * d * 18.0) * vA;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
    #include <colorspace_fragment>
  }
`;

const ringVert = /* glsl */ `
  uniform float uTime, uShow;
  attribute float aPhase, aBorn;
  attribute vec3 aColor;
  varying float vA;
  varying vec3 vColor;
  void main() {
    // aBorn < 0: looping city ring; aBorn >= 0: one-shot ripple from a click
    float life = aBorn < 0.0 ? fract(uTime * 0.45 + aPhase) : clamp((uTime - aBorn) / 1.6, 0.0, 1.0);
    float show = aBorn < 0.0 ? uShow : step(0.0, aBorn) * (1.0 - step(1.0, life));
    vec3 p = position * (0.25 + life * 1.75);
    vA = (1.0 - life) * (1.0 - life) * show;
    vColor = aColor;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
  }
`;
const ringFrag = /* glsl */ `
  varying float vA;
  varying vec3 vColor;
  void main() {
    if (vA < 0.01) discard;
    gl_FragColor = vec4(vColor, vA * 0.9);
    #include <colorspace_fragment>
  }
`;

// ── geometry builders ──────────────────────────────────────────────────────

function buildDots() {
  const arr = dots as number[];
  const count = arr.length / 2;
  const pos = new Float32Array(count * 3);
  const scatter = new Float32Array(count * 3);
  const mood = new Float32Array(count * 3);
  const moodW = new Float32Array(count);
  const seed = new Float32Array(count);
  const v = new THREE.Vector3();
  const cityVecs = CITIES.map((c) => latLng(c.lat, c.lng));
  const col = new THREE.Color();
  let s = 1;
  const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < count; i++) {
    latLng(arr[i * 2], arr[i * 2 + 1], v);
    pos.set([v.x * R, v.y * R, v.z * R], i * 3);
    // scatter: pushed out along the normal and swirled, so the globe condenses
    const k = 1.8 + rand() * 1.6;
    const sw = (rand() - 0.5) * 1.2;
    const c = Math.cos(sw);
    const sn = Math.sin(sw);
    scatter.set([(v.x * c - v.z * sn) * R * k, v.y * R * k + (rand() - 0.5), (v.x * sn + v.z * c) * R * k], i * 3);
    seed[i] = rand();
    // nearest city mood → tint with falloff
    let best = 0;
    let bestD = 9;
    cityVecs.forEach((cv, j) => {
      const d = Math.acos(Math.min(1, v.dot(cv)));
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    });
    const w = Math.max(0, 1 - bestD / (15 * D2R));
    moodW[i] = w * w * (3 - 2 * w);
    col.copy(moodColors[CITIES[best].mood]);
    mood.set([col.r, col.g, col.b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aScatter", new THREE.BufferAttribute(scatter, 3));
  g.setAttribute("aMood", new THREE.BufferAttribute(mood, 3));
  g.setAttribute("aMoodW", new THREE.BufferAttribute(moodW, 1));
  g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R * 4);
  return g;
}

function buildMotes() {
  const per = 34;
  const n = CITIES.length * per;
  const pos = new Float32Array(n * 3);
  const color = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  const off = new Float32Array(n * 2);
  const v = new THREE.Vector3();
  let s = 3;
  const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  CITIES.forEach((c, ci) => {
    latLng(c.lat, c.lng, v);
    const col = moodColors[c.mood];
    for (let k = 0; k < per; k++) {
      const i = ci * per + k;
      pos.set([v.x, v.y, v.z], i * 3);
      color.set([col.r, col.g, col.b], i * 3);
      seed[i] = rand();
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand());
      off.set([Math.cos(a) * r, Math.sin(a) * r], i * 2);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
  g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  g.setAttribute("aOff", new THREE.BufferAttribute(off, 2));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R * 2);
  return g;
}

/** Orient an object on the sphere so its local +z points along the surface normal. */
function surfaceMatrix(n: THREE.Vector3, lift: number, scale: number, out: THREE.Matrix4) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  return out.compose(n.clone().multiplyScalar(R + lift), q, new THREE.Vector3(scale, scale, scale));
}

const MAX_DROPS = 12;
const HEX_RINGS = 3;

// ── scene ──────────────────────────────────────────────────────────────────

function WeatherScene({ index }: { index: number }) {
  const globe = useRef<THREE.Group>(null);
  const pins = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const hexes = useRef<THREE.InstancedMesh>(null);
  const hexEdges = useRef<THREE.InstancedMesh>(null);
  const dropPins = useRef<THREE.InstancedMesh>(null);
  const hexLabel = useRef<HTMLDivElement>(null);
  const boardDiv = useRef<HTMLDivElement>(null);
  const dropDiv = useRef<HTMLDivElement>(null);
  const dropAnchor = useRef<THREE.Group>(null);
  const clockRef = useRef(0);
  const [lastDrop, setLastDrop] = useState<number | null>(null);

  const dotGeo = useMemo(buildDots, []);
  const moteGeo = useMemo(buildMotes, []);
  const cityVecs = useMemo(() => CITIES.map((c) => latLng(c.lat, c.lng)), []);
  const focusVec = useMemo(() => latLng(FOCUS.lat, FOCUS.lng), []);

  const dotMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: dotVert,
        fragmentShader: dotFrag,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uForm: { value: 0 },
          uMood: { value: 0 },
          uSize: { value: 26 },
          uTime: { value: 0 },
          uBase: { value: new THREE.Color("#cfc9c0") },
        },
      }),
    [],
  );
  const moteMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: moteVert,
        fragmentShader: moteFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uMood: { value: 0 }, uSize: { value: 80 } },
      }),
    [],
  );
  const atmoMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: atmoVert,
        fragmentShader: atmoFrag,
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: new THREE.Color("#ffd98a") }, uStrength: { value: 0.5 }, uHalo: { value: 1 } },
      }),
    [],
  );
  const rimMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: atmoVert,
        fragmentShader: atmoFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: new THREE.Color("#fff1d6") }, uStrength: { value: 0.35 }, uHalo: { value: 0 } },
      }),
    [],
  );

  // city rings (looping) + click ripples share one instanced shader
  const ringCount = CITIES.length + MAX_DROPS;
  const ring = useMemo(() => {
    const geo = new THREE.RingGeometry(0.03, 0.036, 40);
    const phase = new Float32Array(ringCount);
    const born = new Float32Array(ringCount).fill(-1);
    const color = new Float32Array(ringCount * 3);
    CITIES.forEach((c, i) => {
      phase[i] = (i * 0.37) % 1;
      const col = moodInks[c.mood];
      color.set([col.r, col.g, col.b], i * 3);
    });
    for (let i = CITIES.length; i < ringCount; i++) born[i] = -2; // hidden until used
    geo.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phase, 1));
    geo.setAttribute("aBorn", new THREE.InstancedBufferAttribute(born, 1));
    geo.setAttribute("aColor", new THREE.InstancedBufferAttribute(color, 3));
    const mat = new THREE.ShaderMaterial({
      vertexShader: ringVert,
      fragmentShader: ringFrag,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uShow: { value: 0 } },
    });
    return { geo, mat, born: geo.getAttribute("aBorn") as THREE.InstancedBufferAttribute, color: geo.getAttribute("aColor") as THREE.InstancedBufferAttribute };
  }, [ringCount]);
  const rings = useRef<THREE.InstancedMesh>(null);

  // H3-ish hex cluster around the focus city (axial coords, flat on the tangent plane)
  const hexCells = useMemo(() => {
    const cells: { q: number; r: number; d: number; mood: number }[] = [];
    let s = 9;
    const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    const weights = [2, 5, 3, 1, 0, 1, 1, 0]; // this "city" leans hopeful
    const total = weights.reduce((a, b) => a + b, 0);
    for (let q = -HEX_RINGS; q <= HEX_RINGS; q++) {
      for (let r = Math.max(-HEX_RINGS, -q - HEX_RINGS); r <= Math.min(HEX_RINGS, -q + HEX_RINGS); r++) {
        const d = Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
        let x = rand() * total;
        let mood = 0;
        while (x > weights[mood]) x -= weights[mood++];
        cells.push({ q, r, d, mood });
      }
    }
    return cells;
  }, []);
  const HEX = 0.021;
  const hexFrame = useMemo(() => {
    // local frame at the focus city: +z = normal
    const m = new THREE.Matrix4();
    surfaceMatrix(focusVec, 0.004, 1, m);
    return m;
  }, [focusVec]);

  // drops
  const drops = useRef<{ n: THREE.Vector3; mood: number; born: number }[]>([]);

  const mat4 = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const scl = useMemo(() => new THREE.Vector3(), []);
  const colorTmp = useMemo(() => new THREE.Color(), []);

  // static instance colours
  const initPins = (m: THREE.InstancedMesh | null, ink: boolean) => {
    if (!m) return;
    CITIES.forEach((c, i) => m.setColorAt(i, (ink ? moodInks : moodColors)[c.mood]));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  };
  const initHex = (m: THREE.InstancedMesh | null) => {
    if (!m) return;
    hexCells.forEach((c, i) => m.setColorAt(i, moodColors[c.mood]));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  };

  useFrame((state) => {
    if (!worldActive(index)) {
      [hexLabel, boardDiv, dropDiv].forEach((r) => r.current && (r.current.style.opacity = "0"));
      return;
    }
    const t = state.clock.elapsedTime;
    clockRef.current = t;
    const p = scroll.world;
    const form = 0.06 + 0.94 * beat(p, 0, P.formEnd);
    const mood = beat(p, P.moodA, P.moodB);
    const zoom = beat(p, P.zoomA, P.zoomB) * (1 - beat(p, P.unzoomA, P.unzoomB));
    const drop = beat(p, P.dropA, P.dropA + 0.06);

    dotMat.uniforms.uForm.value = form;
    dotMat.uniforms.uMood.value = mood;
    dotMat.uniforms.uTime.value = t;
    // dots get relatively smaller as the camera closes in
    dotMat.uniforms.uSize.value = (26 - zoom * 6) * state.gl.getPixelRatio();
    moteMat.uniforms.uTime.value = t;
    moteMat.uniforms.uMood.value = mood * (1 - zoom * 0.6);
    moteMat.uniforms.uSize.value = 80 * state.gl.getPixelRatio();
    ring.mat.uniforms.uTime.value = t;
    ring.mat.uniforms.uShow.value = mood * (1 - zoom * 0.7);
    atmoMat.uniforms.uStrength.value = 0.08 + form * 0.3;
    rimMat.uniforms.uStrength.value = form * 0.3;

    // globe orientation: free spin, then swing the focus city to the camera
    const g = globe.current;
    if (g) {
      const free = freeYaw(p, t) + scroll.pointerX * 0.25;
      const yaw = free + wrap(focusYaw - free) * zoom;
      const pitch = BASE_TILT + scroll.pointerY * 0.08 + (focusPitch - BASE_TILT) * zoom;
      g.rotation.set(pitch, yaw, 0, "XYZ");
    }

    // pins rise out of each city
    const pm = pins.current;
    const hm = heads.current;
    if (pm && hm) {
      CITIES.forEach((c, i) => {
        const a = beat(mood, (i % 8) * 0.06, (i % 8) * 0.06 + 0.5);
        const h = Math.max(0.0001, a * (0.12 + ((i * 53) % 7) * 0.012) * (1 - zoom * 0.5));
        const n = cityVecs[i];
        q.setFromUnitVectors(up, n);
        tmp.copy(n).multiplyScalar(R);
        scl.set(1, h, 1);
        mat4.compose(tmp, q, scl);
        pm.setMatrixAt(i, mat4);
        tmp.copy(n).multiplyScalar(R + h);
        const bob = 1 + Math.sin(t * 3 + i) * 0.08;
        scl.setScalar(Math.max(0.0001, a * bob));
        mat4.compose(tmp, q, scl);
        hm.setMatrixAt(i, mat4);
      });
      pm.instanceMatrix.needsUpdate = true;
      hm.instanceMatrix.needsUpdate = true;
    }

    // hex cells pop out from the centre during the zoom
    const hx = hexes.current;
    const he = hexEdges.current;
    if (hx && he) {
      const hexOn = beat(p, P.zoomA + 0.06, P.zoomB + 0.04) * (1 - beat(p, P.unzoomA, P.unzoomB));
      hexCells.forEach((c, i) => {
        const a = beat(hexOn, c.d * 0.18, c.d * 0.18 + 0.4);
        const x = HEX * Math.sqrt(3) * (c.q + c.r / 2);
        const y = HEX * 1.5 * c.r;
        const pulse = c.d === 0 ? 1 + Math.sin(t * 4) * 0.06 : 1;
        tmp.set(x, y, 0.002 + a * 0.004);
        q.identity();
        scl.setScalar(Math.max(0.0001, a * 0.94 * pulse));
        mat4.compose(tmp, q, scl).premultiply(hexFrame);
        hx.setMatrixAt(i, mat4);
        scl.setScalar(Math.max(0.0001, a));
        mat4.compose(tmp, q, scl).premultiply(hexFrame);
        he.setMatrixAt(i, mat4);
      });
      hx.instanceMatrix.needsUpdate = true;
      he.instanceMatrix.needsUpdate = true;
      (hx.material as THREE.MeshBasicMaterial).opacity = 0.8 * hexOn;
      (he.material as THREE.MeshBasicMaterial).opacity = 0.55 * hexOn;
      if (hexLabel.current) hexLabel.current.style.opacity = String(beat(hexOn, 0.6, 1));
    }

    // city rings: fixed matrices, set once per frame (cheap) — click ripples too
    const rm = rings.current;
    if (rm) {
      CITIES.forEach((_, i) => rm.setMatrixAt(i, surfaceMatrix(cityVecs[i], 0.003, 1, mat4)));
      drops.current.forEach((d, j) => rm.setMatrixAt(CITIES.length + j, surfaceMatrix(d.n, 0.004, 1.4, mat4)));
      rm.instanceMatrix.needsUpdate = true;
    }

    // user-dropped pins
    const dp = dropPins.current;
    if (dp) {
      for (let j = 0; j < MAX_DROPS; j++) {
        const d = drops.current[j];
        if (!d) {
          mat4.makeScale(0.0001, 0.0001, 0.0001);
          dp.setMatrixAt(j, mat4);
          continue;
        }
        const a = beat(t - d.born, 0, 0.5);
        const over = 1 + Math.sin(Math.min(1, (t - d.born) / 0.5) * Math.PI) * 0.4;
        q.setFromUnitVectors(up, d.n);
        tmp.copy(d.n).multiplyScalar(R + 0.02 + a * 0.12);
        scl.setScalar(Math.max(0.0001, a * over));
        mat4.compose(tmp, q, scl);
        dp.setMatrixAt(j, mat4);
      }
      dp.instanceMatrix.needsUpdate = true;
    }
    const last = drops.current[drops.current.length - 1];
    if (dropAnchor.current && last) dropAnchor.current.position.copy(last.n).multiplyScalar(R + 0.3);
    if (dropDiv.current) {
      const age = last ? t - last.born : 99;
      dropDiv.current.style.opacity = String(beat(age, 0, 0.2) * (1 - beat(age, 2.2, 2.8)));
    }
    if (boardDiv.current) boardDiv.current.style.opacity = String(drop);
  });

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (!worldActive(index) || scroll.world < P.dropA || !globe.current) return;
    e.stopPropagation();
    const n = globe.current.worldToLocal(e.point.clone()).normalize();
    const moodIdx = Math.floor(Math.random() * MOODS.length);
    const t = clockRef.current;
    if (drops.current.length >= MAX_DROPS) drops.current.shift();
    drops.current.push({ n, mood: moodIdx, born: t });
    // refresh ripple slots + drop pin colours
    drops.current.forEach((d, j) => {
      const slot = CITIES.length + j;
      ring.born.setX(slot, d.born);
      colorTmp.copy(moodInks[d.mood]);
      ring.color.setXYZ(slot, colorTmp.r, colorTmp.g, colorTmp.b);
      dropPins.current?.setColorAt(j, moodColors[d.mood]);
    });
    ring.born.needsUpdate = true;
    ring.color.needsUpdate = true;
    if (dropPins.current?.instanceColor) dropPins.current.instanceColor.needsUpdate = true;
    setLastDrop(moodIdx);
  };
  const onMove = () => {
    if (worldActive(index) && scroll.world >= P.dropA) document.body.style.cursor = "crosshair";
  };
  const onOut = () => {
    document.body.style.cursor = "";
  };

  const hexShape = useMemo(() => new THREE.CircleGeometry(HEX, 6).rotateZ(Math.PI / 6), []);
  const hexEdge = useMemo(() => new THREE.RingGeometry(HEX * 0.88, HEX, 6).rotateZ(Math.PI / 6), []);
  const pinGeo = useMemo(() => new THREE.CylinderGeometry(0.0035, 0.0035, 1, 5).translate(0, 0.5, 0), []);
  const headGeo = useMemo(() => new THREE.SphereGeometry(0.022, 12, 10), []);
  const dropGeo = useMemo(() => {
    // teardrop pin: cone + sphere merged by stacking two meshes would cost draws; a lathe does it in one
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI;
      pts.push(new THREE.Vector2(Math.sin(a) * 0.035, 0.07 + Math.cos(a) * 0.035));
    }
    pts.push(new THREE.Vector2(0, -0.03));
    pts.reverse();
    return new THREE.LatheGeometry(pts, 16).translate(0, -0.02, 0);
  }, []);

  return (
    <group>
      <StageFloor radius={5} accent={ACCENT} />
      <BlobShadow size={2.6} opacity={0.5} />

      <group position-y={GLOBE_Y}>
        {/* atmosphere halo (outside) + soft limb light */}
        <mesh material={atmoMat} scale={1.2} raycast={() => null}>
          <sphereGeometry args={[R, 48, 32]} />
        </mesh>

        <group ref={globe}>
          {/* dark core: hides back-facing dots and takes clicks */}
          <mesh onPointerDown={onDown} onPointerMove={onMove} onPointerOut={onOut}>
            <sphereGeometry args={[R * 0.985, 48, 32]} />
            <meshBasicMaterial color="#1a1a1a" />
          </mesh>
          <mesh material={rimMat} scale={0.99} raycast={() => null}>
            <sphereGeometry args={[R, 48, 32]} />
          </mesh>
          <points geometry={dotGeo} material={dotMat} raycast={() => null} />
          <points geometry={moteGeo} material={moteMat} raycast={() => null} frustumCulled={false} />

          <instancedMesh
            ref={(m) => {
              pins.current = m;
              initPins(m, true);
            }}
            args={[pinGeo, undefined, CITIES.length]}
            frustumCulled={false}
            raycast={() => null}
          >
            <meshBasicMaterial color="#ffffff" transparent opacity={0.7} toneMapped={false} />
          </instancedMesh>
          <instancedMesh
            ref={(m) => {
              heads.current = m;
              initPins(m, false);
            }}
            args={[headGeo, undefined, CITIES.length]}
            frustumCulled={false}
            raycast={() => null}
          >
            <meshStandardMaterial color="#ffffff" roughness={0.35} emissive="#3a2a10" emissiveIntensity={0.4} />
          </instancedMesh>
          <instancedMesh ref={rings} args={[ring.geo, ring.mat, ringCount]} frustumCulled={false} raycast={() => null} />

          <instancedMesh
            ref={(m) => {
              hexes.current = m;
              initHex(m);
            }}
            args={[hexShape, undefined, hexCells.length]}
            frustumCulled={false}
            raycast={() => null}
          >
            <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} toneMapped={false} />
          </instancedMesh>
          <instancedMesh ref={hexEdges} args={[hexEdge, undefined, hexCells.length]} frustumCulled={false} raycast={() => null}>
            <meshBasicMaterial color="#fff6e6" transparent opacity={0} depthWrite={false} toneMapped={false} />
          </instancedMesh>
          <group position={focusVec.clone().multiplyScalar(R + 0.16)}>
            <Label>
              <div ref={hexLabel} className="world-label" style={{ "--accent": MOODS[1].ink, opacity: 0, position: "relative", top: -118 } as React.CSSProperties}>
                {FOCUS.name} <small>· H3 res 9 · mostly hopeful</small>
              </div>
            </Label>
          </group>

          <instancedMesh
            ref={dropPins}
            args={[dropGeo, undefined, MAX_DROPS]}
            frustumCulled={false}
            raycast={() => null}
          >
            <meshStandardMaterial color="#ffffff" roughness={0.3} emissive="#2a2016" emissiveIntensity={0.5} />
          </instancedMesh>
          <group ref={dropAnchor}>
            <Label zIndex={22}>
              <div
                ref={dropDiv}
                className="world-label"
                style={{ "--accent": lastDrop != null ? MOODS[lastDrop].ink : ACCENT, opacity: 0 } as React.CSSProperties}
              >
                {lastDrop != null ? MOODS[lastDrop].name : ""} <small>· dropped</small>
              </div>
            </Label>
          </group>
        </group>

        {/* demo leaderboard, anchored beside the globe (not rotating with it) */}
        <group position={[R * 1.22, R * 1.0, 0.2]}>
          <Label center={false}>
            <div ref={boardDiv} className="hw-board" style={{ opacity: 0 }}>
              <div className="world-label world-label--plain" style={{ padding: 0, border: 0, background: "none" }}>
                Happiest cities today
              </div>
              <ol>
                {LEADERBOARD.map((r, i) => (
                  <li key={r.city}>
                    <span>{i + 1}</span>
                    {r.city}
                    <b>{r.score}</b>
                  </li>
                ))}
              </ol>
              <small>Demo data · click the globe to drop a mood</small>
              <style>{BOARD_CSS}</style>
            </div>
          </Label>
        </group>
      </group>
    </group>
  );
}

const BOARD_CSS = `
.hw-board{font-family:var(--font-text),sans-serif;color:var(--fg,#f3efe9);background:rgba(29,29,29,.82);
border:1px solid rgba(243,239,233,.14);border-radius:14px;padding:12px 14px 10px;width:220px;
transition:opacity .35s cubic-bezier(.22,1,.36,1);pointer-events:none;user-select:none}
.hw-board ol{list-style:none;margin:10px 0 8px;padding:0;display:grid;gap:6px}
.hw-board li{display:flex;align-items:center;gap:10px;font-size:13px}
.hw-board li span{width:18px;height:18px;border-radius:50%;display:grid;place-items:center;font-size:10px;
background:rgba(247,183,51,.14);color:${ACCENT}}
.hw-board li b{margin-left:auto;font-weight:500;color:${ACCENT};font-variant-numeric:tabular-nums}
.hw-board small{display:block;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--fg-dim,#8a8580)}
`;

export const weatherWorld: WorldDef = {
  id: "weather",
  steps: [
    { at: 0, label: "Land cells", caption: "5,967 land cells condense into a globe." },
    { at: 0.2, label: "Mood weather", caption: "Feelings rise off cities like weather." },
    { at: 0.46, label: "H3 cells", caption: "Every mood lands in a resolution-9 hex." },
    { at: 0.76, label: "Drop yours", caption: "Click the globe to drop a mood — demo data." },
  ],
  camera: (p, t, out) => {
    const zoom = beat(p, P.zoomA, P.zoomB) * (1 - beat(p, P.unzoomA, P.unzoomB));
    const yaw = 0.18 - p * 0.3 + Math.sin(t * 0.1) * 0.03;
    const dist = 5.6 - beat(p, 0, 0.3) * 0.8 - zoom * 2.0;
    const lift = 0.35 - zoom * 0.25 + Math.sin(t * 0.13) * 0.03;
    out.target.set(0, GLOBE_Y + zoom * 0.02, 0);
    out.position.set(Math.sin(yaw) * dist, GLOBE_Y + lift * dist * 0.35, Math.cos(yaw) * dist);
  },
  Component: WeatherScene,
};
