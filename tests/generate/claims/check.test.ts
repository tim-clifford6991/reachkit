// tests/generate/claims/check.test.ts — BUILD §8 hard rule 4: the
// never-claim list as a hard output filter. Since D45 (SPEC §7, 2026-10-04)
// it is a literal match of the list's own words, and no model is asked.
//
//   1. the words named back to the customer are their own, out of their own
//      list;
//   2. a paraphrase is not caught — the owner accepted that (D45);
//   3. every verdict carries the hash of the list it was reached against.
import "../env";
import { describe, expect, it } from "vitest";
import { claimCheck } from "../../../src/lib/generate/claims/check";
import { listHash } from "../../../src/lib/generate/claims/hash";

const LIST = ["We are the fastest tool on the market", "HIPAA compliant"];

describe("the never-claim list is matched by its own words", () => {
  it("a page that says an entry fails, named by the customer's own recorded string, whatever its case and spacing", () => {
    const verdict = claimCheck({ text: "Our product is hipaa   compliant and always has been.", list: LIST });
    expect(verdict).toMatchObject({ state: "failed", matchedEntry: "HIPAA compliant", listHash: listHash(LIST) });
  });

  it("a paraphrase passes, carrying the hash of the list it was read against", () => {
    const verdict = claimCheck({ text: "Nothing else on the market comes close to our speed.", list: LIST });
    expect(verdict).toMatchObject({ state: "passed", listHash: listHash(LIST) });
  });

  it("an empty list passes, with the hash of the empty list", () => {
    expect(claimCheck({ text: "Our product is HIPAA compliant.", list: [] })).toMatchObject({
      state: "passed",
      listHash: listHash([]),
    });
  });
});
