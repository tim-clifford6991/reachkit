// SPEC §7 (2026-09-29) *Length and the writer* · issue 1138 — a customer's
// page: written on the writer tier, held to its length, read by a critic.
//
//   1. **The draft**, on the writer tier (`./steps.ts`' `draft`): the frame
//      and the sections, a few to a call, each call reading the ones before
//      it and on a clock of its own, so no single call's clock caps the page.
//   2. **The floor.** The page's words are counted in code, on the page as
//      `./compose.ts` lays it out, against the one length target
//      (`../length.ts`). A page short of its floor has its short sections
//      written once more; one still short is `short`, which the caller
//      holds.
//   3. **The critic.** One call scores the page and may name sections to be
//      written again — to add as well as to cut. **The floor is checked in
//      code after the critic** (owner, 2026-10-02, round 1: a critic cut a
//      1,565-word page to 1,480, under its floor): a rewrite that falls under
//      the floor, or loses something the page had — a section's text, a
//      table, a cited page — is refused, and the page stands as it was
//      before the critic.
//
// The critic is the one part a page can go without. A critic that does not
// answer, a ceiling that would stop it, or a page that has already taken
// `WRITER.criticAfterMs` to write leaves the page as written; none of them
// is a step that failed.
import { DRAFT_SECTIONS_PER_CALL, WRITER } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import type { Opportunity } from "@/lib/opportunities/types";
import { bodyWords, lengthTargetFor, type LengthTarget } from "../length";
import type { DraftPromptInputs } from "../voice/inputs";
import { composePage, type TidyInputs } from "./compose";
import type { FixNote } from "./repair";
import { critic, draft, sectionsAgain, type Brief, type CriticRead, type DraftParts, type Outline } from "./steps";

/** What the row keeps of the critic: its scores and what became of its
 *  rewrite. Never a word of the page or of an instruction. */
export interface CriticRecord {
  scores: Omit<CriticRead, "revise">;
  /** How many sections it had written again. */
  revised: number;
  /** Whether the page that went on is the one it revised. `false` where its
   *  rewrite was refused, or where it asked for nothing. */
  kept: boolean;
}

export interface PageLength {
  words: number;
  floor: number | null;
  ceiling: number | null;
  /** How many sections were written a second time for being short. */
  rewritten: number;
}

export type WrittenDraft =
  | { kind: "written"; parts: DraftParts; length: PageLength; critic: CriticRecord | null }
  /** Written twice and still under its floor. The parts are the page as it
   *  stands, for the row the caller holds. */
  | { kind: "short"; parts: DraftParts; length: PageLength }
  /** A call of the draft did not answer. */
  | { kind: "failed" };

interface Shared {
  brief: Brief;
  outline: Outline;
  facts: readonly { url: string; passage: string }[];
  marketFacts?: readonly { url: string; source: string; passage: string; readAt: string }[];
  products?: readonly { domain: string; pages: readonly string[] }[];
}

type Share = { min: number; max: number } | null;

/** Each section's share of the page's length, by its block. */
function shares(outline: Outline, target: LengthTarget | null): Share[] {
  if (target === null) return outline.sections.map(() => null);
  const total = outline.sections.reduce((sum, each) => sum + WRITER.share[each.role], 0);
  return outline.sections.map((each) => ({
    min: Math.ceil((target.floor * WRITER.share[each.role]) / total),
    max: Math.floor((target.ceiling * WRITER.share[each.role]) / total),
  }));
}

const TABLE_RULE = /^[ \t]*\|?[ \t]*:?-{3,}:?[ \t]*(\|[ \t]*:?-{3,}:?[ \t]*)*\|?[ \t]*$/gm;
const LINK = /\]\((https?:\/\/[^)\s]+)\)/g;

/** What a critic's rewrite may not take from the page: any section's text,
 *  a table, a cited page. */
function keeps(before: readonly string[], after: readonly string[]): boolean {
  if (after.some((body) => body.trim() === "")) return false;
  const was = before.join("\n\n");
  const is = after.join("\n\n");
  if ((is.match(TABLE_RULE) ?? []).length < (was.match(TABLE_RULE) ?? []).length) return false;
  const cited = new Set([...is.matchAll(LINK)].map((match) => match[1]));
  return [...was.matchAll(LINK)].every((match) => cited.has(match[1]));
}

