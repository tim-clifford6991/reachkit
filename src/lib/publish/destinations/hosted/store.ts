// BUILD §9 — everything the hosted edge reads, in one place. The edge answers strangers with no session, so it reads
// through `publishDb()` and writes nothing: nothing under `src/app/(hosted)/` can advance the state machine.
// Every column named is one the page, the sitemap or §9's record needs; `sites.user_id`, `destinations.config` and
// every credential-adjacent column are absent by construction.
// "Live" is one predicate, written once (`published_at` set, `unpublished_at` null), so the page, the sitemap and the
// 410 cannot disagree.
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

/** A site as the edge sees it, with nothing about its owner. */
export interface HostedSite {
  siteId: string;
  domain: string;
  /** `<label>.<domain>` (SPEC §5): the stored host, else the default label. */
  host: string;
}

/** §9: "Every published page records: opportunity id, target query, measurement date, approved-vs-autopilot, live URL",
 *  checkable as a type. `measuredOn` is null where the scan row was purged, never a fabricated date. */
export interface PublishedPageRecord {
  opportunityId: string;
  targetQuery: string;
  measuredOn: Date | null;
  mode: "approved" | "autopilot";
  liveUrl: string;
}

/** Who the page is published by (UI-SPEC S19; §14.6: "Customer is publisher of record: their domain, their identity").
 *  `name` is the domain, the one identity fact the customer gave, never a name we derived. No category draws no eyebrow;
 *  no zone writes dates in UTC, never a zone we picked (REQ-073 c1). */
export interface HostedPublisher {
  name: string;
  category: string | null;
  timeZone: string | null;
}

/** §8's grounded fact from `drafts.grounded_fact` (hard rule 1) and nowhere else, marked in the body with its source.
 *  `RecordedFact` is the shape generation writes and the draft view reads, so approved and shown are one record.
 *  `null` renders the body whole and unmarked. */
export type HostedGrounding = RecordedFact;

/** One live hosted page. `slug` is the published address's last segment. `liveUrl` is that slug on the host addressed
 *  now (SPEC §7), since the host is the site's and can move, so the canonical, the sitemap entry and the record agree. */
export interface HostedPage {
  publicationId: string;
  siteId: string;
  slug: string;
  title: string;
  /** The H1 (SPEC §7, D51) from `drafts.meta.heading`, or `null` where the title is the heading. */
  heading: string | null;
  bodyMd: string;
  /** `drafts.meta.description`, or `null`. */
  description: string | null;
  faq: readonly FaqEntry[];
  /** What the page is grounded in, or `null` where nothing was recorded. */
  grounded: HostedGrounding | null;
  /** SPEC §7: the made-with note's two numbers, or `null` where the row records neither. */
  made: MadeCounts | null;
  /** Whose page it is: the header, eyebrow, byline and footer come from this alone. */
  publisher: HostedPublisher;
  /** SPEC §7: the byline as generation recorded it (`drafts.attribution`), or `null`. */
  byline: string | null;
  /** Written as the business's own service or product page
   *  (`drafts.meta.contentType`); absent reads as not. */
  offering?: boolean;
  /** The heading of an offering page's "Where and when" section, as
   *  generation recorded it (`drafts.meta.sections`); absent or `null` where
   *  it recorded none. */
  whereWhen?: string | null;
  /** SPEC §0 business fit of the page's opportunity, 0–3, or `null` where
   *  no pass judged it: only a 3 earns the compact block. */
  businessFit?: number | null;
  /** SPEC §6 parent topic of the page's opportunity (`opportunities/cluster.ts`),
   *  or `null` where it has none; absent reads as none. */
  cluster?: string | null;
  /** When this version went live. On a page that has been refreshed it is
   *  the update's date, and `firstPublishedAt` is the page's own. */
  publishedAt: Date;
  /** When the address first carried a page: the oldest live publication at the slug, as an update is a new one. */
  firstPublishedAt: Date;
  liveUrl: string;
  record: PublishedPageRecord;
}

interface SiteRow {
  id: string;
  domain: string;
}

/** A live hosted destination and its site, as the Host lookup reads it. */
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
      cluster_key: string | null;
      scans: { created_at: string } | null;
    } | null;
  } | null;
}

