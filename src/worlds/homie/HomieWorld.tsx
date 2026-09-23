"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { scroll, worldActive } from "@/animations/store";
import type { WorldDef } from "../types";
import { BlobShadow, StageFloor, beat } from "../shared";
import { ACCENT, DIM, createKit, type Kit } from "./parts";
import { createScreenMaterial, createSubtitle } from "./screen";
import { createLabel, type WorldLabel } from "./labels";
import { makeLegs, placeSegment, resetLegs, solveLeg, stepGait, footHome, type Leg } from "./gait";

// Homie, two stances. Story over world progress p:
//   0.00–0.30  desk stance: wakes up, eyes (and head) follow the cursor, says hi
//   0.30–0.55  switch: button press → body swings back, screen head drops to become the
//              front of the chassis, feet retract, four legs unfold, it stands up
//   0.56–0.86  walk: procedural diagonal-pair gait along a figure-eight, camera following
//   0.86–1.00  comes back to centre, faces you: "Run it back."

const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lin = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const backOut = (t: number, s = 1.9) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
const damp = THREE.MathUtils.damp;
function dampAngle(a: number, b: number, lambda: number, dt: number) {
  let d = ((b - a + Math.PI) % TAU) - Math.PI;
  if (d < -Math.PI) d += TAU;
  return a + d * (1 - Math.exp(-lambda * dt));
}

/** Scroll-scrubbed story windows */
const P = {
  morphStart: 0.3,
  morphEnd: 0.55,
  walkIn: [0.56, 0.62] as const,
  walkOut: [0.84, 0.9] as const,
};

/** State shared with the camera function (world-local). */
const shared = { focus: new THREE.Vector3() };

// ── walk path: a figure-eight through the origin, side-on to the camera ─────────
const PATH = { ax: 1.25, az: 0.62, speed: 0.42 };
function pathAt(theta: number, out: THREE.Vector3) {
  return out.set(PATH.ax * Math.sin(theta), 0, PATH.az * Math.sin(2 * theta));
}
function pathSpeed(theta: number) {
  return Math.hypot(PATH.ax * Math.cos(theta), 2 * PATH.az * Math.cos(2 * theta));
}

// ── desk ↔ spider poses (core-local) ─────────────────────────────────────────────
const POSE = {
  headDesk: new THREE.Vector3(0, 1.24, 0),
  headSpider: new THREE.Vector3(0, 0.06, 0.33),
  bodyDesk: new THREE.Vector3(0, 0.47, 0),
  bodySpider: new THREE.Vector3(0, 0.02, -0.33),
  crouch: 0.31,
  stand: 0.24,
};
const FEET_X = 0.22;

const SUBTITLES: [number, number, string][] = [
  [0.02, 0.13, "Hey. I'm Homie."],
  [0.3, 0.36, "Switching stance…"],
  [0.6, 0.68, "Left. Right. Left."],
  [0.88, 0.95, "Run it back."],
];

// ── camera keys: p, azimuth, elevation, distance, target height ──────────────────
const CAM_KEYS: number[][] = [
  [0.0, -0.55, 0.1, 4.8, 0.84],
  [0.15, -0.32, 0.08, 4.0, 0.95],
  [0.3, -0.16, 0.1, 4.0, 0.88],
  [0.42, 0.45, 0.22, 4.2, 0.62],
  [0.55, 0.72, 0.3, 4.4, 0.52],
  [0.7, 1.2, 0.3, 4.7, 0.48],
  [0.84, 0.95, 0.24, 4.6, 0.52],
  [0.94, 0.2, 0.05, 3.5, 0.6],
  [1.0, 0.12, 0.03, 3.3, 0.62],
];
const camKey = [0, 0, 0, 0];
function sampleCam(p: number) {
  const k = CAM_KEYS;
  let i = 0;
  while (i < k.length - 2 && p > k[i + 1][0]) i++;
  const k0 = k[Math.max(0, i - 1)];
  const k1 = k[i];
  const k2 = k[i + 1];
  const k3 = k[Math.min(k.length - 1, i + 2)];
  const t = clamp01((p - k1[0]) / (k2[0] - k1[0]));
  const t2 = t * t;
  const t3 = t2 * t;
  for (let c = 1; c < 5; c++) {
    // Catmull-Rom so the camera never stops dead at a key
    camKey[c - 1] =
      0.5 *
      (2 * k1[c] +
        (-k0[c] + k2[c]) * t +
        (2 * k0[c] - 5 * k1[c] + 4 * k2[c] - k3[c]) * t2 +
        (-k0[c] + 3 * k1[c] - 3 * k2[c] + k3[c]) * t3);
  }
  return camKey;
}

