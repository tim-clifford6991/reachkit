import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  cacheComponents: true, // "use cache" — moved out of experimental in Next.js 16
  experimental: {
    // Native View Transitions: React 19.2 + Next.js 16 integration.
    // Enables cross-route shared-element morphing via React's <ViewTransition>.
    // The score-circle convention and prefers-reduced-motion guard live in
    // app/globals.css and components/report/discoverability-score.tsx.
    viewTransition: true,
  },
};

export default nextConfig;
