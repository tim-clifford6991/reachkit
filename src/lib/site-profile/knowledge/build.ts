// SPEC §5 (2026-09-29, #1133) — one read of a site into its knowledge base.
//
// The pages are the ones the pass's crawl already read and ledgered: this
// fetches nothing. It runs as a step of its own in the onboarding pass and
// in a pass measured again now (`@/lib/scan/deep/run`), on the pass's money.
//
// One exception buys a read (SPEC §6, issue 1374): a site that serves an
// empty JavaScript shell has its pages drawn by the vendor (`./rendered`).
import { siteLocale } from "@/lib/locale/site";
import type { CostContext } from "@/lib/costs";
import { registrableDomain } from "@/lib/market/rivals/domains";
import { readMeasuredText } from "@/lib/measure/text";
import { readSiteProfile } from "../store";
import { readKnowledge, type KnowledgePage, type KnowledgeRead } from "./extract";
import { isEmptyShell, readRenderedPages } from "./rendered";
import { readStoredKnowledge, writeStoredKnowledge } from "./store";
import { NO_KNOWLEDGE } from "./types";

/** A sitemap or a robots file is ledgered like a page and is not one. */
const NOT_A_PAGE_RE = /\.(?:xml|txt|json)$/i;

/** The site's own pages, each once, as it was last read. */
export function ownPages(
  texts: readonly { url: string; text: string; examples?: readonly string[]; questions?: readonly string[] }[],
  domain: string
): readonly KnowledgePage[] {
  const site = registrableDomain(domain);
  const latest = new Map<string, KnowledgePage>();
  // `readMeasuredText` answers oldest first, so a later read replaces an
  // earlier one of the same address.
  for (const { url, text, examples, questions } of texts) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }
    if (NOT_A_PAGE_RE.test(parsed.pathname) || registrableDomain(parsed.hostname) !== site) continue;
    latest.set(url, {
      url,
      text,
      ...(examples === undefined ? {} : { examples }),
      ...(questions === undefined ? {} : { questions }),
    });
  }
  return [...latest.values()];
}

/** An address as the inventory and the ledger both spell it. */
function sameAddress(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Reads and stores. A read that came back with nothing leaves what was
 *  stored: an empty base written over a real one would delete a reading. */
export async function buildKnowledge(
  c: CostContext,
  a: { siteId: string; domain: string }
): Promise<KnowledgeRead> {
  // Every read of the site's pages the ledger holds, narrowed to the pages
  // the pass's crawl has just listed: a pass inside the own-document window
  // ledgers no page of its own (`@/lib/measure/text`), and a page the site
  // has since taken down must not stay in the base.
  // The pages as served: whether the site is a shell is asked of them on
  // every pass, never of an earlier pass's rendered reads.
  const served = (await readMeasuredText({ siteId: a.siteId })).filter((page) => page.rendered !== true);
  const held = ownPages(served, a.domain);
  const profile = await readSiteProfile(a.domain).catch(() => undefined);
  // The base is kept in the profile's row (issue 1414). Where the pass
  // stored no profile there is nowhere to keep it: on wesbos.com the read
  // was bought, written to no row, and nothing said so. It is said, and
  // nothing is bought.
  if (profile === null) {
    console.log(
      JSON.stringify({
        event: "site_knowledge_failed",
        domain: a.domain,
        because: "the pass stored no site profile, so the knowledge base has no row to be kept in",
        held: held.length,
        asked: 0,
      })
    );
    return { knowledge: NO_KNOWLEDGE, asked: 0, reused: 0, stoppedBy: "complete" };
  }
  const listed = new Set((profile?.inventory ?? []).map((row) => sameAddress(row.url)));
  const current = held.filter((page) => listed.has(sameAddress(page.url)));
  let pages = current.length > 0 ? current : held;
  const shell = isEmptyShell(pages);
  if (shell) {
    const rendered = await readRenderedPages(c, { domain: a.domain, pages });
    console.log(JSON.stringify({ event: "site_knowledge_rendered", domain: a.domain, served: pages.length, rendered: rendered.length }));
    if (rendered.length > 0) pages = rendered;
  }
  const previous = await readStoredKnowledge(a.domain);
  const read = await readKnowledge(c, { domain: a.domain, pages, previous, locale: await siteLocale(a.siteId) });
  if (read.knowledge.pages.length > 0) await writeStoredKnowledge(a.domain, read.knowledge);
  // SPEC §5 (2026-10-07, issue 1314): a base no page was read into is said,
  // never silent. Two sites of the customer panel ended a pass with an
  // empty base and no line in its log.
  else {
    console.log(
      JSON.stringify({
        event: "site_knowledge_failed",
        domain: a.domain,
        because: "no page of the site was read into the knowledge base",
        held: held.length,
        listed: listed.size,
        shell,
        asked: read.asked,
        stoppedBy: read.stoppedBy,
      })
    );
  }
  return read;
}
