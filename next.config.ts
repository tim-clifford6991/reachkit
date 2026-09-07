import type { NextConfig } from "next";

// BP-001's own file (`code:` glob `next.config.ts`). WO-001 step 3 and the
// file plan: typed config; `serverExternalPackages` for the Supabase admin
// client; no `ignoreBuildErrors` and no `ignoreDuringBuilds` — a build that
// hides a type error defeats the pins-first CI order BP-005's NFR budget
// states, so neither key is set (their default is `false`).
// ADR-002 / REQ-001 c8 (issue #13): "Every response from /scan/{domain} —
// report, removal line, malformed line, refusal, cooldown, progress —
// carries `noindex` as both a meta tag and an `X-Robots-Tag` header, and
// no sitemap the product publishes names a report address." The meta half
// is the route's own `metadata` export; this is the header half, declared
// here rather than in `src/middleware.ts` so the authorisation allow-list
// keeps one job. It applies to every response the path produces, the 308
// included, which is what "every response" asks for.
//
// One value, now on two sources: `/veto/:token` (issue #144) carries a
// single-use stop token in its path, and an indexed one is a stop link
// published to everyone. Hence the name is the header's, not the report's.
const NOINDEX = "noindex, nofollow" as const;

const nextConfig: NextConfig = {
  serverExternalPackages: ["@supabase/supabase-js"],
  async headers() {
    return [
      {
        source: "/scan/:domain",
        headers: [{ key: "X-Robots-Tag", value: NOINDEX }],
      },
      // Issue #144: the veto link's address, on the same footing and for a
      // stricter reason — an indexed `/veto/{token}` is a stop link
      // published to everyone who can read a search result. The meta half
      // is the route's own `metadata` export.
      {
        source: "/veto/:token",
        headers: [{ key: "X-Robots-Tag", value: NOINDEX }],
      },
    ];
  },
};

export default nextConfig;
