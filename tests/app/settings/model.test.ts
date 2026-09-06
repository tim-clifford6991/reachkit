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
import { billingValues, fromStripe } from "@/app/(account)/app/settings/billing";
import { FIXTURE_SETTINGS_FACTS } from "@/app/(account)/app/settings/fixture";
import { SETTABLE } from "@/app/(account)/app/settings/settable";
import { MAIL_KINDS, TOGGLE_KINDS, type MailKind } from "@/lib/mail/kinds";

const FACTS: SettingsFacts = FIXTURE_SETTINGS_FACTS;

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

describe("REQ-097 — every billing value on the model came from Stripe", () => {
  it("each one carries the provenance, and there is no arm that does not", () => {
    const values = billingValues(assembleSettings(FACTS).billing);
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) {
      expect(value.from).toBe("stripe");
      expect(typeof value.text).toBe("string");
    }
  });

  it("`fromStripe` is the only construction path, and it formats nothing", () => {
    // The text Stripe produced, returned unchanged: no currency symbol added,
    // no date reformatted, no rounding. A renderer therefore cannot be handed
    // a number to make a decision about.
    expect(fromStripe("1 October 2026 — €49.00")).toEqual({
      from: "stripe",
      text: "1 October 2026 — €49.00",
    });
  });

  it("the plan state selects which of cancel/resume the card offers, and is Stripe's, not a date comparison", () => {
    expect(assembleSettings(FACTS).billing.state).toBe("active");
    const cancelled = assembleSettings({
      ...FACTS,
      billing: { ...FACTS.billing, state: "cancelled" },
    });
    expect(cancelled.billing.state).toBe("cancelled");
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
