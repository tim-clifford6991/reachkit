// src/lib/locale/serving.ts — what a site says of where it *sells*, apart
// from where it *is* (SPEC §6, issue 1370; builds on D67, issue 1318).
//
// clearleft.com, a design consultancy with one office in Brighton and
// clients across the country, was stored as serving Brighton: its searches,
// rivals and prompts were held to one town. An address says where a
// business is. This reads whether the site's own evidence says it serves
// that place, and names the evidence; with none, the business has no
// serving area, whatever the market call answered.
//
// Pure: it reads the text it is handed. No fetch, no model call, no clock.
import type { Place } from "./locales";
import { folded, namesPlace, type PlaceSignals, type ServingEvidence } from "./place";

/** One page of the site, as the crawl read it. */
export interface ServingPage {
  url: string;
  title: string;
  h1?: string;
  text: string;
}

/** Pages that say where the business is, or that write about anything: a
 *  contact page names the office's town, and an article names any town. */
const NOT_A_SERVICE_PAGE =
  /\/(contact|kontakt|about|ueber-uns|uber-uns|team|people|careers?|jobs?|karriere|locations?|find-us|anfahrt|standorte?|impressum|imprint|privacy|datenschutz|terms|legal|blog|news|posts?|articles?|insights?|journal|thinking|stories|events?|podcasts?|press|case-stud(?:y|ies)|work|projects?|portfolio|referenzen)(\/|$|\?|\.)/i;

/** Words of a market's name that name no service. */
const GENERIC = new Set(
  "service services company companies business businesses local best near online professional solutions solution and for the with your our top und der die das fur dienstleistungen firma unternehmen".split(" ")
);

/** The words between a verb of serving and the place it serves that turn
 *  the sentence into one about where the business is ("serving clients
 *  worldwide from our Brighton studio"). */
const FROM_THERE = new Set(["from", "based", "by", "aus", "worldwide", "nationwide", "globally", "internationally"]);

const SERVING_VERB = new Set(["serving", "serve", "serves", "covering", "covers", "beliefern", "beliefert"]);
const SERVED = new Set(["customers", "clients", "patients", "homes", "homeowners", "businesses", "households", "kunden", "haushalte"]);
const ACROSS = new Set(["in", "across", "throughout", "around"]);
const IN = new Set(["in", "im"]);
/** "based in {place}": where the business is. */
const IS_THERE = new Set(["based", "located", "headquartered", "office", "offices", "ansassig", "sitz"]);
/** "our studio in {place}": likewise. */
const OURS = new Set(["our", "unser", "unsere", "unserem", "unserer"]);

function tokens(value: string): string[] {
  const said = folded(value);
  return said === "" ? [] : said.split(" ");
}

/** The words a market is named in, as roots a page's words are held to. */
function serviceRoots(service: readonly string[]): string[] {
  const out = new Set<string>();
  for (const name of service) for (const word of tokens(name)) if (word.length >= 3 && !GENERIC.has(word)) out.add(word);
  return [...out];
}

/** The word each of those names ends on, which says what the business is:
 *  "agency" of "UX design agency", "plumber" of "emergency plumber". The
 *  words before it ("digital", "design") describe many things in a town. */
function serviceHeads(service: readonly string[]): string[] {
  const out = new Set<string>();
  for (const name of service) {
    const head = tokens(name).filter((word) => word.length >= 3 && !GENERIC.has(word)).at(-1);
    if (head !== undefined) out.add(head);
  }
  return [...out];
}

/** Whether a page's word is one of the market's: "plumbing" for "plumber",
 *  "accountancy" for "accountants", "dental" for "dentist". */
function isService(word: string, roots: readonly string[]): boolean {
  if (GENERIC.has(word)) return false;
  return roots.some((root) => {
    if (root.length < 4 || word.length < 4) return root === word;
    let shared = 0;
    while (shared < root.length && shared < word.length && root[shared] === word[shared]) shared += 1;
    return shared >= 4 && shared >= Math.min(root.length, word.length) - 3;
  });
}

/** The place's spellings, each as the words it is written in; and as a
 *  German adjective ("Düsseldorfer"). */
function placeForms(place: Place): string[][] {
  const written = folded(place.name.replace(/ä/gi, "ae").replace(/ö/gi, "oe").replace(/ü/gi, "ue"));
  return [...new Set([folded(place.name), written])].filter((form) => form.length >= 2).map((form) => form.split(" "));
}

