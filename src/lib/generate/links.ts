// SPEC §7 Rules ("Cross-asset and site linking"; "Drafting and linking use
// the site profile", 2026-09-12) — which real pages a day's asset links to.
// Pure: the two reads it needs are the caller's, through the store port.
import { COPY, TODO_COPY_MARKER } from "@/lib/presentation/copy";
import { markdownLink, parseMarkdown, type Block, type Inline } from "@/lib/publish/render/markdown";
import type { PagePurpose, SiteProfile } from "@/lib/site-profile";
import type { PublishedAsset } from "./store";

/** One link the asset will carry: a real address, and words that already
 *  name it — an inventory row's own title, or an earlier asset's own. */
export interface PlannedLink {
  href: string;
  label: string;
}

/** The purposes §7 names, in the order it names them. A purpose absent here
 *  is never linked: blog, contact, legal and `other` are not pages the
 *  ruling sends a reader to, so no link is minted for them. */
const LINKED_PURPOSES: readonly PagePurpose[] = Object.freeze([
  "pricing",
  "product",
  "features",
  "about",
]);

/** At most one link per linked purpose, and at most three earlier assets.
 *  Bounds, not policy: a page that ended in a directory of itself would be
 *  the compounding §7 asks for turned into a link farm. */
const SITE_LINKS_MAX = LINKED_PURPOSES.length;
const CLUSTER_LINKS_MAX = 3;

/** The words no topic is. Dropped before two searches are compared, so
 *  "best X software" and "best Y software" are not one cluster on the
 *  strength of "best". Not a vocabulary of the market — only the filler
 *  every query carries. */
const NON_TOPIC_WORDS: ReadonlySet<string> = new Set([
  "the", "and", "for", "with", "what", "which", "how", "why", "who", "does",
  "your", "you", "our", "are", "from", "best", "top", "good", "great",
  "cheap", "free", "new", "alternative", "alternatives", "vs", "versus",
]);

/** A search's topic terms: ASCII-lowercased runs of three or more
 *  characters, filler dropped. The same derivation on both sides of every
 *  comparison, so membership is symmetric. */
function topicTerms(text: string | null): ReadonlySet<string> {
  if (text === null) return new Set();
  const runs = text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/);
  return new Set(runs.filter((run) => run.length >= 3 && !NON_TOPIC_WORDS.has(run)));
}

function sharedTermCount(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  let shared = 0;
  for (const term of a) if (b.has(term)) shared += 1;
  return shared;
}

/** The words an inventory row is linked by: its own `<title>`, else its own
 *  `<h1>`. A row carrying neither is not linked — a label has to be the
 *  customer's words, and none are invented to stand in for them. */
function labelOf(row: { title: string; h1: string }): string {
  const title = row.title.trim();
  return title === "" ? row.h1.trim() : title;
}

/** Every address the body already carries, read with the one parser rather
 *  than a second regex — so a page cannot be handed the same link twice. */
function addressesIn(markdown: string): ReadonlySet<string> {
  const found = new Set<string>();
  const walkInline = (nodes: readonly Inline[]): void => {
    for (const node of nodes) {
      if (node.kind === "link") {
        found.add(node.href);
        walkInline(node.children);
      } else if (node.kind === "strong" || node.kind === "em" || node.kind === "mark") {
        walkInline(node.children);
      }
    }
  };
  const walkBlock = (block: Block): void => {
    if (block.kind === "code" || block.kind === "rule") return;
    if (block.kind === "list") {
      for (const item of block.items) walkInline(item);
      return;
    }
    walkInline(block.children);
  };
  for (const block of parseMarkdown(markdown)) walkBlock(block);
  return found;
}

/**
 * The site's own pages, chosen by the purpose the profile stored for each
 * one — never from a path convention, so a site with no pricing page gets
 * no pricing link instead of a guess at `/pricing` (ruling 2026-09-12).
 *
 * Within a purpose the most relevant row wins: the one sharing most topic
 * terms with the search this page is written for, then the shortest
 * address, which is the most canonical of equals and makes the choice
 * deterministic.
 */
