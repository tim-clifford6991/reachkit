// SPEC §7 (owner, D51, issue 1266; revised by issue 1389) — what a page's
// title is held to, read off its context pack.
//
// The writer is told it (`./write.ts`), code picks among the titles the
// writer proposes by it, and stage 4 checks it (`../rules/title.ts`) — from
// this one reading, so the title a writer is asked for, the title code picks
// and the title the check passes are one description.
import { languagePack, SHAPES } from "@/lib/locale/language";
import { TITLE } from "@/lib/config/constants";
import { brandOf } from "@/lib/market/questions/select";
import { numeralsOf } from "../rules/figures";
import { addedNames, asksQuestion, names, withoutSerials, type TitleRuleInputs } from "../rules/title";
import { packStatements, type ContextPack } from "./pack";
import { comparisonTable } from "./table";
import { TEMPLATES } from "../templates";

/** The market as the pack carries it (`sites.market`), read defensively:
 *  `searchTerm` is D49's, on a market concluded since it was built, and
 *  `area` is D67's. */
interface PackMarket {
  searchTerm?: unknown;
  rivals?: unknown;
  area?: { place?: { name?: unknown; region?: unknown } | null } | null;
}

const text = (value: unknown): string[] => (typeof value === "string" && value.trim() !== "" ? [value.trim()] : []);
/** The brand of each domain the pack holds; a missing domain names nothing. */
const brands = (...domains: unknown[]): string[] => domains.flatMap(text).map(brandOf);

/** The page the titles are for: its description, and its sections, whose
 *  counts a title may state ("5 tools compared"). */
export interface TitledPage {
  description: string;
  sections?: readonly { key: string; items?: number }[];
}

/** SPEC §7, nothing invented: an offering page for a list-shaped search
 *  leaves out the search's "best" and "top" words the business's own pages
 *  never state. Every other page is left as it is. */
export function unclaimedSuperlatives(pack: Pick<ContextPack, "type" | "target" | "facts" | "pages">): (line: string) => string {
  if (pack.type !== "offering" || !pack.target.searches.some((search) => SHAPES.listicle.test(search.toLowerCase()))) return (line) => line;
  const own = [...pack.facts.map((fact) => fact.passage), ...pack.pages.flatMap((page) => text(page.title))].join("\n");
  const stated = new Set([...own.matchAll(new RegExp(SHAPES.best.source, "giu"))].map((match) => match[0].toLowerCase()));
  return (line) => {
    const kept = line.replace(new RegExp(`${SHAPES.best.source}\\s*`, "giu"), (match) => (stated.has(match.trim().toLowerCase()) ? match : ""));
    return kept === line ? line : kept.replace(/\s{2,}/g, " ").trim().replace(/^\p{Ll}/u, (first) => first.toUpperCase());
  };
}

/** A title's figure describes the page, so the business's own words count only on the page that sells or refreshes them. */
function evidenceOf(pack: ContextPack): string[] {
  const claims = pack.claims.map((claim) => claim.passage);
  return pack.type === "offering" || pack.type === "update" ? [...pack.facts.map((fact) => fact.passage), ...claims, ...packStatements(pack)] : claims;
}

export function titleRuleFor(pack: ContextPack, page: TitledPage): TitleRuleInputs {
  const market = (pack.business.market ?? {}) as PackMarket;
  const named = Array.isArray(market.rivals) ? market.rivals.flatMap((rival) => text((rival as { name?: unknown } | null)?.name)) : [];
  const domains = brands(...(pack.business.rivals ?? []), ...(pack.products ?? []).map((product) => product?.domain));
  const language = pack.locale?.language ?? "en";
  // The search as it was typed; the target's sentence where the pack holds none.
  const searches = [...text(market.searchTerm), ...pack.target.searches].map(unclaimedSuperlatives(pack));
  // What the page counts out: its options or questions, and its steps.
  const counts = new Map<string, number>();
  for (const section of page.sections ?? []) counts.set(section.key, (counts.get(section.key) ?? 0) + 1);
  const listed = (page.sections ?? []).flatMap((section) => (section.items === undefined ? [] : [section.items]));
  // Issue 1508: what a comparison counts is its table's options, never its
  // baseline.
  const rivalsMin = TEMPLATES[pack.type].blocks.table?.rivals;
  const options = pack.type === "listicle" && rivalsMin !== undefined ? comparisonTable(pack, rivalsMin)?.options.length : undefined;
  // Issue 1552: a search that sets products against each other, or asks for
  // one's alternatives, is answered by the business's own page, so its title
  // names the business, whatever the page's type.
  const products = [...named, ...domains, ...brands(pack.baseline)].filter((name) => name.length > 2);
  const compares = searches.some((search) => SHAPES.comparison.test(search.toLowerCase()) && products.some((product) => names(search, product)));
  const business = [...new Set([...text(pack.business.name), ...brands(pack.business.domain)])].filter((name) => name.length > 2);
  return {
    type: pack.type,
    terms: [...new Set([...searches, pack.target.question])],
    follow: pack.questions,
    asks: (searches.length === 0 ? [pack.target.question] : searches).some((search) => asksQuestion(search, language)),
    // A rival's name is a title's detail only on the page that compares
    // them: anywhere else it is a claim about a rival the title cannot bear out.
    rivals: pack.type === "listicle" ? [...new Set([...named, ...domains])].filter((name) => name.length > 2) : [],
    places: [...text(market.area?.place?.name), ...text(market.area?.place?.region)],
    holds: [
      ...evidenceOf(pack),
      ...pack.target.searches,
      [...counts.values(), ...listed, pack.questions.length, options ?? 0].filter((count) => count > 1).join(" "),
    ].join("\n"),
    year: new Date(pack.builtAt).getUTCFullYear(),
    titles: pack.pages.flatMap((each) => text(each.title)),
    description: page.description,
    ...(pack.locale === undefined ? {} : { language }),
    ...(options === undefined ? {} : { options }),
    ...(compares && business.length > 0 ? { business } : {}),
  };
}

