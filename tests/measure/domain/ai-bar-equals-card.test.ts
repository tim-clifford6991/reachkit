// The AI bar and the AI-answers card count one thing: the AI answers that
// named or linked the site. Each case builds both from the same SERPs.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { aiPresenceOf, aiPresenceRangeOf, aiSampleOf, wilsonOf } from "@/lib/measure/drivers";
import { buildAiAnswersCard } from "@/lib/market/questions/matrix";
import { measured, type Measured } from "@/lib/measure/measured";
import type { MarketSerp } from "@/lib/market/views";

const AT = new Date("2026-10-24T06:00:00.000Z");

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

function answer(said: { references?: string[]; urls?: string[]; text?: string } | null): Measured<MarketSerp> {
  return measured(
    {
      organic: [],
      aiOverview:
        said === null
          ? { present: false, referenceDomains: [] }
          : {
              present: true,
              referenceDomains: said.references ?? [],
              ...(said.urls === undefined ? {} : { referenceUrls: said.urls }),
              ...(said.text === undefined ? {} : { text: said.text }),
            },
    },
    AT
  );
}

/** The card's figure and the bar's tenths, read off the same SERPs. */
function read(ownDomain: string, serps: Measured<MarketSerp>[]) {
  const card = buildAiAnswersCard({
    questions: serps.map((_, i) => ({ id: `q${i}`, text: `Question ${i}?`, phrasing: "template", search: { keyword: `search ${i}`, volume: 100 } })),
    serps,
    ownDomain,
    coverage: "async_included",
  });
  const bar = aiPresenceOf({ serps, ownDomain, at: AT });
  return {
    figure: `${card.customerCitations} of ${card.answeredSearches}`,
    bar: bar.kind === "unmeasured" ? null : `${Math.round(bar.value / 10)}/10`,
    kind: bar.kind,
  };
}

describe("the AI bar counts what the AI-answers card counts: answers that named or linked the site", () => {
  it("an answer that names the site and links elsewhere is 1 of 1 and 10/10", () => {
    expect(read("tattly.com", [answer({ references: ["g2.com"], text: "Tattly sells temporary tattoos by artists." })])).toEqual({
      figure: "1 of 1",
      bar: "10/10",
      kind: "measured",
    });
  });

  it("an answer that links the site without naming it is 1 of 1 and 10/10", () => {
    expect(read("tattly.com", [answer({ references: ["tattly.com"], text: "Temporary tattoos by artists." })])).toEqual({
      figure: "1 of 1",
      bar: "10/10",
      kind: "measured",
    });
  });

  it("an answer that neither names nor links the site is 0 of 1 and 0/10, a measured zero", () => {
    expect(read("tattly.com", [answer({ references: ["rival.example.net"], text: "Rival One leads." })])).toEqual({
      figure: "0 of 1",
      bar: "0/10",
      kind: "zero",
    });
  });

  it("a domain whose first label is a common word is not named by that word used as a word", () => {
    expect(read("make.com", [answer({ references: ["zapier.com"], text: "You can make a workflow without writing code." })])).toEqual({
      figure: "0 of 1",
      bar: "0/10",
      kind: "zero",
    });
  });

  it("over a mix, the bar is the card's share in tenths and its range is that one rate's interval", () => {
    const serps = [
      answer({ references: ["g2.com"], text: "Tattly sells temporary tattoos." }),
      answer({ references: ["rival.example.net"], urls: ["https://tattly.com/collections/new"] }),
      answer({ references: ["rival.example.net"], text: "Rival One leads." }),
      answer({ references: [] }),
      answer(null),
    ];
    expect(read("tattly.com", serps)).toEqual({ figure: "2 of 4", bar: "5/10", kind: "measured" });
    const share = wilsonOf(2, 4);
    expect(aiPresenceRangeOf(aiSampleOf({ serps, ownDomain: "tattly.com" }))).toEqual({ low: 100 * share.low, high: 100 * share.high });
  });
});
