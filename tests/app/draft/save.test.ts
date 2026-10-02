// tests/app/draft/save.test.ts — SPEC §7, #789: edits in the draft editor save.
//
// Driven through the path the editor takes, with nothing hand-shaped in
// between: §8's pipeline writes the row → the page enters review → the
// editor's seam (`draftStore.save`) → the Server Function (`saveDraft`) →
// the engine's writer of an edit (`saveDraftEdit`) → the row. The stand-ins
// are the vendors a `node` test must not reach: the model, the measured
// text, the opportunity read, the cost ledger and the database the row lives
// in (the generation store's in-memory double).
import "../../generate/env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { llmMock, readMeasuredTextMock } = vi.hoisted(() => ({
  llmMock: vi.fn(),
  readMeasuredTextMock: vi.fn(),
}));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));

// #927: `writePage` reads the confirmed business profile and the passages
// the customer switched off. This suite is about the day's decision, not
// about that read, so the seam answers "nothing confirmed" — the state a
// site whose crawl has not run is in, and the one that keeps every
// assertion below about what it was about before.
vi.mock("@/lib/generate/voice/confirmed", () => ({
  confirmedForWriting: async () => ({ profile: null, factsOff: [] }),
  refusedPassages: async () => [],
}));
vi.mock("@/lib/measure/text", () => ({ readMeasuredText: readMeasuredTextMock }));
vi.mock("@/lib/opportunities", async () => {
  const { opportunity } = await import("../../generate/fixtures");
  return { opportunityById: async () => opportunity() };
});
vi.mock("@/lib/costs", () => ({
  withCostContext: async (_ctx: unknown, run: (c: unknown) => Promise<unknown>) =>
    run({ cap: "DRAFT", capHit: () => false, spentCents: () => 0, degraded: () => false }),
}));

