/** @vitest-environment jsdom */
// SPEC §4 (board AppCompetitors), #917 — the Competitors tab's cards and
// table as a reader meets them.
//
// **Rendering convention.** `tests/app/**` runs under the `node` project,
// whose environment has no `document`; this file declares `jsdom` for
// itself and renders with `react-dom/server`'s `renderToStaticMarkup`. The
// chosen rival is the URL's, so the table renders through `nuqs`'s own
// testing adapter — the same fact the browser reads, supplied the way the
// library supplies it.
//
// **`copy()` is not mocked.** Every assertion below is about what a reader
// sees, so the real registry has to be what renders.
import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/app/rivals",
  redirect: vi.fn(),
}));

import { RivalPresence } from "@/app/(account)/app/_overview/RivalPresence";
import { RivalTable } from "@/app/(account)/app/_overview/RivalTable";
import { assembleRivals, type PresenceCard, type RivalsModel } from "@/app/(account)/app/_overview/rivals-model";
import { FIXTURE_RIVALS_FACTS } from "@/app/(account)/app/_overview/rivals-fixture";
import { RIVAL_STATUS_COPY_KEY } from "@/app/(account)/app/_overview/rivals-words";
import { copy } from "@/lib/presentation/copy";

const MODEL = assembleRivals(FIXTURE_RIVALS_FACTS);

function el(node: React.JSX.Element): Element {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(node);
  return container;
}

function table(searchParams: Record<string, string> = {}, doing: Record<string, string> = {}): Element {
  return el(
    <NuqsTestingAdapter searchParams={searchParams}>
      <RivalTable model={MODEL} doing={doing} />
    </NuqsTestingAdapter>,
  );
}

/** The sentences the page writes for a card that counted no rival. */
const NO_RIVAL = {
  noRivalOnFirstPage: copy("overview.rivals.first-page.none.holders", { holders: "holder.example" }),
  noRivalNamed: copy("overview.rivals.named.none"),
};

/** Who the month's answers mentioned, as the page hands it down. */
const NAMED: PresenceCard = {
  rivals: [{ domain: "billwise.example", count: 7 }],
  you: { domain: "", count: 3 },
  of: 32,
  noRival: false,
};

const presence = (model: RivalsModel = MODEL, startedLine: string | null = copy("overview.rivals.first-page.started", { count: "1", of: "12" })): Element =>
  el(
    <RivalPresence
      top={model.top}
      topLine="the top line"
      firstPage={model.firstPage}
      startedLine={startedLine}
      named={NAMED}
      namedLead="the named lead"
      {...NO_RIVAL}
      answersHref="/app/ai-answers"
    />,
  );

