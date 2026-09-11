import type { NextConfig } from "next";

/**
 * PREVIEW ARTIFACT — design-system skill step 2. Not production code.
 *
 * Deliberately empty of everything: no rewrites, no image domains, no env,
 * no remote anything. This app makes no network call of any kind — every
 * value on every screen comes from src/mock/. Fonts are self-hosted through
 * @fontsource (BUILD.md §1), so even type is offline.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