// ── imperative leg rig ───────────────────────────────────────────────────────────
type LegRig = {
  femur: THREE.Mesh;
  tibia: THREE.Mesh;
  knee: THREE.Mesh;
  toe: THREE.Mesh;
  hipW: THREE.Vector3;
  kneeW: THREE.Vector3;
  hinge: THREE.Vector3;
  outward: THREE.Vector3;
  scale: number;
};

function buildLegs(kit: Kit, count: number) {
  const group = new THREE.Group();
  const rigs: LegRig[] = [];
  for (let i = 0; i < count; i++) {
    const femur = new THREE.Mesh(kit.geo.femur, kit.mat.cream);
    const tibia = new THREE.Mesh(kit.geo.tibia, kit.mat.creamShade);
    tibia.add(new THREE.Mesh(kit.geo.tibiaCuff, kit.mat.orange));
    const knee = new THREE.Mesh(kit.geo.knee, kit.mat.black);
    knee.add(new THREE.Mesh(kit.geo.kneeCap, kit.mat.orange));
    const toe = new THREE.Mesh(kit.geo.toeTip, kit.mat.black);
    group.add(femur, tibia, knee, toe);
    rigs.push({
      femur,
      tibia,
      knee,
      toe,
      hipW: new THREE.Vector3(),
      kneeW: new THREE.Vector3(),
      hinge: new THREE.Vector3(),
      outward: new THREE.Vector3(),
      scale: 0,
    });
  }
  return { group, rigs };
}

