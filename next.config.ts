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
  async headers() {
    // Baseline security headers on every response. CSP starts Report-Only (it
    // observes violations without breaking the app — inline styles/scripts,
    // PostHog, Stripe redirects); tighten + enforce in a follow-up. The rest are
    // safe to enforce immediately.
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "connect-src 'self' https:",
      "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
      "frame-src https://checkout.stripe.com https://js.stripe.com",
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy-Report-Only", value: csp },
          // No `preload` yet — it's a hard-to-unwind commitment that every
          // current+future *.reachkit.app subdomain is HTTPS-only forever. Add
          // it deliberately once that's certain.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/report/:slug/opengraph-image",
        destination: "/scan/:slug/opengraph-image",
        permanent: true,
      },
      { source: "/report/:slug", destination: "/scan/:slug", permanent: true },
      {
        source: "/scan/:id/results",
        destination: "/scan/:id",
        permanent: true,
      },
      { source: "/teardowns", destination: "/gallery", permanent: true },
    ];
  },
};

export default nextConfig;
