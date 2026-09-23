"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { scroll, setUi, type Stage } from "@/animations/store";
import { projects } from "@/sections/content";

gsap.registerPlugin(ScrollTrigger);

/** Maps page scroll to scene state:
 *  hero → chapter (scrubs CameraAction 0→1) → projects (sticker stops) → outro. */
export function ScrollDriver() {
  useEffect(() => {
    const vh = () => window.innerHeight;

    const path = ScrollTrigger.create({
      trigger: "#chapter",
      start: "top 72%",
      end: "top top",
      onUpdate: (self) => {
        scroll.path = self.progress;
      },
    });

    const update = () => {
      const h = vh();
      const mid = h * 0.5;
      let stage: Stage = "hero";
      let active = -1;

      const chapter = document.getElementById("chapter")!.getBoundingClientRect();
      const first = document.getElementById("projects")!.getBoundingClientRect();
      const contact = document.getElementById("contact")!.getBoundingClientRect();

      if (chapter.top < h * 0.72) stage = "chapter";
      if (first.top < mid) {
        stage = "projects";
        projects.forEach((p, i) => {
          const r = document.getElementById(`project-${p.id}`)!.getBoundingClientRect();
          if (r.top < mid && r.bottom > mid) active = i;
        });
      }
      if (contact.top < h * 0.6) stage = "outro";

      setUi({
        stage,
        active: stage === "projects" ? active : -1,
        chromeHidden: stage === "chapter" && scroll.path > 0.55,
      });
    };

    const trigger = ScrollTrigger.create({ start: 0, end: "max", onUpdate: update, onRefresh: update });
    update();

    const onPointer = (e: PointerEvent) => {
      scroll.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      scroll.pointerY = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    return () => {
      path.kill();
      trigger.kill();
      window.removeEventListener("pointermove", onPointer);
    };
  }, []);

  return null;
}
