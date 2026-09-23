import { useSyncExternalStore } from "react";

// Shared state between the DOM overlay (writes on scroll / hover) and the R3F
// render loop (reads every frame). Hot values are read directly off `scroll`
// so scrolling never triggers React renders; `ui` is the subscribable part.

export const scroll = {
  /** 0..1 progress through the GLB CameraAction (hero → close-up) */
  path: 0,
  /** normalised pointer, -1..1 */
  pointerX: 0,
  pointerY: 0,
};

export type Stage = "hero" | "chapter" | "projects" | "outro";

type UiState = {
  loaded: boolean;
  stage: Stage;
  /** index into `projects`, -1 when none is focused */
  active: number;
  /** decal index under the pointer, -1 when none */
  hovered: number;
  /** corner chrome hides during the close-up, as in the reference */
  chromeHidden: boolean;
};

let ui: UiState = { loaded: false, stage: "hero", active: -1, hovered: -1, chromeHidden: false };
const listeners = new Set<() => void>();

export function setUi(patch: Partial<UiState>) {
  const next = { ...ui, ...patch };
  if (
    next.loaded === ui.loaded &&
    next.stage === ui.stage &&
    next.active === ui.active &&
    next.hovered === ui.hovered &&
    next.chromeHidden === ui.chromeHidden
  )
    return;
  ui = next;
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
