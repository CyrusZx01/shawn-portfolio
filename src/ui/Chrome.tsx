"use client";

import { motion } from "framer-motion";
import { identity, projects } from "@/sections/content";
import { useUi } from "@/animations/store";
import { scrollToId } from "@/animations/scrollTo";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Fixed page chrome: corner labels, hairline rules, vertical location tag and
 * (in the projects stage) the sticker index. */
export function Chrome() {
  const loaded = useUi((s) => s.loaded);
  const stage = useUi((s) => s.stage);
  const active = useUi((s) => s.active);
  const hidden = useUi((s) => s.chromeHidden);

  const visible = loaded && !hidden;
  const show = { opacity: visible ? 1 : 0, y: visible ? 0 : -8 };

  return (
    <div className="chrome" aria-hidden={!loaded}>
      <motion.header
        className="chrome-top"
        initial={{ opacity: 0, y: -8 }}
        animate={show}
        transition={{ duration: 0.8, ease: EASE, delay: visible ? 0.2 : 0 }}
      >
        <a
          className="eyebrow chrome-name"
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            scrollToId("top");
          }}
        >
          {identity.name}
          <br />
          {identity.role}
        </a>
        <span className="eyebrow">{identity.edition}</span>
      </motion.header>

      <motion.span
        className="eyebrow chrome-vertical"
        initial={{ opacity: 0 }}
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ duration: 1.2, delay: loaded && !hidden ? 0.4 : 0 }}
      >
        {identity.location}
      </motion.span>

      <motion.nav
        className="chrome-index"
        aria-label="Projects"
        initial={false}
        animate={{ opacity: stage === "projects" ? 1 : 0, x: stage === "projects" ? 0 : 12 }}
        transition={{ duration: 0.6, ease: EASE }}
        style={{ pointerEvents: stage === "projects" ? "auto" : "none" }}
      >
        {projects.map((p, i) => (
          <button
            key={p.id}
            type="button"
            className="chrome-index-item"
            data-active={i === active}
            style={{ "--accent": p.accent } as React.CSSProperties}
            onClick={() => scrollToId(`project-${p.id}`)}
          >
            <span className="chrome-index-label">{p.title}</span>
            <span className="chrome-index-dot" />
          </button>
        ))}
      </motion.nav>

      <motion.div
        className="chrome-bottom"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: loaded ? 1 : 0 }}
        transition={{ duration: 1.4, ease: EASE, delay: 0.3 }}
      />
    </div>
  );
}
