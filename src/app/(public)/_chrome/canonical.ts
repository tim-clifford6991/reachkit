// REQ-001 c7 — the public origin, in a client bundle.
// src/app/(public)/_chrome/canonical.ts
//
// The header's copy control needs the report's canonical address, and the
// header's arm is decided in `layout.tsx`, which is a Client Component (it
// reads the pathname). `@/lib/config/env` cannot be imported there: it
// parses the server's whole environment at module load, and in a client
// bundle every server-only binding is absent, so the import throws before
// any guard runs.
//
// `NEXT_PUBLIC_APP_URL` is the one binding that is *meant* to cross — that
// is what the prefix means, and Next inlines it at build time — so it is
// read here directly, once, the same way `src/lib/config/now.ts` reads it
// for its own client-reachable check. One module, one read, one place to
// look when the origin is wrong.
export const PUBLIC_ORIGIN: string | undefined = process.env.NEXT_PUBLIC_APP_URL;

/** The canonical address of a public path — no token, no query, no hash
 *  (REQ-001 c7). `null` where the origin is not bound at build time, so a
 *  caller draws no control rather than one that copies a broken address. */
export function canonicalUrl(pathname: string): string | null {
  if (PUBLIC_ORIGIN === undefined) return null;
  return new URL(pathname, PUBLIC_ORIGIN).toString();
}
