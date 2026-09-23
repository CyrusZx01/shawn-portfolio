"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useProgress } from "@react-three/drei";
import { useUi } from "@/animations/store";
import { identity } from "@/sections/content";

const EASE = [0.76, 0, 0.24, 1] as const;

export function LoadingScreen() {
  const loaded = useUi((s) => s.loaded);
  const { progress } = useProgress();
  const [shown, setShown] = useState(0);

  // Ease the counter so it never jumps straight from 0 to 100.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setShown((v) => {
        const target = loaded ? 100 : Math.min(progress, 96);
        const next = v + (target - v) * 0.12;
        return Math.abs(target - next) < 0.5 ? target : next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [progress, loaded]);

  useEffect(() => {
    document.documentElement.classList.toggle("is-loading", !loaded);
  }, [loaded]);

  const done = loaded && shown >= 99.5;

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          className="loader"
          exit={{ clipPath: "inset(0 0 100% 0)" }}
          transition={{ duration: 1.1, ease: EASE }}
          role="status"
          aria-label="Loading"
        >
          <div className="loader-inner">
            <p className="eyebrow">
              {identity.name} — {identity.edition}
            </p>
            <p className="loader-count">{String(Math.round(shown)).padStart(3, "0")}</p>
            <div className="loader-bar">
              <span style={{ transform: `scaleX(${shown / 100})` }} />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
