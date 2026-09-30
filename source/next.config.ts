import type { NextConfig } from "next";

const repositoryName = "math-grids";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: { root: process.cwd() },
  // GitHub Pages serves this repository under /math-grids.
  basePath: `/${repositoryName}`,
};

export default nextConfig;
