// SPEC §6 (owner ruling 2026-09-17, issue 837) — the broader categories a
// founder is offered when a paid pass, widened, still found no market.
//
// "The app suggests 2–3 broader categories derived from the site's own
// profile (vocabulary, head term, offering type) and a free-text field."
//
// Pure, like `widen.ts`: the stored profile and the category the pass was
// seeded on in, a short list out. Nothing is bought to make a suggestion —
// every word here is one the pass already read.
import { REMEASURE } from "@/lib/config/constants";
import type { Profile } from "./profile";
import { headTermOf } from "./widen";

function words(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter((w) => w !== "");
}

/** The shorter tails of a category's head term, broadest last:
 *  "seo content marketing software" → "content marketing software",
 *  "marketing software". */
function headTails(category: string): string[] {
  const head = headTermOf(category) ?? words(category).join(" ");
  const all = words(head);
  const tails: string[] = [];
  for (let from = 0; all.length - from >= 2; from++) tails.push(all.slice(from).join(" "));
  return tails;
}

/**
 * Up to `REMEASURE.suggestions` categories broader than the one the pass
 * measured, in the order they are offered: the head term of that category
 * and its shorter tails, the profile's own category where it differs, the
 * profile's multi-word vocabulary, and the offering type where it names more
 * than one word. Each has at least two words — a single word is not a market
 * anybody searches — and none is the measured category again or names the
 * site's own brand. Empty where the profile names nothing usable; the
 * founder's own words are still asked for.
 */
export function broaderCategories(a: { category: string | null; profile: Profile | null }): string[] {
  const measured = a.category ?? a.profile?.category ?? "";
  const brand = new Set((a.profile?.brandTokens ?? []).flatMap(words));
  const held = new Set([words(measured).join(" ")]);
  const out: string[] = [];

  const offer = (candidate: string): void => {
    const tokens = words(candidate);
    const key = tokens.join(" ");
    if (tokens.length < 2 || held.has(key) || tokens.some((token) => brand.has(token))) return;
    held.add(key);
    out.push(key);
  };

  if (measured !== "") headTails(measured).forEach(offer);
  if (a.profile !== null) {
    offer(a.profile.category);
    headTails(a.profile.category).forEach(offer);
    a.profile.vocabulary.forEach(offer);
    offer(a.profile.offeringType);
  }
  return out.slice(0, REMEASURE.suggestions);
}
