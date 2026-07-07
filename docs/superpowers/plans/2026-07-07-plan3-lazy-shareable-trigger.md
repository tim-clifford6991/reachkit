# Plan 3 — Lazy, Bot-Safe Auto-Start + URL-Dedup at the Source

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Opening `/scan/<domain>` for a domain with no scan yet should **auto-start a free-tier scan** — but only from a real browser (link-unfurlers / crawlers that don't run JS must not fire scans, so a shared link that's never opened costs nothing). Also collapse the URL variants (`www`, path, query) that create duplicate `apps` rows, at their source.

**Architecture:** The `/scan/[id]` `ScanHydrator` already renders a "not found" state when `resolveScanParam` returns null. For a **valid domain** param, render a **client** `AutoStart` component instead: it POSTs the existing `/api/scan` endpoint (which already does find-or-create dedup + tier + rate-limit + enqueue) then `router.refresh()`es so the page re-resolves to the new scan and live-streams it. Client-only ⇒ bots that don't run JS never trigger it. Separately, `classifyUrl` canonicalizes web URLs (strip `www.`, drop path/query to the bare origin) so all variants map to one app.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase, Inngest, Vitest.

## Global Constraints

- **Bot-safe:** auto-start fires ONLY from client JS (a mounted `useEffect` POST). No server-side scan creation in `ScanHydrator`/`generateMetadata` (those run on every crawl/unfurl). Metadata generation stays side-effect-free.
- **Free-tier only from the public page:** the auto-start POST hits `/api/scan`, which already sets `tier` by the viewer's entitlement (anonymous → free). Do not force `full`.
- **Idempotent trigger:** React strict-mode/double-mount must not create two scans — `/api/scan`'s find-or-create dedup (`findExistingScanForApp`) already collapses a concurrent second POST; rely on it (and guard the effect from re-firing).
- **Dedup at source:** `classifyUrl` for `platform: "web"` returns the canonical bare origin with `www.` stripped, lowercased host, no path/query/hash — so `nudgi.ai`, `www.nudgi.ai`, `https://nudgi.ai/pricing?x=1` all map to `https://nudgi.ai/`. App-store URLs (`ios`/`android`) keep their full URL (the app id lives in the path).
- **No regression:** `resolveScanParam` already gathers apps by `ilike` (PR #19), so it tolerates legacy dup rows; don't break it.

## File Structure

- **Modify** `lib/scan/router.ts` — `classifyUrl` canonicalizes web URLs (strip `www.`, bare origin).
- **Create** `app/(funnel)/scan/[id]/auto-start.tsx` — client component: POST `/api/scan` on mount, then `router.refresh()`.
- **Modify** `app/(funnel)/scan/[id]/page.tsx` — the `if (!resolved)` branch renders `AutoStart` for a valid-domain param (else the existing not-found state).
- **Modify** `components/sections/captured/landing-hydrate.tsx` — fix its `/api/scan` contract (`{ store_url }` not `{ url }`; navigate to `slug`).
- **Tests:** `lib/scan/router.test.ts` (canonicalization), `tests/integration/scan-route.test.ts` (dedup/tier + www/path→one app), an auto-start component/behavior test.

---

## Task 1: `classifyUrl` canonicalizes web URLs (dedup at source)

**Files:**
- Modify: `lib/scan/router.ts`
- Test: `lib/scan/router.test.ts` (create if absent, else extend)

**Interfaces:**
- Produces: `classifyUrl(raw)` unchanged signature `{ platform: "web"|"ios"|"android"; url: string }`, but for `web` the `url` is the canonical bare origin: `https://<host-without-www>/` (host lowercased; no path, query, or hash). `ios`/`android` unchanged (full `url.toString()`).

- [ ] **Step 1: Write the failing test**

Create/extend `lib/scan/router.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { classifyUrl } from "./router";

describe("classifyUrl web canonicalization", () => {
  const web = (u: string) => classifyUrl(u).url;
  it("collapses www, path, query, case, and trailing slash to one origin", () => {
    for (const input of [
      "nudgi.ai", "nudgi.ai/", "https://nudgi.ai", "https://nudgi.ai/",
      "www.nudgi.ai", "https://www.nudgi.ai/", "NUDGI.ai",
      "https://nudgi.ai/pricing", "https://www.nudgi.ai/pricing/?utm=x#top",
    ]) {
      expect(web(input)).toBe("https://nudgi.ai/");
    }
  });
  it("keeps app-store URLs intact (the app id lives in the path)", () => {
    const r = classifyUrl("https://apps.apple.com/us/app/x/id123");
    expect(r.platform).toBe("ios");
    expect(r.url).toContain("id123");
  });
});
```
Run: `pnpm test lib/scan/router.test.ts` → FAIL (www/path not collapsed).

- [ ] **Step 2: Implement**

In `lib/scan/router.ts`, change the web return so it emits the canonical origin:
```ts
export function classifyUrl(raw: string): RoutedInput {
  const url = new URL(raw.includes("://") ? raw.trim() : `https://${raw.trim()}`);
  const host = url.hostname.toLowerCase();
  const isHost = (domain: string) => host === domain || host.endsWith(`.${domain}`);
  if (isHost("apps.apple.com")) return { platform: "ios", url: url.toString() };
  if (isHost("play.google.com")) return { platform: "android", url: url.toString() };
  // Web: canonical bare origin so www/path/query variants map to ONE app.
  const bare = host.replace(/^www\./, "");
  return { platform: "web", url: `https://${bare}/` };
}
```

- [ ] **Step 3: Run tests → pass; `pnpm test` (full) + `tsc --noEmit` clean** (fix any test asserting the old web `url` with a path).
- [ ] **Step 4: Commit** `fix(scan): classifyUrl canonicalizes web URLs to bare origin (dedup at source)`

---

## Task 2: `AutoStart` client component + wire into the no-scan branch

**Files:**
- Create: `app/(funnel)/scan/[id]/auto-start.tsx`
- Modify: `app/(funnel)/scan/[id]/page.tsx` (the `if (!resolved)` branch)
- Test: component behavior covered by Task 4's integration test; add a small unit test of the domain-guard predicate if extracted.

**Interfaces:**
- Consumes: existing `POST /api/scan` (`{ store_url }` → `{ scan_id, slug }`), `useRouter().refresh()`.
- Produces: `export function AutoStart({ domain }: { domain: string }): JSX.Element` — mounts, POSTs `/api/scan` once, then `router.refresh()`; shows a "Starting your scan…" shell meanwhile and a friendly error + retry on failure.

- [ ] **Step 1: Implement `auto-start.tsx`**
```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Lazy auto-start: opening /scan/<domain> for an un-scanned domain kicks off a
 * FREE scan — but only here, in the browser. Link-unfurlers / crawlers that
 * don't run JS never mount this, so a shared link costs nothing until a human
 * opens it. Idempotent: /api/scan find-or-creates, and the ref guards re-fire.
 */
