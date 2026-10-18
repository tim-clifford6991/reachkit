// SPEC §7 (2026-10-10, issue 1391) — "Descriptive link text".
//
// What a link's words must be: a name for what the reader finds at the
// other end. Never a bare number, an address, "click here", or the target
// page's slogan. Pure, and the one place that decides it — the selection
// names a page with `pageName`, `apply.ts` holds a finished body to
// `linkTextProblem`, and the numeral repair widens with `widenNumberLinks`.
//
// **A page is named by its address first.** A site's `<title>` and `<h1>`
// are often a slogan ("One plan. One page a day."); its path is what the
// page is (`/pricing`). So the name is the heading or title segment that
// shares a word with the path, and where none does it is the path's last
// segment written as words. No word here is ours and no language is
// assumed: every word comes off the customer's own page or its address.

/** Words that say a link is there and nothing about where it leads. Short
 *  on purpose, in the languages the panel's sites are written in. */
const GENERIC = new Set([
  "click here",
  "here",
  "read more",
  "learn more",
  "more",
  "link",
  "this link",
  "this page",
  "this article",
  "source",
  "website",
  "hier",
  "hier klicken",
  "mehr erfahren",
  "ici",
  "cliquez ici",
  "en savoir plus",
  "aquí",
  "leer más",
  "qui",
  "aqui",
  "saiba mais",
]);

const BARE_NUMBER_RE = /^[\d\s.,]+%?$/;
const ADDRESS_RE = /^(https?:\/\/|www\.)\S+$/i;

export type LinkTextProblem = "empty" | "number" | "address" | "generic";

