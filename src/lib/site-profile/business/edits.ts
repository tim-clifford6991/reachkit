// SPEC §7 (2026-09-20) · issue #926 — reading and writing the customer's
// corrections.
//
// `site_profile_edits` is one row per site, and this module is the only way
// in or out of it. Two reads and one write, and the write is always a whole
// row: the decisions are small, they are all about one screen, and an upsert
// of the row is what makes "save" one statement the database either takes or
// refuses. A per-column patch would be four writes that can half-succeed.
//
// **`dbAdmin()`, and the reason is the same one `../store.ts` gives.**
// Every other writer under `src/lib/**` writes through the service client,
// the session having already been resolved by the caller — a Server Function
// in `(account)` that knows which site it holds. The table's RLS policies
// are still the thing that makes the row private: they are what a customer's
// own session is held to if it ever reads this table directly, and
// `tests/site-profile/business-edits-schema.test.ts` exercises all four
// against a live database rather than trusting this comment.
//
// Nothing here is a sentence the product speaks, and nothing here decides
// anything: the decisions are applied by `./confirm.ts`, which is pure. This
// file moves rows.
import { dbAdmin } from "@/lib/db";
import { BUSINESS_LISTS, NO_EDITS, type BusinessEdits, type BusinessList } from "./types";

interface EditsRow {
  site_id: string;
  removed: unknown;
  added: unknown;
  job: string | null;
  seen: unknown;
  facts_off: unknown;
}

const COLUMNS = "site_id, removed, added, job, seen, facts_off";

/** The generated `Database` type does not carry `site_profile_edits` — the
 *  same narrow cast `../store.ts` documents for `site_profiles`, kept to the
 *  smallest surface these two functions use. */
interface MinimalResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}
interface MinimalQuery<T> extends PromiseLike<MinimalResult<T>> {
  select(columns: string): MinimalQuery<T>;
  upsert(values: Record<string, unknown>, options: { onConflict: string }): MinimalQuery<T>;
  eq(column: string, value: unknown): MinimalQuery<T>;
  limit(n: number): MinimalQuery<T>;
}
interface MinimalClient {
  from<T>(table: string): MinimalQuery<T>;
}

function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

/** A JSON array of strings, or nothing. A column that holds anything else is
 *  a bug in a writer, and reading it as "no decisions" would silently
 *  restore items the customer removed — so a malformed value is dropped to
 *  empty for *that list only*, never for the row. */
function stringList(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

/** A field-keyed record of string lists, narrowed to the six fields the
 *  tuple names. A key that is not one of them is ignored — the column is
 *  JSON and a stale key from an older shape must not become a seventh
 *  list. */
function listRecord(value: unknown): Readonly<Partial<Record<BusinessList, readonly string[]>>> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const out: Partial<Record<BusinessList, readonly string[]>> = {};
  for (const list of BUSINESS_LISTS) {
    const entry = stringList(source[list]);
    if (entry.length > 0) out[list] = entry;
  }
  return out;
}

/**
 * The site's stored decisions, or `NO_EDITS` where it has none.
 *
 * "No row" and "an empty row" are the same answer on purpose: a customer who
 * has never corrected anything and one who removed an item and put it back
 * are in the same state, and no caller should have to tell them apart.
 */
export async function readBusinessEdits(siteId: string): Promise<BusinessEdits> {
  const { data, error } = await untyped()
    .from<EditsRow>("site_profile_edits")
    .select(COLUMNS)
    .eq("site_id", siteId)
    .limit(1);
  if (error) {
    throw new Error(`business edits: could not read ${siteId}: ${error.message}`);
  }
  const row = data?.[0];
  if (row === undefined) return NO_EDITS;
  return {
    removed: listRecord(row.removed),
    added: listRecord(row.added),
    job: row.job,
    seen: listRecord(row.seen),
    factsOff: stringList(row.facts_off),
  };
}

/**
 * Writes the whole row.
 *
 * `seen` is passed in rather than computed here, because what the customer
 * has been shown is a fact about the screen they were looking at and this
 * module has not read the profile. `./confirm.ts`'s `seenNow` is what
 * produces it, from the same derived reading the screen drew.
 */
export async function writeBusinessEdits(a: {
  siteId: string;
  edits: BusinessEdits;
  seen: Readonly<Record<BusinessList, readonly string[]>>;
}): Promise<void> {
  const { error } = await untyped()
    .from<EditsRow>("site_profile_edits")
    .upsert(
      {
        site_id: a.siteId,
        removed: Object.fromEntries(
          BUSINESS_LISTS.map((list) => [list, [...(a.edits.removed[list] ?? [])]])
        ),
        added: Object.fromEntries(
          BUSINESS_LISTS.map((list) => [list, [...(a.edits.added[list] ?? [])]])
        ),
        job: a.edits.job,
        seen: Object.fromEntries(BUSINESS_LISTS.map((list) => [list, [...(a.seen[list] ?? [])]])),
        facts_off: [...a.edits.factsOff],
        edited_at: new Date().toISOString(),
      },
      { onConflict: "site_id" }
    );
  if (error) {
    throw new Error(`business edits: could not write ${a.siteId}: ${error.message}`);
  }
}
