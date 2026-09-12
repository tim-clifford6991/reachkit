// tests/market/setup/state.test.ts — BUILD §4.3, REQ-021 criteria 6, 7, 9, 11, 12
// and REQ-026 criteria 1, 3, 5, 6, 10, 11, 12
//
// The setup card state machine. The archived test plan is WO-084's; every
// criterion below is quoted from the requirement as it stands on disk.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  initialSetupState,
  marketCardFor,
  onDomainChanged,
  onMarketStated,
  onQuestionsRederived,
  onSuggestionsSettled,
  settledCategory,
  validateAddress,
  validateSetup,
  type ReportFacts,
  type SetupState,
} from "@/lib/market/setup/state";
import { addRival } from "@/lib/market/setup/rivals";

const TWELVE = [{ wording: "What's the best agency CRM?", search: "best agency crm" }];
const REPORT: ReportFacts = {
  scanId: "scan-1",
  category: "agency CRM",
  rivals: ["a.com"],
  questions: TWELVE,
};
const OTHER: ReportFacts = {
  scanId: "scan-2",
  category: "law firm SEO",
  rivals: ["b.com"],
  questions: [{ wording: "What's the best law firm SEO agency?", search: "best law firm seo" }],
};

function measured(domain = "example.com", report: ReportFacts = REPORT): SetupState {
  return initialSetupState({ domain, report });
}

describe('REQ-026 c1 — "it shows the one market inferred for that address ... and the founder can change it before submitting"', () => {
  it("a report with a category yields the inferred card, carrying the scan it came from", () => {
    expect(marketCardFor({ siteDomain: "example.com", report: REPORT })).toEqual({
      state: "inferred",
      category: "agency CRM",
      fromScanId: "scan-1",
    });
  });

  it("the result does not depend on how the purchase was made — no argument carries a purchase at all", () => {
    // The function's whole input is the address and the report. There is
    // no plan, checkout or provenance parameter to pass, which is what
    // REQ-021 c11's "never how the purchase was made" means in code.
    expect(marketCardFor.length).toBe(1);
    const a = marketCardFor({ siteDomain: "example.com", report: REPORT });
    const b = marketCardFor({ siteDomain: "example.com", report: { ...REPORT } });
    expect(a).toEqual(b);
  });
});

describe('REQ-026 c3 — "then it is empty and asks them to state their market in their own words, with nothing pre-filled and nothing presented as inferred or measured"', () => {
  it("no report yields exactly { state: 'empty' } — no category, no scan id", () => {
    const card = marketCardFor({ siteDomain: "example.com", report: null });
    expect(card).toEqual({ state: "empty" });
    expect(Object.keys(card)).toEqual(["state"]);
  });

  it("a report whose category is null is also the empty card", () => {
    expect(marketCardFor({ siteDomain: "example.com", report: { ...REPORT, category: null } })).toEqual({
      state: "empty",
    });
  });
});

describe('REQ-021 c7 — "setup asks for their site address ... and the field is empty: no domain taken from the address they paid with, or from their payment details, is pre-filled"', () => {
  it("a purchase with no report behind it opens with an asked address and no domain anywhere in the state", () => {
    const state = initialSetupState(null);
    expect(state.address).toEqual({ state: "asked" });
    expect(state.siteDomain).toBeNull();
    expect(JSON.stringify(state)).not.toContain("example.com");
  });

  it("the asked arm carries no domain field at all, so nothing can be pre-filled from it", () => {
    const state = initialSetupState(null);
    expect(Object.keys(state.address)).toEqual(["state"]);
  });
});

describe('REQ-021 c6 — "setup shows them that domain to confirm or change rather than asking them to type it"', () => {
  it("a measured purchase opens with the measured address and the inferred market", () => {
    const state = measured();
    expect(state.address).toEqual({ state: "measured", domain: "example.com", fromScanId: "scan-1" });
    expect(state.siteDomain).toBe("example.com");
    expect(state.market).toEqual({ state: "inferred", category: "agency CRM", fromScanId: "scan-1" });
  });
});

describe('REQ-021 c9 — "the address is a domain name that resolves in DNS, so a site that is new, thin, unbuilt, coming-soon or blocking our fetcher is reached and accepted"', () => {
  it("a resolving domain is accepted, in the canonical form the caller supplied", () => {
    // `POST /api/setup/domain` is what turns "https://WWW.Example.com/
    // pricing" into "example.com" — `tests/app/setup/routes.test.ts`
    // asserts that half. This function decides only what to do with the
    // two facts that come back.
    expect(validateAddress("example.com", true)).toEqual({ ok: true, domain: "example.com" });
  });

  it("a value that is not a domain name is refused, and a non-resolving one is refused differently", () => {
    expect(validateAddress(null, true)).toEqual({ ok: false, because: "not_a_domain" });
    expect(validateAddress("example.com", false)).toEqual({ ok: false, because: "does_not_resolve" });
  });

  it("resolving is the whole test: nothing here reads content, size, age or a fetcher's answer", () => {
    // The function takes the written value and one boolean. There is no
    // parameter through which "the site looks unbuilt" could arrive.
    expect(validateAddress.length).toBe(2);
  });
});

