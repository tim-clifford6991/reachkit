// Issue 1458 — the addresses earlier versions of ReachKit published that no
// page in this tree answers, and what each one answers now.
//
// Google still ranks some of them. An address with a page here today is
// moved to it for good (301); one with nothing in its place is gone (410),
// which tells a crawler to stop asking; and the old share card is served
// again where it was. Every row is listed, with its expected answer, in
// `tests/app/library/old-paths.json`.
//
// **Read in `src/middleware.ts`, after the hosted edge.** A customer's own
// domain serves their published pages, and one of them may well be called
// `contact` or `status`. `next.config.ts` redirects run before the
// middleware, on every host, so they would have taken that page away.
// This module imports nothing, so the middleware's bundle stays as it was.
export type MovedAnswer =
  | { readonly status: 301; readonly to: string }
  /** Answered by `/gone`, at this address. */
  | { readonly status: 410 }
  /** Served from another address of ours, at this one. */
  | { readonly status: 200; readonly rewrite: string };

const to = (path: string): MovedAnswer => ({ status: 301, to: path });
const GONE: MovedAnswer = { status: 410 };

/** The free scan, which is what the old scan form and the AI check became. */
const SCAN = to("/");

/** One address, one answer. */
const EXACT: Readonly<Record<string, MovedAnswer>> = {
  // The old app and its sign-in. `/app` sends a visitor with no session on
  // to `/signin` by itself.
  "/login": to("/signin"),
  "/signup": SCAN,
  "/dashboard": to("/app"),
  "/onboarding": to("/app"),
  "/welcome": to("/app"),
  "/scan": SCAN,
  "/gallery": to("/scans"),
  "/contact": to("/about"),
  "/tools/ai-visibility-check": SCAN,
  // Legal addresses v1 and v2 answered.
  "/legal/privacy": to("/privacy"),
  "/legal/cookies": to("/privacy"),
  "/cookie-policy": to("/privacy"),
  "/legal/terms": to("/terms"),
  "/terms-of-service": to("/terms"),
  // The brand files v1 and v2 kept at the root. Today's are generated into
  // `public/brand/` (docs/DESIGN.md, 2026-09-26).
  "/reachkit-icon-512.png": to("/brand/mark-512.png"),
  "/reachkit-icon.svg": to("/brand/mark.svg"),
  "/reachkit-logo.svg": to("/brand/mark.svg"),
  "/reachkit-logo.png": to("/brand/logo.png"),
  "/reachkit-logo-white-bg.png": to("/brand/logo.png"),
  // The site's share card. Today's carries a build hash in its address
  // (`isMetadataAsset` in the middleware), so the old one is served from a
  // fixed address of its own.
  "/opengraph-image": { status: 200, rewrite: "/share-card" },
  // Nothing in their place: no affiliate scheme, no public roadmap, no
  // status page. `/gone` itself, v2's own 410 responder, is a route again.
  "/affiliates": GONE,
  "/roadmap": GONE,
  "/status": GONE,
  "/design": GONE,
};

/**
 * v2's report addresses, `/r/{id}`, and the domain each one reported on.
 * v2's database is not reachable from here; each domain is read off the
 * page's title in the Internet Archive's copy of 2026-08-06
 * (`<title>trustmrr.com: Discoverability Score 62/100 — ReachKit</title>`).
 */
export const OLD_REPORTS: Readonly<Record<string, string>> = {
  "077d1db1-0863-4be6-aeda-cfdb46a3ea10": "trustmrr.com",
  "20d53db5-9c53-4fcd-869d-2b7fc11cbcd0": "reachkit.app",
  "35afd3d5-0ca1-421f-b898-fccd03bf5e74": "x.com",
  "37f47906-df0b-465a-8ff4-99d755506bdc": "cal.com",
  "4f0d4136-6200-41f8-a69c-309020804a00": "linear.app",
  "c8e1d8dc-3115-46e4-870f-14fbe745c4b3": "plausible.io",
  "cb03dc85-c099-45a3-aef2-de14b6dd79c0": "resend.com",
  "dea60384-31c6-4410-8307-9ca9ed7e93f8": "photoai.com",
};

/** A path segment as written, or `null` where it does not decode. */
function segment(raw: string): string | null {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

/**
 * What an old address answers today, or `null` where it is not one: the
 * request then goes on exactly as it would have.
 */
export function movedAnswer(pathname: string): MovedAnswer | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const exact = EXACT[path];
  if (exact !== undefined) return exact;

  const parts = path.split("/").slice(1);
  const [head, id, tail] = parts;

  // `/r/{id}` and its share card: the domain's report, or the list of
  // reports where the id is not one we know.
  if (head === "r" && id !== undefined && (parts.length === 2 || (parts.length === 3 && tail === "opengraph-image"))) {
    const domain = OLD_REPORTS[id.toLowerCase()];
    return domain === undefined ? to("/scans") : to(`/scan/${domain}`);
  }

  // v2: `/report/{domain}` and `/scan/{domain}/results`.
  if (head === "report" && id !== undefined && parts.length === 2) {
    const domain = segment(id);
    return domain === null ? null : to(`/scan/${encodeURIComponent(domain)}`);
  }
  if (head === "scan" && id !== undefined && parts.length === 3 && tail === "results") {
    const domain = segment(id);
    return domain === null ? null : to(`/scan/${encodeURIComponent(domain)}`);
  }

  // v1's design scratch pages, which its robots.txt did not keep out.
  if (head === "design") return GONE;

  return null;
}
