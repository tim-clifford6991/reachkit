// SPEC §7 (owner, D51, issue 1266; revised by issue 1389) — what a page's
// title is held to, read off its context pack.
//
// The writer is told it (`./write.ts`), code picks among the titles the
// writer proposes by it, and stage 4 checks it (`../rules/title.ts`) — from
// this one reading, so the title a writer is asked for, the title code picks
// and the title the check passes are one description.
import { SHAPES } from "@/lib/locale/language";
import { TITLE } from "@/lib/config/constants";
import { brandOf } from "@/lib/market/questions/select";
import { briefLinesOf } from "../rules/brief-lines";
import { topicWords } from "../rules/gaps";
import { namedRivals } from "../rules/rivals";
import { numeralsOf } from "../rules/figures";
import { addedNames, asksQuestion, closestTitle, countedIn, names, pickTitle, withoutSerials, type TitleRuleInputs } from "../rules/title";
import { undatedTimely } from "./claims";
import { ownCapitals, recased } from "./compose";
import { packStatements, type ContextPack } from "./pack";
import { comparisonTable } from "./table";
import { TEMPLATES } from "../templates";
import { pageTitle } from "@/lib/presentation/page-title";

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

/** A claim about a rival: off its own page, about it or of one plan; off a comparison, also one naming it or stating a price. */
function rivals(pack: ContextPack): (claim: ContextPack["claims"][number]) => boolean {
  const named = namedRivals(pack.business.rivals ?? [], pack.business.market).flatMap((rival) => [...text(rival.name), brandOf(rival.domain)]).filter((name) => name.length > 2);
  const priced = pack.type !== "listicle";
  return (claim) =>
    claim.product !== undefined || claim.about !== undefined || (claim.plan ?? null) !== null || claim.kind.startsWith("rival_") ||
    (priced && (named.some((name) => names(claim.passage, name)) || /[$€£¥]/.test(claim.passage) || SHAPES.price.test(claim.passage.toLowerCase())));
}

/** A title's figure describes the page, so the business's own words count only on the page that sells or refreshes them. */
function evidenceOf(pack: ContextPack): string[] {
  // A rival's plan or price line is the rival's, never this page's specific; nor is a figure nobody can date.
  const rival = rivals(pack);
  const claims = pack.claims.filter((claim) => !rival(claim) && claim.secondHand !== true && !undatedTimely(claim)).map((claim) => claim.passage);
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
  // Every market rival on every page type: a figure beside a name is that owner's own.
  const ownPassages = (domain: string): string => pack.claims.filter((claim) => claim.product === domain).map((claim) => claim.passage).join("\n");
  const rivalOwners = namedRivals(pack.business.rivals ?? [], pack.business.market).map((rival) => ({ names: [...text(rival.name), brandOf(rival.domain)].filter((name) => name.length > 2), holds: ownPassages(rival.domain) }));
  const pageCounts = [...counts.values(), ...listed, pack.questions.length, options ?? 0].filter((count) => count > 1).join(" ");
  // A count leads a title only as the top results' titles do, two of their first five, and only as the page's questions or steps.
  const serp = [...new Set(pack.claims.filter((claim) => claim.kind === "top_result").map((claim) => claim.title))].slice(0, 5);
  const sectionCounts = serp.filter((title) => countedIn(title) !== null).length >= 2 ? [counts.get("question") ?? 0, counts.get("steps") ?? 0, ...listed] : [];
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
      pageCounts,
    ].join("\n"),
    year: new Date(pack.builtAt).getUTCFullYear(),
    titles: pack.pages.flatMap((each) => text(each.title)),
    ...(pack.target.promise === undefined ? {} : { promise: pack.target.promise }),
    description: page.description,
    ...(pack.locale === undefined ? {} : { language }),
    ...(options === undefined ? { counts: sectionCounts.filter((count) => count > 1) } : { options }),
    ...(compares && business.length > 0 ? { business } : {}),
    owners: { rivals: rivalOwners, business: { names: business, holds: [...pack.facts.map((fact) => fact.passage), ...packStatements(pack), ownPassages(pack.business.domain)].join("\n") }, page: pageCounts },
  };
}

/** A search as typed, sentence-cased, each word as the pack's names spell it, or as its passages write it only in
 *  capitals they own ("AI", "ChatGPT", "GmbH"): a word only capitalised to open a sentence is left as typed. */
