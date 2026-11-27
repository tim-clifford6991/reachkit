// src/lib/presentation/page-title.ts — a page's title as a reader sees it (owner ruling 88.4, 2026-11-22).
import { SMALL_WORDS, titleCase } from "title-case";
import { languagePack } from "@/lib/locale/language";
import { DEFAULT_LOCALE, isLanguage, type Language } from "@/lib/locale/locales";
import { copy } from "@/lib/presentation/copy";

// The library keeps iPhone mid-title but capitalises it as a first word; a word cased this way is the brand's own.
const OWN_CASE = /\p{Ll}\p{Lu}/u;
const WORD = /[\p{L}\p{N}]+/gu;
// A domain's labels are no casing: "peec.ai" never says "AI" is written "ai".
const HOST = /(?:https?:\/\/)?(?:[\p{L}\p{N}-]+\.)+\p{L}{2,}(?![\p{L}\p{N}])(?:\/\S*)?/giu;

/** The names `texts` write with a capital past their first letter (AI, ChatGPT, HMRC, iPhone), where they never write
 *  the same word plainly too, a domain or address aside: the casing a title takes them in. */
export function ownCasings(texts: readonly string[]): string[] {
  const words = texts.flatMap((text) => text.replace(HOST, " ").match(WORD) ?? []);
  const plain = new Set(words.filter((word) => !/^.\P{Lu}*\p{Lu}/u.test(word)).map((word) => word.toLowerCase()));
  const cased = words.filter((word) => word.length > 1 && /^.\P{Lu}*\p{Lu}/u.test(word) && /\p{L}/u.test(word) && !plain.has(word.toLowerCase()));
  // The first text to write a word wins: a caller lists the sources before the model's own wording.
  return [...new Map(cased.reverse().map((word) => [word.toLowerCase(), word])).values()];
}

// The engines the product measures, as it names them: their casing outranks any a title or a source carries.
const ENGINES = ownCasings((["ai-answers.engine.chatgpt", "ai-answers.engine.ai-overview", "ai-answers.engine.ai-mode"] as const).map((key) => copy(key)));

/** A title that opens as a yes-or-no question closes its first clause with the mark, which a colon after it gives way to. */
function questionMarked(text: string, language: Language): string {
  if (text.includes("?") || !new RegExp(`^(?:${languagePack(language).title.asksYesNo})(?![\\p{L}\\p{N}])`, "iu").test(text.trim())) return text;
  const end = /\s*:|\s+[–—]\s|\s-\s/u.exec(text);
  if (end === null) return `${text.trimEnd()}?`;
  return `${text.slice(0, end.index)}?${text.slice(end.index + (end[0].includes(":") ? end[0].length : 0))}`;
}

/** Title Case in English: each of `names` in its own casing, a small word after the first lowered, and the casing a word
 *  already carries kept (ChatGPT, iPhone, SEO); German capitalises nouns, not every word, so it stands as written.
 *  `language` is the site's stored one; none reads as the default, English. */
export function pageTitle(title: string, language: unknown, names: readonly string[] = []): string {
  const read = isLanguage(language) ? language : DEFAULT_LOCALE.language;
  const text = questionMarked(title, read);
  if (read !== "en") return text;
  const named = new Map([...names, ...ENGINES].map((name) => [name.toLowerCase(), name]));
  const recased = text.replace(WORD, (word, at: number) => named.get(word.toLowerCase()) ?? (at > 0 && SMALL_WORDS.has(word.toLowerCase()) && /^\p{Lu}\p{Ll}*$/u.test(word) ? word.toLowerCase() : word));
  const words = recased.split(/(\s+)/);
  const cased = titleCase(recased).split(/(\s+)/);
  return cased.length === words.length ? cased.map((word, i) => (OWN_CASE.test(words[i]!) ? words[i]! : word)).join("") : cased.join("");
}
