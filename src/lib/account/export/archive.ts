// BUILD §4.7, §9, §13 — `exportEverything`: complete or nothing, and never
// a check on whether they still pay.
//
// **This module consults no access gate, and the absence is enforced rather
// than remembered.** REQ-078 criterion 2 is the one promise a departing
// customer tests — "it downloads to them directly and is never withheld on
// account of subscription state" — and `eslint.config.mjs`'s
// `no-export-importing-billing` fence fails CI on any import from
// `src/lib/account/billing/**` under this directory, with the requirement id
// in the message. `tests/account/export/no-access-gate.test.ts` asserts the
// same thing from the source, because a lint config can be skipped in a
// worktree and the behavioural half — a lapsed site exports a complete
// archive — is not a lexical property at all.
//
// **Resolve, then stream** (REQ-078 criterion 5). Every record, every body
// and every asset byte is in hand before the first byte of the zip is
// produced. A failure before that point returns `{ ok: false }` and no
// archive; there is no point after it at which a failure is possible, which
// is the strongest form of "not given a partial archive presented as
// complete" — the customer cannot receive a short zip wearing a valid
// trailer because no such zip is ever assembled.
//
// **A page whose asset cannot be read fails the whole export.** Skipping it
// is exactly the partial archive criterion 5 forbids, and a customer who
// opens an archive to find a page's image missing has no way to know it was
// ever there.
import { EXPORT_DEADLINE_MS } from "@/lib/config/constants";
import { assetNamesOf, assetSource } from "./assets";
import { pageFile } from "./frontmatter";
import { buildManifest, type ExportManifest, type ExportManifestPage } from "./manifest";
import { exportStore, type ExportPageRow } from "./store";
import { zipStream, type ZipEntry } from "./zip";

export type ExportFailure = "asset_unreadable" | "record_unreadable" | "timeout" | "internal";

export type ExportResult =
  | { ok: true; archive: ReadableStream<Uint8Array>; filename: string; pages: number }
  | { ok: false; reason: ExportFailure; lineKey: "export.failed" };

/** The one written line an unproduceable export is told in (REQ-078 c5).
 *  The sentence is the owner's; this module names the key. */
const FAILED_LINE = "export.failed" as const;

const MANIFEST_PATH = "manifest.json";

function failed(reason: ExportFailure): ExportResult {
  return { ok: false, reason, lineKey: FAILED_LINE };
}

/** The manifest as it goes into the archive: the same values, as JSON a
 *  customer's own tools can read, with dates as ISO strings and `draftId`
 *  dropped — a ReachKit row id is our bookkeeping, not their content. */
function manifestJson(manifest: ExportManifest): string {
  return `${JSON.stringify(
    {
      pages: manifest.pages.map((page) => ({
        path: page.path,
        title: page.title,
        state: page.state,
        published_at: page.publishedAt === null ? null : page.publishedAt.toISOString(),
        live_url: page.liveUrl,
        unpublished_at: page.unpublishedAt === null ? null : page.unpublishedAt.toISOString(),
        assets: page.assets,
      })),
    },
    null,
    2
  )}\n`;
}

function filenameFor(now: Date): string {
  return `reachkit-export-${now.toISOString().slice(0, 10)}.zip`;
}

async function assetEntries(
  siteId: string,
  page: ExportManifestPage,
  row: ExportPageRow
): Promise<ZipEntry[] | "unreadable"> {
  const names = assetNamesOf(row);
  const entries: ZipEntry[] = [];
  for (let index = 0; index < names.length; index += 1) {
    const bytes = await assetSource().read({
      siteId,
      draftId: page.draftId,
      name: names[index] as string,
    });
    if (bytes === null) return "unreadable";
    entries.push({ path: page.assets[index] as string, bytes });
  }
  return entries;
}

async function build(siteId: string): Promise<ExportResult> {
  const read = await exportStore().pages(siteId);
  if (!read.ok) return failed("record_unreadable");

  let manifest: ExportManifest;
  try {
    manifest = await buildManifest(siteId);
  } catch {
    return failed("record_unreadable");
  }

  const rows = new Map(read.pages.map((page) => [page.id, page]));
  const encoder = new TextEncoder();
  const entries: ZipEntry[] = [
    { path: MANIFEST_PATH, bytes: encoder.encode(manifestJson(manifest)) },
  ];

  for (const page of manifest.pages) {
    const row = rows.get(page.draftId);
    // A page in the manifest with no row behind it is a read that changed
    // under us, not an empty page: the archive would be short by one page
    // and say nothing about it.
    if (row === undefined || row.body_md === null) return failed("record_unreadable");
    entries.push({ path: page.path, bytes: encoder.encode(pageFile(page, row.body_md)) });

    const assets = await assetEntries(siteId, page, row);
    if (assets === "unreadable") return failed("asset_unreadable");
    entries.push(...assets);
  }

  return {
    ok: true,
    archive: zipStream(entries),
    filename: filenameFor(new Date()),
    pages: manifest.pages.length,
  };
}

/**
 * Every page ReachKit wrote for one site, as a Markdown-and-assets zip.
 *
 * `siteId` is the only parameter, and there is deliberately no second one:
 * nothing about "every page ReachKit wrote for them" is the caller's to
 * scope, so no route above this can narrow an export by accident.
 */
export async function exportEverything(siteId: string): Promise<ExportResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<ExportResult>((resolve) => {
    timer = setTimeout(() => resolve(failed("timeout")), EXPORT_DEADLINE_MS);
  });
  try {
    return await Promise.race([
      build(siteId).catch(() => failed("internal")),
      deadline,
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
