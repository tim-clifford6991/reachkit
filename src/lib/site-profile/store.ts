// SPEC.md §2 ("what is stored") · §5 Rules ("The site profile is confirmed
// here") · §12 ruling 8 (2026-09-12).
//
// The profile's reads and writes, and the one rule that keeps a customer's
// own words safe from a refresh.
//
// **Two rows, two owners.** `site_profiles` is derived and domain-keyed:
// every field is what a crawl and one model call read, and the weekly pass
// overwrites all of it. `sites.voice_text` is the customer's — what they
// confirmed or edited at setup and in settings — and `sites.voice_edited_at`
// is the stamp that says so. `adoptVoiceText` seeds the customer's field
// from the derived one **only while that stamp is null**, which is how §5's
// "a customer edit to the voice is not overwritten by a refresh" is kept:
// after the first edit the two are separate facts and the customer's wins,
// for ever, with no second door.
//
// **Why drafting is not changed by any of this.** Generation reads
// `sites.voice_text` and nothing else (`src/lib/generate/voice/inputs.ts`,
// whose closed struct has no member a derived artifact could arrive
// through). Seeding that one field is therefore the whole of what "the
// stored text is what drafting reads" requires — no new path into a
// prompt, and the promise stays checkable by reading that type.
import { dbAdmin } from "@/lib/db";
import type { InventoryRow, SiteProfile, VoiceSummary } from "./types";

/** The generated `Database` type carries neither `site_profiles` nor
 *  `sites.voice_edited_at` — the same narrow cast
 *  `src/app/(account)/setup/_setup/store.ts` documents for the setup
 *  columns, kept to the smallest surface these four functions use. */
interface MinimalResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}
interface MinimalQuery<T> extends PromiseLike<MinimalResult<T>> {
  select(columns: string): MinimalQuery<T>;
  insert(values: Record<string, unknown>): MinimalQuery<T>;
  upsert(values: Record<string, unknown>, options: { onConflict: string }): MinimalQuery<T>;
  update(values: Record<string, unknown>): MinimalQuery<T>;
  eq(column: string, value: unknown): MinimalQuery<T>;
  is(column: string, value: unknown): MinimalQuery<T>;
  limit(n: number): MinimalQuery<T>;
}
interface MinimalClient {
  from<T>(table: string): MinimalQuery<T>;
}

function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

interface ProfileRow {
  domain: string;
  site_name: string | null;
  products: unknown;
  claims: unknown;
  voice: unknown;
  inventory: unknown;
  pages_read: number;
  refreshed_at: string;
}

const COLUMNS = "domain, site_name, products, claims, voice, inventory, pages_read, refreshed_at";

/** A jsonb column read back as `unknown`, narrowed to a list of strings.
 *  Structural, never thrown on: a row written by an older shape is read as
 *  what of it still parses rather than taking a screen down. */
function stringList(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function inventoryOf(value: unknown): readonly InventoryRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is InventoryRow => {
    if (entry === null || typeof entry !== "object") return false;
    const row = entry as Record<string, unknown>;
    return (
      typeof row.url === "string" &&
      typeof row.title === "string" &&
      typeof row.h1 === "string" &&
      typeof row.purpose === "string"
    );
  });
}

function voiceOf(value: unknown): VoiceSummary | null {
  if (value === null || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.text !== "string" || typeof v.tone !== "string" || typeof v.person !== "string") return null;
  return {
    text: v.text,
    tone: v.tone,
    person: v.person,
    vocabulary: stringList(v.vocabulary),
    claimsToKeep: stringList(v.claimsToKeep),
    claimsToAvoid: stringList(v.claimsToAvoid),
  };
}

/** The profile for one domain, or `null` where no pass has built one. */
export async function readSiteProfile(domain: string): Promise<SiteProfile | null> {
  const { data, error } = await untyped()
    .from<ProfileRow>("site_profiles")
    .select(COLUMNS)
    .eq("domain", domain)
    .limit(1);
  if (error) throw new Error(`site profile: could not read ${domain}: ${error.message}`);
  const row = data?.[0];
  if (row === undefined) return null;
  return {
    domain: row.domain,
    siteName: row.site_name,
    products: stringList(row.products),
    claims: stringList(row.claims),
    voice: voiceOf(row.voice),
    inventory: inventoryOf(row.inventory),
    pagesRead: row.pages_read,
    refreshedAt: new Date(row.refreshed_at),
  };
}

