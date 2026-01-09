import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable Turbopack (default in Next.js 16)
  // Assets are copied via postinstall script in package.json
  turbopack: {},
};

export default nextConfig;
