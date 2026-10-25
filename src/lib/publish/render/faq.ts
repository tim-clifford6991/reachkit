// SPEC §7 — a page's buyer questions (`drafts.meta.faq`), drawn by code as a section above its sources list on both
// destinations; the writer never writes them into the body.
// The data restates only what is drawn: each pair is the text of the blocks `markdown.ts` renders, so `FAQPage` cannot
// state a sentence the page does not show. A question already asked as a heading is that heading and its paragraph.
import { copy } from "@/lib/presentation/copy";
import { inlineText, parseInline, type Block, type Say } from "./markdown";
import { isSourcesHeading } from "./made";

/** One question-and-answer pair, as `drafts.meta.faq` holds it. */
export interface FaqEntry {
  question: string;
  answer: string;
}

/** `drafts.meta.faq`, read defensively since jsonb has no shape: an entry missing a half is dropped, and none draws no
 *  section and no `FAQPage`, never an empty one. */
export function readFaq(meta: Readonly<Record<string, unknown>> | null): readonly FaqEntry[] {
  const raw = meta?.faq;
  if (!Array.isArray(raw)) return [];
  const entries: FaqEntry[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const { question, answer } = item as { question?: unknown; answer?: unknown };
    if (typeof question !== "string" || typeof answer !== "string") continue;
    if (question.trim() === "" || answer.trim() === "") continue;
    entries.push({ question, answer });
  }
  return Object.freeze(entries);
}

/** A question's words for matching headings; case, spacing and the closing mark do not count. */
function questionKey(text: string): string {
  return text.replace(/\s+/g, " ").trim().replace(/[?!.:]+$/, "").toLowerCase();
}

/** The visible text of a run of inlines, as `FAQPage` restates it. */
function shown(children: Parameters<typeof inlineText>[0]): string {
  return inlineText(children).replace(/\s+/g, " ").trim();
}

/** The body with its questions drawn, and the pairs it shows. The rest form a section at the sources list's level (else
 *  the top level), each question one level under, above the sources list or else last. */
export function withFaq(
  blocks: readonly Block[],
  faq: readonly FaqEntry[],
  say: Say = copy
): { blocks: Block[]; faq: FaqEntry[] } {
  const pairs: FaqEntry[] = [];
  const section: Block[] = [];
  for (const entry of faq) {
    const at = blocks.findIndex(
      (block) => block.kind === "heading" && questionKey(inlineText(block.children)) === questionKey(entry.question)
    );
    if (at >= 0) {
      const heading = blocks[at] as Extract<Block, { kind: "heading" }>;
      const next = blocks[at + 1];
      if (next?.kind === "paragraph") pairs.push({ question: shown(heading.children), answer: shown(next.children) });
      continue;
    }
    const question = parseInline(entry.question);
    const answer = parseInline(entry.answer);
    section.push({ kind: "heading", level: 3, children: question }, { kind: "paragraph", children: answer });
    pairs.push({ question: shown(question), answer: shown(answer) });
  }
  if (section.length === 0) return { blocks: [...blocks], faq: pairs };

  const sources = blocks.findIndex((block) => block.kind === "heading" && isSourcesHeading(inlineText(block.children), say));
  // Beside the sources list at its level, else the body's top level.
  const beside = blocks[sources];
  const top =
    beside?.kind === "heading"
      ? beside.level
      : blocks.reduce<number>((least, block) => (block.kind === "heading" ? Math.min(least, block.level) : least), 2);
  const level = Math.min(top, 5) as 1 | 2 | 3 | 4 | 5;
  const drawn: Block[] = [
    { kind: "heading", level, children: [{ kind: "text", text: say("body.faq.heading") }] },
    ...section.map((block) => (block.kind === "heading" ? { ...block, level: (level + 1) as 2 | 3 | 4 | 5 | 6 } : block)),
  ];
  const at = sources < 0 ? blocks.length : sources;
  return { blocks: [...blocks.slice(0, at), ...drawn, ...blocks.slice(at)], faq: pairs };
}