export function AutoStart({ domain }: { domain: string }) {
  const router = useRouter();
  const started = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ store_url: domain }),
        });
        if (!res.ok) throw new Error(String(res.status));
        if (!cancelled) router.refresh(); // re-resolve → the new scan streams live
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [domain, router]);

  // ...render a "Starting your scan for <domain>…" shell (reuse StartingFallback
  // styling), or a "couldn't start — try again" card with a Link to /scan when failed.
}
```
(Model the shell on the existing `StartingFallback` in `page.tsx`; keep the design idiom.)

- [ ] **Step 2: Wire into `page.tsx`**

Replace the `if (!resolved)` branch (currently `return <ScanStream scanExists={false} …/>`). `resolveScanParam` only returns null for a plausible-domain-or-uuid param it couldn't find; for a **domain** param (matches `/^[a-z0-9.-]+\.[a-z]{2,}$/` and `classifyUrl` accepts it) render `<AutoStart domain={param} />`; for a bare UUID with no scan, keep the not-found state.
```ts
const resolved = await resolveScanParam(param);
if (!resolved) {
  const isDomain = /^[a-z0-9.-]+\.[a-z]{2,}$/.test(param.toLowerCase());
  if (isDomain) {
    return <main style={{ minHeight: "100dvh", background: "var(--c-bg2)" }}><AutoStart domain={param} /></main>;
  }
  return <ScanStream id={param} scanExists={false} initialStatus={null} initialEvents={[]} host={null} />;
}
```
(Keep the `<Suspense>`/`<main>` structure consistent with the current page.)

- [ ] **Step 3: `pnpm test` + `tsc --noEmit` clean.**
- [ ] **Step 4: Commit** `feat(scan): lazy bot-safe auto-start on /scan/<domain> (client-triggered free scan)`

---

## Task 3: Fix the captured landing-hydrate `/api/scan` contract

**Files:**
- Modify: `components/sections/captured/landing-hydrate.tsx`

**Changes:** its `runScan` POSTs `{ url }` (the route requires `{ store_url }` → 400) and navigates to `scan_id` (UUID, causing an extra 308 to the slug). Fix to POST `{ store_url: url }` and navigate to `data.slug ?? data.scan_id`, matching `scan-input.tsx`.

- [ ] **Step 1:** update the fetch body + navigation.
- [ ] **Step 2: `tsc --noEmit` clean;** run `pnpm test components/sections` if a test covers it.
- [ ] **Step 3: Commit** `fix(landing): captured hydrate posts {store_url} and navigates to slug`

---

## Task 4: Route + auto-start integration coverage

**Files:**
- Modify: `tests/integration/scan-route.test.ts` (extend) and/or `tests/integration/scan-abuse.test.ts`
- Create (optional): `tests/integration/scan-autostart.test.ts`

**Asserts (local Supabase available; mock inngest like the existing route test):**
- `POST /api/scan` with `www.nudgi.ai` and again with `nudgi.ai/pricing?x=1` create/dedup to **one** app (assert `countScansForApp`/app count == 1) — proves the Task-1 canonicalization dedups at the route.
- `POST /api/scan` returns `{ scan_id, slug }`; a second POST for the same domain returns `deduped: true` with the same `scan_id`.
- Anonymous POST → `tier: "free"` on the created scan row.
- (Behavioral, best-effort) opening `/scan/<new-domain>` renders the `AutoStart` shell (server render contains the "Starting your scan" copy) and does NOT itself create a scan (only the client POST would) — assert `ScanHydrator`/page output for an un-scanned domain doesn't insert a row.

- [ ] **Step 1: Write the tests.**
- [ ] **Step 2: `pnpm test:int <files>` pass.**
- [ ] **Step 3: Commit** `test(scan): route dedup/tier + www/path canonicalization + auto-start shell`

---

## Self-Review

- **Spec coverage:** lazy bot-safe auto-start (T2 — client-only), free-tier (constraint + existing route), rate-limit/dedup (existing `/api/scan`), URL-dedup-at-source (T1), landing contract fix (T3), tests (T4).
- **Bot-safety:** no server-side scan creation added; the only trigger is a client `useEffect` — unfurlers/no-JS can't fire it; metadata stays side-effect-free.
- **Out of scope:** merging existing duplicate app rows (a data migration) — `resolveScanParam`'s ilike gather already tolerates them; note as a possible cleanup follow-up. No scoring/renderer changes.

## Execution Handoff
Subagent-driven. Waves: **T1 ∥ T3** (disjoint) → **T2** (needs T1's canonical URL for the domain guard to be consistent) → **T4** (needs T1+T2). T1 and T3 touch disjoint files and can run in parallel.