describe('REQ-026 c6 — "any market inferred for the domain they replaced is cleared ... and a market they typed themselves is kept exactly as they left it"', () => {
  it("inferred + a report for the new address ⇒ inferred from the new report", () => {
    const next = onDomainChanged(measured(), { domain: "new.com", report: OTHER });
    expect(next.market).toEqual({ state: "inferred", category: "law firm SEO", fromScanId: "scan-2" });
    expect(next.siteDomain).toBe("new.com");
  });

  it("inferred + no report for the new address ⇒ the empty card, never the old category", () => {
    const next = onDomainChanged(measured(), { domain: "new.com", report: null });
    expect(next.market).toEqual({ state: "empty" });
    expect(JSON.stringify(next.market)).not.toContain("agency CRM");
  });

  it("stated is kept exactly as left, with a report and without one", () => {
    const stated = onMarketStated(measured(), "what I actually do");
    for (const report of [OTHER, null]) {
      const next = onDomainChanged(stated, { domain: "new.com", report });
      expect(next.market).toEqual({ state: "stated", category: "what I actually do" });
    }
  });

  it("the transition mutates nothing", () => {
    const before = measured();
    onDomainChanged(before, { domain: "new.com", report: null });
    expect(before.siteDomain).toBe("example.com");
    expect(before.market).toEqual({ state: "inferred", category: "agency CRM", fromScanId: "scan-1" });
  });
});

describe('REQ-026 c12 — "every rival that came from suggestions for the replaced domain is cleared ... and the address they have just given is refused as a rival"', () => {
  it("three suggested and two typed leave exactly the two typed, in order", () => {
    const withRivals: SetupState = {
      ...measured(),
      rivals: [
        { domain: "a.com", origin: "suggested" },
        { domain: "b.com", origin: "typed" },
        { domain: "c.com", origin: "suggested" },
        { domain: "d.com", origin: "typed" },
        { domain: "e.com", origin: "suggested" },
      ],
    };
    const next = onDomainChanged(withRivals, { domain: "new.com", report: null });
    expect(next.rivals).toEqual([
      { domain: "b.com", origin: "typed" },
      { domain: "d.com", origin: "typed" },
    ]);
  });

  it("the newly given address is refused as a rival, by the rival set's own rule", () => {
    const next = onDomainChanged(measured(), { domain: "new.com", report: null });
    expect(
      addRival(next.rivals, {
        domain: "new.com",
        origin: "typed",
        ownDomain: next.siteDomain!,
        resolves: true,
      })
    ).toEqual({ ok: false, because: "own_domain" });
  });
});

describe('REQ-026 c10 — "it says it is waiting on their market, never that no rivals were found"', () => {
  it("an empty market carries awaiting_market, never none_found", () => {
    const state = initialSetupState(null);
    expect(state.suggestions.state).toBe("awaiting_market");
    expect(state.suggestions.candidates).toEqual([]);
  });

  it("stating the market moves it to seeking, and performs no I/O to do so", () => {
    const state = onMarketStated(initialSetupState(null), "agency CRM");
    expect(state.suggestions).toEqual({ state: "seeking", candidates: [] });
  });

  it("suggestions sought and none returned is none_found; some returned is offered", () => {
    const seeking = onMarketStated(initialSetupState(null), "agency CRM");
    expect(onSuggestionsSettled(seeking, []).suggestions).toEqual({ state: "none_found", candidates: [] });
    expect(onSuggestionsSettled(seeking, ["a.com"]).suggestions).toEqual({
      state: "offered",
      candidates: ["a.com"],
    });
  });

  it("a domain change back to an unknown market returns to awaiting_market, not none_found", () => {
    const offered = onSuggestionsSettled(measured(), ["a.com"]);
    expect(onDomainChanged(offered, { domain: "new.com", report: null }).suggestions.state).toBe(
      "awaiting_market"
    );
  });
});

describe("REQ-026 c5 and REQ-021 c7 — what blocks the submit, and nothing else does", () => {
  it('an empty market blocks with "market_missing"', () => {
    const state = onDomainChanged(measured(), { domain: "new.com", report: null });
    expect(validateSetup(state)).toEqual({ ok: false, because: "market_missing" });
  });

  it('no address blocks with "address_missing", and address outranks market', () => {
    expect(validateSetup(initialSetupState(null))).toEqual({ ok: false, because: "address_missing" });
  });

  it("an inferred market and a stated market each pass", () => {
    expect(validateSetup(measured())).toEqual({ ok: true });
    expect(validateSetup(onMarketStated(measured(), "mine"))).toEqual({ ok: true });
  });

  it('c11 — zero rivals completes: "when they submit setup, then setup completes"', () => {
    const state = measured();
    expect(state.rivals).toEqual([]);
    expect(validateSetup(state)).toEqual({ ok: true });
  });

  it("the refusal union is exactly the two REQ-021 c7 and REQ-026 c5 name — no third literal", () => {
    const refusal = validateSetup(initialSetupState(null));
    if (refusal.ok) throw new Error("expected a refusal");
    const widened: "address_missing" | "market_missing" = refusal.because;
    expect(["address_missing", "market_missing"]).toContain(widened);
    // @ts-expect-error — a third reason is not assignable; the union is
    // the guarantee that no future field quietly becomes a third thing
    // that blocks a founder who answered what they were asked.
    const third: typeof refusal.because = "competitors_missing";
    expect(third).toBe("competitors_missing");
  });
});