function squash(text: string): string {
  return text.replace(/[*_`]/g, "").replace(/\s+/g, " ").trim();
}

/** Why these words cannot stand as a link's text, or `null` where they can. */
export function linkTextProblem(label: string): LinkTextProblem | null {
  const text = squash(label);
  if (text === "") return "empty";
  if (BARE_NUMBER_RE.test(text)) return "number";
  if (ADDRESS_RE.test(text)) return "address";
  if (GENERIC.has(text.toLowerCase().replace(/[.!:→»>]+$/u, "").trim())) return "generic";
  return null;
}

export function linkWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 2);
}

/** Two words that are one word in two forms — "scan" and "scans", "price"
 *  and "pricing" — read off their shared beginning. */
export function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  const short = Math.min(a.length, b.length);
  if (short < 4) return false;
  let shared = 0;
  while (shared < short && a[shared] === b[shared]) shared++;
  return shared >= 4 && shared >= short * 0.7;
}

/** A title that is a sentence about the business rather than a name for
 *  the page: it ends as a sentence does, or holds more than one. */
export function isSlogan(text: string): boolean {
  const trimmed = text.trim();
  return /[.!]$/.test(trimmed) || /[.!?]\s+\S/.test(trimmed);
}

/** True where `label` is `text` reworded: most of the words of either are
 *  the other's. */
export function resembles(label: string, text: string): boolean {
  const left = new Set(linkWords(label));
  const right = new Set(linkWords(text));
  if (left.size === 0 || right.size === 0) return false;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared++;
  return shared / (left.size + right.size - shared) >= 0.6;
}

/** The last segment of an address's path as words: `/features/gantt-charts`
 *  is "gantt charts". Empty for a site root and for a segment that is an id. */
function slugWords(url: string): string {
  let path: string;
  try {
    path = decodeURIComponent(new URL(url).pathname);
  } catch {
    return "";
  }
  const last = path.split("/").filter((segment) => segment !== "").pop() ?? "";
  const words = last
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[-_+]+/g, " ")
    .trim();
  return /\p{L}{3,}/u.test(words) ? words : "";
}

function titleSegments(title: string): string[] {
  return title
    .split(/\s+[|·•–—-]\s+|\s*[|·•]\s*|:\s+/u)
    .map((segment) => segment.replace(/\s+/g, " ").trim())
    .filter((segment) => segment !== "");
}

/**
 * What a page is called in a link to it: the heading or title segment that
 * says what its address says, else the address's own words, else the first
 * heading that is not a slogan. Empty where the page gives no words at all
 * — such a page has nothing to link with and is left out.
 */
export function pageName(page: { url: string; title: string; h1: string }): string {
  const said = [page.h1.replace(/\s+/g, " ").trim(), ...titleSegments(page.title)].filter(
    (text) => text !== "" && !isSlogan(text) && linkTextProblem(text) === null
  );
  const slug = slugWords(page.url);
  const wanted = linkWords(slug);
  if (wanted.length > 0) {
    const named = said.find((text) => linkWords(text).some((word) => wanted.some((want) => sameWord(word, want))));
    if (named !== undefined) return named;
    return slug.charAt(0).toUpperCase() + slug.slice(1);
  }
  return said[0] ?? "";
}

const CODE_OR_NUMBER_LINK_RE = /(`[^`]+`)|\[(\s*[\d.,]+%?\s*)\]\(([^)\s]+)\)/g;
/** Up to five words after the figure, read as far as the next punctuation. */
const AFTER_RE = /^((?:[ \t]+[\p{L}\p{N}][\p{L}\p{N}'’%-]*){1,5})/u;
const BEFORE_RE = /((?:[\p{L}\p{N}][\p{L}\p{N}'’-]*[ \t]+){1,3})$/u;

/** A link around digits glued to a letter on either side: the "2" of
 *  "B[2](u)B" is part of the word "B2B", never a figure (issue 1507). */
const GLUED_NUMBER_LINK_RE = /(`[^`]+`)|(?<=\p{L})\[([\d.,]+%?)\]\([^)\s]+\)|\[([\d.,]+%?)\]\([^)\s]+\)(?=\p{L})/gu;

/** Whether a line links digits that are glued into a word. */
export function hasGluedNumberLink(line: string): boolean {
  return [...line.matchAll(GLUED_NUMBER_LINK_RE)].some((match) => match[1] === undefined);
}

/** The line with every link around glued digits unwrapped: "B[2](u)B" is
 *  "B2B" again. The words are the line's own; only the link goes. */
export function unglueNumberLinks(line: string): string {
  return line.replace(GLUED_NUMBER_LINK_RE, (token: string, code: string | undefined, left: string | undefined, right: string | undefined) =>
    code !== undefined ? token : (left ?? right ?? "")
  );
}

/**
 * A link whose text is a bare figure takes in the words the figure counts:
 * `[1](u) of the 11 buyer questions` becomes `[1 of the 11 buyer
 * questions](u)`. A figure alone in a table cell has no words beside it and
 * stands: its column's heading says what it counts. Digits glued into a word
 * are not a figure, and their link is unwrapped first (issue 1507).
 */
export function widenNumberLinks(given: string): string {
  const line = unglueNumberLinks(given);
  let out = "";
  let from = 0;
  CODE_OR_NUMBER_LINK_RE.lastIndex = 0;
  for (const match of line.matchAll(CODE_OR_NUMBER_LINK_RE)) {
    if (match[1] !== undefined) continue;
    const at = match.index;
    const end = at + match[0].length;
    const figure = (match[2] ?? "").trim();
    const href = match[3] ?? "";
    const after = AFTER_RE.exec(line.slice(end))?.[1];
    if (after !== undefined) {
      out += `${line.slice(from, at)}[${figure}${after}](${href})`;
      from = end + after.length;
      continue;
    }
    const lead = line.slice(from, at);
    const before = BEFORE_RE.exec(lead)?.[1];
    if (before === undefined) continue;
    out += `${lead.slice(0, lead.length - before.length)}[${before}${figure}](${href})`;
    from = end;
  }
  return from === 0 ? line : out + line.slice(from);
}
