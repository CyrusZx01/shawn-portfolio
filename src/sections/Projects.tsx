"use client";

import { motion } from "framer-motion";
import { projects, identity } from "./content";
import { scrollToId } from "@/animations/scrollTo";
import { ArrowIcon, GithubIcon, LinkedinIcon, MailIcon } from "@/ui/icons";

const EASE = [0.22, 1, 0.36, 1] as const;

export function Projects() {
  return (
    <div id="projects">
      {projects.map((p, i) => (
        <section
          key={p.id}
          id={`project-${p.id}`}
          className="section project"
          data-project={i}
          style={{ "--accent": p.accent } as React.CSSProperties}
        >
          <motion.article
            className="project-card"
            initial={{ opacity: 0, y: 48 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ amount: 0.45 }}
            transition={{ duration: 0.9, ease: EASE }}
          >
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
              {i < projects.length - 1 ? (
                <button type="button" className="text-link" onClick={() => scrollToId(`project-${projects[i + 1].id}`)}>
                  Next · {projects[i + 1].title} <ArrowIcon />
                </button>
              ) : (
                <button type="button" className="text-link" onClick={() => scrollToId("contact")}>
                  Say hello <ArrowIcon />
                </button>
              )}
            </div>
          </motion.article>
        </section>
      ))}
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
