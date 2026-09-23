"use client";

import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";

// A small stand-in for drei <Html>. drei unmounts its React root synchronously in a
// layout-effect cleanup, which under React 19 StrictMode races the remount and can
// wipe a label's content (the first label on a page would silently disappear).
// Here the root outlives StrictMode's fake unmount and is torn down a tick later
// only if the element really left the page. It also hides itself when any ancestor
// is invisible (drei ignores object visibility).

const v = new THREE.Vector3();

function visibleInTree(o: THREE.Object3D | null) {
  for (let n = o; n; n = n.parent) if (!n.visible) return false;
  return true;
}

export function Label({
  children,
  position,
  center = true,
  zIndex = 20,
}: {
  children: ReactNode;
  position?: [number, number, number] | THREE.Vector3;
  center?: boolean;
  zIndex?: number;
}) {
  const group = useRef<THREE.Group>(null);
  const gl = useThree((s) => s.gl);
  const connected = useThree((s) => s.events.connected) as HTMLElement | undefined;
  const target = (connected ?? gl.domElement.parentNode) as HTMLElement | null;
  const [el] = useState(() => {
    const d = document.createElement("div");
    d.style.cssText = `position:absolute;top:0;left:0;pointer-events:none;will-change:transform;z-index:${zIndex};`;
    return d;
  });
  const root = useRef<Root | null>(null);

  useLayoutEffect(() => {
    if (!target) return;
    target.appendChild(el);
    root.current ??= createRoot(el);
    return () => {
      el.remove();
      const r = root.current;
      setTimeout(() => {
        if (!el.isConnected && r && root.current === r) {
          r.unmount();
          root.current = null;
        }
      });
    };
  }, [target, el]);

  useLayoutEffect(() => {
    root.current?.render(children);
  });

  const pos = useMemo(() => (Array.isArray(position) ? new THREE.Vector3(...position) : position), [position]);

  useFrame(({ camera, size }) => {
    const g = group.current;
    if (!g) return;
    g.getWorldPosition(v);
    v.project(camera);
    const hidden = v.z > 1 || !visibleInTree(g);
    el.style.display = hidden ? "none" : "";
    if (hidden) return;
    const x = (v.x * 0.5 + 0.5) * size.width;
    const y = (-v.y * 0.5 + 0.5) * size.height;
    el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)${center ? " translate(-50%,-50%)" : ""}`;
  });

  return <group ref={group} position={pos} />;
}
