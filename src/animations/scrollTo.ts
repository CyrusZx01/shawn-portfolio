import gsap from "gsap";
import { jumpScroll, lockScroll, smoothScrollTo } from "./smoothScroll";
import { scroll } from "./store";
import { projects } from "@/sections/content";

/** Where each project's scroll unit starts, as a fraction of the unit:
 * landing at WORLD_ENTRY puts the visitor straight inside the world. */
export const WORLD_ENTRY = 0.3;

function trackY(index: number, local: number) {
  const track = document.getElementById("projects");
  if (!track) return null;
  const top = track.getBoundingClientRect().top + window.scrollY;
  const unit = (track.offsetHeight - window.innerHeight) / projects.length;
  return top + unit * (index + local);
}

function elementY(id: string) {
  const el = document.getElementById(id);
  if (!el) return null;
  return el.getBoundingClientRect().top + window.scrollY;
}

/** Smoothly scroll when the target is close; for long jumps fade to dark,
 * jump, and fade back so the visitor never sits through five dives. */
export function travelTo(y: number) {
  const distance = Math.abs(y - window.scrollY);
  if (distance < window.innerHeight * 2.2) {
    smoothScrollTo(y);
    return;
  }
  lockScroll(true);
  gsap.killTweensOf(scroll, "jumpCover");
  gsap
    .timeline({ onComplete: () => lockScroll(false) })
    .to(scroll, { jumpCover: 1, duration: 0.45, ease: "power2.in" })
    .call(() => jumpScroll(y))
    .to(scroll, { jumpCover: 0, duration: 0.8, ease: "power2.out", delay: 0.25 });
}

/** Scroll to an element id. `project-<id>` targets land inside that world. */
export function scrollToId(id: string) {
  if (id.startsWith("project-")) {
    const i = projects.findIndex((p) => `project-${p.id}` === id);
    const y = trackY(i, WORLD_ENTRY + 0.02);
    if (y != null) travelTo(y);
    return;
  }
  const y = id === "top" ? 0 : elementY(id);
  if (y != null) travelTo(y);
}

export function scrollToProject(index: number, local = WORLD_ENTRY + 0.02) {
  const y = trackY(index, local);
  if (y != null) travelTo(y);
}
