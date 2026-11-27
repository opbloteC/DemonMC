import type { NextConfig } from "next";

const IMAGE_CACHE = "public, max-age=3600, stale-while-revalidate=86400";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [
      {
        // Artwork changes rarely; a one-hour freshness window (with background
        // revalidation) stops every page view from re-checking these files.
        source: "/images/:path*",
        headers: [{ key: "Cache-Control", value: IMAGE_CACHE }],
      },
      {
        source: "/dmc-logo.png",
        headers: [{ key: "Cache-Control", value: IMAGE_CACHE }],
      },
      {
        source: "/mc-avatar-default.svg",
        headers: [{ key: "Cache-Control", value: IMAGE_CACHE }],
      },
    ];
  },
};

export default nextConfig;
