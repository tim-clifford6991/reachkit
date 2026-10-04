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
}

/** One thing the context pack must hold. Each is checked in code
 *  (`../pipeline/pack.ts`), and its `need` names what is missing. */
export type PackRequirement =
  /** Options to compare, the customer among them: `min - 1` rivals whose
   *  own pricing or feature page yielded a claim. */
  | { need: "options"; min: number }
  /** The customer's own price, from the knowledge base or its pages. */
  | { need: "own_price" }
  /** One point of difference from the knowledge base or a founder's answer. */
  | { need: "difference" }
  /** `min` business facts or more, one at least in the target's words. */
  | { need: "facts_on_topic"; min: number }
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
  | { need: "new_fact"; min: number };

export type PackNeed = PackRequirement["need"];

export interface Template {
  type: ContentType;
  /** What a page of this type must do, in one sentence. */
  for: string;
  /** How its title reads. */
  titles: readonly string[];
  /** What its title never does. */
  titleNever?: string;
  sections: readonly TemplateSection[];
  blocks: {
    /** A comparison table: the customer's row and this many rivals. */
    table?: { rivals: number };
    /** A numbered list of this many steps. */
    steps?: { min: number; max: number };
    /** Buyer questions stored beside the page. `null`: the page's own
     *  questions are its FAQ data and it stores no others. */
    faq: { min: number; max: number } | null;
    /** Every repeated section carries a date and a link to its source. */
    datedSources?: boolean;
  };
  /** Words of body text. An update keeps within a share of its live page. */
  length: { floor: number; ceiling: number } | { withinShareOfLive: number };
  /** Whether stage 2 reads public pages for this type. */
  research: boolean;
  packMustHold: readonly PackRequirement[];
}
