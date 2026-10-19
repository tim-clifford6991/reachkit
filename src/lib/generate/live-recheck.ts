// SPEC §7 (issue 1485) — the live pages, re-checked against the rival rules.
//
// Found live: content.reachkit.app/profound-alternatives set Profound's free
// trial out as the product, cited a reviewer's "$99" beside Profound's own
// pricing page, and its FAQ said Profound has no free tier. The rules that
// would have stopped it are new (`./rules/rivals.ts`): a rival's claim keeps
// its plan and its own page (`rival_source`), and nothing is denied of a
// rival that no source denies (`rival_negative`).
//
// A page written before them is read again here, **from its own row** — the
// body, the FAQ beside it and the market facts its pack recorded, each with
// the rival it is from or about. Nothing is fetched and no model is asked:
// 0¢. A page that fails is withdrawn through `unpublish()`, the same edge
// the customer's own stop takes, by the system actor `content/recheck`; at a
// hosted address the edge then answers 410, as for any page taken down
// (issue 1458). It is never left live with a false rival claim, and it is
// never corrected by a direct row edit (ADR-080).
//
// A page the customer edited is theirs: its words are read by the rules
// when they save it, and not here.
//
// A page written since carries `meta.rivalScope`: the battery that let it
// through already asked both rules of it, so it is not read again.
import { restWithdrawn } from "@/lib/publish/take-down/standing";
import type { MarketFactRead } from "./rules/brief";
import { checkRivalNegative, checkRivalScope, namedRivals, type NamedRival } from "./rules/rivals";
import { withoutReferenceLists } from "./rules/text";
import type { RuleFailure } from "./rules/types";

/** What `meta.rivalScope` holds on a page the rival rules of issue 1485
 *  were asked of when it was written. */
export const RIVAL_SCOPE_VERSION = 1;

/** One live page as its row stores it. */
export interface StoredLivePage {
  draftId: string;
  liveUrl: string;
  markdown: string;
  faq: readonly { question: string; answer: string }[];
  rivals: readonly NamedRival[];
  marketFacts: readonly MarketFactRead[];
  /** The older versions still live at the same address, which the newest
   *  replaced. A withdrawal takes them too: otherwise the address would
   *  serve the version before. */
  olderVersions?: readonly string[];
}

/** What the two rules find on a stored page. Pure. */
export function recheckLivePage(page: StoredLivePage): RuleFailure[] {
  const markdown = withoutReferenceLists(page.markdown);
  return [
    checkRivalScope({ markdown, rivals: page.rivals, facts: page.marketFacts }),
    checkRivalNegative({ markdown, faq: page.faq, rivals: page.rivals, facts: page.marketFacts }),
  ].filter((failure): failure is RuleFailure => failure !== null);
}

const record = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

function factsOf(value: unknown): MarketFactRead[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const fact = record(item);
    if (typeof fact.url !== "string" || typeof fact.passage !== "string") return [];
    return [
      {
        url: fact.url,
        passage: fact.passage,
        ...(typeof fact.kind === "string" ? { kind: fact.kind } : {}),
        ...(typeof fact.product === "string" ? { product: fact.product } : {}),
        ...(typeof fact.about === "string" ? { about: fact.about } : {}),
        ...(typeof fact.plan === "string" || fact.plan === null ? { plan: fact.plan as string | null } : {}),
      },
    ];
  });
}

/**
 * The page as the rules read it, from its draft's `meta`: the pack's claims
 * where the pack was stored (each with the rival whose page it is), else the
 * market facts recorded beside it; the rivals the pack named, with the names
 * its market gave them. `null` for a page the rules have nothing to ask of —
 * one the customer edited, one already checked when it was written, or one
 * with no rival.
 */
export function storedLivePage(row: {
  draftId: string;
  liveUrl: string;
  markdown: string;
  meta: unknown;
  competitors: readonly string[];
}): StoredLivePage | null {
  const meta = record(row.meta);
  if (typeof meta.first_edited_at === "string" || meta.rivalScope === RIVAL_SCOPE_VERSION) return null;
  const pack = record(meta.pack);
  const business = record(pack.business);
  const domains = Array.isArray(business.rivals) ? business.rivals.filter((rival): rival is string => typeof rival === "string") : [...row.competitors];
  const rivals = namedRivals(domains, business.market ?? null);
  if (rivals.length === 0) return null;
  const claims = factsOf(pack.claims);
  const faq = Array.isArray(meta.faq)
    ? meta.faq.flatMap((item) => {
        const entry = record(item);
        return typeof entry.question === "string" && typeof entry.answer === "string" ? [{ question: entry.question, answer: entry.answer }] : [];
      })
    : [];
  return {
    draftId: row.draftId,
    liveUrl: row.liveUrl,
    markdown: row.markdown,
    faq,
    rivals,
    marketFacts: claims.length > 0 ? claims : factsOf(meta.marketFacts),
  };
}

