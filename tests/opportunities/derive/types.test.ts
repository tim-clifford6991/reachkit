// BUILD §7 and SPEC §0 — the closed surface: nine kinds, four families,
// three forms.
import "../env";
import { describe, expect, it } from "vitest";
import { EFFORT_BY_TYPE } from "../../../src/lib/config/constants";
import { measured } from "../../../src/lib/measure/measured";
import {
  BARRIERS,
  FAMILY_OF,
  OPPORTUNITY_TYPES,
  type Acceptance,
  type Evidence,
  type Family,
  type OpportunityType,
} from "../../../src/lib/opportunities/types";

describe('§7\'s table plus SPEC §0\'s Earn — "Types, closed enum"', () => {
  it("the enum is exactly the nine, in §7's own order and Earn last", () => {
    expect(OPPORTUNITY_TYPES).toEqual([
      "answer_page",
      "keyword_page",
      "comparison_page",
      "format_page",
      "expand_page",
      "answerable_page",
      "refresh_page",
      "unblock",
      "listed_page",
    ]);
  });

  it("the type-to-family map is total over the nine and yields exactly four families", () => {
    for (const type of OPPORTUNITY_TYPES) {
      expect(FAMILY_OF[type]).toBeDefined();
    }
    expect(new Set(Object.values(FAMILY_OF))).toEqual(
      new Set<Family>(["write", "improve", "fix", "earn"])
    );
  });

  it("§7's table, family by family", () => {
    const byFamily = (family: Family) => OPPORTUNITY_TYPES.filter((t) => FAMILY_OF[t] === family);
    expect(byFamily("write")).toEqual([
      "answer_page",
      "keyword_page",
      "comparison_page",
      "format_page",
    ]);
    expect(byFamily("improve")).toEqual(["expand_page", "answerable_page", "refresh_page"]);
    expect(byFamily("fix")).toEqual(["unblock"]);
    // SPEC §0: Earn is a family of its own, and `listed_page` is its one kind.
    expect(byFamily("earn")).toEqual(["listed_page"]);
  });

  it("a tenth type does not type-check", () => {
    // @ts-expect-error — the enum is closed; a tenth kind is a compile error.
    const ninth: OpportunityType = "video_page";
    expect(ninth).toBe("video_page");
  });

  it("the map is frozen — a caller cannot re-home a type at runtime", () => {
    expect(Object.isFrozen(FAMILY_OF)).toBe(true);
  });
});

describe("every ranked type has an effort weight, and `unblock` has none", () => {
  it("EFFORT_BY_TYPE covers the seven and not the eighth", () => {
    const withEffort = new Set(Object.keys(EFFORT_BY_TYPE));
    for (const type of OPPORTUNITY_TYPES) {
      expect(withEffort.has(type)).toBe(type !== "unblock");
    }
  });
});

describe("§7: the acceptance test is one of three forms", () => {
  it('"top 20 for Q" / "named on question P" / "gate passes"', () => {
    const forms: Acceptance[] = [
      { form: "top20", query: "q" },
      { form: "named_on", question: "p" },
      { form: "gate_cleared", gate: "noindex" },
    ];
    expect(forms.map((form) => form.form)).toEqual(["top20", "named_on", "gate_cleared"]);
  });

  it("a fourth form does not type-check", () => {
    // @ts-expect-error — three forms, not four.
    const fourth: Acceptance = { form: "traffic", visits: 10 };
    expect(fourth).toBeDefined();
  });

  it("a gate that is not one of the five barriers does not type-check", () => {
    // @ts-expect-error — `Barrier` is closed.
    const gate: Acceptance = { form: "gate_cleared", gate: "paywall" };
    expect(gate).toBeDefined();
  });
});

describe("§7: evidence is one shape per family", () => {
  it("three arms, discriminated by family", () => {
    const arms: Evidence["family"][] = ["write", "improve", "fix", "earn"];
    expect(new Set(arms)).toEqual(new Set(Object.values(FAMILY_OF)));
  });

  it("a Write evidence blob without its rival does not type-check", () => {
    // @ts-expect-error — the rival page or position that shows the gap is
    // required: §7 lists it among what every opportunity carries.
    const evidence: Evidence = { family: "write", query: "q", volume: null };
    expect(evidence).toBeDefined();
  });

  it("the Earn arm carries the source that named a rival, and not a party to write to", () => {
    const evidence: Evidence = {
      family: "earn",
      query: "best onboarding software",
      volume: measured(1900, new Date("2026-09-07T00:00:00.000Z")),
      source: { surface: "ai_answer", ref: "chatgpt" },
      rival: { domain: "appcues.com" },
    };
    expect(evidence.family).toBe("earn");
    // @ts-expect-error — there is no contact, address or outreach field: the
    // answer is an asset on the customer's own domain (SPEC §0).
    expect(evidence.contact).toBeUndefined();
  });

  it("the five barriers are closed and the Fix arm names one of them", () => {
    expect(BARRIERS).toEqual([
      "robots_disallow",
      "noindex",
      "login_wall",
      "js_only",
      "blocked_ai_agent",
    ]);
    // @ts-expect-error — a sixth barrier is a change to what the product
    // measures, not a string a caller may pass.
    const sixth: Evidence = { family: "fix", barrier: "captcha", foundOnUrl: "https://x/" };
    expect(sixth).toBeDefined();
  });
});
