// src/lib/presentation/copy/reader.ts — `copy()` in the language of the
// reader a server-rendered screen is drawn for (SPEC §6, owner D66 of
// 2026-10-07, issue 1311).
//
// A route says once whose screen it is drawing (`readIn`), and every server
// component under it that imports `copy` from here speaks that language,
// with no prop handed down for it. The language is held for one request and
// no longer: `cache` is React's own per-request memo, so two reports drawn
// at once never share it. Outside a server render — a test, a job — nothing
// was said and the language is English, which is `copy()` itself.
//
// Never imported by a client component: it carries the translations.
import { cache } from "react";
import type { Language } from "@/lib/locale/locales";
import { copy as english, type CopyKey } from "@/lib/presentation/copy";
import { copyIn } from "./translated.ts";

const request = cache((): { language: Language; tag: string } => ({ language: "en", tag: "en-US" }));

/** Says which language this request's screen is read in. Called by the
 *  route, before it renders anything. */
export function readIn(language: Language, tag?: string): void {
  request().language = language;
  request().tag = tag ?? (language === "de" ? "de-DE" : "en-US");
}

/** The BCP-47 tag this request's dates and numbers are written with. */
export function readerTag(): string {
  return request().tag;
}

/** The language this request's screen is read in. */
export function readerLanguage(): Language {
  return request().language;
}

/** `copy()`, in the reader's language. */
export function copy(key: CopyKey, vars?: Record<string, string | number>): string {
  const language = readerLanguage();
  // English is the registry's own `copy()`, reached the way every screen
  // reaches it.
  return language === "en" ? english(key, vars) : copyIn(language, key, vars);
}
