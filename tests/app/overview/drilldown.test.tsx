/** @vitest-environment jsdom */
// Issue 1457 — every Overview number opens exactly the items it counts.
//
// One case per counting tile: the figure Overview draws equals the rows its
// detail screen draws, on the same fixture account. The score counts no
// items and opens nothing.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/app/search",
  redirect: vi.fn(),
}));

import OverviewPage from "@/app/(account)/app/(tabs)/page";
import { SearchTable } from "@/app/(account)/app/_overview/SearchTable";
import { readSearch } from "@/app/(account)/app/_overview/search-provider";
import { PromptCards } from "@/app/(account)/app/_overview/PromptCards";
import { readPrompts } from "@/app/(account)/app/_overview/prompts-provider";
import { PublishedList } from "@/app/(account)/app/calendar/PublishedList";
import { readPublished } from "@/app/(account)/app/_overview/content-provider";
import { contentOf } from "@/app/(account)/app/_overview/content";
import { resetAccount, signedInAs } from "../account-door";

beforeEach(() => signedInAs());
afterEach(() => resetAccount());

function render(node: React.JSX.Element): Element {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(node);
  return container;
}

async function tile(id: string): Promise<Element> {
  const found = render(await OverviewPage()).querySelector(`[data-testid="overview-tile-${id}"]`);
  if (found === null) throw new Error(`no ${id} tile`);
  return found;
}

function figure(el: Element, id: string): number {
  return Number(el.querySelector(`[data-testid="overview-tile-${id}-value"]`)?.textContent);
}

describe("issue 1457 — a tile's count is its detail screen's row count", () => {
  it("Google opens the Google tab's first-page rows, and counts exactly them", async () => {
    const google = await tile("google");
    expect(google.getAttribute("href")).toBe("/app/search?show=first_page");
    const table = render(
      <NuqsTestingAdapter searchParams={{ show: "first_page" }}>
        <SearchTable model={await readSearch()} />
      </NuqsTestingAdapter>
    );
    const rows = table.querySelectorAll('[data-testid="search-row"]').length;
    expect(rows).toBeGreaterThan(0);
    expect(figure(google, "google")).toBe(rows);
  });

  it("AI opens the AI tab's list, and counts exactly the rows marked there", async () => {
    const ai = await tile("ai");
    expect(ai.getAttribute("href")).toBe("/app/ai-answers#prompts-list");
    const list = render(<PromptCards model={await readPrompts()} />);
    expect(list.querySelector("#prompts-list")).not.toBeNull();
    const marked = list.querySelectorAll('[data-testid="prompts-row"][data-mentioned]').length;
    expect(marked).toBeGreaterThan(0);
    expect(figure(ai, "ai")).toBe(marked);
  });

  it("Content opens Plan's Published list, and counts exactly its rows", async () => {
    const content = await tile("content");
    expect(content.getAttribute("href")).toBe("/app/calendar#published");
    const list = render(<PublishedList content={contentOf(await readPublished())} timeZone="UTC" />);
    expect(list.querySelector("#published")).not.toBeNull();
    const rows = list.querySelectorAll('[data-testid="plan-published-row"]');
    expect(figure(content, "content")).toBe(rows.length);
    const recent = list.querySelectorAll('[data-testid="plan-published-row"][data-recent]').length;
    expect(recent).toBeGreaterThan(0);
    expect(recent).toBeLessThan(rows.length);
    expect(content.textContent).toContain(`${recent} in the last`);
  });

  it("the Visibility Score counts no items, so it opens nothing", async () => {
    expect((await tile("score")).tagName).not.toBe("A");
  });
});
