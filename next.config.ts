import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep production verification isolated when a development server is running.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Route-level caps remain 25 MB for images and 100 MB for MP4s.
  experimental: { middlewareClientMaxBodySize: 101 * 1024 * 1024 },
  serverExternalPackages: ["ffmpeg-static"],
  productionBrowserSourceMaps: true,
};

export default nextConfig;