function casedAsPack(term: string, pack: ContextPack, rule: TitleRuleInputs): string {
  const names = [...(rule.owners?.rivals ?? []), ...(rule.owners === undefined ? [] : [rule.owners.business])].flatMap((owner) => owner.names);
  const named = [...names.join(" ").matchAll(/[\p{L}\p{N}]+/gu)].map(([word]) => word).filter((word) => /\p{Lu}/u.test(word));
  const cased = new Map([...ownCapitals([...pack.facts, ...pack.claims].map((each) => each.passage).concat(packStatements(pack))), ...named.reverse().map((word) => [word.toLowerCase(), word] as const)]);
  return recased(term.trim(), cased).replace(/^\p{Ll}/u, (first) => first.toUpperCase());
}

/** The title code builds at 0¢, picked only where every writer title stops the page: the first of the searches that
 *  fits a title's length and reads unlike the site's titles, cased as the pack cases it, with the year on a type that
 *  carries one. `null` where none does. */
export function floorTitle(pack: ContextPack): string | null {
  const rule = titleRuleFor(pack, { description: "" });
  const dated = (TITLE.yearTypes as readonly string[]).includes(pack.type);
  const titles = rule.terms.map((term) => (dated ? `${casedAsPack(term, pack, rule)} (${rule.year})` : casedAsPack(term, pack, rule)));
  return titles.find((title) => [...title].length >= TITLE.chars.min && [...title].length <= TITLE.chars.max && closestTitle(title, rule.titles) === null) ?? null;
}

/** The pick, on the writer's titles and the floor as the reader sees them: cased first, so the rules judge that text and the row stores it. */
export function pickCased(pack: ContextPack, proposed: readonly string[], page: TitledPage): ReturnType<typeof pickTitle> {
  const cased = (title: string): string => pageTitle(title, pack.locale?.language);
  const floor = floorTitle(pack);
  return pickTitle(proposed.map(cased), titleRuleFor(pack, page), floor === null ? null : cased(floor));
}

/** The whole passages a title's clause may be built on, word for word, each stating a figure, a year or a serial aside:
 *  the most topic words shared with the target first, then the pack's own on-topic, newest-first order. */
function figuresOf(pack: ContextPack): string[] {
  const language = pack.locale?.language ?? "en";
  const target = topicWords([pack.target.question, ...pack.target.searches].join(" "));
  const shared = (passage: string): number => [...topicWords(passage)].filter((word) => target.has(word)).length;
  const stating = evidenceOf(pack).filter((passage) => numeralsOf(withoutSerials(passage, language)).some((each) => !/^(?:19|20)\d\d$/.test(each.normalised)));
  return [...new Set(stating)].sort((left, right) => shared(right) - shared(left)).slice(0, TITLE.figuresTold);
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

/** The same reading, as the writer is told it. A figure or a name is offered only where the search with it passes
 *  the very check stage 4 holds the title to, and those titles and the floor are handed over as already passing. */
export function titleBrief(pack: ContextPack): Record<string, unknown> {
  const rule = titleRuleFor(pack, { description: "" });
  const dated = (TITLE.yearTypes as readonly string[]).includes(pack.type);
  const titled = (specific: string): string => `${casedAsPack(rule.terms[0] ?? "", pack, rule)}: ${specific}`;
  const passes = (specific: string): boolean => pickTitle([titled(specific)], rule).candidates[0]?.faults.length === 0 && promiseFigures(titled(specific), pack).length === 0;
  const names = addedNames(rule).filter(passes).slice(0, TITLE.namesTold);
  const floor = floorTitle(pack);
  // The topic's angle, offered where its words stop nothing; a search with a figure appended is never built here.
  const angle = pack.target.searches.includes(pack.target.question) ? [] : [pack.target.question].filter((title) => pickTitle([title], rule).candidates[0]?.faults.every((fault) => fault === "specific"));
  return {
    searches: rule.terms,
    year: dated ? rule.year : null,
    // The rivals and the place that count as the title's specific.
    names,
    // Whole sentences `pack` states a figure in, never the business's promise off the page that sells it.
    figures: figuresOf(pack).filter((sentence) => promiseFigures(sentence, pack).length === 0),
    // Titles code checked against every rule below.
    titles: [...angle, ...(floor === null ? [] : [floor])],
    // Issue 2378: the title rule's lines, from the one list every prompt renders.
    rules: briefLinesOf("title", { pack, template: TEMPLATES[pack.type], pageType: null, titleRule: rule }),
  };
}
