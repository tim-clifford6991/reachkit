// SPEC §6, owner D66 (issue 1311): a German site's page is written in German
// from the same templates — its title formulas, its banned title patterns
// and its own rules are German — and an English page is told what it was.
import "./env";
import { describe, expect, it } from "vitest";
import { TITLE } from "../../src/lib/config/constants";
import { titleBrief } from "../../src/lib/generate/pipeline/title";
import type { ContextPack } from "../../src/lib/generate/pipeline/pack";
import { titleFaults, type TitleRuleInputs } from "../../src/lib/generate/rules/title";
import { TEMPLATES, languageRules, titleFormulas } from "../../src/lib/generate/templates";
import { languagePack } from "../../src/lib/locale/language";
import { CONTENT_TYPES } from "../../src/lib/opportunities/content-type";

const DESCRIPTION =
  "Fünf Bäckereien in Düsseldorf im Vergleich: Sortiment, Preise und Öffnungszeiten, mit den Seiten, von denen die Angaben stammen, verlinkt.";

const rule = (over: Partial<TitleRuleInputs> = {}): TitleRuleInputs => ({
  type: "listicle",
  terms: ["bäckerei düsseldorf"],
  rivals: ["Terbuyken", "Kamps"],
  follow: [],
  asks: false,
  places: ["Düsseldorf"],
  holds: "5 Bäckereien. Die Lieferung ins Büro ist kostenlos.",
  year: 2026,
  titles: [],
  description: DESCRIPTION,
  language: "de",
  ...over,
});

describe("German templates", () => {
  it("every type has German title formulas, and a listicle's are German words", () => {
    for (const type of CONTENT_TYPES) expect(titleFormulas(type, "de")?.titles.length, type).toBeGreaterThan(0);
    const listicle = titleFormulas("listicle", "de")!;
    expect(listicle.titles.join(" ")).toMatch(/besten.*Alternativen zu/);
    expect(listicle.titles.join(" ")).not.toMatch(/\bbest\b|\balternatives\b/);
    expect(listicle.titleNever).toMatch(/Nr\. 1/);
  });

  it("an English page keeps the templates' own formulas and gets no added rule", () => {
    expect(titleFormulas("listicle", "en")).toBeNull();
    expect(languageRules("en")).toEqual([]);
    expect(TEMPLATES.listicle.titles[0]).toBe("{N} best {term} for {audience} ({year})");
  });

  it("a German page is told to be German throughout", () => {
    const rules = languageRules("de").join(" ");
    expect(rules).toMatch(/whole page in German/);
    expect(rules).toMatch(/"Sie"/);
    expect(rules).toMatch(/ae, oe, ue and ss/);
  });

  it("the writer of a German page is told the German banned patterns, an English one the English", () => {
    const pack = (locale?: ContextPack["locale"]) =>
      ({
        type: "qa",
        builtAt: "2026-10-07T00:00:00.000Z",
        target: { question: "bäckerei düsseldorf", searches: ["bäckerei düsseldorf"] },
        business: { market: null, rivals: [] },
        products: [],
        pages: [],
        facts: [],
        claims: [],
        questions: [],
        measurements: null,
        live: null,
        profile: null,
        ...(locale === undefined ? {} : { locale }),
      }) as unknown as ContextPack;
    const said = (brief: Record<string, unknown>): string => (brief.rules as string[]).join(" ");
    expect(said(titleBrief(pack({ country: "DE", language: "de" })))).toContain('"umfassend"');
    expect(said(titleBrief(pack()))).toContain(`"${TITLE.banned[0]}"`);
    expect(said(titleBrief(pack()))).not.toContain("umfassend");
  });
});

describe("the title check on a German page (D51, in German)", () => {
  it("passes German titles that follow the formulas", () => {
    expect(titleFaults("Die 5 besten Bäckereien in Düsseldorf für Familien (2026)", rule({ terms: ["bäckereien düsseldorf"] }))).toEqual([]);
    expect(titleFaults("Terbuyken vs. Kamps (2026): 5 Brote im Preisvergleich", rule({ terms: ["terbuyken vs kamps"] }))).toEqual([]);
    expect(titleFaults("Was kostet eine Hochzeitstorte in Düsseldorf?", rule({ type: "qa", terms: ["was kostet eine hochzeitstorte"], asks: true }))).toEqual([]);
  });

  it("reads a German plural as its singular when it looks for the search term", () => {
    expect(titleFaults("Bäckereien in Düsseldorf: 5 Adressen für frisches Brot", rule({ type: "qa", terms: ["bäckerei düsseldorf"] }))).not.toContain("term");
  });

  it("stops a German banned pattern, and a word said twice", () => {
    expect(titleFaults("Der ultimative Ratgeber: Bäckerei Düsseldorf für Familien", rule({ type: "qa" }))).toContain("banned");
    expect(titleFaults("Bäckerei Düsseldorf: umfassend erklärt für Familien", rule({ type: "qa" }))).toContain("banned");
    expect(titleFaults("Bäckerei Düsseldorf: die Bäckerei für Familien am Rhein", rule({ type: "qa" }))).toContain("banned");
  });

  it("counts the place or a word for free the pack holds as the specific, and a German question as a question", () => {
    const bare = rule({ type: "qa", rivals: [], places: [], terms: ["bäckerei rheinland"] });
    expect(titleFaults("Bäckerei im Rheinland am Sonntag geöffnet", bare)).toContain("specific");
    expect(titleFaults("Welche Bäckerei im Rheinland hat sonntags geöffnet", bare)).toContain("question");
    expect(titleFaults("Bäckerei im Rheinland: Lieferung kostenlos ins Büro", bare)).not.toContain("specific");
    expect(titleFaults("Bäckerei im Rheinland und warum Brot wichtig ist", bare)).toContain("banned");
  });

  it("keeps the English list for an English page", () => {
    expect(languagePack("en").title.banned).toEqual(TITLE.banned);
    expect(titleFaults("Bakery tips: umfassend guide for local families", rule({ language: "en", terms: ["bakery tips"], type: "qa" }))).not.toContain("banned");
  });
});
