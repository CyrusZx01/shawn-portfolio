import * as THREE from "three";
import { SCREEN_YELLOW } from "./parts";

// Homie's face: yellow stacked-bar eyes drawn in a shader (so they can look, blink
// and bounce every frame for free) + a subtitle line from a small canvas that is only
// redrawn when the typed text changes.

export function createSubtitle() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const family =
    getComputedStyle(document.documentElement).getPropertyValue("--font-text").trim() ||
    "'Helvetica Neue', Arial, sans-serif";
  let last = "";

  function draw(text: string, cursor: boolean) {
    const key = text + (cursor ? "|" : "");
    if (key === last) return;
    last = key;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `500 58px ${family}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    const full = ctx.measureText(text).width;
    const x = (canvas.width - full) / 2;
    ctx.fillStyle = "#f6efe2";
    ctx.fillText(text, x, 66);
    if (cursor) {
      ctx.fillStyle = SCREEN_YELLOW;
      ctx.fillRect(x + full + 8, 40, 26, 52);
    }
    texture.needsUpdate = true;
  }
  return { texture, draw };
}

/** `aspect` = screen width / height (the eyes and subtitle are laid out in height units). */
export function createScreenMaterial(text: THREE.Texture, aspect: number) {
  return new THREE.ShaderMaterial({
    toneMapped: false,
    uniforms: {
      uTime: { value: 0 },
      uLook: { value: new THREE.Vector2() },
      uOpen: { value: 1 },
      uBars: { value: 0 },
      uPower: { value: 1 },
      uFlash: { value: 0 },
      uYellow: { value: new THREE.Color(SCREEN_YELLOW) },
      uCream: { value: new THREE.Color("#f6efe2") },
      uText: { value: text },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uOpen, uBars, uPower, uFlash;
      uniform vec2 uLook;
      uniform vec3 uYellow, uCream;
      uniform sampler2D uText;
      varying vec2 vUv;

      float sdBox(vec2 p, vec2 b, float r) {
        vec2 q = abs(p) - b + r;
        return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
      }

      // one eye = four equal pill bars stacked tight (poster)
      float eye(vec2 p, float seed) {
        float d = 1e3;
        for (int i = 0; i < 4; i++) {
          float fi = float(i);
          float y = (fi - 1.5) * 0.084 * uOpen;
          float w = 0.1;
          w *= 1.0 + 0.32 * uBars * sin(uTime * 9.0 + fi * 1.9 + seed * 2.3);
          float h = 0.03 * uOpen + 0.004;
          d = min(d, sdBox(p - vec2(0.0, y), vec2(w, h), h));
        }
        return d;
      }

      void main() {
        vec2 p = (vUv - 0.5) * vec2(${aspect.toFixed(4)}, 1.0);
        vec2 look = uLook * vec2(0.075, 0.045);

        // screen ground: near-black with a soft centre lift
        vec3 col = vec3(0.004, 0.0045, 0.0055) + 0.012 * (1.0 - length(p) * 1.3);

        vec2 eyeC = vec2(0.0, 0.085) + look;
        float dl = eye(p - eyeC - vec2(-0.2, 0.0), 0.0);
        float dr = eye(p - eyeC - vec2(0.2, 0.0), 1.0);
        float d = min(dl, dr);
        float aa = fwidth(d) * 0.8;
        float fill = 1.0 - smoothstep(-aa, aa, d);
        float glow = exp(-max(d, 0.0) * 34.0) * 0.28;
        col += uYellow * (fill * 1.35 + glow) * uPower;

        // subtitle band
        vec2 tuv = vec2(vUv.x, (vUv.y - 0.07) / 0.17);
        if (tuv.y > 0.0 && tuv.y < 1.0) {
          vec4 t = texture2D(uText, tuv);
          col = mix(col, uCream * 1.1, t.a * uPower);
        }


        // scanlines + glass sheen + flash
        col *= 0.93 + 0.07 * sin(vUv.y * 420.0);
        float sheen = smoothstep(0.25, 0.0, abs(vUv.x - vUv.y * 0.7 - 0.12)) * 0.035;
        col += sheen;
        col += uYellow * uFlash * 0.6;

        // rounded screen corners
        float edge = sdBox(p, vec2(${(aspect / 2).toFixed(4)}, 0.5), 0.07);
        col *= 1.0 - smoothstep(-0.01, 0.0, edge);

        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}
