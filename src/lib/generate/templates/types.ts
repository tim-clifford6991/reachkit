// SPEC §7 (2026-10-04, D42) — what a content type's template is.
//
// A template is data: what the page is for, how its title reads, its
// sections in order, the blocks it must carry, its length, and what the
// context pack must hold before a word is written. One file a type, read by
// the writer (`../pipeline/write.ts`), the layout (`../pipeline/layout.ts`),
// the blocks check (`../rules/blocks.ts`) and the pack (`../pipeline/pack.ts`)
// — so the page a writer is asked for and the page the checks hold it to are
// one description. Nothing here is a customer-facing sentence.
import type { ContentType } from "@/lib/opportunities/content-type";

export interface TemplateSection {
  /** The section's handle, recorded with the page (`drafts.meta.sections`). */
  key: string;
  /** What the writer is told the section is for. */
  task: string;
  /** A section the page carries several of, one after another. Absent is
   *  exactly one. */
  repeat?: { min: number; max: number };
  /** The block the section must hold beside its opening paragraph. */
  block?: "table" | "steps";
  /** Issue 1508: a section the page carries once where it lists the
   *  alternatives to one product, and never otherwise. */
  when?: "alternatives";
  /** A section the page carries only where the pack holds at least `min`
   *  of these facts, and never otherwise (E10). */
  onlyWith?: { facts: SectionFacts; min: number };
}

/** What a section that is carried only on its facts is written from: the
 *  knowledge base's inclusions, the places the business's own pages state,
 *  and its differentiators or promises. */
export type SectionFacts = "inclusions" | "places" | "difference";

/** One thing the context pack must hold. Each is checked in code
 *  (`../pipeline/pack.ts`), and its `need` names what is missing. */
export type PackRequirement =
  /** Options to compare, the customer among them: `min - 1` rivals whose
   *  own pricing or feature page yielded a claim the table can hold
   *  (`../pipeline/table.ts`, D47). */
  | { need: "options"; min: number }
  /** The customer's own price, from the knowledge base or its pages. */
  | { need: "own_price" }
  /** One point of difference from the knowledge base or a founder's answer. */
  | { need: "difference" }
  /** `min` business facts or more, one at least in the target's words. */
  | { need: "facts_on_topic"; min: number }
  /** Claims read off `min` distinct public pages or more (issue 1486): what
   *  a page built from cited outside facts is built from. The page's body
   *  then links that many (`cites_market`). */
  | { need: "outside_sources"; min: number }
  /** A product page of the customer's to link. */
  | { need: "product_page" }
  /** The site's latest complete pass with `min` measured questions. */
  | { need: "measured_questions"; min: number }
  /** A figure that changed since the site's last research page. */
  | { need: "changed_figures" }
  /** Questions the pass measured or buyers were recorded asking. */
  | { need: "buyer_questions"; min: number }
  /** Web results published inside `days`, each with its date and a claim. */
  | { need: "recent_results"; min: number; days: number }
  /** The live page's text and recorded facts. */
  | { need: "live_page" }
  /** A fact the live page does not already state. */
  | { need: "new_fact"; min: number }
  /** No template's: on a "vs" between rivals that leaves out the business,
   *  a claim about each rival off its own site, a study or a primary source. */
  | { need: "rival_evidence" };

export type PackNeed = PackRequirement["need"];

export interface Template {
  type: ContentType;
  /** What a page of this type must do, in one sentence. */
  for: string;
  /** How its `<title>` reads: D51's formulas, one of which it follows. */
  titles: readonly string[];
  /** What its title never does. */
  titleNever?: string;
  sections: readonly TemplateSection[];
  blocks: {
    /** A comparison table: the customer's row and this many rivals. */
    table?: { rivals: number };
    /** A numbered list of this many steps, at most `own` of them the
     *  business's own (issue 1486). Absent `own`, any may be. */
    steps?: { min: number; max: number; own?: number };
    /** Buyer questions stored beside the page. `null`: the page's own
     *  questions are its FAQ data and it stores no others. `asked`: none
     *  at all unless the pack holds `min` answerable questions buyers asked
     *  (E10). */
    faq: { min: number; max: number; asked?: true } | null;
    /** Every repeated section carries a date and a link to its source. */
    datedSources?: boolean;
  };
  /** Words of body text. An update keeps within a share of its live page;
   *  one that may add sections grows up to `grownShare` (issue 1521). */
  length: { floor: number; ceiling: number } | { withinShareOfLive: number; grownShare?: number };
  /** Whether stage 2 reads public pages for this type. */
  research: boolean;
  packMustHold: readonly PackRequirement[];
}

/**
 * What one language other than English supplies for the templates (SPEC §6,
 * owner D66): each type's title formulas and what its title never does, in
 * that language's own words, and the rules a page in that language follows
 * beside the house rules. English is the templates as they are written.
 */
export interface TemplateWords {
  titles: Readonly<Record<ContentType, { titles: readonly string[]; titleNever?: string }>>;
  rules: readonly string[];
}
