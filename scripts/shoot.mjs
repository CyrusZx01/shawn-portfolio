// Visual check: screenshot the running dev server at given scroll positions.
// usage: node scripts/shoot.mjs <width> <height> <outPrefix> <scroll...>
//   scroll = "0.33" (viewport heights) or "id:project-homie" (element top) or "id:project-homie+1.5" (top + vh)
import { chromium } from "playwright";

const [, , w = 2200, h = 1136, out = "shots/shot", ...scrolls] = process.argv;
const url = process.env.URL ?? "http://localhost:3217/";

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
// STATIC=out serves a static export straight from disk (no server needed)
if (process.env.STATIC) {
  const { readFile } = await import("node:fs/promises");
  const { join, extname } = await import("node:path");
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".glb": "model/gltf-binary", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".txt": "text/plain" };
  await page.route("http://static.local/**", async (route) => {
    let path = decodeURIComponent(new URL(route.request().url()).pathname);
    if (path.endsWith("/")) path += "index.html";
    try {
      const body = await readFile(join(process.env.STATIC, path));
      await route.fulfill({ body, contentType: types[extname(path)] ?? "application/octet-stream" });
    } catch {
      await route.fulfill({ status: 404, body: "" });
    }
  });
}
const logs = [];
page.on("console", (m) => {
  if (["error", "warning"].includes(m.type())) logs.push(`${m.type()}: ${m.text()}`);
});
page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));

await page.goto(url, { waitUntil: "networkidle" });
await page.waitForFunction(() => !document.documentElement.classList.contains("is-loading"), null, {
  timeout: 90000,
});
await page.waitForTimeout(3500);

for (const s of scrolls.length ? scrolls : ["0"]) {
  const [mode, val] = s.includes(":") ? s.split(":") : ["vh", s];
  await page.evaluate(
    ([mode, val]) => {
      const [id, off = "0"] = val.split("+");
      const y =
        mode === "id"
          ? document.getElementById(id).getBoundingClientRect().top + scrollY + +off * innerHeight
          : +val * innerHeight;
      window.scrollTo(0, y);
    },
    [mode, val],
  );
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${out}-${s.replace(":", "_")}.png` });
}
console.log(logs.slice(0, 15).join("\n") || "no console errors");
await browser.close();
