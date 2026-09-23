"use client";

import { forwardRef, useMemo } from "react";
import * as THREE from "three";

// A minimal, product-render style car: an extruded, heavily bevelled side
// profile (with wheel arches) plus a dark glass canopy — a "black roof" EV.
// Local frame: faces -z, ground at y = 0, ~1.75 long.

export const CAR_LENGTH = 1.75;

function extrudeProfile(shape: THREE.Shape, width: number, bevel: number, bevelSize: number) {
  const depth = Math.max(0.01, width - bevel * 2);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize,
    bevelSegments: 5,
    curveSegments: 28,
  });
  g.translate(0, 0, -depth / 2);
  g.rotateY(-Math.PI / 2); // profile x → car z (front at -z), extrusion → car x
  g.computeVertexNormals();
  return g;
}

let shared: { body: THREE.BufferGeometry; cabin: THREE.BufferGeometry } | null = null;

function getGeometry() {
  if (shared) return shared;
  // side profile in (u = along car, front at -u; v = height)
  const s = new THREE.Shape();
  s.moveTo(-0.84, 0.14);
  s.quadraticCurveTo(-0.88, 0.27, -0.76, 0.33);
  s.lineTo(-0.34, 0.39);
  s.lineTo(0.5, 0.405);
  s.quadraticCurveTo(0.84, 0.41, 0.85, 0.3);
  s.lineTo(0.84, 0.15);
  s.quadraticCurveTo(0.84, 0.1, 0.76, 0.1);
  s.lineTo(0.72, 0.1);
  s.absarc(0.55, 0.14, 0.175, -0.23, Math.PI + 0.23, false);
  s.lineTo(-0.36, 0.1);
  s.absarc(-0.53, 0.14, 0.175, -0.23, Math.PI + 0.23, false);
  s.lineTo(-0.76, 0.1);
  s.quadraticCurveTo(-0.84, 0.1, -0.84, 0.14);

  const c = new THREE.Shape();
  c.moveTo(-0.34, 0.38);
  c.quadraticCurveTo(-0.14, 0.44, 0.0, 0.575);
  c.quadraticCurveTo(0.05, 0.6, 0.14, 0.6);
  c.lineTo(0.3, 0.6);
  c.quadraticCurveTo(0.42, 0.6, 0.66, 0.42);
  c.lineTo(0.66, 0.38);
  c.lineTo(-0.34, 0.38);

  shared = {
    body: extrudeProfile(s, 0.74, 0.07, 0.035),
    cabin: extrudeProfile(c, 0.6, 0.08, 0.03),
  };
  return shared;
}

type CarProps = {
  body?: string;
  tail?: string;
  /** 0..1 brightness of the tail light strip */
  tailGlow?: number;
  wheels?: React.RefObject<THREE.Group[]>;
} & React.ComponentProps<"group">;

export const Car = forwardRef<THREE.Group, CarProps>(function Car(
  { body = "#ece7df", tail = "#e2463a", tailGlow = 1, wheels, ...props },
  ref,
) {
  const geo = useMemo(getGeometry, []);
  const mats = useMemo(
    () => ({
      body: new THREE.MeshPhysicalMaterial({
        color: body,
        roughness: 0.3,
        metalness: 0.08,
        clearcoat: 1,
        clearcoatRoughness: 0.12,
      }),
      glass: new THREE.MeshPhysicalMaterial({ color: "#0d0e10", roughness: 0.06, metalness: 0.5, clearcoat: 1 }),
      tyre: new THREE.MeshStandardMaterial({ color: "#0c0c0c", roughness: 0.85 }),
      rim: new THREE.MeshStandardMaterial({ color: "#56534f", roughness: 0.3, metalness: 0.85 }),
      tail: new THREE.MeshBasicMaterial({
        color: new THREE.Color(tail).multiplyScalar(0.5 + tailGlow * 1.6),
        toneMapped: false,
      }),
      head: new THREE.MeshBasicMaterial({ color: "#fff6ea", toneMapped: false }),
    }),
    [body, tail, tailGlow],
  );

  const wheelPos: [number, number][] = [
    [-0.31, -0.53],
    [0.31, -0.53],
    [-0.31, 0.55],
    [0.31, 0.55],
  ];

  return (
    <group ref={ref} {...props}>
      <mesh geometry={geo.body} material={mats.body} />
      <mesh geometry={geo.cabin} material={mats.glass} />
      {/* light bars */}
      <mesh position={[0, 0.345, 0.883]} material={mats.tail}>
        <boxGeometry args={[0.64, 0.022, 0.012]} />
      </mesh>
      <mesh position={[0, 0.3, -0.905]} rotation-x={0.35} material={mats.head}>
        <boxGeometry args={[0.56, 0.012, 0.012]} />
      </mesh>
      {wheelPos.map(([x, z], i) => (
        <group
          key={i}
          position={[x, 0.14, z]}
          ref={(g) => {
            if (wheels?.current && g) wheels.current[i] = g;
          }}
        >
          <mesh rotation-z={Math.PI / 2} material={mats.tyre}>
            <cylinderGeometry args={[0.14, 0.14, 0.12, 28]} />
          </mesh>
          <mesh rotation-z={Math.PI / 2} position-x={x > 0 ? 0.061 : -0.061} material={mats.rim}>
            <cylinderGeometry args={[0.095, 0.095, 0.004, 5]} />
          </mesh>
        </group>
      ))}
    </group>
  );
});
