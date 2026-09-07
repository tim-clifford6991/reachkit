// BUILD §9 — "posts as draft + Yoast/RankMath meta **when detected**", and
// the word that carries the whole module is *detected*.
//
// (§9's "as draft" is the clause the owner's ruling of 2026-09-01 inverted
// — ADR-084 Decision 1, recorded in `DECISIONS.md`: every CMS publishes
// live in one call. What that ruling did not touch is this: the plugins are
// **detected, never assumed**, and neither present is a success.)
//
// REQ-060 criterion 3 asks that the title and description be written into
// the fields of each plugin **that is present**; criterion 4 asks that with
// neither present the page is *still delivered*, and that one written line
// on that page's own record says no SEO plugin was found. So:
//
//  - detection is one read of the REST index, per delivery, **before** the
//    create — the fields have to be able to ride the create call;
//  - both present means both contributed, one means one, **neither is not a
//    failure**;
//  - what was actually written is read back from the create response, never
//    inferred from what was sent. A site that accepted the post and dropped
//    the meta is a page in their site with no SEO metadata, which is
//    criterion 4's case and not a failed publish.
//
// **The obvious implementation is forbidden** (ADR-084 Decision 1). The
// natural way to write SEO metadata into a WordPress post is: create it as
// a draft, write the plugin fields, then publish. That sequence opens a
// window in which a post sits in the customer's site as a draft ReachKit
// meant to publish, and a crash inside it re-creates by accident exactly
// the population the ruling removes. Detection runs before the create, the
// fields ride the create, and nothing here publishes anything.
//
// The archived plan is WO-238.
import type { CopyKey } from "@/lib/presentation/copy";
import type { WordPressConfig } from "./client";
import { readRestIndex } from "./client";
import { succeeded } from "./errors";

/** The two, and REQ-060's non-goals close the list: "SEO plugins other
 *  than Yoast and RankMath". */
export type SeoPlugin = "yoast" | "rankmath";

/** The line criterion 4 requires where neither was found. Named here and
 *  written nowhere: the sentence is the owner's. */
export const NO_SEO_PLUGIN_LINE: CopyKey = "publish.wordpress.noSeoPlugin";

/** How each plugin is seen, and where its two fields live.
 *
 *  The namespace is the detection: a plugin that registers REST routes
 *  announces itself in the index's `namespaces`, and that is the site
 *  telling us what it has. A version string is not asked for and would not
 *  be believed — REQ-060 criterion 3 is about a plugin being *present*,
 *  which is a fact about routes, not about a number. */
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

/** Every plugin key, in one place, so a reader of a create body can tell
 *  ours from the site's own. */
const ALL: readonly SeoPlugin[] = Object.freeze(["yoast", "rankmath"] as const);

function namespacesOf(body: unknown): readonly string[] {
  if (typeof body !== "object" || body === null) return [];
  const found = (body as { namespaces?: unknown }).namespaces;
  if (!Array.isArray(found)) return [];
  return found.filter((n): n is string => typeof n === "string");
}

/**
 * Which of the two the site has, read from its own REST index.
 *
 * One read per delivery and no cache: a plugin activated or deactivated
 * between two deliveries is a different site, and a cached answer would
 * write metadata into fields that are no longer there or skip fields that
 * now are. A site that does not answer, or answers with something that is
 * not a REST index, yields the empty list — which is criterion 4's case
 * and not an error, because the page is still going to be delivered.
 */
export async function detectSeoPlugins(cfg: WordPressConfig): Promise<readonly SeoPlugin[]> {
  const answer = await readRestIndex(cfg);
  if (!succeeded(answer)) return [];
  const namespaces = namespacesOf(answer.body);
  return ALL.filter((plugin) => namespaces.includes(PLUGINS[plugin].namespace));
}

/**
 * The `meta` the create request carries for the plugins that are present.
 *
 * Pure: what is sent, composed from what was detected. Sending a key for a
 * plugin that is not installed would write an orphan row into the
 * customer's database for a plugin that will never read it.
 */
export function seoMetaFor(
  plugins: readonly SeoPlugin[],
  page: { title: string; description: string }
): Readonly<Record<string, string>> {
  const meta: Record<string, string> = {};
  for (const plugin of plugins) {
    meta[PLUGINS[plugin].title] = page.title;
    // A page whose own record carries no description contributes none: an
    // empty description written into a plugin's field is a description the
    // site would then publish, and it is not one the page has.
    if (page.description !== "") meta[PLUGINS[plugin].description] = page.description;
  }
  return meta;
}

/**
 * Which plugins the site actually wrote, read back from the post it
 * returned.
 *
 * **Read, never assumed** — the same discipline as detection. A plugin
 * whose fields were sent and did not come back is a plugin whose meta the
 * site did not accept: the page is live either way, and saying it was
 * written would be a false statement about the customer's own site.
 */
export function seoWrittenIn(
  plugins: readonly SeoPlugin[],
  post: unknown,
  page: { title: string; description: string }
): readonly SeoPlugin[] {
  const meta = metaOf(post);
  return plugins.filter((plugin) => {
    if (meta[PLUGINS[plugin].title] !== page.title) return false;
    if (page.description === "") return true;
    return meta[PLUGINS[plugin].description] === page.description;
  });
}

function metaOf(post: unknown): Readonly<Record<string, unknown>> {
  if (typeof post !== "object" || post === null) return {};
  const meta = (post as { meta?: unknown }).meta;
  if (typeof meta !== "object" || meta === null || Array.isArray(meta)) return {};
  return meta as Record<string, unknown>;
}
