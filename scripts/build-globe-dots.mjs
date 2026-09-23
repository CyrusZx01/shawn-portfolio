// Builds src/worlds/data/globeDots.json: land dots on an even-area lat/lng grid,
// from Human Weather's world.geojson. Run once: node scripts/build-globe-dots.mjs
import fs from "fs";
const geo = JSON.parse(fs.readFileSync("/Users/shawn/Projects/human-weather/public/world.geojson", "utf8"));
const polys = [];
for (const f of geo.features) {
  const g = f.geometry;
  if (!g) continue;
  const list = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
  for (const p of list) {
    const ring = p[0];
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const [x, y] of ring) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    polys.push({ rings: p, minX, maxX, minY, maxY });
  }
}
const inRing = (x, y, r) => {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const land = (x, y) =>
  polys.some((p) => x >= p.minX && x <= p.maxX && y >= p.minY && y <= p.maxY && inRing(x, y, p.rings[0]) && !p.rings.slice(1).some((h) => inRing(x, y, h)));
const out = [];
const step = 1.35;
for (let lat = -58; lat <= 80; lat += step) {
  const n = Math.max(1, Math.round((360 / step) * Math.cos((lat * Math.PI) / 180)));
  for (let i = 0; i < n; i++) {
    const lng = -180 + (i + 0.5) * (360 / n);
    if (land(lng, lat)) out.push(+lat.toFixed(2), +lng.toFixed(2));
  }
}
fs.writeFileSync("src/worlds/data/globeDots.json", JSON.stringify(out));
console.log("dots", out.length / 2);
