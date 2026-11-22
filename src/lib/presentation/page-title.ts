// src/lib/presentation/page-title.ts — a page's title as a reader sees it (owner ruling 88.4, 2026-11-22).
import { titleCase } from "title-case";
import { DEFAULT_LOCALE, isLanguage } from "@/lib/locale/locales";

// The library keeps iPhone mid-title but capitalises it as a first word; a word cased this way is the brand's own.
const OWN_CASE = /\p{Ll}\p{Lu}/u;

/** Title Case in English, keeping the casing a word already carries (ChatGPT, iPhone, SEO); German capitalises nouns, not
 *  every word, so it stands as written. `language` is the site's stored one; none reads as the default, English. */
export function pageTitle(text: string, language: unknown): string {
  if ((isLanguage(language) ? language : DEFAULT_LOCALE.language) !== "en") return text;
  const words = text.split(/(\s+)/);
  const cased = titleCase(text).split(/(\s+)/);
  return cased.length === words.length ? cased.map((word, i) => (OWN_CASE.test(words[i]!) ? words[i]! : word)).join("") : cased.join("");
}
