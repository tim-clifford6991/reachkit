/** @vitest-environment jsdom */
// tests/app/draft/pipeline-grounding.test.tsx — issues #415 and #424
//
// **The test the fixture could never be.** Every other case on this screen
// starts from `fixture.ts`, whose facts are typed in by hand — so the
// screen and the fixture agreed about the recorded fact for as long as they
// were written together, while the *pipeline* wrote it somewhere else
// entirely. The draft store read `drafts.meta.grounded_fact` as
// `{fact, url, read_at}`; §8's pipeline writes the `drafts.grounded_fact`
// column as `{passage, url, readAt}`. Every generated draft therefore
// reached its customer with no highlight and no source line, and no suite
// could see it, because no suite ran a real generated row through the read.
//
// #424 is the same defect twice more, in the same file: the store read
// `meta.claim` and `meta.hard_rules_passed`, while §8 writes the
// `claim_check` and `rule_failures` columns. So the S16 badge said
// `outstanding` whatever the check found and the Checks list was empty
// whatever the battery passed. The second describe below runs the same
// path for those two records.
//
// This one does, end to end and with nothing hand-shaped in between:
//
//   `generateDraft` (§8) → the row it wrote → `readDraftRow` (the account's
//   own read) → `assembleDraft` → `DraftScreen`
//
// The only stand-ins are the ones a `node` test has to have: the four model
// steps, the measured text the grounding is read out of, and the database
// the row is put back into. The *shape* is nobody's stand-in — it is the
// bytes `generateDraft` produced.
import "../../generate/env";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { llmMock, readMeasuredTextMock } = vi.hoisted(() => ({
  llmMock: vi.fn(),
  readMeasuredTextMock: vi.fn(),
}));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));
vi.mock("@/lib/measure/text", () => ({ readMeasuredText: readMeasuredTextMock }));

// The save seam, as `view.test.tsx` holds it: this file renders statically
// and never saves, and the mock only keeps the module out of the way.
vi.mock("@/app/(account)/app/draft/[draftId]/save", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/(account)/app/draft/[draftId]/save")>();
  return { ...actual, draftStore: { save: () => Promise.resolve() } };
});

/** The one table this test puts rows in, read through the same minimal
 *  builder `tests/app/session/stores.test.ts` uses: `readDraftRow` filters
 *  on `(id, site_id)` and the record read behind it asks for rows this test
 *  seeds none of. */
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
        const kept = (rows.get(table) ?? []).filter((row) =>
          eq.every((f) => row[f.column] === f.value)
        );
        return Promise.resolve(resolve({ data: kept, error: null }));
      },
    };
    return self;
  };
  return { dbAdmin: () => ({ from: (table: string) => builder(table) }) };
});

import { AT, SITE_ID, fakeCost, memoryStore, opportunity, siteInputs } from "../../generate/fixtures";
import { generateDraft, type GenerateOutcome } from "@/lib/generate/pipeline";
import { sweepOutstandingRechecks } from "@/lib/generate/claims/sweep";
import { setGenerateStore } from "@/lib/generate/store";
import { readDraftRow } from "@/app/(account)/app/draft/[draftId]/store";
import { assembleDraft } from "@/app/(account)/app/draft/[draftId]/model";
import { DraftScreen } from "@/app/(account)/app/draft/[draftId]/DraftScreen";

const SITE = { siteId: SITE_ID, timeZone: "America/New_York", mode: "autopilot" as const };

/** The customer's own live page, as the measurement read it. The grounding
 *  read picks its one long sentence — deterministically, in code — and that
 *  sentence is the passage the row is written with. */
const SOURCE_TEXT =
  "Pricing. Every plan on the starter tier includes unlimited projects and a seat for " +
  "everyone on the team, at one flat monthly fee. Larger teams talk to us.";

/** The passage the read will choose out of it. Stated here so the
 *  assertions name what the customer should see, and asserted against the
 *  row so this constant cannot quietly become the fixture. */
const PASSAGE =
  "Every plan on the starter tier includes unlimited projects and a seat for everyone on the team, at one flat monthly fee.";

/** What the model steps answer: a page that states the customer's own
 *  sentence word for word, names no brand in its opening and carries no
 *  numeral the register holds — so the battery passes and the passage is
 *  there to be marked. */
