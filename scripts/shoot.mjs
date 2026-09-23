// Visual check: screenshot the running dev server at given scroll positions.
// usage: node scripts/shoot.mjs <width> <height> <outPrefix> <scroll...>
//   scroll = "0.33" (viewport heights) or "id:project-homie" (element top)
import { chromium } from "playwright";

const [, , w = 2200, h = 1136, out = "shots/shot", ...scrolls] = process.argv;
const url = process.env.URL ?? "http://localhost:3217/";

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
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
      const y =
        mode === "id"
          ? document.getElementById(val).getBoundingClientRect().top + scrollY
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
