// tests/market/questions/profile.test.ts — WO-071 `## Test plan`, criteria
// quoted verbatim from REQ-006, plus `## Steps` step 6's own "watch each
// fail before the implementation exists" and the "Additional tests"
// section WO-071 names for the interface contract BP-025 fixes.
//
// Risk: high — seams: money, and data leaving the system. Mutation-tested
// (doctrine 0.13.2, rule 2b): `deriveProfile/single-call-site` and
// `deriveProfile/unmeasured-profile-yields-no-value` are each written so
// that deleting the `site: 'profile'` argument, or replacing the
// `unmeasured` pass-through with a default `Profile`, fails a named test
// below (WO-071's own "Discrimination" note). No network: `@/lib/llm` is
// stubbed entirely — this suite never reaches the vendor.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z, type ZodType } from "zod";
import { PROFILE_INPUT_MAX_CHARS, PROFILE_LIST_BOUNDS } from "../../../src/lib/config/constants.ts";
import type { CostContext } from "../../../src/lib/costs/index.ts";
import type { Measured } from "../../../src/lib/measure/measured.ts";
import type { Profile } from "../../../src/lib/market/questions/profile.ts";

interface RecordedLlmCall {
  site: string;
  input: unknown;
  schema: ZodType<unknown>;
  tier: string;
}

const { llmMock } = vi.hoisted(() => ({ llmMock: vi.fn() }));

vi.mock("@/lib/llm", () => ({ llm: llmMock }));

type ProfileModule = typeof import("../../../src/lib/market/questions/profile.ts");
let deriveProfile: ProfileModule["deriveProfile"];
let PROFILE_SCHEMA: ProfileModule["PROFILE_SCHEMA"];
let PROFILE_FIELDS: ProfileModule["PROFILE_FIELDS"];
let PROFILE_TASK: ProfileModule["PROFILE_TASK"];
let boundPageText: ProfileModule["boundPageText"];

beforeEach(async () => {
  llmMock.mockReset();
  ({ deriveProfile, PROFILE_SCHEMA, PROFILE_FIELDS, PROFILE_TASK, boundPageText } = await import(
    "../../../src/lib/market/questions/profile.ts"
  ));
});

/** `recordFetch` throws: `deriveProfile` must reach the vendor only through
 *  `llm()` (the spend seam, mutation probe 1) — a call that bypassed
 *  `llm()` and called `CostContext.recordFetch` directly would be caught
 *  here, not merely unexercised. */
function fakeCostContext(): CostContext {
  return {
    cap: "FREE",
    async recordFetch() {
      throw new Error("deriveProfile must call llm(), not CostContext.recordFetch directly");
    },
    capHit: () => false,
    spentCents: () => 0,
    degraded: () => false,
  };
}

const AT = new Date("2026-09-04T00:00:00.000Z");

function measuredProfile(overrides: Partial<Profile> = {}): Measured<Profile> {
  return {
    kind: "measured",
    at: AT,
    value: {
      category: "project management software",
      job: "coordinate a team's work",
      offeringType: "saas",
      audienceTerms: ["small teams", "agencies"],
      namedRivals: ["rival.com"],
      vocabulary: ["kanban", "sprint"],
      brandTokens: ["acme"],
      ...overrides,
    },
  };
}

