import * as THREE from "three";

// Minimal world-anchored DOM labels. drei <Html> spins up a React root per label, which
// races under StrictMode; these are plain divs positioned from useFrame instead.

export type WorldLabel = {
  el: HTMLDivElement;
  /** project `worldPos` and move the label there with the given opacity */
  update(worldPos: THREE.Vector3, camera: THREE.Camera, size: { width: number; height: number }, opacity: number): void;
  dispose(): void;
};

const v = new THREE.Vector3();

export function createLabel(container: HTMLElement, html: string, accent: string): WorldLabel {
  const el = document.createElement("div");
  el.className = "world-label";
  el.innerHTML = html;
  el.style.cssText = `position:absolute;left:0;top:0;opacity:0;will-change:transform,opacity;z-index:1;--accent:${accent}`;
  container.appendChild(el);
  let lastOpacity = -1;
  return {
    el,
    update(worldPos, camera, size, opacity) {
      v.copy(worldPos).project(camera);
      const visible = opacity > 0.01 && v.z < 1;
      const o = visible ? Math.round(opacity * 100) / 100 : 0;
      if (o !== lastOpacity) {
        el.style.opacity = String(o);
        el.style.visibility = o > 0 ? "visible" : "hidden";
        lastOpacity = o;
      }
      if (!visible) return;
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
    },
    dispose() {
      el.remove();
    },
  };
}
