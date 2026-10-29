import type { NextConfig } from "next";

const isGhPages = process.env.GITHUB_PAGES === "true";
const repoName = "AI-Based-Urban-Building-Footprint-Extraction";

const nextConfig: NextConfig = {
  output: isGhPages ? "export" : undefined,
  basePath: isGhPages ? `/${repoName}` : undefined,
  assetPrefix: isGhPages ? `/${repoName}/` : undefined,
  images: {
    unoptimized: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
