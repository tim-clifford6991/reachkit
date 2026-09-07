// tests/app/calendar/day-record-line.test.tsx — BUILD §4.6, §9 (issue #217)
//
// The day panel's one-line summary of the page record: what became of the
// page, and when ReachKit last looked.
//
// What this file is about is the **two things the panel deliberately does
// not say**, because those are what a later edit will get wrong: it never
// repeats the address (the panel already offers the way through), and it
// never carries REQ-060 criterion 4's line, which c4 puts on "that page's
// own record — and no other surface". A panel that grew either would pass
// every positive assertion here and fail the two negative ones.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

vi.mock("@/lib/presentation/copy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/presentation/copy")>();
  return {
    ...actual,
    copy: (key: string, vars?: Record<string, string>) =>
      vars === undefined ? key : `${key}(${Object.values(vars).join("|")})`,
  };
});

import { DayPanelView } from "@/app/(account)/app/calendar/DayPanelView";
import type { DayCell, PageOnDay } from "@/app/(account)/app/calendar/month";
import type { UnpublishOutcome, VerifyDisposition } from "@/lib/publish/types";

const CHECKED_AT = new Date(Date.UTC(2026, 8, 15, 9, 0, 0));
const ZONE = "America/New_York";

const FOUND: VerifyDisposition = {
  kind: "done",
  result: {
    outcome: "found",
    checks: {
      reachable: { kind: "measured", value: true, at: CHECKED_AT },
      indexable: { kind: "measured", value: true, at: CHECKED_AT },
      sitemap: { kind: "measured", value: true, at: CHECKED_AT },
      aiReadable: { kind: "measured", value: true, at: CHECKED_AT },
    },
    checkedAt: CHECKED_AT,
  },
};

function page(over: Partial<PageOnDay> = {}): PageOnDay {
  return {
    draftId: "draft-2026-09-15",
    title: "best crm for a small team",
    state: "published",
    stage: "live",
    scheduledFor: "2026-09-15",
    why: {
      search: "best crm for a small team",
      askedAs: "What is the best CRM for a small team?",
      answeredTodayBy: [],
      youStand: { kind: "unmeasured", reason: "undeterminable", at: CHECKED_AT },
      doneWhen: "",
      winnability: "winnable",
    },
    measuredAt: CHECKED_AT,
    liveUrl: "https://blog.example.com/best-crm",
    vetoDeadline: null,
    publishAt: null,
    enteredReview: true,
    verification: FOUND,
    unpublishOutcome: null,
    ...over,
  };
}

function render(over: Partial<PageOnDay> = {}): string {
  const cell: DayCell = {
    day: "2026-09-15",
    inMonth: true,
    today: true,
    page: page(over),
    empty: null,
  };
  return renderToStaticMarkup(
    React.createElement(DayPanelView, { cell, timeZone: ZONE, stopped: null })
  );
}

describe("the panel states what became of the page, in one line", () => {
  it("a page the check found names the outcome and the date it was looked at", () => {
    const html = render();
    expect(html).toContain("record.verification.found");
    expect(html).toContain('data-testid="day-record-line"');
    expect(html).toContain("Sep");
  });

  it("a page ReachKit took down states what the takedown found, not the check that never ran", () => {
    // A page taken down is accounted for by what the takedown found; the
    // check beside it would say the same thing twice.
    const html = render({
      state: "unpublished",
      stage: "live",
      unpublishOutcome: "removed" satisfies UnpublishOutcome,
      verification: { kind: "never", because: "taken_down_first" },
    });
    expect(html).toContain("record.unpublished.removed");
    expect(html).not.toContain("record.verification.never.takenDownFirst");
  });

  it.each([
    ["record.verification.pageNotFound", { outcome: "page_not_found", status: 404, checkedAt: CHECKED_AT }],
    [
      "record.verification.couldNotConfirm",
      { outcome: "could_not_confirm", why: "unreachable", checkedAt: CHECKED_AT },
    ],
  ] as const)("%s draws its own line, the same key the draft view reads", (key, result) => {
    expect(render({ verification: { kind: "done", result } })).toContain(key);
  });

  it("a page nothing has delivered says nothing here — its state already says where it is", () => {
    const html = render({
      state: "in_review",
      stage: "your_review",
      liveUrl: null,
      verification: { kind: "never", because: "no_live_address" },
    });
    expect(html).not.toContain('data-testid="day-record-line"');
    expect(html).not.toContain("record.verification");
  });
});

describe("what the panel deliberately does not say", () => {
  it("never repeats the address — the way through is the panel's link, not a printed URL", () => {
    const line = render();
    const summary = line.slice(line.indexOf('data-testid="day-record-line"'));
    const oneLine = summary.slice(0, summary.indexOf("</p>"));
    expect(oneLine).not.toContain("https://");
  });

  it("never carries REQ-060 c4's line — that is the draft view's record and no other surface", () => {
    // The record can carry it; this surface must not read it. A panel that
    // grew the line would pass every other test in this file.
    expect(render()).not.toContain("noSeoPlugin");
  });
});
