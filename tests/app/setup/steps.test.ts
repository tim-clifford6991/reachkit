// tests/app/setup/steps.test.ts — SPEC §5 (2026-09-20, #908), issue #922
//
// "Each step saves as it is left so a reload resumes" and "The deep pass
// starts when rivals are confirmed" — the two behaviours the five-step
// setup adds behind the screen. Every store here is built in the test, so
// nothing needs a database, a queue or a resolver.
import { describe, expect, it } from "vitest";
import {
  saveSetupStep,
  type SetupProgressState,
  type SetupStepSave,
  type SetupStore,
} from "@/app/(account)/setup/submit";
import type { SetupStepId } from "@/app/(account)/setup/steps";
import { confirmedProfile } from "@/lib/site-profile/business/confirm";
import { NO_EDITS, type BusinessEdits } from "@/lib/site-profile/business/types";
import {
  added,
  businessFrom,
  jobFrom,
  isFull,
  removed,
  BUSINESS_GROUPS,
  BUSINESS_MAX,
} from "@/app/(account)/setup/_setup/business";
import { assembleSetup } from "@/app/(account)/setup/_setup/facts";
import { FIXTURE_SETUP_FACTS, FIXTURE_SITE_PROFILE } from "@/app/(account)/setup/_setup/fixture";

const SITE = "site-1";
const USER = "user-1";
const PAID_AT = new Date(Date.UTC(2026, 8, 20, 9, 0, 0));

interface Recorder {
  steps: { siteId: string; save: SetupStepSave; resumeAt: SetupStepId | null }[];
  enqueued: string[];
}

function storeOf(over: Partial<SetupStore> = {}): { store: SetupStore; recorder: Recorder } {
  const recorder: Recorder = { steps: [], enqueued: [] };
  const store: SetupStore = {
    hasActiveAccess: async () => true,
    resolvesInDns: async () => true,
    hostnameTaken: async () => false,
    readProgress: async (): Promise<SetupProgressState> => ({
      complete: false,
      siteId: SITE,
      paidAt: PAID_AT,
    }),
    commitSetup: async () => undefined,
    saveStep: async (a) => {
      recorder.steps.push(a);
    },
    enqueueDeepPass: async (siteId) => {
      recorder.enqueued.push(siteId);
    },
    ...over,
  };
  return { store, recorder };
}

describe("a step saves as it is left, and says where to resume", () => {
  it("the site step stores the canonical domain and the market, and resumes on the business step", async () => {
    const { store, recorder } = storeOf();
    const result = await saveSetupStep(store, {
      userId: USER,
      save: { step: "site", domain: "https://WWW.Example.com/pricing", category: "agency CRM" },
    });
    expect(result).toEqual({ ok: true });
    expect(recorder.steps).toEqual([
      {
        siteId: SITE,
        save: { step: "site", domain: "example.com", category: "agency CRM" },
        resumeAt: "business",
      },
    ]);
  });

  it("the voice step resumes on publishing — the last step, whose answer the finish carries", async () => {
    const { store, recorder } = storeOf();
    await saveSetupStep(store, {
      userId: USER,
      save: { step: "voice", voiceText: "Plain and direct.", timezone: "Europe/Lisbon" },
    });
    expect(recorder.steps).toEqual([
      {
        siteId: SITE,
        save: { step: "voice", voiceText: "Plain and direct.", timezone: "Europe/Lisbon" },
        resumeAt: "publishing",
      },
    ]);
  });

  it("nothing is written for a founder who has already finished — they are taken onward", async () => {
    const { store, recorder } = storeOf({
      readProgress: async () => ({ complete: true, siteId: SITE, completedAt: PAID_AT }),
    });
    for (const save of [
      { step: "site", domain: "example.com", category: "agency CRM" },
      { step: "business", lists: {} },
      { step: "rivals", competitors: [] },
      { step: "voice", voiceText: "", timezone: null },
    ] satisfies SetupStepSave[]) {
      expect(await saveSetupStep(store, { userId: USER, save })).toEqual({
        ok: false,
        refused: "already_complete",
      });
    }
    expect(recorder.steps).toEqual([]);
    expect(recorder.enqueued).toEqual([]);
  });

  it("no active access is refused first — before the domain is even looked at", async () => {
    const { store, recorder } = storeOf({
      hasActiveAccess: async () => false,
      resolvesInDns: async () => {
        throw new Error("the resolver must not be asked");
      },
    });
    expect(
      await saveSetupStep(store, {
        userId: USER,
        save: { step: "site", domain: "not a domain", category: "" },
      }),
    ).toEqual({ ok: false, refused: "no_active_access" });
    expect(recorder.steps).toEqual([]);
  });
});

