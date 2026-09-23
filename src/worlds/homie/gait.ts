import * as THREE from "three";

// Procedural quadruped gait: every foot stays planted in the world until the body has
// moved far enough from it, then steps (diagonal pairs, never both pairs at once) to a
// point ahead of its rest position, on a lifted arc. Legs are solved with two-bone IK.

export type Leg = {
  /** chassis-local hip position */
  hip: THREE.Vector3;
  /** chassis-local rest foot position (y = ground) */
  rest: THREE.Vector3;
  /** current foot position in world-local space */
  foot: THREE.Vector3;
  from: THREE.Vector3;
  to: THREE.Vector3;
  /** 0..1 progress of the current step, -1 when planted */
  step: number;
  /** 0..1 how high the foot currently is (for body sway) */
  lift: number;
  side: 1 | -1;
  front: 1 | -1;
};

export const STEP_TIME = 0.3;
export const STEP_HEIGHT = 0.17;
/** diagonal pairs: front-left + rear-right, front-right + rear-left */
export const PAIRS = [
  [0, 3],
  [1, 2],
] as const;

export function makeLegs(): Leg[] {
  const spec: [number, number, number, number, number, 1 | -1, 1 | -1][] = [
    // hip x, hip z, rest x, rest z, hip y, side, front
    [0.5, 0.2, 1.08, 0.78, -0.04, 1, 1],
    [-0.5, 0.2, -1.08, 0.78, -0.04, -1, 1],
    [0.45, -0.5, 1.02, -1.0, -0.04, 1, -1],
    [-0.45, -0.5, -1.02, -1.0, -0.04, -1, -1],
  ];
  return spec.map(([hx, hz, rx, rz, hy, side, front]) => ({
    hip: new THREE.Vector3(hx, hy, hz),
    rest: new THREE.Vector3(rx, 0, rz),
    foot: new THREE.Vector3(rx, 0, rz),
    from: new THREE.Vector3(),
    to: new THREE.Vector3(),
    step: -1,
    lift: 0,
    side,
    front,
  }));
}

const tmp = new THREE.Vector3();
const home = new THREE.Vector3();

/** Rest foot position of a leg in world-local space for a given body xz + heading,
 * leading by the body's velocity so feet land ahead of where the body is going. */
export function footHome(
  leg: Leg,
  bodyX: number,
  bodyZ: number,
  heading: number,
  vel: THREE.Vector3,
  lead: number,
  out: THREE.Vector3,
) {
  const c = Math.cos(heading);
  const s = Math.sin(heading);
  out.set(bodyX + leg.rest.x * c + leg.rest.z * s, 0, bodyZ - leg.rest.x * s + leg.rest.z * c);
  out.x += vel.x * lead;
  out.z += vel.z * lead;
  return out;
}

/** Advance the gait. Returns the indices of feet that landed this frame. */
export function stepGait(
  legs: Leg[],
  dt: number,
  bodyX: number,
  bodyZ: number,
  heading: number,
  vel: THREE.Vector3,
  turnRate: number,
  landed: number[],
) {
  landed.length = 0;
  const speed = Math.hypot(vel.x, vel.z);
  // stride grows with speed; when idle the threshold is small so feet tidy themselves up
  const threshold = 0.06 + Math.min(1, speed / 0.35) * 0.16 + Math.min(0.1, Math.abs(turnRate) * 0.05);
  const lead = STEP_TIME * 0.9 + Math.min(0.25, speed * 0.4);
  const busy = legs.some((l) => l.step >= 0);

  // advance active steps
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    if (leg.step < 0) continue;
    // keep retargeting mid-step so turning feels responsive
    footHome(leg, bodyX, bodyZ, heading, vel, lead, home);
    leg.to.lerp(home, Math.min(1, dt * 6));
    leg.step = Math.min(1, leg.step + dt / STEP_TIME);
    const t = leg.step;
    const e = t * t * (3 - 2 * t);
    leg.foot.lerpVectors(leg.from, leg.to, e);
    leg.lift = Math.sin(Math.PI * t);
    leg.foot.y = leg.lift * STEP_HEIGHT * (0.6 + Math.min(1, speed / 0.3) * 0.4);
    if (leg.step >= 1) {
      leg.step = -1;
      leg.lift = 0;
      leg.foot.y = 0;
      landed.push(i);
    }
  }
  if (busy) return landed;

  // pick the pair with the largest error, step it if it's past the threshold
  let bestPair = -1;
  let bestErr = threshold;
  for (let p = 0; p < PAIRS.length; p++) {
    let err = 0;
    for (const i of PAIRS[p]) {
      footHome(legs[i], bodyX, bodyZ, heading, vel, lead, home);
      tmp.subVectors(legs[i].foot, home);
      tmp.y = 0;
      err = Math.max(err, tmp.length());
    }
    if (err > bestErr) {
      bestErr = err;
      bestPair = p;
    }
  }
  if (bestPair >= 0) {
    for (const i of PAIRS[bestPair]) {
      const leg = legs[i];
      leg.from.copy(leg.foot);
      footHome(leg, bodyX, bodyZ, heading, vel, lead, leg.to);
      leg.step = 0;
    }
  }
  return landed;
}

export function resetLegs(legs: Leg[], bodyX: number, bodyZ: number, heading: number) {
  const zero = new THREE.Vector3();
  for (const leg of legs) {
    footHome(leg, bodyX, bodyZ, heading, zero, 0, leg.foot);
    leg.step = -1;
    leg.lift = 0;
  }
}

const hDir = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** Two-bone IK in the vertical plane through hip and foot, knee bending upward
 * (spider-style). Writes the knee position and the plane normal (hinge axis). */
export function solveLeg(
  hip: THREE.Vector3,
  foot: THREE.Vector3,
  a: number,
  b: number,
  knee: THREE.Vector3,
  hinge: THREE.Vector3,
  outward: THREE.Vector3,
) {
  hDir.set(foot.x - hip.x, 0, foot.z - hip.z);
  let r = hDir.length();
  if (r < 1e-4) {
    hDir.copy(outward);
    r = 0;
  } else hDir.divideScalar(r);
  const dy = foot.y - hip.y;
  const L = THREE.MathUtils.clamp(Math.hypot(r, dy), Math.abs(a - b) + 1e-4, a + b - 1e-4);
  const phi = Math.atan2(dy, r);
  const alpha = Math.acos(THREE.MathUtils.clamp((a * a + L * L - b * b) / (2 * a * L), -1, 1));
  const th = phi + alpha;
  knee.copy(hip).addScaledVector(hDir, a * Math.cos(th)).addScaledVector(UP, a * Math.sin(th));
  hinge.crossVectors(UP, hDir).normalize();
}

const basisX = new THREE.Vector3();
const basisY = new THREE.Vector3();
const basisZ = new THREE.Vector3();
const basis = new THREE.Matrix4();

/** Orient an object whose geometry runs along +Y from `from` towards `to`,
 * with its local X axis on the leg's hinge axis (so the flat faces stay in plane). */
export function placeSegment(obj: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, hinge: THREE.Vector3) {
  basisY.subVectors(to, from).normalize();
  basisX.copy(hinge).addScaledVector(basisY, -hinge.dot(basisY)).normalize();
  basisZ.crossVectors(basisX, basisY);
  basis.makeBasis(basisX, basisY, basisZ);
  obj.quaternion.setFromRotationMatrix(basis);
  obj.position.copy(from);
}
