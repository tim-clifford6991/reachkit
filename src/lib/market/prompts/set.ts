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
// One exception, once (owner D54 of 2026-10-06, issue 1281): a set built
// from a label other than the market's search term (D49) is rebuilt whole
// from it, and the rate starts again from that date.
//
// And one kind of change is not rotation (issue 1285): the comparison and
// branded prompts name the rivals, so they are always the ones today's
// rivals yield.
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
  /** The market's name the set was built from (D54). Absent on a set built
   *  before the name was kept. */
  builtFrom?: string;
  /** When the set was rebuilt whole from the search term (D54), ISO. It
   *  happens once; the four-week rate starts again here. */
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
  return {
    prompts,
    rotations,
    ...(typeof record.builtFrom === "string" ? { builtFrom: record.builtFrom } : {}),
    ...(typeof record.rebuiltAt === "string" ? { rebuiltAt: record.rebuiltAt } : {}),
  };
}

const named = (text: string): string => text.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * D54: whether the stored set was built from a label other than
 * `searchTerm`, the market's name as its prompts say it. A set that kept
 * no name is read by its wording: none of its prompts says the term. A set
 * already rebuilt is never rebuilt again.
 */
export function builtFromAnotherLabel(stored: PromptSet, searchTerm: string): boolean {
  const term = named(searchTerm);
  if (term === "" || stored.prompts.length === 0 || stored.rebuiltAt !== undefined) return false;
  if (stored.builtFrom !== undefined) return named(stored.builtFrom) !== term;
  return !stored.prompts.some((p) => named(p.text).includes(term));
}

/** The kinds whose wording names a rival. */
const NAMES_RIVALS: readonly PromptKind[] = ["comparison", "branded"];

/**
 * The stored set with its comparison and branded prompts as today's rivals
 * yield them (issue 1285). The rivals are concluded from a pass's answers,
 * so after the prompts were asked: reachkit.app's rebuilt set named three
 * rivals the same pass dropped, and rotation would have kept them for
 * months. A prompt of those kinds the market still yields keeps its date;
 * the rest give way whole, unchecked, and the rotation allowance is not
 * touched. A kind the market yields none of is left as it is. The same
 * object where nothing changed.
 */
export function followRivals(stored: PromptSet, generated: readonly GeneratedPrompt[], now: Date): PromptSet {
  if (stored.prompts.length === 0) return stored;
  const held = new Map(stored.prompts.map((p) => [p.id, p]));
  let prompts = [...stored.prompts];
  let changed = false;
  for (const kind of NAMES_RIVALS) {
    const yielded = generated.filter((p) => p.kind === kind);
    const ids = yielded.map((p) => promptId(p.text));
    const mine = prompts.filter((p) => p.kind === kind);
    if (yielded.length === 0 || (mine.length === ids.length && mine.every((p, i) => p.id === ids[i]))) continue;
    const next = yielded.map(
      (p, i): TrackedPrompt => held.get(ids[i]!) ?? { id: ids[i]!, kind, text: p.text, addedAt: now.toISOString() }
    );
    const at = prompts.findIndex((p) => p.kind === kind);
    const rest = prompts.filter((p) => p.kind !== kind);
    const before = at < 0 ? rest.length : prompts.slice(0, at).filter((p) => p.kind !== kind).length;
    prompts = [...rest.slice(0, before), ...next, ...rest.slice(before)];
    changed = true;
  }
  return changed ? { ...stored, prompts } : stored;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The set this pass asks, from the stored one and what the market yields
 * today. A site with no set gets the whole of `generated`. A site with one
 * keeps it, and swaps in what the allowance still has room for.
 * `searchTerm` is the market's name in `generated` where the market holds a
 * searched term (D49), else `null`: a set built from another label is
 * rebuilt whole from it, once (D54). Its comparison and branded prompts
 * follow the rivals first (`followRivals`), outside the allowance.
 */
export function nextPromptSet(
  before: PromptSet,
  generated: readonly GeneratedPrompt[],
  now: Date,
  searchTerm: string | null = null
): PromptSet {
  const at = now.toISOString();
  const whole = (): TrackedPrompt[] => generated.map((p) => ({ id: promptId(p.text), kind: p.kind, text: p.text, addedAt: at }));
  const from = searchTerm === null ? {} : { builtFrom: searchTerm };
  if (before.prompts.length === 0) return { prompts: whole(), rotations: [], ...from };
  if (searchTerm !== null && generated.length > 0 && builtFromAnotherLabel(before, searchTerm)) {
    return { prompts: whole(), rotations: [], ...from, rebuiltAt: at };
  }
  const stored = followRivals(before, generated, now);

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
  return { ...stored, prompts, rotations: [...rotations, { at, added }] };
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
  return { ...set, prompts };
}
