// tests/app/draft/page-record.test.tsx — BUILD §4.6, §9 (issue #217)
//
// The record block on the draft view: the address, what the one check saw,
// what an unpublish call found, and REQ-060 criterion 4's line — each drawn
// exactly where `PageRecord` puts it and nowhere else.
//
// **The discriminating assertions are the negative ones.** A block that
// rendered c4's line whenever the destination was WordPress, or whenever a
// page was delivered, would pass every positive test in this file and fail
// the three below it. The record decides; the screen reads.
//
// `copy()` is mocked to `(key) => key`, the convention `report-view.test.tsx`
// established: every key here is `TODO(copy)` today, and asserting the key
// is what stays true when the owner writes the sentence.
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

import { PageRecordBlock } from "@/app/(account)/app/draft/[draftId]/PageRecordBlock";
import type { PageRecord } from "@/lib/publish/record";

const CHECKED_AT = new Date(Date.UTC(2026, 8, 15, 9, 0, 0));
const ZONE = "America/New_York";

const BASE: PageRecord = {
  draftId: "d1",
  state: "published",
  opportunityId: "o1",
  targetQuery: "best crm for a small team",
  measuredAt: new Date(Date.UTC(2026, 8, 14, 6, 0, 0)),
  mode: "approved",
  address: {
    offered: true,
    label: "record.address.publiclyReadableAt",
    url: "https://blog.example.com/best-crm",
  },
  unpublishOutcome: null,
  verification: {
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
  },
  seoNote: null,
};

function render(over: Partial<PageRecord> = {}): string {
  return renderToStaticMarkup(
    React.createElement(PageRecordBlock, { record: { ...BASE, ...over }, timeZone: ZONE })
  );
}

describe("the address is the one the record decided, never one the screen chose", () => {
  it("a published page states the address it is publicly readable at", () => {
    const html = render();
    expect(html).toContain("record.address.publiclyReadableAt");
    expect(html).toContain("https://blog.example.com/best-crm");
    expect(html).not.toContain("record.address.wasPublishedAt");
  });

  it("a page ReachKit has taken down states the address it was published at", () => {
    const html = render({
      state: "unpublished",
      address: {
        offered: true,
        label: "record.address.wasPublishedAt",
        url: "https://blog.example.com/best-crm",
      },
      unpublishOutcome: "removed",
      verification: { kind: "never", because: "taken_down_first" },
    });
    expect(html).toContain("record.address.wasPublishedAt");
    expect(html).not.toContain("record.address.publiclyReadableAt");
    expect(html).toContain("record.unpublished.removed");
  });

  it("a page ReachKit never made live says so in place of an address, and offers none", () => {
    const html = render({
      state: "failed",
      address: { offered: false, because: "never_made_live", copy: "record.address.neverMadeLive" },
      verification: { kind: "never", because: "no_live_address" },
    });
    expect(html).toContain("record.address.neverMadeLive");
    // The arm carries no `url` field at all; nothing that looks like an
    // address may reach the screen from it.
    expect(html).not.toContain("https://");
    expect(html).not.toContain("<a ");
  });

  it("the address renders in the mono utility — §2.3's code-like string", () => {
    expect(render()).toMatch(/class="num[^"]*"[^>]*href="https:\/\/blog\.example\.com\/best-crm"/);
  });
});

