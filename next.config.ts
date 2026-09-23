import type { NextConfig } from "next";

// GitHub Pages serves the site from /<repo>/; the deploy workflow sets PAGES_BASE_PATH.
// Local dev and `npm run build` without it keep serving from the root.
const basePath = process.env.PAGES_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  output: "export",
  trailingSlash: true,
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
