// src/lib/presentation/page-title.ts — a page's title as a reader sees it (owner ruling 88.4, 2026-11-22).
import { SMALL_WORDS, titleCase } from "title-case";
import { DEFAULT_LOCALE, isLanguage } from "@/lib/locale/locales";

// The library keeps iPhone mid-title but capitalises it as a first word; a word cased this way is the brand's own.
const OWN_CASE = /\p{Ll}\p{Lu}/u;
const WORD = /[\p{L}\p{N}]+/gu;

/** The names `texts` write with a capital past their first letter (AI, ChatGPT, HMRC, iPhone), where they never write
 *  the same word plainly too: the casing a title takes them in. */
export function ownCasings(texts: readonly string[]): string[] {
  const words = texts.flatMap((text) => text.match(WORD) ?? []);
  const plain = new Set(words.filter((word) => !/^.\P{Lu}*\p{Lu}/u.test(word)).map((word) => word.toLowerCase()));
  return [...new Set(words.filter((word) => word.length > 1 && /^.\P{Lu}*\p{Lu}/u.test(word) && /\p{L}/u.test(word) && !plain.has(word.toLowerCase())))];
}

/** Title Case in English: each of `names` in its own casing, a small word after the first lowered, and the casing a word
 *  already carries kept (ChatGPT, iPhone, SEO); German capitalises nouns, not every word, so it stands as written.
 *  `language` is the site's stored one; none reads as the default, English. */
export function pageTitle(text: string, language: unknown, names: readonly string[] = []): string {
  if ((isLanguage(language) ? language : DEFAULT_LOCALE.language) !== "en") return text;
  const named = new Map(names.map((name) => [name.toLowerCase(), name]));
  const recased = text.replace(WORD, (word, at: number) => named.get(word.toLowerCase()) ?? (at > 0 && SMALL_WORDS.has(word.toLowerCase()) && /^\p{Lu}\p{Ll}*$/u.test(word) ? word.toLowerCase() : word));
  const words = recased.split(/(\s+)/);
  const cased = titleCase(recased).split(/(\s+)/);
  return cased.length === words.length ? cased.map((word, i) => (OWN_CASE.test(words[i]!) ? words[i]! : word)).join("") : cased.join("");
}
