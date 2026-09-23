"use client";

import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Label } from "../Label";
import { scroll, worldActive } from "@/animations/store";
import type { WorldDef } from "../types";
import { BlobShadow, StageFloor, beat } from "../shared";
import { HOUSES, N, RESIDENTS, TILE, buildMap, rng, route, tx } from "./map";

// JEV World — a floating GBA-style tile town. Tiles pop in, twenty residents walk
// the roads (BFS over path tiles), two of them surface their agent decisions, then
// the day turns to night. Everything is instanced; night is a colour tint on our own
// materials (no extra scene lights, so no shader recompiles when worlds toggle).

const ACCENT = "#7cc653";
const ISLAND_Y = 0.62;
const TOP = { grass: 0.12, sand: 0.1, path: 0.1, water: 0.05 } as const;

const P = {
  assembleEnd: 0.24,
  aliveA: 0.2,
  aliveB: 0.32,
  decideA: 0.46,
  decideB: 0.74,
  nightA: 0.72,
  nightB: 0.94,
};

// ── materials ──────────────────────────────────────────────────────────────
// Each tinted material remembers its base colour; night multiplies by `tint`.
type Tinted = { mat: THREE.MeshStandardMaterial; base: THREE.Color };

function makeMaterials() {
  const tinted: Tinted[] = [];
  const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra });
    tinted.push({ mat, base: new THREE.Color(color) });
    return mat;
  };
  const m = {
    tile: std("#ffffff", { roughness: 0.9 }),
    dirt: std("#ffffff", { roughness: 1 }),
    water: std("#5fb4e6", { roughness: 0.18, metalness: 0.15, emissive: new THREE.Color("#1d5f8a"), emissiveIntensity: 0.35 }),
    wall: std("#f1e6cf"),
    wallTrim: std("#d8c8a6"),
    door: std("#5a3b28"),
    roofRed: std("#d65a3c", { roughness: 0.7 }),
    roofBlue: std("#3f6fb5", { roughness: 0.7 }),
    roofGreen: std("#5c9e45", { roughness: 0.7 }),
    trunk: std("#7a5236"),
    leaf: std("#ffffff", { roughness: 0.8, flatShading: true }),
    npc: std("#ffffff", { roughness: 0.7 }),
    skin: std("#f2c9a0", { roughness: 0.7 }),
    hair: std("#2a2320"),
    pole: std("#3a3430"),
    flag: std(ACCENT, { roughness: 0.6, side: THREE.DoubleSide }),
    stone: std("#bdb3a2"),
  };
  // Emissive-only materials: windows and lamps light up at night.
  const windowMat = new THREE.MeshStandardMaterial({
    color: "#3b4a5c",
    roughness: 0.4,
    emissive: new THREE.Color("#ffc86a"),
    emissiveIntensity: 0,
  });
  const bulbMat = new THREE.MeshStandardMaterial({
    color: "#fff3d6",
    emissive: new THREE.Color("#ffcf7a"),
    emissiveIntensity: 0.2,
  });
  return { ...m, windowMat, bulbMat, tinted };
}

