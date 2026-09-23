"use client";

import dynamic from "next/dynamic";
import { Hero } from "@/sections/Hero";
import { NewChapter } from "@/sections/NewChapter";
import { Outro, Projects } from "@/sections/Projects";
import { Chrome } from "@/ui/Chrome";
import { StickerTip } from "@/ui/StickerTip";
import { Cover } from "@/ui/Cover";
import { LoadingScreen } from "./LoadingScreen";
import { ScrollDriver } from "./ScrollDriver";

const PortfolioScene = dynamic(() => import("@/scenes/PortfolioScene"), { ssr: false });

/** Fixed WebGL stage behind a normally scrolling document. */
export function Experience() {
  return (
    <>
      <div className="scene-layer" aria-hidden>
        <PortfolioScene />
        <Cover />
      </div>
      <Chrome />
      <main className="content">
        <Hero />
        <NewChapter />
        <Projects />
        <Outro />
      </main>
      <StickerTip />
      <ScrollDriver />
      <LoadingScreen />
    </>
  );
}
