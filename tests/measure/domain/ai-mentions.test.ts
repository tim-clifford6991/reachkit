// Issue 1420 — an AI answer that names the brand is a mention, read from its
// text and its cited addresses as well as its reference hosts. The answers
// below are the customer panel's stored AI Mode answers (`fetches` rows in
// `scripts/panel/evidence/`), the same `ai_overview` shape the organic SERP
// carries.
import "../../generate/env";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AI_PRESENCE_MIN_READS } from "@/lib/config/constants";
import type { SerpResult } from "@/lib/vendors/dataforseo/types";
import { aiPresenceOf, classifyReferences } from "../../../src/lib/measure/drivers.ts";
import { measured } from "../../../src/lib/measure/measured.ts";
import { parseSerp } from "../../../src/lib/vendors/dataforseo/serp.ts";

const AT = new Date("2026-10-14T00:00:00.000Z");

type Stored = { source: string; cache_key: string; payload: { text: string; citedDomains: string[]; citedUrls?: string[] }[] };
const answerOf = (domain: string, search: string): Stored["payload"][number] => {
  const rows = JSON.parse(readFileSync(new URL(`../../../scripts/panel/evidence/${domain}.json`, import.meta.url), "utf8")) as Stored[];
  const row = rows.find((r) => r.source === "serp/google/ai_mode" && r.cache_key.startsWith(`${search}|`));
  if (row?.payload[0] === undefined) throw new Error(`no stored answer for ${search}`);
  return row.payload[0];
};
const said = (a: Stored["payload"][number]) => ({ urls: a.citedUrls ?? [], text: a.text, siteName: null });

describe("issue 1420 — what an AI answer names", () => {
  const tattly = answerOf("tattly.com", "Where do people actually recommend for the best stick on tattoos?");

  it("an answer that names Tattly in its text, citing only other sites, is a mention and no citation", () => {
    expect(tattly.citedDomains).not.toContain("tattly.com");
    expect(classifyReferences(tattly.citedDomains, "tattly.com")).toEqual({ cited: false, mentioned: false });
    expect(classifyReferences(tattly.citedDomains, "tattly.com", said(tattly))).toEqual({ cited: false, mentioned: true });
  });

  it("a brand word inside a longer word is not a mention: “tatt” is inside “tattoos” and “Tattly” only", () => {
    expect(classifyReferences(tattly.citedDomains, "tatt.com", said(tattly)).mentioned).toBe(false);
  });

  it("an answer that cites the site is a citation", () => {
    const hinkel = answerOf("baeckerei-hinkel.de", "traditionsbäcker in meiner nähe");
    expect(classifyReferences(hinkel.citedDomains, "baeckerei-hinkel.de", said(hinkel)).cited).toBe(true);
  });

  it("the site's own name counts where the profile knows it; a cited review page whose path names the brand counts", () => {
    expect(classifyReferences([], "acme-hr.com", { text: "Try Acme Payroll or Gusto.", siteName: "Acme Payroll" }).mentioned).toBe(true);
    expect(classifyReferences(["g2.com"], "rippling.com", { urls: ["https://www.g2.com/products/rippling/reviews"] })).toEqual({
      cited: false,
      mentioned: true,
    });
  });
});

describe("issue 1420 — the AI Overview's text is kept from the SERP already bought, and AI presence reads it", () => {
  const item = (markdown: string) => ({
    type: "ai_overview",
    asynchronous_ai_overview: false,
    markdown,
    items: [{ type: "ai_overview_element", references: [{ domain: "g2.com", url: "https://www.g2.com/categories/hr" }] }],
  });

  it("keeps the overview's text, cut to its cap", () => {
    const [kept] = parseSerp({ items: [item("Rippling and ADP lead the category.")] })!;
    expect(kept!.aiOverview.text).toBe("Rippling and ADP lead the category.");
    const [long] = parseSerp({ items: [item("x".repeat(10_000))] })!;
    expect(long!.aiOverview.text!.length).toBeLessThan(10_000);
  });

  it("an overview that names the brand and links only to review sites is a mention: 0.4 of the scale", () => {
    const [serp] = parseSerp({ items: [item("Rippling and ADP lead the category.")] })!;
    const serps = Array.from({ length: AI_PRESENCE_MIN_READS }, () => measured<SerpResult>(serp!, AT));
    const m = aiPresenceOf({ serps, ownDomain: "rippling.com", at: AT });
    expect(m.kind === "unmeasured" ? null : m.value).toBeCloseTo(40, 10);
  });
});
