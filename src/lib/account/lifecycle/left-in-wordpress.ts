// BUILD §4.7 — what a deleted account leaves behind in the customer's own
// WordPress, as four sentences' worth of data.
//
// REQ-079 criterion 6 gives each of §9's four WordPress outcomes "one
// sentence of its own, carrying that outcome's own count and, where there is
// anywhere to look, its own place — and no sentence carries two outcomes or
// one count for both". Four rules, each enforced by the type or by this
// module rather than by a reviewer:
//
// (a) **The map is keyed by `UnpublishResult`'s four WordPress arms.** That
//     is where the outcome set lives, so a single count spanning two arms is
//     unrepresentable rather than merely forbidden.
// (b) **An outcome holding no posts is absent from the map**, never present
//     with `count: 0` — the criterion says it "is not named at all rather
//     than named with a count of none", and an absent key is that sentence's
//     representation. `Partial<Record<>>` is what leaves a zero nowhere to
//     be written.
// (c) **`already_gone`'s place is `null` by construction, not by
//     capability.** The criterion says that sentence names no place "because
//     there is nothing there to find". It stays `null` even at a site whose
//     stamp was applied: sending a customer to a list to look for posts that
//     cannot be in it is the failure this rule exists to prevent.
// (d) For the other three, `place` is the one place in the customer's own
//     WordPress that brings ReachKit's posts up together — where the site
//     took the stamp — and `null` where it did not. Where it is `null` the
//     sentence still carries its count.
//
// **Nothing here re-derives a population.** The counts are tallied from the
// arms the take-down run itself returned and from nothing else.
//
// **The port below is answered, and this module still knows nothing about
// WordPress.** #54 landed the destination and #160 stored the fact the port
// needs; the registration lives on the publishing side
// (`src/lib/publish/destinations/wordpress/stamp-place.ts`), which is the
// side that knows the answer. Nothing here imports it: an account surface
// must not carry the publishing graph and a database client to render four
// sentences. Unregistered — a test, a job that never touched publishing —
// the default still answers "no place", and every sentence still carries
// its count.
import type { UnpublishOutcome } from "@/lib/publish/types";

/** REQ-060 c6's list — the one place in the customer's own site that brings
 *  ReachKit's posts up together. This module renders no sentence and builds
 *  no URL text: it carries the values and the mail's blocks do the rest. */
export interface WordPressListPlace {
  readonly siteBaseUrl: string;
  readonly stampSlug: string;
}

/** §9's four WordPress arms. `removed` is the hosted arm and has no place in
 *  a customer's own site, so it is not one of these. */
export type WordPressOutcome = Exclude<UnpublishOutcome, "removed">;

export type LeftInWordPress = Partial<
  Record<WordPressOutcome, { count: number; place: WordPressListPlace | null }>
>;

/** Whether a destination's site took ADR-083's findability stamp, and so
 *  whether there is a list to point the customer at. Answered by the
 *  WordPress destination from `destinations.stamp_capable` (#160); the
 *  default below answers `null` wherever nothing has registered, which is
 *  a place the mail simply does not name rather than a failure. */
export interface StampCapability {
  place(destinationId: string): Promise<WordPressListPlace | null>;
}

const noStamp: StampCapability = {
  async place(): Promise<WordPressListPlace | null> {
    return null;
  },
};

let capability: StampCapability = noStamp;

export function stampCapability(): StampCapability {
  return capability;
}

/** Wired by the WordPress destination at boot
 *  (`installStampCapability`, #160); `null` restores the unanswered
 *  default. */
export function setStampCapability(next: StampCapability | null): void {
  capability = next ?? noStamp;
}

const WORDPRESS = "wordpress";

/**
 * The four counts, from the run's own outcomes.
 *
 * An arm with no rows is absent. `already_gone` is handed `place: null`
 * without the capability being consulted at all — rule (c), and the case a
 * capability-driven implementation gets wrong.
 */
export async function leftInWordPress(a: {
  outcomes: readonly { destination: string; outcome: UnpublishOutcome }[];
  destinationId: string | null;
}): Promise<LeftInWordPress> {
  const counts = new Map<WordPressOutcome, number>();
  for (const entry of a.outcomes) {
    if (entry.destination !== WORDPRESS) continue;
    if (entry.outcome === "removed") continue;
    counts.set(entry.outcome, (counts.get(entry.outcome) ?? 0) + 1);
  }
  if (counts.size === 0) return {};

  const place =
    a.destinationId === null ? null : await stampCapability().place(a.destinationId);

  const out: LeftInWordPress = {};
  for (const [outcome, count] of counts) {
    out[outcome] = { count, place: outcome === "already_gone" ? null : place };
  }
  return out;
}