/** The one select list for a live page, through the two relationships §9's record needs. */
const PAGE_COLUMNS =
  "id, site_id, live_url, published_at, mode, " +
  // The publisher's three and nothing else off `sites`: name, eyebrow, and the byline date's zone.
  "sites!inner(domain, category, timezone), " +
  "drafts!inner(title, body_md, attribution, meta, grounded_fact, opportunity_id, " +
  "opportunities!inner(id, target_query, business_fit, cluster_key, scans(created_at)))";

/** The site served on this domain, or `null`: exact match, no fallback, so an unknown Host 404s by construction. */
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

/** The site served on this host, or `null`. The label is the customer's (SPEC §5), so the host is stored and matched
 *  whole: exact match, no fallback, and the partial unique index gives one answer. */
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
  // No domain, no publisher and no address: `null`, never a page with a blank for the customer's name.
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
    whereWhen: readSectionHeading(draft.meta, "where_when"),
    businessFit: opportunity.business_fit ?? null,
    cluster: opportunity.cluster_key ?? null,
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

/** How the business is drawn on its own blog (SPEC §7): its name, whether a logo is kept, and one line about it. */
export interface HostedIdentity {
  /** The name its stored profile gives it (`storedSiteName`), else the
   *  domain — the one name it gave. */
  name: string;
  /** The picture format of the kept logo, or `null` for a first-letter tile. */
  logoType: string | null;
  /** One line saying what the business does, or `null` where none is held. */
  line: string | null;
  /** The main site's canonical home, Organization and profiles, as the scan read them; else the pages link the bare domain. */
  mainSite?: MainSite | null;
  /** What the adopted market says the business sells, in a buyer's words,
   *  and the one place it serves where it serves one, with its region where
   *  one is stored: the compact block's headline and the "Serves" line.
   *  Absent or `null` where no market was adopted. */
  offer?: { category: string; place: string | null; region?: string | null } | null;
}

interface IdentityRow {
  domain: string;
  site_name: string | null;
  home_title: string | null;
  logo_type: string | null;
  claims: unknown;
}

/** The adopted market off the stored `sites.market` blob, never the market module, which must stay out of the hosted graph. */
function marketOf(market: unknown): { job: string | null; offer: HostedIdentity["offer"] } {
  const current = (market as { current?: { job?: unknown; category?: unknown; serves?: { name?: unknown; region?: unknown } | null } } | null)?.current;
  const text = (value: unknown): string | null => (typeof value === "string" ? emptyToNull(value) : null);
  const category = text(current?.category);
  return {
    job: text(current?.job),
    offer:
      category === null
        ? null
        : { category, place: text(current?.serves?.name), region: text(current?.serves?.region) },
  };
}

/** The site's identity: three profile columns and one line, the founder's own wording of what it does, else its
 *  market's job, else the first kept claim. Never a setup answer (SPEC §7, D53), which is a note for the writer. A failed
 *  read draws the domain and a tile, never taking the page down. */
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
      // Its own read, so a schema without the column leaves the identity standing.
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
      // The main site's own Organization name where given, so page and markup never contradict it; else the stored brand.
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

/** `drafts.meta.description`, read defensively: blank is none, never an empty meta tag. */
export function readDescription(meta: Record<string, unknown> | null): string | null {
  const raw = meta?.description;
  if (typeof raw !== "string") return null;
  const text = raw.replace(/\s+/g, " ").trim();
  return text === "" ? null : text;
}

/** The heading generation recorded for one of the template's sections, or
 *  `null` where `drafts.meta.sections` holds none for it. */
function readSectionHeading(meta: Record<string, unknown> | null, key: string): string | null {
  const sections = meta?.sections;
  if (!Array.isArray(sections)) return null;
  const found = sections.find((section): section is { key: string; heading: string } => section?.key === key && typeof section.heading === "string");
  return found === undefined ? null : emptyToNull(found.heading);
}

/** The date a mended version keeps (SPEC §7): a version that only repaired its predecessor in code is dated as it, so
 *  its updated date, `dateModified` and `lastmod` do not move. `null` for every other version. */
function datedAt(meta: Record<string, unknown> | null): Date | null {
  const raw = meta?.datedAs;
  if (typeof raw !== "string") return null;
  const at = new Date(raw);
  return Number.isNaN(at.getTime()) ? null : at;
}

/** `drafts.meta.heading`, read the same way. */
function readHeading(meta: Record<string, unknown> | null): string | null {
  const raw = meta?.heading;
  if (typeof raw !== "string") return null;
  const text = raw.replace(/\s+/g, " ").trim();
  return text === "" ? null : text;
}