describe('REQ-026 c4 — "it is the market they confirmed or stated ... never by re-inference"', () => {
  it("the settled category is the confirmed one, or the stated one, or null on the empty card", () => {
    expect(settledCategory(measured())).toBe("agency CRM");
    expect(settledCategory(onMarketStated(measured(), "mine"))).toBe("mine");
    expect(settledCategory(initialSetupState(null))).toBeNull();
  });
});

describe("§12 ruling 4 — the twelve follow the category, and are never edited", () => {
  it("a measured purchase opens with the twelve that report derived", () => {
    expect(initialSetupState({ domain: "example.com", report: REPORT }).questions).toEqual(TWELVE);
  });

  it("correcting the category drops them — they were the old market's — until new ones arrive", () => {
    const corrected = onMarketStated(measured(), "law firm SEO");
    expect(corrected.questions).toEqual([]);
    expect(onQuestionsRederived(corrected, OTHER.questions).questions).toEqual(OTHER.questions);
  });

  it("the state offers no way to edit one: carrying them back is the only transition that sets them", () => {
    const state = measured();
    const changed = onQuestionsRederived(state, OTHER.questions);
    expect(state.questions).toEqual(TWELVE);
    expect(changed.questions).toEqual(OTHER.questions);
  });
});

describe("the module is pure, and closes no cycle into src/lib/scan", () => {
  const STATE_SOURCE = readFileSync(
    path.resolve(__dirname, "../../../src/lib/market/setup/state.ts"),
    "utf8"
  );

  it("declares no import into src/lib/scan, src/lib/db or src/lib/costs — type-only imports included", () => {
    // Read pre-erasure: TypeScript drops a type-only import before a
    // bundler sees it, so a runtime-only check would pass on the exact
    // edge this guards (WO-084's cycle guard; the stored report type is
    // real, sufficient, and still not to be imported).
    const specifiers = [...STATE_SOURCE.matchAll(/\bfrom\s+["']([^"']+)["']/g)].map((m) => m[1]);
    expect(specifiers.length).toBeGreaterThan(0);
    for (const specifier of specifiers) {
      expect(specifier).not.toMatch(/lib\/scan/);
      expect(specifier).not.toMatch(/lib\/db/);
      expect(specifier).not.toMatch(/lib\/costs/);
      expect(specifier).not.toMatch(/^@\/app\//);
    }
  });

  it("neither this module nor rivals.ts reaches a Node built-in, transitively — the client bundle carries them", () => {
    // The failure this guards is not hypothetical: importing
    // `registrableDomain` here once put `node:net` (via `parseDomain`'s
    // IP-literal rejection) into `/setup`'s client bundle, and Turbopack
    // refused the build outright — "the chunking context does not support
    // external modules (request: node:net)". `npm run test:layout` caught
    // it; this catches it a minute earlier, and names why.
    const ROOT = path.resolve(__dirname, "../../..");
    const seen = new Set<string>();
    const external: string[] = [];
    const queue = [
      path.join(ROOT, "src/lib/market/setup/state.ts"),
      path.join(ROOT, "src/lib/market/setup/rivals.ts"),
    ];

    while (queue.length > 0) {
      const file = queue.shift();
      if (!file || seen.has(file)) continue;
      seen.add(file);
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/\bfrom\s+["']([^"']+)["']/g)) {
        const specifier = match[1]!;
        if (specifier.startsWith(".")) {
          queue.push(path.resolve(path.dirname(file), `${specifier}.ts`));
        } else if (specifier.startsWith("@/")) {
          queue.push(path.join(ROOT, "src", `${specifier.slice(2)}.ts`));
        } else {
          external.push(specifier);
        }
      }
    }

    expect(seen.size).toBeGreaterThan(1);
    for (const specifier of external) {
      expect(specifier.startsWith("node:"), `reaches the Node built-in "${specifier}"`).toBe(false);
    }
  });

  it("reads no clock and makes no I/O — the same inputs give the same state twice", () => {
    expect(STATE_SOURCE).not.toMatch(/Date\.now|new Date\(|fetch\(/);
    expect(onDomainChanged(measured(), { domain: "new.com", report: OTHER })).toEqual(
      onDomainChanged(measured(), { domain: "new.com", report: OTHER })
    );
  });
});
