// Populate the minimal env BEFORE any `env` access. The `env` proxy lazily
// parses `process.env` on first read (lib/config/env.ts) — unit runs have no
// full env, so seed the three unconditionally-required keys here. Import of
// scan-caps.ts touches no env (lazy reads inside the functions), so these are
// set well before the first `externalCapCentsFor(...)` call below. Same idiom as
// lib/scan/documented-invariants.test.ts, which parses a minimal env directly.
process.env.SUPABASE_URL ??= "http://localhost:54321";
process.env.SUPABASE_ANON_KEY ??= "x";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "x";

import { describe, expect, it } from "vitest";
import { env } from "@/lib/config/env";
import { externalCapCentsFor, type ScanStep } from "@/lib/scan/scan-caps";

// ---------------------------------------------------------------------------
// C2 GUARD — every scan step's external soft cap derives from the TIER ceiling.
//
// The collect step used to hard-code `env.externalScanCapCentsFull` (150¢) for
// EVERY tier, so a "free" scan ran its collect fan-out (competitor discovery +
// Tavily/DFS + an LLM) under the 150¢ full cap, not the 25¢ free cap — it could
// overspend its ceiling and stay labelled free (2026-07-18). `externalCapCentsFor`
// is the one seam all four steps route through. Mutation-proven: change the
// non-full-scan branch to return `env.externalScanCapCentsFull` and the
// "free scan is capped at the FREE ceiling" assertions fail.
// ---------------------------------------------------------------------------

const FREE = env.externalScanCapCentsFree;
const FULL = env.externalScanCapCentsFull;

it("the free and full external ceilings are distinct (else the guard is vacuous)", () => {
  expect(FREE).toBeLessThan(FULL);
});

// The steps a FREE scan actually runs (full-scan never runs for a free scan).
const FREE_STEPS: ScanStep[] = ["collect", "findings", "free-report"];

describe("externalCapCentsFor — a free scan is capped at the FREE ceiling on every step it runs", () => {
  for (const step of FREE_STEPS) {
    it(`${step} @ free → free ceiling (${FREE}¢), never the full ${FULL}¢`, () => {
      expect(externalCapCentsFor(step, "free")).toBe(FREE);
    });
  }
});

describe("externalCapCentsFor — a full scan is capped at the FULL ceiling", () => {
  it("collect @ full → full ceiling", () => {
    expect(externalCapCentsFor("collect", "full")).toBe(FULL);
  });
  it("findings @ full → full ceiling", () => {
    expect(externalCapCentsFor("findings", "full")).toBe(FULL);
  });
  it("full-scan is the full-ONLY step → full ceiling", () => {
    // full-scan never runs for a free scan, so its ceiling is the full cap by
    // definition (asserted on tier 'full', the only tier that reaches it).
    expect(externalCapCentsFor("full-scan", "full")).toBe(FULL);
  });
});
