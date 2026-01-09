import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Note: removed "output: export" to enable API routes
  // If you need static export, API calls must go to external backend
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "ui-avatars.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "*.cdninstagram.com" },
      { protocol: "https", hostname: "instagram.com" },
    ],
  },
};

export default nextConfig;