export async function writeDraft(
  c: CostContext,
  inputs: DraftPromptInputs,
  a: Shared & {
    opportunity: Pick<Opportunity, "type" | "targetQuery">;
    fix?: readonly FixNote[];
    /** How the page is laid out, so its words are counted as it will read. */
    tidy: TidyInputs;
  }
): Promise<WrittenDraft> {
  const startedAt = Date.now();
  const target = lengthTargetFor(a.opportunity);
  const words = shares(a.outline, target);
  const shared: Shared = {
    brief: a.brief,
    outline: a.outline,
    facts: a.facts,
    ...(a.marketFacts === undefined ? {} : { marketFacts: a.marketFacts }),
    ...(a.products === undefined ? {} : { products: a.products }),
  };
  const wordsOf = (parts: DraftParts): number => bodyWords(composePage(parts, a.outline, a.tidy).body.bodyMarkdown);
  const lengthOf = (parts: DraftParts, rewritten: number): PageLength => ({
    words: wordsOf(parts),
    floor: target?.floor ?? null,
    ceiling: target?.ceiling ?? null,
    rewritten,
  });

  // 1. The draft.
  const first = await draft(c, inputs, {
    ...shared,
    tier: "writer",
    ...(target === null ? {} : { words }),
    ...(a.fix === undefined ? {} : { fix: a.fix }),
  });
  if (first.kind === "unmeasured") return { kind: "failed" };
  let parts = first.value;

  /** The named sections written again, a few to a call, against the page as
   *  it stands. `null` where a call did not answer. */
  const again = async (from: DraftParts, write: readonly { index: number; note: string }[]): Promise<DraftParts | null> => {
    let sections = from.sections;
    for (let at = 0; at < write.length; at += DRAFT_SECTIONS_PER_CALL) {
      const asked = write.slice(at, at + DRAFT_SECTIONS_PER_CALL);
      const wrote = await sectionsAgain(c, inputs, { ...shared, bodies: sections, words, write: asked });
      if (wrote.kind === "unmeasured") return null;
      sections = sections.map((body, index) => {
        const position = asked.findIndex((each) => each.index === index);
        return position === -1 ? body : wrote.value[position]!;
      });
    }
    return { ...from, sections };
  };

  // 2. The floor: a short page has its short sections written once more.
  let rewritten = 0;
  if (target !== null && wordsOf(parts) < target.floor) {
    const counts = parts.sections.map((body) => bodyWords(body));
    const under = counts.map((_, index) => index).filter((index) => counts[index]! < words[index]!.min);
    // Every section met its share and the page is still short by a few
    // words: the section furthest under its share's top is the one to grow.
    const widest = counts.reduce((best, count, index) => (count / words[index]!.max < counts[best]! / words[best]!.max ? index : best), 0);
    const write = (under.length > 0 ? under : [widest]).map((index) => ({
      index,
      note: `This section has ${counts[index]} words and needs at least ${words[index]!.min}. Write it fuller.`,
    }));
    const next = await again(parts, write);
    if (next === null) return { kind: "failed" };
    parts = next;
    rewritten = write.length;
    if (wordsOf(parts) < target.floor) return { kind: "short", parts, length: lengthOf(parts, rewritten) };
  }

  // 3. The critic, where there is time and money for it.
  if (c.capHit() || Date.now() - startedAt > WRITER.criticAfterMs) {
    return { kind: "written", parts, length: lengthOf(parts, rewritten), critic: null };
  }
  const read = await critic(c, inputs, {
    brief: a.brief,
    outline: a.outline,
    parts,
    words: wordsOf(parts),
    target,
    ...(a.marketFacts === undefined ? {} : { marketFacts: a.marketFacts }),
    maxRevisions: WRITER.maxRevisions,
  });
  if (read.kind === "unmeasured") return { kind: "written", parts, length: lengthOf(parts, rewritten), critic: null };

  const { revise, ...scores } = read.value;
  const asked = revise
    .filter(
      (each, at) =>
        each.section >= 0 &&
        each.section < parts.sections.length &&
        revise.findIndex((other) => other.section === each.section) === at
    )
    .slice(0, WRITER.maxRevisions);
  const revised = asked.length === 0 ? null : await again(parts, asked.map((each) => ({ index: each.section, note: each.instruction })));
  // The floor and the page's own parts, checked in code after the critic.
  const kept =
    revised !== null &&
    (target === null || wordsOf(revised) >= target.floor) &&
    keeps(parts.sections, revised.sections);
  const final = kept ? revised : parts;
  return {
    kind: "written",
    parts: final,
    length: lengthOf(final, rewritten),
    critic: { scores, revised: asked.length, kept },
  };
}
