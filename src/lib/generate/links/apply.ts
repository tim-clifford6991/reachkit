// SPEC §7 Rules ("No link known to go nowhere", "one serialiser for
// screen, copy-as-HTML and copy-as-Markdown", 2026-09-12; *Descriptive link
// text*, 2026-10-10, issue 1391).
//
// Holds a finished body to the link list `select.ts` chose. The model is
// told the list; this is what makes it true of the page whatever the model
// did with it.
//
// **Three passes over the body's own Markdown, and nothing else.**
//
//   1. Every link's text is held to `text.ts`. A bare figure takes in the
//      words it counts. A link into the customer's site whose text says
//      nothing of the page — "here", an address, or the page's slogan
//      reworded — is unwrapped: the sentence stands and the link does not.
//      A link elsewhere with such text is named by its host.
//   2. Every link into the customer's own site — an absolute address on
//      their domain, or a site-relative `/path` — that is not a chosen
//      target and not the grounded source is unwrapped to its label. A
//      path the model guessed is exactly the dead link the rule forbids. A
//      chosen target written relatively is rewritten absolute: the hosted
//      destination serves from a subdomain, where `/pricing` is not theirs.
//   3. The writer links a page where a sentence speaks to it, so most
//      chosen pages are linked in the text. Where the body links fewer of
//      the site's own pages than `CROSS_LINKS.SITE_MIN`, the best of the
//      rest are listed until it holds that many, each under the page's own
//      name; an earlier page of the cluster the body did not reach is
//      listed too.
//
// Links to anywhere else — a rival's page a figure is sourced from — keep
// their address: those are the hard rules' business.
//
// The result is Markdown, written in the grammar the one renderer
// (`src/lib/publish/render/markdown.ts`) parses. It is stored as the
// draft's body, so the screen, copy-as-HTML, copy-as-Markdown and every
// destination read the same links from the same string.
import { CROSS_LINKS } from "@/lib/config/constants";
import { onSite, urlKey, type LinkTarget } from "./select";
import { isSlogan, linkTextProblem, resembles, widenNumberLinks } from "./text";

/** The renderer's inline grammar, code spans first so a link written
 *  inside backticks stays code. */
const CODE_OR_LINK_RE = /(`[^`]+`)|\[([^\]\n]*)\]\(([^)\s]+)\)/g;
const FENCE_RE = /^```/;

export function applyLinks(
  markdown: string,
  a: {
    domain: string;
    targets: readonly LinkTarget[];
    groundedUrl: string;
    /** The customer's own pages the page's facts were read from (SPEC §7,
     *  D41): a fact is linked to its source, so a link to one of them
     *  stands. */
    factUrls?: readonly string[];
    /** `false` holds the text to the chosen pages without appending the
     *  ones it did not reach — for a line that is not the body (issue 1137:
     *  the page's closing line, laid out after the body's links). */
    appendMissing?: boolean;
    /** The heading of the section the unreached pages are listed under —
     *  the page's own section on how the business handles the question
     *  (SPEC §7, 2026-09-29: "with links to its product, pricing and the
     *  cluster's hub page"). Absent, or not found, they close the body. */
    appendUnder?: string;
  }
): string {
  const chosen = new Map<string, LinkTarget>();
  for (const target of a.targets) {
    const key = urlKey(target.url);
    if (key !== null && !chosen.has(key)) chosen.set(key, target);
  }
  const grounded = urlKey(a.groundedUrl);
  const sources = new Set((a.factUrls ?? []).map(urlKey));
  const linked = new Set<string>();

  let inFence = false;
  const lines = markdown.split("\n").map((line) => {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;
    return widenNumberLinks(line).replace(CODE_OR_LINK_RE, (token: string, code: string | undefined, label: string, href: string) => {
      if (code !== undefined) return token;
      const absolute = href.startsWith("/") && !href.startsWith("//") ? `https://${a.domain}${href}` : href;
      const problem = linkTextProblem(label);
      if (!onSite(absolute, a.domain)) {
        // A figure alone in a table cell stands; a source with no words is
        // named by where it is.
        const host = problem === null || problem === "number" ? null : hostOf(absolute);
        return host === null ? token : `[${host}](${href})`;
      }
      const key = urlKey(absolute);
      const target = key === null ? undefined : chosen.get(key);
      if (key !== null && target !== undefined) {
        if (problem !== null || rewordsSlogan(label, target)) return problem === "empty" ? "" : label;
        linked.add(key);
        return `[${label}](${safeHref(target.url)})`;
      }
      if (key !== null && (key === grounded || sources.has(key))) return problem === "empty" ? "" : token;
      return label;
    });
  });

  // The site's own pages the body reached, and how many more it is owed.
  const reached = a.targets.filter((target) => {
    const key = urlKey(target.url);
    return target.source === "site" && key !== null && linked.has(key);
  }).length;
  let owed = Math.max(0, CROSS_LINKS.SITE_MIN - reached);
  const missing = a.targets.filter((target) => {
    const key = urlKey(target.url);
    if (key === null || linked.has(key)) return false;
    if (target.source === "site") {
      if (owed === 0) return false;
      owed--;
    }
    linked.add(key);
    return true;
  });
  if (missing.length === 0 || a.appendMissing === false) return dedupeLinks(lines.join("\n"));

  const list = missing.map((target) => `- [${safeLabel(target.label)}](${safeHref(target.url)})`);
  const under = a.appendUnder === undefined ? -1 : lines.findIndex((line) => line.trim() === `## ${a.appendUnder}`);
  if (under >= 0) {
    // The end of that section: the next H2, or the end of the body.
    const next = lines.findIndex((line, index) => index > under && /^##[ \t]/.test(line));
    const end = next < 0 ? lines.length : next;
    const before = lines.slice(0, end).join("\n").replace(/\s+$/, "");
    const after = lines.slice(end).join("\n");
    return dedupeLinks(`${before}\n\n${list.join("\n")}\n${after === "" ? "" : `\n${after}`}`);
  }
  const body = lines.join("\n").replace(/\s+$/, "");
  return dedupeLinks(`${body}\n\n${list.join("\n")}\n`);
}

/** An address as a page is told apart: host and path, without its query or
 *  fragment — `/scans?sort=az` is `/scans`. */
function pageKey(href: string): string {
  return href.trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/+$/, "");
}

