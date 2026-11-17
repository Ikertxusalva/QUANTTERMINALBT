import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships WASM and must be loaded by Node, not bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
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
