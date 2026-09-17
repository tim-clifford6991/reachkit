/** @vitest-environment jsdom */
// tests/app/draft/target.test.tsx — SPEC §4, §6, §7 (issue 867)
//
// "What this page is for", through the real chain: the `drafts` row, the
// account's own `readDraftRow`, the engine's `explainChoice` over the real
// opportunity store, `assembleDraft`, and the screen rendered.
//
// The owner, 2026-09-17: "I don't believe we are currently showing the users
// the SEO or GEO metrics their content is currently optimizing for." Nothing
// on this screen said what the page was for at all, so every case here fails
// on main.
//
// **Only measured facts.** A search the vendor gave no difficulty for
// renders the dash and its written line, never a 0 — and a `fix_page` draft,
// which has no market target at all, renders its own arm rather than a block
// of blanks.
// The bindings `env` parses at module load, applied as a side effect before
// any module under test is evaluated (`tests/generate/env.ts` states why a
// call here would be too late: ESM hoists every import above it).
import "../../generate/env";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The save seam, as the other draft suites hold it: this file renders
// statically and never saves.
vi.mock("@/app/(account)/app/draft/[draftId]/save", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/(account)/app/draft/[draftId]/save")>();
  return { ...actual, draftStore: { save: () => Promise.resolve() } };
});

/** The `drafts` rows this suite puts in, read through the same minimal
 *  builder `pipeline-grounding.test.tsx` uses: `readDraftRow` filters on
 *  `(id, site_id)`, and the record read behind it asks for rows nobody
 *  seeds here. */
const rows = new Map<string, Record<string, unknown>[]>();

vi.mock("@/lib/db", () => {
  const builder = (table: string) => {
    const eq: { column: string; value: unknown }[] = [];
    const self: Record<string, unknown> = {
      select: () => self,
      order: () => self,
      limit: () => self,
      in: () => self,
      not: () => self,
      is: () => self,
      eq: (column: string, value: unknown) => {
        eq.push({ column, value });
        return self;
      },
      then: (resolve: (r: unknown) => unknown) => {
        const kept = (rows.get(table) ?? []).filter((row) => eq.every((f) => row[f.column] === f.value));
        return Promise.resolve(resolve({ data: kept, error: null }));
      },
    };
    return self;
  };
  return { dbAdmin: () => ({ from: (table: string) => builder(table) }) };
});

import { copy } from "@/lib/presentation/copy";
import { measured, unmeasured } from "@/lib/measure/measured";
import { setOpportunityStore } from "@/lib/opportunities/store";
import type { Evidence, TargetFacts } from "@/lib/opportunities/types";
import { readDraftRow } from "@/app/(account)/app/draft/[draftId]/store";
import { assembleDraft } from "@/app/(account)/app/draft/[draftId]/model";
import { DraftScreen } from "@/app/(account)/app/draft/[draftId]/DraftScreen";
import { memoryStore, newMemoryState } from "../../opportunities/memory-store";

const SITE_ID = "22222222-2222-4222-8222-222222222867";
const SCAN_ID = "11111111-1111-4111-8111-111111111867";
const DRAFT_ID = "44444444-4444-4444-8444-444444444867";
const OPPORTUNITY_ID = "55555555-5555-4555-8555-555555555867";
const AT = new Date("2026-09-14T06:00:00.000Z");
const SITE = { siteId: SITE_ID, timeZone: "America/New_York", mode: "autopilot" as const };
const SEARCH = "seo content brief template for startups";

const ENGINES: TargetFacts["engines"] = [
  { engine: "ai_overview", standing: "names_others" },
  { engine: "ai_mode", standing: "no_answer" },
  { engine: "chatgpt", standing: "names_you" },
];

function writeEvidence(target?: TargetFacts): Evidence {
  return {
    family: "write",
    query: SEARCH,
    volume: measured(40, AT),
    rival: {
      domain: "briefkit.io",
      url: measured("https://briefkit.io/templates", AT),
      position: measured(3, AT),
    },
    ...(target === undefined ? {} : { target }),
  };
}

/** One opportunity in the engine's own store, and one draft written from
 *  it. Everything between them is the product's. */
