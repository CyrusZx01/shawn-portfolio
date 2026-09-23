"use client";

import { useMemo } from "react";
import * as THREE from "three";

// Shared building blocks so every project world sits in the same studio as the bust:
// #1d1d1d ground, soft light, hairline graphics, accent colour used sparingly.

export const PALETTE = {
  bg: "#1d1d1d",
  fg: "#f3efe9",
  dim: "#8a8580",
  line: "#3a3836",
};

/** Transparent floor: fine dot grid + hairline rings that fade into the background.
 * No lit surface, so it matches the page ground exactly at every angle. */
export function StageFloor({
  radius = 4,
  accent = "#f3efe9",
  spacing = 0.25,
  rings = true,
  opacity = 1,
}: {
  radius?: number;
  accent?: string;
  spacing?: number;
  rings?: boolean;
  opacity?: number;
}) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        uniforms: {
          uRadius: { value: radius },
          uSpacing: { value: spacing },
          uAccent: { value: new THREE.Color(accent) },
          uRings: { value: rings ? 1 : 0 },
          uOpacity: { value: opacity },
        },
        vertexShader: /* glsl */ `
          varying vec2 vP;
          void main() {
            vP = position.xy;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uRadius, uSpacing, uRings, uOpacity;
          uniform vec3 uAccent;
          varying vec2 vP;
          void main() {
            float r = length(vP);
            float fade = 1.0 - smoothstep(uRadius * 0.35, uRadius, r);
            vec2 g = abs(fract(vP / uSpacing + 0.5) - 0.5) * uSpacing;
            float dotMask = 1.0 - smoothstep(0.006, 0.012, length(g));
            float ring = 0.0;
            if (uRings > 0.5) {
              float rr = abs(fract(r / (uRadius * 0.25) + 0.5) - 0.5) * uRadius * 0.25;
              ring = (1.0 - smoothstep(0.0, fwidth(r) * 1.2, rr)) * 0.5;
            }
            float a = max(dotMask * 0.22, ring * 0.16) * fade * uOpacity;
            gl_FragColor = vec4(uAccent, a);
          }
        `,
        extensions: { derivatives: true } as never,
      }),
    [radius, spacing, accent, rings, opacity],
  );
  return (
    <mesh rotation-x={-Math.PI / 2} material={material} renderOrder={-1} raycast={() => null}>
      <planeGeometry args={[radius * 2, radius * 2]} />
    </mesh>
  );
}

let shadowTexture: THREE.Texture | null = null;
function getShadowTexture() {
  if (shadowTexture) return shadowTexture;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(0,0,0,0.75)");
  g.addColorStop(0.45, "rgba(0,0,0,0.35)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  shadowTexture = new THREE.CanvasTexture(c);
  return shadowTexture;
}

/** Cheap soft contact shadow (a dark radial decal on the floor). */
export function BlobShadow({
  size = 1,
  opacity = 0.6,
  ...props
}: { size?: number | [number, number]; opacity?: number } & Omit<React.ComponentProps<"mesh">, "args">) {
  const tex = useMemo(getShadowTexture, []);
  const [sx, sz] = Array.isArray(size) ? size : [size, size];
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0.002} renderOrder={0} raycast={() => null} {...props}>
      <planeGeometry args={[sx, sz]} />
      <meshBasicMaterial map={tex} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

/** Smoothstep window helper for scroll-driven story beats. */
export function beat(p: number, a: number, b: number) {
  const v = Math.min(1, Math.max(0, (p - a) / (b - a)));
  return v * v * (3 - 2 * v);
}
