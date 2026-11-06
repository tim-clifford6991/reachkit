// BUILD §9 — Yoast/RankMath meta when detected, never assumed; every post publishes live in one call (ADR-084 decision 1).
// REQ-060 c3 writes title and description into each plugin present; c4: with neither, the page is still delivered and its
// record says no SEO plugin was found. Detection is one REST-index read per delivery, before the create, so the fields
// ride it; what was written is read back from the response, never inferred.
// Forbidden: create as draft, write the fields, then publish. A crash in between leaves the draft population ADR-084 removes.
import type { CopyKey } from "@/lib/presentation/copy";
import type { WordPressConfig } from "./client";
import { readRestIndex } from "./client";
import { succeeded } from "./errors";

/** Closed by REQ-060's non-goals: "SEO plugins other than Yoast and RankMath". */
export type SeoPlugin = "yoast" | "rankmath";

/** A plugin the REST index showed whose fields were not read back (#2091): kept in the same `seo_written` array, so the
 *  record can tell "none detected" (empty) from "detected, not accepted" with no migration. */
export type SeoNotAccepted = `${SeoPlugin}:not_accepted`;

/** One entry per detected plugin: written (read back), or detected and not accepted. Empty means none was detected. */
export type SeoRecorded = SeoPlugin | SeoNotAccepted;

/** Criterion 4's line where neither was found; the sentence lives in the registry. */
export const NO_SEO_PLUGIN_LINE: CopyKey = "publish.wordpress.noSeoPlugin";

/** Each plugin's REST namespace, which is the detection, and its two fields. Presence is a fact about routes, never a version. */
const PLUGINS: Readonly<Record<SeoPlugin, { namespace: string; title: string; description: string }>> =
  Object.freeze({
    yoast: {
      namespace: "yoast/v1",
      title: "_yoast_wpseo_title",
      description: "_yoast_wpseo_metadesc",
    },
    rankmath: {
      namespace: "rankmath/v1",
      title: "rank_math_title",
      description: "rank_math_description",
    },
  });

/** Every plugin key, so a create body's keys can be told from the site's own. */
const ALL: readonly SeoPlugin[] = Object.freeze(["yoast", "rankmath"] as const);

function namespacesOf(body: unknown): readonly string[] {
  if (typeof body !== "object" || body === null) return [];
  const found = (body as { namespaces?: unknown }).namespaces;
  if (!Array.isArray(found)) return [];
  return found.filter((n): n is string => typeof n === "string");
}

/** Which of the two the site has, from its REST index, read per delivery with no cache since plugins change.
 *  No answer, or not an index, is the empty list: criterion 4's case, not an error. */
export async function detectSeoPlugins(cfg: WordPressConfig): Promise<readonly SeoPlugin[]> {
  const answer = await readRestIndex(cfg);
  if (!succeeded(answer)) return [];
  const namespaces = namespacesOf(answer.body);
  return ALL.filter((plugin) => namespaces.includes(PLUGINS[plugin].namespace));
}

/** The create's `meta` for the plugins present only, never an orphan row for one not installed. */
export function seoMetaFor(
  plugins: readonly SeoPlugin[],
  page: { title: string; description: string }
): Readonly<Record<string, string>> {
  const meta: Record<string, string> = {};
  for (const plugin of plugins) {
    meta[PLUGINS[plugin].title] = page.title;
    // No description contributes none: an empty one would be published by the site.
    if (page.description !== "") meta[PLUGINS[plugin].description] = page.description;
  }
  return meta;
}

/** What each detected plugin did, read back from the returned post, never assumed: sent and not returned is
 *  `<plugin>:not_accepted`, never dropped, so a detected plugin is not reported as no plugin (#2091). */
export function seoWrittenIn(
  plugins: readonly SeoPlugin[],
  post: unknown,
  page: { title: string; description: string }
): readonly SeoRecorded[] {
  const meta = metaOf(post);
  return plugins.map((plugin): SeoRecorded => (readBack(meta, plugin, page) ? plugin : `${plugin}:not_accepted`));
}

/** Whether any detected plugin's fields were read back. */
export function anySeoWritten(recorded: readonly SeoRecorded[]): boolean {
  return recorded.some((entry) => !entry.endsWith(":not_accepted"));
}

function readBack(
  meta: Readonly<Record<string, unknown>>,
  plugin: SeoPlugin,
  page: { title: string; description: string }
): boolean {
  if (meta[PLUGINS[plugin].title] !== page.title) return false;
  if (page.description === "") return true;
  return meta[PLUGINS[plugin].description] === page.description;
}

function metaOf(post: unknown): Readonly<Record<string, unknown>> {
  if (typeof post !== "object" || post === null) return {};
  const meta = (post as { meta?: unknown }).meta;
  if (typeof meta !== "object" || meta === null || Array.isArray(meta)) return {};
  return meta as Record<string, unknown>;
}
