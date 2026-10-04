// SPEC §7 (D42) — the seven templates, by type. Total over the type, so a
// new type is a compile error here.
import type { ContentType } from "@/lib/opportunities/content-type";
import { documentation } from "./documentation";
import { howTo } from "./how-to";
import { insights } from "./insights";
import { listicle } from "./listicle";
import { qa } from "./qa";
import { research } from "./research";
import type { Template } from "./types";
import { update } from "./update";

export type { PackNeed, PackRequirement, Template, TemplateSection } from "./types";

export const TEMPLATES: Readonly<Record<ContentType, Template>> = Object.freeze({
  listicle,
  how_to: howTo,
  documentation,
  research,
  qa,
  insights,
  update,
});

/** How many sections a template's page may carry, over its repeats. */
export function sectionBounds(template: Template): { min: number; max: number } {
  return template.sections.reduce(
    (sum, section) => ({ min: sum.min + (section.repeat?.min ?? 1), max: sum.max + (section.repeat?.max ?? 1) }),
    { min: 0, max: 0 }
  );
}
