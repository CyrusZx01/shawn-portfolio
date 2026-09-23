// Deterministic tile map for the JEV World diorama: a round floating island with a
// ring road, a cross street, a central plaza, a pond, houses and trees.

export const N = 16;
export const TILE = 0.24;
const C = (N - 1) / 2;

export type TileKind = "grass" | "path" | "water" | "sand";
export type Tile = { x: number; z: number; kind: TileKind; r: number; seed: number };

/** Seeded PRNG so the island is identical every load (and between SSR / lab / site). */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tile coords → world-local x/z (island centred on the origin). */
export const tx = (x: number) => (x - C) * TILE;

export const HOUSES: { x: number; z: number; roof: "red" | "blue" | "green"; rot: number; big?: boolean }[] = [
  { x: 5.5, z: 5.5, roof: "red", rot: 0 },
  { x: 9.5, z: 5.5, roof: "blue", rot: 0 },
  { x: 5.5, z: 10.5, roof: "blue", rot: Math.PI },
  { x: 9.8, z: 10.5, roof: "green", rot: Math.PI, big: true },
  { x: 2.2, z: 6.5, roof: "red", rot: Math.PI / 2 },
  { x: 13, z: 10, roof: "red", rot: -Math.PI / 2 },
];

function isPath(x: number, z: number) {
  const loop =
    ((x === 4 || x === 11) && z >= 4 && z <= 12) || ((z === 4 || z === 12) && x >= 4 && x <= 11);
  const cross = x === 7 && z >= 1 && z <= 14;
  const street = z === 8 && x >= 1 && x <= 14;
  const plaza = x >= 6 && x <= 8 && z >= 7 && z <= 9;
  return loop || cross || street || plaza;
}

function houseCell(x: number, z: number) {
  return HOUSES.some((h) => Math.abs(h.x - x) < 1.01 && Math.abs(h.z - z) < 1.01);
}

export function buildMap() {
  const rand = rng(190);
  const tiles: Tile[] = [];
  const grid: (TileKind | null)[][] = [];
  for (let z = 0; z < N; z++) {
    grid[z] = [];
    for (let x = 0; x < N; x++) {
      const dx = x - C;
      const dz = z - C;
      const r = Math.hypot(dx, dz);
      const a = Math.atan2(dz, dx);
      const edge = 7.3 + Math.sin(a * 3 + 1.2) * 0.45 + Math.sin(a * 5) * 0.25;
      if (r > edge) {
        grid[z][x] = null;
        continue;
      }
      let kind: TileKind = "grass";
      const pond = Math.hypot(x - 12.2, z - 3.6);
      if (pond < 1.9) kind = "water";
      else if (r > edge - 0.6) kind = "sand";
      if (isPath(x, z) && kind !== "water") kind = "path";
      if (houseCell(x, z) && kind !== "path") kind = "grass";
      grid[z][x] = kind;
      tiles.push({ x, z, kind, r: r / C, seed: rand() });
    }
  }

  // trees on grass away from paths and houses, denser toward the rim
  const trees: { x: number; z: number; s: number; pine: boolean }[] = [];
  for (const t of tiles) {
    if (t.kind !== "grass" || houseCell(t.x, t.z)) continue;
    const nearPath = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].some(([ox, oz]) => grid[t.z + oz]?.[t.x + ox] === "path");
    if (nearPath) continue;
    const p = 0.12 + t.r * 0.45;
    if (rand() < p) trees.push({ x: t.x + (rand() - 0.5) * 0.3, z: t.z + (rand() - 0.5) * 0.3, s: 0.8 + rand() * 0.5, pine: rand() < 0.35 });
  }

  const pathCells = tiles.filter((t) => t.kind === "path").map((t) => [t.x, t.z] as [number, number]);
  return { tiles, grid, trees, pathCells };
}

/** BFS across path tiles. Returns tile coords from start (exclusive) to goal. */
export function route(grid: (TileKind | null)[][], from: [number, number], to: [number, number]) {
  const key = (x: number, z: number) => z * N + x;
  const prev = new Map<number, number>();
  const q: [number, number][] = [from];
  prev.set(key(...from), -1);
  while (q.length) {
    const [x, z] = q.shift()!;
    if (x === to[0] && z === to[1]) break;
    for (const [ox, oz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + ox;
      const nz = z + oz;
      if (grid[nz]?.[nx] !== "path" || prev.has(key(nx, nz))) continue;
      prev.set(key(nx, nz), key(x, z));
      q.push([nx, nz]);
    }
  }
  const out: [number, number][] = [];
  let k = key(...to);
  if (!prev.has(k)) return out;
  while (k !== key(...from) && k !== -1) {
    out.push([k % N, Math.floor(k / N)]);
    k = prev.get(k)!;
  }
  return out.reverse();
}

export const RESIDENTS: { name: string; decision: string; color: string }[] = [
  { name: "Liu Bei", decision: "recruit ally", color: "#7cc653" },
  { name: "Cao Cao", decision: "raise grain tax", color: "#3d4a6b" },
  { name: "Sun Jian", decision: "scout the river", color: "#d9573b" },
  { name: "Guan Yu", decision: "guard the gate", color: "#2f7d4f" },
  { name: "Zhang Fei", decision: "visit the tavern", color: "#5a3d2e" },
  { name: "Zhuge Liang", decision: "study the map", color: "#e8e2d4" },
  { name: "Diao Chan", decision: "trade silk", color: "#d98aa6" },
  { name: "Dong Zhuo", decision: "hoard grain", color: "#6b2f2f" },
  { name: "Lü Bu", decision: "challenge a duel", color: "#b8412e" },
  { name: "Zhao Yun", decision: "patrol the road", color: "#e9e4da" },
  { name: "Yuan Shao", decision: "call a council", color: "#c9a13b" },
  { name: "Huang Zhong", decision: "go hunting", color: "#8a6a3a" },
  { name: "Ma Chao", decision: "train cavalry", color: "#dcdcdc" },
  { name: "Xiahou Dun", decision: "drill troops", color: "#3a4f7a" },
  { name: "Lu Su", decision: "broker a truce", color: "#4f8fa8" },
  { name: "Zhou Yu", decision: "play the zither", color: "#b3453e" },
  { name: "Sun Shangxiang", decision: "practise archery", color: "#e07b4f" },
  { name: "Pang Tong", decision: "plan a detour", color: "#6d6a5c" },
  { name: "Gan Ning", decision: "fish at the pond", color: "#caa24b" },
  { name: "Xu Shu", decision: "help a neighbour", color: "#7a8fb0" },
];