/** The figures the pack states, each with the words around it, so the
 *  writer is shown the specifics a title may carry. A year is not one, and
 *  neither is the number of an episode or an issue. */
function figuresOf(pack: ContextPack): string[] {
  const said = withoutSerials(
    evidenceOf(pack).join("\n"),
    pack.locale?.language ?? "en"
  );
  const seen = new Set<string>();
  const out: string[] = [];
  for (const match of said.matchAll(/(?:[^\s\d]+ ){0,2}[$€£]?\d[\d.,]*\S*(?: [^\s\d]+){0,3}/gu)) {
    const figure = /\d[\d.,]*/.exec(match[0])?.[0].replace(/[.,]+$/, "") ?? "";
    // A lone digit with no currency mark is a list number as often as a fact.
    if (/^(?:19|20)\d\d$/.test(figure) || seen.has(figure) || (figure.length === 1 && !/[$€£%]/.test(match[0]))) continue;
    seen.add(figure);
    out.push(match[0].replace(/[.,;:]+$/, ""));
    if (out.length === TITLE.figuresTold) break;
  }
  return out;
}

/** The figures a title states that are the business's own promise, offer or price: a promise figure is never a
 *  title's specific on a page that does not sell it (owner OR4, 2026-10-31). Empty on an offering page or an update. */
export function promiseFigures(title: string, pack: ContextPack): string[] {
  if (pack.type === "offering" || pack.type === "update") return [];
  const knowledge = pack.profile?.knowledge;
  const own = [
    ...(pack.profile?.promises ?? []),
    ...(knowledge?.offerings ?? []).flatMap((offering) => [offering.name, ...offering.features, ...offering.prices]),
    ...(knowledge?.differentiators ?? []).map((item) => item.text),
  ];
  const figures = (line: string): string[] =>
    numeralsOf(withoutSerials(line, pack.locale?.language ?? "en")).map((numeral) => numeral.normalised).filter((figure) => !/^(?:19|20)\d\d$/.test(figure));
  const promised = new Set(own.flatMap(figures));
  return [...new Set(figures(title))].filter((figure) => promised.has(figure));
}

/** The same reading, as the writer is told it. */
export function titleBrief(pack: ContextPack): Record<string, unknown> {
  const rule = titleRuleFor(pack, { description: "" });
  const dated = (TITLE.yearTypes as readonly string[]).includes(pack.type);
  const words = languagePack(pack.locale?.language ?? "en").title;
  return {
    searches: rule.terms,
    year: dated ? rule.year : null,
    // The rivals and the place that count as the title's specific.
    names: addedNames(rule).slice(0, TITLE.namesTold),
    // Figures `pack` states, as it words them.
    figures: figuresOf(pack),
    rules: [
      `${TITLE.chars.min} to ${TITLE.chars.max} characters, counted, spaces included: write ${TITLE.aim.min} to ${TITLE.aim.max}, which is eight to ten words. A title of ${TITLE.chars.max + 1} or more is thrown away, so make the first of the titles the shortest that holds these rules: the search's own words, then one detail of at most five words, and nothing else.`,
      `One of \`searches\`${rule.follow.length === 0 ? "" : " or of `pack.questions`"}, in the searcher's own words, starts within its first ${TITLE.headChars} characters.`,
      "It carries one specific that `pack` holds: a number, a price or a measured result in the digits `pack` states it in (`figures` lists some), or a count of this page's own options, questions or numbered steps; one of `names`, where it lists any; or an AI engine's name the search does not already carry. A year is not a number, neither is the number of an episode, an issue or a volume, and a question, an award, an adjective or who the page is for is not a specific.",
      rule.asks
        ? "The search is a question, so it may be that question; a statement that answers it is as good."
        : "It is a statement that answers the search, never a question: the search is not one.",
      dated
        ? "It may carry `year`, in brackets or before a colon, never as its last word, and no other year."
        : "It carries no year.",
      `Never ${words.banned.map((phrase) => `"${phrase}"`).join(", ")}, a filler verb or stock phrase like ${words.tropeSamples.map((phrase) => `"${phrase}"`).join(", ")}, two things joined by "and" after "How to", a square bracket, a pipe, or the same word twice.`,
      "It does not read like the title of any page in `pack.pages`.",
      ...(rule.business === undefined ? [] : [`The search compares products and this page is the business's own, so it names the business, as "${rule.business[0]}", beside the products the search names.`]),
    ],
  };
}
