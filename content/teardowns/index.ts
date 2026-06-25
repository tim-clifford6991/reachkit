/**
 * Teardown registry — all 9 analyses indexed by slug.
 *
 * Import this registry in pages that need to look up teardowns by slug
 * (`teardownBySlug`) or render the full list (`allTeardowns`).
 *
 * Adding a new teardown: create the content file, import and add it here.
 */

import type { Teardown } from "./types";
import bearable from "./bearable";
import opal from "./opal";
import cardpointers from "./cardpointers";
import sofa from "./sofa";
import nudgi from "./nudgi";
import plausible from "./plausible";
import calCom from "./cal-com";
import raycast from "./raycast";
import reflect from "./reflect";

/** All teardowns ordered for display (most recently published first). */
export const allTeardowns: readonly Teardown[] = [
  reflect,
  raycast,
  calCom,
  plausible,
  bearable,
  opal,
  cardpointers,
  sofa,
  nudgi,
] as const;

/** Keyed by slug for O(1) lookup in dynamic routes. */
const registry: Readonly<Record<string, Teardown>> = Object.fromEntries(
  allTeardowns.map((t) => [t.slug, t])
);

/**
 * Look up a teardown by its slug.
 * Returns `undefined` for unknown slugs (caller should call `notFound()`).
 */
export function teardownBySlug(slug: string): Teardown | undefined {
  return registry[slug];
}

/** All slugs — used by `generateStaticParams`. */
export const teardownSlugs: readonly string[] = allTeardowns.map((t) => t.slug);

export type { Teardown } from "./types";
