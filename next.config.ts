import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    'preview-chat-27e4e197-62c7-4b1a-9264-f4ba5d69a857.space.z.ai',
    '.space.z.ai',
    'localhost',
  ],
};

export default nextConfig;