describe("the counting cards", () => {
  it("names every site it draws, and its count, without asking for colour", () => {
    // `PresenceBars` puts each name on its own line above its bar and
    // carries an `sr-only` list of the same readings — so the card reads
    // with no colour and with no chart.
    const card = presence().querySelector('[data-testid="rivals-card-first-page"]');
    for (const row of MODEL.firstPage.rivals) expect(card?.textContent, row.domain).toContain(`${row.domain} · ${row.count}`);
    expect(card?.textContent).toContain(`${copy("overview.prompts.share.you")} · ${MODEL.firstPage.you.count}`);
  });

  it("who your buyers see first: each holder's count of the twelve, others, then you, and the line under them", () => {
    const card = presence().querySelector('[data-testid="rivals-card-top"]');
    const of = String(MODEL.top.of);
    expect(card?.querySelector("h2")?.textContent).toBe(copy("overview.rivals.first.title"));
    expect(card?.textContent).toContain(copy("overview.rivals.first.lead", { of }));
    const rows = [...(card?.querySelectorAll("ul.sr-only li") ?? [])].map((li) => li.textContent);
    expect(rows).toEqual([
      ...MODEL.top.holders.map((row) => `${row.domain} · ${copy("overview.rivals.first.of", { n: String(row.count), of })}`),
      `${copy("overview.rivals.first.others")} · ${copy("overview.rivals.first.of", { n: String(MODEL.top.others), of })}`,
      `${copy("overview.prompts.share.you")} · ${copy("overview.rivals.first.of", { n: String(MODEL.top.you), of })}`,
    ]);
    expect(card?.querySelector('[data-testid="rivals-top-line"]')?.textContent).toBe("the top line");
  });

  it("who AI answers mention: the counts it is handed, and its lead", () => {
    const card = presence().querySelector('[data-testid="rivals-card-named"]');
    expect(card?.textContent).toContain("the named lead");
    expect(card?.textContent).toContain("billwise.example · 7");
  });

  it("says what each count is of", () => {
    expect(presence().textContent).toContain(
      copy("overview.rivals.first-page.lead", {
        of: String(MODEL.firstPage.of),
      }),
    );
  });

  it("says where the customer started", () => {
    expect(
      presence().querySelector('[data-testid="rivals-started"]')?.textContent,
    ).toBe(
      copy("overview.rivals.first-page.started", { count: "1", of: "12" }),
    );
  });

  it("offers the way through to the answers it counted", () => {
    const link = presence().querySelector('[data-testid="rivals-see-answers"]');
    expect(link?.getAttribute("href")).toBe("/app/ai-answers");
    expect(link?.textContent).toBe(copy("overview.rivals.named.see-all"));
  });

  it("a card the pass never reached states its line and draws no bars", () => {
    const empty = assembleRivals({
      ...FIXTURE_RIVALS_FACTS,
      firstPageOf: 0,
      firstPage: new Map(),
    });
    const node = presence(empty, null);
    expect(
      node.querySelector('[data-testid="rivals-card-first-page-unmeasured"]')
        ?.textContent,
    ).toBe(copy("overview.rivals.card.unmeasured"));
  });

  it("a card on which no rival was counted draws the customer alone and says why (issue 1365)", () => {
    const none = assembleRivals({
      ...FIXTURE_RIVALS_FACTS,
      firstPage: new Map([[FIXTURE_RIVALS_FACTS.ownDomain, 2]]),
    });
    const node = presence(none, null);
    const card = node.querySelector('[data-testid="rivals-card-first-page"]');
    expect(card?.querySelector('[data-testid="rivals-card-first-page-no-rival"]')?.textContent).toBe(NO_RIVAL.noRivalOnFirstPage);
    // No rival's row of zero is drawn; the customer's own count still is.
    for (const rival of none.firstPage.rivals) expect(card?.textContent).not.toContain(rival.domain);
    expect(card?.textContent).toContain(`${copy("overview.prompts.share.you")} · 2`);
    // The other card counted them and is drawn as before.
    expect(node.querySelector('[data-testid="rivals-card-named-no-rival"]')).toBeNull();
  });
});

