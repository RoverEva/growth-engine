import type { NextConfig } from "next";

// Internal, sign-in-only admin tool: every page is per-user and dynamic,
// so Cache Components / partial prefetching are intentionally off.
const nextConfig: NextConfig = {
  poweredByHeader: false,
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
