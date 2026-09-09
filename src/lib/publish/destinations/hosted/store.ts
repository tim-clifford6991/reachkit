// BUILD §9 — everything the hosted edge reads, in one place.
//
// The edge answers on a stranger's domain with no session, no cookie and
// no payment, so it reads through `publishDb()` (the admin client) and
// **writes nothing at all**: nothing under `src/app/(hosted)/` can advance
// the state machine, and nothing here gives it a way to.
//
// **Two select lists and no third.** Every column named below is one the
// page, the sitemap or §9's page record needs; `sites.user_id`,
// `destinations.config` and every other credential-adjacent column is
// absent by construction rather than by care taken at the call site.
//
// **"Live" is one predicate, written once**: a `hosted` publication that
// has a `published_at` and no `unpublished_at`. The page render, the
// sitemap and the 410 all read it from here, so an unpublished page cannot
// be gone from one and present in another.
//
// The archived plans are WO-229 (the host resolution this feeds) and
// WO-230/WO-231 (the page and the sitemap).
import { readRecordedFact, type RecordedFact } from "@/lib/generate/fact";
import { publishDb } from "../../db";

/** A site, as the edge sees it: an id and the domain that resolved to it.
 *  There is nothing about its owner on this shape. */
export interface HostedSite {
  siteId: string;
  domain: string;
}

/** §9: "Every published page records: opportunity id, target query,
 *  measurement date, approved-vs-autopilot, live URL." Five members, and
 *  the type is what makes the sentence checkable — a record missing one of
 *  them does not typecheck.
 *
 *  `measuredOn` is nullable because it is the date of the scan the
 *  opportunity was derived from, and a scan row that has been purged
 *  leaves a page whose measurement date is genuinely unknown. `null` says
 *  that; a fabricated date would not. */
export interface PublishedPageRecord {
  opportunityId: string;
  targetQuery: string;
  measuredOn: Date | null;
  mode: "approved" | "autopilot";
  liveUrl: string;
}

/** One question-and-answer pair, as `drafts.meta.faq` holds it.
 *
 *  **Read from the stored meta, never parsed out of the body** (the
 *  archived BP-047 decision 2): a heading heuristic that is wrong emits
 *  schema claiming a question-and-answer section that is not there, which
 *  is a structured false statement on the customer's own domain. */
export interface FaqEntry {
  question: string;
  answer: string;
}

/**
 * Who the page is published by, as the edge can know it (UI-SPEC S19).
 *
 * §14.6: "Customer is publisher of record: their domain, their identity."
 * The set draws a brand mark, a brand name, a category eyebrow and a
 * byline on this surface, and this is every fact behind them.
 *
 * **`name` is the customer's domain, because that is the identity this
 * product holds.** No column carries a trading name — setup asks for a
 * domain, a category, competitors, a voice and a do-not-claim list, and
 * none of those is a brand — and a name derived from anything else would
 * be a name the customer never gave, printed as theirs on their own site.
 * The domain is the one identity fact they did give.
 *
 * `category` and `timeZone` are nullable because both columns are: a site
 * that stated no category draws no eyebrow, and one that stated no zone
 * has its publication date written in UTC rather than in a zone this
 * product picked for it (REQ-073 c1).
 */
export interface HostedPublisher {
  name: string;
  category: string | null;
  timeZone: string | null;
}

/**
 * §8's grounded fact, as generation recorded it on the page.
 *
 * The set marks the passage inside the body and states its source under
 * it. Read from `drafts.grounded_fact` — the column §8 hard rule 1 freezes
 * — and never from anywhere else: a passage the page is not grounded in,
 * marked as though it were, is a claim about the evidence.
 *
 * **The one shape, not this module's own** (issue #415): `RecordedFact` is
 * what `src/lib/generate/fact.ts` writes and what the draft view reads, so
 * what the customer approved and what a visitor is shown cannot be two
 * different records. The name stays because this module speaks it.
 *
 * `null` for a page generation recorded no grounding for; the body then
 * renders whole and unmarked and no source line is drawn, which is what a
 * page with no recorded source honestly is.
 */
export type HostedGrounding = RecordedFact;