function seed(a: { evidence: Evidence; type?: string; fitBand?: string | null; opportunityId?: string | null }): void {
  const state = newMemoryState({
    rows: [
      {
        id: OPPORTUNITY_ID,
        site_id: SITE_ID,
        scan_id: SCAN_ID,
        type: a.type ?? "answer_page",
        family: a.evidence.family,
        target_query: a.evidence.family === "fix" ? null : a.evidence.query,
        target_ref: "seo-content-brief-template-for-startups",
        proposed_slug: null,
        title: null,
        volume: 40,
        evidence: a.evidence,
        acceptance: { form: "top20", query: SEARCH },
        fit_band: a.fitBand === undefined ? "winnable" : a.fitBand,
        effort: 0.5,
        status: "queued",
        cluster_key: null,
        absorbed_queries: [],
        ready: true,
        unready_reason: null,
        created_at: AT.toISOString(),
      },
    ],
  });
  setOpportunityStore(memoryStore(state));

  rows.set("drafts", [
    {
      id: DRAFT_ID,
      site_id: SITE_ID,
      opportunity_id: a.opportunityId === undefined ? OPPORTUNITY_ID : a.opportunityId,
      state: "in_review",
      title: "How a startup should brief its SEO content",
      body_md: "## A brief\n\nOne paragraph of the page as it would publish.",
      meta: { description: "A brief." },
      grounded_fact: null,
      claim_check: null,
      rule_failures: null,
      veto_deadline: new Date("2026-09-15T06:00:00.000Z").toISOString(),
      created_at: AT.toISOString(),
    },
  ]);
}

async function block(): Promise<Element> {
  const facts = await readDraftRow({ draftId: DRAFT_ID, site: SITE });
  if (facts === null) throw new Error("the draft did not read back");
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(
    <DraftScreen view={assembleDraft(facts)} generatedLabel="written by ReachKit" />
  );
  const found = container.querySelector('[data-testid="draft-target"]');
  if (found === null) throw new Error("the draft screen drew no target block");
  return found;
}

beforeEach(() => {
  rows.clear();
});

afterEach(() => {
  setOpportunityStore(null);
  vi.restoreAllMocks();
});

describe("the draft screen says what the page is for (issue 867)", () => {
  it("states the search, how it is asked, its demand, its difficulty against this site's ceiling, the band and every engine", async () => {
    seed({
      evidence: writeEvidence({ difficulty: measured(12, AT), ceiling: 36, engines: ENGINES }),
    });
    const text = (await block()).textContent ?? "";

    expect(text).toContain(copy("draft.target.title"));
    expect(text).toContain(SEARCH);
    // The demand and the difficulty, the difficulty beside the ceiling this
    // site is judged against (§6, issue 858).
    expect(text).toContain("40");
    expect(text).toContain(copy("calendar.why.difficulty.of-ceiling", { difficulty: "12", ceiling: "36" }));
    // The band, in the product's one set of band words.
    expect(text).toContain(copy("band.winnability.winnable"));
    // Every engine, each with where it stood — and the engine that named
    // this site said so.
    expect(text).toContain(
      copy("calendar.why.engine.line", {
        engine: copy("ai-answers.engine.chatgpt"),
        standing: copy("calendar.why.engine.names-you"),
      })
    );
    expect(text).toContain(
      copy("calendar.why.engine.line", {
        engine: copy("ai-answers.engine.ai-overview"),
        standing: copy("calendar.why.engine.names-others"),
      })
    );
    expect(text).toContain(
      copy("calendar.why.engine.line", {
        engine: copy("ai-answers.engine.ai-mode"),
        standing: copy("calendar.why.engine.no-answer"),
      })
    );
  });

  it("a search the vendor gave no difficulty for renders the dash and its written line, never a 0", async () => {
    seed({
      evidence: writeEvidence({
        difficulty: unmeasured<number>("undeterminable", AT),
        ceiling: 36,
        engines: ENGINES,
      }),
    });
    const target = await block();
    const text = target.textContent ?? "";

    expect(text).toContain(copy("unmeasured.dash"));
    expect(text).toContain(copy("unmeasured.undeterminable", { what: SEARCH }));
    // Neither the number nor its ceiling is printed for a difficulty nobody
    // read: a 0 would read as "nothing to beat".
    expect(text).not.toContain(copy("calendar.why.difficulty.of-ceiling", { difficulty: "0", ceiling: "36" }));
    expect(
      target.querySelector('[data-testid="draft-target-engines"]')?.textContent ?? ""
    ).not.toBe("");
  });

  it("a row derived before issue 867 carries no target facts: the block still states the search, and shows no ceiling", async () => {
    seed({ evidence: writeEvidence() });
    const text = (await block()).textContent ?? "";

    expect(text).toContain(SEARCH);
    expect(text).toContain(copy("unmeasured.dash"));
    expect(text).not.toContain("36");
  });

  it("a fix_page draft has no market target, and renders that arm rather than blanks", async () => {
    seed({
      evidence: { family: "fix", issues: [], pageUrl: "https://example.com/pricing" },
      type: "fix_page",
      fitBand: null,
    });
    const text = (await block()).textContent ?? "";

    expect(text).toContain(copy("draft.target.fix"));
    expect(text).not.toContain(copy("calendar.why.search"));
  });

  it("a draft whose opportunity cannot be read says so in one sentence", async () => {
    seed({ evidence: writeEvidence(), opportunityId: null });
    const text = (await block()).textContent ?? "";

    expect(text).toContain(copy("draft.target.unknown"));
  });
});
