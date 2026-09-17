// BUILD §6.4
// src/lib/egress/index.ts — the egress module's public surface, verbatim
// from BP-006 `## Public interface` / ARCHITECTURE.md's `src/lib/egress/**`
// row: `safeFetch()` · `resolvesInDns()` · `readRobots()`, and the types
// they produce — plus `nameserversOf()` (issue 760), the NS lookup beside
// `resolvesInDns`. `policy.ts` stays internal: it is `safeFetch`'s decision,
// not a primitive callers compose.
export { safeFetch } from "./safe-fetch";
export type { SafeFetchOpts } from "./safe-fetch";
export { resolvesInDns } from "./dns";
export { nameserversOf } from "./nameservers";
export { readRobots } from "./robots";
export type { FetchOutcome, RobotsPolicy } from "./types";
