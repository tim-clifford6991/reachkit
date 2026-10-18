// SPEC §7 (issue 1509) — who a hosted page is by, as the page and its
// structured data both state it.
//
// The byline the founder gave is read into a person: the name, what the
// line says they do and where. Beside that, only what the main site itself
// shows (`site_profiles.main_site`, issue 1511):
//
//   · **`url`** — the main site's about or team page whose visible text
//     names the person. An about page that never names them is not their
//     page, so a site with none gives no `url`;
//   · **`sameAs`** — profile pages the main site links whose own handle is
//     the person's name (`linkedin.com/in/ada-park`), never the business's.
//     A profile the main site does not link is never one of theirs.
//
// Both are optional and neither is ever asked of the founder. Pure.
import type { HostedBusiness } from "./chrome";

/** What separates a name from its line in a byline: "Tim Clifford ·
 *  Founder, ReachKit" (SPEC §7, 2026-09-29) — or the comma or dash a founder
 *  typed instead: "Tim, Founder based in Berlin" (D53, issue 1268). The
 *  middle dot is the form setup shows, so it is read first. */
const BYLINE_SEPARATORS = [/\s+·\s+/, /\s+[–—|-]\s+/, /,\s+/] as const;

/** Where a line says the person is: "… based in Berlin, Germany". */
const PLACE = /(?:^|[\s,]+)(?:based|located|living)\s+in\s+(.+)$/i;

/** A byline as a person: the name, then what the line says they do and,
 *  where it states one, where they are. Nothing the byline does not say. */
export function personOf(byline: string): { name: string; jobTitle: string | null; place: string | null } {
  const said = byline.replace(/\s+/g, " ").trim();
  const separator = BYLINE_SEPARATORS.find((candidate) => candidate.test(said));
  const at = separator === undefined ? null : separator.exec(said);
  const name = at === null ? said : said.slice(0, at.index).trim();
  const line = at === null ? "" : said.slice(at.index + at[0].length).trim();
  const where = PLACE.exec(line);
  const jobTitle = (where === null ? line : line.slice(0, where.index)).replace(/[\s,;]+$/, "");
  const place = where?.[1]?.replace(/[\s.]+$/, "") ?? "";
  return { name, jobTitle: jobTitle === "" ? null : jobTitle, place: place === "" ? null : place };
}

/** The person a page is by, with what the main site shows of them. */
export interface PageAuthor {
  name: string;
  jobTitle: string | null;
  place: string | null;
  /** The main site's page that names them, or `null`. */
  url: string | null;
  /** Their own profiles the main site links. */
  sameAs: string[];
}

/** A text's words, with case and accents set aside, in any script. */
function wordsOf(text: string): string[] {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Whether visible `text` states `name`, all its words in order. */
function names(text: string, name: string): boolean {
  const wanted = wordsOf(name);
  return wanted.length > 0 && ` ${wordsOf(text).join(" ")} `.includes(` ${wanted.join(" ")} `);
}

/** The fewest letters a name's words must come to before a profile's handle
 *  is read as theirs: a short first name is in too many handles. */
const HANDLE_MIN_CHARS = 5;

/** Whether a profile's own handle is the person's: every word of their name
 *  is in its path, and the business's name is not. */
function profileOf(url: string, name: string, business: HostedBusiness): boolean {
  let path: string;
  try {
    path = decodeURIComponent(new URL(url).pathname);
  } catch {
    return false;
  }
  const handle = wordsOf(path).join("");
  const wanted = wordsOf(name);
  if (wanted.join("").length < HANDLE_MIN_CHARS || !wanted.every((word) => handle.includes(word))) return false;
  const brand = wordsOf(business.name).join("");
  return brand === "" || !handle.includes(brand);
}

/** Who the page is by, or `null` where it is by the business itself: a
 *  page with no recorded byline, or one that is the business's name. */
export function pageAuthorOf(byline: string | null, business: HostedBusiness): PageAuthor | null {
  const said = byline?.trim() ?? "";
  if (said === "" || said === business.name || said === business.domain) return null;
  const person = personOf(said);
  const pages = business.mainSite?.aboutPages ?? [];
  const page = pages.find((candidate) => names(candidate.text, person.name)) ?? null;
  const found = [...(page?.profiles ?? []), ...(business.mainSite?.sameAs ?? [])];
  const sameAs = [...new Set(found)].filter((url) => profileOf(url, person.name, business));
  return { ...person, url: page?.url ?? null, sameAs };
}
