// SPEC §6 (D66, D67) — a town stored under another country is never
// attached to the site's locale, so what the founder reads follows the
// country the site is measured in.
import { afterEach, describe, expect, it } from "vitest";
import { readStoredLocale, registerSiteLocaleStore } from "@/lib/locale/site";
import { buyerPrompts } from "@/lib/market/questions/buyer-prompts";

const LONDON = { name: "London", location: "London,England,United Kingdom" };

function rows(row: { country: string; language: string; place: Record<string, unknown> }): void {
  registerSiteLocaleStore({
    async read() {
      return { country: row.country, language: row.language, market: { area: { place: row.place, by: "founder", located: true } } };
    },
    async write() {},
  });
}

afterEach(() => registerSiteLocaleStore(null));

describe("readStoredLocale attaches a town only in its own country", () => {
  it("drops a London looked up in the United Kingdom from a DE/de site", async () => {
    rows({ country: "DE", language: "de", place: LONDON });
    expect(await readStoredLocale("site-1")).toEqual({ country: "DE", language: "de" });
  });

  it("keeps it on a GB/en site", async () => {
    rows({ country: "GB", language: "en", place: LONDON });
    expect(await readStoredLocale("site-1")).toEqual({ country: "GB", language: "en", place: LONDON });
  });

  it("keeps a town that was never found on the vendor's list", async () => {
    rows({ country: "DE", language: "de", place: { name: "Kleinstadt" } });
    expect(await readStoredLocale("site-1")).toEqual({ country: "DE", language: "de", place: { name: "Kleinstadt" } });
  });

  it("the prompts built for the new pair name no town from the old country", async () => {
    rows({ country: "DE", language: "de", place: LONDON });
    const locale = await readStoredLocale("site-1");
    // A local trade from the customer panel.
    const trade = { category: "Notdienst Klempner", synonyms: ["Rohrreinigung"], buyer: "Hausbesitzer", job: "", rivals: [], kind: "local-service" as const };
    const prompts = buyerPrompts(trade, 5, "de", locale?.place);
    expect(prompts.length).toBeGreaterThan(0);
    expect(prompts.join(" ")).not.toMatch(/London/);
  });
});
