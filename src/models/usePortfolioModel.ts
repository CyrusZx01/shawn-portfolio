import { useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";

export const MODEL_URL = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/models/portfolio.glb`;

export type Decal = {
  name: string;
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  /** world-space centre of the sticker */
  center: THREE.Vector3;
};

export type FocusMarker = {
  name: string;
  position: THREE.Vector3;
  dofEnabled: boolean;
  dofBokeh: number;
  dofFocusRange: number;
};

/** Loads portfolio.glb and pulls out the pieces the scene drives:
 * the bust (`model`), the animated `Camera`, `CameraAction`, decals and focus markers. */
export function usePortfolioModel() {
  const gltf = useGLTF(MODEL_URL);
  return useMemo(() => {
    // Parsed once per GLTF: <primitive> re-parents `model` out of the scene, so a
    // second lookup (remount, HMR, another consumer) would no longer find it.
    let parts = cache.get(gltf);
    if (!parts) cache.set(gltf, (parts = extract(gltf)));
    return parts;
  }, [gltf]);
}

type GLTFLike = ReturnType<typeof useGLTF> & { scene: THREE.Group; animations: THREE.AnimationClip[] };
const cache = new WeakMap<object, ReturnType<typeof extract>>();

function extract(gltf: GLTFLike) {
  {
    const root = gltf.scene;
    root.updateMatrixWorld(true);

    const model = root.getObjectByName("model")!;
    const camera = root.getObjectByName("Camera")!;
    const clip = gltf.animations.find((a) => a.name === "CameraAction") ?? gltf.animations[0];

    const decals: Decal[] = [];
    const focus: FocusMarker[] = [];
    model.traverse((o) => {
      if (o.name.startsWith("decal-") && (o as THREE.Mesh).isMesh) {
        const mesh = o as THREE.Mesh;
        mesh.geometry.computeBoundingBox();
        const center = mesh.geometry.boundingBox!.getCenter(new THREE.Vector3());
        mesh.localToWorld(center);
        const material = (mesh.material as THREE.MeshStandardMaterial).clone();
        material.emissive = new THREE.Color("#ffffff");
        material.emissiveMap = material.map;
        material.emissiveIntensity = 0;
        mesh.material = material;
        // Stickers are coplanar with skin; keep them on top without z-fighting.
        material.polygonOffset = true;
        material.polygonOffsetFactor = -2;
        decals.push({ name: o.name, mesh, material, center });
      }
      if (o.name.startsWith("focus-")) {
        const e = o.userData as Partial<FocusMarker>;
        focus.push({
          name: o.name,
          position: o.getWorldPosition(new THREE.Vector3()),
          dofEnabled: !!e.dofEnabled,
          dofBokeh: e.dofBokeh ?? 4,
          dofFocusRange: e.dofFocusRange ?? 0.5,
        });
      }
      if ((o as THREE.Mesh).isMesh && !o.name.startsWith("decal-")) {
        o.castShadow = false;
        o.receiveShadow = false;
      }
    });
    decals.sort((a, b) => a.name.localeCompare(b.name));

    return { root, model, camera, clip, decals, focus };
  }
}

useGLTF.preload(MODEL_URL);
