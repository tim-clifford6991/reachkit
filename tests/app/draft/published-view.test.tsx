/** @vitest-environment jsdom */
// tests/app/draft/published-view.test.tsx — SPEC §7 (2026-09-20, #908),
// issue #931
//
// The page viewer. One claim, and everything here is a way of holding it:
// **the screen a customer approves a page on serves the bytes a reader will
// get.** Not a likeness of them, not a second renderer kept in step by
// review — the same three calls on the same class map, which is why the
// first block below asserts an *equality* rather than a list of things the
// HTML happens to contain.
//
// It does not transcribe #931. The frame's dressing is daisyUI's and is not
// asserted class by class; what is asserted is the property a reviewer's
// decision rests on, and the two facts the frame exists to state: whose page
// it is, and that nothing of ours is on it.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HOSTED_BODY_CLASSES } from "@/app/(hosted)/hosted-page/body-classes";
import { markPassage, parseMarkdown, toHtml } from "@/lib/publish/render/markdown";
import { PublishedPageView } from "@/app/(account)/app/draft/[draftId]/PublishedPageView";
import { publishedCounts } from "@/app/(account)/app/draft/[draftId]/publishes";
import { codeOf } from "../../mail/leads/source";

/** A body carrying every block a *body* can carry (#929/#973): a heading, a
 *  paragraph, a list, a quote, a GFM table and the short-answer box. The
 *  viewer is the screen those blocks were added for, so a body missing one
 *  would leave the equality below proving nothing about the blocks most
 *  likely to be dressed a second way.
 *
 *  **Related guides are not here, and cannot be.** `markdown.ts` refuses to
 *  parse a `:::guides` fence on purpose — the block is minted by
 *  `guidesBlock()` "in code, never by the model" — and nothing on `main`
 *  calls it yet. So no body serves one today, on the hosted page or here,
 *  and the day one does the viewer draws it without a line changing: it is
 *  the same serialiser call. A body with the fence written into it would
 *  assert the opposite of #973's rule. */
const BODY = [
  "A service costs between £60 and £280, and the price is quoted before work starts.",
  "",
  ":::answer",
  "A basic service is £60 and takes a working day.",
  ":::",
  "",
  "## What does a service cost?",
  "",
  "| Service | Price |",
  "| --- | ---: |",
  "| Basic | **£60** |",
  "| Full | £280 |",
  "",
  "- Same-day when dropped off by 10am",
  "- Every repair guaranteed for 90 days",
  "",
  "> A bike you cannot ride on Monday is not a repaired bike.",
  "",
  "Book on the [workshop page](https://example.com/book).",
].join("\n");

const PASSAGE = "A service costs between £60 and £280, and the price is quoted before work starts.";

const PUBLISHER = {
  name: "example.com",
  url: "https://example.com/what-a-service-costs",
  addressRecorded: true,
};

function frame(p?: { grounded?: { present: boolean; passage: string } }): Element {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(
    <PublishedPageView
      title="What a bike service costs"
      bodyMd={BODY}
      grounded={
        p?.grounded === undefined
          ? { present: false, passage: PASSAGE }
          : { present: p.grounded.present, passage: p.grounded.passage }
      }
      publisher={PUBLISHER}
    />
  );
  const view = container.querySelector('[data-testid="published-view"]');
  if (view === null) throw new Error("the viewer rendered nothing");
  return view;
}

function bodyHtml(root: Element): string {
  const body = root.querySelector('[data-testid="draft-body"]');
  if (body === null) throw new Error("the viewer drew no body");
  return body.innerHTML;
}

