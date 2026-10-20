// SPEC §7 (D42) — the templates, by type. Total over the type, so a
// new type is a compile error here.
import type { ContentType } from "@/lib/opportunities/content-type";
import type { Language } from "@/lib/locale/locales";
import { DE_TEMPLATES } from "./de";
import { documentation } from "./documentation";
import { howTo } from "./how-to";
import { insights } from "./insights";
import { listicle } from "./listicle";
import { offering } from "./offering";
import { qa } from "./qa";
import { research } from "./research";
import type { Template, TemplateWords } from "./types";
import { update } from "./update";

export type { PackNeed, PackRequirement, Template, TemplateSection, TemplateWords } from "./types";

export const TEMPLATES: Readonly<Record<ContentType, Template>> = Object.freeze({
  listicle,
  how_to: howTo,
  documentation,
  research,
  qa,
  insights,
  update,
  offering,
});

/** Each language's own template words. English has none: the templates are
 *  written in it. Adding a language is one file like `./de.ts` and one row
 *  here. */
const TEMPLATE_WORDS: Readonly<Partial<Record<Language, TemplateWords>>> = Object.freeze({ de: DE_TEMPLATES });

/** A type's title formulas in `language`, or `null` where the template's
 *  own (English) stand. */
export function titleFormulas(type: ContentType, language: Language): { titles: readonly string[]; titleNever?: string } | null {
  return TEMPLATE_WORDS[language]?.titles[type] ?? null;
}

/** The rules a page in `language` follows beside the house rules. */
export function languageRules(language: Language): readonly string[] {
  return TEMPLATE_WORDS[language]?.rules ?? [];
}

/** How many sections a template's page may carry, over its repeats. */
export function sectionBounds(template: Template): { min: number; max: number } {
  return template.sections.reduce(
    (sum, section) => ({ min: sum.min + (section.repeat?.min ?? 1), max: sum.max + (section.repeat?.max ?? 1) }),
    { min: 0, max: 0 }
  );
}
