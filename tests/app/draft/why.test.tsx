/** @vitest-environment jsdom */
// tests/app/draft/why.test.tsx — SPEC §4 (2026-10-10), issue 1395: why this
// topic, the topics set aside, and the two sources a page is written from.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { COPY } from "@/lib/presentation/copy";
import { TargetBlock } from "@/app/(account)/app/draft/[draftId]/TargetBlock";
import { WrittenFromCard } from "@/app/(account)/app/draft/[draftId]/ReviewCards";
import { FIXTURE_WRITTEN_FROM } from "@/app/(account)/app/draft/[draftId]/fixture";
import type { DraftTarget } from "@/app/(account)/app/draft/[draftId]/model";

const AT = new Date(Date.UTC(2026, 9, 5));
const PUBLISHER = { name: "baeckerei.example", url: "https://baeckerei.example", addressRecorded: false };

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

function block(t: DraftTarget, setAside?: { covered: number; tooHard: number; lowFit: number; resting: number }): string {
  return renderToStaticMarkup(
    <TargetBlock target={t} setAside={setAside} title="Glutenfreies Brot" description="" publisher={PUBLISHER as never} />
  );
}

describe("why this topic", () => {
  it("states the fit in words and the rival the pass recorded, never the stored number", () => {
    const html = block(target({ fit: "answer", rival: "bäckerei-müller.example" }));
    expect(html).toContain(COPY["draft.why.fit.answer"]);
    expect(html).toContain("Answered today by bäckerei-müller.example");
    expect(html).not.toMatch(/Fit: \d/);
  });

  it("draws nothing for a row the pass stored neither on", () => {
    expect(block(target({ fit: null, rival: null }))).not.toContain('data-testid="draft-why"');
    expect(block(target(undefined))).not.toContain('data-testid="draft-why"');
  });

  it("lists the topics set aside by reason, and no reason with none", () => {
    const html = block(target(undefined), { covered: 3, tooHard: 4, lowFit: 0, resting: 1 });
    expect(html).toContain("Already covered by your site: 3");
    expect(html).toContain("Too hard for a site your size, for now: 4");
    expect(html).toContain("Resting after a stopped page: 1");
    expect(html).not.toContain("A poor fit");
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
