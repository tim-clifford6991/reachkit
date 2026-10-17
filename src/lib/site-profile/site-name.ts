// SPEC.md §2 Rules ("The scan builds the site profile" — "the site name"),
// §12 ruling 8 (2026-09-12) and §2's line of 2026-10-10 (issue 1380).
//
// The company's name: its brand, never its page title's tagline.
//
// **Why this is not the model's job on the free path.** Ruling 8 puts the
// profile in the free scan, and the free pass's inference budget is spent:
// two nano calls already hold half the invocation the platform allows it
// (`FREE_PASS_INFERENCE_CALLS`, `INFERENCE_TIMEOUT_MS`). A site's name is
// not an inference anyway — it is a value the site publishes about itself.
// So it is read, not asked for, and a free scan stores a name like every
// other page fact.
//
// **The sources, in the order a site means them.** `og:site_name`, then
// `application-name`, then the `name` of the Organization or WebSite its
// structured data describes, then the `<title>`. A title is the page's
// name with the brand before or after a separator ("Paddle - Subscriptions,
// Payments & Tax Compliance…", "Pricing | Example Payments"), so every
// source is split at the separators a title template uses and the part
// that spells the domain is the brand. A source that spells the domain
// nowhere is the name only where it is a name — one part, a few words —
// which is how a brand that differs from its domain is still read. Where
// no source holds a name, the domain's own label is it.
//
// **A call to action, a page section or a product category is no name**
// (issue 1384: hotjar.com was "Sign up for free", deel.com "HRIS"). A source
// that spells the domain nowhere and is made only of such words is passed
// over, and the next source is read. A brand unlike its domain ("Alphabet"
// on abc.xyz) is not made of them and is kept.
//
// **The domain's label is written as the site writes it.** Where the name
// falls back to the label, the casing is the site's own wherever it spells
// it — a title, a declared name, an image's `alt` — so "HubSpot", never
// "Hubspot".
//
// **The same rule reads a stored name** (`storedSiteName`), so a row
// written before this rule shows its brand without a re-scan. It is the
// one reader of `site_profiles.site_name` (issue 1479); a raw read anywhere
// else is a lint error.
//
// **A placeholder or a protection's page is no name, from any source**
// (issue 1479): `<UNKNOWN>`, "Just a moment...", "Cloudflare" on a site
// that is not Cloudflare's. It is passed over like a call to action.
//
// Deterministic and total: any string answers, and a document that names
// itself nowhere answers `null` rather than a guess.
import { domainToUnicode } from "node:url";
import { parse } from "node-html-parser";
import { parse as pslParse } from "psl";
import { isProtectionName } from "@/lib/measure/challenge";
import { isPlaceholder } from "@/lib/measure/placeholder";

/** What a title template puts between a page and a brand: a spaced
 *  hyphen or dash, a middot or bullet, a pipe, a colon before a space.
 *  An unspaced hyphen is not one: "Pay-as-you-go invoicing" is one phrase. */
const SEPARATOR_RE = /\s[-–—·•]\s|\s*[|｜]\s*|[:：]\s/u;

/** A name is a few words. More is a sentence about the company. */
const NAME_MAX_WORDS = 4;
const NAME_MAX_CHARS = 40;

/** The structured-data types whose `name` is the company's or the site's. */
const NAMED_TYPES = new Set(["Organization", "Corporation", "LocalBusiness", "OnlineBusiness", "WebSite"]);

/** The words a call to action, a page section or a product category is
 *  made of, in the two languages the product is sold in. A candidate made
 *  only of these, spelling its domain nowhere, names no company. */
const GENERIC_WORDS: ReadonlySet<string> = new Set(
  (
    // Calls to action.
    "sign up signup log login in signin register join get started start try free now today here book request " +
    "demo trial contact us subscribe buy shop download learn more see watch apply order call click create account " +
    "a an the to for it your my our and or of " +
    // Page sections.
    "home homepage welcome pricing prices plans about blog news careers jobs product products services solutions " +
    "features support help docs documentation resources overview index main page site website official dashboard " +
    "store faq menu untitled " +
    // Product categories.
    "software platform tool tools app apps online service system management business solution suite company " +
    "agency hris hr crm erp cms saas ats lms pos cdp seo ai api b2b payroll analytics marketing sales ecommerce " +
    // The same, in German.
    "startseite willkommen herzlich anmelden einloggen registrieren kostenlos testen jetzt starten loslegen " +
    "buchen preise über uns kontakt mehr erfahren hier bei und für die der das lösungen produkte leistungen " +
    "unternehmen karriere aktuelles impressum"
  ).split(" "),
);

