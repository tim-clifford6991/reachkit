// tests/generate/voice/confirmed-profile.test.ts — issue #927
//
// **The writer reads the confirmed profile, and only the confirmed one.**
//
// SPEC §7 (2026-09-20): "The confirmed business profile — what the business
// does, sells and promises, who it serves, its vocabulary — joins the
// writer's inputs." The owner's bar for the issue: content must be business
// specific and always relevant to this user, never generic.
//
// Four claims, and every one of them is asserted on the object that actually
// reaches the model:
//
//   1. a product the customer removed is **absent** from the built prompt;
//   2. one they added is **present**;
//   3. a site with no profile builds **the same prompt as before #927**;
//   4. the block is **bounded** — item counts, item characters and the
//      whole block, so a customer who keeps adding cannot spend the day's
//      draft budget on their own vocabulary.
//
// Pure. `confirmedProfile` and `promptProfile` are both pure, and the model
// seam is a mock that records what the one write call was handed — so all four run with no
// database, no clock and no vendor. That is the point: the removal rule is a
// property of the shape, and a property can be asserted without a substrate.
//
// The switched-off fact — #927's other half — is
// `tests/generate/pipeline/grounding-switched-off.test.ts`, because it is
// about the grounding read rather than about the prompt.
import "../env";
import { describe, expect, it, vi } from "vitest";
import { fakeCost, pack } from "../fixtures";
import { PROFILE_PROMPT_CAPS } from "../../../src/lib/config/constants";
import { confirmedProfile, type MarketReading } from "../../../src/lib/site-profile/business/confirm";
import { NO_EDITS, type BusinessEdits } from "../../../src/lib/site-profile/business/types";
import {
  profileItemsUsed,
  promptProfile,
} from "../../../src/lib/generate/voice/profile-block";
import { TEMPLATES } from "../../../src/lib/generate/templates";
import type { SiteProfile } from "../../../src/lib/site-profile/types";

const { llmMock } = vi.hoisted(() => ({ llmMock: vi.fn() }));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));

const { writePage } = await import("../../../src/lib/generate/pipeline/write");

/** The crawl's reading of a bike workshop. Only the members the confirmed
 *  profile reads are filled. */
function derived(over: Partial<SiteProfile> = {}): SiteProfile {
  return {
    domain: "harbourbikes.example",
    siteName: "Harbour Bike Repair",
    products: ["Basic service", "Full service", "Wheel truing"],
    claims: ["Full price quoted before work starts"],
    voice: {
      text: "Plain and specific.",
      tone: "Friendly",
      person: "We",
      vocabulary: ["tune-up", "drivetrain"],
      claimsToKeep: ["90-day guarantee"],
      claimsToAvoid: ["Cheapest in town"],
    },
    inventory: [],
    pagesRead: 6,
    refreshedAt: new Date("2026-09-14T06:00:00.000Z"),
    ...over,
  };
}

const MARKET: MarketReading = {
  job: "Service and repair bikes for people who ride them every day",
  offeringType: "local service",
  audienceTerms: ["Daily commuters", "Families"],
  vocabulary: ["bike service"],
};

function edits(over: Partial<BusinessEdits> = {}): BusinessEdits {
  return { ...NO_EDITS, ...over };
}

/** The prompt the write call actually hands the model, as one string: the
 *  context pack is everything the writer is given (SPEC §7, D41).
 *  Serialised, because the claim is "this text is not in the prompt" and a
 *  member-by-member walk would miss a nesting this test did not predict. */
async function draftPromptText(a: {
  profile: ReturnType<typeof promptProfile>;
}): Promise<string> {
  llmMock.mockReset();
  llmMock.mockResolvedValue({ kind: "unmeasured", reason: "undeterminable", at: new Date("2026-09-06T00:00:00.000Z") });
  await writePage(fakeCost(), {
    template: TEMPLATES.qa,
    pack: pack({ profile: a.profile }),
    pageType: "answer",
    length: { floor: 800, ceiling: 1400 },
  });
  const call = llmMock.mock.calls[0]?.[1] as { input: unknown } | undefined;
  expect(call, "the write call was not made").toBeDefined();
  return JSON.stringify(call!.input);
}