export interface RecheckOutcome {
  checked: number;
  /** Each page taken down, by address, with the rules it failed. */
  withdrawn: { draftId: string; liveUrl: string; rules: string[] }[];
  /** A page that failed and whose unpublish did not complete: still live,
   *  and read again on the next tick. */
  stillLive: string[];
}

export interface RecheckDeps {
  livePages: () => Promise<StoredLivePage[]>;
  withdraw: (draftId: string, at: Date) => Promise<boolean>;
  /** Rests the topics the withdrawn drafts were written for until `until`
   *  (issue 1549). */
  rest?: (draftIds: readonly string[], until: Date) => Promise<void>;
}

/** Every live page read again, and each that fails withdrawn. A failed
 *  read withdraws nothing; a failed withdrawal is read again next time. */
export async function withdrawFailingPages(a: { now: Date; deps?: RecheckDeps }): Promise<RecheckOutcome> {
  const deps = a.deps ?? (await defaultDeps());
  const pages = await deps.livePages();
  const outcome: RecheckOutcome = { checked: pages.length, withdrawn: [], stillLive: [] };
  for (const page of pages) {
    const failed = recheckLivePage(page);
    if (failed.length === 0) continue;
    const rules = failed.map((failure) => failure.rule);
    let down = await deps.withdraw(page.draftId, a.now);
    for (const older of page.olderVersions ?? []) down = (await deps.withdraw(older, a.now)) && down;
    if (down) outcome.withdrawn.push({ draftId: page.draftId, liveUrl: page.liveUrl, rules });
    else outcome.stillLive.push(page.liveUrl);
    // Issue 1549: the page is down, so its topic is not left `queued`; it
    // rests as a stopped one does and may be written again under the rules.
    if (down && deps.rest !== undefined) await restWithdrawn({ rest: deps.rest }, [page.draftId, ...(page.olderVersions ?? [])], a.now);
  }
  console.log(
    JSON.stringify({
      event: "live_rival_recheck",
      checked: outcome.checked,
      withdrawn: outcome.withdrawn.map((page) => ({ url: page.liveUrl, rules: page.rules })),
      stillLive: outcome.stillLive,
    })
  );
  return outcome;
}

interface LiveRow {
  draft_id: string;
  live_url: string | null;
  published_at: string;
  site_id: string;
  drafts: { body_md: string | null; meta: unknown } | null;
}

async function defaultDeps(): Promise<RecheckDeps> {
  const { publishDb } = await import("@/lib/publish/db");
  const { unpublish } = await import("@/lib/publish/attempt/unpublish");
  const { restTopicsOfDrafts } = await import("@/lib/publish/attempt/take-down");
  return {
    rest: restTopicsOfDrafts,
    async livePages() {
      const db = publishDb();
      const live = await db
        .from<LiveRow>("publications")
        .select("draft_id, live_url, published_at, site_id, drafts(body_md, meta)")
        .not("published_at", "is", null)
        .is("unpublished_at", null);
      if (live.error !== null || live.data === null) throw new Error(`live-recheck: reading publications: ${live.error?.message ?? "no rows"}`);
      const sites = [...new Set(live.data.map((row) => row.site_id))];
      const competitors = new Map<string, string[]>();
      for (const siteId of sites) {
        const site = await db.from<{ competitors: unknown }>("sites").select("competitors").eq("id", siteId);
        const stored = site.data?.[0]?.competitors;
        competitors.set(siteId, Array.isArray(stored) ? stored.filter((rival): rival is string => typeof rival === "string") : []);
      }
      // An address's newest version is the one it serves; an older one live
      // at the same address is a version a refresh already replaced.
      const newest = new Map<string, LiveRow>();
      const versions = new Map<string, string[]>();
      for (const row of live.data) {
        if (row.live_url === null) continue;
        versions.set(row.live_url, [...(versions.get(row.live_url) ?? []), row.draft_id]);
        const held = newest.get(row.live_url);
        if (held === undefined || row.published_at > held.published_at) newest.set(row.live_url, row);
      }
      return [...newest.values()].flatMap((row) => {
        if (row.live_url === null || row.drafts === null) return [];
        const page = storedLivePage({
          draftId: row.draft_id,
          liveUrl: row.live_url,
          markdown: row.drafts.body_md ?? "",
          meta: row.drafts.meta,
          competitors: competitors.get(row.site_id) ?? [],
        });
        if (page === null) return [];
        const older = (versions.get(row.live_url) ?? []).filter((draftId) => draftId !== row.draft_id);
        return [older.length === 0 ? page : { ...page, olderVersions: older }];
      });
    },
    async withdraw(draftId, at) {
      const result = await unpublish({ draftId, by: { kind: "system", job: "content/recheck" }, at });
      // `unreachable` took the edge too: the page is no longer live here.
      return result.ok;
    },
  };
}
