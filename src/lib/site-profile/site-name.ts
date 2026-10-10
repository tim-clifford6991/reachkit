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
// **The same rule reads a stored name** (`brandName([stored], domain)`), so
// a row written before this rule shows its brand without a re-scan.
//
// Deterministic and total: any string answers, and a document that names
// itself nowhere answers `null` rather than a guess.
import { domainToUnicode } from "node:url";
import { parse } from "node-html-parser";
import { parse as pslParse } from "psl";

/** What a title template puts between a page and a brand: a spaced
 *  hyphen or dash, a middot or bullet, a pipe, a colon before a space.
 *  An unspaced hyphen is not one: "Pay-as-you-go invoicing" is one phrase. */
const SEPARATOR_RE = /\s[-–—·•]\s|\s*[|｜]\s*|[:：]\s/u;

/** A name is a few words. More is a sentence about the company. */
const NAME_MAX_WORDS = 4;
const NAME_MAX_CHARS = 40;

/** The structured-data types whose `name` is the company's or the site's. */
const NAMED_TYPES = new Set(["Organization", "Corporation", "LocalBusiness", "OnlineBusiness", "WebSite"]);

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
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
  if (best !== null) return nameLike(best.part) ? best.part : writtenBrand(best.part, label);
  // No part spells the domain: a lone name is a brand that differs from
  // it; a tagline or a page's name is not.
  const only = parts.length === 1 ? parts[0] : undefined;
  return only !== undefined && nameLike(only) ? only : null;
}

/**
 * The company's brand out of the names it goes by, first to last: the
 * first that holds a name, else the domain's own label. `null` where there
 * is no name to read at all.
 *
 * Also how a stored name is shown: `brandName([stored], domain)`.
 */
export function brandName(sources: readonly (string | null | undefined)[], domain: string): string | null {
  const written = sources.map((source) => oneLine(source ?? "")).filter((source) => source !== "");
  if (written.length === 0) return null;
  const label = letters(labelOf(domain));
  for (const source of written) {
    const name = nameIn(source, label);
    if (name !== null && name !== "") return name;
  }
  return domainBrand(domain);
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
