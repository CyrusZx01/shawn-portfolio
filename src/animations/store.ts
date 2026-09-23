import { useSyncExternalStore } from "react";

// Shared state between the DOM overlay (writes on scroll / hover) and the R3F
// render loop (reads every frame). Hot values are read directly off `scroll`
// so scrolling never triggers React renders; `ui` is the subscribable part.

export const scroll = {
  /** 0..1 progress through the GLB CameraAction (hero → close-up) */
  path: 0,
  /** normalised pointer, -1..1 (y down) */
  pointerX: 0,
  pointerY: 0,
  /** true once the pointer has moved at least once (touch devices may never set it) */
  pointerSeen: false,
  /** 0..1 progress of the active project's phase (see ProjectPhase) */
  local: 0,
  /** 0..1 story progress inside the active project world */
  world: 0,
  /** 0..1 push of the camera into the active sticker */
  dive: 0,
  /** full-screen cover used for cuts between the bust and a world (opacity) */
  cover: 0,
  /** 0..1 radius of the accent dive circle */
  coverCircle: 0,
  /** true: cover is the dark ground colour, false: the project accent */
  coverDark: false,
  /** cover used by jump navigation (fades to dark, jumps, fades back) */
  jumpCover: 0,
  /** screen position (px) the dive circle grows from */
  coverX: 0,
  coverY: 0,
  /** accumulated drag rotation for worlds (radians) */
  dragYaw: 0,
  dragPitch: 0,
  /** mouse button held on a world */
  dragging: false,
  /** set while shaders are being precompiled so every object is visible */
  compiling: false,
};

export type Stage = "hero" | "chapter" | "projects" | "outro";
/** approach: flying to the sticker · dive: pushing into it · world: inside the project */
export type ProjectPhase = "approach" | "dive" | "world";

type UiState = {
  loaded: boolean;
  stage: Stage;
  /** index into `projects`, -1 when none is focused */
  active: number;
  phase: ProjectPhase;
  /** index of the current story step inside the active world */
  step: number;
  /** decal index under the pointer, -1 when none */
  hovered: number;
  /** corner chrome hides during the close-up, as in the reference */
  chromeHidden: boolean;
};

let ui: UiState = {
  loaded: false,
  stage: "hero",
  active: -1,
  phase: "approach",
  step: 0,
  hovered: -1,
  chromeHidden: false,
};
const listeners = new Set<() => void>();

export function setUi(patch: Partial<UiState>) {
  let changed = false;
  for (const k in patch) {
    const key = k as keyof UiState;
    if (patch[key] !== ui[key]) changed = true;
  }
  if (!changed) return;
  ui = { ...ui, ...patch };
  listeners.forEach((l) => l());
}

export function getUi() {
  return ui;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useUi<T>(select: (s: UiState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => select(ui),
    () => select(ui),
  );
}

/** True when the given world should be simulated / drawn this frame. */
export function worldActive(index: number) {
  if (scroll.compiling) return true;
  const { stage, active, phase } = ui;
  return stage === "projects" && active === index && phase === "world";
}
