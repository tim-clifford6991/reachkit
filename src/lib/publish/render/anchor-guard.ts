// SPEC §7 — the links a live hosted page draws as their words alone, at
// render, so no live row is edited (ADR-080).
import { onSite } from "@/lib/generate/links/select";
import { linkTextProblem } from "@/lib/generate/links/text";
import { slugOf } from "@/lib/publish/destinations/hosted/moved";

/** Whether a link is unwrapped: an address of the page's own host that
 *  answers 410, or a figure alone ("$29") linked into the business's site,
 *  which the link step refuses for pages written before it did. A figure
 *  linked to its source elsewhere stands. */
export function unlinkedHere(
  href: string,
  text: string,
  at: { canonical: string; domain: string; retired?: ReadonlySet<string> | undefined }
): boolean {
  try {
    const target = new URL(href, at.canonical);
    if (linkTextProblem(text) === "number" && onSite(target.href, at.domain)) return true;
    if (at.retired === undefined || at.retired.size === 0 || target.host !== new URL(at.canonical).host) return false;
    const slug = slugOf(target.href);
    return slug !== null && at.retired.has(slug);
  } catch {
    return false;
  }
}
