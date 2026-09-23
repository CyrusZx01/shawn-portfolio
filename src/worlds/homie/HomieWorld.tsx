"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { scroll, worldActive } from "@/animations/store";
import type { WorldDef } from "../types";
import { BlobShadow, StageFloor, beat } from "../shared";
import { ACCENT, createKit } from "./parts";
import { createScreenMaterial, createSubtitle } from "./screen";
import { createLabel, type WorldLabel } from "./labels";
import { makeLegs, placeSegment, resetLegs, solveLeg, stepGait } from "./gait";
import { buildDesk, DESK_SCREEN } from "./desk";
import { buildSpider, FEMUR, TIBIA, SIT_Y, STAND_Y, SPIDER_SCREEN } from "./spider";

// Homie is two products that share one voice, not one robot that transforms.
// Both stand on the same stage; story over world progress p:
//   0.00–0.30  Homie (desktop): wakes up, waves, eyes and head follow the cursor
//   0.30–0.56  Spider Homie (concept) next to it powers on and stands up; Homie watches it
//   0.56–0.86  Spider walks a figure-eight: diagonal-pair gait, planted feet, 2-joint IK
//   0.86–1.00  Spider walks home; both face you: "Run it back."

const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lin = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const damp = THREE.MathUtils.damp;
function dampAngle(a: number, b: number, lambda: number, dt: number) {
  let d = ((b - a + Math.PI) % TAU) - Math.PI;
  if (d < -Math.PI) d += TAU;
  return a + d * (1 - Math.exp(-lambda * dt));
}

/** stage layout (world-local) */
const DESK = new THREE.Vector3(-1.3, 0, 0);
const DESK_YAW = 0.16;
const HOME = new THREE.Vector3(1.32, 0, 0.05);
const HOME_YAW = -0.2;

const P = {
  wake: 0.33,
  walkIn: [0.56, 0.62] as const,
  walkOut: [0.84, 0.9] as const,
};

/** State shared with the camera function (world-local). */
const shared = { spider: HOME.clone() };

// ── walk path: a figure-eight around the spider's spot, side-on to the camera ──────
const PATH = { ax: 0.85, az: 0.5, speed: 0.42 };
function pathAt(theta: number, out: THREE.Vector3) {
  return out.set(PATH.ax * Math.sin(theta), 0, PATH.az * Math.sin(2 * theta));
}
function pathSpeed(theta: number) {
  return Math.hypot(PATH.ax * Math.cos(theta), 2 * PATH.az * Math.cos(2 * theta));
}

type Line = [number, number, string];
const DESK_LINES: Line[] = [
  [0.03, 0.11, "Hey. I'm Homie."],
  [0.16, 0.25, "Nice accent. Almost."],
  [0.35, 0.41, "Oh. Him."],
  [0.62, 0.68, "Show-off."],
  [0.88, 0.94, "Run it back."],
];
const SPIDER_LINES: Line[] = [
  [0.42, 0.49, "Same mouth."],
  [0.66, 0.74, "Left. Right. Left."],
  [0.9, 0.96, "Run it back."],
];
function typed(p: number, lines: Line[]) {
  let line = "";
  let typing = false;
  for (const [a, z, text] of lines) {
    if (p >= a) {
      const n = Math.round(lin(p, a, z) * text.length);
      line = text.slice(0, n);
      typing = n > 0 && n < text.length;
    }
  }
  return { line, typing };
}

