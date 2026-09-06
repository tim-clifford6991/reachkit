// BUILD §9 — "Export = Markdown + assets zip, always available".
//
// **ReachKit stores no page asset today.** §8's generation produces
// Markdown; nothing in this schema holds a byte of image or attachment for
// a draft, and no module writes one. So this file is the seam where an
// asset store plugs in, and its default answer is the honest one: a page
// that names an asset ReachKit cannot produce is a page whose export
// **fails whole** — never one whose asset is quietly dropped, which is the
// partial archive presented as complete that REQ-078 criterion 5 forbids.
//
// The names come from one declared place — `drafts.meta.assets`, a list of
// file names — so that when generation begins recording assets there is one
// key to write and no second convention to reconcile. A `meta` that carries
// no such list carries no assets, which is today's answer for every page.
import type { ExportPageRow } from "./store";

/** The file names one page declares. Anything that is not a list of
 *  non-empty strings is no declaration at all: a malformed `meta` yields no
 *  assets rather than a name the reader would then fail on. */
export function assetNamesOf(page: ExportPageRow): readonly string[] {
  const declared = page.meta?.["assets"];
  if (!Array.isArray(declared)) return [];
  return declared.filter((name): name is string => typeof name === "string" && name.length > 0);
}

export interface AssetSource {
  /** The bytes of one named asset, or `null` where they cannot be produced.
   *  `null` fails the whole export — there is no arm that skips one. */
  read(a: { siteId: string; draftId: string; name: string }): Promise<Uint8Array | null>;
}

/** No asset store exists. It answers `null` for every name, which is only
 *  ever reached by a page that declared one — and today nothing writes such
 *  a declaration, so no export reaches this at all. */
const noAssetStore: AssetSource = {
  async read(): Promise<Uint8Array | null> {
    return null;
  },
};

let source: AssetSource = noAssetStore;

export function assetSource(): AssetSource {
  return source;
}

/** Wired by an asset store when one lands; `null` restores the default. */
export function setAssetSource(next: AssetSource | null): void {
  source = next ?? noAssetStore;
}
