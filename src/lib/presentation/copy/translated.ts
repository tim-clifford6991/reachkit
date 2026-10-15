// src/lib/presentation/copy/translated.ts — a sentence in the language of
// the customer's own site (SPEC §6, owner D66 of 2026-10-07, issue 1311;
// narrowed by the owner on 2026-10-15, issue 1443).
//
// ReachKit's own screens and mail are English, whatever a site is measured
// in. What is printed on the customer's own site — a written page, its
// facts, the hosted blog and the WordPress post — is the customer's content
// and is in the site's language. English stays the registry
// (`./registry.ts`): its keys, its slots and its laws are the one
// definition. A language other than English is an overlay of sentences on
// those same keys (`./keys/<language>/`), and a key the overlay does not
// hold is shown in English — a missing translation never takes a page down.
//
// Server-side only by use: the overlays are not in `./index.ts`, so a
// client bundle that imports `copy` does not carry them.
import type { Language } from "@/lib/locale/locales";
import { copy } from "./copy.ts";
import { COPY_META, type CopyKey, type CopyMeta } from "./registry.ts";
import { PAGE_COPY_DE } from "./keys/de/page.ts";

/** One language's sentences, on the registry's own keys. */
export type CopyTranslation = Readonly<Partial<Record<CopyKey, string>>>;

/** Each language's overlay, by partition. Adding a language is one folder
 *  of partitions and one row here. */
export const TRANSLATIONS: Readonly<Partial<Record<Language, Readonly<Record<string, CopyTranslation>>>>> = Object.freeze({
  de: Object.freeze({
    page: PAGE_COPY_DE,
  }),
});

const FLAT: Readonly<Partial<Record<Language, CopyTranslation>>> = Object.freeze(
  Object.fromEntries(
    Object.entries(TRANSLATIONS).map(([language, partitions]) => [language, Object.assign({}, ...Object.values(partitions ?? {})) as CopyTranslation])
  )
);

/** The sentence a language holds for a key, or `undefined` where it holds
 *  none and English is shown. */
export function translationOf(key: CopyKey, language: Language): string | undefined {
  const text = FLAT[language]?.[key];
  return text === undefined || text === "" ? undefined : text;
}

/**
 * `copy()` in a language: the same key, the same slots and the same
 * refusals. English, and any key the language does not hold, is `copy()`
 * itself.
 */
export function copyIn(language: Language, key: CopyKey, vars?: Record<string, string | number>): string {
  const translated = language === "en" ? undefined : translationOf(key, language);
  // `copy()` is run either way: it is what refuses an owner-owed key, a
  // measured slot and a missing slot, and a translation must not let a
  // sentence past that English would have stopped.
  const english = copy(key, vars);
  if (translated === undefined) return english;
  const meta: CopyMeta = COPY_META[key];
  let text = translated;
  for (const slot of Object.keys(meta.slots)) text = text.split(`{${slot}}`).join(String(vars?.[slot]));
  return text;
}
