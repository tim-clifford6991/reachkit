/**
 * The fixtures TEST SEAM — a test-injected registry, NOT a feature flag.
 *
 * Owner ruling (2026-07-17): `REACHKIT_USE_FIXTURES` is a test seam, not a feature
 * flag → **production reads zero flags**. Production never calls `installFixtures`,
 * so `fixtures()` is always `null` in prod and every adapter makes its real call.
 * Tests call `installFixtures(makeFixtureProvider())` to serve canned data — the
 * SAME fixtures, injected explicitly rather than gated by a global env var that a
 * single mistyped Vercel value could flip on in production (the blast radius Phase 0
 * had to hard-fail at parse: free upgrades, rate-limiting off, magic links to logs).
 *
 * This file (a prod-importable seam) declares only the SHAPE of the canned data.
 * The DATA itself lives in `lib/dev/fixtures.ts` and is imported ONLY by test setup
 * (which builds a provider and installs it), so production never imports fixtures —
 * enforced by the `production ✗→ lib/dev` architecture rule.
 */
import type { Competitor, Community, Creator, KeywordRow, ReviewItem, TimedCommunity } from "@/lib/scan/types";
import type { FactSheetKind } from "@/lib/scan/fact-sheet-kind";
import type {
  ReviewThemesSheet,
  PositioningSheet,
  CompetitorGapSheet,
  KeywordSheet,
  SynthResult,
  ActionCard,
} from "@/lib/llm/types";

/**
 * The single surface of canned data. Each method mirrors a `fixtureX` in
 * `lib/dev/fixtures.ts`; an adapter that today returns `fixtureSerp(name)` behind
 * the flag will return `fixtures()?.serp(name)` behind the seam. Adapters whose
 * fixture is an inline empty (`[]`, `new Map()`, `null`) need no method here — they
 * just check `if (fixtures())`.
 */
export interface FixtureProvider {
  serp(productName: string): { competitors: Competitor[]; serpResultCount: number; raw: unknown };
  tavily(productName: string): { competitors: Competitor[]; raw: unknown };
  ph(productName: string): { selfUpvotes: number; neighbours: Competitor[]; raw: unknown };
  communities(topic: string): Community[];
  creators(competitors: string[]): Creator[];
  keywords(seeds: string[]): { keywords: KeywordRow[]; raw: unknown };
  extract(kind: FactSheetKind): ReviewThemesSheet | PositioningSheet | CompetitorGapSheet | KeywordSheet;
  embed(texts: string[]): number[][];
  synth(): SynthResult;
  rankMap(keywords: string[], target: string): Record<string, number>;
  reviewDelta(): { items: ReviewItem[]; newestId: string };
  rankDelta(prev: Record<string, number>): { changed: Array<{ keyword: string; from: number | null; to: number }>; fresh: Record<string, number> };
  threadDelta(): { items: TimedCommunity[]; newestAt: string };
  competitorDelta(known: string[]): { newNames: string[]; found: string[] };
  actions(): ActionCard[];
  coldStartActions(): ActionCard[];
}

// Backed by globalThis (a `Symbol.for` key), NOT a module-level variable, on
// purpose: integration tests call `vi.resetModules()` to get fresh module graphs,
// which would wipe a module-level singleton — and then the adapter (a different
// module instance) would read `null` even though the test installed a provider.
// globalThis survives `resetModules`, so `installFixtures` and the adapter that
// reads `fixtures()` always share ONE provider regardless of module identity.
const KEY = Symbol.for("reachkit.fixture-provider");
type Holder = { [KEY]?: FixtureProvider | null };

/**
 * Install a fixture provider for the duration of a test. Production never calls
 * this, so `fixtures()` stays `null` and adapters make real calls. Call
 * `resetFixtures()` in `afterEach` so state never leaks across tests.
 */
export function installFixtures(provider: FixtureProvider): void {
  (globalThis as Holder)[KEY] = provider;
}

/** Remove any installed provider (test teardown). */
export function resetFixtures(): void {
  (globalThis as Holder)[KEY] = null;
}

/**
 * The active fixture provider, or `null` (always `null` in production). An adapter
 * returns the fixture when this is non-null, else makes its real call.
 */
export function fixtures(): FixtureProvider | null {
  return (globalThis as Holder)[KEY] ?? null;
}
