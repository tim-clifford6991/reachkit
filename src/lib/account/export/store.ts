// BUILD §9, §4.7 — every row an export reads, behind one interface.
//
// An export **writes nothing**. The two reads below are the whole of what
// this leaf touches: the pages ReachKit wrote (`drafts`) and, for each, the
// publication record that says whether it went live and whether it has since
// come down (`publications`). Neither table is this module's, and both are
// read by exactly the columns REQ-078 criteria 3 and 4 name — a column not
// listed here cannot be read by accident.
//
// The shape is `src/lib/account/store.ts`'s, deliberately: same
// three-answer discipline (`ok: false` for a store that could not be read,
// an empty list for a store that holds nothing), same `dbAdmin()` cast at
// one boundary, same swap door for the suites. Collapsing "unreadable" into
// "empty" here is what would hand a customer an archive with none of their
// pages in it and call it complete, which is exactly REQ-078 criterion 5's
// failure.
//
// **`dbAdmin()`, not `db()`.** REQ-078 criterion 2 promises the export to a
// customer whose subscription has lapsed, and REQ-076 criterion 5 keeps
// their sign-in working; the route above this leaf has already established
// who is asking. Reading through RLS here would add a second, silent
// condition to a promise whose whole point is that it has none.
import { dbAdmin } from "@/lib/db";

/** One `drafts` row, as the export reads it. `state` is §9's enum as a
 *  string — this module maps it to REQ-078's four page states and holds no
 *  copy of the machine's own union. */
export interface ExportPageRow {
  readonly id: string;
  readonly title: string;
  readonly body_md: string | null;
  readonly state: string;
  readonly meta: Record<string, unknown> | null;
  readonly created_at: string;
}

/** One `publications` row, by the three dates and the address REQ-078
 *  criterion 4 names, and nothing else. */
export interface ExportPublicationRow {
  readonly draft_id: string;
  readonly live_url: string | null;
  readonly published_at: string | null;
  readonly unpublished_at: string | null;
}

export interface ExportStore {
  /** Every page ReachKit wrote for one site, oldest first. Ordering is the
   *  store's so that the manifest is byte-stable across runs without a
   *  second sort deciding it somewhere else. */
  pages(siteId: string): Promise<{ ok: true; pages: readonly ExportPageRow[] } | { ok: false }>;

  /** Every publication of those pages. A page with no row here was never
   *  published, which is a fact the manifest states with three explicit
   *  nulls. */
  publications(
    siteId: string
  ): Promise<{ ok: true; publications: readonly ExportPublicationRow[] } | { ok: false }>;
}

// ── The Supabase implementation

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQueryBuilder<T>;
  eq(column: string, value: string): MinimalQueryBuilder<T>;
  order(column: string, opts: { ascending: boolean }): MinimalQueryBuilder<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQueryBuilder<T>;
}

/** The one cast boundary in this module, for the reason
 *  `src/lib/publish/db.ts` records at its own: `Database` in
 *  `src/lib/db/types.generated.ts` is generated against the baseline alone,
 *  so no column a later migration added appears in it. */
function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

const PAGE_COLUMNS = "id, title, body_md, state, meta, created_at";
const PUBLICATION_COLUMNS = "draft_id, live_url, published_at, unpublished_at";

export function supabaseExportStore(): ExportStore {
  return {
    async pages(siteId) {
      const { data, error } = await untyped()
        .from<ExportPageRow>("drafts")
        .select(PAGE_COLUMNS)
        .eq("site_id", siteId)
        // `created_at` ascending, `id` ascending as the tiebreak: a total
        // order, so two pages written in the same millisecond still land in
        // the archive in the same place on every run.
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });
      if (error !== null || data === null) return { ok: false };
      return { ok: true, pages: data };
    },

    async publications(siteId) {
      const { data, error } = await untyped()
        .from<ExportPublicationRow>("publications")
        .select(PUBLICATION_COLUMNS)
        .eq("site_id", siteId);
      if (error !== null || data === null) return { ok: false };
      return { ok: true, publications: data };
    },
  };
}

let store: ExportStore | null = null;

export function exportStore(): ExportStore {
  store ??= supabaseExportStore();
  return store;
}

/** The suites' door. `null` restores the Supabase store. */
export function setExportStore(next: ExportStore | null): void {
  store = next;
}