describe("deriveProfile — the single 'profile' nano call site", () => {
  it("deriveProfile/single-call-site — exactly one llm() call is made, its site is 'profile' and its tier is 'nano'; no keyword or search term is passed in the input", async () => {
    llmMock.mockResolvedValueOnce(measuredProfile());
    const c = fakeCostContext();

    await deriveProfile(c, { home: "<html>home</html>", pricing: "<html>pricing</html>" });

    expect(llmMock).toHaveBeenCalledTimes(1);
    const call = llmMock.mock.calls[0]![1] as RecordedLlmCall;
    expect(call.site).toBe("profile");
    expect(call.tier).toBe("nano");
    expect(call.input).toEqual({
      task: PROFILE_TASK,
      fields: PROFILE_FIELDS,
      home: "<html>home</html>",
      pricing: "<html>pricing</html>",
    });
    const inputJson = JSON.stringify(call.input);
    expect(inputJson).not.toContain("keyword");
    expect(inputJson).not.toContain("searchTerm");
  });

  it("passes the CostContext straight through, unaltered", async () => {
    llmMock.mockResolvedValueOnce(measuredProfile());
    const c = fakeCostContext();

    await deriveProfile(c, { home: "home text" });

    expect(llmMock.mock.calls[0]![0]).toBe(c);
  });

  it("carries exactly { home, pricing } as handed in beside the fixed instruction — no field added, no field dropped", async () => {
    llmMock.mockResolvedValueOnce(measuredProfile());
    const c = fakeCostContext();

    await deriveProfile(c, { home: "home text only" });

    const call = llmMock.mock.calls[0]![1] as RecordedLlmCall;
    expect(call.input).toEqual({
      task: PROFILE_TASK,
      fields: PROFILE_FIELDS,
      home: "home text only",
      pricing: undefined,
    });
  });
});

describe("deriveProfile — the unmeasured pass-through (the free path's cost floor)", () => {
  it("deriveProfile/unmeasured-profile-yields-no-value — an llm() stub returning { kind: 'unmeasured', reason: 'undeterminable' } is returned unaltered, with no 'value' field and no substituted category", async () => {
    const unmeasuredResult: Measured<Profile> = { kind: "unmeasured", reason: "undeterminable", at: AT };
    llmMock.mockResolvedValueOnce(unmeasuredResult);
    const c = fakeCostContext();

    const result = await deriveProfile(c, { home: "unreadable" });

    expect(result).toEqual(unmeasuredResult);
    expect("value" in result).toBe(false);
    expect(JSON.stringify(result)).not.toContain("category");
  });

  it("returns a 'zero' result unaltered too — not synthesised, not upgraded to measured", async () => {
    const zeroResult: Measured<Profile> = {
      kind: "zero",
      at: AT,
      value: {
        category: "",
        job: "",
        offeringType: "",
        audienceTerms: [],
        namedRivals: [],
        vocabulary: [],
        brandTokens: [],
      },
    };
    llmMock.mockResolvedValueOnce(zeroResult);

    const result = await deriveProfile(fakeCostContext(), { home: "" });

    expect(result).toEqual(zeroResult);
  });

  it("calls llm() exactly once regardless of outcome — deriveProfile itself never retries", async () => {
    llmMock.mockResolvedValueOnce({ kind: "unmeasured", reason: "not_attempted", at: AT });

    await deriveProfile(fakeCostContext(), { home: "x" });

    expect(llmMock).toHaveBeenCalledTimes(1);
  });
});

describe("deriveProfile — the Zod schema declared for the model's output", () => {
  it("deriveProfile/schema-rejects-extra-fields — a model response carrying a keyword or a selected search does not parse", async () => {
    llmMock.mockResolvedValueOnce(measuredProfile());
    await deriveProfile(fakeCostContext(), { home: "x" });
    const schema = (llmMock.mock.calls[0]![1] as RecordedLlmCall).schema;

    const base = {
      category: "c",
      job: "j",
      offeringType: "o",
      audienceTerms: ["a", "b"],
      namedRivals: [],
      vocabulary: [],
      brandTokens: [],
    };

    expect(schema.safeParse({ ...base, keyword: "best project management software" }).success).toBe(
      false
    );
    expect(
      schema.safeParse({ ...base, selectedSearch: { keyword: "x", volume: 100 } }).success
    ).toBe(false);
    expect(schema.safeParse(base).success).toBe(true);
  });

  it("deriveProfile/audience-terms-bounded — fewer than 2 audienceTerms does not parse; more than 4 is trimmed (issue 898)", async () => {
    llmMock.mockResolvedValueOnce(measuredProfile());
    await deriveProfile(fakeCostContext(), { home: "x" });
    const schema = (llmMock.mock.calls[0]![1] as RecordedLlmCall).schema;

    const base = { category: "c", job: "j", offeringType: "o", namedRivals: [], vocabulary: [], brandTokens: [] };

    // Short of the floor is still a failed answer: `min` is a claim that
    // the model did not describe the business, and nothing can be trimmed
    // into existence.
    expect(schema.safeParse({ ...base, audienceTerms: [] }).success).toBe(false);
    expect(schema.safeParse({ ...base, audienceTerms: ["one"] }).success).toBe(false);
    expect(schema.safeParse({ ...base, audienceTerms: ["a", "b"] }).success).toBe(true);
    expect(schema.safeParse({ ...base, audienceTerms: ["a", "b", "c", "d"] }).success).toBe(true);
    // One past the cap is kept, cut to the cap, in the model's own order.
    expect(schema.safeParse({ ...base, audienceTerms: ["a", "b", "c", "d", "e"] })).toMatchObject({
      success: true,
      data: { audienceTerms: ["a", "b", "c", "d"] },
    });
  });
});