/**
 * One pass's reading of a site, written whole. An upsert on the domain
 * because a refresh replaces the derived facts rather than accumulating
 * them: §12 ruling 8's profile is what the site says *now*, and a merge
 * would leave a page that has since been deleted in the inventory
 * drafting links from.
 *
 * **What a pass did not read, it does not erase.** The free pass crawls
 * but does not infer (`index.ts` says why), so it arrives here with no
 * voice, no products and no claims — and a free re-scan of a domain that
 * a paid pass has already read would otherwise write three nulls over a
 * real reading, taking the customer's voice summary off their own setup
 * screen. So a write carrying none of the three omits those columns
 * entirely: PostgREST's merge-duplicates upsert updates exactly the
 * columns the payload names, so an omitted column keeps the value the
 * richer pass stored, and on a first insert takes the table's own default
 * (`'[]'`, `null`) — which is the same honest empty. A pass that *did*
 * infer names all three and overwrites them, which is what a refresh is
 * for.
 *
 * The inventory, the count, the name and the timestamp are always
 * written: every pass reads them, so every pass has the newest truth
 * about them.
 */
export async function writeSiteProfile(p: SiteProfile): Promise<void> {
  const inferred =
    p.voice !== null || p.products.length > 0 || p.claims.length > 0;

  const values: Record<string, unknown> = {
    domain: p.domain,
    site_name: p.siteName,
    inventory: p.inventory.map((row) => ({ ...row })),
    pages_read: p.pagesRead,
    refreshed_at: p.refreshedAt.toISOString(),
  };
  if (inferred) {
    values.products = [...p.products];
    values.claims = [...p.claims];
    values.voice =
      p.voice === null
        ? null
        : {
            ...p.voice,
            vocabulary: [...p.voice.vocabulary],
            claimsToKeep: [...p.voice.claimsToKeep],
            claimsToAvoid: [...p.voice.claimsToAvoid],
          };
  }

  const { error } = await untyped()
    .from<ProfileRow>("site_profiles")
    .upsert(values, { onConflict: "domain" });
  if (error) throw new Error(`site profile: could not write ${p.domain}: ${error.message}`);
}

/**
 * Seeds `sites.voice_text` from the profile's derived voice, and answers
 * whether it wrote.
 *
 * The `is("voice_edited_at", null)` filter is the whole guard, and it is
 * in the statement rather than in a read-then-write around it on purpose:
 * a customer saving their voice while a weekly pass is mid-flight would
 * win a check-then-write race in exactly the case the rule exists for.
 * Postgres decides it, once.
 */
export async function adoptVoiceText(a: { siteId: string; domain: string }): Promise<boolean> {
  const profile = await readSiteProfile(a.domain);
  const text = profile?.voice?.text;
  if (text === undefined || text === "") return false;

  const { data, error } = await untyped()
    .from<{ id: string }>("sites")
    .update({ voice_text: text })
    .eq("id", a.siteId)
    .is("voice_edited_at", null)
    .select("id");
  if (error) throw new Error(`site profile: could not seed the voice for ${a.siteId}: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

/** The customer's own edit — from setup or from settings, the same write.
 *  The stamp is what every later refresh reads, so it is set by the same
 *  statement that stores the text: a text saved without its stamp would be
 *  overwritten by the next Monday's pass. */
export async function saveVoiceText(a: { siteId: string; text: string }): Promise<void> {
  const { error } = await untyped()
    .from<{ id: string }>("sites")
    .update({ voice_text: a.text, voice_edited_at: new Date().toISOString() })
    .eq("id", a.siteId);
  if (error) throw new Error(`site profile: could not save the voice for ${a.siteId}: ${error.message}`);
}
