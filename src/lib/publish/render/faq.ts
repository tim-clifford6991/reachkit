// SPEC §7 (owner, 2026-10-17, issue 1489) — a page's buyer questions, shown
// on the page.
//
// "Show the FAQ on the page." The questions generation stores beside a page
// (`drafts.meta.faq`) are drawn as a section of the body, in code, above its
// sources list, on the hosted page and in a WordPress post alike. The writer
// still never writes them into the body (#1137); code lays them out, as it
// lays out the sources list and the related guides.
//
// **The data restates what is drawn, and only that.** `withFaq` returns the
// body with the section in it and the pairs as the reader sees them: each
// question and answer is the text of the very blocks the one serialiser
// (`markdown.ts`) renders, so `FAQPage` cannot state a sentence the page
// does not show. A question the body already asks as a heading — a Q&A
// page's own sections — is not drawn twice: its pair is that heading and
// the paragraph under it.
import { copy } from "@/lib/presentation/copy";
import { inlineText, parseInline, type Block, type Say } from "./markdown";
import { isSourcesHeading } from "./made";

/** One question-and-answer pair, as `drafts.meta.faq` holds it. */
export interface FaqEntry {
  question: string;
  answer: string;
}

/** `drafts.meta.faq`, read defensively: a meta blob is jsonb and nothing
 *  in the database constrains its shape, so an entry missing either half
 *  is dropped rather than shown as a question with no answer. An absent
 *  or empty section yields an empty array, and the page draws no section
 *  and no `FAQPage` for it — never an empty one. */
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

/** The words of a question, for finding it among the body's headings:
 *  case, spacing and the closing mark do not make two different. */
function questionKey(text: string): string {
  return text.replace(/\s+/g, " ").trim().replace(/[?!.:]+$/, "").toLowerCase();
}

/** The visible text of a run of inlines, as `FAQPage` restates it. */
function shown(children: Parameters<typeof inlineText>[0]): string {
  return inlineText(children).replace(/\s+/g, " ").trim();
}

/**
 * The body with its buyer questions drawn, and the pairs it now shows.
 *
 * A question the body already asks as a heading keeps its place, and its
 * pair is that heading and the paragraph under it. The rest are a section
 * of their own, headed in the page's language at the level of the body's
 * sources list (else its top level), each question one level under it:
 * above the sources list where the body ends with one, else last.
 */
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
  // The sources list's own level where the body has one, so the two sit
  // side by side; else the body's top level.
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