let glowTex: THREE.Texture | null = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,210,140,1)");
  g.addColorStop(0.3, "rgba(255,190,110,0.45)");
  g.addColorStop(1, "rgba(255,170,90,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

const GRASS_A = new THREE.Color("#7cbf52");
const GRASS_B = new THREE.Color("#70b249");
const SAND = new THREE.Color("#efe4c2");
const PATH = new THREE.Color("#d9b57c");
const DIRT_TOP = new THREE.Color("#8a6040");
const DIRT = new THREE.Color("#5b3f2b");

const DAY = new THREE.Color("#ffffff");
const DUSK = new THREE.Color("#ffc9a0");
const NIGHT = new THREE.Color("#4a5a92");

const dummy = new THREE.Object3D();

// ── NPC simulation ─────────────────────────────────────────────────────────
type Npc = {
  x: number;
  z: number;
  cell: [number, number];
  queue: [number, number][];
  idle: number;
  speed: number;
  heading: number;
  phase: number;
  featured: boolean;
};

// Liu Bei keeps to the west of the plaza, Cao Cao to the east, so their labels never stack.
const PLAZA: [number, number][][] = [
  [
    [6, 7],
    [6, 9],
    [5, 8],
    [4, 8],
    [7, 6],
  ],
  [
    [8, 7],
    [8, 9],
    [9, 8],
    [10, 8],
    [7, 10],
  ],
];

function JevScene({ index }: { index: number }) {
  const map = useMemo(buildMap, []);
  const mats = useMemo(makeMaterials, []);
  const tint = useMemo(() => new THREE.Color(), []);

  const tilesTop = useRef<THREE.InstancedMesh>(null);
  const tilesDirt = useRef<THREE.InstancedMesh>(null);
  const water = useRef<THREE.InstancedMesh>(null);
  const trunks = useRef<THREE.InstancedMesh>(null);
  const leaves = useRef<THREE.InstancedMesh>(null);
  const bodies = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const hair = useRef<THREE.InstancedMesh>(null);
  const island = useRef<THREE.Group>(null);
  const houses = useRef<(THREE.Group | null)[]>([]);
  const plaza = useRef<THREE.Group>(null);
  const hoverRing = useRef<THREE.Mesh>(null);
  const hoverAnchor = useRef<THREE.Group>(null);
  const hoverDiv = useRef<HTMLDivElement>(null);
  const featuredAnchors = useRef<(THREE.Group | null)[]>([]);
  const featuredDivs = useRef<(HTMLDivElement | null)[]>([]);
  const featuredRings = useRef<(THREE.Mesh | null)[]>([]);
  const glows = useRef<THREE.Group>(null);
  const stars = useRef<THREE.Points>(null);
  const lastP = useRef(-1);
  const hovered = useRef(-1);
  const [hover, setHover] = useState(-1);

  const landTiles = useMemo(() => map.tiles.filter((t) => t.kind !== "water"), [map]);
  const waterTiles = useMemo(() => map.tiles.filter((t) => t.kind === "water"), [map]);

  const geos = useMemo(() => {
    const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const trunk = new THREE.CylinderGeometry(0.018, 0.024, 0.1, 6).translate(0, 0.05, 0);
    const leaf = new THREE.IcosahedronGeometry(0.1, 0).translate(0, 0.17, 0);
    const body = new THREE.CylinderGeometry(0.03, 0.042, 0.085, 7).translate(0, 0.0425, 0);
    const head = new THREE.SphereGeometry(0.034, 10, 8).translate(0, 0.118, 0);
    const hairG = new THREE.SphereGeometry(0.036, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5).translate(0, 0.124, -0.002);
    return { box, trunk, leaf, body, head, hair: hairG };
  }, []);

  const npcs = useMemo<Npc[]>(() => {
    const rand = rng(7);
    return RESIDENTS.map((_, i) => {
      const cell = i < 2 ? PLAZA[i][0] : map.pathCells[Math.floor(rand() * map.pathCells.length)];
      return {
        x: cell[0],
        z: cell[1],
        cell: [cell[0], cell[1]],
        queue: [],
        idle: rand() * 2,
        speed: 1.1 + rand() * 0.7,
        heading: rand() * Math.PI * 2,
        phase: rand() * 10,
        featured: i < 2,
      };
    });
  }, [map]);
  const npcRand = useMemo(() => rng(42), []);

  // static per-instance colours
  const setupColors = (mesh: THREE.InstancedMesh | null, colors: THREE.Color[]) => {
    if (!mesh) return;
    colors.forEach((c, i) => mesh.setColorAt(i, c));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };

  const topColors = useMemo(
    () =>
      landTiles.map((t) => {
        const base = t.kind === "grass" ? ((t.x + t.z) % 2 ? GRASS_A : GRASS_B) : t.kind === "sand" ? SAND : PATH;
        return base.clone().offsetHSL(0, 0, (t.seed - 0.5) * 0.03);
      }),
    [landTiles],
  );
  const dirtColors = useMemo(
    () => map.tiles.map((t) => DIRT.clone().lerp(DIRT_TOP, 0.3 + t.seed * 0.4)),
    [map],
  );
  const leafColors = useMemo(
    () => map.trees.map((t, i) => new THREE.Color(t.pine ? "#3f7d44" : "#58a34a").offsetHSL(0, 0, ((i * 37) % 10) / 180 - 0.025)),
    [map],
  );

  const tileDelay = (r: number, seed: number) => r * 0.55 + seed * 0.18;

  const layoutStatic = (p: number) => {
    const pa = p / P.assembleEnd;
    const pop = (d: number) => beat(pa, d, d + 0.3);

    const placeTile = (mesh: THREE.InstancedMesh, i: number, t: (typeof map.tiles)[number], h: number, below = 0) => {
      const a = pop(tileDelay(t.r, t.seed));
      const drop = (1 - a) * (1 - a) * 1.6;
      const s = a < 0.001 ? 0.0001 : 0.2 + 0.8 * a;
      dummy.position.set(tx(t.x), drop - below, tx(t.z));
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(TILE * 0.985 * s, h * s + 0.0001, TILE * 0.985 * s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    };

    if (tilesTop.current) {
      landTiles.forEach((t, i) => placeTile(tilesTop.current!, i, t, TOP[t.kind]));
      tilesTop.current.instanceMatrix.needsUpdate = true;
    }
    if (water.current) {
      waterTiles.forEach((t, i) => placeTile(water.current!, i, t, TOP.water));
      water.current.instanceMatrix.needsUpdate = true;
    }
    if (tilesDirt.current) {
      map.tiles.forEach((t, i) => {
        const depth = 0.18 + Math.max(0, 1 - t.r) * 0.95 + t.seed * 0.12;
        placeTile(tilesDirt.current!, i, t, depth, depth);
      });
      tilesDirt.current.instanceMatrix.needsUpdate = true;
    }
    // trees after their tile lands
    if (trunks.current && leaves.current) {
      map.trees.forEach((t, i) => {
        const r = Math.hypot(t.x - (N - 1) / 2, t.z - (N - 1) / 2) / ((N - 1) / 2);
        const a = pop(tileDelay(r, 0.5) + 0.22);
        const s = Math.max(0.0001, a * t.s * (t.pine ? 1.15 : 1));
        dummy.position.set(tx(t.x), TOP.grass, tx(t.z));
        dummy.rotation.set(0, i * 1.7, 0);
        dummy.scale.set(s, s * (1 + (1 - a) * 0.4), s);
        dummy.updateMatrix();
        trunks.current!.setMatrixAt(i, dummy.matrix);
        dummy.scale.set(s * (t.pine ? 0.8 : 1), s * (t.pine ? 1.55 : 1), s * (t.pine ? 0.8 : 1));
        dummy.updateMatrix();
        leaves.current!.setMatrixAt(i, dummy.matrix);
      });
      trunks.current.instanceMatrix.needsUpdate = true;
      leaves.current.instanceMatrix.needsUpdate = true;
    }
    houses.current.forEach((g, i) => {
      if (!g) return;
      const h = HOUSES[i];
      const r = Math.hypot(h.x - (N - 1) / 2, h.z - (N - 1) / 2) / ((N - 1) / 2);
      const a = pop(tileDelay(r, 0.5) + 0.18);
      const bounce = a < 1 ? Math.sin(a * Math.PI) * 0.12 : 0;
      g.scale.setScalar(Math.max(0.0001, a + bounce));
    });
    if (plaza.current) plaza.current.scale.setScalar(Math.max(0.0001, pop(0.3)));
  };

  const pickTarget = (n: Npc, i: number) => {
    const pool = n.featured ? PLAZA[i] : map.pathCells;
    const goal = pool[Math.floor(npcRand() * pool.length)];
    n.queue = route(map.grid, n.cell, goal);
    n.idle = n.featured ? 1.5 + npcRand() * 2.5 : 0.3 + npcRand() * 1.6;
  };

  useFrame((state, delta) => {
    const active = worldActive(index);
    if (!active) {
      // Html labels ignore object visibility — hide them explicitly.
      if (hoverDiv.current) hoverDiv.current.style.opacity = "0";
      featuredDivs.current.forEach((d) => d && (d.style.opacity = "0"));
      return;
    }
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    const p = scroll.world;

    if (Math.abs(p - lastP.current) > 1e-4) {
      layoutStatic(p);
      lastP.current = p;
    }

    // gentle float
    if (island.current) {
      island.current.position.y = ISLAND_Y + Math.sin(t * 0.8) * 0.025;
      island.current.rotation.y = scroll.pointerX * 0.06;
    }

    // day → dusk → night tint
    const night = beat(p, P.nightA, P.nightB);
    if (night < 0.5) tint.copy(DAY).lerp(DUSK, night * 2);
    else tint.copy(DUSK).lerp(NIGHT, (night - 0.5) * 2);
    for (const { mat, base } of mats.tinted) mat.color.copy(base).multiply(tint);
    const lights = beat(p, P.nightA + 0.06, P.nightB);
    mats.windowMat.emissiveIntensity = lights * 2.4;
    mats.water.emissiveIntensity = 0.35 * (1 - night * 0.8);
    mats.bulbMat.emissiveIntensity = 0.2 + lights * 3;
    if (glows.current) {
      glows.current.visible = lights > 0.01;
      glows.current.children.forEach((c, i) => {
        const m = (c as THREE.Sprite).material as THREE.SpriteMaterial;
        m.opacity = lights * (0.75 + Math.sin(t * 3 + i * 1.3) * 0.08);
      });
    }
    if (stars.current) {
      const m = stars.current.material as THREE.PointsMaterial;
      m.opacity = beat(p, 0.8, 0.98) * 0.9;
      stars.current.visible = m.opacity > 0.01;
      stars.current.rotation.y = t * 0.01;
    }

    // residents
    const alive = beat(p, P.aliveA, P.aliveB);
    const b = bodies.current;
    const hd = heads.current;
    const hr = hair.current;
    if (b && hd && hr) {
      npcs.forEach((n, i) => {
        const on = alive > 0 && i !== hovered.current;
        if (on) {
          if (n.idle > 0) n.idle -= dt;
          else if (n.queue.length === 0) pickTarget(n, i);
          else {
            const [gx, gz] = n.queue[0];
            const dx = gx - n.x;
            const dz = gz - n.z;
            const d = Math.hypot(dx, dz);
            const step = n.speed * dt;
            if (d <= step) {
              n.x = gx;
              n.z = gz;
              n.cell = [gx, gz];
              n.queue.shift();
            } else {
              n.x += (dx / d) * step;
              n.z += (dz / d) * step;
            }
            n.phase += step * 7;
            const want = Math.atan2(dx, dz);
            let diff = want - n.heading;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            n.heading += diff * Math.min(1, dt * 12);
          }
        }
        const walking = n.idle <= 0 && n.queue.length > 0 && i !== hovered.current;
        const bob = walking ? Math.abs(Math.sin(n.phase)) * 0.022 : Math.sin(t * 2 + i) * 0.002;
        const sway = walking ? Math.sin(n.phase) * 0.12 : 0;
        const a = beat(alive, (i / npcs.length) * 0.5, (i / npcs.length) * 0.5 + 0.5);
        const hoverScale = i === hovered.current ? 1.2 : 1;
        const s = Math.max(0.0001, a * 1.25 * hoverScale);
        dummy.position.set(tx(n.x), TOP.path + bob + (1 - a) * 0.3, tx(n.z));
        dummy.rotation.set(0, n.heading, sway);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        b.setMatrixAt(i, dummy.matrix);
        hd.setMatrixAt(i, dummy.matrix);
        hr.setMatrixAt(i, dummy.matrix);
      });
      b.instanceMatrix.needsUpdate = true;
      hd.instanceMatrix.needsUpdate = true;
      hr.instanceMatrix.needsUpdate = true;
    }

    // featured decision labels
    const decide = beat(p, P.decideA, P.decideA + 0.05) * (1 - beat(p, P.decideB, P.decideB + 0.05));
    featuredAnchors.current.forEach((g, i) => {
      if (!g) return;
      g.position.set(tx(npcs[i].x), TOP.path + (i ? 0.26 : 0.36), tx(npcs[i].z));
      const ring = featuredRings.current[i];
      if (ring) {
        ring.visible = decide > 0.01;
        ring.position.set(tx(npcs[i].x), TOP.path + 0.004, tx(npcs[i].z));
        ring.scale.setScalar(decide * (1 + Math.sin(t * 4 + i) * 0.1));
      }
      const d = featuredDivs.current[i];
      if (d) d.style.opacity = String(i === hovered.current ? 0 : decide);
    });

    // hover highlight
    const h = hovered.current;
    if (hoverRing.current) {
      hoverRing.current.visible = h >= 0;
      if (h >= 0) {
        hoverRing.current.position.set(tx(npcs[h].x), TOP.path + 0.004, tx(npcs[h].z));
        hoverRing.current.scale.setScalar(1 + Math.sin(t * 5) * 0.08);
      }
    }
    if (hoverAnchor.current && h >= 0) hoverAnchor.current.position.set(tx(npcs[h].x), TOP.path + 0.3, tx(npcs[h].z));
    if (hoverDiv.current) hoverDiv.current.style.opacity = h >= 0 && alive > 0.5 ? "1" : "0";
  });

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    if (!worldActive(index) || e.instanceId == null || scroll.world < P.aliveB) return;
    e.stopPropagation();
    hovered.current = e.instanceId;
    setHover(e.instanceId);
    document.body.style.cursor = "pointer";
  };
  const onOut = () => {
    if (hovered.current < 0) return;
    hovered.current = -1;
    setHover(-1);
    document.body.style.cursor = "";
  };

  const npcColors = useMemo(() => RESIDENTS.map((r) => new THREE.Color(r.color)), []);
  const hairColors = useMemo(
    () => RESIDENTS.map((_, i) => new THREE.Color(["#2a2320", "#4a3322", "#1d1a18", "#6b4a2e"][i % 4])),
    [],
  );

  const lampSpots: [number, number][] = [
    [5.8, 7.6],
    [8.6, 7.6],
    [5.8, 9.4],
    [8.6, 9.4],
    [3.6, 3.6],
    [11.4, 12.4],
  ];

  const starGeo = useMemo(() => {
    const rand = rng(11);
    const pts: number[] = [];
    for (let i = 0; i < 260; i++) {
      const a = rand() * Math.PI * 2;
      const e = 0.15 + rand() * 1.1;
      const r = 9 + rand() * 5;
      pts.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r - 1, Math.sin(a) * Math.cos(e) * r);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);

  return (
    <group>
      <StageFloor radius={5} accent={ACCENT} />
      <BlobShadow size={4.4} opacity={0.55} />

      <group ref={island} position-y={ISLAND_Y}>
        <instancedMesh
          ref={(m) => {
            tilesTop.current = m;
            setupColors(m, topColors);
          }}
          args={[geos.box, mats.tile, landTiles.length]}
          frustumCulled={false}
          raycast={() => null}
        />
        <instancedMesh
          ref={(m) => {
            tilesDirt.current = m;
            setupColors(m, dirtColors);
          }}
          args={[geos.box, mats.dirt, map.tiles.length]}
          frustumCulled={false}
          raycast={() => null}
        />
        <instancedMesh
          ref={water}
          args={[geos.box, mats.water, waterTiles.length]}
          frustumCulled={false}
          raycast={() => null}
        />
        <instancedMesh ref={trunks} args={[geos.trunk, mats.trunk, map.trees.length]} frustumCulled={false} raycast={() => null} />
        <instancedMesh
          ref={(m) => {
            leaves.current = m;
            setupColors(m, leafColors);
          }}
          args={[geos.leaf, mats.leaf, map.trees.length]}
          frustumCulled={false}
          raycast={() => null}
        />

        {HOUSES.map((h, i) => (
          <group key={i} position={[tx(h.x), TOP.grass, tx(h.z)]} rotation-y={h.rot}>
            <group ref={(g) => void (houses.current[i] = g)} scale={0.0001}>
              <House roof={h.roof} big={h.big} mats={mats} />
            </group>
          </group>
        ))}

        {/* plaza: flagpole with the accent banner */}
        <group ref={plaza} position={[tx(7), TOP.path, tx(8)]} scale={0.0001}>
          <mesh material={mats.stone} position-y={0.02}>
            <cylinderGeometry args={[0.09, 0.1, 0.04, 8]} />
          </mesh>
          <mesh material={mats.pole} position-y={0.24}>
            <cylinderGeometry args={[0.008, 0.008, 0.44, 6]} />
          </mesh>
          <Flag material={mats.flag} />
        </group>

        {lampSpots.map(([x, z], i) => (
          <group key={i} position={[tx(x), TOP.path, tx(z)]}>
            <mesh material={mats.pole} position-y={0.08}>
              <cylinderGeometry args={[0.006, 0.008, 0.16, 5]} />
            </mesh>
            <mesh material={mats.bulbMat} position-y={0.17}>
              <sphereGeometry args={[0.016, 8, 6]} />
            </mesh>
          </group>
        ))}
        <group ref={glows} visible={false}>
          {lampSpots.map(([x, z], i) => (
            <sprite key={i} position={[tx(x), TOP.path + 0.17, tx(z)]} scale={0.34} raycast={() => null}>
              <spriteMaterial map={glowTexture()} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0} toneMapped={false} />
            </sprite>
          ))}
        </group>

        {/* residents */}
        <instancedMesh
          ref={(m) => {
            bodies.current = m;
            setupColors(m, npcColors);
          }}
          args={[geos.body, mats.npc, npcs.length]}
          frustumCulled={false}
          onPointerOver={onOver}
          onPointerOut={onOut}
        />
        <instancedMesh
          ref={heads}
          args={[geos.head, mats.skin, npcs.length]}
          frustumCulled={false}
          onPointerOver={onOver}
          onPointerOut={onOut}
        />
        <instancedMesh
          ref={(m) => {
            hair.current = m;
            setupColors(m, hairColors);
          }}
          args={[geos.hair, mats.hair, npcs.length]}
          frustumCulled={false}
          raycast={() => null}
        />

        <mesh ref={hoverRing} rotation-x={-Math.PI / 2} visible={false} raycast={() => null}>
          <ringGeometry args={[0.07, 0.085, 32]} />
          <meshBasicMaterial color={ACCENT} transparent opacity={0.9} depthWrite={false} toneMapped={false} />
        </mesh>

        {[0, 1].map((i) => (
          <mesh
            key={`ring${i}`}
            ref={(m) => void (featuredRings.current[i] = m)}
            rotation-x={-Math.PI / 2}
            visible={false}
            raycast={() => null}
          >
            <ringGeometry args={[0.075, 0.09, 32]} />
            <meshBasicMaterial color={i ? "#8fa2d8" : ACCENT} transparent opacity={0.85} depthWrite={false} toneMapped={false} />
          </mesh>
        ))}
        {[0, 1].map((i) => (
          <group key={i} ref={(g) => void (featuredAnchors.current[i] = g)}>
            <Label center zIndex={20}>
              <div
                ref={(d) => void (featuredDivs.current[i] = d)}
                className="world-label"
                style={{ "--accent": RESIDENTS[i].color === "#3d4a6b" ? "#8fa2d8" : ACCENT, opacity: 0 } as React.CSSProperties}
              >
                {RESIDENTS[i].name} <small>· {RESIDENTS[i].decision}</small>
              </div>
            </Label>
          </group>
        ))}
        <group ref={hoverAnchor}>
          <Label center zIndex={21}>
            <div ref={hoverDiv} className="world-label" style={{ "--accent": ACCENT, opacity: 0 } as React.CSSProperties}>
              {hover >= 0 ? (
                <>
                  {RESIDENTS[hover].name} <small>· {RESIDENTS[hover].decision}</small>
                </>
              ) : null}
            </div>
          </Label>
        </group>
      </group>

      <points ref={stars} geometry={starGeo} visible={false} raycast={() => null}>
        <pointsMaterial color="#dfe6ff" size={0.07} sizeAttenuation transparent opacity={0} depthWrite={false} toneMapped={false} />
      </points>
    </group>
  );
}

type Mats = ReturnType<typeof makeMaterials>;

function House({ roof, big, mats }: { roof: "red" | "blue" | "green"; big?: boolean; mats: Mats }) {
  const w = big ? 0.42 : 0.34;
  const d = big ? 0.34 : 0.28;
  const h = big ? 0.24 : 0.2;
  const roofMat = roof === "red" ? mats.roofRed : roof === "blue" ? mats.roofBlue : mats.roofGreen;
  return (
    <group>
      <mesh material={mats.wallTrim} position-y={0.012}>
        <boxGeometry args={[w + 0.03, 0.024, d + 0.03]} />
      </mesh>
      <mesh material={mats.wall} position-y={h / 2}>
        <boxGeometry args={[w, h, d]} />
      </mesh>
      {/* gable roof: a 4-sided cone squashed into a hip roof */}
      <mesh material={roofMat} position-y={h + 0.09} rotation-y={Math.PI / 4} scale={[w * 1.62, 0.18, d * 1.62]}>
        <coneGeometry args={[0.5, 1, 4]} />
      </mesh>
      <mesh material={mats.door} position={[0, 0.06, d / 2 + 0.002]}>
        <planeGeometry args={[0.06, 0.1]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={mats.windowMat} position={[s * w * 0.3, h * 0.6, d / 2 + 0.002]}>
          <planeGeometry args={[0.055, 0.05]} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`s${s}`} material={mats.windowMat} position={[s * (w / 2 + 0.002), h * 0.6, 0]} rotation-y={(s * Math.PI) / 2}>
          <planeGeometry args={[0.05, 0.05]} />
        </mesh>
      ))}
    </group>
  );
}

