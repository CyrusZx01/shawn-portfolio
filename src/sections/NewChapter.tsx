"use client";

import { motion } from "framer-motion";
import { useContent } from "./content";
import { scrollToId } from "@/animations/scrollTo";
import { setUi } from "@/animations/store";
import { ArrowIcon } from "@/ui/icons";

const EASE = [0.22, 1, 0.36, 1] as const;

/** The reference's "A New Chapter" timeline stop, rebuilt as the entry point
 * into the projects: CTA + one chip per sticker on the bust. */
export function NewChapter() {
  const { chapter, projects, ui } = useContent();
  return (
    <section id="chapter" className="section chapter">
      <motion.div
        className="timeline-card"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ amount: 0.6 }}
        transition={{ duration: 0.9, ease: EASE }}
      >
        <span className="timeline-dot" aria-hidden />
        <p className="eyebrow timeline-eyebrow">{chapter.eyebrow}</p>
        <h2 className="timeline-title">{chapter.title}</h2>
        <p className="timeline-subtitle">{chapter.subtitle}</p>
        <p className="timeline-body">{chapter.body}</p>

        <button type="button" className="cta" onClick={() => scrollToId(`project-${projects[0].id}`)}>
          <span>{chapter.cta}</span>
          <ArrowIcon />
        </button>

        <ul className="sticker-chips" aria-label={ui.chipsLabel}>
          {projects.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                className="sticker-chip"
                style={{ "--accent": p.accent } as React.CSSProperties}
                onPointerEnter={() => setUi({ hovered: i })}
                onPointerLeave={() => setUi({ hovered: -1 })}
                onFocus={() => setUi({ hovered: i })}
                onBlur={() => setUi({ hovered: -1 })}
                onClick={() => scrollToId(`project-${p.id}`)}
              >
                <span className="sticker-chip-dot" />
                {p.title}
              </button>
            </li>
          ))}
        </ul>
        <p className="timeline-hint eyebrow">{ui.tip}</p>
      </motion.div>
    </section>
  );
}
