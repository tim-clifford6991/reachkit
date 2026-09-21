/** @vitest-environment jsdom */
// tests/app/draft/page.test.tsx — BUILD §4.6, REQ-045 c1, REQ-093 c2
//
// The route itself: what it reads, what it resolves an unknown id to, and
// the one thing it must do that no component below it can — put REQ-093
// criterion 2's label and the text it speaks for into the same call, so
// they cannot be rendered apart.
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import DraftPage, { generateMetadata } from "@/app/(account)/app/draft/[draftId]/page";
import {
  FIXTURE_DRAFTS,
  FIXTURE_DRAFT_ID,
} from "@/app/(account)/app/draft/[draftId]/fixture";
import { COPY } from "@/lib/presentation/copy";

// BUILD §4.4–§4.6, issue #169 — the surfaces under test now resolve who is
// asking through `_session/account.ts`, which reads a signed cookie and a
// `sites` row. This suite has neither, so it signs in as the reserved
// fixture account: the surfaces then take the same fixture branch they
// always took, and what changed is only how they learned whose it is.
import { resetAccount, signedInAs } from "../account-door";

beforeEach(() => signedInAs());
afterEach(() => resetAccount());


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
    // The line, and nothing of the draft: no body, no checks, no rail.
    expect(root.textContent).toContain(COPY["draft.not-found"]);
    expect(root.querySelector('[data-testid="draft-body"]')).toBeNull();
    expect(root.querySelector('[data-testid="draft-decide"]')).toBeNull();
  });

  it("issue #913 — and a way back, because a screen with nothing on it is a dead end", async () => {
    const root = await render("draft-nobody-owns");
    const back = root.querySelector('[data-testid="draft-not-found-back"]');
    // The same address and the same word the draft's own back link
    // carries: this route has no navigation of its own, so without it a
    // stale link left the customer with one sentence and nowhere to go.
    expect(back?.getAttribute("href")).toBe("/app/calendar");
    expect(back?.textContent).toContain(COPY["draft.back"]);
  });
});

describe("#984 — the tab says which page is waiting, not which kind of screen", () => {
  // Owner ruling 2026-09-21. The title is the draft's own, through a slot
  // in a written sentence — model text never reaches a browser tab as a
  // sentence of ours — and the static key stays the floor.
  const titleOf = async (draftId: string): Promise<unknown> =>
    (await generateMetadata({ params: Promise.resolve({ draftId }) })).title;

  it("a draft with a title carries it", async () => {
    const facts = FIXTURE_DRAFTS[FIXTURE_DRAFT_ID];
    expect(await titleOf(FIXTURE_DRAFT_ID)).toBe(
      COPY["meta.app.draft.title.page"].replace("{title}", facts?.title ?? "")
    );
  });

  it("an id that resolves to nothing reads the floor, and says nothing about whether it exists", async () => {
    expect(await titleOf("no-such-draft")).toBe(COPY["meta.app.draft.title"]);
  });

  it("it is the same read the render makes — one resolution per request", async () => {
    // `readDraft` is `React.cache`d, so the metadata and the render below
    // it describe one row. Asserted by their agreement: the title in the
    // head is the title in the document.
    const root = await render(FIXTURE_DRAFT_ID);
    const heading = root.querySelector("h1")?.textContent ?? "";
    expect(String(await titleOf(FIXTURE_DRAFT_ID))).toContain(heading);
  });
});
