// SPEC §7 (2026-10-10, issue 1391) — *Links on this page*.
//
// Every link the body in front of the customer carries, in three groups:
// their own site's pages, their own articles, and the public pages a claim
// is cited from. Pure, and read off the same body the page publishes from,
// so the list cannot name a link the page does not hold.
//
// Why a link is there is what generation recorded when code chose it
// (`drafts.meta.links`); whether it is live is what the check at publish
// found (`drafts.meta.linkCheck`). A page not yet published has had no
// check, and says so rather than calling a link live.
import { onSite, urlKey } from "@/lib/generate/links/select";
import { parseMarkdown, type Block, type Inline } from "@/lib/publish/render/markdown";

export type LinkGroup = "site" | "articles" | "sources";

/** Why a link is on the page, as a closed set the card has a sentence for. */
export type LinkReason =
  | { kind: "topic"; words: string }
  | { kind: "buy" | "main" | "cluster" | "known" | "newer" | "fact" | "source" | "written" };

export type LinkLive = "live" | "unchecked" | "pending";

export interface PageLink {
  text: string;
  url: string;
  reason: LinkReason;
  live: LinkLive;
}

/** A link the check at publish took out. */
export interface RemovedPageLink {
  text: string;
  url: string;
  kind: "site" | "source";
}

export interface PageLinks {
  site: readonly PageLink[];
  articles: readonly PageLink[];
  sources: readonly PageLink[];
  removed: readonly RemovedPageLink[];
}

/** What generation and the publish check recorded, as the store read it. */
export interface LinkRecord {
  chosen: readonly { url: string; source: string; why: { kind?: unknown; words?: unknown } | null }[];
  factUrls: readonly string[];
  check: {
    links: readonly { url: string; status: string }[];
    removed: readonly RemovedPageLink[];
  } | null;
}

export const NO_LINK_RECORD: LinkRecord = Object.freeze({ chosen: [], factUrls: [], check: null });

function textOf(nodes: readonly Inline[]): string {
  return nodes.map((node) => (node.kind === "text" || node.kind === "code" ? node.text : textOf(node.children))).join("");
}

function collect(nodes: readonly Inline[], out: { text: string; url: string }[]): void {
  for (const node of nodes) {
    if (node.kind === "text" || node.kind === "code") continue;
    if (node.kind === "link") out.push({ text: textOf(node.children).replace(/\s+/g, " ").trim(), url: node.href });
    collect(node.children, out);
  }
}

function walk(block: Block, out: { text: string; url: string }[]): void {
  switch (block.kind) {
    case "heading":
    case "paragraph":
    case "quote":
      collect(block.children, out);
      return;
    case "list":
      for (const item of block.items) collect(item, out);
      return;
    case "table":
      for (const row of [block.head, ...block.rows]) for (const cell of row) collect(cell, out);
      return;
    case "answer":
    case "takeaways":
      for (const inner of block.children) walk(inner, out);
      return;
    case "guides":
      for (const item of block.items) out.push({ text: item.label, url: item.href });
      return;
    case "code":
    case "rule":
      return;
  }
}

/** Every link of the body, each address once, grouped. */
export function linksOnPage(bodyMd: string, a: { domain: string; record: LinkRecord }): PageLinks {
  const found: { text: string; url: string }[] = [];
  for (const block of parseMarkdown(bodyMd)) walk(block, found);

  const chosen = new Map(a.record.chosen.flatMap((link) => {
    const key = urlKey(link.url);
    return key === null ? [] : [[key, link] as const];
  }));
  const facts = new Set(a.record.factUrls.map(urlKey));
  const checked = new Map((a.record.check?.links ?? []).map((link) => [urlKey(link.url), link.status] as const));

  const groups: Record<LinkGroup, PageLink[]> = { site: [], articles: [], sources: [] };
  const seen = new Set<string>();
  for (const link of found) {
    const key = urlKey(link.url);
    if (key === null || seen.has(key) || !/^https?:\/\//i.test(link.url)) continue;
    seen.add(key);
    const status = checked.get(key);
    const live: LinkLive = a.record.check === null || status === undefined ? "pending" : status === "live" ? "live" : "unchecked";
    const picked = chosen.get(key);
    const why = picked?.why ?? null;
    if (picked !== undefined && picked.source !== "site") {
      const kind = why?.kind === "newer" ? "newer" : picked.source === "cluster" ? "cluster" : "known";
      groups.articles.push({ ...link, live, reason: { kind } });
    } else if (picked !== undefined) {
      const words = Array.isArray(why?.words) ? why.words.filter((word): word is string => typeof word === "string") : [];
      groups.site.push({
        ...link,
        live,
        reason:
          why?.kind === "topic" && words.length > 0
            ? { kind: "topic", words: words.join(", ") }
            : { kind: why?.kind === "buy" ? "buy" : "main" },
      });
    } else if (onSite(link.url, a.domain)) {
      groups.site.push({ ...link, live, reason: { kind: facts.has(key) ? "fact" : "written" } });
    } else {
      groups.sources.push({ ...link, live, reason: { kind: "source" } });
    }
  }
  return { ...groups, removed: a.record.check?.removed ?? [] };
}

export function pageLinksEmpty(links: PageLinks): boolean {
  return links.site.length + links.articles.length + links.sources.length + links.removed.length === 0;
}