describe("deriveProfile — observability (BP-025 `## NFR budget`: profile outcome kind)", () => {
  it("logs the profile outcome kind, and never the profile's own field values", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const marker = "PROFILE-CATEGORY-MARKER-a91c";
    llmMock.mockResolvedValueOnce(measuredProfile({ category: marker }));

    await deriveProfile(fakeCostContext(), { home: "x" });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(logSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
    expect(logged.kind).toBe("measured");
    expect(JSON.stringify(logged)).not.toContain(marker);
    logSpy.mockRestore();
  });

  it("logs the reason on an unmeasured outcome", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    llmMock.mockResolvedValueOnce({ kind: "unmeasured", reason: "undeterminable", at: AT });

    await deriveProfile(fakeCostContext(), { home: "x" });

    const logged = JSON.parse(logSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
    expect(logged.kind).toBe("unmeasured");
    expect(logged.reason).toBe("undeterminable");
    logSpy.mockRestore();
  });
});

describe("deriveProfile — the prompt and the schema agree (issue #462)", () => {
  // The schema as JSON Schema: the one reading of it both the key set and
  // every list's bounds can be taken from, rather than restated here.
  const jsonSchema = () =>
    z.toJSONSchema(PROFILE_SCHEMA) as {
      properties: Record<string, { type: string; minItems?: number; maxItems?: number }>;
      required: string[];
      additionalProperties: boolean;
    };

  it("the prompt names exactly the schema's fields, in the schema's order, and the schema admits no other", () => {
    const schema = jsonSchema();
    expect(Object.keys(PROFILE_FIELDS)).toEqual(Object.keys(schema.properties));
    expect([...schema.required].sort()).toEqual(Object.keys(PROFILE_FIELDS).sort());
    expect(schema.additionalProperties).toBe(false);
  });

  it("every list the schema bounds is described to the model with the same two numbers", () => {
    const { properties } = jsonSchema();
    const lists = Object.entries(properties).filter(([, property]) => property.type === "array");
    expect(lists.map(([key]) => key).sort()).toEqual(Object.keys(PROFILE_LIST_BOUNDS).sort());
    for (const [key, property] of lists) {
      const min = property.minItems ?? 0;
      expect(property.maxItems).toBeDefined();
      const described = PROFILE_FIELDS[key as keyof typeof PROFILE_FIELDS];
      expect(described.startsWith(min > 0 ? `${min} to ${property.maxItems} ` : `at most ${property.maxItems} `)).toBe(
        true
      );
    }
  });

  const BASE = Object.freeze({
    category: "c",
    job: "j",
    offeringType: "o",
    audienceTerms: ["a", "b"],
    namedRivals: [] as string[],
    vocabulary: [] as string[],
    brandTokens: [] as string[],
  });

  it("the lists are capped — vocabulary 12, brandTokens 6, namedRivals 5 — and the model is still told each cap", () => {
    expect(PROFILE_LIST_BOUNDS.vocabulary.max).toBe(12);
    expect(PROFILE_LIST_BOUNDS.brandTokens.max).toBe(6);
    expect(PROFILE_LIST_BOUNDS.namedRivals.max).toBe(5);
    for (const key of ["vocabulary", "brandTokens", "namedRivals"] as const) {
      const max = PROFILE_LIST_BOUNDS[key].max;
      const at = Array.from({ length: max }, (_, i) => `t${i}`);
      expect(PROFILE_SCHEMA.safeParse({ ...BASE, [key]: at }).success).toBe(true);
      // The cap is still what the forced tool asks for, so trimming is the
      // fallback and not the plan (issue 898).
      expect(jsonSchema().properties[key]?.maxItems).toBe(max);
    }
  });

  // ── Issue 898 — an over-long list is trimmed, not fatal ───────────────
  //
  // `figma.com` on 2026-09-18: seven brand tokens against a cap of six,
  // and the whole seven-field answer thrown away for it. With no profile
  // there is no category, so the pass bought no suggestions and the
  // visitor was shown a report with no questions, no score and no band.

  it("a list one past its cap is kept and cut to the cap, in the model's own order — every list the schema bounds", () => {
    for (const key of ["audienceTerms", "namedRivals", "vocabulary", "brandTokens"] as const) {
      const max = PROFILE_LIST_BOUNDS[key].max;
      const over = Array.from({ length: max + 1 }, (_, i) => `t${i}`);
      const parsed = PROFILE_SCHEMA.safeParse({ ...BASE, [key]: over });
      expect(parsed.success, key).toBe(true);
      // The model's order, head-first — never a re-ordering of its answer.
      expect(parsed.success ? parsed.data[key] : null, key).toEqual(over.slice(0, max));
    }
  });

  it("figma's own answer: seven brand tokens is a kept profile, not a thrown-away one", () => {
    const parsed = PROFILE_SCHEMA.safeParse({
      category: "design software",
      job: "design and prototype interfaces with a team",
      offeringType: "saas",
      audienceTerms: ["designers", "product teams"],
      namedRivals: ["sketch"],
      vocabulary: ["design tool", "prototyping", "whiteboard"],
      brandTokens: ["figma", "figjam", "figma slides", "dev mode", "figma make", "figma draw", "figma sites"],
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success ? parsed.data.brandTokens : []).toHaveLength(PROFILE_LIST_BOUNDS.brandTokens.max);
    // The category survives, which is the whole of what the market read
    // needs from this answer.
    expect(parsed.success ? parsed.data.category : null).toBe("design software");
  });

  it("an answer that is really unusable still fails — a missing field, a wrong type, an eighth field, a list empty where min > 0", () => {
    const missingField: Record<string, unknown> = { ...BASE };
    delete missingField.category;
    expect(PROFILE_SCHEMA.safeParse(missingField).success).toBe(false);
    expect(PROFILE_SCHEMA.safeParse({ ...BASE, vocabulary: ["a", 2] }).success).toBe(false);
    expect(PROFILE_SCHEMA.safeParse({ ...BASE, vocabulary: "a,b" }).success).toBe(false);
    expect(PROFILE_SCHEMA.safeParse({ ...BASE, extra: "x" }).success).toBe(false);
    expect(PROFILE_SCHEMA.safeParse({ ...BASE, audienceTerms: [] }).success).toBe(false);
  });

  it("trimming leaves the forced tool buildable — the profile call still answers through a tool, not prose (#512)", () => {
    // `forcedToolFor` gives up on a schema `z.toJSONSchema` cannot express
    // and falls back to the text path. A `.transform` would do exactly
    // that silently; this asserts the profile schema is still convertible
    // and still an object.
    const schema = jsonSchema();
    expect(schema.additionalProperties).toBe(false);
    expect(Object.keys(schema.properties)).toHaveLength(7);
  });

  it("the instruction asks for JSON only — no prose, no code fence — and carries no keyword or search of its own", () => {
    expect(PROFILE_TASK).toMatch(/JSON object and nothing else/);
    expect(PROFILE_TASK).toMatch(/no prose/);
    expect(PROFILE_TASK).toMatch(/no code fence/);
    const instruction = JSON.stringify({ task: PROFILE_TASK, fields: PROFILE_FIELDS });
    expect(instruction).not.toMatch(/keyword|searchTerm/i);
  });
});

/** The page text's length inside the serialised prompt, quotes excluded. */
const serialised = (text: string | undefined) => (text === undefined ? 0 : JSON.stringify(text).length - 2);

describe("deriveProfile — the page text is bounded by one pin, home first, at a word boundary (issue #523)", () => {
  it("text that fits is sent whole — both pages, unaltered", () => {
    expect(boundPageText({ home: "alpha beta", pricing: "gamma delta" }, 100)).toEqual({
      home: "alpha beta",
      pricing: "gamma delta",
    });
  });

  it("is cut at a whitespace boundary, never mid-word, and drops the whitespace it was cut at", () => {
    expect(boundPageText({ home: "alpha beta gamma" }, 13)).toEqual({ home: "alpha beta" });
    expect(boundPageText({ home: "alpha beta gamma" }, 11)).toEqual({ home: "alpha beta" });
    expect(boundPageText({ home: "alpha beta gamma" }, 10)).toEqual({ home: "alpha beta" });
    expect(boundPageText({ home: "alpha beta gamma" }, 9)).toEqual({ home: "alpha" });
  });

  it("a first word longer than the whole bound is not sent in part", () => {
    expect(boundPageText({ home: "x".repeat(50) + " tail" }, 20)).toEqual({ home: "" });
  });

  it("home first: a home page that takes the whole bound leaves no room, and the pricing page is not sent", () => {
    const bounded = boundPageText({ home: "word ".repeat(100), pricing: "price text" }, 40);
    expect(bounded.pricing).toBeUndefined();
    expect(serialised(bounded.home)).toBeLessThanOrEqual(40);
    expect(bounded.home.startsWith("word word")).toBe(true);
  });

  it("the pricing page takes what the home page left, cut the same way", () => {
    const bounded = boundPageText({ home: "home page", pricing: "one two three four" }, 20);
    expect(bounded).toEqual({ home: "home page", pricing: "one two" });
    expect(serialised(bounded.home) + serialised(bounded.pricing)).toBeLessThanOrEqual(20);
  });

  it("the bound is on the serialised prompt — an escaped character counts as what it costs there", () => {
    const quoted = '"a" '.repeat(50); // each `"` is two characters once serialised
    const bounded = boundPageText({ home: quoted, pricing: quoted }, 60);
    expect(serialised(bounded.home) + serialised(bounded.pricing)).toBeLessThanOrEqual(60);
    expect(bounded.home.length).toBeLessThan(60);
  });

  it("never splits a surrogate pair", () => {
    const bounded = boundPageText({ home: "😀".repeat(30) }, 21);
    expect(bounded.home).toBe("");
    const spaced = boundPageText({ home: "😀 ".repeat(30) }, 21);
    expect(spaced.home).toBe("😀 ".repeat(7).trimEnd());
    expect(JSON.stringify(spaced.home)).not.toMatch(/\\ud[89ab]/i);
  });

  it("deriveProfile sends the bounded text: a home page three times the pin reaches llm() at most the pin, home first", async () => {
    llmMock.mockResolvedValueOnce(measuredProfile());
    const home = "buyer words ".repeat(Math.ceil((PROFILE_INPUT_MAX_CHARS * 3) / 12));
    await deriveProfile(fakeCostContext(), { home, pricing: "twelve pounds a month" });

    const input = (llmMock.mock.calls[0]![1] as RecordedLlmCall).input as { home: string; pricing?: string };
    expect(serialised(input.home) + serialised(input.pricing)).toBeLessThanOrEqual(PROFILE_INPUT_MAX_CHARS);
    expect(serialised(input.home)).toBeGreaterThan(PROFILE_INPUT_MAX_CHARS - "buyer words ".length);
    expect(home.startsWith(input.home)).toBe(true);
    expect(input.pricing).toBeUndefined();
  });
});
