// SPEC §6 (2026-10-07, issue 1314) — a search nobody would type as it
// stands is never measured and never planned, in any market.
//
// The customer panel's passes measured and planned searches that are not
// searches: "best bakery near me near me", "chartered accountant vs",
// "temporarytattoos.com alternatives" and "abcplumbingaustin alternatives".
// The first two came from the vendor's own keyword lists, with volume; the
// last two were built here, from a rival's domain where its name belonged.
// Four shapes, and none of them reads a market's words:
//
//   * a phrase said twice ("near me near me");
//   * a comparison with nothing on one side ("chartered accountant vs");
//   * a web address ("temporarytattoos.com alternatives") — whoever types
//     one is going to that site;
//   * a rival called by its domain's label where that is no word of its
//     name ("abcplumbingaustin" for ABC Home & Commercial Services).
//
// Pure: no context, no clock, no I/O, and no import — the setup screen
// reaches the selection that reads this, in the browser.

export type Malformed = "repeated_phrase" | "empty_comparison" | "web_address" | "domain_for_name";

/** A rival as these rules read it. */
export interface NamedRival {
  name: string;
  domain: string;
  searchNames?: readonly string[];
}

/** Lower case, accents kept, punctuation to spaces. */
function wordsOf(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

/** A name as its letters alone, accents folded: what a domain spells. */
export function lettersOf(text: string): string {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/ß/g, "ss").replace(/[^\p{L}\p{N}]+/gu, "");
}

const DANGLING = /^(?:vs|versus)\b|\b(?:vs|versus|or|and|than|compared to|alternatives? to|instead of)$/;

/** A phrase of two words or more said again straight after itself: "near
 *  me near me". One word said over is not judged — a name may be ("bora
 *  bora") — and neither is a phrase both sides of a comparison share
 *  ("plumber near me vs electrician near me"). */
function saysAPhraseTwice(words: readonly string[]): boolean {
  for (let size = 2; size * 2 <= words.length; size++) {
    for (let i = 0; i + size * 2 <= words.length; i++) {
      const again = words.slice(i, i + size).every((word, k) => word === words[i + size + k]);
      if (again && new Set(words.slice(i, i + size)).size > 1) return true;
    }
  }
  return false;
}

/** The endings a site's address most often has: the generic ones, and the
 *  countries a site's buyers are most often in. A closed list, so it
 *  under-reports: an address under an ending not here is left alone. */
const ADDRESS_ENDING =
  /\.(?:com|net|org|io|co|ai|app|dev|info|biz|shop|store|online|site|tech|xyz|me|tv|eu|us|uk|de|fr|es|it|nl|ca|au|ch|at|se|no|dk|ie|be|pl|in|jp|br|mx|nz|za)$/;
/** A name before the ending shorter than this is as often a technology as
 *  a site ("asp.net", "vb.net"), and is left alone. */
const ADDRESS_MIN_LABEL = 4;

/** The token as a web address's parts, or `null` where it is not one. */
function addressOf(token: string): { label: string } | null {
  const bare = token.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").replace(/^www\./, "");
  if (!/^[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+$/u.test(bare) || !ADDRESS_ENDING.test(bare)) return null;
  const label = bare.split(".")[0] ?? "";
  return label.length >= ADDRESS_MIN_LABEL ? { label } : null;
}

/** Whether a word of the search is a web address ("acme.com",
 *  "acme.co.uk"). "node.js" is not one. */
function holdsAnAddress(search: string): boolean {
  return search.split(/\s+/).some((token) => addressOf(token) !== null);
}

/**
 * Whether a domain's label is a word a buyer says of the rival: a word of
 * its name, or of a name it is searched under ("calendly", "peec" for Peec
 * AI, "mazars" for Forvis Mazars). A label that closes several words up
 * ("radiantplumbing", "abcplumbingaustin"), or adds to the name
 * ("tryprofound"), is the address and not the name.
 */
export function labelSaysName(rival: NamedRival): boolean {
  const label = lettersOf(rival.domain.replace(/^www\./, "").split(".")[0] ?? "");
  if (label === "") return true;
  return [rival.name, ...(rival.searchNames ?? [])].some((name) => wordsOf(name).map(lettersOf).includes(label));
}

/** Why a search is not one, or `null` where it is. */
export function malformedSearch(search: string, rivals: readonly NamedRival[] = []): Malformed | null {
  const words = wordsOf(search);
  if (saysAPhraseTwice(words)) return "repeated_phrase";
  if (DANGLING.test(words.join(" "))) return "empty_comparison";
  if (holdsAnAddress(search)) return "web_address";
  const said = new Set(words.map(lettersOf));
  for (const rival of rivals) {
    const label = lettersOf(rival.domain.replace(/^www\./, "").split(".")[0] ?? "");
    if (label.length >= 4 && said.has(label) && !labelSaysName(rival)) return "domain_for_name";
  }
  return null;
}

/** A word a long name is cut at: what follows adds to the name and is not
 *  how a buyer says it ("Radiant Plumbing & Air Conditioning"). */
const NAME_JOINER = /\s+(?:&|\+|and|und|et|-|–|—|\||:)\s+|,\s+/;
const NAME_MAX_WORDS = 4;

/**
 * A rival as a search names it (D50): its name in lower case, with its
 * accents. Never its domain: a name that is a web address is said without
 * its ending ("monday" for monday.com), and a name too long to type is the
 * short name buyers search it under, else its leading words.
 */
export function comparisonName(rival: NamedRival): string {
  const spelt = (text: string): string => text.toLowerCase().replace(/\s+/g, " ").trim().replace(/[.?!]+$/, "");
  let name = spelt(rival.name);
  if (!name.includes(" ")) name = addressOf(name)?.label ?? name;
  const count = (text: string): number => text.split(" ").length;
  if (name !== "" && count(name) <= NAME_MAX_WORDS) return name;
  const typed = (rival.searchNames ?? []).map(spelt).find((said) => said !== "" && count(said) <= NAME_MAX_WORDS && !holdsAnAddress(said));
  if (typed !== undefined) return typed;
  const lead = name.split(NAME_JOINER)[0] ?? name;
  return (count(lead) >= 2 ? lead : name).split(" ").slice(0, NAME_MAX_WORDS).join(" ");
}