const BODY_MD = [
  "## Which tool should a small team pick?",
  "",
  "The answer depends on how many people need a seat and how much of the work",
  "already lives in one place. Start by counting the people who will open it",
  "every day, then check what the plan you are looking at actually includes.",
  "",
  PASSAGE,
  "",
  "That is the line worth checking first, because a seat limit is the constraint",
  "teams notice last and feel most.",
].join("\n");

const PAGE = {
  title: "Which tool should a small team pick?",
  slug: "which-tool-small-team",
  description: "How to choose by seat count.",
  bodyMarkdown: BODY_MD,
};

function measured(value: unknown) {
  return { kind: "measured", value, at: AT };
}

/** The four model steps, then the claim check. */
function primeSteps(): void {
  llmMock.mockReset();
  llmMock.mockResolvedValueOnce(measured({ readerQuestion: "Which tool?", angle: "seats", mustCover: ["seats"] }));
  llmMock.mockResolvedValueOnce(measured({ sections: [{ heading: "Seats", covers: "how many" }] }));
  llmMock.mockResolvedValueOnce(measured(PAGE));
  llmMock.mockResolvedValueOnce(measured(PAGE));
  llmMock.mockResolvedValue(measured({ matches: false, matchedIndex: null }));
}

const store = memoryStore();

/**
 * Runs §8's pipeline and puts the row it wrote where the account's own read
 * will find it — verbatim, except for the one edge that is not §8's to
 * take: the publishing engine moves `generating → in_review` and starts the
 * veto clock (`pipeline/index.ts` says why), and `in_review` is the state
 * the customer reads the page in. Nothing else is touched, and the recorded
 * fact is the pipeline's own bytes.
 */
async function runPipeline(site = siteInputs()): Promise<GenerateOutcome> {
  primeSteps();
  return generateDraft(fakeCost(), {
    siteId: SITE_ID,
    opportunity: opportunity(),
    scheduledFor: "2026-09-07",
    site,
    voiceText: null,
    category: "project management software",
  });
}

/** The row §8 wrote, put where the account's own read will find it — every
 *  column it asks for, copied rather than composed. */
function seedFromStore(draftId: string): Record<string, unknown> {
  const written = store.rows.get(draftId);
  if (written === undefined) throw new Error("the pipeline wrote no row");
  const row = {
    id: written.id,
    site_id: written.site_id,
    state: "in_review",
    title: written.title,
    body_md: written.body_md,
    meta: written.meta,
    grounded_fact: written.grounded_fact,
    claim_check: written.claim_check,
    rule_failures: written.rule_failures,
    veto_deadline: "2026-09-08T13:00:00.000Z",
    created_at: written.created_at,
  };
  rows.set("drafts", [row]);
  return row;
}

async function generatedDraftRow(
  site = siteInputs()
): Promise<{ draftId: string; groundedFact: unknown; row: Record<string, unknown> }> {
  const outcome = await runPipeline(site);
  if (outcome.ok !== true) throw new Error(`the pipeline did not write a page: ${outcome.reason}`);
  const row = seedFromStore(outcome.draftId);
  return { draftId: outcome.draftId, groundedFact: row.grounded_fact, row };
}

async function screenFor(draftId: string): Promise<Element> {
  const facts = await readDraftRow({ draftId, site: SITE });
  if (facts === null) throw new Error("the account's own read did not find the generated draft");
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(
    <DraftScreen view={assembleDraft(facts)} generatedLabel="the label renderGenerated returned" />
  );
  return container;
}

beforeEach(() => {
  rows.clear();
  store.rows.clear();
  store.patches.length = 0;
  // The claim check's own state, per case: the sweep case moves the
  // customer's list and the near-duplicate case gives them a published page.
  store.site = { ...store.site!, doNotClaim: [] };
  store.published = [];
  readMeasuredTextMock.mockReset();
  readMeasuredTextMock.mockResolvedValue([
    { url: "https://example.com/pricing", text: SOURCE_TEXT, measuredAt: AT },
  ]);
  setGenerateStore(store);
});

afterEach(() => {
  setGenerateStore(null);
  vi.clearAllMocks();
});

