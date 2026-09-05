// tests/presentation/offer.test.ts — issue #19
//
// `src/lib/presentation/offer.ts`'s own suite. REQ-021 criterion 2 (what the
// offer states) and criterion 4 ("on the same terms the offer at the end of a
// report states"), quoted verbatim in the describes below, plus the pin
// agreement the module's own header promises: the two phrases derived from
// pins are asserted against those pins here, so a changed cadence fails a
// test rather than silently mis-stating the offer.
import { describe, expect, it } from "vitest";
import { offerTerms, PRICE_COPY_KEYS } from "@/lib/presentation/offer";
import { COPY, COPY_META, copy } from "@/lib/presentation/copy";
import { RATE_LIMITS, VETO } from "@/lib/config/constants";

describe('REQ-021 c2 — "then it states the monthly price on the terms REQ-022 criterion 1 fixes, how often a page is written, how often measurement is repeated, how often the customer is told what moved, that a page can be stopped before it publishes, and that the subscription can be cancelled by the customer themselves." — offer/terms · six statements, each from a key', () => {
  it("names the three price keys, the four cadence rows, the cancel key and the start key — and nothing else", () => {
    const terms = offerTerms();
    expect(PRICE_COPY_KEYS).toEqual(["price.amount", "price.vat_included", "price.interval"]);
    expect(terms.priceKeys).toBe(PRICE_COPY_KEYS);
    expect(terms.rows.map((r) => r.key)).toEqual([
      "offer.cadence.page",
      "offer.cadence.measure",
      "offer.cadence.movement",
      "offer.veto.window",
    ]);
    expect(terms.cancelKey).toBe("offer.cancel_self_service");
    expect(terms.startKey).toBe("offer.start");
    expect(Object.keys(terms).sort()).toEqual(["cancelKey", "priceKeys", "rows", "startKey"]);
  });

  it("every key it names exists in the copy registry", () => {
    const terms = offerTerms();
    for (const key of [...terms.priceKeys, ...terms.rows.map((r) => r.key), terms.cancelKey, terms.startKey]) {
      expect(Object.prototype.hasOwnProperty.call(COPY, key), `${key} is not a registered copy key`).toBe(true);
    }
  });

  it("each row's sentence declares exactly one 'value' slot, and the row fills it with no marker left", () => {
    for (const row of offerTerms().rows) {
      expect(COPY_META[row.key].slots).toEqual({ value: "text" });
      const rendered = copy(row.key, { value: row.value });
      expect(rendered).not.toContain("{");
      expect(rendered).toContain(row.value);
    }
  });
});

describe("the two phrases derived from pins agree with the pins (this module mints no number)", () => {
  it('the page-cadence phrase is the reading of RATE_LIMITS.publishesPerDay at its pinned value', () => {
    // BUILD §4.1 module 6's "1/day". If this pin ever moves, the phrase
    // below must be re-ruled before the offer can state it — which is what
    // this assertion exists to force.
    expect(RATE_LIMITS.publishesPerDay).toBe(1);
    expect(offerTerms().rows[0].value).toBe("every day");
  });

  it("the veto phrase carries VETO.defaultHours, read from the pin", () => {
    expect(VETO.defaultHours).toBe(24);
    expect(offerTerms().rows[3].value).toContain(String(VETO.defaultHours));
  });

  it("the two weekly rows say the same word, written once", () => {
    const rows = offerTerms().rows;
    expect(rows[1].value).toBe("weekly");
    expect(rows[2].value).toBe(rows[1].value);
  });
});

describe('REQ-021 c4 — "states … what the subscription does on the same terms the offer at the end of a report states (criterion 2)" — offer/terms · one derivation, both surfaces', () => {
  it("offerTerms() is a pure function of the pins: two calls agree, member for member", () => {
    expect(offerTerms()).toEqual(offerTerms());
  });
});