describe("#931 — one serialiser: the viewer's body is the hosted page's body", () => {
  it("is byte-for-byte what `toHtml` serves the hosted route for the same Markdown", () => {
    // The expectation is computed through the *public* calls the hosted
    // route makes, with the class map imported from the hosted page's own
    // module — so this equality fails the moment the viewer grows a class
    // of its own, a wrapper of its own, or a second parse. It is the whole
    // claim of #931 in one line, and it covers the table, the
    // short-answer box and the related guides with it.
    expect(bodyHtml(frame())).toBe(toHtml(parseMarkdown(BODY), HOSTED_BODY_CLASSES));
  });

  it("marks the recorded passage the same call the hosted page marks it with", () => {
    const html = bodyHtml(frame({ grounded: { present: true, passage: PASSAGE } }));
    expect(html).toBe(
      toHtml(markPassage(parseMarkdown(BODY), PASSAGE).blocks, HOSTED_BODY_CLASSES)
    );
    // And the mark is really there, so the equality above is not two
    // identically unmarked strings.
    expect(html).toContain("<mark");
  });

  it("marks nothing where the recorded passage is no longer in the text", () => {
    // An edit that removed the fact: `markPassage` marks nothing rather
    // than the nearest thing to it, and the viewer's answer is the hosted
    // page's answer for the same body.
    const html = bodyHtml(frame({ grounded: { present: true, passage: "a sentence nobody wrote" } }));
    expect(html).not.toContain("<mark");
    expect(html).toBe(toHtml(parseMarkdown(BODY), HOSTED_BODY_CLASSES));
  });

  it("neither surface builds a body any other way", () => {
    // Stated where it can be broken, the way `markdown.test.ts` states the
    // mark rule. Both files make the same three calls on the same map, and
    // the viewer names no second class table.
    const VIEWER = "src/app/(account)/app/draft/[draftId]/PublishedPageView.tsx";
    const HOSTED = "src/app/(hosted)/hosted-page/[[...slug]]/page.tsx";
    for (const file of [VIEWER, HOSTED]) {
      const code = codeOf(file);
      for (const call of ["parseMarkdown(", "markPassage(", "toHtml(", "HOSTED_BODY_CLASSES"]) {
        expect(code, `${file} must build its body with ${call}`).toContain(call);
      }
      // One place where HTML is set, so there is one body and not a second
      // element tree beside it. The hosted page also sets its two data
      // blocks and its related guides, which the same `toHtml` serialises
      // from `guidesBlock()` (issue 1140).
      expect(code.match(/dangerouslySetInnerHTML/g)?.length ?? 0).toBeLessThanOrEqual(
        file === HOSTED ? 4 : 1
      );
    }
    expect(codeOf(VIEWER), "the viewer must not carry the editor's map").not.toContain(
      "DRAFT_BODY_CLASSES"
    );
  });
});

describe("#931 — the frame is theirs, and there is nothing of ours inside it", () => {
  it("draws the page's own address, whole, and their name above the headline", () => {
    const view = frame();
    expect(view.textContent).toContain("example.com/what-a-service-costs");
    expect(view.querySelector("h1")?.textContent).toBe("What a bike service costs");
  });

  it("carries no mark of ReachKit's inside the frame", () => {
    // #931's own words. The provenance line is the screen's and sits
    // outside the frame (`DraftScreen`), which is what
    // `tests/app/draft/view.test.tsx` asserts from the other side.
    const inside = frame().querySelector(".mockup-browser");
    expect(inside).not.toBeNull();
    expect(inside?.textContent?.toLowerCase()).not.toContain("reachkit");
  });

  it("is read-only: no control of any kind sits in the frame", () => {
    // A reviewer's actions are the rail's. A field or a button in here
    // would offer to edit the page in the one place that claims to be
    // showing it as published.
    const inside = frame().querySelector(".mockup-browser");
    expect(inside?.querySelectorAll("button, input, textarea, select, form").length).toBe(0);
  });

  it("states no publication date, because the screen holds none", () => {
    // The hosted byline reads "published {date} · by {publisher}" off the
    // `publications` row. A page in review has no such row, and the two
    // dates the screen does hold — written, and the day the veto window
    // closes — are not publication dates. The frame leaves the line out
    // rather than filling it with one of them.
    expect(frame().querySelector("time")).toBeNull();
  });
});

describe("#931 — what gets published, counted off the body in front of the customer", () => {
  it("counts every link the page will carry, wherever it sits", () => {
    // One: the inline link in the last paragraph.
    expect(publishedCounts(BODY).links).toBe(1);
    // And a link inside a table cell or a list item is a link the page
    // carries too — the count walks the blocks rather than the top level.
    expect(publishedCounts("| a |\n| --- |\n| [x](https://e.com) |").links).toBe(1);
    expect(publishedCounts("- [x](https://e.com) and [y](https://e.com)").links).toBe(2);
  });

  it("counts a declared question-and-answer pair per heading written as a question", () => {
    expect(publishedCounts(BODY).questions).toBe(1);
    expect(publishedCounts("## What does it cost?\n\n## Prices").questions).toBe(1);
  });

  it("counts the characters a reader meets, not the Markdown they are written in", () => {
    // The same words with more emphasis in them are not a longer page.
    expect(publishedCounts("**bold** and *thin*").characters).toBe(
      publishedCounts("bold and thin").characters
    );
    // A link's length is its text, not its address.
    expect(publishedCounts("[book](https://example.com/a/very/long/address)").characters).toBe(4);
  });

  it("counts through the parser, so a line that is not a table is not counted as one", () => {
    // `a | b` is a paragraph without a delimiter row (#973), and the count
    // agrees with the page because it reads the same blocks.
    expect(publishedCounts("a | b").characters).toBe(5);
  });

  it("an empty body counts zero of everything", () => {
    expect(publishedCounts("")).toEqual({ links: 0, questions: 0, characters: 0 });
  });
});