// ── camera keys: p, azimuth, elevation, distance, target height, focus (0 Homie → 1 Spider)
const CAM_KEYS: number[][] = [
  [0.0, -0.5, 0.12, 4.0, 0.9, 0],
  [0.14, -0.22, 0.07, 3.3, 0.95, 0],
  [0.28, -0.02, 0.1, 3.8, 0.85, 0.2],
  [0.4, 0.3, 0.18, 3.7, 0.5, 0.95],
  [0.55, 0.55, 0.26, 4.2, 0.45, 1],
  [0.7, 0.95, 0.3, 4.6, 0.45, 1],
  [0.84, 0.55, 0.22, 5.0, 0.6, 0.75],
  [0.94, 0.08, 0.1, 5.9, 0.72, 0.6],
  [1.0, 0.03, 0.08, 5.8, 0.74, 0.6],
];
const camKey = [0, 0, 0, 0, 0];
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
  for (let c = 1; c < 6; c++) {
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
    pathAt((i / count) * TAU, v).add(HOME);
    m.makeTranslation(v.x, 0.003, v.z);
    mesh.setMatrixAt(i, m);
  }
  mesh.raycast = () => null;
  mesh.renderOrder = 0;
  return { mesh, mat, geo };
}

const UP = new THREE.Vector3(0, 1, 0);

// ─────────────────────────────────────────────────────────────────────────────────

