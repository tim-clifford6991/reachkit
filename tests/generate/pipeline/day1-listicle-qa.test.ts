// SPEC §7 (D47, amended 2026-11-06): a listicle code cannot lay a table out
// of — short of options, of the business's own price, or both — is written as
// a Q&A from the same reads, and a Q&A that still cannot hold is short.
import "../env";
import { describe, expect, it } from "vitest";
import { buildPack, type PackInputs } from "../../../src/lib/generate/pipeline/pack";
import { writingMarket } from "../../../src/lib/generate/voice/market";
import { parseStoredMarket } from "../../../src/lib/market/infer/stored";
import type { PromptProfile } from "../../../src/lib/generate/voice/profile-block";
import type { StoredReport } from "../../../src/lib/scan/report";
import { opportunity, report } from "../fixtures";
import stored from "./fixtures/day1-listicles-2026-11-05.json";

type Site = (typeof stored)["baeckerei-hinkel.de"] | (typeof stored)["tattly.com"];

/** A stored report that measured these questions, and nothing else of note. */
function measuring(questions: readonly (readonly string[])[]): StoredReport {
  const base = report();
  if (base.questions.kind === "unmeasured") throw new Error("the fixture report measures questions");
  const like = base.questions.value[0]!;
  return { ...base, questions: { ...base.questions, value: questions.map(([text, keyword], n) => ({ ...like, id: `q${n + 1}`, text: text!, search: { ...like.search, keyword: keyword! } })) } };
}

/** The day-1 listicle's pack inputs, replayed from what the panel stored. */
function replay(site: Site): PackInputs {
  const market = site.business.market;
  const rivals = market.rivals.map((rival) => rival.domain);
  const writingFor = writingMarket({ site: { category: market.category, competitors: rivals, stored: parseStoredMarket({ current: market }) }, reportCategory: "" });
  return {
    type: "listicle",
    opportunity: opportunity({ targetQuery: site.target, targetRef: site.target, title: site.target, absorbedQueries: [] }),
    site: { businessName: site.business.name, domain: site.business.domain, doNotClaim: [], rivals: site.business.rivals },
    category: site.business.category,
    market,
    writingFor,
    byline: site.business.name,
    voice: null,
    profile: site.profile as PromptProfile,
    facts: site.facts.map(({ passage, url, readAt }) => ({ fact: { passage, url, readAt: new Date(readAt) }, sourceText: passage })),
    research: { ...site.research, facts: site.research.facts.map((fact) => ({ ...fact, readAt: new Date(fact.readAt) })) } as PackInputs["research"],
    report: measuring(site.measured),
    sitePages: [],
    links: [],
    now: new Date(stored["baeckerei-hinkel.de"].research.facts[0]!.readAt),
    ...(site.locale === null ? {} : { locale: site.locale as PackInputs["locale"] }),
  };
}

describe("a day-1 listicle that cannot field its table is still a page", () => {
  it("the bakery's listicle, short of options and its own price, is written as a Q&A of the same reads, short of nothing", () => {
    const pack = buildPack(replay(stored["baeckerei-hinkel.de"]));
    expect(pack).toMatchObject({ type: "qa", missing: [] });
    // Nothing is invented: the Q&A holds no price the business never stated.
    expect(pack.profile?.knowledge?.offerings.flatMap((offering) => offering.prices)).toEqual([]);
    expect(pack.claims.length).toBeGreaterThan(0);
    expect(pack.questions.length).toBeGreaterThanOrEqual(5);
  });

  it("the shop's Q&A, with one outside page to cite, stays short and honest: nothing below the Q&A's bar is written", () => {
    const pack = buildPack(replay(stored["tattly.com"]));
    expect(pack).toMatchObject({ type: "qa", missing: ["outside_sources"] });
  });
});
