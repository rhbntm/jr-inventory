import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {},
  allowedDevOrigins: ["192.168.1.5"],
  // Quick Stock and Quick Reserve became modes of Live. Old bookmarks and installed
  // app shortcuts keep working.
  async redirects() {
    return [
      { source: "/stock", destination: "/live", permanent: false },
      { source: "/quick-reserve", destination: "/live?mode=reserve", permanent: false },
    ];
  },
};

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  reloadOnOnline: true,
  disable: process.env.NODE_ENV !== "production",
});

export default withSerwist(nextConfig);
