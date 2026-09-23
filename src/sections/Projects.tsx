"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { motion } from "framer-motion";
import { projects, identity } from "./content";
import { scrollToId, scrollToProject } from "@/animations/scrollTo";
import { T } from "@/animations/projectTimeline";
import { scroll, useUi } from "@/animations/store";
import { worlds } from "@/worlds";

/** Unit-local scroll position for a story progress value (with a small nudge past the step start). */
const worldLocal = (at: number) => T.cut + (T.exitStart - T.cut) * Math.min(0.98, Math.max(0.12, at + 0.03));
import { ArrowIcon, GithubIcon, LinkedinIcon, MailIcon } from "@/ui/icons";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Scroll length of one project (approach → dive → world story → exit), in svh. */
export const UNIT_SVH = 300;

/** One pinned track for all projects: a sticky full-screen stage whose content
 * is driven by scroll progress (see ScrollDriver / projectTimeline). */
export function Projects() {
  return (
    <div
      id="projects"
      className="projects-track"
      style={{ height: `${projects.length * UNIT_SVH + 100}svh` }}
    >
      {projects.map((p, i) => (
        <span key={p.id} id={`project-${p.id}`} className="project-anchor" style={{ top: `${i * UNIT_SVH}svh` }} />
      ))}
      <div className="project-stage">
        {projects.map((p, i) => (
          <ProjectPanel key={p.id} index={i} />
        ))}
        <StoryRail />
      </div>
    </div>
  );
}

function ProjectPanel({ index }: { index: number }) {
  const p = projects[index];
  const state = useUi((s) =>
    s.stage !== "projects" || s.active !== index ? "hidden" : s.phase === "world" ? "world" : s.phase,
  );
  const next = projects[index + 1];
  return (
    <section
      className="project"
      data-state={state}
      aria-hidden={state === "hidden"}
      style={{ "--accent": p.accent } as React.CSSProperties}
    >
      <header className="project-intro">
        <p className="eyebrow project-meta">
          <span className="project-index">{p.index}</span>
          <span>{p.kicker}</span>
        </p>
        <h2 className="display project-intro-title">{p.title}</h2>
        <p className="eyebrow project-intro-hint">
          <span className="project-intro-sticker">“{p.sticker}”</span> Scroll to dive in
        </p>
      </header>

      <article className="project-card">
        <p className="eyebrow project-meta">
          <span className="project-index">{p.index}</span>
          <span>{p.kicker}</span>
          <span className="project-period">{p.period}</span>
        </p>
        <h2 className="project-title">{p.title}</h2>
        <p className="project-summary">{p.summary}</p>
        <ul className="project-points">
          {p.points.map((pt) => (
            <li key={pt}>{pt}</li>
          ))}
        </ul>
        <ul className="project-stack" aria-label="Stack">
          {p.stack.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        {p.note && <p className="project-note">{p.note}</p>}
        <div className="project-nav">
          {next ? (
            <button type="button" className="text-link" onClick={() => scrollToProject(index + 1)}>
              Next · {next.title} <ArrowIcon />
            </button>
          ) : (
            <button type="button" className="text-link" onClick={() => scrollToId("contact")}>
              Say hello <ArrowIcon />
            </button>
          )}
        </div>
      </article>
    </section>
  );
}

/** Story steps of the active world, with a live progress line. */
function StoryRail() {
  const active = useUi((s) => s.active);
  const visible = useUi((s) => s.stage === "projects" && s.phase === "world" && s.active >= 0);
  const step = useUi((s) => s.step);
  const fill = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const tick = () => {
      if (fill.current) fill.current.style.transform = `scaleX(${scroll.world.toFixed(4)})`;
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, []);

  const def = worlds[Math.max(0, active)];
  const p = projects[Math.max(0, active)];
  const current = def.steps[Math.min(step, def.steps.length - 1)];

  return (
    <div
      className="story-rail"
      data-visible={visible}
      aria-hidden={!visible}
      style={{ "--accent": p.accent } as React.CSSProperties}
    >
      <p key={`${def.id}-${step}`} className="story-caption">
        {current?.caption}
      </p>
      <ol className="story-steps">
        {def.steps.map((st, i) => (
          <li key={st.label} data-on={i === step} data-done={i < step}>
            <button type="button" onClick={() => scrollToProject(active, worldLocal(st.at))}>
              <span className="story-step-index">{String(i + 1).padStart(2, "0")}</span>
              {st.label}
            </button>
          </li>
        ))}
      </ol>
      <div className="story-progress">
        <span ref={fill} />
      </div>
      <p className="eyebrow story-hint">Scroll to play · drag to look around</p>
    </div>
  );
}

export function Outro() {
  return (
    <section id="contact" className="section outro">
      <motion.div
        className="outro-copy"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ amount: 0.5 }}
        transition={{ duration: 1, ease: EASE }}
      >
        <p className="eyebrow">Next chapter</p>
        <h2 className="display outro-title">Let’s build it.</h2>
        <p className="lede">
          Open to roles in autonomous driving / ADAS validation and robotics / embodied AI.
        </p>
        <div className="icon-row">
          <a className="icon-button" href={identity.links.email} aria-label="Email">
            <MailIcon />
          </a>
          <a className="icon-button" href={identity.links.github} target="_blank" rel="noreferrer" aria-label="GitHub">
            <GithubIcon />
          </a>
          <a className="icon-button" href={identity.links.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn">
            <LinkedinIcon />
          </a>
        </div>
        <button type="button" className="text-link" onClick={() => scrollToId("top")}>
          Back to top
        </button>
      </motion.div>
    </section>
  );
}
