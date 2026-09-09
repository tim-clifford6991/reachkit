/** @vitest-environment jsdom */
// tests/app/draft/pipeline-grounding.test.tsx — issue #415
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
import { generateDraft } from "@/lib/generate/pipeline";
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
async function generatedDraftRow(): Promise<{ draftId: string; groundedFact: unknown }> {
  primeSteps();
  const outcome = await generateDraft(fakeCost(), {
    siteId: SITE_ID,
    opportunity: opportunity(),
    scheduledFor: "2026-09-07",
    site: siteInputs(),
    voiceText: null,
    category: "project management software",
  });
  if (outcome.ok !== true) throw new Error(`the pipeline did not write a page: ${outcome.reason}`);
  const written = store.rows.get(outcome.draftId);
  if (written === undefined) throw new Error("the pipeline wrote no row");
  rows.set("drafts", [
    {
      id: written.id,
      site_id: written.site_id,
      state: "in_review",
      title: written.title,
      body_md: written.body_md,
      meta: written.meta,
      grounded_fact: written.grounded_fact,
      veto_deadline: "2026-09-08T13:00:00.000Z",
      created_at: written.created_at,
    },
  ]);
  return { draftId: written.id, groundedFact: written.grounded_fact };
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
