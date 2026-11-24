// SPEC §7 — which source each sentence of a written page stands on, read from the pack it was written from.
//
// A sentence is a run of a paragraph, a quote or a list item; headings, table cells, the answer box and the
// key takeaways hold none, and neither does the Sources list code appends. A sentence's source is its first link
// whose address the pack holds: a site fact (`facts`) or a public page's claim (`claims`), else an earlier
// version's pack where an update kept the link. Any other link is a plain link.
//
// Pure: no read, no fetch, no model call.
import { LANGUAGES, type Language } from "@/lib/locale/locales";
import { copyIn } from "@/lib/presentation/copy/translated";
import { inlineText, parseMarkdown, type Block, type Inline } from "@/lib/publish/render/markdown";
import { readRecordedFact } from "./fact";
import { urlKey } from "./links/select";
import { sourceDate, type ClaimDates, type SourceDate } from "./pipeline/dated";
import { readPack, type ContextPack } from "./pipeline/pack";
import { citedIndependent } from "./pipeline/source-tier";

export interface CitationEntry {
  /** The number its sentences carry; `null` on a market fact a page written before the pack lists unnumbered. */
  n: number | null;
  kind: "site" | "public";
  url: string;
  title: string | null;
  passages: string[];
  /** How many claims the pack read off this address, where more than one. */
  many: number;
  readAt: string | null;
  /** A public page's own date as its Sources line names it; absent where it was never looked for. */
  dated?: SourceDate;
  used: number;
  /** The date of the earlier version whose pack holds this source. */
  keptFrom: string | null;
}

export interface Citations {
  /** Every sentence in reading order: its entry's number, or `null`. */
  sentences: (number | null)[];
  entries: CitationEntry[];
}

export interface EarlierPack {
  pack: ContextPack;
  at: string;
}

/** What a page written before the pack saved: its one site fact and its market facts. */
export interface SavedSources {
  fact: { passage: string; url: string; readAt: string | null } | null;
  market: { passage: string; url: string; readAt: string | null }[];
}

const squash = (text: string): string => text.replace(/\s+/g, " ").trim();

