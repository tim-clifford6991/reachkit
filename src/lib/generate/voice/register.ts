// SPEC §7 (owner, 2026-10-10, issue 1390) — the voice a page is written in.
//
// Three voices, and the page's is chosen in code before it is written:
//
//   * **ours** — the business speaking: "we" for the business, "you" for
//     the reader. The default.
//   * **guide** — a neutral guide in the third person, for a formal or
//     regulated business: a law, tax, finance, insurance or medical practice,
//     or one whose own voice text says it writes formally.
//   * **short** — a short answer of `VOICE.short.words`, for a simple
//     question on a page type a short answer suits.
//
// The customer may fix the voice in Settings (`sites.writing_voice`); it is
// never a step, and where they have not, it is chosen here. `voice_text` —
// how the business sounds — is theirs and is handed to the writer as it is
// (§8 hard rule 7); this chooses who is speaking and for how long.
//
// Data and a pure function: no model, no I/O. The lists are drafted
// defaults the owner corrects.
import { VOICE } from "@/lib/config/constants";
import type { Language } from "@/lib/locale/locales";
import type { ContentType } from "@/lib/opportunities/content-type";

export const WRITING_VOICES = ["ours", "guide", "short"] as const;
export type WritingVoice = (typeof WRITING_VOICES)[number];

export function isWritingVoice(value: unknown): value is WritingVoice {
  return typeof value === "string" && (WRITING_VOICES as readonly string[]).includes(value);
}

/** The voice a page is written in, as its pack records it. */
export interface PageVoice {
  voice: WritingVoice;
  /** Who speaks: the business as "we", or a guide naming it. */
  person: "we" | "third";
  /** Whether the customer fixed it in Settings or it was chosen here. */
  chosen: "customer" | "automatic";
}

/** A category that names a profession people expect to be spoken to
 *  formally by, in English and German word roots. */
const REGULATED_RE =
  /\b(?:law|legal|lawyer|attorney|solicitor|barrister|notar|account|tax|audit|bookkeep|financ|insur|bank|invest|mortgage|pension|wealth|medic|dental|dentist|clinic|doctor|physician|surgeon|health|pharma|hospital|anwalt|anwält|kanzlei|steuer|wirtschaftsprüf|buchhalt|versicher|finanz|arzt|ärzt|zahn|praxis|klinik|apothek)/iu;
/** A voice text that says the business writes formally. */
const FORMAL_VOICE_RE = /\b(?:formal|third[- ]person|impersonal|reserved|authoritative|clinical|institutional|förmlich|sachlich|distanziert|dritten? person)\b/iu;

/** How a simple question opens: one a fact settles — is it, can it, what is
 *  it, what does it cost, when, where. */
const SIMPLE_OPENING: Readonly<Record<Language, RegExp>> = {
  en: /^(?:is|are|can|could|does|do|did|should|will|what is|what are|what does|what's|when|where|who|how much|how long|how many|how often)\b/i,
  de: /^(?:ist|sind|kann|können|darf|dürfen|muss|müssen|gibt es|was ist|was sind|was kostet|was kosten|wie viel|wie viele|wie lange|wie oft|wann|wo|wer)\b/i,
};
/** A question that asks for a choice among options is never simple. */
const COMPARES_RE = /\b(?:best|better|top|vs\.?|versus|compare[ds]?|comparison|alternatives?|beste[rnms]?|vergleich|alternativen?)\b/i;
/** The types a short answer suits: one question, or one concept. */
const SHORT_TYPES: readonly ContentType[] = ["qa", "documentation"];

/** Whether the business is one that is written for formally. */
export function writesFormally(a: { voiceText: string | null; category: string }): boolean {
  return REGULATED_RE.test(a.category) || FORMAL_VOICE_RE.test(a.voiceText ?? "");
}

/** Whether `question` is one a short answer settles. */
export function simpleQuestion(question: string, language: Language): boolean {
  const text = question.trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  return words > 0 && words <= VOICE.short.questionWords && SIMPLE_OPENING[language].test(text) && !COMPARES_RE.test(text);
}

/**
 * The page's voice. The customer's own choice stands; a page type a short
 * answer does not suit — a comparison keeps its table and its length — is
 * written in the business's person instead.
 */
export function chooseVoice(a: {
  setting: WritingVoice | null;
  voiceText: string | null;
  category: string;
  question: string;
  type: ContentType;
  language: Language;
}): PageVoice {
  const formal = writesFormally(a);
  const short = SHORT_TYPES.includes(a.type);
  if (a.setting !== null) {
    const voice = a.setting === "short" && !short ? (formal ? "guide" : "ours") : a.setting;
    return { voice, person: voice === "guide" || (voice === "short" && formal) ? "third" : "we", chosen: "customer" };
  }
  if (short && simpleQuestion(a.question, a.language)) return { voice: "short", person: formal ? "third" : "we", chosen: "automatic" };
  return formal ? { voice: "guide", person: "third", chosen: "automatic" } : { voice: "ours", person: "we", chosen: "automatic" };
}

/** The words a page in this voice is held to, where the voice sets them. */
export function voiceLength(voice: PageVoice | undefined): { floor: number; ceiling: number } | null {
  return voice?.voice === "short" ? { ...VOICE.short.words } : null;
}

/** What the writer is told of the page's voice. */
export function voiceRules(voice: PageVoice): string[] {
  const person =
    voice.person === "we"
      ? 'Write as the business itself: "we" and "our" for the business, "you" for the reader. Name the business where a reader needs the name — the title, the short answer, a comparison — and say "we" after that.'
      : 'Write as a neutral guide in the third person: name the business as any other company is named, never "we" or "our" for it, and address the reader as "you" only where an instruction needs it.';
  const short =
    voice.voice === "short"
      ? [`This page is a short answer: the body is ${VOICE.short.words.floor} to ${VOICE.short.words.ceiling} words. Answer first, give the two or three facts that settle the question, and stop.`]
      : [];
  return [person, ...short];
}