export function siteLinks(a: {
  profile: SiteProfile | null;
  targetQuery: string | null;
  taken: ReadonlySet<string>;
}): PlannedLink[] {
  if (a.profile === null) return [];
  const wanted = topicTerms(a.targetQuery);
  const out: PlannedLink[] = [];

  for (const purpose of LINKED_PURPOSES) {
    const candidates = a.profile.inventory
      .filter((row) => row.purpose === purpose)
      .filter((row) => !a.taken.has(row.url) && labelOf(row) !== "")
      .sort((left, right) => {
        const byTerms =
          sharedTermCount(topicTerms(`${right.title} ${right.h1}`), wanted) -
          sharedTermCount(topicTerms(`${left.title} ${left.h1}`), wanted);
        if (byTerms !== 0) return byTerms;
        if (left.url.length !== right.url.length) return left.url.length - right.url.length;
        return left.url < right.url ? -1 : 1;
      });
    const best = candidates[0];
    if (best === undefined) continue;
    out.push({ href: best.url, label: labelOf(best) });
    if (out.length === SITE_LINKS_MAX) break;
  }
  return out;
}

/**
 * The earlier ReachKit pages in this asset's cluster.
 *
 * §6 clusters opportunities by parent topic before ranking, and no column
 * records that cluster yet, so membership is read off what *is* stored: two
 * assets are in one cluster when the searches they were written for share a
 * topic term. Ranked by how many they share, then newest first.
 *
 * **A link known to lead nowhere is not written** (§7): an asset that was
 * taken down, or that the 24-hour check found no page at, is not a page to
 * send a reader to and is dropped here rather than published dead.
 */
export function clusterLinks(a: {
  published: readonly PublishedAsset[];
  targetQuery: string | null;
  taken: ReadonlySet<string>;
}): PlannedLink[] {
  const wanted = topicTerms(a.targetQuery);
  if (wanted.size === 0) return [];

  return a.published
    .filter((asset) => asset.unpublishedAt === null && !asset.knownMissing)
    .filter((asset) => !a.taken.has(asset.liveUrl) && asset.title.trim() !== "")
    .map((asset) => ({ asset, shared: sharedTermCount(topicTerms(asset.targetQuery), wanted) }))
    .filter((entry) => entry.shared > 0)
    .sort((left, right) =>
      left.shared === right.shared
        ? right.asset.publishedAt.getTime() - left.asset.publishedAt.getTime()
        : right.shared - left.shared
    )
    .slice(0, CLUSTER_LINKS_MAX)
    .map((entry) => ({ href: entry.asset.liveUrl, label: entry.asset.title.trim() }));
}

/** The whole plan for one page: its own site's pages first, then the
 *  cluster's, with nothing the body already links and nothing twice. */
export function planLinks(a: {
  profile: SiteProfile | null;
  published: readonly PublishedAsset[];
  targetQuery: string | null;
  bodyMarkdown: string;
}): PlannedLink[] {
  const taken = new Set(addressesIn(a.bodyMarkdown));
  const out: PlannedLink[] = [];
  for (const link of siteLinks({ profile: a.profile, targetQuery: a.targetQuery, taken })) {
    out.push(link);
    taken.add(link.href);
  }
  for (const link of clusterLinks({ published: a.published, targetQuery: a.targetQuery, taken })) {
    out.push(link);
    taken.add(link.href);
  }
  return out;
}

/** The block's heading, or `null` while the owner has not written it. The
 *  marker renders as itself, and this text publishes onto a paying
 *  customer's own domain: the links ship without a heading until then. */
function writtenHeading(): string | null {
  const text: string = COPY["publish.links.heading"];
  return text === "" || text === TODO_COPY_MARKER ? null : text;
}

/**
 * The body as it will publish, links and all.
 *
 * Every link is minted by the renderer's own `markdownLink`, so the screen,
 * the copy-as-Markdown bytes, the copy-as-HTML bytes and both destinations
 * carry one address each and cannot disagree (§7). A link it refuses —
 * an unaddressable scheme, a label with no words — is left out, never
 * written as a placeholder, and a plan with nothing in it adds no block and
 * no line apologising for one.
 */
export function bodyWithLinks(markdown: string, links: readonly PlannedLink[]): string {
  const items = links
    .map((link) => markdownLink(link.label, link.href))
    .filter((item): item is string => item !== null)
    .map((item) => `- ${item}`);
  if (items.length === 0) return markdown;

  const heading = writtenHeading();
  const parts = [markdown.replace(/\s+$/, "")];
  if (heading !== null) parts.push(`## ${heading}`);
  parts.push(items.join("\n"));
  return `${parts.join("\n\n")}\n`;
}
