// tests/vendors/reused-answer.test.ts — SPEC §2, issue 715.
//
// "A 'reused from {date}' mark on answers a recent scan already had
// (cached), read off what the scan stored, never a guess" (owner,
// 2026-09-22).
//
// The date is a fact of the `fetches` row the cache served, and this suite
// is the whole path it travels: `recordFetch` says a call was a hit and
// when the row it served was bought → `ledgered` tells the call site →
// `serpOrganic` stamps the SERP it hands back → `buildAiAnswersCard` takes
// the oldest stamp on the card. Nothing here is a clock: a pass that buys
// its own answers produces no stamp at all, which is what the screen reads
// as "nothing to say about reuse".
// The env fixture is a **side-effect import and must come first**: `env.ts`
// parses `process.env` the moment `@/lib/db` is first reached, which is
// during the imports below and not when a suite body runs.
import "../scan/run/harness";
import { describe, expect, it } from "vitest";
import { cachedCostContext, fakeCostContext } from "./harness";
import { serpOrganic } from "../../src/lib/vendors/dataforseo/serp";
import { buildAiAnswersCard } from "../../src/lib/market/questions/matrix";
import { measured, unmeasured, type Measured } from "../../src/lib/measure/measured";
import type { MarketSerp, QuestionView } from "../../src/lib/market/views";

const STORED_AT = new Date("2026-09-18T08:30:00.000Z");
const AT = new Date("2026-09-22T09:00:00.000Z");

/** One organic row and an AI Overview, in the vendor's own payload shape —
 *  what a `fetches` row for `serp/google/organic` holds. */
function cachedPayload(): unknown {
  return [
    {
      organic: [{ position: 1, domain: "rival.example.net", url: "https://rival.example.net/", title: "Rival" }],
      aiOverview: { present: true, asynchronousAiOverview: false, referenceDomains: ["rival.example.net"] },
    },
  ];
}

async function ask(cached: boolean): Promise<Measured<import("../../src/lib/vendors/dataforseo/types").SerpResult>> {
  const context = cached
    ? cachedCostContext(() => cachedPayload(), STORED_AT)
    : fakeCostContext();
  return serpOrganic(context.ctx, { locale: { country: "US", language: "en" },
    query: "best user onboarding software",
    mode: "live",
    loadAsyncAiOverview: true,
    scope: { domain: "example.com" },
    freshnessDays: 7,
  });
}

function question(n: number): QuestionView {
  return { id: `q${n}`, text: `Question ${n}?`, phrasing: "template", search: { keyword: `k${n}`, volume: 100 } };
}

function serpReusedAt(iso: string | undefined): Measured<MarketSerp> {
  const serp: MarketSerp = {
    organic: [{ position: 1, domain: "rival.example.net" }],
    aiOverview: { present: true, referenceDomains: ["rival.example.net"] },
    ...(iso === undefined ? {} : { reusedFrom: iso }),
  };
  return measured(serp, AT);
}

describe("an answer served from the ledger carries the moment it was bought", () => {
  it("serpOrganic stamps a cache hit with the row's own date", async () => {
    const got = await ask(true);
    expect(got.kind).toBe("measured");
    if (got.kind === "unmeasured") return;
    expect(got.value.reusedFrom).toBe(STORED_AT.toISOString());
  });

  it("an answer this pass bought carries no stamp at all", async () => {
    // `fakeCostContext` is always a miss and its `run()` reaches the
    // transport, which has no network here — the call comes back
    // `undeterminable`, and the point stands either way: nothing stamped it.
    const got = await ask(false);
    expect(got.kind === "measured" ? got.value.reusedFrom : undefined).toBeUndefined();
  });
});

describe("the card takes the oldest reuse on it, and only a real one", () => {
  const questions = [question(1), question(2), question(3)];

  it("is the oldest stamp among the answers it counted", () => {
    const card = buildAiAnswersCard({
      questions,
      serps: [
        serpReusedAt("2026-09-20T10:00:00.000Z"),
        serpReusedAt("2026-09-17T10:00:00.000Z"),
        serpReusedAt(undefined),
      ],
      ownDomain: "example.com",
      coverage: "async_included",
    });
    // Never the newest: the one line a card can show must not claim an
    // answer is fresher than it is.
    expect(card.reusedFrom).toBe("2026-09-17T10:00:00.000Z");
  });

  it("is null where this pass bought every answer", () => {
    const card = buildAiAnswersCard({
      questions,
      serps: [serpReusedAt(undefined), serpReusedAt(undefined), serpReusedAt(undefined)],
      ownDomain: "example.com",
      coverage: "async_included",
    });
    expect(card.reusedFrom).toBeNull();
  });

  it("an unmeasured cell contributes no date — nobody has that answer, from any day", () => {
    const card = buildAiAnswersCard({
      questions,
      serps: [
        unmeasured<MarketSerp>("not_attempted", AT),
        serpReusedAt("2026-09-19T10:00:00.000Z"),
        unmeasured<MarketSerp>("undeterminable", AT),
      ],
      ownDomain: "example.com",
      coverage: "cached_only",
    });
    expect(card.reusedFrom).toBe("2026-09-19T10:00:00.000Z");
  });
});
