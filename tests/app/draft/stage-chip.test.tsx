/** @vitest-environment jsdom */
// Owner O7 on the draft screen: a page's chip is the stage This week names it at, read from the same stored row, so
// a cause the system rescues or sets aside never reads Needs you, and a critical or unread one still does.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Row } from "../../publish/harness";
import stored from "../../generate/fixtures/dogfood-drafts-2026-10.min.json";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
vi.mock("@/app/(account)/app/draft/[draftId]/save", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/(account)/app/draft/[draftId]/save")>();
  return { ...actual, draftStore: { save: () => Promise.resolve() } };
});

import { COPY } from "@/lib/presentation/copy";
import { readDraftRow } from "@/app/(account)/app/draft/[draftId]/store";
import { assembleDraft } from "@/app/(account)/app/draft/[draftId]/model";
import { DraftScreen } from "@/app/(account)/app/draft/[draftId]/DraftScreen";
import { scheduledPagesFor } from "@/lib/publish/record";
import { stageOf } from "@/app/(account)/app/calendar/stages";

const NOW = new Date("2026-11-01T09:00:00.000Z");
const SITE = { siteId: "site-1", timeZone: "UTC", mode: "autopilot" as const, domain: "example.com" };
const PAGE = stored.drafts.find((draft) => draft.id.startsWith("d98284cc"))!;

/** The stored page, with the moves and meta the named cause leaves on its row. */
const as = (moves: Row[], meta: Row = {}): Row => ({
  ...PAGE,
  site_id: SITE.siteId,
  state: moves.at(-1)?.to ?? PAGE.state,
  meta: { ...PAGE.meta, ...meta },
  transitions: [...PAGE.transitions, ...moves],
  claim_check: null,
  veto_deadline: null,
  told: null,
});
const move = (from: string, to: string, reason: string, at = "2026-10-31T09:00:00.000Z"): Row => ({ at, from, to, actor: { kind: "system", job: "test" }, reason });
const tried = [move("needs_attention", "generating", "customer_regenerate"), move("generating", "in_review", "rules_passed"), move("in_review", "approved", "window_closed"), move("approved", "publishing", "due"), move("publishing", "failed", "error")];

const CASES = [
  ["stopped by the writing rules, unedited", "planned", as([])],
  ["a publish tried out yesterday, inside its daily re-attempts", "planned", as([...tried, move("failed", "needs_attention", "retries_exhausted")])],
  ["set aside by the daily re-check", "set_aside", as([move("needs_attention", "skipped", "retired:plain_prose")])],
  ["a destination the customer must fix", "needs_you", as([...tried, move("failed", "needs_attention", "reason_needs_customer")])],
  ["the customer's own edit", "needs_you", as([], { first_edited_at: "2026-10-30T10:00:00.000Z" })],
  ["a cause this build cannot read", "needs_you", as([move("needs_attention", "generating", "customer_regenerate"), move("generating", "needs_attention", "something_new")])],
] as const;

async function chip(row: Row): Promise<Element> {
  db.seed("drafts", [row]);
  const facts = await readDraftRow({ draftId: PAGE.id, site: SITE });
  if (facts === null) throw new Error("the stored page did not read back");
  const root = document.createElement("div");
  root.innerHTML = renderToStaticMarkup(<DraftScreen view={assembleDraft(facts)} generatedLabel="written by ReachKit" />);
  return root;
}

beforeEach(() => {
  db.reset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("the draft screen names a page's stage as This week does (owner O7)", () => {
  it.each(CASES)("a page %s wears the %s chip, and only a critical cause reads Needs you", async (_case, stage, row) => {
    const root = await chip(row);
    const badge = root.querySelector('[data-testid^="draft-stage-"]');
    expect(badge?.getAttribute("data-testid")).toBe(`draft-stage-${stage}`);
    expect(root.textContent?.includes(COPY["calendar.stage.needs-you"])).toBe(stage === "needs_you");
  });

  it("a page set aside wears the grey Set aside chip and offers nothing to press", async () => {
    const root = await chip(CASES[2][2]);
    const badge = root.querySelector('[data-testid="draft-stage-set_aside"]')!;
    expect([badge.textContent, badge.classList.contains("badge-ghost")]).toEqual([COPY["calendar.day.set-aside"], true]);
    expect(root.querySelector('[data-testid="draft-actions"]')).toBeNull();
  });

  it.each(CASES)("a page %s reads the same on the draft screen and in the calendar's month read", async (_case, _stage, row) => {
    const root = await chip(row);
    const [page] = await scheduledPagesFor({ siteId: SITE.siteId, from: "2026-10-01", to: "2026-10-31", now: NOW });
    const calendar = page.setAside ? "set_aside" : stageOf(page, NOW);
    expect(root.querySelector('[data-testid^="draft-stage-"]')?.getAttribute("data-testid")).toBe(`draft-stage-${calendar}`);
  });
});
