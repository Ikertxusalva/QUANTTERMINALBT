import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships WASM and must be loaded by Node, not bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: {
    // Trade history files are uploaded through a server action (default limit 1 MB).
    // Vercel caps a request at 4.5 MB.
    serverActions: { bodySizeLimit: "4mb" },
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