function buildRipples(count: number) {
  const group = new THREE.Group();
  const geo = new THREE.RingGeometry(0.9, 1, 56);
  geo.rotateX(-Math.PI / 2);
  const items = Array.from({ length: count }, () => {
    const mat = new THREE.MeshBasicMaterial({
      color: ACCENT,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    mesh.raycast = () => null;
    group.add(mesh);
    return { mesh, mat, age: 1 };
  });
  return { group, items, geo };
}

function buildPathDots(count: number) {
  const geo = new THREE.CircleGeometry(0.016, 10);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: ACCENT,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    pathAt((i / count) * TAU, v);
    m.makeTranslation(v.x, 0.003, v.z);
    mesh.setMatrixAt(i, m);
  }
  mesh.raycast = () => null;
  mesh.renderOrder = 0;
  return { mesh, mat, geo };
}

// ─────────────────────────────────────────────────────────────────────────────────

function HomieScene({ index }: { index: number }) {
  const kit = useMemo(createKit, []);
  const subtitle = useMemo(createSubtitle, []);
  const screenMat = useMemo(() => createScreenMaterial(subtitle.texture), [subtitle]);
  const legs = useMemo<Leg[]>(makeLegs, []);
  const legRig = useMemo(() => buildLegs(kit, legs.length), [kit, legs]);
  const ripples = useMemo(() => buildRipples(8), []);
  const dots = useMemo(() => buildPathDots(120), []);

  useEffect(
    () => () => {
      kit.dispose();
      subtitle.texture.dispose();
      screenMat.dispose();
      ripples.geo.dispose();
      ripples.items.forEach((r) => r.mat.dispose());
      dots.geo.dispose();
      dots.mat.dispose();
    },
    [kit, subtitle, screenMat, ripples, dots],
  );

  const walker = useRef<THREE.Group>(null);
  const core = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const headLook = useRef<THREE.Group>(null);
  const button = useRef<THREE.Mesh>(null);
  const neck = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const feet = useRef<(THREE.Group | null)[]>([]);
  const hips = useRef<(THREE.Group | null)[]>([]);
  const bodyShadow = useRef<THREE.Group>(null);
  const footShadows = useRef<(THREE.Mesh | null)[]>([]);
  const labels = useRef<WorldLabel[]>([]);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const host = gl.domElement.parentElement;
    if (!host) return;
    const made = [
      createLabel(host, "Two stances. Same mouth.", ACCENT),
      createLabel(host, "4-leg walk <small>\u00b7 preview</small>", ACCENT),
    ];
    labels.current = made;
    return () => {
      made.forEach((l) => l.dispose());
      labels.current = [];
    };
  }, [gl]);

  const sim = useMemo(
    () => ({
      active: false,
      m: 0,
      theta: 0,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      heading: 0,
      turnRate: 0,
      impact: 0,
      flash: 0,
      wasSpider: false,
      look: new THREE.Vector2(),
      blinkAt: 2,
      landed: [] as number[],
      rippleNext: 0,
      tmp: new THREE.Vector3(),
      tmp2: new THREE.Vector3(),
      target: new THREE.Vector3(),
      mat: new THREE.Matrix4(),
      ndc: new THREE.Vector3(),
    }),
    [],
  );

  useFrame((state, rawDt) => {
    const on = worldActive(index);
    if (!on) {
      if (sim.active) {
        sim.active = false;
        labels.current.forEach((l) => l.update(sim.tmp, state.camera, state.size, 0));
      }
      return;
    }
    const w = walker.current;
    const c = core.current;
    const h = head.current;
    const hl = headLook.current;
    const b = body.current;
    if (!w || !c || !h || !hl || !b) return;

    const dt = Math.min(rawDt, 1 / 20);
    const t = state.clock.elapsedTime;
    const p = clamp01(scroll.world);
    const first = !sim.active;
    sim.active = true;

    // ── story targets ──
    const mScroll = lin(p, P.morphStart, P.morphEnd);
    const walkScroll = beat(p, P.walkIn[0], P.walkIn[1]) * (1 - beat(p, P.walkOut[0], P.walkOut[1]));
    const away = Math.hypot(sim.pos.x, sim.pos.z);
    // a walking spider first walks home before folding back into a desk robot
    const mGoal = mScroll < 1 && away > 0.12 ? 1 : mScroll;
    if (first) {
      sim.m = mScroll;
      sim.pos.set(0, 0, 0);
      sim.vel.set(0, 0, 0);
      sim.heading = 0;
      if (mScroll >= 1 && walkScroll > 0) {
        pathAt(sim.theta, sim.pos).multiplyScalar(walkScroll);
      }
    } else {
      sim.m = damp(sim.m, mGoal, 7, dt);
      if (Math.abs(sim.m - mGoal) < 1e-3) sim.m = mGoal;
    }
    const m = sim.m;
    const spider = m >= 0.999;
    const W = spider ? walkScroll : 0;

    // ── locomotion ──
    if (W > 0.001) sim.theta += (dt * PATH.speed * W) / Math.max(0.2, pathSpeed(sim.theta));
    pathAt(sim.theta, sim.target).multiplyScalar(W);
    if (!spider) sim.target.set(0, 0, 0);
    if (!first) {
      const desired = sim.tmp.subVectors(sim.target, sim.pos).multiplyScalar(3.2);
      desired.y = 0;
      const max = 0.75;
      if (desired.length() > max) desired.setLength(max);
      sim.vel.x = damp(sim.vel.x, desired.x, 5, dt);
      sim.vel.z = damp(sim.vel.z, desired.z, 5, dt);
      if (!spider) sim.vel.set(0, 0, 0);
      sim.pos.addScaledVector(sim.vel, dt);
      if (!spider) sim.pos.set(0, 0, 0);
    }
    const speed = Math.hypot(sim.vel.x, sim.vel.z);
    const prevHeading = sim.heading;
    const wantHeading = speed > 0.07 ? Math.atan2(sim.vel.x, sim.vel.z) : W > 0.5 ? sim.heading : 0;
    sim.heading = first ? (speed > 0.07 ? wantHeading : 0) : dampAngle(sim.heading, wantHeading, 3.2, dt);
    sim.turnRate = damp(sim.turnRate, (sim.heading - prevHeading) / Math.max(dt, 1e-4), 6, dt);

    // ── morph sub-beats ──
    const press = beat(m, 0.0, 0.05) * (1 - beat(m, 0.09, 0.15)) + (m <= 0 ? 0 : 0);
    const neckS = 1 - beat(m, 0.05, 0.13);
    const bodyT = easeInOut(lin(m, 0.08, 0.34));
    const headZ = easeInOut(lin(m, 0.12, 0.3));
    const headY = easeInOut(lin(m, 0.2, 0.45));
    const headNod = Math.sin(Math.PI * lin(m, 0.12, 0.47)) * 0.3;
    const feetT = easeInOut(lin(m, 0.1, 0.3));
    const crouch = easeInOut(lin(m, 0.1, 0.45)) * POSE.crouch;
    const stand = backOut(lin(m, 0.72, 0.97), 1.6) * POSE.stand;
    const desk = 1 - lin(m, 0, 0.2);

    if (spider && !sim.wasSpider && !first) sim.flash = 1;
    sim.wasSpider = spider;
    sim.flash = Math.max(0, sim.flash - dt * 2.2);

    // ── pointer look (eyes + head) ──
    hl.getWorldPosition(sim.ndc).project(state.camera);
    const lx = THREE.MathUtils.clamp((state.pointer.x - sim.ndc.x) * 1.5, -1, 1);
    const ly = THREE.MathUtils.clamp((state.pointer.y - sim.ndc.y) * 1.5, -1, 1);
    const lookW = spider ? 0.55 : 1;
    sim.look.x = damp(sim.look.x, lx * lookW, 6, dt);
    sim.look.y = damp(sim.look.y, ly * lookW, 6, dt);

    // ── walker + core ──
    w.position.set(sim.pos.x, 0, sim.pos.z);
    w.rotation.y = sim.heading;
    let lift = 0;
    let roll = 0;
    let pitch = 0;
    if (spider) {
      for (const leg of legs) {
        roll += leg.lift * leg.side * 0.045;
        pitch -= leg.lift * leg.front * 0.03;
        lift += leg.lift;
      }
      roll -= THREE.MathUtils.clamp(sim.turnRate, -2, 2) * 0.05;
      pitch += speed * 0.09;
    }
    sim.impact = Math.max(0, sim.impact - dt * 7);
    const breathe = Math.sin(t * 1.9) * (spider ? 0.01 : 0.004);
    c.position.y = crouch + stand + breathe - sim.impact * 0.03 + lift * 0.006;
    c.rotation.x = damp(c.rotation.x, pitch, 8, dt);
    c.rotation.z = damp(c.rotation.z, roll, 8, dt);

    // head: desk → spider front
    h.position.set(
      0,
      THREE.MathUtils.lerp(POSE.headDesk.y, POSE.headSpider.y, headY),
      THREE.MathUtils.lerp(POSE.headDesk.z, POSE.headSpider.z, headZ),
    );
    h.rotation.x = headNod;
    const idle = desk * (Math.sin(t * 1.6) * 0.008);
    h.position.y += idle;
    hl.rotation.y = damp(hl.rotation.y, sim.look.x * (spider ? 0.12 : 0.3), 7, dt);
    hl.rotation.x = damp(hl.rotation.x, -sim.look.y * (spider ? 0.06 : 0.14), 7, dt);
    hl.rotation.z = desk * Math.sin(t * 0.7) * 0.02;

    if (button.current) button.current.position.y = 0.385 - press * 0.022;
    kit.mat.orange.emissiveIntensity = press * 1.2 + Math.sin(Math.PI * lin(m, 0.05, 0.95)) * 0.5 + sim.flash * 0.8;

    if (neck.current) {
      neck.current.scale.setScalar(Math.max(neckS, 1e-3));
      neck.current.visible = neckS > 0.01;
    }
    b.position.lerpVectors(POSE.bodyDesk, POSE.bodySpider, bodyT);
    b.rotation.x = -Math.PI / 2 * bodyT;
    // the chassis widens a touch to match the head once it's lying down
    b.scale.set(1 + bodyT * 0.14, 1, 1 + bodyT * 0.06);

    feet.current.forEach((f, i) => {
      if (!f) return;
      const side = i === 0 ? 1 : -1;
      f.position.set(side * FEET_X * (1 - feetT * 0.4), 0.06 + feetT * 0.1, 0.03 - feetT * 0.25);
      f.scale.setScalar(Math.max(1 - feetT, 1e-3));
      f.visible = feetT < 0.995;
    });

    // ── legs ──
    w.updateMatrix();
    c.updateMatrix();
    sim.mat.multiplyMatrices(w.matrix, c.matrix);
    const cosH = Math.cos(sim.heading);
    const sinH = Math.sin(sim.heading);
    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      const rig = legRig.rigs[i];
      const order = [0, 1, 2, 3][i];
      const e = lin(m, 0.42 + order * 0.06, 0.72 + order * 0.06);
      rig.scale = Math.max(0, backOut(lin(e, 0, 0.45), 1.4));
      rig.hipW.copy(leg.hip).applyMatrix4(sim.mat);
      rig.outward.set(leg.side * cosH, 0, -leg.side * sinH);
      if (!spider || first) {
        // morph: foot swings from tucked against the hull out to its rest point
        const rest = footHome(leg, sim.pos.x, sim.pos.z, sim.heading, sim.tmp2.set(0, 0, 0), 0, sim.tmp);
        const reach = easeOut(lin(e, 0.25, 1));
        const tucked = sim.target.copy(rig.hipW).addScaledVector(rig.outward, 0.2);
        tucked.y += 0.02;
        leg.foot.lerpVectors(tucked, rest, reach);
        leg.foot.y = Math.max(0, leg.foot.y + Math.sin(Math.PI * reach) * 0.22 * (1 - reach * 0.3));
        if (reach >= 1) leg.foot.y = 0;
        leg.step = -1;
        leg.lift = 0;
      }
    }
    if (first && spider) resetLegs(legs, sim.pos.x, sim.pos.z, sim.heading);
    if (spider && !first) {
      stepGait(legs, dt, sim.pos.x, sim.pos.z, sim.heading, sim.vel, sim.turnRate, sim.landed);
      for (const li of sim.landed) {
        sim.impact = Math.min(1, sim.impact + 0.5);
        const r = ripples.items[sim.rippleNext];
        sim.rippleNext = (sim.rippleNext + 1) % ripples.items.length;
        r.age = 0;
        r.mesh.position.set(legs[li].foot.x, 0.004, legs[li].foot.z);
        r.mesh.visible = true;
      }
    }
    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      const rig = legRig.rigs[i];
      const s = rig.scale;
      const vis = s > 0.002;
      rig.femur.visible = rig.tibia.visible = rig.knee.visible = rig.toe.visible = vis;
      const hp = hips.current[i];
      if (hp) {
        hp.scale.setScalar(Math.max(1e-3, backOut(lin(m, 0.36 + i * 0.03, 0.5 + i * 0.03), 1.6)));
        hp.visible = m > 0.36;
        hp.rotation.y = Math.atan2(leg.foot.x - rig.hipW.x, leg.foot.z - rig.hipW.z) - sim.heading;
      }
      if (!vis) continue;
      const a = DIM.femur * s;
      const bl = DIM.tibia * s;
      solveLeg(rig.hipW, leg.foot, a, bl, rig.kneeW, rig.hinge, rig.outward);
      placeSegment(rig.femur, rig.hipW, rig.kneeW, rig.hinge);
      rig.femur.scale.setScalar(s);
      placeSegment(rig.tibia, rig.kneeW, leg.foot, rig.hinge);
      rig.tibia.scale.setScalar(s);
      rig.knee.position.copy(rig.kneeW);
      rig.knee.quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, rig.hinge);
      rig.knee.scale.setScalar(s);
      // toe at the actual end of the shin (the foot target may be out of reach mid-unfold)
      rig.toe.position.set(0, bl, 0).applyQuaternion(rig.tibia.quaternion).add(rig.kneeW);
      rig.toe.scale.setScalar(s);
      const fs = footShadows.current[i];
      if (fs) {
        fs.position.set(rig.toe.position.x, 0.003, rig.toe.position.z);
        const o = s * (1 - clamp01(rig.toe.position.y / 0.3));
        (fs.material as THREE.MeshBasicMaterial).opacity = 0.45 * o;
        fs.visible = o > 0.01;
      }
    }
    for (let i = 0; i < legs.length; i++) {
      const fs = footShadows.current[i];
      if (fs && legRig.rigs[i].scale <= 0.002) fs.visible = false;
    }

    // ── floor fx ──
    for (const r of ripples.items) {
      if (r.age >= 1) continue;
      r.age = Math.min(1, r.age + dt / 0.7);
      const e = easeOut(r.age);
      r.mesh.scale.setScalar(0.05 + e * 0.38);
      r.mat.opacity = 0.6 * (1 - r.age);
      if (r.age >= 1) r.mesh.visible = false;
    }
    dots.mat.opacity = damp(dots.mat.opacity, walkScroll * (spider ? 0.55 : 0), 4, dt);
    dots.mesh.visible = dots.mat.opacity > 0.01;

    if (bodyShadow.current) {
      const bs = bodyShadow.current;
      bs.position.set(sim.pos.x, 0, sim.pos.z);
      bs.rotation.y = sim.heading;
      const sp = lin(m, 0.1, 0.9);
      bs.scale.set(THREE.MathUtils.lerp(1.25, 1.6, sp), 1, THREE.MathUtils.lerp(1.0, 1.7, sp));
      const mesh = bs.children[0] as THREE.Mesh;
      (mesh.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.lerp(0.7, 0.42, lin(m, 0.7, 1));
    }

    // ── screen ──
    if (t > sim.blinkAt + 0.16) sim.blinkAt = t + 2.2 + Math.random() * 3.2;
    const bt = t - sim.blinkAt;
    const blink = bt > 0 && bt < 0.16 ? Math.sin((bt / 0.16) * Math.PI) : 0;
    const wake = 0.28 + 0.72 * easeOut(lin(p, 0.0, 0.07));
    let line = "";
    let typing = false;
    for (const [a, z, text] of SUBTITLES) {
      if (p >= a) {
        const n = Math.round(lin(p, a, z) * text.length);
        line = text.slice(0, n);
        typing = n > 0 && n < text.length;
      }
    }
    const cursor = typing || (line.length > 0 && Math.floor(t * 2.2) % 2 === 0);
    subtitle.draw(line, cursor);
    const u = screenMat.uniforms;
    u.uTime.value = t;
    u.uLook.value.copy(sim.look);
    const morphing = m > 0.001 && m < 0.999;
    u.uOpen.value = wake * (1 - blink * 0.92) * (morphing ? 0.75 : 1);
    u.uBars.value = damp(u.uBars.value, morphing ? 1 : typing ? 0.35 : 0, 6, dt);
    u.uProgress.value = morphing ? m : -1;
    u.uFlash.value = sim.flash * 0.5;

    // ── labels + camera focus ──
    const [l1, l2] = labels.current;
    if (l1 && l2) {
      // anchors live in world-local space; lift them into the scene via the root group
      const root = w.parent!;
      sim.tmp.set(sim.pos.x + 0.95, 1.78 - crouch, sim.pos.z);
      l1.update(root.localToWorld(sim.tmp), state.camera, state.size, beat(p, 0.1, 0.17) * (1 - beat(p, 0.5, 0.56)));
      sim.tmp.set(sim.pos.x, 1.42, sim.pos.z);
      l2.update(root.localToWorld(sim.tmp), state.camera, state.size, spider ? walkScroll : 0);
    }
    if (first) shared.focus.copy(sim.pos);
    else {
      shared.focus.x = damp(shared.focus.x, sim.pos.x, 2.5, dt);
      shared.focus.z = damp(shared.focus.z, sim.pos.z, 2.5, dt);
    }
  });

  const { geo, mat } = kit;
  const [, hh] = DIM.head;
  const [bw, bh, bd] = DIM.body;

  return (
    <group>
      <StageFloor radius={5.5} spacing={0.25} />
      <primitive object={dots.mesh} />
      <primitive object={ripples.group} />
      <group ref={bodyShadow}>
        <BlobShadow size={1} opacity={0.7} />
      </group>
      {legs.map((_, i) => (
        <BlobShadow
          key={i}
          size={0.32}
          opacity={0}
          ref={(el: THREE.Mesh | null) => {
            footShadows.current[i] = el;
          }}
        />
      ))}

      <group ref={walker}>
        <group ref={core}>
          {/* ── head: screen, bezel, button, logo ── */}
          <group ref={head}>
            <group ref={headLook}>
              <mesh geometry={geo.head} material={mat.cream} />
              <mesh geometry={geo.bezel} material={mat.glass} position={[0, 0.0, DIM.head[2] / 2 - 0.012]} />
              <mesh geometry={geo.screen} material={screenMat} position={[0, 0.0, DIM.head[2] / 2 + 0.0095]} />
              <mesh geometry={geo.buttonBase} material={mat.black} position={[0.27, hh / 2 + 0.005, -0.04]} />
              <mesh ref={button} geometry={geo.button} material={mat.orange} position={[0.27, 0.385, -0.04]} />
              <mesh geometry={geo.ledStrip} material={mat.orange} position={[-0.22, hh / 2 - 0.004, 0.2]} />
              <mesh
                geometry={geo.logo}
                material={mat.logo}
                position={[DIM.head[0] / 2 + 0.002, 0.08, -0.05]}
                rotation-y={Math.PI / 2}
              />
              <mesh
                geometry={geo.logo}
                material={mat.logo}
                position={[-DIM.head[0] / 2 - 0.002, 0.08, -0.05]}
                rotation-y={-Math.PI / 2}
              />
            </group>
          </group>

          <group ref={neck} position={[0, 0.84, 0]}>
            <mesh geometry={geo.neck} material={mat.black} />
          </group>

          {/* ── body: two shells with a dark seam, grille on the front ── */}
          <group ref={body}>
            <mesh geometry={geo.bodyUpper} material={mat.cream} position={[0, bh / 2 - (bh * 0.62) / 2, 0]} />
            <mesh geometry={geo.bodyCore} material={mat.black} position={[0, -0.086, 0]} />
            <mesh geometry={geo.bodyLower} material={mat.creamShade} position={[0, -bh / 2 + (bh * 0.36) / 2, 0]} />
            <mesh geometry={geo.grille} material={mat.grille} position={[0, 0.13, bd / 2 + 0.002]} scale={[1, 0.86, 1]} />
            <mesh geometry={geo.ledStrip} material={mat.orange} position={[0, -0.21, bd / 2 * 0.97 + 0.004]} />
            <mesh geometry={geo.sideStrip} material={mat.orange} position={[bw / 2 + 0.004, 0.13, 0]} />
            <mesh geometry={geo.sideStrip} material={mat.orange} position={[-bw / 2 - 0.004, 0.13, 0]} />
          </group>

          {/* ── desk feet with black toe caps ── */}
          {[1, -1].map((side, i) => (
            <group
              key={side}
              ref={(el) => {
                feet.current[i] = el;
              }}
              position={[side * FEET_X, 0.06, 0.03]}
            >
              <mesh geometry={geo.foot} material={mat.cream} />
              <mesh geometry={geo.toe} material={mat.black} position={[0, 0, 0.15]} />
            </group>
          ))}

          {/* ── hip servos (only in spider stance) ── */}
          {legs.map((leg, i) => (
            <group
              key={i}
              ref={(el) => {
                hips.current[i] = el;
              }}
              position={leg.hip}
              visible={false}
            >
              <mesh geometry={geo.hip} material={mat.black} />
              <mesh geometry={geo.hipCap} material={mat.orange} position={[0, 0.075, 0]} />
            </group>
          ))}
        </group>
      </group>

      <primitive object={legRig.group} />

    </group>
  );
}

export const homieWorld: WorldDef = {
  id: "homie",
  steps: [
    {
      at: 0,
      label: "Desk stance",
      caption: "A screen that talks back. Face tracking drives the eyes, so it looks at you.",
    },
    {
      at: 0.3,
      label: "Switch",
      caption: "Same head, new body. The screen folds down into the front of a four-legged chassis.",
    },
    {
      at: 0.56,
      label: "4-leg walk",
      caption: "Preview gait: diagonal pairs, planted feet, two-joint IK. Concept, not shipped hardware.",
    },
    {
      at: 0.86,
      label: "Run it back",
      caption: "Two stances. Same mouth.",
    },
  ],
  camera: (p, t, out) => {
    const [az0, el0, dist, ty] = sampleCam(clamp01(p));
    const az = az0 + Math.sin(t * 0.23) * 0.05;
    const el = el0 + Math.sin(t * 0.31) * 0.015;
    const f = shared.focus;
    out.target.set(f.x, ty, f.z);
    out.position.set(
      f.x + dist * Math.sin(az) * Math.cos(el),
      ty + dist * Math.sin(el),
      f.z + dist * Math.cos(az) * Math.cos(el),
    );
  },
  Component: HomieScene,
};
