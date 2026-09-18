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
import { liveUrlOnHost } from "./address";
import { hostFor } from "./label";
import type { HostedOwnPages } from "./own-page";

/** A site, as the edge sees it: an id and the domain that resolved to it.
 *  There is nothing about its owner on this shape. */
export interface HostedSite {
  siteId: string;
  domain: string;
  /** The host this site's pages are served at — `<label>.<domain>`, as the
   *  customer chose it (SPEC §5, 2026-09-12). Composed from the stored
   *  label where the destination row carries one and from the default
   *  where it does not, so a row written before the label became a choice
   *  still names the host it has always served at. */
  host: string;
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
 *  typed and the address recorded on the row cannot drift apart.
 *
 *  **`liveUrl` is that slug on the host the page is being addressed on
 *  now**, not the address stored when it was published (SPEC §7,
 *  2026-09-18, issue 888). A hosted page is its `publications` row and the
 *  row belongs to a *site*; the host is the site's, and a site whose host
 *  changed under its live pages serves every one of them at the new
 *  address. So the canonical the page declares, the entry its sitemap
 *  carries and the address §9's record names are one string composed from
 *  the resolving host — a stored address that no longer answers is never
 *  one of them. */
export interface HostedPage {
  publicationId: string;
  siteId: string;
  slug: string;
  title: string;
  bodyMd: string;
  /** The description generation wrote for this page (`drafts.meta.description`),
   *  or `null` for a draft that has none stored. */
  description: string | null;
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

/** A live hosted destination and the site it belongs to, as the Host
 *  lookup reads it. No credential-adjacent column is named. */
interface DestinationHostRow {
  site_id: string;
  hostname: string | null;
  sites: { domain: string | null } | null;
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
  if (row === undefined) return null;
  return { siteId: row.id, domain: row.domain, host: hostFor({ label: null, domain: row.domain }) };
}

/**
 * The site whose hosted pages are served on this **host**, or `null`.
 *
 * SPEC §5's ruling of 2026-09-12 made the subdomain label the customer's,
 * so a Host header is no longer a pinned label over a domain this product
 * can take apart — `blog.example.com` and `news.example.com` are two
 * customers' choices and neither is derivable from the other. The host is
 * stored whole on the destination row and matched whole here.
 *
 * **Exact match, one lookup, no fallback of any kind** — the property
 * `hostedSiteForDomain` has and for the same reason: an unclaimed host
 * resolves to nothing, never to "the only site there is". The partial
 * unique index means at most one live destination claims a host, so this
 * has exactly one answer.
 */
export async function hostedSiteForHostname(host: string): Promise<HostedSite | null> {
  const name = host.trim().toLowerCase();
  if (name === "") return null;
  const { data, error } = await publishDb()
    .from<DestinationHostRow>("destinations")
    .select("site_id, hostname, sites!inner(domain)")
    .eq("hostname", name)
    .eq("kind", "hosted")
    .is("deleted_at", null)
    .limit(1);
  if (error !== null || data === null) return null;
  const row = data[0];
  if (row === undefined) return null;
  const domain = row.sites?.domain ?? null;
  if (domain === null || domain.trim() === "") return null;
  return { siteId: row.site_id, domain, host: name };
}

function slugOf(liveUrl: string): string | null {
  const marker = liveUrl.lastIndexOf("/");
  if (marker < 0) return null;
  const slug = liveUrl.slice(marker + 1);
  return slug === "" ? null : slug;
}

function toPage(row: PublicationRow, host: string): HostedPage | null {
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

  // The one composer, on the host that resolved: see `HostedPage.liveUrl`.
  const liveUrl = liveUrlOnHost({ host, slug });

  return {
    publicationId: row.id,
    siteId: row.site_id,
    slug,
    title: draft.title ?? "",
    bodyMd: draft.body_md ?? "",
    description: readDescription(draft.meta),
    faq: readFaq(draft.meta),
    grounded: readRecordedFact(draft.grounded_fact),
    publisher: {
      name: domain,
      category: emptyToNull(row.sites?.category ?? null),
      timeZone: emptyToNull(row.sites?.timezone ?? null),
    },
    publishedAt: new Date(row.published_at),
    liveUrl,
    record: {
      opportunityId: opportunity.id,
      targetQuery: opportunity.target_query,
      measuredOn: measured === null ? null : new Date(measured),
      mode: row.mode,
      liveUrl,
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

/** `drafts.meta.description`, read as defensively as the FAQ: a blank or
 *  non-string value is no description, never an empty meta tag. */
export function readDescription(meta: Record<string, unknown> | null): string | null {
  const raw = meta?.description;
  if (typeof raw !== "string") return null;
  const text = raw.replace(/\s+/g, " ").trim();
  return text === "" ? null : text;
}

/** A stated value, or `null` — an empty string is not a category and not a
 *  zone, and a surface that drew one would draw an empty eyebrow. */
function emptyToNull(value: string | null): string | null {
  return value === null || value.trim() === "" ? null : value;
}

/**
 * Every live hosted page of one site, newest first, addressed on `host`.
 *
 * The sitemap is exactly this list, and the page render finds its page in
 * it — one predicate, one query, so a page cannot be absent from the
 * sitemap and present at its address, or the reverse.
 *
 * **`host` is an argument and not a column** (SPEC §7, 2026-09-18, issue
 * 888). Every caller has already resolved the host this site is being
 * served at — the edge from the Host header, the adapter from the site's
 * destination row — and passing it is what makes "the address a page
 * states is the address it answers at" hold by construction rather than by
 * a stored string staying true. A host that changed under live pages
 * re-addresses all of them here, in one place.
 *
 * **One page per address** (issue 781): an update of a hosted page is a new
 * publication at the same slug, so the newest live row at a slug is the page
 * and every older one is a version it replaced — never listed beside it.
 */
export async function livePagesForSite(siteId: string, host: string): Promise<HostedPage[]> {
  const { data, error } = await publishDb()
    .from<PublicationRow>("publications")
    .select(PAGE_COLUMNS)
    .eq("site_id", siteId)
    .eq("destination", "hosted")
    .not("published_at", "is", null)
    .is("unpublished_at", null)
    .order("published_at", { ascending: false });
  if (error !== null || data === null) return [];
  const seen = new Set<string>();
  return data
    .map((row) => toPage(row, host))
    .filter((page): page is HostedPage => page !== null)
    .filter((page) => {
      if (seen.has(page.slug)) return false;
      seen.add(page.slug);
      return true;
    });
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
export async function livePageBySlug(
  siteId: string,
  slug: string,
  host: string
): Promise<HostedPage | null> {
  const pages = await livePagesForSite(siteId, host);
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
  // The host the customer chose, where they chose one. A site whose
  // destination row carries none is served at the default label, which is
  // the host it has always been served at — never a blank first label.
  const chosen = await hostnameOfSite(data.site_id);
  return {
    siteId: data.site_id,
    domain,
    host: chosen ?? hostFor({ label: null, domain }),
  };
}

/**
 * The pages a site's hosted destination could update (issue 781): its host and
 * the slugs live there. `null` where the site's live destination is not
 * hosted — that destination answers for itself.
 *
 * A read that fails is a hosted site with no page to update, never a guess
 * that it is not hosted: an update is offered only where it can be
 * delivered.
 */
export async function hostedOwnPagesOfSite(siteId: string): Promise<HostedOwnPages | null> {
  const NONE: HostedOwnPages = { host: "", slugs: [] };
  const { data, error } = await publishDb()
    .from<{ kind: string; hostname: string | null; sites: { domain: string | null } | null }>("destinations")
    .select("kind, hostname, sites!inner(domain)")
    .eq("site_id", siteId)
    .is("deleted_at", null)
    .limit(1);
  if (error !== null || data === null) return NONE;
  const row = data[0];
  if (row === undefined || row.kind !== "hosted") return null;
  const domain = row.sites?.domain ?? null;
  if (domain === null || domain.trim() === "") return NONE;
  const chosen = row.hostname === null || row.hostname.trim() === "" ? null : row.hostname.trim().toLowerCase();
  const host = chosen ?? hostFor({ label: null, domain });
  const pages = await livePagesForSite(siteId, host);
  return { host, slugs: pages.map((page) => page.slug) };
}

/**
 * The host a site's hosted pages are served at **now**, or `null` where no
 * host can be read at all (SPEC §7, 2026-09-18, issue 888).
 *
 * The stored host where the destination row carries one, and the default
 * label over the site's own domain where it does not — the same two arms
 * `siteForDraft` composes a delivery address from, so the address a page is
 * published at and the address it is re-addressed at later are decided the
 * same way. `null` is "we cannot say", and every caller keeps the address
 * it already had rather than composing one on a blank.
 */
export async function hostedHostOfSite(siteId: string): Promise<string | null> {
  const chosen = await hostnameOfSite(siteId);
  if (chosen !== null) return chosen;
  const { data, error } = await publishDb()
    .from<SiteRow>("sites")
    .select("id, domain")
    .eq("id", siteId)
    .limit(1);
  if (error !== null || data === null) return null;
  const domain = data[0]?.domain ?? null;
  if (domain === null || domain.trim() === "") return null;
  return hostFor({ label: null, domain });
}

/**
 * The address one hosted publication answers at **now**.
 *
 * What the 24-hour check fetches and what the `published` mail links, for a
 * page whose host may have moved under it since it was published (SPEC §7,
 * 2026-09-18, issue 888). The slug is the one the page was published at —
 * that never moves — and the host is the site's current one.
 *
 * **It falls back to the stored address, never to a blank.** A host that
 * cannot be read is not a reason to fetch nothing or to link nowhere; it is
 * a reason to use the last address we know, which is what the row holds.
 */
export async function hostedAddressNow(a: {
  siteId: string;
  liveUrl: string;
}): Promise<string> {
  const slug = slugOf(a.liveUrl);
  if (slug === null) return a.liveUrl;
  const host = await hostedHostOfSite(a.siteId);
  return host === null ? a.liveUrl : liveUrlOnHost({ host, slug });
}

/** The host a site's live hosted destination serves at, or `null`. Read
 *  here rather than through `hostname.ts` so that the delivery path — and
 *  everything else the edge's module graph reaches — stays clear of the
 *  vendor seam. */
async function hostnameOfSite(siteId: string): Promise<string | null> {
  const { data, error } = await publishDb()
    .from<{ hostname: string | null }>("destinations")
    .select("hostname")
    .eq("site_id", siteId)
    .eq("kind", "hosted")
    .is("deleted_at", null)
    .limit(1);
  if (error !== null || data === null) return null;
  const host = data[0]?.hostname ?? null;
  return host === null || host.trim() === "" ? null : host.trim().toLowerCase();
}
