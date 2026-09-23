"use client";

import { motion } from "framer-motion";
import { identity } from "./content";
import { useUi } from "@/animations/store";
import { GithubIcon, LinkedinIcon, MailIcon } from "@/ui/icons";
import { scrollToId } from "@/animations/scrollTo";

const EASE = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  const loaded = useUi((s) => s.loaded);
  const rise = (delay: number) => ({
    initial: { opacity: 0, y: 28 },
    animate: loaded ? { opacity: 1, y: 0 } : undefined,
    transition: { duration: 1.1, ease: EASE, delay },
  });

  return (
    <section id="top" className="section hero">
      <div className="hero-copy">
        <h1 className="display">
          {identity.headline.split(" ").map((w, i) => (
            <span key={w} className="display-word">
              <motion.span
                style={{ display: "inline-block" }}
                initial={{ y: "105%" }}
                animate={loaded ? { y: "0%" } : undefined}
                transition={{ duration: 1.2, ease: EASE, delay: 0.25 + i * 0.09 }}
              >
                {w}
              </motion.span>
            </span>
          ))}
        </h1>
        <motion.p className="lede" {...rise(0.55)}>
          {identity.intro}
        </motion.p>
        <motion.div className="icon-row" {...rise(0.7)}>
          <a className="icon-button" href={identity.links.email} aria-label="Email">
            <MailIcon />
          </a>
          <a className="icon-button" href={identity.links.github} target="_blank" rel="noreferrer" aria-label="GitHub">
            <GithubIcon />
          </a>
          <a className="icon-button" href={identity.links.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn">
            <LinkedinIcon />
          </a>
        </motion.div>
        <motion.button type="button" className="scroll-hint eyebrow" onClick={() => scrollToId("chapter")} {...rise(0.85)}>
          <span className="mouse" aria-hidden>
            <span className="mouse-wheel" />
          </span>
          Scroll down
        </motion.button>
      </div>
    </section>
  );
}