/** One live hosted page. `slug` is the last segment of the address the
 *  page was actually published at, so the address the customer's visitor
 *  typed and the address recorded on the row cannot drift apart. */
export interface HostedPage {
  publicationId: string;
  siteId: string;
  slug: string;
  title: string;
  bodyMd: string;
  faq: readonly FaqEntry[];
  /** What the page is grounded in, or `null` where nothing was recorded. */
  grounded: HostedGrounding | null;
  /** Whose page it is — the header, the eyebrow, the byline and the
   *  footer are drawn from this and from nothing else. */
  publisher: HostedPublisher;
  publishedAt: Date;
  liveUrl: string;
  record: PublishedPageRecord;
}

interface SiteRow {
  id: string;
  domain: string;
}

interface PublicationRow {
  id: string;
  site_id: string;
  live_url: string | null;
  published_at: string | null;
  mode: "approved" | "autopilot";
  sites: { domain: string | null; category: string | null; timezone: string | null } | null;
  drafts: {
    title: string | null;
    body_md: string | null;
    meta: Record<string, unknown> | null;
    grounded_fact: Record<string, unknown> | null;
    opportunity_id: string;
    opportunities: {
      id: string;
      target_query: string;
      scans: { created_at: string } | null;
    } | null;
  } | null;
}

/** The one select list for a live page. It reaches through the two
 *  relationships §9's page record needs and no others. */
const PAGE_COLUMNS =
  "id, site_id, live_url, published_at, mode, " +
  // The publisher's own three, and nothing else off `sites`: the domain is
  // the name S19 draws, the category is its eyebrow, and the zone is what
  // the byline's date is written in. `user_id` and every
  // credential-adjacent column stay absent by construction.
  "sites!inner(domain, category, timezone), " +
  "drafts!inner(title, body_md, meta, grounded_fact, opportunity_id, " +
  "opportunities!inner(id, target_query, scans(created_at)))";

/**
 * The site whose hosted pages are served on this domain, or `null`.
 *
 * **Exact match, one lookup, and no fallback of any kind.** An unclaimed
 * domain resolves to nothing — never to "the only site there is", never to
 * a default. That is what makes the unknown-Host 404 a property of this
 * function rather than a branch someone has to remember to write.
 */
export async function hostedSiteForDomain(domain: string): Promise<HostedSite | null> {
  const name = domain.trim().toLowerCase();
  if (name === "") return null;
  const { data, error } = await publishDb()
    .from<SiteRow>("sites")
    .select("id, domain")
    .eq("domain", name)
    .limit(1);
  if (error !== null || data === null) return null;
  const row = data[0];
  return row === undefined ? null : { siteId: row.id, domain: row.domain };
}

function slugOf(liveUrl: string): string | null {
  const marker = liveUrl.lastIndexOf("/");
  if (marker < 0) return null;
  const slug = liveUrl.slice(marker + 1);
  return slug === "" ? null : slug;
}

function toPage(row: PublicationRow): HostedPage | null {
  const draft = row.drafts;
  const opportunity = draft?.opportunities ?? null;
  if (draft === null || opportunity === null) return null;
  if (row.live_url === null || row.published_at === null) return null;
  const slug = slugOf(row.live_url);
  if (slug === null) return null;

  const measured = opportunity.scans?.created_at ?? null;
  const domain = row.sites?.domain ?? null;
  // A publication whose site has no domain has no publisher to name and no
  // address it could have been served at. `null`, like every other row this
  // function cannot compose a whole page from — never a page with a blank
  // where the customer's own name goes.
  if (domain === null || domain.trim() === "") return null;

  return {
    publicationId: row.id,
    siteId: row.site_id,
    slug,
    title: draft.title ?? "",
    bodyMd: draft.body_md ?? "",
    faq: readFaq(draft.meta),
    grounded: readRecordedFact(draft.grounded_fact),
    publisher: {
      name: domain,
      category: emptyToNull(row.sites?.category ?? null),
      timeZone: emptyToNull(row.sites?.timezone ?? null),
    },
    publishedAt: new Date(row.published_at),
    liveUrl: row.live_url,
    record: {
      opportunityId: opportunity.id,
      targetQuery: opportunity.target_query,
      measuredOn: measured === null ? null : new Date(measured),
      mode: row.mode,
      liveUrl: row.live_url,
    },
  };
}

