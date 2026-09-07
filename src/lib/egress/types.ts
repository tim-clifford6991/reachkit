// BUILD §6.4 — the egress module's declared shapes.
// src/lib/egress/types.ts — WO-018, transcribed verbatim from BP-006
// `## Public interface` (as of 2026-08-31).
//
// `FetchOutcome` is `safeFetch`'s return type: a discriminated union, never
// a thrown error, so a caller can distinguish "could not determine"
// (REQ-004 criterion 6) from "read it and it contained nothing" (REQ-004
// criterion 7) — BP-006 `## Error & edge behavior`, decision 1.
//
// `headers` is on the `ok` arm only, and is required there (issue #50).
// REQ-062 criterion 1's indexability check reads `X-Robots-Tag`, which is
// a *response header* and cannot be recovered from the document: a page
// marked `noindex` by header alone and one marked by nothing at all are
// the same string. An optional field would let a caller read "no header"
// where the truth is "this outcome never carried them", which is the
// `boolean | null` mistake REQ-004 exists to stop — so every producer of
// this arm supplies the map, lowercased by Node's own parser, and a
// repeated header arrives comma-joined exactly as Node joins it.
export type FetchOutcome =
  | { ok: true; status: number; url: string; html: string; bytes: number; readAt: Date;
      headers: Readonly<Record<string, string>> }
  | { ok: false; reason: 'dns' | 'refused' | 'timeout' | 'too_large' | 'blocked_by_policy'
              | 'robots_disallowed' | 'status'; status?: number; url: string; readAt: Date }

/** Declared here because `readRobots` produces it and this is the one module
 *  that reads a `robots.txt`. BP-010 returns `Measured<RobotsPolicy>` from
 *  `measureDomain`, BP-024's `verdictOf` takes one and BP-047 serves one; none
 *  of them declared it. It is a parse of a fetched document, never a judgement
 *  about it: what each rule means for the blocked-readers count is BP-024's and
 *  what ReachKit serves on a hosted domain is BP-047's. */
export interface RobotsPolicy {
  ok: true
  origin: string
  readAt: Date
  /** True where the document tells *every* reader not to crawl — REQ-004 c7's
   *  "a home document the scan read that tells every reader not to index it". */
  disallowsAll: boolean
  /** Per user-agent token, whether this document disallows it at the origin
   *  root. Keyed by the token as written in the document, lowercased; the
   *  closed set the product counts over is BP-005's `AI_READER_AGENTS`
   *  (ADR-022, ADR-090) and is applied by the caller, not here. One
   *  refinement (issue #22, `robots.ts`): a document token that names a
   *  member of that closed set — compared case-insensitively — is keyed by
   *  the member's pinned spelling, so the caller reads it by the pin. */
  disallowedAgents: Readonly<Record<string, boolean>>
  /** Sitemap declarations found in the document, in the order they appeared. */
  sitemaps: readonly string[]
  /** True where the origin answered 404 or an equivalent "no robots.txt".
   *  That is a *read* with nothing in it — REQ-004 criterion 7's `zero`, not
   *  criterion 6's `undeterminable` — and the distinction is the reason this
   *  field exists rather than a null policy. */
  absent: boolean
}
