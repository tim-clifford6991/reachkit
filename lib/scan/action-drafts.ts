/**
 * Deterministic action drafts (launch-readiness A3).
 *
 * The "add structured data (JSON-LD)" fix is the single most common quick-win and
 * is fully templatable — no LLM needed. Live trustmrr.com shipped this card with
 * an EMPTY draft, undercutting the paid "done-for-you draft" promise. `buildJsonLdDraft`
 * produces a valid, ready-to-paste JSON-LD block from the listing facts, and
 * `fillDeterministicDrafts` attaches it to any card addressing `schema_jsonld`
 * that lacks a draft. PURE + network-free; unit-tested in action-drafts.test.ts.
 */

import type { ActionCard } from "@/lib/llm/types";
import type { ListingFacts } from "./types";
import type { Platform } from "./router";

function canonicalUrl(storeUrl: string): string {
  try {
    const u = new URL(storeUrl.startsWith("http") ? storeUrl : `https://${storeUrl}`);
    return `${u.protocol}//${u.hostname.replace(/^www\./, "")}/`;
  } catch {
    return storeUrl;
  }
}

/**
 * A valid JSON-LD `<script>` block for the subject, ready to paste into `<head>`.
 * Web → SoftwareApplication; app stores → MobileApplication. Only includes fields
 * we actually know (no invented ratings/prices), so the emitted JSON always
 * validates. Returns a `<script type="application/ld+json">…</script>` string.
 */
export function buildJsonLdDraft(listing: ListingFacts, storeUrl: string, mode: Platform): string {
  const type = mode === "web" ? "SoftwareApplication" : "MobileApplication";
  const obj: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": type,
    name: listing.name || canonicalUrl(storeUrl).replace(/^https?:\/\//, "").replace(/\/$/, ""),
    url: canonicalUrl(storeUrl),
    applicationCategory: listing.category || "BusinessApplication",
    operatingSystem: mode === "web" ? "Web" : mode === "ios" ? "iOS" : "Android",
  };
  const desc = listing.description?.trim();
  if (desc) obj.description = desc.slice(0, 300);

  return `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2)}\n</script>`;
}

/**
 * Attach the deterministic JSON-LD draft to any card that addresses the
 * `schema_jsonld` signal and has no draft yet. Never overwrites an existing
 * draft; never mutates the input.
 */
export function fillDeterministicDrafts(
  cards: ActionCard[],
  listing: ListingFacts,
  storeUrl: string,
  mode: Platform,
): ActionCard[] {
  return cards.map((c) => {
    const targetsSchema = (c.signalKeys ?? []).includes("schema_jsonld");
    if (targetsSchema && !c.draft?.trim()) {
      return { ...c, draft: buildJsonLdDraft(listing, storeUrl, mode), draftRequiresEdit: true };
    }
    return c;
  });
}
