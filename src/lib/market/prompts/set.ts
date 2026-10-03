// src/lib/market/prompts/set.ts — the set a site tracks, stored with the
// site (`sites.tracked_prompts`), and how it changes (SPEC §6, owner D19
// and D33 of 2026-10-03, #1162).
//
// A rate over four weeks means something only while the questions stay the
// same, so the set is stored and not regenerated each pass. It is built
// once, whole and unchecked (D33). After that at most
// `TRACKED_PROMPTS.ROTATION_SHARE` of it changes in any
// `TRACKED_PROMPTS.ROTATION_WEEKS`: a prompt the market no longer yields —
// it names a rival since dropped — gives its place to one the market now
// yields. Only a prompt added that way is pre-checked.
//
// Pure: no I/O and no clock of its own.
import { TRACKED_PROMPTS } from "@/lib/config/constants";
import { PROMPT_KINDS, type GeneratedPrompt, type PromptKind } from "./generate";

export interface TrackedPrompt {
  /** Stable for the prompt's wording, so four weeks of answers join on it. */
  id: string;
  kind: PromptKind;
  text: string;
  addedAt: string;
  /** Added by rotation and not yet answered once: its first answers decide
   *  whether it stays (D33). */
  precheck?: true;
}

export interface PromptSet {
  prompts: readonly TrackedPrompt[];
  /** When prompts were rotated in, and how many: the quarter's allowance
   *  is counted over these. */
  rotations: readonly { at: string; added: number }[];
}

export const EMPTY_PROMPT_SET: PromptSet = Object.freeze({ prompts: [], rotations: [] });

/** FNV-1a over the lowercased wording, as eight hex digits. */
export function promptId(text: string): string {
  let hash = 0x811c9dc5;
  for (const char of text.trim().toLowerCase()) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function isKind(value: unknown): value is PromptKind {
  return typeof value === "string" && (PROMPT_KINDS as readonly string[]).includes(value);
}

/** The stored column as a set; anything unreadable is the empty set, which
 *  the next pass builds afresh. */
export function parsePromptSet(value: unknown): PromptSet {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return EMPTY_PROMPT_SET;
  const record = value as Record<string, unknown>;
  const prompts: TrackedPrompt[] = [];
  for (const entry of Array.isArray(record.prompts) ? record.prompts : []) {
    if (typeof entry !== "object" || entry === null) continue;
    const p = entry as Record<string, unknown>;
    if (typeof p.text !== "string" || p.text.trim() === "" || !isKind(p.kind)) continue;
    prompts.push({
      id: typeof p.id === "string" ? p.id : promptId(p.text),
      kind: p.kind,
      text: p.text,
      addedAt: typeof p.addedAt === "string" ? p.addedAt : "",
      ...(p.precheck === true ? { precheck: true as const } : {}),
    });
  }
  const rotations: { at: string; added: number }[] = [];
  for (const entry of Array.isArray(record.rotations) ? record.rotations : []) {
    if (typeof entry !== "object" || entry === null) continue;
    const r = entry as Record<string, unknown>;
    if (typeof r.at === "string" && typeof r.added === "number") rotations.push({ at: r.at, added: r.added });
  }
  return { prompts, rotations };
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The set this pass asks, from the stored one and what the market yields
 * today. A site with no set gets the whole of `generated`. A site with one
 * keeps it, and swaps in what the allowance still has room for.
 */
export function nextPromptSet(stored: PromptSet, generated: readonly GeneratedPrompt[], now: Date): PromptSet {
  const at = now.toISOString();
  if (stored.prompts.length === 0) {
    return { prompts: generated.map((p) => ({ id: promptId(p.text), kind: p.kind, text: p.text, addedAt: at })), rotations: [] };
  }

  const yielded = new Set(generated.map((p) => promptId(p.text)));
  const held = new Set(stored.prompts.map((p) => p.id));
  const fresh = generated.filter((p) => !held.has(promptId(p.text)));
  if (fresh.length === 0) return stored;

  const since = now.getTime() - TRACKED_PROMPTS.ROTATION_WEEKS * WEEK_MS;
  const rotations = stored.rotations.filter((r) => Date.parse(r.at) >= since);
  const used = rotations.reduce((sum, r) => sum + r.added, 0);
  let room = Math.floor(stored.prompts.length * TRACKED_PROMPTS.ROTATION_SHARE) - used;
  if (room <= 0) return stored;

  const prompts = [...stored.prompts];
  let added = 0;
  for (const candidate of fresh) {
    if (room <= 0) break;
    const entry: TrackedPrompt = { id: promptId(candidate.text), kind: candidate.kind, text: candidate.text, addedAt: at, precheck: true };
    const stale = prompts.findIndex((p) => p.kind === candidate.kind && !yielded.has(p.id));
    if (stale >= 0) prompts[stale] = entry;
    else if (prompts.filter((p) => p.kind === candidate.kind).length < TRACKED_PROMPTS.SPLIT[candidate.kind]) prompts.push(entry);
    else continue;
    added += 1;
    room -= 1;
  }
  if (added === 0) return stored;
  return { prompts, rotations: [...rotations, { at, added }] };
}

/**
 * The set after its rotated-in prompts have been answered once (D33): one
 * whose answers named no brand leaves, one whose answers named any stays
 * and is no longer pending, and one nobody answered waits for next week.
 */
export function settlePrechecks(
  set: PromptSet,
  outcome: ReadonlyMap<string, "keep" | "drop">
): PromptSet {
  if (!set.prompts.some((p) => p.precheck === true)) return set;
  const prompts: TrackedPrompt[] = [];
  for (const prompt of set.prompts) {
    const verdict = prompt.precheck === true ? outcome.get(prompt.id) : undefined;
    if (verdict === "drop") continue;
    if (verdict === "keep") prompts.push({ id: prompt.id, kind: prompt.kind, text: prompt.text, addedAt: prompt.addedAt });
    else prompts.push(prompt);
  }
  return { prompts, rotations: set.rotations };
}
