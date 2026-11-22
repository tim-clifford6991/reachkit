// src/lib/presentation/page-title.ts — a page's title as a reader sees it (owner ruling 88.4, 2026-11-22).
import { titleCase } from "title-case";
import { DEFAULT_LOCALE, isLanguage } from "@/lib/locale/locales";

/** Title Case in English, keeping the casing a word already carries (ChatGPT, iPhone, SEO); German capitalises nouns, not
 *  every word, so it stands as written. `language` is the site's stored one; none reads as the default, English. */
export function pageTitle(text: string, language: unknown): string {
  return (isLanguage(language) ? language : DEFAULT_LOCALE.language) === "en" ? titleCase(text) : text;
}
