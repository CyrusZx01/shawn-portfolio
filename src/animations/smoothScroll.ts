import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// Inertial wheel scrolling on top of *native* window scroll (so position:sticky,
// ScrollTrigger and anchor links keep working). Wheel deltas move a target; the
// real scroll position eases toward it on GSAP's ticker, which is the same rAF
// the canvas and ScrollTrigger use, so the 3D never lags a frame behind the DOM.
// Touch, keyboard and scrollbar dragging stay native.

const LERP = 0.1; // per 60 fps frame
let target = 0;
let current = 0;
let running = false;
let tween: gsap.core.Tween | null = null;
let started = false;
let locked = false;

const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;

function onWheel(e: WheelEvent) {
  if (e.ctrlKey) return; // pinch-zoom
  if (locked) {
    e.preventDefault();
    return;
  }
  e.preventDefault();
  tween?.kill();
  tween = null;
  if (!running) current = target = window.scrollY;
  const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? window.innerHeight : 1;
  // Trackpads send many small deltas; mice send ~100px notches. Both feel right at 1x.
  target = Math.max(0, Math.min(maxScroll(), target + e.deltaY * unit));
  running = true;
}

function onNativeScroll() {
  // Keyboard / scrollbar / touch moved the page: follow it instead of fighting it.
  if (!running && !tween) current = target = window.scrollY;
}

function tick(_time: number, deltaMs: number) {
  if (!running) return;
  const k = 1 - Math.pow(1 - LERP, Math.min(deltaMs, 64) / 16.67);
  current += (target - current) * k;
  if (Math.abs(target - current) < 0.4) {
    current = target;
    running = false;
  }
  window.scrollTo(0, current);
}

export function startSmoothScroll() {
  if (started) return () => {};
  started = true;
  const fine = window.matchMedia("(pointer: fine)").matches;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  current = target = window.scrollY;
  if (fine && !reduced) window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("scroll", onNativeScroll, { passive: true });
  gsap.ticker.add(tick);
  // Keep ScrollTrigger in lock-step with the ticker instead of its own scroll listener timing.
  gsap.ticker.lagSmoothing(0);
  return () => {
    started = false;
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("scroll", onNativeScroll);
    gsap.ticker.remove(tick);
  };
}

/** Animated scroll to an absolute y. */
export function smoothScrollTo(y: number, duration?: number) {
  running = false;
  tween?.kill();
  const to = Math.max(0, Math.min(maxScroll(), y));
  const distance = Math.abs(to - window.scrollY);
  const state = { y: window.scrollY };
  tween = gsap.to(state, {
    y: to,
    duration: duration ?? Math.min(2.2, 0.8 + distance / 2600),
    ease: "power3.inOut",
    onUpdate: () => {
      window.scrollTo(0, state.y);
    },
    onComplete: () => {
      current = target = to;
      tween = null;
    },
  });
}

/** Jump instantly (used under a full-screen cover). */
export function jumpScroll(y: number) {
  running = false;
  tween?.kill();
  tween = null;
  current = target = Math.max(0, Math.min(maxScroll(), y));
  window.scrollTo(0, current);
  ScrollTrigger.update();
}

export function lockScroll(on: boolean) {
  locked = on;
}
