// Issue 1420 — an AI answer that names the brand is a mention, read from its
// text and its cited addresses as well as its reference hosts. The answers
// below are the customer panel's stored AI Mode answers (`fetches` rows in
// `scripts/panel/evidence/`), the same `ai_overview` shape the organic SERP
// carries.
import "../../generate/env";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { SerpResult } from "@/lib/vendors/dataforseo/types";
import { aiPresenceOf, classifyReferences, isOrdinaryName } from "../../../src/lib/measure/drivers.ts";
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
    expect(classifyReferences([], "tattly-hr.com", { text: "Try Tattly Payroll or Gusto.", siteName: "Tattly Payroll" }).mentioned).toBe(true);
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

  it("an overview that names the brand and links only to review sites is a mention, and counts in full", () => {
    const [serp] = parseSerp({ items: [item("Rippling and ADP lead the category.")] })!;
    const serps = Array.from({ length: 4 }, () => measured<SerpResult>(serp!, AT));
    const m = aiPresenceOf({ serps, ownDomain: "rippling.com", at: AT });
    expect(m.kind === "unmeasured" ? null : m.value).toBe(100);
  });
});

describe("issue 1420 review — a brand that is an ordinary word is named only as a name", () => {
  // Every stored AI Mode and ChatGPT answer in production whose text holds
  // one of these words (a read-only export of `fetches`, 2026-10-14). None
  // of these brands' own sites has a stored answer, so these are answers
  // about other markets; read by hand, only the Notion one names the brand.
  type Row = { brand: string; id: string; text: string; citedUrls: string[] };
  const rows = JSON.parse(readFileSync(new URL("./fixtures/common-word-brands.json", import.meta.url), "utf8")) as Row[];
  const domain: Record<string, string> = { make: "make.com", close: "close.com", notion: "notion.so", sage: "sage.com", loom: "loom.com", box: "box.com", front: "front.com", wave: "wave.com" };
  const named = new Set(["notion:b21fe5fc"]);

  it.each(rows.map((row) => [`${row.brand} ${row.id.slice(0, 8)}`, row] as const))("%s", (_, row) => {
    const { mentioned } = classifyReferences([], domain[row.brand]!, { text: row.text, urls: row.citedUrls, siteName: null });
    expect(mentioned).toBe(named.has(`${row.brand}:${row.id.slice(0, 8)}`));
  });

  it("the words are ordinary and the distinctive names are not", () => {
    expect(["Make", "Front", "Linear", "Sage", "Help Scout", "Monday", "Plausible"].every(isOrdinaryName)).toBe(true);
    expect(["Tattly", "Zapier", "SavvyCal", "Bäckerei Hinkel", "Pipedrive"].some(isOrdinaryName)).toBe(false);
  });

  const make = (text: string, urls: string[] = []) => classifyReferences([], "make.com", { text, urls, siteName: null }).mentioned;

  it("“make” as a verb names nobody; Make as a name does", () => {
    expect(make("You can make a workflow that sends a form to Slack. Make sure it runs daily.")).toBe(false);
    expect(make("- **Make** (formerly Integromat): visual scenarios with branching.")).toBe(true);
    expect(make("Zapier and Make are the usual picks for small teams.")).toBe(true);
    expect(make("Try Make for free, or read the docs at make.com.")).toBe(true);
    expect(make("## Tools to Make Your Site Faster")).toBe(false);
    expect(make("Make and n8n both self-host. Make (formerly Integromat) is cheaper.")).toBe(true);
    expect(make("Close the gaps first. Make sure every page loads.")).toBe(false);
  });

  it("a less common word keeps a sentence's first word, never its lowercase", () => {
    const rippling = (text: string) => classifyReferences([], "rippling.com", { text, siteName: null }).mentioned;
    expect(rippling("Rippling and ADP lead the category.")).toBe(true);
    expect(rippling("The rippling effect of payroll errors is real.")).toBe(false);
  });

  it("a cited address names the brand only where a path segment is its slug", () => {
    expect(make("", ["https://zapier.com/blog/how-to-make-a-form"])).toBe(false);
    expect(make("", ["https://www.g2.com/reviews/make"])).toBe(true);
  });

  it("a weekday's capital is no sign of the name; its domain and its markup are", () => {
    const monday = (text: string) => classifyReferences([], "monday.com", { text, siteName: null }).mentioned;
    expect(monday("Reports go out on Monday mornings.")).toBe(false);
    expect(monday("Asana and Monday.com both offer boards.")).toBe(true);
    expect(monday("1. **Monday** – boards for every team")).toBe(true);
  });
});
