// tests/account/export/memory-store.ts
//
// A store instead of a database, in the shape `tests/account/billing/
// memory-store.ts` uses. Two arrays and the three answers the interface
// declares — including the one that matters most here: `unreadable`, which
// is a different fact from "this site has no pages" and must never collapse
// into it.
import type {
  ExportPageRow,
  ExportPublicationRow,
  ExportStore,
} from "@/lib/account/export";

export interface MemoryExport {
  pages: ExportPageRow[];
  publications: ExportPublicationRow[];
  unreadable: boolean;
}

export function newMemoryExport(): MemoryExport {
  return { pages: [], publications: [], unreadable: false };
}

let nextId = 0;

export function page(a: Partial<ExportPageRow> & { title: string }): ExportPageRow {
  nextId += 1;
  return {
    id: a.id ?? `draft-${nextId}`,
    title: a.title,
    body_md: a.body_md === undefined ? `# ${a.title}\n\nbody\n` : a.body_md,
    state: a.state ?? "published",
    meta: a.meta ?? null,
    created_at: a.created_at ?? `2026-09-0${nextId}T00:00:00.000Z`,
  };
}

export function publication(
  a: Partial<ExportPublicationRow> & { draft_id: string }
): ExportPublicationRow {
  return {
    draft_id: a.draft_id,
    live_url: a.live_url ?? null,
    published_at: a.published_at ?? null,
    unpublished_at: a.unpublished_at ?? null,
  };
}

export function memoryExportStore(state: MemoryExport): ExportStore {
  return {
    async pages() {
      if (state.unreadable) return { ok: false };
      return {
        ok: true,
        pages: [...state.pages].sort((l, r) =>
          l.created_at === r.created_at
            ? l.id.localeCompare(r.id)
            : l.created_at.localeCompare(r.created_at)
        ),
      };
    },
    async publications() {
      if (state.unreadable) return { ok: false };
      return { ok: true, publications: [...state.publications] };
    },
  };
}