const anchorKey = (label: string): string => label.replace(/[*_`]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

/** A list item that is one link and nothing else. */
const LINK_ITEM_RE = /^[ \t]*[-*+][ \t]+\[[^\]\n]*\]\([^)\s]+\)[ \t]*$/;

/** Each link of a body, in order, with whether it repeats one before it. */
function linkRepeats(markdown: string): { line: number; token: string; repeat: boolean }[] {
  const anchors = new Map<string, string>();
  const pages = new Map<string, string>();
  const out: { line: number; token: string; repeat: boolean }[] = [];
  let inFence = false;
  markdown.split("\n").forEach((line, index) => {
    if (FENCE_RE.test(line)) inFence = !inFence;
    if (inFence) return;
    for (const match of line.matchAll(CODE_OR_LINK_RE)) {
      if (match[1] !== undefined) continue;
      const anchor = anchorKey(match[2] ?? "");
      const href = (match[3] ?? "").trim();
      const page = pageKey(href);
      // The same words over another page, or one page under a second
      // address. The same link said twice is one link, and a source named
      // by its host — how this file names one — may name several pages.
      const cited = anchor === page.split("/")[0];
      const repeat =
        (anchor !== "" && !cited && anchors.has(anchor) && pageKey(anchors.get(anchor)!) !== page) ||
        (pages.has(page) && pages.get(page) !== href);
      if (!anchors.has(anchor)) anchors.set(anchor, href);
      if (!pages.has(page)) pages.set(page, href);
      out.push({ line: index, token: match[0], repeat });
    }
  });
  return out;
}

/** Whether a body links one anchor twice, or one page under two addresses
 *  (issue 1507: four links "Every free scan, in the open." to `/scans` and
 *  three of its sort orders). */
export function hasRepeatedLinks(markdown: string): boolean {
  return linkRepeats(markdown).some((link) => link.repeat);
}

/**
 * A body with each repeated link gone: a list item that is only that link
 * is dropped, and a link inside a sentence is unwrapped to its words. The
 * first link of each anchor and each page stands. Nothing is written.
 */
export function dedupeLinks(markdown: string): string {
  const repeats = linkRepeats(markdown).filter((link) => link.repeat);
  if (repeats.length === 0) return markdown;
  const lines = markdown.split("\n");
  const dropped = new Set<number>();
  for (const link of repeats) {
    const line = lines[link.line]!;
    if (LINK_ITEM_RE.test(line) && line.includes(link.token)) {
      dropped.add(link.line);
      continue;
    }
    const label = /^\[([^\]\n]*)\]/.exec(link.token)?.[1] ?? "";
    lines[link.line] = line.replace(link.token, label);
  }
  return lines.filter((_, index) => !dropped.has(index)).join("\n");
}

/** True where a link's words are the target page's slogan, or that slogan
 *  reworded: "one plan — one page a day" for a pricing page titled "One
 *  plan. One page a day.". */
function rewordsSlogan(label: string, target: LinkTarget): boolean {
  if (target.source !== "site") return false;
  return (target.said ?? []).some((said) => isSlogan(said) && resembles(label, said));
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** A label the inline grammar reads back as one link: no brackets, no
 *  line break. */
function safeLabel(label: string): string {
  return label.replace(/[[\]]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * An address the inline grammar reads back whole.
 *
 * **Both parentheses, since issue 929.** The hand-written grammar ended a
 * link at the first `)`, so encoding that one was enough. The parser is
 * CommonMark now (`src/lib/publish/render/markdown.ts`), and its rule is
 * different: an unwrapped destination may contain parentheses only in
 * **balanced** pairs, so a URL with a lone `(` — which
 * `https://…/widget_(v2)` becomes the moment its `)` is encoded — is not a
 * destination at all and the whole link reads as literal text.
 *
 * Encoding both leaves an address with no parentheses in it, which every
 * Markdown parser reads back the same way and which resolves to the same
 * URL. Whitespace is encoded for the reason it always was: a space ends a
 * destination in CommonMark too.
 */
function safeHref(url: string): string {
  return url.replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/\s/g, "%20");
}
