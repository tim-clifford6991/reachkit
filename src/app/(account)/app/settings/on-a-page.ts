// "How it shows on a page": one sentence, word for word, from the newest live
// page that uses a stored promise or word. Pure; nothing here is written.
import { sentencesOf } from "@/lib/generate/rules/text";

export interface LivePage {
  url: string;
  title: string;
  markdown: string;
  publishedAt: Date;
}

/** Which of the two lists the sentence uses, for the caption. */
export type OnAPageFrom = "claims" | "vocabulary" | "both";

export interface OnAPage {
  url: string;
  title: string;
  publishedAt: Date;
  /** The sentence in order, each matched term its own marked part. */
  parts: readonly { text: string; mark: boolean }[];
  from: OnAPageFrom;
  lang: string;
}

const escape = (term: string): string => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-word and case-insensitive: "tankless" is not found in "tanklessly". */
function termPattern(terms: readonly string[]): RegExp | null {
  const unique = [...new Set(terms.map((t) => t.trim()).filter((t) => t !== ""))].sort((a, b) => b.length - a.length);
  if (unique.length === 0) return null;
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${unique.map(escape).join("|")})(?![\\p{L}\\p{N}])`, "giu");
}

export function showsOnAPage(a: {
  pages: readonly LivePage[];
  claims: readonly string[];
  vocabulary: readonly string[];
  lang: string;
}): OnAPage | null {
  const pattern = termPattern([...a.claims, ...a.vocabulary]);
  if (pattern === null) return null;
  const claims = new Set(a.claims.map((t) => t.trim().toLowerCase()));
  const vocabulary = new Set(a.vocabulary.map((t) => t.trim().toLowerCase()));
  const newestFirst = [...a.pages].sort((x, y) => y.publishedAt.getTime() - x.publishedAt.getTime());

  for (const page of newestFirst) {
    for (const sentence of sentencesOf(page.markdown)) {
      if (/^\s*#/.test(sentence.raw)) continue;
      const parts: { text: string; mark: boolean }[] = [];
      let fromClaims = false;
      let fromVocabulary = false;
      let at = 0;
      for (const match of sentence.text.matchAll(pattern)) {
        const term = match[0].toLowerCase();
        fromClaims ||= claims.has(term);
        fromVocabulary ||= vocabulary.has(term);
        if (match.index > at) parts.push({ text: sentence.text.slice(at, match.index), mark: false });
        parts.push({ text: match[0], mark: true });
        at = match.index + match[0].length;
      }
      if (at === 0) continue;
      if (at < sentence.text.length) parts.push({ text: sentence.text.slice(at), mark: false });
      return {
        url: page.url,
        title: page.title,
        publishedAt: page.publishedAt,
        parts,
        from: fromClaims && fromVocabulary ? "both" : fromClaims ? "claims" : "vocabulary",
        lang: a.lang,
      };
    }
  }
  return null;
}
