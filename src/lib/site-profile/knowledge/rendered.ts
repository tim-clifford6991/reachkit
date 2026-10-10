// SPEC §6 (issue 1374) — a site drawn by JavaScript is read as a browser
// draws it.
//
// The plain read comes first and is free. Only where it left no page with
// enough text to read (the site serves an empty shell) does this ask the
// vendor to draw the pages, at `PRICE_BOOK.RENDERED_PAGE_C` each, on the
// pass's own money and inside its cap. A server-rendered site never reaches
// this file.
//
// The page list is the site's own: the pages the crawl listed (its sitemap,
// where that is a sitemap and not the shell again), then the links of each
// rendered page, the home page first and the rest in the knowledge base's
// own order (`./priority`). A page that order reads last is not bought, and
// a path the site's `robots.txt` closes to this reader is never asked for.
import { CACHE_WINDOWS_D, KNOWLEDGE_BASE } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import { readRobots, robotsAllows } from "@/lib/egress/robots";
import { robotsTokensFor } from "@/lib/egress/safe-fetch";
import type { RobotsPolicy } from "@/lib/egress/types";
import { OWN_FETCH_OPTS } from "@/lib/measure/own-fetch";
import { prose } from "@/lib/measure/prose";
import { renderedPage } from "@/lib/vendors/dataforseo";
import { dedupeKey, ownLinks } from "../crawl";
import type { KnowledgePage } from "./extract";
import { isReadLast, readFirstRank } from "./priority";

const ROBOTS_TOKENS = robotsTokensFor(OWN_FETCH_OPTS.userAgent);

/** Whether the plain read left nothing to read: it holds pages, and none
 *  says enough for the knowledge base to ask about. */
export function isEmptyShell(pages: readonly KnowledgePage[]): boolean {
  return pages.length > 0 && pages.every((page) => page.text.length < KNOWLEDGE_BASE.PAGE_MIN_CHARS);
}

/** The home page among the pages held, else the root of the first. */
function homeOf(pages: readonly KnowledgePage[]): string | null {
  for (const page of pages) {
    const key = dedupeKey(page.url);
    if (key !== null && new URL(key).pathname === "/" && new URL(key).search === "") return key;
  }
  const first = pages[0];
  return first === undefined ? null : dedupeKey(new URL("/", first.url).toString());
}

/**
 * The site's pages as a browser draws them, at most
 * `KNOWLEDGE_BASE.RENDERED_PAGES` and for at most `RENDER_MS`. One at a
 * time: each is a paid call through the ledger. `[]` where none could be
 * drawn, which leaves the caller with what it had.
 */
export async function readRenderedPages(
  c: CostContext,
  a: { domain: string; pages: readonly KnowledgePage[] }
): Promise<readonly KnowledgePage[]> {
  const home = homeOf(a.pages);
  if (home === null) return [];

  const seen = new Set<string>();
  const queue: string[] = [];
  const enqueue = (url: string): void => {
    const key = dedupeKey(url);
    if (key === null || seen.has(key)) return;
    seen.add(key);
    if (key === home || !isReadLast(key)) queue.push(key);
  };
  enqueue(home);
  for (const page of a.pages) enqueue(page.url);

  const policies = new Map<string, Promise<RobotsPolicy | null>>();
  const allowed = async (url: string): Promise<boolean> => {
    const { origin, pathname, search } = new URL(url);
    let policy = policies.get(origin);
    if (policy === undefined) {
      policy = readRobots(origin).then((answer) => (answer.ok ? answer : null), () => null);
      policies.set(origin, policy);
    }
    const rules = await policy;
    return rules === null || robotsAllows(rules, ROBOTS_TOKENS, `${pathname}${search}`);
  };

  const deadline = Date.now() + KNOWLEDGE_BASE.RENDER_MS;
  const out: KnowledgePage[] = [];
  let asked = 0;
  while (queue.length > 0 && asked < KNOWLEDGE_BASE.RENDERED_PAGES && Date.now() < deadline && !c.capHit()) {
    // Best first, discovery order among equals, as the crawl takes them.
    let best = 0;
    queue.forEach((url, i) => {
      if (readFirstRank(url) < readFirstRank(queue[best] ?? url)) best = i;
    });
    const [url] = queue.splice(best, 1);
    if (url === undefined || !(await allowed(url))) continue;
    asked++;
    const read = await renderedPage(c, { url, freshnessDays: CACHE_WINDOWS_D.own });
    const document = read.kind === "measured" ? read.value[0] : undefined;
    if (document === undefined) continue;
    const said = prose(document.html);
    out.push({ url, text: said.text, examples: said.examples, questions: said.questions });
    for (const link of ownLinks(url, document.html, a.domain)) enqueue(link);
  }
  return out;
}
