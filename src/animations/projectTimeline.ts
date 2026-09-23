import type { ProjectPhase } from "./store";

// Each project owns one scroll "unit" of the pinned #projects track:
//
//   0 ─ approach ─ 0.12 ─ dive ─ 0.22 │ world story ───────────── 0.92 ─ exit ─ 1
//        fly to sticker     push in,   cut   story progress 0→1          fade to dark
//                           accent       ▲
//                           circle grows └ camera teleports into the world under the cover
//
// Everything here is pure maths so the DOM overlay and the render loop agree.

export const T = {
  approachEnd: 0.12,
  cut: 0.22,
  revealEnd: 0.3,
  exitStart: 0.92,
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => v * v * (3 - 2 * v);
const range = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));

export type Timeline = {
  phase: ProjectPhase;
  /** 0..1 push into the sticker */
  dive: number;
  /** 0..1 story progress inside the world */
  world: number;
  /** accent dive circle, 0..1 (radius) */
  circle: number;
  /** flat opacity of the cover (accent during reveal, dark during exit / entry) */
  fade: number;
  /** which colour the cover uses */
  tone: "accent" | "dark";
};

/** `local` = progress through this project's unit, `first` = no preceding world to fade out from. */
export function timeline(local: number, first: boolean): Timeline {
  const p = clamp01(local);
  const phase: ProjectPhase = p < T.approachEnd ? "approach" : p < T.cut ? "dive" : "world";
  const dive = smooth(range(p, T.approachEnd, T.cut));
  const world = range(p, T.cut, T.exitStart);

  let circle = 0;
  let fade = 0;
  let tone: Timeline["tone"] = "accent";
  if (p < T.cut) {
    // accent circle opens from the sticker during the last 60% of the dive
    circle = smooth(range(p, T.approachEnd + (T.cut - T.approachEnd) * 0.4, T.cut));
    fade = circle > 0 ? 1 : 0;
    // coming in from the previous world: start covered in dark, clear quickly
    if (!first && p < 0.05) {
      tone = "dark";
      circle = 1;
      fade = 1 - smooth(range(p, 0, 0.05));
    }
  } else if (p < T.revealEnd) {
    circle = 1;
    fade = 1 - smooth(range(p, T.cut, T.revealEnd));
  } else if (p > T.exitStart) {
    tone = "dark";
    circle = 1;
    fade = smooth(range(p, T.exitStart, 1));
  }
  return { phase, dive, world, circle, fade, tone };
}
