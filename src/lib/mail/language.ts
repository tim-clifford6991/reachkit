// src/lib/mail/language.ts — the language one mail is composed in (SPEC §6,
// owner D66 of 2026-10-07, issue 1311).
//
// A mail's sentences are keys until `composeMailParts` resolves them, in one
// synchronous pass. That pass runs inside `inMailLanguage`, and every
// `copy()` the mail seam makes is this module's, so a German customer's mail
// is resolved in German with no language handed block to block.
//
// The scope is synchronous on purpose: nothing awaits inside it, so two
// mails composed at once can never read each other's language. Outside a
// scope the language is English, which is `copy()` itself.
import type { Language } from "@/lib/locale/locales";
import { copy as english, type CopyKey } from "@/lib/presentation/copy";
import { copyIn } from "@/lib/presentation/copy/translated";

let composing: Language = "en";

/** Runs `body` — synchronous, start to finish — with the mail's language set. */
export function inMailLanguage<T>(language: Language | undefined, body: () => T): T {
  const before = composing;
  composing = language ?? "en";
  try {
    return body();
  } finally {
    composing = before;
  }
}

/** `copy()`, in the language of the mail being composed. */
export function copy(key: CopyKey, vars?: Record<string, string | number>): string {
  return composing === "en" ? english(key, vars) : copyIn(composing, key, vars);
}
