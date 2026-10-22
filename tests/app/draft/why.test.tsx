/** @vitest-environment jsdom */
// tests/app/draft/why.test.tsx — SPEC §4 (2026-10-10), issue 1395: why this
// page, and the two sources a page is written from.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { COPY } from "@/lib/presentation/copy";
import { WhyThisPage } from "@/app/(account)/app/draft/[draftId]/TargetBlock";
import { WrittenFromCard } from "@/app/(account)/app/draft/[draftId]/ReviewCards";
import { FIXTURE_WRITTEN_FROM } from "@/app/(account)/app/draft/[draftId]/fixture";
import type { DraftTarget } from "@/app/(account)/app/draft/[draftId]/model";

const AT = new Date(Date.UTC(2026, 9, 5));
/** A German bakery's page: the search and the rival are not English. */
function target(why: Extract<DraftTarget, { kind: "target" }>["why"]): DraftTarget {
  return {
    kind: "target",
    target: {
      search: "glutenfreies brot münchen",
      askedAs: "Wo gibt es glutenfreies Brot in München?",
      volume: { kind: "measured", value: 90, at: AT },
      difficulty: { kind: "unmeasured", reason: "not_attempted", at: AT },
      ceiling: null,
      winnability: "winnable",
      engines: [],
      doneWhen: "",
    },
    ...(why === undefined ? {} : { why }),
  };
}

function block(t: DraftTarget): string {
  return renderToStaticMarkup(<WhyThisPage target={t} />);
}

describe("why this page", () => {
  it("states the fit in words and names the rival under who answers it, never the stored number", () => {
    const html = block(target({ fit: "answer", rival: "bäckerei-müller.example" }));
    expect(html).toContain(COPY["draft.why.fit.answer"]);
    const host = document.createElement("div");
    host.innerHTML = html;
    const rows = [...host.querySelectorAll("dt")].map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]);
    expect(rows).toContainEqual([COPY["draft.search.rival"], "bäckerei-müller.example"]);
    expect(html).not.toMatch(/Fit: \d/);
  });

  it("draws no reason line and no rival row for a row the pass stored neither on", () => {
    for (const html of [block(target({ fit: null, rival: null })), block(target(undefined))]) {
      expect(html).not.toContain(COPY["draft.why.fit.answer"]);
      expect(html).not.toContain(COPY["draft.search.rival"]);
      expect(html).toContain("glutenfreies brot münchen");
    }
  });
});

describe("written from your business", () => {
  it("opens with its counts and lists the two sources apart", () => {
    const html = renderToStaticMarkup(<WrittenFromCard writtenFrom={FIXTURE_WRITTEN_FROM} timeZone="Europe/Berlin" />);
    const sources = new Set((FIXTURE_WRITTEN_FROM.pack?.claims ?? []).map((claim) => claim.url)).size;
    expect(html).toContain(
      `Facts from your site: ${String(FIXTURE_WRITTEN_FROM.facts.length)} · Market sources: ${String(sources)}`
    );
    const site = html.indexOf(COPY["draft.written-from.site"]);
    const market = html.indexOf(COPY["draft.written-from.market"]);
    expect(site).toBeGreaterThan(-1);
    expect(market).toBeGreaterThan(site);
    expect(html).not.toContain("invented");
  });
});
