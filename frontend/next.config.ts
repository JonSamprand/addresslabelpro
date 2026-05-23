import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `standalone` packages a self-contained Node server in
  // `.next/standalone/` — exactly what the Cloud Run Dockerfile copies.
  // No effect on local `next dev`.
  output: "standalone",
};

export default nextConfig;