/** What a title wraps its brand in: "Official Hotjar Site", "Welcome to …". */
const FRAME_WORDS: ReadonlySet<string> = new Set(["official", "site", "website", "homepage", "home", "page", "welcome", "to"]);

function oneLine(value: string): string {
  // A trademark sign is not part of a name: "ClickUp™".
  return value.replace(/[™®©℠]/gu, "").replace(/\s+/g, " ").trim();
}

function wordsOf(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

/** Whether a phrase is a call to action, a section or a category: "Sign
 *  up for free", "Pricing", "HRIS". */
function generic(phrase: string): boolean {
  const words = wordsOf(phrase);
  return words.length > 0 && words.every((word) => GENERIC_WORDS.has(word));
}

function letters(text: string): string {
  return (text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/ß/g, "ss").match(/[\p{L}\p{N}]+/gu) ?? []).join("");
}

/** A text as a domain may spell it: accents dropped ("café" → "cafe"), and
 *  the German way ("bäckerei" → "baeckerei"). */
function spellings(text: string): readonly string[] {
  const german = text.replace(/[äöü]/giu, (vowel) => `${vowel.normalize("NFKD")[0]}e`);
  return [...new Set([letters(text), letters(german)])].filter((spelling) => spelling !== "");
}

/** The domain's own label, as written: "paddle" of `www.paddle.com`,
 *  "bäckerei-müller" of its punycode. */
function labelOf(domain: string): string {
  const host = domain.trim().toLowerCase().replace(/^www\./, "");
  const parsed = pslParse(host);
  const label = ("error" in parsed ? null : parsed.sld) ?? host.split(".")[0] ?? "";
  return domainToUnicode(label) || label;
}

/** The domain's brand where the site publishes none: its label, each word
 *  capitalised. */
export function domainBrand(domain: string): string | null {
  const words = labelOf(domain).split("-").filter((word) => word !== "");
  return words.length === 0 ? null : words.map((word) => word[0]!.toLocaleUpperCase() + word.slice(1)).join(" ");
}

function nameLike(text: string): boolean {
  return text.length <= NAME_MAX_CHARS && text.split(" ").length <= NAME_MAX_WORDS;
}

/** How well a part spells the domain; lower is closer, `null` is not at all. */
function closeness(part: string, label: string): number | null {
  const spelled = spellings(part);
  if (spelled.includes(label)) return 0;
  if (label.length >= 3 && spelled.some((spelling) => spelling.includes(label))) return 1;
  const initials = part.split(" ").map((word) => letters(word)[0] ?? "").join("");
  if (label.length >= 2 && initials === label) return 2;
  // "Zuni" of zunicafe.com — but never "Home" of homedepot.com.
  if (spelled.some((spelling) => spelling.length >= 3 && spelling.length * 2 >= label.length && label.includes(spelling))) return 3;
  return null;
}

/** The words of a sentence that spell the domain, as the sentence writes
 *  them: "Paddle" of "Paddle is the merchant of record for SaaS". */
function writtenBrand(sentence: string, label: string): string | null {
  const words = sentence.split(" ");
  for (let from = 0; from < words.length; from += 1) {
    for (let to = from + 1; to <= Math.min(words.length, from + NAME_MAX_WORDS); to += 1) {
      const run = words.slice(from, to).join(" ");
      if (spellings(run).includes(label)) return run.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    }
  }
  return null;
}

/** The brand one source holds, or `null` where it holds none. */
function nameIn(source: string, label: string): string | null {
  const parts = oneLine(source).split(SEPARATOR_RE).map((part) => part.trim()).filter((part) => part !== "");
  let best: { part: string; rank: number } | null = null;
  for (const part of parts) {
    const rank = closeness(part, label);
    if (rank === null) continue;
    if (best === null || rank < best.rank || (rank === best.rank && part.length < best.part.length)) best = { part, rank };
  }
  if (best !== null) {
    if (!nameLike(best.part)) return writtenBrand(best.part, label);
    // "Official Hotjar Site" is "Hotjar".
    const exact = best.rank === 0 ? null : writtenBrand(best.part, label);
    const framed = exact !== null && wordsOf(best.part.replace(exact, "")).every((word) => FRAME_WORDS.has(word));
    return framed ? exact : best.part;
  }
  // No part spells the domain: a lone name is a brand that differs from
  // it; a tagline, a page's name, a call to action or a category is not.
  const only = parts.length === 1 ? parts[0] : undefined;
  return only !== undefined && nameLike(only) && !generic(only) ? only : null;
}

