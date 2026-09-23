"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useUi } from "@/animations/store";
import { useContent } from "@/sections/content";

/** Cursor-following label shown while hovering a sticker on the bust. */
export function StickerTip() {
  const hovered = useUi((s) => s.hovered);
  const { projects } = useContent();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (ref.current) ref.current.style.transform = `translate(${e.clientX + 18}px, ${e.clientY + 14}px)`;
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);

  const p = hovered >= 0 ? projects[hovered] : null;
  return (
    <div ref={ref} className="sticker-tip-anchor" aria-hidden>
      <AnimatePresence>
        {p && (
          <motion.div
            key={p.id}
            className="sticker-tip"
            initial={{ opacity: 0, scale: 0.9, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.18 }}
          >
            <span className="sticker-tip-dot" style={{ background: p.accent }} />
            <span className="eyebrow">{p.sticker}</span>
            <strong>{p.title}</strong>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