describe("a step's own refusals, one line each", () => {
  it("an unparseable domain, an unreachable one and an empty market each refuse and write nothing", async () => {
    const cases = [
      { save: { step: "site", domain: "nope", category: "agency CRM" }, refused: "invalid_domain" },
      { save: { step: "site", domain: "example.com", category: "  " }, refused: "market_missing" },
    ] as const;
    for (const { save, refused } of cases) {
      const { store, recorder } = storeOf();
      expect(await saveSetupStep(store, { userId: USER, save }), refused).toEqual({
        ok: false,
        refused,
      });
      expect(recorder.steps).toEqual([]);
    }

    const { store, recorder } = storeOf({ resolvesInDns: async () => false });
    expect(
      await saveSetupStep(store, {
        userId: USER,
        save: { step: "site", domain: "example.com", category: "agency CRM" },
      }),
    ).toEqual({ ok: false, refused: "invalid_domain" });
    expect(recorder.steps).toEqual([]);
  });

  it("a sixth rival refuses rather than silently truncating, and starts no pass", async () => {
    const { store, recorder } = storeOf();
    expect(
      await saveSetupStep(store, {
        userId: USER,
        save: {
          step: "rivals",
          competitors: ["a.com", "b.com", "c.com", "d.com", "e.com", "f.com"],
        },
      }),
    ).toEqual({ ok: false, refused: "too_many_competitors" });
    expect(recorder.steps).toEqual([]);
    expect(recorder.enqueued).toEqual([]);
  });
});

describe("the deep pass starts when rivals are confirmed (SPEC §5, 2026-09-20)", () => {
  it("the rivals step sends it, after the rivals are on disk", async () => {
    const order: string[] = [];
    const { store } = storeOf({
      saveStep: async () => {
        order.push("saved");
      },
      enqueueDeepPass: async () => {
        order.push("enqueued");
      },
    });
    expect(
      await saveSetupStep(store, {
        userId: USER,
        save: { step: "rivals", competitors: ["asana.com"] },
      }),
    ).toEqual({ ok: true });
    expect(order).toEqual(["saved", "enqueued"]);
  });

  it("no other step sends it — voice and publishing overlap a pass that is already running", async () => {
    for (const save of [
      { step: "site", domain: "example.com", category: "agency CRM" },
      { step: "business", lists: {} },
      { step: "voice", voiceText: "", timezone: null },
    ] satisfies SetupStepSave[]) {
      const { store, recorder } = storeOf();
      await saveSetupStep(store, { userId: USER, save });
      expect(recorder.enqueued, save.step).toEqual([]);
    }
  });

  it("a queue that is down leaves the founder on their way — the backstop re-sends it", async () => {
    const { store, recorder } = storeOf({
      enqueueDeepPass: async () => {
        throw new Error("queue down");
      },
    });
    expect(
      await saveSetupStep(store, { userId: USER, save: { step: "rivals", competitors: [] } }),
    ).toEqual({ ok: true });
    expect(recorder.steps).toHaveLength(1);
  });
});