/** The domain's label as the site itself writes it, capitals and all:
 *  "HubSpot" of "HubSpot | Software & Tools for your Business". */
function asWritten(texts: readonly string[], label: string, plain: string | null): string | null {
  for (const text of texts) {
    const written = writtenBrand(text, label);
    if (written !== null && written !== written.toLowerCase() && written !== plain) return written;
  }
  return null;
}

/**
 * The company's brand out of the names it goes by, first to last: the
 * first that holds a name, else the domain's own label. `null` where there
 * is no name to read at all.
 *
 * `mentions` are other texts of the site's (page titles, image `alt`s):
 * never a name themselves, only how the site cases its domain's label
 * where the name is that label.
 *
 * Also how a stored name is shown: `brandName([stored], domain, [title])`.
 */
export function brandName(
  sources: readonly (string | null | undefined)[],
  domain: string,
  mentions: readonly (string | null | undefined)[] = [],
): string | null {
  const lines = (texts: readonly (string | null | undefined)[]) =>
    texts.map((text) => oneLine(text ?? "")).filter((text) => text !== "" && !noName(text, domain));
  const written = lines(sources);
  if (written.length === 0) return null;
  const label = letters(labelOf(domain));
  const plain = domainBrand(domain);
  for (const source of written) {
    const name = nameIn(source, label);
    if (name === null || name === "") continue;
    if (name !== plain) return name;
    break;
  }
  return asWritten([...written, ...lines(mentions)], label, plain) ?? plain;
}

/** A text that stands for no name: a placeholder or the name a
 *  protection's page gives the site it stands in front of. */
function noName(text: string, domain: string): boolean {
  return isPlaceholder(text) || isProtectionName(text, domain);
}

/**
 * The name a stored `site_profiles` row gives its site, read by the rule
 * above with the row's stored home title as how the site cases it. The one
 * reader of the column: the gallery, Settings, the prompts, the AI answers
 * read for the site, the re-score and the hosted blog all ask it. `null`
 * where the row stores no name at all.
 */
export function storedSiteName(row: { domain: string; site_name: string | null }, homeTitle?: string | null): string | null {
  return brandName([row.site_name], row.domain, [homeTitle]);
}

/**
 * The name the re-score writes over a stored one (issue 1479): the name the
 * row reads as, where the column still holds something else — a whole page
 * title, a call to action, a placeholder or a protection page's name.
 * `null` where the stored name already reads as itself.
 */
export function rewrittenSiteName(
  row: { domain: string; site_name: string | null },
  homeTitle?: string | null,
): { from: string; to: string | null } | null {
  if (row.site_name === null) return null;
  const to = storedSiteName(row, homeTitle);
  return to === row.site_name ? null : { from: row.site_name, to };
}

function schemaNames(node: unknown, found: string[]): void {
  if (Array.isArray(node)) {
    for (const item of node) schemaNames(item, found);
    return;
  }
  if (typeof node !== "object" || node === null) return;
  const { "@type": type, name, ...rest } = node as Record<string, unknown>;
  const types = Array.isArray(type) ? type : [type];
  if (typeof name === "string" && types.some((t) => typeof t === "string" && NAMED_TYPES.has(t))) found.push(name);
  for (const value of Object.values(rest)) schemaNames(value, found);
}

/** The `alt` of every image in a home document: where a logo spells the
 *  brand. Mentions for `brandName`, never names. */
export function imageAlts(html: string): string[] {
  if (html.trim() === "") return [];
  return parse(html, { comment: false })
    .querySelectorAll("img[alt]")
    .map((image) => image.getAttribute("alt") ?? "")
    .filter((alt) => alt.trim() !== "");
}

/** Every name a home document gives its site, in the order above. */
export function publishedNames(html: string): string[] {
  if (html.trim() === "") return [];
  const root = parse(html, { comment: false });
  const meta = (selector: string) => root.querySelectorAll(selector).map((element) => element.getAttribute("content") ?? "");
  const schema: string[] = [];
  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      schemaNames(JSON.parse(script.rawText), schema);
    } catch {
      // A schema that is not JSON says nothing.
    }
  }
  return [
    ...meta('meta[property="og:site_name"], meta[name="og:site_name"]'),
    ...meta('meta[name="application-name"]'),
    ...schema,
    root.querySelector("title")?.text ?? "",
  ];
}