describe("§8 hard rule 1 — the fact the pipeline recorded is the fact the draft screen states", () => {
  it("the pipeline writes the recorded fact into `drafts.grounded_fact`, in the one shape", async () => {
    const { groundedFact } = await generatedDraftRow();
    expect(groundedFact).toEqual({
      passage: PASSAGE,
      url: "https://example.com/pricing",
      readAt: AT.toISOString(),
    });
  });

  it("the account's own read finds it there, and finds a fact rather than an empty one", async () => {
    const { draftId } = await generatedDraftRow();
    const facts = await readDraftRow({ draftId, site: SITE });
    expect(facts?.groundedFact).toEqual({
      passage: PASSAGE,
      url: "https://example.com/pricing",
      readAt: AT,
    });
  });

  it("the passage is marked in the body the customer reads", async () => {
    const { draftId } = await generatedDraftRow();
    const marks = (await screenFor(draftId)).querySelectorAll('[data-testid="draft-body"] mark');
    expect(marks.length).toBe(1);
    expect(marks[0]?.textContent).toBe(PASSAGE);
  });

  it("and its source line states the address it was read from and the day it was read", async () => {
    const { draftId } = await generatedDraftRow();
    const root = await screenFor(draftId);
    const url = root.querySelector('[data-testid="draft-grounded-url"]');
    expect(url?.textContent).toBe("https://example.com/pricing");
    expect(url?.getAttribute("href")).toBe("https://example.com/pricing");
    // The read date, in the site's zone — never a stand-in date (#268).
    expect(root.querySelector('[data-testid="draft-grounded-read-at"]')?.textContent).toBe(
      "Sep 5, 2026"
    );
  });

  it("the fixture-only key is gone: a row carrying the old `meta` shape and no column grounds nothing", async () => {
    const { draftId } = await generatedDraftRow();
    const seeded = rows.get("drafts") ?? [];
    rows.set("drafts", [
      {
        ...seeded[0],
        grounded_fact: null,
        // What the screen used to read, in the shape it used to read it in.
        // Nothing writes this, so nothing may render from it.
        meta: { grounded_fact: { fact: PASSAGE, url: "https://example.com/pricing", read_at: AT.toISOString() } },
      },
    ]);
    const facts = await readDraftRow({ draftId, site: SITE });
    expect(facts?.groundedFact).toBeNull();
    const root = await screenFor(draftId);
    expect(root.querySelectorAll('[data-testid="draft-body"] mark').length).toBe(0);
    expect(root.querySelector('[data-testid="draft-grounded"]')).toBeNull();
    expect(root.querySelector('[data-testid="draft-grounded-dropped"]')).toBeNull();
  });
});