/** A stated value, or `null`: an empty string would draw an empty eyebrow. */
function emptyToNull(value: string | null): string | null {
  return value === null || value.trim() === "" ? null : value;
}

/** Every live hosted page, newest first, on `host`: the sitemap is exactly this list and the render finds its page in
 *  it. `host` is an argument (SPEC §7), so a page states the address it answers at by construction. One page per
 *  address: the newest live row at a slug, never listed beside the versions it replaced. */
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
  // The first row at a slug is the page; later ones are older versions, giving its first date.
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

/** One live page by slug, matched here since the query builder has no pattern operator; §9's ceilings keep the list small. */
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

/** Live, moved, retired or none at this slug: the 301's and the 410's facts, in one narrow read, since it runs before
 *  routing on every request and must beat the middleware's deadline cold. The states are `addressOf`'s. A live address
 *  names its publication, which the middleware counts reads against. A failed read is `none`, never a takedown. */
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
  // A schema without `merged_into` is read without it: no address is merged.
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

/** The slugs answering 410, by `addressOf`; moved and merged ones answer 301. A failed read is none, never unwrapping on a guess. */
export async function retiredSlugsForSite(siteId: string): Promise<ReadonlySet<string>> {
  const rows = await addressRows(siteId);
  if (rows === null) return new Set();
  const slugs = new Set(rows.flatMap((row) => (row.live_url === null ? [] : [addressSlug(row.live_url)])).filter((slug): slug is string => slug !== null));
  return new Set([...slugs].filter((slug) => addressOf(rows, slug).state === "retired"));
}

/** The slugs answering 301 and where (SPEC §7), so a link is drawn at the final address before its refresh lands. By
 *  `addressOf`, as the middleware reads it. Never throws; a failed read draws links as written, which still redirect. */
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

/** The draft's site and domain, the hosted adapter's one read, since `deliver` is handed no domain. No domain is `null`,
 *  and delivery fails with a reason rather than composing on a blank. */
export async function siteForDraft(draftId: string): Promise<HostedSite | null> {
  const { data, error } = await publishDb()
    .from<{ site_id: string; sites: { domain: string | null } | null }>("drafts")
    .select("site_id, sites!inner(domain)")
    .eq("id", draftId)
    .single();
  if (error !== null || data === null) return null;
  const domain = data.sites?.domain ?? null;
  if (domain === null || domain.trim() === "") return null;
  // The chosen host, else the default label, never a blank first label.
  const chosen = await hostnameOfSite(data.site_id);
  return {
    siteId: data.site_id,
    domain,
    host: chosen ?? hostFor({ label: null, domain }),
  };
}

/** The host and live slugs a hosted destination could update; `null` where not hosted. A failed read offers no page,
 *  never a guess, as an update is offered only where deliverable. */
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

/** The host the pages are served at now (SPEC §7): stored, else the default label, as `siteForDraft` composes it.
 *  `null` is "cannot say", and callers keep the address they had. */
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

/** One publication's address now, for the 24-hour check and the `published` mail (SPEC §7): its slug on the site's
 *  current host, else the stored address, never a blank. */
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

/** The re-addresser for a whole site: the host read once and applied, so thirty pages cost one query. The `hosted` test
 *  is inside: a WordPress address is the only one there is (SPEC §7). Falls back to the stored address, never a blank. */
export async function hostedAddressesNow(siteId: string): Promise<AddressNow> {
  const host = await hostedHostOfSite(siteId);
  return (row) => {
    if (row.destination !== "hosted" || host === null) return row.liveUrl;
    const slug = slugOf(row.liveUrl);
    return slug === null ? row.liveUrl : liveUrlOnHost({ host, slug });
  };
}

/** The re-addresser for an address copied off a publication, like a refresh's `target_ref`, which a moved host would
 *  leave undeliverable (SPEC §7: "every live page is served at whatever host the site's hosted destination carries now").
 *  Only addresses our hosted publications were recorded at move; anything else comes back as is. A failed read moves nothing. */
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

/** One address as two spellings share it: no trailing slash, no case. */
function addressKey(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

/** The live hosted destination's host, or `null`; read here, not via `hostname.ts`, so the edge's graph avoids the vendor seam. */
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

/** The index's `google-site-verification` and `msvalidate.01` tokens, public by design; `null` for one never issued. */
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