function HomieScene({ index }: { index: number }) {
  const kit = useMemo(createKit, []);
  const deskSub = useMemo(createSubtitle, []);
  const spiderSub = useMemo(createSubtitle, []);
  const deskScreen = useMemo(() => createScreenMaterial(deskSub.texture, DESK_SCREEN[0] / DESK_SCREEN[1]), [deskSub]);
  const spiderScreen = useMemo(
    () => createScreenMaterial(spiderSub.texture, SPIDER_SCREEN[0] / SPIDER_SCREEN[1]),
    [spiderSub],
  );
  const legs = useMemo(makeLegs, []);
  const desk = useMemo(() => buildDesk(kit, deskScreen), [kit, deskScreen]);
  const spider = useMemo(() => buildSpider(kit, spiderScreen, legs), [kit, spiderScreen, legs]);
  const ripples = useMemo(() => buildRipples(8), []);
  const dots = useMemo(() => buildPathDots(120), []);

  useEffect(
    () => () => {
      kit.dispose();
      deskSub.texture.dispose();
      spiderSub.texture.dispose();
      deskScreen.dispose();
      spiderScreen.dispose();
      ripples.geo.dispose();
      ripples.items.forEach((r) => r.mat.dispose());
      dots.geo.dispose();
      dots.mat.dispose();
    },
    [kit, deskSub, spiderSub, deskScreen, spiderScreen, ripples, dots],
  );

  const root = useRef<THREE.Group>(null);
  const spiderShadow = useRef<THREE.Mesh>(null);
  const footShadows = useRef<(THREE.Mesh | null)[]>([]);
  const labels = useRef<WorldLabel[]>([]);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const host = gl.domElement.parentElement;
    if (!host) return;
    const made = [
      createLabel(host, "Homie <small>· desktop</small>", ACCENT),
      createLabel(host, "Spider Homie <small>· concept</small>", ACCENT),
      createLabel(host, "4-leg walk <small>· preview</small>", ACCENT),
      createLabel(host, "Two stances. Same mouth.", ACCENT),
    ];
    made[3].el.classList.add("world-label--plain");
    labels.current = made;
    return () => {
      made.forEach((l) => l.dispose());
      labels.current = [];
    };
  }, [gl]);

  const sim = useMemo(
    () => ({
      active: false,
      theta: 0,
      pos: HOME.clone(),
      vel: new THREE.Vector3(),
      heading: HOME_YAW,
      turnRate: 0,
      stand: 0,
      power: 0,
      impact: 0,
      flash: 0,
      wasUp: false,
      deskLook: new THREE.Vector2(),
      spiderLook: new THREE.Vector2(),
      deskBlink: 2,
      spiderBlink: 3.1,
      landed: [] as number[],
      rippleNext: 0,
      tmp: new THREE.Vector3(),
      target: new THREE.Vector3(),
      mat: new THREE.Matrix4(),
      ndc: new THREE.Vector3(),
      ndc2: new THREE.Vector3(),
      dir: new THREE.Vector3(),
    }),
    [],
  );
  // rest heights of the two orange buttons (they get pressed)
  const button0 = useMemo(() => [desk.button.position.y, spider.button.position.y], [desk, spider]);

  useFrame((state, rawDt) => {
    const on = worldActive(index);
    const r = root.current;
    if (!on || !r) {
      if (sim.active) {
        sim.active = false;
        labels.current.forEach((l) => l.update(sim.tmp, state.camera, state.size, 0));
      }
      return;
    }
    const dt = Math.min(rawDt, 1 / 20);
    const t = state.clock.elapsedTime;
    const p = clamp01(scroll.world);
    const first = !sim.active;
    sim.active = true;

    // ── spider: power on → stand up → walk ──
    const walkScroll = beat(p, P.walkIn[0], P.walkIn[1]) * (1 - beat(p, P.walkOut[0], P.walkOut[1]));
    const away = Math.hypot(sim.pos.x - HOME.x, sim.pos.z - HOME.z);
    // a walking spider always walks home before it lies back down, and only sleeps once down
    const standGoal = p >= P.wake || away > 0.1;
    const powerGoal = p >= P.wake - 0.03 || standGoal || sim.stand > 0.05;
    if (first) {
      sim.stand = standGoal ? 1 : 0;
      sim.power = powerGoal ? 1 : 0;
      sim.pos.copy(HOME);
      sim.vel.set(0, 0, 0);
      sim.heading = HOME_YAW;
      if (walkScroll > 0) pathAt(sim.theta, sim.pos).multiplyScalar(walkScroll).add(HOME);
    } else {
      sim.power = damp(sim.power, powerGoal ? 1 : 0, 3.5, dt);
      const standTarget = standGoal ? (sim.power > 0.6 ? 1 : sim.stand) : 0;
      sim.stand = damp(sim.stand, standTarget, 3, dt);
    }
    const up = sim.stand > 0.97;
    if (up && !sim.wasUp && !first) sim.flash = 1;
    sim.wasUp = up;
    sim.flash = Math.max(0, sim.flash - dt * 2.2);
    const W = up ? walkScroll : 0;

    if (W > 0.001) sim.theta += (dt * PATH.speed * W) / Math.max(0.2, pathSpeed(sim.theta));
    pathAt(sim.theta, sim.target).multiplyScalar(W).add(HOME);
    if (!first) {
      const desired = sim.tmp.subVectors(sim.target, sim.pos).multiplyScalar(3.2);
      desired.y = 0;
      if (desired.length() > 0.75) desired.setLength(0.75);
      if (!up) desired.set(0, 0, 0);
      sim.vel.x = damp(sim.vel.x, desired.x, 5, dt);
      sim.vel.z = damp(sim.vel.z, desired.z, 5, dt);
      sim.pos.addScaledVector(sim.vel, dt);
    }
    const speed = Math.hypot(sim.vel.x, sim.vel.z);
    const prevHeading = sim.heading;
    const wantHeading = speed > 0.07 ? Math.atan2(sim.vel.x, sim.vel.z) : W > 0.5 ? sim.heading : HOME_YAW;
    if (!first) sim.heading = dampAngle(sim.heading, wantHeading, 3.2, dt);
    sim.turnRate = damp(sim.turnRate, (sim.heading - prevHeading) / Math.max(dt, 1e-4), 6, dt);

    const sw = spider.root;
    const sc = spider.core;
    sw.position.set(sim.pos.x, 0, sim.pos.z);
    sw.rotation.y = sim.heading;
    let lift = 0;
    let roll = 0;
    let pitch = 0;
    for (const leg of legs) {
      roll += leg.lift * leg.side * 0.045;
      pitch -= leg.lift * leg.front * 0.03;
      lift += leg.lift;
    }
    roll -= THREE.MathUtils.clamp(sim.turnRate, -2, 2) * 0.05;
    pitch += speed * 0.09;
    sim.impact = Math.max(0, sim.impact - dt * 7);
    const s = sim.stand;
    const breathe = Math.sin(t * 1.9) * 0.008 * s;
    sc.position.y = THREE.MathUtils.lerp(SIT_Y, STAND_Y, s) + breathe - sim.impact * 0.025 + lift * 0.006;
    // a little nose-up heave while pushing itself off the floor
    const heave = Math.sin(Math.PI * s) * 0.06;
    sc.rotation.x = damp(sc.rotation.x, pitch - heave, 8, dt);
    sc.rotation.z = damp(sc.rotation.z, roll, 8, dt);

    // legs
    sw.updateMatrix();
    sc.updateMatrix();
    sim.mat.multiplyMatrices(sw.matrix, sc.matrix);
    const cosH = Math.cos(sim.heading);
    const sinH = Math.sin(sim.heading);
    if (first) resetLegs(legs, sim.pos.x, sim.pos.z, sim.heading);
    else {
      stepGait(legs, dt, sim.pos.x, sim.pos.z, sim.heading, sim.vel, sim.turnRate, sim.landed);
      for (const li of sim.landed) {
        sim.impact = Math.min(1, sim.impact + 0.5);
        const rp = ripples.items[sim.rippleNext];
        sim.rippleNext = (sim.rippleNext + 1) % ripples.items.length;
        rp.age = 0;
        rp.mesh.position.set(legs[li].foot.x, 0.004, legs[li].foot.z);
        rp.mesh.visible = true;
      }
    }
    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      const rig = spider.legs[i];
      rig.hipW.copy(leg.hip).applyMatrix4(sim.mat);
      rig.outward.set(leg.side * cosH, 0, -leg.side * sinH);
      solveLeg(rig.hipW, leg.foot, FEMUR, TIBIA, rig.kneeW, rig.hinge, rig.outward);
      placeSegment(rig.femur, rig.hipW, rig.kneeW, rig.hinge);
      placeSegment(rig.tibia, rig.kneeW, leg.foot, rig.hinge);
      rig.hipServo.position.copy(rig.hipW);
      rig.hipServo.quaternion.setFromUnitVectors(UP, rig.hinge);
      rig.knee.position.copy(rig.kneeW);
      rig.knee.quaternion.setFromUnitVectors(UP, rig.hinge);
      // foot pad at the actual end of the shin (in case the target is out of reach)
      sim.dir.set(0, TIBIA, 0).applyQuaternion(rig.tibia.quaternion);
      rig.foot.position.copy(rig.kneeW).add(sim.dir);
      spider.hips[i].rotation.y = Math.atan2(leg.foot.x - rig.hipW.x, leg.foot.z - rig.hipW.z) - sim.heading;
      const fs = footShadows.current[i];
      if (fs) {
        fs.position.set(rig.foot.position.x, 0.003, rig.foot.position.z);
        (fs.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - clamp01(rig.foot.position.y / 0.3));
      }
    }
    if (spiderShadow.current) {
      const bs = spiderShadow.current;
      bs.position.set(sim.pos.x, 0.002, sim.pos.z);
      bs.rotation.z = sim.heading;
      (bs.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.lerp(0.75, 0.5, s);
      bs.scale.setScalar(THREE.MathUtils.lerp(1, 1.15, s));
    }

    // ── floor fx ──
    for (const rp of ripples.items) {
      if (rp.age >= 1) continue;
      rp.age = Math.min(1, rp.age + dt / 0.7);
      rp.mesh.scale.setScalar(0.05 + easeOut(rp.age) * 0.38);
      rp.mat.opacity = 0.6 * (1 - rp.age);
      if (rp.age >= 1) rp.mesh.visible = false;
    }
    dots.mat.opacity = damp(dots.mat.opacity, walkScroll * (up ? 0.55 : 0), 4, dt);
    dots.mesh.visible = dots.mat.opacity > 0.01;

    // ── desktop Homie ──
    const d = desk;
    // eyes follow the cursor, except while the spider is doing its thing
    const watch = beat(p, 0.31, 0.36) * (1 - beat(p, 0.84, 0.89));
    d.face.getWorldPosition(sim.ndc).project(state.camera);
    spider.face.getWorldPosition(sim.ndc2).project(state.camera);
    const tx = THREE.MathUtils.lerp(state.pointer.x, sim.ndc2.x, watch);
    const ty = THREE.MathUtils.lerp(state.pointer.y, sim.ndc2.y, watch);
    sim.deskLook.x = damp(sim.deskLook.x, THREE.MathUtils.clamp((tx - sim.ndc.x) * 1.5, -1, 1), 6, dt);
    sim.deskLook.y = damp(sim.deskLook.y, THREE.MathUtils.clamp((ty - sim.ndc.y) * 1.5, -1, 1), 6, dt);
    d.head.rotation.y = damp(d.head.rotation.y, sim.deskLook.x * 0.32, 7, dt);
    d.head.rotation.x = damp(d.head.rotation.x, -sim.deskLook.y * 0.12, 7, dt);
    d.head.rotation.z = Math.sin(t * 0.7) * 0.018;
    d.head.position.y = 0.755 + Math.sin(t * 1.6) * 0.006;
    // wave on "Hey", a shrug on "Almost."
    const wave = beat(p, 0.02, 0.05) * (1 - beat(p, 0.11, 0.15));
    const shrug = Math.sin(Math.PI * lin(p, 0.2, 0.27));
    d.arms[0].rotation.z = wave * (2.1 + Math.sin(t * 9) * 0.3) + shrug * 0.35 + Math.sin(t * 1.3) * 0.03;
    d.arms[1].rotation.z = -shrug * 0.35 - Math.sin(t * 1.3 + 1) * 0.03;
    d.body.rotation.z = wave * 0.03 * Math.sin(t * 9);
    // button presses: Homie waking up (and on "Run it back."), the spider powering on
    const pressD = Math.sin(Math.PI * lin(p, 0.0, 0.03)) + Math.sin(Math.PI * lin(p, 0.86, 0.89));
    d.button.position.y = button0[0] - pressD * 0.022;
    const pressS = Math.sin(Math.PI * lin(p, P.wake - 0.03, P.wake));
    spider.button.position.y = button0[1] - pressS * 0.02;
    kit.mat.orange.emissiveIntensity = Math.max(pressD, pressS) * 1.1 + sim.flash * 0.7;

    // ── screens ──
    const blink = (key: "deskBlink" | "spiderBlink") => {
      if (t > sim[key] + 0.16) sim[key] = t + 2.2 + Math.random() * 3.2;
      const bt = t - sim[key];
      return bt > 0 && bt < 0.16 ? Math.sin((bt / 0.16) * Math.PI) : 0;
    };
    {
      const { line, typing } = typed(p, DESK_LINES);
      deskSub.draw(line, typing || (line.length > 0 && Math.floor(t * 2.2) % 2 === 0));
      const u = deskScreen.uniforms;
      u.uTime.value = t;
      u.uLook.value.copy(sim.deskLook);
      u.uOpen.value = (0.28 + 0.72 * easeOut(lin(p, 0.0, 0.06))) * (1 - blink("deskBlink") * 0.92);
      u.uBars.value = damp(u.uBars.value, typing ? 0.35 : 0, 6, dt);
    }
    {
      const { line, typing } = typed(p, SPIDER_LINES);
      spiderSub.draw(line, typing || (line.length > 0 && Math.floor(t * 2.2 + 0.5) % 2 === 0));
      // walking: eyes lead into the turn; otherwise they find the cursor
      spider.face.getWorldPosition(sim.ndc).project(state.camera);
      const walking = clamp01(speed / 0.2);
      const sx = THREE.MathUtils.lerp(
        THREE.MathUtils.clamp((state.pointer.x - sim.ndc.x) * 1.5, -1, 1),
        THREE.MathUtils.clamp(-sim.turnRate * 0.8, -1, 1),
        walking,
      );
      const sy = THREE.MathUtils.lerp(THREE.MathUtils.clamp((state.pointer.y - sim.ndc.y) * 1.5, -1, 1), -0.2, walking);
      sim.spiderLook.x = damp(sim.spiderLook.x, sx, 6, dt);
      sim.spiderLook.y = damp(sim.spiderLook.y, sy, 6, dt);
      const u = spiderScreen.uniforms;
      u.uTime.value = t;
      u.uLook.value.copy(sim.spiderLook);
      // boot flicker while powering on
      const booting = sim.power > 0.02 && sim.power < 0.9;
      const flicker = booting ? 0.55 + 0.45 * Math.sign(Math.sin(t * 37) + Math.sin(t * 23)) : 1;
      u.uPower.value = (0.06 + 0.94 * sim.power) * flicker;
      u.uOpen.value = (0.12 + 0.88 * easeOut(sim.power)) * (1 - blink("spiderBlink") * 0.92);
      u.uBars.value = damp(u.uBars.value, typing ? 0.35 : W > 0.5 ? 0.12 : 0, 6, dt);
      u.uFlash.value = sim.flash * 0.5;
    }

    // ── labels + camera focus ──
    const [lDesk, lSpider, lWalk, lBoth] = labels.current;
    if (lDesk && lSpider && lWalk && lBoth) {
      const end = beat(p, 0.9, 0.95);
      sim.tmp.set(DESK.x, 1.72, DESK.z);
      lDesk.update(r.localToWorld(sim.tmp), state.camera, state.size, beat(p, 0.06, 0.11) * (1 - beat(p, 0.27, 0.31)) + end);
      sim.tmp.set(sim.pos.x, 1.02, sim.pos.z);
      lSpider.update(r.localToWorld(sim.tmp), state.camera, state.size, beat(p, 0.43, 0.48) * (1 - beat(p, 0.54, 0.58)) + end);
      sim.tmp.set(sim.pos.x, 1.02, sim.pos.z);
      lWalk.update(r.localToWorld(sim.tmp), state.camera, state.size, up ? beat(p, 0.6, 0.64) * (1 - beat(p, 0.8, 0.84)) : 0);
      sim.tmp.set(0, 2.02, 0);
      lBoth.update(r.localToWorld(sim.tmp), state.camera, state.size, beat(p, 0.92, 0.97));
    }
    if (first) shared.spider.copy(sim.pos);
    else {
      shared.spider.x = damp(shared.spider.x, sim.pos.x, 2.5, dt);
      shared.spider.z = damp(shared.spider.z, sim.pos.z, 2.5, dt);
    }
  });

  return (
    <group ref={root}>
      <StageFloor radius={6} spacing={0.25} />
      <primitive object={dots.mesh} />
      <primitive object={ripples.group} />
      <BlobShadow size={[1.35, 1.0]} opacity={0.75} position={[DESK.x, 0.002, DESK.z]} />
      <BlobShadow ref={spiderShadow} size={[1.5, 1.35]} opacity={0.6} />
      {legs.map((_, i) => (
        <BlobShadow
          key={i}
          size={0.3}
          opacity={0}
          ref={(el: THREE.Mesh | null) => {
            footShadows.current[i] = el;
          }}
        />
      ))}
      <primitive object={desk.root} position={DESK} rotation-y={DESK_YAW} />
      <primitive object={spider.root} />
      <primitive object={spider.legGroup} />
    </group>
  );
}

export const homieWorld: WorldDef = {
  id: "homie",
  steps: [
    {
      at: 0,
      label: "Homie",
      caption: "The desktop companion. A 3.5″ screen that talks back, and face tracking points its eyes at you.",
    },
    {
      at: 0.3,
      label: "Spider Homie",
      caption: "A second, separate body: same voice, same face, four legs. A concept, not a transformation.",
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
    const [az0, el0, dist, ty, mix] = sampleCam(clamp01(p));
    const az = az0 + Math.sin(t * 0.23) * 0.05;
    const el = el0 + Math.sin(t * 0.31) * 0.015;
    const fx = THREE.MathUtils.lerp(DESK.x, shared.spider.x, mix);
    const fz = THREE.MathUtils.lerp(DESK.z, shared.spider.z, mix);
    out.target.set(fx, ty, fz);
    out.position.set(
      fx + dist * Math.sin(az) * Math.cos(el),
      ty + dist * Math.sin(el),
      fz + dist * Math.cos(az) * Math.cos(el),
    );
  },
  Component: HomieScene,
};
