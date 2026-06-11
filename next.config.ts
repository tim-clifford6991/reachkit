import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  reactCompiler: true,
  cacheComponents: true, // "use cache" — moved out of experimental in Next.js 16
};
export default nextConfig;
