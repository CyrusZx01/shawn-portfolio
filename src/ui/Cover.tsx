"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { getUi, scroll } from "@/animations/store";
import { projects } from "@/sections/content";

/** Full-screen cut between the bust and a project world. During a dive the
 * project's accent opens as a circle from the sticker, then dissolves to
 * reveal the world; between worlds (and on long jumps) it's a dark fade.
 * Written straight to the DOM on the GSAP ticker: no React renders. */
export function Cover() {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let last = "";
    const tick = () => {
      const node = el.current;
      if (!node) return;
      const jump = scroll.jumpCover;
      const opacity = Math.max(scroll.cover, jump);
      const dark = scroll.coverDark || jump > scroll.cover;
      const { active } = getUi();
      const w = window.innerWidth;
      const h = window.innerHeight;
      let clip = "none";
      let bg = "var(--bg)";
      if (!dark) {
        bg = active >= 0 ? projects[active].accent : "var(--bg)";
        const r = scroll.coverCircle * Math.hypot(w, h) * 1.05;
        clip = `circle(${r.toFixed(1)}px at ${scroll.coverX.toFixed(1)}px ${scroll.coverY.toFixed(1)}px)`;
      }
      const key = `${opacity.toFixed(3)}|${bg}|${clip}`;
      if (key === last) return;
      last = key;
      node.style.opacity = opacity.toFixed(3);
      node.style.background = bg;
      node.style.clipPath = clip;
      node.style.visibility = opacity > 0.001 ? "visible" : "hidden";
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, []);

  return <div ref={el} className="cover" aria-hidden />;
}
