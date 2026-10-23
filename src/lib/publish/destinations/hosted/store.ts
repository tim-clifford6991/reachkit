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
import { madeCounts, type MadeCounts } from "../../render/made-counts";
import { readFaq, type FaqEntry } from "../../render/faq";
import { publishDb } from "../../db";
import { liveUrlOnHost } from "./address";
import { hostFor } from "./label";
import { addressOf, slugOf as addressSlug, type AddressRow, type HostedAddress } from "./moved";
import type { HostedOwnPages } from "./own-page";
import { storedSiteName } from "@/lib/site-profile/site-name";
import { mainSiteOf, type MainSite } from "@/lib/site-profile/main-site-row";

export { readFaq, type FaqEntry } from "../../render/faq";

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
  /** The page's H1 (SPEC §7, D51): the longer form generation wrote beside
   *  the title (`drafts.meta.heading`), or `null` where it wrote none and
   *  the title is the heading. */
  heading: string | null;
  bodyMd: string;
  /** The description generation wrote for this page (`drafts.meta.description`),
   *  or `null` for a draft that has none stored. */
  description: string | null;
  faq: readonly FaqEntry[];
  /** What the page is grounded in, or `null` where nothing was recorded. */
  grounded: HostedGrounding | null;
  /** SPEC §7 (2026-10-11, issue 1397): the two numbers of the note that
   *  says how the page was made, or `null` for a row that records no fact
   *  read from the site or no count of its rules. */
  made: MadeCounts | null;
  /** Whose page it is — the header, the eyebrow, the byline and the
   *  footer are drawn from this and from nothing else. */
  publisher: HostedPublisher;
  /** SPEC §7 (2026-09-29): the page's byline as generation recorded it
   *  (`drafts.attribution`), or `null` for a page with none. */
  byline: string | null;
  /** Written as the business's own service or product page
   *  (`drafts.meta.contentType`); absent reads as not. */
  offering?: boolean;
  /** SPEC §0 business fit of the page's opportunity, 0–3, or `null` where
   *  no pass judged it: only a 3 earns the compact block. */
  businessFit?: number | null;
  /** When this version went live. On a page that has been refreshed it is
   *  the update's date, and `firstPublishedAt` is the page's own. */
  publishedAt: Date;
  /** When the address first carried a page: the oldest live publication at
   *  this slug (issue 781 — an update is a new publication at the slug). */
  firstPublishedAt: Date;
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
    attribution: string | null;
    meta: Record<string, unknown> | null;
    grounded_fact: Record<string, unknown> | null;
    opportunity_id: string;
    opportunities: {
      id: string;
      target_query: string;
      business_fit: number | null;
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
  "drafts!inner(title, body_md, attribution, meta, grounded_fact, opportunity_id, " +
  "opportunities!inner(id, target_query, business_fit, scans(created_at)))";

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
    heading: readHeading(draft.meta),
    bodyMd: draft.body_md ?? "",
    description: readDescription(draft.meta),
    faq: readFaq(draft.meta),
    grounded: readRecordedFact(draft.grounded_fact),
    made: madeCounts(draft.meta, domain),
    publisher: {
      name: domain,
      category: emptyToNull(row.sites?.category ?? null),
      timeZone: emptyToNull(row.sites?.timezone ?? null),
    },
    byline: emptyToNull(draft.attribution ?? null),
    offering: draft.meta?.contentType === "offering",
    businessFit: opportunity.business_fit ?? null,
    publishedAt: datedAt(draft.meta) ?? new Date(row.published_at),
    firstPublishedAt: datedAt(draft.meta) ?? new Date(row.published_at),
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

/**
 * How the business is drawn on its own blog (SPEC §7, 2026-09-29, issue
 * 1140): the name it calls itself, whether a logo is kept for it, and one
 * line about it.
 */
export interface HostedIdentity {
  /** The name its stored profile gives it (`storedSiteName`), else the
   *  domain — the one name it gave. */
  name: string;
  /** The picture format of the kept logo, or `null` for a first-letter tile. */
  logoType: string | null;
  /** One line saying what the business does, or `null` where none is held. */
  line: string | null;
  /** What the scan read of the main site (issue 1511): its canonical home,
   *  its own Organization and the profiles it links. Absent or `null` where
   *  no pass kept one, and the pages then link the bare domain. */
  mainSite?: MainSite | null;
  /** What the adopted market says the business sells, in a buyer's words,
   *  and the one place it serves where it serves one: the compact block's
   *  headline. Absent or `null` where no market was adopted. */
  offer?: { category: string; place: string | null } | null;
}

interface IdentityRow {
  domain: string;
  site_name: string | null;
  home_title: string | null;
  logo_type: string | null;
  claims: unknown;
}

/** The adopted market off `sites.market`, read off the stored blob rather
 *  than through the market module, which this file must not put in the
 *  hosted graph. */
function marketOf(market: unknown): { job: string | null; offer: HostedIdentity["offer"] } {
  const current = (market as { current?: { job?: unknown; category?: unknown; serves?: { name?: unknown } | null } } | null)?.current;
  const text = (value: unknown): string | null => (typeof value === "string" ? emptyToNull(value) : null);
  const category = text(current?.category);
  return {
    job: text(current?.job),
    offer: category === null ? null : { category, place: text(current?.serves?.name) },
  };
}

/**
 * The identity of the site at `domain`. Three short columns of its profile,
 * and one line about the business: what it does — the founder's own wording
 * of that where they reworded it, else the job its market was concluded
 * with — else the first claim the profile kept. Never an answer to one of
 * setup's questions (SPEC §7, D53, issue 1268): those are notes for the
 * writer, and one was printed as the index's description. A read that fails
 * draws the domain and a tile; it never takes the page down.
 */
export async function hostedIdentity(a: { siteId: string; domain: string }): Promise<HostedIdentity> {
  const fallback: HostedIdentity = { name: a.domain, logoType: null, line: null };
  try {
    const { readBusinessEdits } = await import("@/lib/site-profile/business/edits");
    const [profile, site, edits, mainSite] = await Promise.all([
      publishDb()
        .from<IdentityRow>("site_profiles")
        .select("domain, site_name, home_title:inventory->0->>title, logo_type, claims")
        .eq("domain", a.domain)
        .limit(1),
      publishDb().from<{ market: unknown }>("sites").select("market").eq("id", a.siteId).limit(1),
      readBusinessEdits(a.siteId).catch(() => null),
      // Its own read: until issue 1511's column is applied, it is none and
      // the identity above still stands.
      Promise.resolve(
        publishDb().from<{ main_site: unknown }>("site_profiles").select("main_site").eq("domain", a.domain).limit(1)
      )
        .then((read) => (read.error === null ? mainSiteOf(read.data?.[0]?.main_site ?? null) : null))
        .catch(() => null),
    ]);
    const row = profile.data?.[0];
    const claim = Array.isArray(row?.claims)
      ? row.claims.find((entry): entry is string => typeof entry === "string" && entry.trim() !== "")
      : undefined;
    const market = marketOf(site.data?.[0]?.market);
    const job = emptyToNull(edits?.job ?? null) ?? market.job;
    return {
      // Issue 1511: the name the main site's own Organization markup gives
      // itself, where it gives one, so the page and its markup never
      // contradict the main site; else the stored brand.
      name: mainSite?.organization.name ?? (row === undefined ? null : storedSiteName(row, row.home_title)) ?? a.domain,
      logoType: emptyToNull(row?.logo_type ?? null),
      line: job ?? emptyToNull(claim ?? null),
      ...(mainSite === null ? {} : { mainSite }),
      ...(market.offer === null ? {} : { offer: market.offer }),
    };
  } catch {
    return fallback;
  }
}

/** `drafts.meta.description`, read as defensively as the FAQ: a blank or
 *  non-string value is no description, never an empty meta tag. */
export function readDescription(meta: Record<string, unknown> | null): string | null {
  const raw = meta?.description;
  if (typeof raw !== "string") return null;
  const text = raw.replace(/\s+/g, " ").trim();
  return text === "" ? null : text;
}

/** `drafts.meta.heading`, read the same way. */
/** The date a mended version keeps (SPEC §7, issue 1507): a version that
 *  only repaired its predecessor in code — a list counted again, a repeated
 *  link gone — is dated as that predecessor, so its updated date, its
 *  `dateModified` and its sitemap `lastmod` do not move. `null` for every
 *  other version, which is dated when it went live. */
function datedAt(meta: Record<string, unknown> | null): Date | null {
  const raw = meta?.datedAs;
  if (typeof raw !== "string") return null;
  const at = new Date(raw);
  return Number.isNaN(at.getTime()) ? null : at;
}

function readHeading(meta: Record<string, unknown> | null): string | null {
  const raw = meta?.heading;
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
  // Newest first, so the first row at a slug is the page and every later
  // one an older version of it — whose date is when the page was published.
  const bySlug = new Map<string, HostedPage>();
  for (const row of data) {
    const page = toPage(row, host);
    if (page === null) continue;
    const newest = bySlug.get(page.slug);
    if (newest === undefined) bySlug.set(page.slug, page);
    else if (page.publishedAt < newest.firstPublishedAt) newest.firstPublishedAt = page.publishedAt;
  }
  return [...bySlug.values()];
}

/**
 * One live hosted page of one site, by the slug in the visitor's address.
 *
 * Matched in this process rather than in the query because the slug is the
 * last segment of `live_url` and the narrow query builder this subsystem
 * reaches Postgres through carries no pattern operator. A site publishes
 * at most one page a day and seven a week (§9), so the list this walks is
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

export type { HostedAddress, HostedAddressState } from "./moved";

const NO_ADDRESS: HostedAddress = Object.freeze({ state: "none", publicationId: null });

/**
 * Whether this site serves a page at this slug, moved it to another, served
 * one and has stopped, or neither — the 301's and the 410's own facts, in
 * one read.
 *
 * **One narrow read, because it runs before routing on every request to a
 * customer's host** (issue 1194). It selects four short columns and the
 * address each row updates, so it costs one round trip however long the
 * site's pages are. The read it replaced was the whole page list, bodies
 * and all, followed by a second query, and on a cold function the pair
 * outlasted the caller's deadline — a taken-down address then answered 404.
 *
 * What each state means is `addressOf`'s (`./moved.ts`): live first, then
 * moved (issue 1487), then retired, else none.
 *
 * **A live address names its publication** (issue 1242): the middleware
 * counts an answer engine's read against it, and this is the only read it
 * makes.
 *
 * **A read that fails is `none`.** No answer is not a takedown.
 */
export async function hostedAddress(siteId: string, slug: string): Promise<HostedAddress> {
  const rows = await addressRows(siteId);
  return rows === null ? NO_ADDRESS : addressOf(rows, slug);
}

/** Every hosted publication of a site, as `addressOf` reads them; `null`
 *  where the read failed. */
async function addressRows(siteId: string): Promise<AddressRow[] | null> {
  type Row = {
    id: string;
    live_url: string | null;
    published_at: string | null;
    unpublished_at: string | null;
    merged_into?: string | null;
    drafts: { opportunities: { family: string | null; target_ref: string | null } | null } | null;
  };
  const read = (columns: string) =>
    publishDb().from<Row>("publications").select(columns).eq("site_id", siteId).eq("destination", "hosted");
  let { data, error } = await read("id, live_url, published_at, unpublished_at, merged_into, drafts(opportunities(family, target_ref))");
  // Until `merged_into` is applied (issue 1506's migration, after the
  // deploy), the read without it answers as before: no address is merged.
  if (error !== null) ({ data, error } = await read("id, live_url, published_at, unpublished_at, drafts(opportunities(family, target_ref))"));
  if (error !== null || data === null) return null;
  return data.map((row) => {
    const opportunity = row.drafts?.opportunities ?? null;
    return {
      id: row.id,
      live_url: row.live_url,
      published_at: row.published_at,
      unpublished_at: row.unpublished_at,
      updates: opportunity?.family === "improve" ? (opportunity.target_ref ?? null) : null,
      merged_into: row.merged_into ?? null,
    };
  });
}

/**
 * The slugs of a site's host that answer 410 (issue 1506): an address that
 * served a page and now serves none, by `addressOf`'s own reading — moved
 * and merged addresses answer 301 and are not among them. A read that fails
 * is none: a link is never unwrapped on a guess.
 */
export async function retiredSlugsForSite(siteId: string): Promise<ReadonlySet<string>> {
  const rows = await addressRows(siteId);
  if (rows === null) return new Set();
  const slugs = new Set(rows.flatMap((row) => (row.live_url === null ? [] : [addressSlug(row.live_url)])).filter((slug): slug is string => slug !== null));
  return new Set([...slugs].filter((slug) => addressOf(rows, slug).state === "retired"));
}

/**
 * The slugs of a site's host that answer 301, each with the slug it answers
 * with now (SPEC §7, 2026-10-18, issue 1511): a link to a moved address is
 * drawn at the page's final one, so no page links a redirect while the
 * `link` refresh is still weeks away. By `addressOf`'s own reading, the
 * same one the middleware's 301 makes. A read that fails is none, and never
 * throws: the link is then drawn as it was written, which still redirects.
 */
export async function movedSlugsForSite(siteId: string): Promise<ReadonlyMap<string, string>> {
  try {
    const rows = await addressRows(siteId);
    if (rows === null) return new Map();
    const slugs = new Set(rows.flatMap((row) => [row.live_url, row.updates]).map((url) => (url === null ? null : addressSlug(url))).filter((slug): slug is string => slug !== null));
    const moved = new Map<string, string>();
    for (const slug of slugs) {
      const address = addressOf(rows, slug);
      if (address.state === "moved" && address.slug !== slug) moved.set(slug, address.slug);
    }
    return moved;
  } catch {
    return new Map();
  }
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
  const addressNow = await hostedAddressesNow(a.siteId);
  return addressNow({ destination: "hosted", liveUrl: a.liveUrl });
}

/**
 * One publication's address now, given the destination it was delivered to
 * and the address it was published at.
 *
 * Pure: the host it composes on was read once for the whole site. A
 * destination that is not `hosted` hands its stored address straight back.
 */
export type AddressNow = (row: { destination: string | null; liveUrl: string }) => string;

/**
 * The re-addresser for one whole site (issue 896).
 *
 * `hostedAddressNow` answers for one publication and costs a read. The
 * calendar draws a month of them, the Monday verdicts judge every page a
 * site has live, and a generated page cross-links to several — so the host
 * is read **once for the site** and then applied, and a screen showing
 * thirty pages costs one query rather than thirty.
 *
 * **The `hosted` test is inside, not at each caller.** A WordPress page is
 * on a host this product does not own: its stored address is the only one
 * there is, and composing another would be a guess about somebody else's
 * site (SPEC §7, 2026-09-18, issue 888). Keeping that distinction in the
 * one composer is what stops the fourth reader from forgetting it.
 *
 * **It falls back to the stored address, never to a blank** — a host that
 * cannot be read is a reason to use the last address we know, which is
 * what the row holds.
 */
export async function hostedAddressesNow(siteId: string): Promise<AddressNow> {
  const host = await hostedHostOfSite(siteId);
  return (row) => {
    if (row.destination !== "hosted" || host === null) return row.liveUrl;
    const slug = slugOf(row.liveUrl);
    return slug === null ? row.liveUrl : liveUrlOnHost({ host, slug });
  };
}

/**
 * The re-addresser for an address that was **copied off** a publication
 * (issue 1182).
 *
 * `hostedAddressesNow` is handed a publication row and knows its
 * destination. A refresh's `target_ref` is not a row: it is the address the
 * page had on the day the refresh was derived, written onto an opportunity,
 * and a host that moves afterwards leaves it naming the old one — which
 * `addressesOwnPage` then rightly refuses, so the refresh can never be
 * delivered (SPEC §7, 2026-09-18: "every live page is served at whatever
 * host the site's hosted destination carries **now**").
 *
 * **Only an address this site's hosted publications were recorded at is
 * moved.** Anything else — a page on the customer's own site, a WordPress
 * post — comes straight back: composing another address for it would be a
 * guess about somebody else's site. A read that fails moves nothing.
 */
export async function storedAddressesNow(siteId: string): Promise<(url: string) => string> {
  const same = (url: string): string => url;
  const host = await hostedHostOfSite(siteId);
  if (host === null) return same;
  const { data, error } = await publishDb()
    .from<{ live_url: string | null }>("publications")
    .select("live_url")
    .eq("site_id", siteId)
    .eq("destination", "hosted")
    .not("live_url", "is", null);
  if (error !== null || data === null) return same;
  const now = new Map<string, string>();
  for (const row of data) {
    if (row.live_url === null) continue;
    const slug = slugOf(row.live_url);
    if (slug !== null) now.set(addressKey(row.live_url), liveUrlOnHost({ host, slug }));
  }
  return (url) => now.get(addressKey(url)) ?? url;
}

/** One address in the form two spellings of it share: no trailing slash,
 *  and no case, which a host does not have. */
function addressKey(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
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

/**
 * The meta tokens the host's index prints for Search Console and Bing
 * Webmaster Tools (issue 1553): `google-site-verification` and
 * `msvalidate.01`. Each is public by design. `null` for one never issued.
 */
export async function searchVerificationOfSite(siteId: string): Promise<{ google: string | null; bing: string | null }> {
  const { data, error } = await publishDb()
    .from<{ search_verification: { google?: { token?: unknown }; bing?: { token?: unknown } } | null }>("destinations")
    .select("search_verification")
    .eq("site_id", siteId)
    .eq("kind", "hosted")
    .is("deleted_at", null)
    .limit(1);
  const held = error === null ? data?.[0]?.search_verification : null;
  const token = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
  return { google: token(held?.google?.token), bing: token(held?.bing?.token) };
}