describe("the table", () => {
  it("draws nine rows, and offers the rest", () => {
    const node = table();
    expect(node.querySelectorAll('[data-testid="rivals-row"]')).toHaveLength(9);
    expect(
      node.querySelector('[data-testid="rivals-show-all"]')?.textContent,
    ).toBe(
      copy("overview.rivals.show-all", { total: String(MODEL.rows.length) }),
    );
  });

  it("holds SPEC §4's four columns, in its order", () => {
    const heads = [...table().querySelectorAll("thead th")].map(
      (th) => th.textContent,
    );
    expect(heads).toEqual([
      copy("overview.search.column.search"),
      copy("overview.search.column.volume"),
      copy("overview.rivals.column.winner"),
      copy("overview.rivals.column.doing"),
    ]);
  });

  it("filters to one rival from the URL, and the chip's name carries its count", () => {
    const only = MODEL.rivals[0] as string;
    const node = table({ rival: only });
    const rows = [...node.querySelectorAll('[data-testid="rivals-row"]')];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.textContent).toContain(only);
    }
    expect(
      node
        .querySelector(`[data-testid="rivals-chip-${only}"]`)
        ?.getAttribute("aria-label"),
    ).toBe(
      copy("overview.rivals.chip", {
        rival: only,
        count: String(MODEL.counts[only]),
      }),
    );
  });

  it("says what it is doing about every row, in words and never by colour", () => {
    const badges = [
      ...table().querySelectorAll('[data-testid="rivals-row"] .badge'),
    ];
    const words = new Set(
      Object.values(RIVAL_STATUS_COPY_KEY).map((key) => copy(key)),
    );
    expect(badges.length).toBeGreaterThan(0);
    for (const badge of badges) {
      expect(words, badge.textContent ?? "").toContain(badge.textContent);
    }
  });

  it("a row whose search Plan's week holds says what goes live and when; the rest keep their status word", () => {
    const search = MODEL.rows[0]!.search;
    const doing = copy("overview.search.doing.page", { day: "Wed 21" });
    const rows = [...table({}, { [search]: doing }).querySelectorAll('[data-testid="rivals-row"]')];
    expect(rows[0]?.querySelector(".badge")?.textContent).toBe(doing);
    expect(rows[1]?.querySelector(".badge")?.textContent).toBe(copy(RIVAL_STATUS_COPY_KEY[MODEL.rows[1]!.status]));
  });

  it("scrolls sideways inside its own box, so a phone never scrolls the page", () => {
    expect(table().querySelector("table")?.parentElement?.className).toContain(
      "overflow-x-auto",
    );
  });

  it("cuts no search off at any width, and keeps the whole of it on the cell", () => {
    // The scroller is `sm:overflow-x-auto` now, and `checks.ts`'s allow-list
    // selects `.overflow-x-auto` — which does not match the responsive
    // variant. A clamp outside a declared scroll container is a clipped
    // value, so nothing here clamps and the row grows instead.
    for (const cell of table().querySelectorAll('[data-testid="rivals-search"]')) {
      expect(cell.className).not.toMatch(/truncate/);
      expect(cell.getAttribute("title")).toBe(cell.textContent);
    }
  });

  it("is two shapes in one DOM: stacked rows below `sm`, four columns above", () => {
    const node = table();
    // The owner's review of #958: at 390 the two columns that matter were
    // off the right edge of the scroller. Below `sm` the row is a grid and
    // the box does not scroll at all; nothing is written twice.
    expect(node.querySelector('[data-testid="rivals-table-scroll"]')?.className).toBe(
      "min-w-0 sm:overflow-x-auto"
    );
    expect(node.querySelector("thead")?.className).toContain("hidden");
    const row = node.querySelector('[data-testid="rivals-row"]');
    expect(row?.className).toContain("grid");
    expect(row?.className).toContain("sm:table-row");
    // Four cells, once — the phone shape re-flows them, it does not add any.
    expect(row?.querySelectorAll("td")).toHaveLength(4);
  });

  it("gives the box that can scroll a way in from a keyboard, and a name", () => {
    // axe `scrollable-region-focusable`, which the CI gate reported as a
    // serious finding on this route. The four columns fit with nothing to
    // scroll from 768 up, but they are 7px over at 640 — the first width
    // this shape applies at — so the box keeps its keyboard way in.
    const box = table().querySelector('[data-testid="rivals-table-scroll"]');
    expect(box?.getAttribute("tabindex")).toBe("0");
    expect(box?.getAttribute("role")).toBe("region");
    expect(box?.getAttribute("aria-label")).toBe(copy("overview.rivals.table.label"));
  });

  it("shows a rival's place only where the pass measured one", () => {
    const node = table();
    const withPlace = MODEL.rows
      .slice(0, 9)
      .filter((row) => row.position.kind !== "unmeasured").length;
    const places = [
      ...node.querySelectorAll('[data-testid="rivals-row"]'),
    ].filter((row) => /#\d/.test(row.textContent ?? ""));
    expect(places).toHaveLength(withPlace);
  });
});
