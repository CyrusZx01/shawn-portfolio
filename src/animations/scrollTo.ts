import gsap from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";

gsap.registerPlugin(ScrollToPlugin);

/** Smoothly scroll the page to an element id. Duration scales with distance. */
export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const distance = Math.abs(el.getBoundingClientRect().top);
  gsap.to(window, {
    duration: Math.min(2.2, 0.7 + distance / 2200),
    ease: "power3.inOut",
    scrollTo: { y: el, autoKill: true },
  });
}
