// Each technical check has one registry title per surface: the account's
// problem name, and the report's plain name only where its board differs.
import "../generate/env";
import { describe, expect, it } from "vitest";
import { COPY } from "@/lib/presentation/copy";
import { SITE_CHECK_TITLE } from "@/lib/presentation/site-issues";
import { CHECK_ORDER, checkCardsOf } from "@/app/(public)/scan/[domain]/_problems/checks";

const cards = checkCardsOf({});

describe("one title per check per surface, from the registry", () => {
  it("every check has an account title and a report title that are registry keys", () => {
    for (const check of CHECK_ORDER) expect(COPY).toHaveProperty(SITE_CHECK_TITLE[check]);
    for (const card of cards) expect(COPY).toHaveProperty(card.title);
  });

  it("a report title that differs from the account's is a `.plain` key", () => {
    const overrides = cards.filter((card) => card.title !== SITE_CHECK_TITLE[card.check]);
    for (const card of overrides) expect(card.title).toMatch(/^check\.[a-z-]+\.plain$/);
    expect(overrides.map((card) => card.check)).toContain("structured_data");
  });

  it("the structured-data check counts labels of any kind, so no check name claims business details", () => {
    for (const [key, value] of Object.entries(COPY)) {
      if (key.startsWith("check.")) expect(value.toLowerCase()).not.toContain("business details");
    }
  });
});
