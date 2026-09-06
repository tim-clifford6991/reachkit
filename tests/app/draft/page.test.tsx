/** @vitest-environment jsdom */
// tests/app/draft/page.test.tsx — BUILD §4.6, REQ-045 c1, REQ-093 c2
//
// The route itself: what it reads, what it resolves an unknown id to, and
// the one thing it must do that no component below it can — put REQ-093
// criterion 2's label and the text it speaks for into the same call, so
// they cannot be rendered apart.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DraftPage from "@/app/(account)/app/draft/[draftId]/page";
import {
  FIXTURE_DRAFTS,
  FIXTURE_DRAFT_ID,
} from "@/app/(account)/app/draft/[draftId]/fixture";
import { COPY } from "@/lib/presentation/copy";

async function render(draftId: string): Promise<Element> {
  const el = await DraftPage({ params: Promise.resolve({ draftId }) });
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(el);
  return container;
}

describe("the route reads once and renders the whole draft", () => {
  it("renders the view for an id the store holds", async () => {
    const root = await render(FIXTURE_DRAFT_ID);
    expect(root.querySelector('[data-testid="draft-view"]')).not.toBeNull();
    const facts = FIXTURE_DRAFTS[FIXTURE_DRAFT_ID];
    expect(root.querySelector("h1")?.textContent).toBe(facts?.title);
  });

  it("declares no Surface of its own — the shell's layout owns the screen root", async () => {
    const root = await render(FIXTURE_DRAFT_ID);
    expect(root.querySelectorAll("[data-surface]").length).toBe(0);
  });
});

describe("REQ-093 c2 — the generated-content label rides with the text", () => {
  it("the label the one sink returned is rendered on the page", async () => {
    const root = await render(FIXTURE_DRAFT_ID);
    const label = root.querySelector('[data-testid="draft-generated-label"]')?.textContent;
    expect(label).toBe(COPY["generated.page.written"]);
    expect(label).not.toBe("");
  });
});

describe("an id the store does not hold resolves to one written line", () => {
  it("no stack trace, no vendor payload, and no half-rendered draft", async () => {
    const root = await render("draft-nobody-owns");
    expect(root.querySelector('[data-testid="draft-not-found"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="draft-view"]')).toBeNull();
    expect(root.textContent).toBe(COPY["draft.not-found"]);
  });
});
