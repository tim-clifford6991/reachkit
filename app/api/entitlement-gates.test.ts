/**
 * Entitlement-gate tripwire (§6 #6) — a ratchet guard, not a behavioural test.
 *
 * The `/app` UI paywall hides the intel pages but does NOT protect their APIs.
 * These routes each return the FULL unredacted deep intel and/or trigger metered
 * DataForSEO/Tavily/LLM spend, so every one MUST gate on `assertPaid`. A cold auth
 * check alone was the leak: an authenticated-but-inactive user with competitors
 * selected could pull the exact data the free teaser strips and burn paid spend.
 *
 * This reads the route source and fails if the gate is ever removed — cheaper and
 * far less brittle than mocking Supabase + currentUser per route, and it can never
 * silently rot the way a stubbed integration test can.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const COST_BEARING_AUTHED_ROUTES = [
  "app/api/app/intel/route.ts",
  "app/api/app/intel/stream/route.ts",
  "app/api/competitors/select/route.ts",
  "app/api/competitors/candidates/route.ts",
  "app/api/app/plan/generate/route.ts",
];

describe("entitlement gates (§6 #6 — ratchet)", () => {
  for (const rel of COST_BEARING_AUTHED_ROUTES) {
    it(`${rel} gates on assertPaid`, () => {
      const src = readFileSync(resolve(process.cwd(), rel), "utf8");
      expect(src, `${rel} must import assertPaid`).toMatch(/import\s*\{[^}]*\bassertPaid\b[^}]*\}\s*from\s*["']@\/lib\/billing\/entitlements["']/);
      expect(src, `${rel} must call assertPaid(...) before running any gather`).toMatch(/await\s+assertPaid\s*\(/);
    });
  }
});
