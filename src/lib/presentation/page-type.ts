// SPEC §7 — a page's kind and type in the customer's words, said alike on the owner's review and on This Week.
import type { ContentType } from "@/lib/opportunities/content-type";
import { copy, type CopyKey } from "@/lib/presentation/copy";

const NEW_TYPE: Readonly<Record<Exclude<ContentType, "update">, CopyKey>> = {
  listicle: "review.page.listicle",
  how_to: "review.page.how_to",
  documentation: "review.page.documentation",
  research: "review.page.research",
  qa: "review.page.qa",
  insights: "review.page.insights",
  offering: "review.page.offering",
};

/** "Update", or "New · {type}"; `null` for a page with no type (an unblock). */
export function pageTypeWord(type: ContentType | null): string | null {
  if (type === "update") return copy("review.page.update");
  return type === null ? null : copy("review.page.new", { type: copy(NEW_TYPE[type]) });
}