// #1180: a passing save of a stopped page opens its review window through
// the publishing engine, and the route re-reads. Both doubled at the seam.
const { enterReviewMock, schedulePublishMock } = vi.hoisted(() => ({
  enterReviewMock: vi.fn(async () => ({ kind: "told" })),
  schedulePublishMock: vi.fn(async () => ({ scheduled: true })),
}));
vi.mock("@/lib/publish/attempt/window", () => ({ enterReview: enterReviewMock }));
vi.mock("@/jobs/engine", () => ({ schedulePublish: schedulePublishMock }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

import { AT, SITE_ID, SOURCE_TEXT, GROUNDED, CLEAN_MARKDOWN, fakeCost, memoryStore, opportunity, siteInputs } from "../../generate/fixtures";
import { generateDraft } from "@/lib/generate/pipeline";
import { setGenerateStore } from "@/lib/generate/store";
import { draftStore } from "@/app/(account)/app/draft/[draftId]/save";
import { LIVE_ACCOUNT, resetAccount, signedInAs } from "../account-door";

const store = memoryStore();
const DEADLINE = "2026-09-08T13:00:00.000Z";

function measured(value: unknown) {
  return { kind: "measured", value, at: AT };
}

/** §8's pipeline writes the page, and the publishing engine's edge puts it
 *  in review with its veto clock — the state the founder edits it in. */
async function draftInReview(): Promise<string> {
  llmMock.mockResolvedValueOnce(
    measured({ readerQuestion: "Which tool?", angle: "seats", mustCover: ["seats"], factIndexes: [0] })
  );
  llmMock.mockResolvedValueOnce(
    measured({ headings: ["Which tool should a small team pick?", "What decides it", "What the plan includes"] })
  );
  llmMock.mockResolvedValueOnce(
    measured({ title: "A title", slug: "a-title", description: "A description.", bodyMarkdown: CLEAN_MARKDOWN })
  );
  llmMock.mockResolvedValueOnce(measured({ title: "", description: "", order: [0], firstBlock: "", insertFacts: [] }));
  const outcome = await generateDraft(fakeCost(), {
    siteId: SITE_ID,
    opportunity: opportunity(),
    scheduledFor: "2026-09-07",
    site: siteInputs(),
    voiceText: null,
    category: "project management software",
    links: [],
    profile: null,
    factsOff: [],
  });
  if (!outcome.ok) throw new Error(`the pipeline did not write a page: ${outcome.reason}`);
  const row = store.rows.get(outcome.draftId)!;
  store.rows.set(row.id, { ...row, state: "in_review", veto_deadline: DEADLINE });
  llmMock.mockReset();
  return row.id;
}

function row(draftId: string) {
  return store.rows.get(draftId) as unknown as Record<string, unknown> & { meta: Record<string, unknown> };
}

beforeEach(() => {
  store.rows.clear();
  store.patches.length = 0;
  store.site = { ...store.site!, doNotClaim: [] };
  readMeasuredTextMock.mockReset();
  readMeasuredTextMock.mockResolvedValue([{ url: GROUNDED.url, text: SOURCE_TEXT, measuredAt: AT }]);
  setGenerateStore(store);
  signedInAs({ ...LIVE_ACCOUNT, siteId: SITE_ID });
});

afterEach(() => {
  setGenerateStore(null);
  resetAccount();
  vi.clearAllMocks();
});

describe("#789 — the editor's save persists the title, the body and the meta description", () => {
  it("writes all three, keeps the generated body, stamps the edit, and leaves the state and veto window alone", async () => {
    const draftId = await draftInReview();
    const generated = row(draftId).body_md as string;
    const bodyMd = `${generated}\n\nPick the plan that fits the team you have today.`;

    const result = await draftStore.save({ draftId, title: "My own title", bodyMd, description: "My own description." });

    expect(result).toMatchObject({ ok: true, claim: { state: "nothing_to_check" }, rulesFailed: false });
    const saved = row(draftId);
    expect(saved.title).toBe("My own title");
    expect(saved.body_md).toBe(bodyMd);
    expect(saved.meta.description).toBe("My own description.");
    expect(saved.meta.body_md_generated).toBe(generated);
    expect(typeof saved.meta.first_edited_at).toBe("string");
    expect(typeof saved.meta.last_saved_at).toBe("string");
    expect(saved.state).toBe("in_review");
    expect(saved.veto_deadline).toBe(DEADLINE);
    expect(saved.hard_rules_passed).toBe(true);
    expect(saved.rule_failures).toEqual([]);
  });

  it("clears the last verdict in the same write that stores the new text", async () => {
    const draftId = await draftInReview();
    await draftStore.save({ draftId, title: "A title", bodyMd: `${row(draftId).body_md}\n\nMore.`, description: "A description." });
    const textWrite = store.patches.find((p) => p.draftId === draftId && p.patch.body_md !== undefined);
    expect(textWrite?.patch).toMatchObject({ claim_check: null, rule_failures: null, hard_rules_passed: false });
  });
});

describe("#789 — the hard rules and the claim check re-run on the edited text", () => {
  it("an edit that breaks a rule is saved, names itself, and holds the page", async () => {
    const draftId = await draftInReview();
    const bodyMd = `${row(draftId).body_md}\n\nIn our tests the starter plan held up for every team we tried.`;

    const result = await draftStore.save({ draftId, title: "A title", bodyMd, description: "A description." });

    expect(result).toMatchObject({ ok: true, rulesFailed: true });
    const saved = row(draftId);
    expect(saved.body_md).toBe(bodyMd);
    expect(saved.hard_rules_passed).toBe(false);
    expect((saved.rule_failures as { rule: string }[]).map((f) => f.rule)).toContain("no_invented_test");
    expect(saved.state).toBe("in_review");
  });

  it("an edit that states an entry on the never-claim list fails the claim check, in the founder's own words", async () => {
    const draftId = await draftInReview();
    store.site = { ...store.site!, doNotClaim: ["free forever"] };
    const bodyMd = `${row(draftId).body_md}\n\nThe starter plan is free forever.`;

    const result = await draftStore.save({ draftId, title: "A title", bodyMd, description: "A description." });

    expect(result).toMatchObject({ ok: true, claim: { state: "failed", matchedEntry: "free forever" }, rulesFailed: true });
    expect(row(draftId).claim_check).toMatchObject({ state: "failed", matchedEntry: "free forever" });
    expect(row(draftId).hard_rules_passed).toBe(false);
    // The literal pass decided it: no model was asked.
    expect(llmMock).not.toHaveBeenCalled();
  });

  it("a later edit that clears the rule releases the hold", async () => {
    const draftId = await draftInReview();
    const clean = row(draftId).body_md as string;
    await draftStore.save({ draftId, title: "A title", bodyMd: `${clean}\n\nIn our tests it held up.`, description: "A description." });
    expect(row(draftId).hard_rules_passed).toBe(false);

    const result = await draftStore.save({ draftId, title: "A title", bodyMd: `${clean}\n\nIt held up.`, description: "A description." });
    expect(result).toMatchObject({ ok: true, rulesFailed: false });
    expect(row(draftId).hard_rules_passed).toBe(true);
    expect(row(draftId).meta.body_md_generated).toBe(clean);
  });

  it("a re-check that cannot run still saves the words, and leaves the page held", async () => {
    const draftId = await draftInReview();
    readMeasuredTextMock.mockRejectedValue(new Error("ledger unavailable"));
    const bodyMd = `${row(draftId).body_md}\n\nMore.`;

    const result = await draftStore.save({ draftId, title: "A title", bodyMd, description: "A description." });

    expect(result).toMatchObject({ ok: true, claim: { state: "outstanding" } });
    expect(row(draftId).body_md).toBe(bodyMd);
    expect(row(draftId).hard_rules_passed).toBe(false);
    expect(row(draftId).claim_check).toBeNull();
  });
});

describe("#789 — what a save refuses", () => {
  it("a draft of another site is refused and untouched", async () => {
    const draftId = await draftInReview();
    signedInAs(LIVE_ACCOUNT);
    const result = await draftStore.save({ draftId, title: "Hijack", bodyMd: "x", description: "" });
    expect(result).toEqual({ ok: false, refused: "not_editable" });
    expect(row(draftId).title).toBe("A title");
  });

  it("a draft that has left review is refused", async () => {
    const draftId = await draftInReview();
    store.rows.set(draftId, { ...store.rows.get(draftId)!, state: "approved" });
    const result = await draftStore.save({ draftId, title: "Late", bodyMd: "x", description: "" });
    expect(result).toEqual({ ok: false, refused: "not_editable" });
  });
});

describe("#1180 — a page the rules stopped is fixed from the draft and enters review", () => {
  const STOPPED = [{ from: "generating", to: "needs_attention", at: AT.toISOString() }];

  async function stoppedDraft(transitions: unknown[] = STOPPED): Promise<string> {
    const draftId = await draftInReview();
    store.rows.set(draftId, { ...store.rows.get(draftId)!, state: "needs_attention", veto_deadline: null, transitions });
    return draftId;
  }

  it("an edit that still breaks a rule is saved and the page stays where it is", async () => {
    const draftId = await stoppedDraft();
    const bodyMd = `${row(draftId).body_md}\n\nIn our tests it held up.`;
    const result = await draftStore.save({ draftId, title: "A title", bodyMd, description: "A description." });
    expect(result).toMatchObject({ ok: true, rulesFailed: true, entered: false });
    expect(row(draftId).body_md).toBe(bodyMd);
    expect(enterReviewMock).not.toHaveBeenCalled();
  });

  it("an edit that passes every rule takes the page into review, as the founder, and schedules it", async () => {
    const draftId = await stoppedDraft();
    const bodyMd = `${row(draftId).body_md}\n\nIt held up.`;
    const result = await draftStore.save({ draftId, title: "A title", bodyMd, description: "A description." });
    expect(result).toMatchObject({ ok: true, rulesFailed: false, entered: true });
    expect(enterReviewMock).toHaveBeenCalledWith(
      expect.objectContaining({ draftId, by: { kind: "customer", userId: LIVE_ACCOUNT.userId } })
    );
    expect(schedulePublishMock).toHaveBeenCalledWith({ draftId });
  });

  it("a page that was in review before it came back is not editable", async () => {
    const draftId = await stoppedDraft([{ to: "in_review" }, { from: "failed", to: "needs_attention" }]);
    const result = await draftStore.save({ draftId, title: "Late", bodyMd: "x", description: "" });
    expect(result).toEqual({ ok: false, refused: "not_editable" });
  });
});
