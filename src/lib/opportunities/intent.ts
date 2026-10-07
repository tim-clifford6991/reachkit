// SPEC §6 (owner, D60, issue 1288) — what a page is for, recorded when its
// topic is decided: the search it should rank for, with its volume, and the
// tracked prompt it should be cited for.
//
// A leaf, and pure: readiness, the generator and Monday's verdict all read
// the same answer from it, and none of them asks a model for it.
import type { Measured } from "@/lib/measure/measured";
import { stemKey } from "@/lib/market/questions/select";

export interface PageIntent {
  /** The search the page should rank for. `volume` is its monthly searches,
   *  `null` where they were not measured. */
  search: { query: string; volume: number | null };
  /** The tracked prompt the page should be cited for, or none. */
  prompt: { id: string; text: string } | null;
}

/** A tracked prompt, as far as matching reads it. */
export interface IntentPrompt {
  id: string;
  text: string;
}

/** The words a wording is about, as the product reads every search
 *  (`stemKey`): stop-words dropped, a plural read as its singular. */
export function topicWords(text: string): Set<string> {
  return new Set(stemKey(text).split(" ").filter((word) => word !== ""));
}

/** The share of the search's topic words a prompt must hold, and the fewest
 *  it must share, to be the prompt a page is for (drafted defaults; the
 *  owner may correct them). */
export const INTENT_MATCH = Object.freeze({ share: 0.4, words: 2 });

/**
 * The tracked prompt closest to a search: the one holding the largest share
 * of the search's topic words, where that share reaches `INTENT_MATCH`. Two
 * prompts level on that are told apart by which is about least else — the
 * share of the two wordings' words that both hold — then by their order in
 * the set. `null` where none is close.
 */
export function closestPrompt<P extends IntentPrompt>(search: string, prompts: readonly P[]): P | null {
  const wanted = topicWords(search);
  if (wanted.size === 0) return null;
  let best: { prompt: P; share: number; likeness: number } | null = null;
  for (const prompt of prompts) {
    const held = topicWords(prompt.text);
    let shared = 0;
    for (const word of wanted) if (held.has(word)) shared += 1;
    const share = shared / wanted.size;
    if (shared < Math.min(INTENT_MATCH.words, wanted.size) || share < INTENT_MATCH.share) continue;
    const likeness = shared / (wanted.size + held.size - shared);
    if (best === null || share > best.share || (share === best.share && likeness > best.likeness)) {
      best = { prompt, share, likeness };
    }
  }
  return best?.prompt ?? null;
}

/** A measured volume above zero, else `null`: a search nobody was measured
 *  making is not a search to rank for. */
export function measuredVolume(volume: Measured<number> | number | null | undefined): number | null {
  if (volume === null || volume === undefined) return null;
  const value = typeof volume === "number" ? volume : volume.kind === "unmeasured" ? null : volume.value;
  return value !== null && value > 0 ? value : null;
}

/** The intent of a page written for `query`, against the prompts tracked
 *  today. `null` where there is no search to write for. */
export function intentFor(
  a: { query: string | null; volume: Measured<number> | number | null | undefined },
  prompts: readonly IntentPrompt[]
): PageIntent | null {
  const query = (a.query ?? "").replace(/\s+/g, " ").trim();
  if (query === "") return null;
  const prompt = closestPrompt(query, prompts);
  return {
    search: { query, volume: measuredVolume(a.volume) },
    prompt: prompt === null ? null : { id: prompt.id, text: prompt.text },
  };
}

/** Whether the intent names anything a verdict could find: a search with
 *  measured volume, or a tracked prompt. */
export function hasGoal(intent: PageIntent | null): boolean {
  return intent !== null && (intent.search.volume !== null || intent.prompt !== null);
}

/** `drafts.meta.intent` as it was stored; `null` for anything else. */
export function readIntent(value: unknown): PageIntent | null {
  if (typeof value !== "object" || value === null) return null;
  const { search, prompt } = value as { search?: unknown; prompt?: unknown };
  if (typeof search !== "object" || search === null) return null;
  const { query, volume } = search as { query?: unknown; volume?: unknown };
  if (typeof query !== "string" || query.trim() === "") return null;
  const p = (prompt ?? null) as { id?: unknown; text?: unknown } | null;
  return {
    search: { query, volume: typeof volume === "number" ? volume : null },
    prompt: p !== null && typeof p.id === "string" && typeof p.text === "string" ? { id: p.id, text: p.text } : null,
  };
}
