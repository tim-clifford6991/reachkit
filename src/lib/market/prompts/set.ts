// src/lib/market/prompts/set.ts — the panel a site tracks, stored with the site (`sites.tracked_prompts`), and how it changes
// (SPEC §6, owner ruling 73, 2026-11-22).
//
// A rate over four weeks means something only while the questions stay the same, so the set is stored and not drawn again each pass.
// It grows to `TRACKED_PROMPTS.PANEL` freely; after that at most `TRACKED_PROMPTS.ROTATION_SHARE` of it is replaced in any
// `TRACKED_PROMPTS.ROTATION_WEEKS`, an item the searches no longer yield giving its place to one they now yield. A set of templates is
// rebuilt whole as the panel once, under the restart mark.
//
// Pure: no I/O and no clock of its own.
import { TRACKED_PROMPTS } from "@/lib/config/constants";
import { PROMPT_KINDS, type GeneratedPrompt, type PromptKind } from "./generate";

export interface TrackedPrompt {
  /** Stable for the prompt's wording, so four weeks of answers join on it. */
  id: string;
  kind: PromptKind;
  text: string;
  /** The question ChatGPT is asked in the search's place; absent, it is asked the search. */
  question?: string;
  addedAt: string;
}

export interface PromptSet {
  prompts: readonly TrackedPrompt[];
  /** When prompts were rotated in, and how many: the quarter's allowance is counted over these. */
  rotations: readonly { at: string; added: number }[];
  /** When the set was rebuilt whole, ISO; the four-week rate starts again here. */
  rebuiltAt?: string;
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

/** The stored column as a set; anything unreadable is the empty set, which the next pass builds afresh. */
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
      ...(typeof p.question === "string" && p.question.trim() !== "" ? { question: p.question } : {}),
      addedAt: typeof p.addedAt === "string" ? p.addedAt : "",
    });
  }
  const rotations: { at: string; added: number }[] = [];
  for (const entry of Array.isArray(record.rotations) ? record.rotations : []) {
    if (typeof entry !== "object" || entry === null) continue;
    const r = entry as Record<string, unknown>;
    if (typeof r.at === "string" && typeof r.added === "number") rotations.push({ at: r.at, added: r.added });
  }
  return { prompts, rotations, ...(typeof record.rebuiltAt === "string" ? { rebuiltAt: record.rebuiltAt } : {}) };
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** The set this pass asks, from the stored one and the panel the searches yield today. The same object where nothing changed. */
export function nextPromptSet(before: PromptSet, generated: readonly GeneratedPrompt[], now: Date): PromptSet {
  const at = now.toISOString();
  const entry = (p: GeneratedPrompt): TrackedPrompt => ({ id: promptId(p.text), kind: p.kind, text: p.text, ...(p.question === undefined ? {} : { question: p.question }), addedAt: at });
  if (generated.length === 0) return before;
  if (before.prompts.length === 0) return { prompts: generated.map(entry), rotations: [] };
  if (before.prompts.some((p) => p.kind !== "search")) return { prompts: generated.map(entry), rotations: [], rebuiltAt: at };

  const yielded = new Set(generated.map((p) => promptId(p.text)));
  const held = new Set(before.prompts.map((p) => p.id));
  const fresh = generated.filter((p) => !held.has(promptId(p.text)));
  if (fresh.length === 0) return before;

  const prompts = [...before.prompts];
  while (prompts.length < TRACKED_PROMPTS.PANEL && fresh.length > 0) prompts.push(entry(fresh.shift()!));
  const since = now.getTime() - TRACKED_PROMPTS.ROTATION_WEEKS * WEEK_MS;
  const rotations = before.rotations.filter((r) => Date.parse(r.at) >= since);
  let room = Math.floor(prompts.length * TRACKED_PROMPTS.ROTATION_SHARE) - rotations.reduce((sum, r) => sum + r.added, 0);
  let added = 0;
  for (const candidate of fresh) {
    const stale = prompts.findIndex((p) => !yielded.has(p.id));
    if (room <= 0 || stale < 0) break;
    prompts[stale] = entry(candidate);
    added += 1;
    room -= 1;
  }
  if (prompts.length === before.prompts.length && added === 0) return before;
  return { ...before, prompts, rotations: added === 0 ? before.rotations : [...rotations, { at, added }] };
}