/** Where each naming of the place starts and ends in a page's words. One
 *  that says where the business is ("based in Brighton", "our studio in
 *  Brighton") is no naming of where it sells, and is left out. */
function sightings(words: readonly string[], forms: readonly string[][]): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = [];
  for (const form of forms) {
    for (let at = 0; at + form.length <= words.length; at += 1) {
      const last = at + form.length - 1;
      const fits = form.every((part, i) => words[at + i] === part || (i === form.length - 1 && words[at + i] === `${part}er`));
      if (!fits || out.some((held) => held.from === at)) continue;
      const where = IN.has(words[at - 1] ?? "") && (IS_THERE.has(words[at - 2] ?? "") || OURS.has(words[at - 3] ?? ""));
      if (!where) out.push({ from: at, to: last });
    }
  }
  return out;
}

/** Whether the words say the service with the place: "accountants in
 *  Manchester", "North Leeds electrician", "Düsseldorfer Bäckerei",
 *  "serving our neighbors here in Austin", "customers across Leeds" —
 *  and never "a consultancy based in Brighton" or an address. */
function saysServiceThere(words: readonly string[], forms: readonly string[][], heads: readonly string[]): boolean {
  for (const { from, to } of sightings(words, forms)) {
    // "{place} {service}", past a possessive's "s" and one describing word
    // ("Austin first plumbing").
    const after = words[to + 1] === "s" ? to + 2 : to + 1;
    if (isService(words[after] ?? "", heads)) return true;
    if (!FROM_THERE.has(words[after] ?? "") && isService(words[after + 1] ?? "", heads)) return true;
    // "{service} in {place}", "{service} here in {place}".
    const before = IN.has(words[from - 1] ?? "") ? from - 2 : -1;
    const service = words[before] === "here" || words[before] === "hier" ? before - 1 : before;
    if (service >= 0 && isService(words[service]!, heads)) return true;
    // "{customers} across {place}".
    if (ACROSS.has(words[from - 1] ?? "") && SERVED.has(words[from - 2] ?? "")) return true;
    // "serving … {place}", within six words and not from somewhere.
    for (let back = 1; back <= 6 && from - back >= 0; back += 1) {
      const word = words[from - back]!;
      if (FROM_THERE.has(word)) break;
      if (SERVING_VERB.has(word)) return true;
    }
  }
  return false;
}

function pathOf(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname);
  } catch {
    return url;
  }
}

/**
 * What says the business serves `place`, or `null` where nothing does
 * (issue 1370). In order: its structured data lists the place among the
 * areas it serves; a page of its own is titled or addressed by the service
 * and the place; a page says the service with the place; Google shows it
 * in a local pack; or its kind is carried out in person and the site names
 * the place at all. A town that is only in an address, on a contact page
 * or in an article is where the business is, and is no evidence.
 */
export function servingEvidence(a: {
  place: Place;
  /** What the home page's structured data states (D67). */
  stated?: PlaceSignals;
  pages: readonly ServingPage[];
  /** The names the market is searched under: its category and synonyms. */
  service: readonly string[];
  /** Whether a measured search showed the site in Google's local pack. */
  localPack: boolean;
  /** Whether a business of this kind is carried out in person, so it
   *  serves where it is (`BUSINESS_KINDS[kind].inPerson`). */
  inPerson: boolean;
}): ServingEvidence | null {
  if ((a.stated?.serves ?? []).some((area) => namesPlace(area, a.place))) return "area_served";

  const forms = placeForms(a.place);
  const roots = serviceRoots(a.service);
  const heads = serviceHeads(a.service);
  const pages = a.pages.filter((page) => !NOT_A_SERVICE_PAGE.test(pathOf(page.url)));
  // What a page is headed by: its title, its first heading and its address;
  // and the home page's own description of the business.
  const headings = [
    ...pages.flatMap((page) => [tokens(page.title), tokens(page.h1 ?? ""), tokens(pathOf(page.url))]),
    tokens(a.stated?.description ?? ""),
  ];
  if (headings.some((words) => sightings(words, forms).length > 0 && words.some((word) => isService(word, roots)))) return "service_page";
  if (pages.some((page) => saysServiceThere(tokens(page.text), forms, heads))) return "service_wording";
  if (a.localPack) return "local_pack";

  const named =
    (a.stated?.locality !== undefined && namesPlace(a.stated.locality, a.place)) ||
    a.pages.some((page) => sightings(tokens(`${page.title} ${page.text}`), forms).length > 0);
  return a.inPerson && named ? "in_person" : null;
}