describe("REQ-062 c7 — the standing carries what ReachKit saw and when", () => {
  it("a found page names the outcome and the moment the check ran", () => {
    const html = render();
    expect(html).toContain("record.verification.found");
    expect(html).toContain("Sep");
  });

  it.each([
    [
      "page_not_found",
      { outcome: "page_not_found", status: 404, checkedAt: CHECKED_AT },
      "record.verification.pageNotFound",
      "record.verification.couldNotConfirm",
    ],
    [
      "could_not_confirm",
      { outcome: "could_not_confirm", why: "unreachable", checkedAt: CHECKED_AT },
      "record.verification.couldNotConfirm",
      "record.verification.pageNotFound",
    ],
  ] as const)(
    "%s draws its own line and never the other's — ADR-085's landmine at the surface",
    (_name, result, mine, theirs) => {
      const html = render({ verification: { kind: "done", result } });
      expect(html).toContain(mine);
      expect(html).not.toContain(theirs);
    }
  );

  it("page_not_found and could_not_confirm are told apart by tone as well as by key", () => {
    const notFound = render({
      verification: { kind: "done", result: { outcome: "page_not_found", status: 404, checkedAt: CHECKED_AT } },
    });
    const unsure = render({
      verification: {
        kind: "done",
        result: { outcome: "could_not_confirm", why: "unreachable", checkedAt: CHECKED_AT },
      },
    });
    // The one thing a reader has to tell apart at a glance: "ReachKit found
    // nothing there" from "ReachKit does not know".
    expect(notFound).toContain("badge-warning");
    expect(unsure).not.toContain("badge-warning");
  });

  it("a check that has not run yet states when it falls due", () => {
    const html = render({ verification: { kind: "not_yet", dueAt: CHECKED_AT } });
    expect(html).toContain("record.verification.notYet");
    expect(html).toContain("Sep");
  });

  it("a due check states no moment — 'due' is about now, and a date would read as an observation", () => {
    const html = render({ verification: { kind: "due" } });
    expect(html).toContain("record.verification.due");
    expect(html).not.toContain("Sep");
  });

  it.each([
    ["taken_down_first", "record.verification.never.takenDownFirst"],
    ["no_live_address", "record.verification.never.noLiveAddress"],
  ] as const)("a check that will never run says which of the two reasons (%s)", (because, key) => {
    expect(render({ verification: { kind: "never", because } })).toContain(key);
  });
});

describe("REQ-060 c4 — the line renders exactly where the record put it", () => {
  it("is drawn where seoNote is non-null", () => {
    expect(render({ seoNote: "publish.wordpress.noSeoPlugin" })).toContain(
      "publish.wordpress.noSeoPlugin"
    );
  });

  it("is not drawn for a delivered page whose record carries none", () => {
    // A plugin wrote, or the destination had none to find. Both are `null`
    // on the record and both must be silent here.
    expect(render({ seoNote: null })).not.toContain("noSeoPlugin");
  });

  it("is not drawn for a hosted page — the screen never asks the destination's kind", () => {
    // The discriminating case for "the record decides": a hosted page's
    // record carries `seoNote: null`, and this component has no branch that
    // could reach the line another way.
    const html = render({
      seoNote: null,
      address: {
        offered: true,
        label: "record.address.publiclyReadableAt",
        url: "https://content.example.com/best-crm",
      },
    });
    expect(html).not.toContain("noSeoPlugin");
  });

  it("takes no tone: it is a fact about the customer's site, not a failure of their page", () => {
    const html = render({ seoNote: "publish.wordpress.noSeoPlugin" });
    const line = html.slice(html.indexOf("publish.wordpress.noSeoPlugin") - 120);
    expect(line).not.toContain("badge-error");
    expect(line).not.toContain("badge-warning");
  });
});

describe("no row without a fact", () => {
  it("a page that is not unpublished draws no taken-down row", () => {
    expect(render()).not.toContain("record.label.taken-down");
  });

  it("nothing renders as a blank or a dash where a value belongs", () => {
    const html = render({
      address: { offered: false, because: "never_made_live", copy: "record.address.neverMadeLive" },
      verification: { kind: "due" },
    });
    // `aria-hidden` is excluded, and only that (issue #355). The block is a
    // card since S16 landed, and the idiom's card head draws an accent chip
    // that carries no glyph — v3 ships no icon set, and `CardHead` says why
    // an empty chip is still the chip the idiom draws. It is hidden from
    // the accessibility tree, so it is not a place a value belongs; every
    // element that *is* one is still swept by the line below.
    expect(html.replace(/<span[^>]*aria-hidden[^>]*><\/span>/g, "")).not.toMatch(
      /<span[^>]*><\/span>/
    );
    expect(html).not.toContain("—");
  });
});