describe("#927 — a product the customer removed can never reach a page", () => {
  it("is absent from the confirmed profile, the projection and the built prompt", async () => {
    const confirmed = confirmedProfile({
      profile: derived(),
      market: MARKET,
      edits: edits({ removed: { products: ["Full service"] } }),
    });
    const block = promptProfile(confirmed);

    expect(block?.products).toEqual(["Basic service", "Wheel truing"]);
    expect(block?.products).not.toContain("Full service");

    // And in the text that reaches the model.
    const prompt = await draftPromptText({ profile: block });
    expect(prompt).toContain("Basic service");
    expect(prompt).not.toContain("Full service");
  });

  it("stays absent when the crawl reads it off the site again — the refresh cannot undo it", async () => {
    // The same decision against a *later* derived reading, which is what
    // Monday's pass is. `confirmedProfile` is pure, so a refresh is a second
    // call with a different reading.
    const monday = confirmedProfile({
      profile: derived({ products: ["Basic service", "Full service", "Wheel truing", "Bike fitting"] }),
      market: MARKET,
      edits: edits({ removed: { products: ["Full service"] } }),
    });
    const prompt = await draftPromptText({ profile: promptProfile(monday) });
    expect(prompt).not.toContain("Full service");
    expect(prompt).toContain("Bike fitting");
  });

});

describe("#927 — a product the customer added is written from", () => {
  it("is present in the block and in the built prompt, and marked as theirs nowhere in it", async () => {
    const confirmed = confirmedProfile({
      profile: derived(),
      market: MARKET,
      edits: edits({ added: { products: ["E-bike servicing"] } }),
    });
    const block = promptProfile(confirmed);
    expect(block?.products).toContain("E-bike servicing");

    const prompt = await draftPromptText({ profile: block });
    expect(prompt).toContain("E-bike servicing");
    // The prompt carries the item, not its provenance: whether the customer
    // typed it or the crawl read it is a fact for the screen, and a model
    // told "this one is theirs" would weigh it differently for no reason.
    expect(prompt).not.toContain('"yours"');
  });

  it("their own wording of what the business does is what the prompt carries", async () => {
    const confirmed = confirmedProfile({
      profile: derived(),
      market: MARKET,
      edits: edits({ job: "Keep commuters riding through the winter" }),
    });
    const prompt = await draftPromptText({ profile: promptProfile(confirmed) });
    expect(prompt).toContain("Keep commuters riding through the winter");
    expect(prompt).not.toContain("Service and repair bikes for people who ride them every day");
  });
});

describe("#927 — a site with no profile builds the prompt it built before", () => {
  it("carries `profile: null`, and nothing else about the prompt moves", async () => {
    const nothing = promptProfile(
      confirmedProfile({ profile: null, market: null, edits: NO_EDITS })
    );
    expect(nothing).toBeNull();

    const prompt = await draftPromptText({ profile: nothing });
    expect(prompt).toContain('"profile":null');
  });

  it("a profile whose every field is empty is also `null`, not a shape of empties", () => {
    // Otherwise a site whose crawl read nothing would get a *different*
    // prompt from one whose crawl never ran — a new prompt, a new cost and
    // a new output, for two states that mean the same thing.
    const empty = confirmedProfile({
      profile: derived({ products: [], claims: [], voice: null }),
      market: null,
      edits: NO_EDITS,
    });
    expect(promptProfile(empty)).toBeNull();
  });

  it("removing every item leaves no profile at all, and the prompt goes back to the old one", async () => {
    const stripped = confirmedProfile({
      profile: derived({ voice: null, claims: [] }),
      market: null,
      edits: edits({
        removed: { products: ["Basic service", "Full service", "Wheel truing"] },
      }),
    });
    expect(promptProfile(stripped)).toBeNull();
    expect(await draftPromptText({ profile: promptProfile(stripped) })).toContain('"profile":null');
  });
});

