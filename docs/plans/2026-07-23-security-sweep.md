# Pre-launch security sweep (agent-verified, 2026-07-23)

> Authorized static review of the owner's own codebase before public launch. All findings verified at file:line. No CRITICAL. H1 fixed this session; the rest sequenced into L-phases.

## Verified CLEAN (the good news)
SSRF guard on `/api/scan` is genuinely well-built (scheme allowlist + literal & DNS-resolved private/metadata/CGNAT blocklist, IPv4/IPv6/mapped, per-redirect re-validation; only one other raw `fetch` in `lib/`, to an owner-configured webhook). Stripe webhook: raw-body-before-verify + `processed_stripe_events` idempotency. IDOR: 10 authed routes spot-checked — all 401→404(not 403)→402, ownership from DB-backed `user.app_ids`, never a client field. Public scan payload: unconditional `redactReportForTier(_, "free")`, no unredacted API. RLS: all 28 tables (incl. every post-audit table) have RLS enabled. No secrets in client bundles; no raw SQL; no XSS via scanned-site content (report tree is plain React-escaped JSX; JSON-LD only embeds numbers/dates/our-URLs/constrained slugs; OG images rasterize server-side). Enforcing security headers (HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy).

## Findings

### H1 — Open redirect (CWE-601) · ✅ FIXED this session
`app/auth/callback/route.ts:10` + `app/api/auth/magic-link/route.ts:17` validated `next` with `startsWith("/")` only → `//evil.com` passes and `new URL("//evil.com", origin)` resolves to another origin. Zero-precondition phishing from the trusted domain (and embeddable in a genuine magic-link email). **Fix:** new `lib/auth/safe-redirect.ts::safeRelativePath` (rejects `//`, `/\`, control chars) reused in both routes; mutation-proof test `safe-redirect.test.ts`. Mirrors the existing `lib/billing/return-path.ts::safeReturnPath`.

### H2 — `/api/scan/[id]/stream` unauth + unrated + leaks raw facts · ✅ FIXED 2026-07-24
**Fixed both halves.** Payload-trim (higher value): the `"facts"` scan_event now carries only `scopeFactsForStream(collectedFacts)` — `{mode, listing.name, reviewVolume, competitors:[…length only]}`, the exact fields `scan-stream.tsx` renders; the full pre-redaction facts stay on `scans.preliminary_facts` for authed steps. Guard: `lib/scan/facts-preview.test.ts` (mutation-proven — a `...facts` leak fails it). Rate-limit: the stream route now gates on `rateLimitAllow('scan-stream:ip:'+ipHash, SCAN_STREAM_PER_IP=60)` (generous for legit reconnects; 429 on breach). Original finding below.

### H2 (original) — `/api/scan/[id]/stream` unauth + unrated + leaks raw facts
Whole file: no `currentUser`, no ownership, no rate limit on a 250ms-poll / 290s stream (~1,160 DB queries/connection, unbounded concurrency per IP) — a cost/availability vector in a cost-obsessed codebase. Worse: the first `"facts"` event broadcasts the **entire pre-redaction `collectedFacts`** (`scan-requested.ts:108`) for every scan incl. `tier=full` — the exact "paywall hid it, the API didn't" class closed elsewhere. **Fix (L2):** add per-IP rate limiting (reuse `lib/scan/abuse.ts`); scope the `"facts"` event payload to what the free-redacted report needs. *(Note: the public funnel uses `/api/scan/[id]/stream` for progress — the rate limit must be generous enough for legit reconnects; the payload-trim is the higher-value half.)*

### M1 — Dead rate limiter on checkout routes · → L2 (pairs with money path)
`app/api/scan/[id]/checkout/route.ts:31` + `billing/checkout/anonymous/route.ts:29` call `assertRateLimit(ipHash)`, which counts `scans` rows — but neither route inserts one, so the limiter never increments. Effectively-unlimited anonymous Stripe session creation per IP (card-testing / Stripe-API-exhaustion during launch). **Fix (L2):** give these routes their own counter (extend the in-memory `lib/auth/rate-limit.ts` namespace used by magic-link).

### M2 — CSP is Report-Only + permissive · → post-launch
`next.config.ts:35` ships `Content-Security-Policy-Report-Only` with `script-src 'unsafe-inline' 'unsafe-eval'` — logs, blocks nothing. No exploitable XSS found, so acceptable to ship Report-Only, collect violations, then flip to enforcing + tighten. Self-documented as interim.

### LOW · → post-launch / doc
- **L1** DNS-rebind TOCTOU residual in the SSRF guard (documented, accepted; connection not pinned to checked IP).
- **L2** unbounded LLM-prompt string fields on `distribute/draft` (behind `assertPaid`; add `.max()` for consistency).
- **L3** magic-link limiter is per-instance in-memory (backstopped by Supabase OTP ceiling; flagged, not a bug).
- **L4** CLAUDE.md "Known open risks" says `app/test-*` pages aren't runtime-gated — **stale**: `middleware.ts:12-18` 404s `/test-*` + `/design*` in prod. One-line doc fix.

## Sequencing
- **L0:** H1 ships with the merge (done).
- **L2:** H2 (rate-limit + facts-payload trim) + M1 (real checkout counter) — both small, both touch launch-exposed surfaces; fold into the L2 PR.
- **Post-launch:** M2 (CSP enforce after violation-collection), L1/L2/L3 hardening, L4 doc fix.
