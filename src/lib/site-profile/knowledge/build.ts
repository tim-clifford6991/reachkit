// SPEC §5 (2026-09-29, #1133) — one read of a site into its knowledge base.
//
// The pages are the ones the pass's crawl already read and ledgered: this
// fetches nothing. It runs as a step of its own in the onboarding pass and
// in a pass measured again now (`@/lib/scan/deep/run`), on the pass's money.
import { siteLocale } from "@/lib/locale/site";
import type { CostContext } from "@/lib/costs";
import { registrableDomain } from "@/lib/market/rivals/domains";
import { readMeasuredText } from "@/lib/measure/text";
import { readSiteProfile } from "../store";
import { readKnowledge, type KnowledgePage, type KnowledgeRead } from "./extract";
import { readStoredKnowledge, writeStoredKnowledge } from "./store";

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
  const held = ownPages(await readMeasuredText({ siteId: a.siteId }), a.domain);
  const listed = new Set(
    ((await readSiteProfile(a.domain).catch(() => null))?.inventory ?? []).map((row) => sameAddress(row.url))
  );
  const current = held.filter((page) => listed.has(sameAddress(page.url)));
  const pages = current.length > 0 ? current : held;
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
        asked: read.asked,
        stoppedBy: read.stoppedBy,
      })
    );
  }
  return read;
}