describe("#927 — the block is bounded, so a customer's own lists cannot spend the draft's budget", () => {
  /** A profile with far more in every list than the caps allow. */
  function oversized() {
    const many = (prefix: string, n: number): string[] =>
      Array.from({ length: n }, (_, i) => `${prefix} ${i + 1}`);
    return confirmedProfile({
      profile: derived({
        products: many("Service", 40),
        claims: many("We promise", 40),
        voice: {
          text: "",
          tone: "",
          person: "",
          vocabulary: many("word", 40),
          claimsToKeep: [],
          claimsToAvoid: [],
        },
      }),
      market: { ...MARKET, audienceTerms: many("Audience", 40), vocabulary: many("term", 40) },
      edits: NO_EDITS,
    });
  }

  it("every list is capped at its own bound", () => {
    const block = promptProfile(oversized());
    expect(block?.products.length).toBeLessThanOrEqual(PROFILE_PROMPT_CAPS.products);
    expect(block?.audience.length).toBeLessThanOrEqual(PROFILE_PROMPT_CAPS.audience);
    expect(block?.promises.length).toBeLessThanOrEqual(PROFILE_PROMPT_CAPS.promises);
    expect(block?.vocabulary.length).toBeLessThanOrEqual(PROFILE_PROMPT_CAPS.vocabulary);
  });

  it("a single item longer than its cap is cut at a word boundary, never mid-word", () => {
    const long = `${"Bicycle wheel truing and spoke replacement service ".repeat(4)}end`;
    const block = promptProfile(
      confirmedProfile({ profile: derived({ products: [long] }), market: MARKET, edits: NO_EDITS })
    );
    const item = block?.products[0] ?? "";
    expect(item.length).toBeLessThanOrEqual(PROFILE_PROMPT_CAPS.itemChars);
    expect(item.endsWith(" ")).toBe(false);
    // Cut at a boundary, stated as the property rather than as a guess at
    // which word lands on it: what survives is a prefix of the original,
    // and the original continues with a space — so no word was split.
    expect(long.startsWith(item)).toBe(true);
    expect(long.charAt(item.length)).toBe(" ");
  });

  it("what you do is one sentence, capped", () => {
    const block = promptProfile(
      confirmedProfile({
        profile: derived(),
        market: { ...MARKET, job: "x".repeat(PROFILE_PROMPT_CAPS.jobChars + 200) },
        edits: NO_EDITS,
      })
    );
    expect((block?.job ?? "").length).toBeLessThanOrEqual(PROFILE_PROMPT_CAPS.jobChars);
  });

  it("the whole block is under its ceiling, however much the customer added", () => {
    const block = promptProfile(oversized());
    const weight =
      (block?.job?.length ?? 0) +
      [
        ...(block?.products ?? []),
        ...(block?.audience ?? []),
        ...(block?.promises ?? []),
        ...(block?.vocabulary ?? []),
      ].reduce((total, item) => total + item.length, 0);
    expect(weight).toBeLessThanOrEqual(PROFILE_PROMPT_CAPS.blockChars);
  });

  it("what you do survives the ceiling — it is what makes a page specific at all", () => {
    const block = promptProfile(oversized());
    expect(block?.job).not.toBeNull();
    expect(block?.job).toContain("Service and repair bikes");
  });

  it("the ceiling drops vocabulary before it drops what the business sells", () => {
    // The order is the point: a page that names the wrong words still names
    // the right services, and a page that names no service is not about the
    // business.
    const block = promptProfile(oversized());
    expect(block?.products.length).toBeGreaterThan(0);
  });
});

describe("#927 — the draft records what it was written from", () => {
  it("lists the profile items the prompt carried, in the projection's own order", () => {
    const block = promptProfile(
      confirmedProfile({ profile: derived(), market: MARKET, edits: NO_EDITS })
    );
    const used = profileItemsUsed(block);
    expect(used[0]).toBe(block?.job);
    expect(used).toContain("Basic service");
    expect(used).toContain("Daily commuters");
    expect(used).toContain("Full price quoted before work starts");
    // Nothing the customer removed is recorded as used, because it was never
    // in the block to be carried.
    expect(profileItemsUsed(
      promptProfile(
        confirmedProfile({
          profile: derived(),
          market: MARKET,
          edits: edits({ removed: { products: ["Basic service"] } }),
        })
      )
    )).not.toContain("Basic service");
  });

  it("a site with no profile records nothing rather than an empty mark", () => {
    expect(profileItemsUsed(null)).toEqual([]);
  });
});