describe("step two's lists — what the founder takes out and adds (SPEC §5, 2026-09-20, #970)", () => {
  /** The step as a founder meets it: the confirmed profile, which is the
   *  scan's reading with their own decisions over it. The same composition
   *  `assembleSetup` makes, so what is asserted here is what is drawn. */
  const confirmed = (edits: BusinessEdits = NO_EDITS) =>
    confirmedProfile({ profile: FIXTURE_SITE_PROFILE, market: null, edits });

  it("opens on what the scan read of their own site, group by group", () => {
    const draft = businessFrom(confirmed());
    expect(draft.products).toEqual(["project management", "agency time tracking"]);
    expect(draft.claims).toEqual(["used by 400 agencies", "set up in an afternoon"]);
    expect(draft.vocabulary).toEqual(["projects", "agencies", "time tracking"]);
    expect(draft.claimsToKeep).toEqual(["used by 400 agencies"]);
  });

  it("#1038: who they serve and what they do open on the market's reading of them", () => {
    const withMarket = confirmedProfile({
      profile: FIXTURE_SITE_PROFILE,
      market: { job: "manage client projects", offeringType: "", audienceTerms: ["agencies"], vocabulary: [] },
      edits: NO_EDITS,
    });
    expect(businessFrom(withMarket).audienceTerms).toEqual(["agencies"]);
    expect(jobFrom(withMarket)).toBe("manage client projects");
    // Reworded in Settings, the step opens on their wording, not the reading.
    expect(
      jobFrom(
        confirmedProfile({
          profile: FIXTURE_SITE_PROFILE,
          market: null,
          edits: { ...NO_EDITS, job: "We run agencies' projects" },
        })
      )
    ).toBe("We run agencies' projects");
    expect(jobFrom(null)).toBe("");
  });

  it("#970: a correction made in Settings is already on the step", () => {
    // The same two decisions Settings' own controls record, read back
    // through the same function: the step opens on the corrected profile,
    // not on the crawl's reading of it.
    const draft = businessFrom(
      confirmed({
        ...NO_EDITS,
        removed: { products: ["project management"] },
        added: { products: ["retainer billing"] },
      })
    );
    expect(draft.products).toEqual(["agency time tracking", "retainer billing"]);
  });

  it("a site nobody read opens with empty groups, not with none", () => {
    const draft = businessFrom(null);
    expect(Object.keys(draft)).toEqual([...BUSINESS_GROUPS]);
    expect(BUSINESS_GROUPS.every((group) => draft[group].length === 0)).toBe(true);
  });

  it("an item taken out is gone, and one added lands at the end of its own group", () => {
    const opened = businessFrom(confirmed());
    const fewer = removed(opened, "products", "project management");
    expect(fewer.products).toEqual(["agency time tracking"]);
    expect(fewer.claims).toEqual(opened.claims);

    const more = added(fewer, "products", "  retainer billing  ");
    expect(more.products).toEqual(["agency time tracking", "retainer billing"]);
  });

  it("an empty entry, a duplicate and a full group each change nothing", () => {
    const opened = businessFrom(confirmed());
    expect(added(opened, "products", "   ")).toBe(opened);
    expect(added(opened, "products", "project management")).toBe(opened);

    let full = opened;
    for (let n = full.products.length; n < BUSINESS_MAX.products; n += 1) {
      full = added(full, "products", `service ${n}`);
    }
    expect(isFull(full, "products")).toBe(true);
    expect(added(full, "products", "one more")).toBe(full);
  });
});

describe("a founder who left comes back where they stopped (SPEC §5, 2026-09-20)", () => {
  const saved = (over: Partial<Parameters<typeof assembleSetup>[0]["saved"] & object> = {}) =>
    assembleSetup({
      ...FIXTURE_SETUP_FACTS,
      saved: { category: null, competitors: [], voiceText: null, step: null, ...over },
    });

  it("the screen opens on the step they left, and on the first one when they have left none", () => {
    expect(saved({ step: "rivals" }).openAt).toBe("rivals");
    expect(saved().openAt).toBe("site");
    // A handle this build does not know is the beginning, never a stranding.
    expect(saved({ step: "somewhere-else" }).openAt).toBe("site");
  });

  it("their own market and their own rivals are on screen, not the scan's reading of them again", () => {
    const model = saved({ category: "bookkeeping for dentists", competitors: ["xero.com"] });
    expect(model.state.market).toEqual({ state: "stated", category: "bookkeeping for dentists" });
    expect(model.state.rivals).toEqual([{ domain: "xero.com", origin: "typed" }]);
  });

  it("restoring a market buys no suggestions — the ones this read settled are kept", () => {
    const model = saved({ category: "bookkeeping for dentists" });
    expect(model.state.suggestions.state).toBe("offered");
    expect(model.state.suggestions.candidates).toEqual(
      (FIXTURE_SETUP_FACTS.concluded?.rivals ?? []).map((rival) => rival.domain),
    );
  });

  it("a category they never changed leaves the card inferred, so the report's rivals stay on offer", () => {
    const model = saved({ category: FIXTURE_SETUP_FACTS.measured?.report.category ?? "" });
    expect(model.state.market.state).toBe("inferred");
  });

  it("the voice box opens on their own words where a voice step stored some", () => {
    expect(saved({ voiceText: "Blunt and short." }).voiceText).toBe("Blunt and short.");
    expect(saved().voiceText).toBe(FIXTURE_SITE_PROFILE.voice?.text);
  });
});