describe("§8's battery — the record the pipeline wrote is the record the draft screen states", () => {
  /** A phrase the customer forbids that the page does not state, so the
   *  battery passes and the badge has a real pass to show. */
  const FORBIDDEN = "cures every ailment";

  /** A phrase the page *does* state, word for word — the literal half of
   *  the claim check matches it with no model call at all. */
  const IN_THE_BODY = "unlimited projects";

  it("writes the verdict into `drafts.claim_check` and the battery's own record into `drafts.rule_failures`", async () => {
    const { row } = await generatedDraftRow(siteInputs({ doNotClaim: [FORBIDDEN] }));
    // The verdict is the check's own, `at` the moment it ran — never a
    // stand-in date and never the row's `created_at`.
    expect(row.claim_check).toMatchObject({ state: "passed" });
    expect(typeof (row.claim_check as { at: unknown }).at).toBe("string");
    // The empty list is the record: a battery ran, and nothing failed.
    expect(row.rule_failures).toEqual([]);
    // And nothing was written into `meta` — the keys this screen used to
    // read are not keys the pipeline has, under any spelling.
    expect(row.meta ?? null).toBeNull();
  });

  it("the badge states the check the pipeline ran, on the account's own read", async () => {
    const { draftId } = await generatedDraftRow(siteInputs({ doNotClaim: [FORBIDDEN] }));
    const facts = await readDraftRow({ draftId, site: SITE });
    expect(facts?.claim).toMatchObject({ state: "passed", at: expect.any(Date) });
    const root = await screenFor(draftId);
    expect(root.querySelector('[data-testid="draft-claim-passed"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="draft-claim-outstanding"]')).toBeNull();
  });

  it("an empty do-not-claim list says there was nothing to check, never a silent pass", async () => {
    // `claimCheck` passes an empty list at zero cost — the publishing guard
    // needs a pass to release the page — but REQ-045 c3's outcome is never
    // a silent one. The verdict's own hash is what tells the two apart.
    const { draftId } = await generatedDraftRow(siteInputs({ doNotClaim: [] }));
    expect((await readDraftRow({ draftId, site: SITE }))?.claim).toEqual({
      state: "nothing_to_check",
    });
    const root = await screenFor(draftId);
    expect(root.querySelector('[data-testid="draft-claim-nothing_to_check"]')).not.toBeNull();
  });

  it("the re-check sweep's verdict is the one the badge shows, and it names the entry it matched", async () => {
    // The real path to a failed badge on a page in review: the page passed
    // at generation, then the customer added an entry their page states.
    // The sweep rewrites `claim_check`, and the screen follows the column
    // rather than whatever was true the night the page was written.
    const { draftId } = await generatedDraftRow(siteInputs({ doNotClaim: [FORBIDDEN] }));
    store.site = { ...store.site!, doNotClaim: [IN_THE_BODY] };
    await sweepOutstandingRechecks(fakeCost(), SITE_ID);
    seedFromStore(draftId);

    expect(await readDraftRow({ draftId, site: SITE })).toMatchObject({
      claim: { state: "failed", matchedEntry: IN_THE_BODY },
    });
    const root = await screenFor(draftId);
    expect(root.querySelector('[data-testid="draft-claim-failed"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="draft-claim-entry"]')?.textContent).toBe(IN_THE_BODY);
  });

  it("the Checks list draws the two recorded rules from the battery's record", async () => {
    const { draftId } = await generatedDraftRow(siteInputs({ doNotClaim: [FORBIDDEN] }));
    expect((await readDraftRow({ draftId, site: SITE }))?.recordedChecks).toEqual([
      "grounding",
      "near_duplicate",
      "no_invented_people",
    ]);
    const root = await screenFor(draftId);
    for (const rule of ["grounding", "do_not_claim", "near_duplicate", "no_invented_people"]) {
      expect(root.querySelector(`[data-testid="draft-check-${rule}"]`)).not.toBeNull();
    }
  });

  it("a rule the battery failed draws no row — the record is per rule, not one bit for the battery", async () => {
    // The near-duplicate gate stops this page, so §8 never queues it and
    // the customer never reads it in review. The row is put in front of the
    // read anyway, because what is under test is the reader: a recorded
    // failure must not come back as a pass just because the other eight did.
    store.published = [{ ref: "page-1", title: "Which tool?", markdown: BODY_MD }];
    const outcome = await runPipeline(siteInputs({ doNotClaim: [FORBIDDEN] }));
    const draftId = outcome.ok === false && outcome.reason === "rules" ? outcome.draftId : null;
    expect(draftId).not.toBeNull();
    const row = seedFromStore(draftId!);
    expect(row.rule_failures).toMatchObject([{ rule: "near_duplicate" }]);

    expect((await readDraftRow({ draftId: draftId!, site: SITE }))?.recordedChecks).toEqual([
      "grounding",
      "no_invented_people",
    ]);
    const root = await screenFor(draftId!);
    expect(root.querySelector('[data-testid="draft-check-near_duplicate"]')).toBeNull();
    expect(root.querySelector('[data-testid="draft-check-no_invented_people"]')).not.toBeNull();
  });

  it("the fixture-only keys are gone: a row carrying the old `meta` shape states nothing", async () => {
    const { draftId } = await generatedDraftRow(siteInputs({ doNotClaim: [FORBIDDEN] }));
    const seeded = (rows.get("drafts") ?? [])[0];
    rows.set("drafts", [
      {
        ...seeded,
        claim_check: null,
        rule_failures: null,
        // What the screen used to read, in the shape it used to read it in.
        // Nothing writes these, so nothing may render from them.
        meta: {
          claim: { state: "passed", at: AT.toISOString() },
          hard_rules_passed: ["near_duplicate", "no_invented_people"],
        },
      },
    ]);
    const facts = await readDraftRow({ draftId, site: SITE });
    expect(facts?.claim).toEqual({ state: "outstanding" });
    // No battery is recorded, so nothing was passed — the honest empty.
    expect(facts?.recordedChecks).toEqual([]);
    const root = await screenFor(draftId);
    expect(root.querySelector('[data-testid="draft-claim-outstanding"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="draft-check-near_duplicate"]')).toBeNull();
    expect(root.querySelector('[data-testid="draft-check-no_invented_people"]')).toBeNull();
    // The grounding row stands: it is the live answer against the body,
    // recomputed here, and never read out of a record at all.
    expect(root.querySelector('[data-testid="draft-check-grounding"]')).not.toBeNull();
  });
});
