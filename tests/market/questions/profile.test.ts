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
import { PROFILE_LIST_BOUNDS } from "../../../src/lib/config/constants.ts";
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

beforeEach(async () => {
  llmMock.mockReset();
  ({ deriveProfile, PROFILE_SCHEMA, PROFILE_FIELDS, PROFILE_TASK } = await import(
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

  it("deriveProfile/audience-terms-bounded — fewer than 2 or more than 4 audienceTerms does not parse", async () => {
    llmMock.mockResolvedValueOnce(measuredProfile());
    await deriveProfile(fakeCostContext(), { home: "x" });
    const schema = (llmMock.mock.calls[0]![1] as RecordedLlmCall).schema;

    const base = { category: "c", job: "j", offeringType: "o", namedRivals: [], vocabulary: [], brandTokens: [] };

    expect(schema.safeParse({ ...base, audienceTerms: [] }).success).toBe(false);
    expect(schema.safeParse({ ...base, audienceTerms: ["one"] }).success).toBe(false);
    expect(schema.safeParse({ ...base, audienceTerms: ["a", "b"] }).success).toBe(true);
    expect(schema.safeParse({ ...base, audienceTerms: ["a", "b", "c", "d"] }).success).toBe(true);
    expect(schema.safeParse({ ...base, audienceTerms: ["a", "b", "c", "d", "e"] }).success).toBe(
      false
    );
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

  it("the lists are capped — vocabulary 12, brandTokens 6, namedRivals 5 — and one past each cap does not parse", () => {
    expect(PROFILE_LIST_BOUNDS.vocabulary.max).toBe(12);
    expect(PROFILE_LIST_BOUNDS.brandTokens.max).toBe(6);
    expect(PROFILE_LIST_BOUNDS.namedRivals.max).toBe(5);
    const base = {
      category: "c",
      job: "j",
      offeringType: "o",
      audienceTerms: ["a", "b"],
      namedRivals: [] as string[],
      vocabulary: [] as string[],
      brandTokens: [] as string[],
    };
    for (const key of ["vocabulary", "brandTokens", "namedRivals"] as const) {
      const max = PROFILE_LIST_BOUNDS[key].max;
      const at = Array.from({ length: max }, (_, i) => `t${i}`);
      expect(PROFILE_SCHEMA.safeParse({ ...base, [key]: at }).success).toBe(true);
      expect(PROFILE_SCHEMA.safeParse({ ...base, [key]: [...at, "one more"] }).success).toBe(false);
    }
  });

  it("the instruction asks for JSON only — no prose, no code fence — and carries no keyword or search of its own", () => {
    expect(PROFILE_TASK).toMatch(/JSON object and nothing else/);
    expect(PROFILE_TASK).toMatch(/no prose/);
    expect(PROFILE_TASK).toMatch(/no code fence/);
    const instruction = JSON.stringify({ task: PROFILE_TASK, fields: PROFILE_FIELDS });
    expect(instruction).not.toMatch(/keyword|searchTerm/i);
  });
});