function Flag({ material }: { material: THREE.Material }) {
  const mesh = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => new THREE.PlaneGeometry(0.16, 0.1, 8, 1).translate(0.08, 0, 0), []);
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array), [geo]);
  useFrame(({ clock }) => {
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const t = clock.elapsedTime;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3];
      pos.setZ(i, Math.sin(x * 30 - t * 4) * x * 0.18);
    }
    pos.needsUpdate = true;
  });
  return <mesh ref={mesh} geometry={geo} material={material} position={[0.008, 0.41, 0]} />;
}

export const jevWorld: WorldDef = {
  id: "jev",
  steps: [
    { at: 0, label: "The island", caption: "A GBA-style tile town assembles, tile by tile." },
    { at: 0.28, label: "Residents", caption: "Twenty NPCs walk their own routes across the map." },
    { at: 0.46, label: "Decisions", caption: "A pluggable agent layer picks every next move." },
    { at: 0.74, label: "Night falls", caption: "Day turns to night — the town keeps living." },
  ],
  camera: (p, t, out) => {
    // orbit slowly around the island; lean in for the decisions, pull back at night
    const yaw = -0.55 + p * 0.85 + Math.sin(t * 0.12) * 0.04;
    const close = beat(p, 0.36, 0.52) * (1 - beat(p, 0.72, 0.9));
    const dist = 6.4 + (1 - beat(p, 0, 0.24)) * 0.8 - close * 1.2;
    const elev = 0.72 + close * 0.08 + Math.sin(t * 0.17) * 0.015;
    out.target.set(0, ISLAND_Y + 0.05 - close * 0.05, close * 0.1);
    out.position.set(
      out.target.x + Math.sin(yaw) * Math.cos(elev) * dist,
      out.target.y + Math.sin(elev) * dist,
      out.target.z + Math.cos(yaw) * Math.cos(elev) * dist,
    );
  },
  Component: JevScene,
};
