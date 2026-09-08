// tests/app/settings/model.test.ts — BUILD §4.7, REQ-070 c1, REQ-097, WO-179
//
// The read model, decided with no database at all: `assembleSettings` is pure,
// so every claim below is a claim about facts in and a model out.
//
// WO-179 `## Test plan`: "`SettingsModel` carries exactly the fourteen settable
// values of criterion 1 and no other value a control could bind to", and "the
// notification rows are the stoppable subset of `MAIL_KINDS`; an unstoppable
// kind never appears and a newly stoppable one appears with no change to this
// module."
import { describe, expect, it } from "vitest";
import { assembleSettings, type SettingsFacts } from "@/app/(account)/app/settings/model";
import { notificationRows, NOTIFICATION_COPY_KEY } from "@/app/(account)/app/settings/notifications";
import { PLAN_KEY, PRICE_KEYS } from "@/app/(account)/app/settings/billing";
import { COPY } from "@/lib/presentation/copy";
import { FIXTURE_SETTINGS_FACTS } from "@/app/(account)/app/settings/fixture";
import { SETTABLE } from "@/app/(account)/app/settings/settable";
import { MAIL_KINDS, TOGGLE_KINDS, type MailKind } from "@/lib/mail/kinds";

const FACTS: SettingsFacts = FIXTURE_SETTINGS_FACTS;

/** #228 made `BillingSummary` a union — a card, or the arm that says it
 *  could not be read. Every row below is about the readable card, so it is
 *  narrowed once here rather than at each assertion. */
function card(model: { billing: import("@/app/(account)/app/settings/billing").BillingSummary }) {
  const { billing } = model;
  if (!billing.readable) throw new Error("expected a readable billing card");
  return billing;
}

/** The same narrowing on the way *in*: `SettingsFacts.billing` is a union
 *  too, and the fixture's arm is the readable one by construction. */
function readableFacts(): Extract<SettingsFacts["billing"], { readable: true }> {
  const { billing } = FACTS;
  if (!billing.readable) throw new Error("the fixture's billing facts are readable by construction");
  return billing;
}

describe("the model is pure — the same facts give the same screen (issue #304)", () => {
  it("takes the moment it is read at from its facts, never from the clock", () => {
    // `assembleSettings` used to compute `wouldTakeEffectOn` from a
    // `new Date()` of its own, which made the function's own header — "pure:
    // facts in, model out" — untrue, and made the settings screen render a
    // different date on a different week with nothing changed.
    //
    // Two moments a fortnight apart, one fact different: a model that reads
    // the clock returns the same date for both and fails here.
    const early = assembleSettings({ ...FACTS, now: new Date("2026-09-15T14:00:00.000Z") });
    const later = assembleSettings({ ...FACTS, now: new Date("2026-09-29T14:00:00.000Z") });
    expect(early.market.wouldTakeEffectOn).not.toBe(later.market.wouldTakeEffectOn);
  });

  it("gives the same answer twice for one moment", () => {
    const facts = { ...FACTS, now: new Date("2026-09-15T14:00:00.000Z") };
    expect(assembleSettings(facts)).toEqual(assembleSettings(facts));
  });
});

describe("REQ-070 c1 — the model carries a value for each settable key and nothing else a control could bind to", () => {
  const model = assembleSettings(FACTS);

  /** Where each of the fourteen keys reads from on the model. A key with no
   *  row here is a key the screen could not render, and a row for a key
   *  outside `SETTABLE` would be a value no control may write. */
  const READS: Record<(typeof SETTABLE)[number], () => unknown> = {
    category: () => model.market.category,
    competitors: () => model.competitors,
    domain: () => model.domain,
    mode: () => model.publishing.mode,
    veto_hours: () => model.publishing.vetoHours,
    publish_time: () => model.publishing.publishTime,
    time_zone: () => model.publishing.timeZone,
    publishing_enabled: () => model.publishing.enabled,
    destinations: () => model.destinations,
    voice_text: () => model.voice.text,
    do_not_claim: () => model.doNotClaim,
    notifications: () => model.notifications,
    name: () => model.account.name,
    email: () => model.account.email,
  };

  it("every one of the fourteen has a value on the model", () => {
    for (const key of SETTABLE) {
      expect(READS[key](), key).toBeDefined();
    }
    expect(Object.keys(READS).sort()).toEqual([...SETTABLE].sort());
  });

  it("the model's top-level shape is the fourteen's homes plus billing and the pages count, and nothing else", () => {
    expect(Object.keys(model).sort()).toEqual(
      [
        "account",
        "billing",
        "competitors",
        "content",
        "destinations",
        "doNotClaim",
        "domain",
        "market",
        "notifications",
        "publishing",
        "voice",
      ].sort()
    );
  });
});

