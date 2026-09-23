"use client";

import dynamic from "next/dynamic";

const Lab = dynamic(() => import("./Lab"), { ssr: false });

export function LabLoader() {
  return <Lab />;
}
