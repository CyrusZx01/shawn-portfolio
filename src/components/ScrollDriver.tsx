"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { scroll, setUi, getUi, type Stage } from "@/animations/store";
import { startSmoothScroll } from "@/animations/smoothScroll";
import { timeline } from "@/animations/projectTimeline";
import { projects } from "@/sections/content";
import { worlds, stepAt } from "@/worlds";

gsap.registerPlugin(ScrollTrigger);

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Maps page scroll to scene state:
 *  hero → chapter (scrubs CameraAction 0→1) → projects (pinned track: approach,
 *  dive, world story per project) → outro.
 *  Layout is measured once per resize so scrolling never forces a reflow. */
export function ScrollDriver() {
  useEffect(() => {
    const stopSmooth = startSmoothScroll();

    const layout = { chapter: 0, projects: 0, unit: 1, contact: 0, h: 1 };
    const docTop = (id: string) => {
      const el = document.getElementById(id);
      return el ? el.getBoundingClientRect().top + window.scrollY : 0;
    };
    const measure = () => {
      const h = window.innerHeight;
      const track = document.getElementById("projects");
      layout.h = h;
      layout.chapter = docTop("chapter");
      layout.projects = docTop("projects");
      layout.unit = track ? Math.max(1, (track.offsetHeight - h) / projects.length) : 1;
      layout.contact = docTop("contact");
    };

    const path = ScrollTrigger.create({
      trigger: "#chapter",
      start: "top 72%",
      end: "top top",
      onUpdate: (self) => {
        scroll.path = self.progress;
      },
    });

    const update = () => {
      const y = window.scrollY;
      const { h } = layout;
      let stage: Stage = "hero";
      if (layout.chapter - y < h * 0.72) stage = "chapter";
      if (layout.projects - y < h * 0.5) stage = "projects";
      if (layout.contact - y < h * 0.6) stage = "outro";

      const P = Math.max(0, (y - layout.projects) / layout.unit);
      const active = Math.min(projects.length - 1, Math.floor(P));
      const local = Math.min(1, P - active);
      const tl = timeline(local, active === 0);

      scroll.local = local;
      scroll.dive = stage === "projects" ? tl.dive : 0;
      scroll.world = tl.world;
      scroll.cover = stage === "projects" ? tl.fade : 0;
      scroll.coverCircle = tl.circle;
      scroll.coverDark = tl.tone === "dark";
      if (stage === "outro") {
        // leave the last world under a dark cover, then reveal the bust again
        const reveal = clamp01((layout.contact - y - h * 0.2) / (h * 0.4));
        scroll.cover = reveal;
        scroll.coverCircle = 1;
        scroll.coverDark = true;
      }

      const inProjects = stage === "projects";
      setUi({
        stage,
        active: inProjects ? active : -1,
        phase: inProjects ? tl.phase : "approach",
        step: inProjects ? stepAt(worlds[active], tl.world) : 0,
        chromeHidden: stage === "chapter" && scroll.path > 0.55,
      });
      if (getUi().stage !== "projects" || getUi().phase !== "world") scroll.dragging = false;
    };

    const trigger = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: update,
      onRefresh: () => {
        measure();
        update();
      },
    });
    measure();
    update();
    const ro = new ResizeObserver(() => ScrollTrigger.refresh());
    ro.observe(document.body);

    // ── pointer: gaze + world drag-orbit (mouse only; touch keeps scrolling)
    let dragX = 0;
    let dragY = 0;
    const onPointer = (e: PointerEvent) => {
      scroll.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      scroll.pointerY = (e.clientY / window.innerHeight) * 2 - 1;
      scroll.pointerSeen = true;
      if (scroll.dragging) {
        scroll.dragYaw = Math.max(-1.2, Math.min(1.2, scroll.dragYaw - (e.clientX - dragX) * 0.006));
        scroll.dragPitch = Math.max(-0.35, Math.min(0.35, scroll.dragPitch - (e.clientY - dragY) * 0.004));
        dragX = e.clientX;
        dragY = e.clientY;
      }
    };
    const onDown = (e: PointerEvent) => {
      const { stage, phase } = getUi();
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      if (stage !== "projects" || phase !== "world") return;
      if ((e.target as Element).closest("a, button, input, .project-card, .chrome")) return;
      scroll.dragging = true;
      dragX = e.clientX;
      dragY = e.clientY;
      document.documentElement.classList.add("is-dragging");
    };
    const onUp = () => {
      scroll.dragging = false;
      document.documentElement.classList.remove("is-dragging");
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    return () => {
      stopSmooth();
      path.kill();
      trigger.kill();
      ro.disconnect();
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return null;
}