/** A sentence ends at a stop and its closing marks, before a space and anything but a lower-case word. */
const STOP = /[.!?…]["'”’)\]]*\s+/gu;

const blank = (segment: readonly Inline[]): boolean => squash(inlineText(segment)) === "";

/** The run cut at each sentence's end, blank pieces kept so nothing of the run is lost. */
function segmentsOf(run: readonly Inline[]): Inline[][] {
  const out: Inline[][] = [[]];
  for (const node of run) {
    if (node.kind !== "text") {
      out.at(-1)!.push(node);
      continue;
    }
    let from = 0;
    for (const stop of node.text.matchAll(STOP)) {
      const cut = stop.index + stop[0].length;
      if (/\p{Ll}/u.test(node.text[cut] ?? "")) continue;
      out.at(-1)!.push({ kind: "text", text: node.text.slice(from, cut) });
      out.push([]);
      from = cut;
    }
    if (from < node.text.length) out.at(-1)!.push({ kind: "text", text: node.text.slice(from) });
  }
  // A piece holding only a link, as a quote's closing citation does, belongs to the sentence before it.
  return out.reduce<Inline[][]>((kept, segment) => {
    const bare = segment.some((node) => node.kind === "link") && segment.every((node) => node.kind === "link" || !/[\p{L}\p{N}]/u.test(inlineText([node])));
    if (bare && kept.length > 0) kept.at(-1)!.push(...segment);
    else kept.push(segment);
    return kept;
  }, []);
}

const sentencesIn = (run: readonly Inline[]): Inline[][] => segmentsOf(run).filter((segment) => !blank(segment));

/** The runs that hold sentences, in reading order, each with where it sits in the blocks. */
function runsOf(blocks: readonly Block[]): { block: number; item: number | null; run: readonly Inline[] }[] {
  // The list is in the page's language, which a stored body does not name.
  const sources = new Set(Object.keys(LANGUAGES).map((language) => copyIn(language as Language, "body.sources.heading").toLowerCase()));
  const out: { block: number; item: number | null; run: readonly Inline[] }[] = [];
  let inSources = false;
  blocks.forEach((block, at) => {
    if (block.kind === "heading") inSources = sources.has(squash(inlineText(block.children)).toLowerCase());
    else if (inSources) return;
    else if (block.kind === "paragraph" || block.kind === "quote") out.push({ block: at, item: null, run: block.children });
    else if (block.kind === "list") block.items.forEach((item, i) => out.push({ block: at, item: i, run: item }));
  });
  return out;
}

function hrefsOf(nodes: readonly Inline[]): string[] {
  return nodes.flatMap((node) => (node.kind === "link" ? [node.href, ...hrefsOf(node.children)] : "children" in node ? hrefsOf(node.children) : []));
}

interface Known {
  kind: "site" | "public";
  url: string;
  title: string | null;
  passages: { passage: string; readAt: string }[];
  keptFrom: string | null;
  dated: SourceDate | null;
}

function knownOf(pack: ContextPack | null, earlier: readonly EarlierPack[], saved: SavedSources | null): Map<string, Known> {
  const known = new Map<string, Known>();
  const add = (kind: Known["kind"], url: string, passage: string, readAt: string, title: string | null, keptFrom: string | null, dates: ClaimDates = {}): void => {
    const key = urlKey(url);
    if (key === null) return;
    const held = known.get(key);
    if (held === undefined) known.set(key, { kind, url, title, passages: [{ passage, readAt }], keptFrom, dated: sourceDate(dates) });
    else if (held.keptFrom === keptFrom && !held.passages.some((p) => p.passage === passage)) held.passages.push({ passage, readAt });
    // A second-hand claim carries no date of its own: the page's date comes from a claim that does.
    if (held !== undefined && held.keptFrom === keptFrom && (held.dated === null || held.dated === "undated")) held.dated = sourceDate(dates) ?? held.dated;
  };
  for (const { pack: from, at } of [...(pack === null ? [] : [{ pack, at: null }]), ...earlier]) {
    // A report measurement is not a page of the site's.
    for (const fact of from.facts) if (fact.report !== true) add("site", fact.url, fact.passage, fact.readAt, null, at);
    for (const claim of from.claims) add("public", claim.url, claim.passage, claim.readAt, claim.title, at, claim);
  }
  if (saved?.fact != null) add("site", saved.fact.url, saved.fact.passage, saved.fact.readAt ?? "", null, null);
  return known;
}

/**
 * Per sentence, its source. A site fact's passage is the one its sentence's run holds word for word; a public
 * address holding one claim gives that claim, and one holding several gives them all. Without a pack, `saved`
 * numbers the one saved site fact and lists the market facts unnumbered.
 */
export function citationsOf(bodyMd: string, pack: ContextPack | null, earlier: readonly EarlierPack[] = [], saved: SavedSources | null = null, blocks?: readonly Block[]): Citations {
  const known = knownOf(pack, earlier, saved);
  const parsed = blocks ?? parseMarkdown(bodyMd);
  const entries = new Map<string, CitationEntry & { matched: Set<string> }>();
  const sentences: (number | null)[] = [];
  for (const { run } of runsOf(parsed)) {
    const runText = squash(inlineText(run));
    for (const sentence of sentencesIn(run)) {
      const key = hrefsOf(sentence).map(urlKey).find((k) => k !== null && known.has(k)) ?? null;
      const source = key === null ? undefined : known.get(key);
      if (key === null || source === undefined) {
        sentences.push(null);
        continue;
      }
      let entry = entries.get(key);
      if (entry === undefined) {
        const first = source.passages[0]!;
        entry = { n: entries.size + 1, kind: source.kind, url: source.url, title: source.title, passages: [], many: 0, readAt: first.readAt || null, used: 0, keptFrom: source.keptFrom, ...(source.dated === null ? {} : { dated: source.dated }), matched: new Set() };
        entries.set(key, entry);
      }
      entry.used += 1;
      if (source.kind === "site") for (const { passage } of source.passages) if (runText.includes(squash(passage))) entry.matched.add(passage);
      sentences.push(entry.n);
    }
  }
  const out: CitationEntry[] = [...entries.entries()].map(([key, { matched, ...entry }]) => {
    const all = known.get(key)!.passages.map((p) => p.passage);
    if (entry.kind === "site") return { ...entry, passages: matched.size > 0 ? [...matched] : all };
    return { ...entry, passages: all, many: all.length > 1 ? all.length : 0 };
  });
  if (pack === null && saved !== null) {
    const listed = new Map<string, CitationEntry>();
    for (const fact of saved.market) {
      const key = urlKey(fact.url);
      if (key === null || entries.has(key)) continue;
      const held = listed.get(key);
      if (held === undefined) listed.set(key, { n: null, kind: "public", url: fact.url, title: null, passages: [fact.passage], many: 0, readAt: fact.readAt, used: 0, keptFrom: null });
      else held.passages.push(fact.passage);
    }
    out.push(...listed.values());
  }
  return { sentences, entries: out };
}

/** The stored output where a page carries one, else `null`. */
export function readCitations(meta: unknown): Citations | null {
  const stored = (meta as { citations?: unknown } | null)?.citations as Partial<Citations> | undefined;
  if (stored == null || !Array.isArray(stored.sentences) || !Array.isArray(stored.entries)) return null;
  return stored as Citations;
}

/** A draft write carrying a body, with `meta.citations` recomputed for that body from the pack beside it; a body with
 *  no pack, as a page from before the pack has, records none. */
export function withCitations<T extends { body_md?: string | null; meta?: unknown }>(row: T): T {
  if (typeof row.body_md !== "string" || typeof row.meta !== "object" || row.meta === null) return row;
  const meta = Object.fromEntries(Object.entries(row.meta).filter(([key]) => key !== "citations"));
  const pack = readPack(meta);
  if (pack === null || row.body_md.trim() === "") return { ...row, meta };
  // A page's independent sources are those it cites, not every claim its research read.
  const citations = citationsOf(row.body_md, pack), used = new Set(citations.entries.filter((entry) => entry.used > 0).map((entry) => urlKey(entry.url)));
  return { ...row, meta: { ...meta, ...(pack.mix === undefined ? {} : { pack: { ...pack, mix: { ...pack.mix, independent: citedIndependent(pack.claims, (url) => used.has(urlKey(url))) } } }), citations } };
}

/** The day the pack was first stored with a page: a row from before it never had one. */
export const PACK_SINCE = "2026-10-04";

export type PageCitations = { kind: "matched"; citations: Citations; old: string | null } | { kind: "unread" };

const passagesAt = (value: unknown): SavedSources["market"] =>
  (Array.isArray(value) ? value : []).flatMap((entry) => {
    const fact = entry as { passage?: unknown; url?: unknown; readAt?: unknown } | null;
    return typeof fact?.passage === "string" && typeof fact.url === "string" ? [{ passage: fact.passage, url: fact.url, readAt: typeof fact.readAt === "string" ? fact.readAt : null }] : [];
  });

/** A written page's sources: the stored output where it still fits the body and no earlier version's pack (which the
 *  write never reads) could add a kept link, else the matcher over its pack; a page from before the pack over what it
 *  saved, and one whose pack cannot be read, unread. */
export function pageCitations(row: { bodyMd: string; meta: unknown; groundedFact: unknown; writtenAt: string; earlier: readonly { meta: unknown; at: string }[] }): PageCitations {
  const blocks = parseMarkdown(row.bodyMd);
  const stored = readCitations(row.meta);
  if (stored !== null && row.earlier.length === 0 && stored.sentences.length === runsOf(blocks).reduce((n, { run }) => n + sentencesIn(run).length, 0)) return { kind: "matched", citations: stored, old: null };
  const pack = readPack(row.meta);
  const earlier = row.earlier.flatMap(({ meta, at }) => {
    const from = readPack(meta);
    return from === null ? [] : [{ pack: from, at }];
  });
  if (pack !== null) return { kind: "matched", citations: citationsOf(row.bodyMd, pack, earlier, null, blocks), old: null };
  if (row.writtenAt >= PACK_SINCE) return { kind: "unread" };
  const fact = readRecordedFact(row.groundedFact);
  const saved: SavedSources = {
    fact: fact === null || fact.url === "" ? null : { passage: fact.passage, url: fact.url, readAt: fact.readAt?.toISOString() ?? null },
    market: passagesAt((row.meta as { marketFacts?: unknown } | null)?.marketFacts),
  };
  return { kind: "matched", citations: citationsOf(row.bodyMd, null, [], saved, blocks), old: row.writtenAt };
}

// ── the numbers, in the app's view of the body only ─────────────────────

const OPEN = "\uE000";
const OPENED = "\uE001";
const SHUT = "\uE002";
const SHUTTED = "\uE003";

/** The blocks with each sourced sentence bracketed, so its span and number can follow the one serialiser's escape. */
export function bracketed(blocks: readonly Block[], sentences: readonly (number | null)[]): Block[] {
  const out = blocks.map((block) => (block.kind === "list" ? { ...block, items: [...block.items] } : block));
  let at = 0;
  for (const { block, item, run } of runsOf(blocks)) {
    const marked = segmentsOf(run).flatMap((segment): Inline[] => {
      if (blank(segment)) return segment;
      const n = sentences[at++] ?? null;
      if (n === null) return segment;
      // The space after a sentence stays after its number.
      const last = segment.at(-1);
      const gap = last?.kind === "text" ? (/\s+$/.exec(last.text)?.[0] ?? "") : "";
      const body = last?.kind === "text" && gap !== "" ? [...segment.slice(0, -1), { kind: "text" as const, text: last.text.slice(0, -gap.length) }] : segment;
      return [{ kind: "text", text: `${OPEN}${n}${OPENED}` }, ...body, { kind: "text", text: `${SHUT}${n}${SHUTTED}${gap}` }];
    });
    const target = out[block]!;
    if (target.kind === "list" && item !== null) (target.items as (readonly Inline[])[])[item] = marked;
    else if (target.kind === "paragraph" || target.kind === "quote") out[block] = { ...target, children: marked };
  }
  return out;
}

/** The serialised body with each bracket made a sentence span and the number after it, a button named for its kind. */
export function numbered(html: string, label: (n: number) => { name: string; site: boolean }): string {
  return html
    .replace(new RegExp(`${OPEN}(\\d+)${OPENED}`, "g"), (_, n: string) => `<span data-cites="${n}" tabindex="-1">`)
    .replace(new RegExp(`${SHUT}(\\d+)${SHUTTED}`, "g"), (_, n: string) => {
      const { name, site } = label(Number(n));
      const tone = site ? "text-primary" : "text-base-content/70";
      return `</span><button type="button" class="btn btn-ghost btn-xs min-w-6 px-1 align-baseline ${tone}" data-source="${n}" aria-label="${name}">${n}</button>`;
    });
}