/** `drafts.meta.faq`, read defensively: a meta blob is jsonb and nothing
 *  in the database constrains its shape, so an entry missing either half
 *  is dropped rather than emitted as a question with no answer. An absent
 *  or empty section yields an empty array, and the caller emits no markup
 *  at all for one — never an empty `FAQPage`. */
export function readFaq(meta: Record<string, unknown> | null): readonly FaqEntry[] {
  const raw = meta?.faq;
  if (!Array.isArray(raw)) return [];
  const entries: FaqEntry[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const { question, answer } = item as { question?: unknown; answer?: unknown };
    if (typeof question !== "string" || typeof answer !== "string") continue;
    if (question.trim() === "" || answer.trim() === "") continue;
    entries.push({ question, answer });
  }
  return Object.freeze(entries);
}

/** A stated value, or `null` — an empty string is not a category and not a
 *  zone, and a surface that drew one would draw an empty eyebrow. */
function emptyToNull(value: string | null): string | null {
  return value === null || value.trim() === "" ? null : value;
}

/**
 * Every live hosted page of one site, newest first.
 *
 * The sitemap is exactly this list, and the page render finds its page in
 * it — one predicate, one query, so a page cannot be absent from the
 * sitemap and present at its address, or the reverse.
 */
export async function livePagesForSite(siteId: string): Promise<HostedPage[]> {
  const { data, error } = await publishDb()
    .from<PublicationRow>("publications")
    .select(PAGE_COLUMNS)
    .eq("site_id", siteId)
    .eq("destination", "hosted")
    .not("published_at", "is", null)
    .is("unpublished_at", null)
    .order("published_at", { ascending: false });
  if (error !== null || data === null) return [];
  return data.map(toPage).filter((page): page is HostedPage => page !== null);
}

/**
 * One live hosted page of one site, by the slug in the visitor's address.
 *
 * Matched in this process rather than in the query because the slug is the
 * last segment of `live_url` and the narrow query builder this subsystem
 * reaches Postgres through carries no pattern operator. A site publishes
 * at most one page a day and eight a week (§9), so the list this walks is
 * the site's whole published history and is small by the product's own
 * hard limits — not by an assumption about customer behaviour.
 */
export async function livePageBySlug(siteId: string, slug: string): Promise<HostedPage | null> {
  const pages = await livePagesForSite(siteId);
  return pages.find((page) => page.slug === slug) ?? null;
}

/**
 * Whether this site has ever served a page at this slug and has stopped.
 *
 * The 410's own fact. `unpublished_at` is the whole test: an address that
 * served a page and no longer does is `Gone`, and an address that never
 * served one is not — it is a 404, and answering 410 for it would be a
 * claim about a page that never existed.
 */
export async function wasEverLive(siteId: string, slug: string): Promise<boolean> {
  const { data, error } = await publishDb()
    .from<{ live_url: string | null }>("publications")
    .select("live_url")
    .eq("site_id", siteId)
    .eq("destination", "hosted")
    .not("unpublished_at", "is", null);
  if (error !== null || data === null) return false;
  return data.some((row) => row.live_url !== null && slugOf(row.live_url) === slug);
}

/**
 * The site a draft belongs to, and the domain its hosted pages are served
 * on.
 *
 * The hosted adapter's one read. `deliver` is handed a rendered page, a
 * config and the draft id, and none of the three carries the customer's
 * own domain — which is the one thing a hosted address cannot be composed
 * without. A site with no domain yet answers `null` here, and the delivery
 * fails with a reason rather than composing an address on a blank.
 */
export async function siteForDraft(draftId: string): Promise<HostedSite | null> {
  const { data, error } = await publishDb()
    .from<{ site_id: string; sites: { domain: string | null } | null }>("drafts")
    .select("site_id, sites!inner(domain)")
    .eq("id", draftId)
    .single();
  if (error !== null || data === null) return null;
  const domain = data.sites?.domain ?? null;
  if (domain === null || domain.trim() === "") return null;
  return { siteId: data.site_id, domain };
}