describe("WO-179 step 5 — vetoHours is read, never corrected", () => {
  it("a stored value the rule would refuse still reaches the model unchanged", () => {
    // 37 is the value BP-055's stale comment admitted and no screen can render
    // (WO-178's own log). The validator's job is to stop it being stored; a
    // read that silently corrected it would hide the state the validator
    // exists to prevent.
    const model = assembleSettings({ ...FACTS, vetoHours: 37 });
    expect(model.publishing.vetoHours).toBe(37);
  });

  it("and zero is a value, not an absence — a zero window is autopilot with no veto (§9)", () => {
    expect(assembleSettings({ ...FACTS, vetoHours: 0 }).publishing.vetoHours).toBe(0);
  });
});

describe("WO-179 decision 4 — the notification rows are projected from MAIL_KINDS", () => {
  it("the rows are exactly the register's stoppable-by-toggle kinds, in its order", () => {
    const rows = assembleSettings(FACTS).notifications;
    expect(rows.map((r) => r.kind)).toEqual([...TOGGLE_KINDS]);
    for (const row of rows) {
      expect(MAIL_KINDS[row.kind].stoppable).toBe("toggle");
    }
  });

  it("no kind the register does not mark togglable appears", () => {
    const rows = assembleSettings(FACTS).notifications;
    const shown = new Set<MailKind>(rows.map((r) => r.kind));
    for (const kind of Object.keys(MAIL_KINDS) as MailKind[]) {
      if (MAIL_KINDS[kind].stoppable !== "toggle") expect(shown.has(kind)).toBe(false);
    }
  });

  it("every togglable kind has a registry key for its switch — a mail with no word is not shippable", () => {
    for (const kind of TOGGLE_KINDS) {
      expect(NOTIFICATION_COPY_KEY[kind as keyof typeof NOTIFICATION_COPY_KEY]).toBeTruthy();
    }
  });

  it("a kind absent from the stored preferences reads as on, and a stored false reads as off", () => {
    const rows = notificationRows({ weekly: false });
    expect(rows.find((r) => r.kind === "weekly")?.on).toBe(false);
    expect(rows.find((r) => r.kind === "published")?.on).toBe(true);
  });
});

describe("REQ-097 — the model carries no billing value at all", () => {
  // The ruling on issue #34 (REQ-097's first open question): Settings shows
  // the plan, the price and the control, and none of the next invoice, the
  // card or the invoice history. So the assertion is not "every value has
  // provenance" any more — it is that there is no such value on the model.
  it("the billing slice is the plan state, the access-end day and the destination — and nothing else", () => {
    const billing = assembleSettings(FACTS).billing;
    expect(Object.keys(billing).sort()).toEqual(["accessUntil", "readable", "state", "surfaceHref"]);
  });

  it("the plan and the price are copy keys, not values read back from a vendor", () => {
    // REQ-097's own non-goal: "€49/mo is a public product fact stated on
    // every price surface … not a value Stripe holds about one customer."
    expect(PLAN_KEY in COPY).toBe(true);
    for (const key of PRICE_KEYS) expect(key in COPY).toBe(true);
  });

  it("the access-end day is the paid-through instant, written in the customer's own zone", () => {
    // REQ-076 c3's "the exact date their access ends", and REQ-073 c3's
    // zone. One instant in, one written day out — and the zone applied here
    // and nowhere else.
    const model = assembleSettings(FACTS);
    const inZone = new Intl.DateTimeFormat("en-US", {
      timeZone: FACTS.timeZone,
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(readableFacts().paidThrough);
    expect(card(model).accessUntil).toBe(inZone);

    const elsewhere = assembleSettings({ ...FACTS, timeZone: "Australia/Sydney" });
    expect(card(elsewhere).accessUntil).not.toBe(card(model).accessUntil);
  });

  it("the plan state selects which of cancel/resume the card offers, and is not a date comparison", () => {
    // `users.cancelled_at`, recorded from what Stripe reported — never
    // derived from `paid_through`, which is the access gate (ADR-050) and
    // stays in the future for a customer who has already cancelled.
    expect(card(assembleSettings(FACTS)).state).toBe("active");
    const cancelled = assembleSettings({
      ...FACTS,
      billing: { ...readableFacts(), state: "cancelled" as const },
    });
    expect(card(cancelled).state).toBe("cancelled");

    // The same paid-through date under both states: the state did not come
    // from it.
    expect(card(cancelled).accessUntil).toBe(card(assembleSettings(FACTS)).accessUntil);
  });
});

describe("§6.6 cold start — the screen's model is total for a site that has nothing yet", () => {
  it("no competitors, no destinations and no published pages assemble without a branch", () => {
    const model = assembleSettings({
      ...FACTS,
      competitors: [],
      destinations: [],
      doNotClaim: [],
      voiceText: "",
      publishedPages: 0,
    });
    expect(model.competitors).toEqual([]);
    expect(model.destinations).toEqual([]);
    expect(model.content.pages).toBe(0);
    // A measured zero is a zero, never a null (§5, REQ-004).
    expect(model.content.pages).not.toBeNull();
  });
});
