/** @vitest-environment jsdom */
// tests/app/settings/destinations.test.tsx — BUILD §4.7's destinations list,
// reading the publishing registry's view (#48).
//
// §4.7 draws "destinations list with health + Reconnect". Since the
// registry landed, what the card renders is `DestinationView` entire — a
// state, one written line and one action — and this suite is what holds it
// to the engine's decision rather than to a mapping of its own.
//
// The four action states are each rendered, because each is a different
// control and one of them (`reconnect_other_account`) exists precisely so
// that the ordinary Reconnect is not offered where re-entering the same
// credential would change nothing (ADR-086).
//
// `copy()` is mocked to `(key) => key`, the convention this screen's other
// suites set: the assertions are about which key a line resolves from,
// never about the owner's wording.
import { describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";

vi.mock("@/lib/presentation/copy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/presentation/copy")>();
  return { ...actual, copy: (key: string) => key };
});

import { PublishingPanel } from "@/app/(account)/app/settings/panels/PublishingPanel";
import { FIXTURE_SETTINGS_FACTS } from "@/app/(account)/app/settings/fixture";
import { assembleSettings } from "@/app/(account)/app/settings/model";
import { destinationView } from "@/lib/publish/destinations/view";
import type { DestinationFacts } from "@/lib/publish/destinations/view";

const CHECKED_AT = new Date("2026-09-06T07:00:00.000Z");

async function mount(facts: Partial<DestinationFacts> | null): Promise<HTMLElement> {
  const destinations =
    facts === null
      ? []
      : [
          destinationView({
            id: "dest-1",
            kind: "wordpress",
            health: "expired",
            reason: "credentials_expired",
            lastCheckedAt: CHECKED_AT,
            heldPages: 3,
            ...facts,
          }),
        ];
  const settings = assembleSettings({ ...FIXTURE_SETTINGS_FACTS, destinations });
  const host = document.createElement("div");
  document.body.append(host);
  await act(async () => {
    createRoot(host).render(<PublishingPanel settings={settings} />);
  });
  return host;
}

describe("the state is the band, and the reason is the line and the action", () => {
  it("a working destination says its state and stops: no line, no control", async () => {
    const host = await mount({ health: "ok", reason: null });
    const row = host.querySelector('[data-testid="destination-dest-1"]')!;
    expect(row.textContent).toContain("settings.destination.health.ok");
    expect(row.querySelector("button")).toBeNull();
    expect(row.textContent).not.toContain("publish.destination.line");
  });

  it("an expired credential offers Reconnect alongside one written line", async () => {
    const host = await mount({ health: "expired", reason: "credentials_expired" });
    const row = host.querySelector('[data-testid="destination-dest-1"]')!;
    expect(row.textContent).toContain("settings.destination.health.expired");
    expect(row.textContent).toContain("settings.publishing.reconnect");
    expect(row.textContent).toContain("publish.destination.line.credentials-expired");
  });

  it("a destination waiting on DNS offers the record to set, not a credential to re-enter", async () => {
    const host = await mount({ kind: "hosted", health: "expired", reason: "dns_unset" });
    const row = host.querySelector('[data-testid="destination-dest-1"]')!;
    expect(row.textContent).toContain("settings.publishing.set-dns");
    expect(row.textContent).not.toContain("settings.publishing.reconnect");
    expect(row.textContent).toContain("publish.destination.line.dns-unset");
  });

  it("a credential that cannot publish offers an action leading to a different account, and never ordinary Reconnect", async () => {
    const host = await mount({ health: "error", reason: "cannot_publish" });
    const row = host.querySelector('[data-testid="destination-dest-1"]')!;
    expect(row.textContent).toContain("settings.destination.health.error");
    expect(row.textContent).toContain("settings.publishing.reconnect-other-account");
    expect(row.textContent).toContain("publish.destination.line.cannot-publish");
  });

  it("that line is its own, and is not the line every other broken state carries", async () => {
    const cannotPublish = await mount({ health: "error", reason: "cannot_publish" });
    const expired = await mount({ health: "expired", reason: "credentials_expired" });
    expect(cannotPublish.textContent).not.toContain("publish.destination.line.credentials-expired");
    expect(expired.textContent).not.toContain("publish.destination.line.cannot-publish");
  });
});

describe("health reads as a word, never as a tone alone", () => {
  it.each(["ok", "expired", "error"] as const)("%s renders its own word", async (health) => {
    const host = await mount({ health, reason: health === "ok" ? null : "credentials_expired" });
    expect(host.textContent).toContain(`settings.destination.health.${health}`);
  });
});

describe("a site with no destination yet draws no row and no control", () => {
  it("the list is empty, and the card still renders", async () => {
    const host = await mount(null);
    expect(host.querySelectorAll('[data-testid^="destination-"]')).toHaveLength(0);
    expect(host.textContent).toContain("settings.publishing.destinations");
  });
});

describe("nothing technical reaches the card", () => {
  it("the view it renders carries no field a vendor string could arrive in", async () => {
    const view = destinationView({
      id: "dest-1",
      kind: "wordpress",
      health: "error",
      reason: "credentials_invalid",
      lastCheckedAt: CHECKED_AT,
      heldPages: 1,
    });
    // Every value on it is an id, a token, a date, a count or a copy key.
    expect(Object.values(view.copy).filter((k) => k !== null).every((k) => typeof k === "string")).toBe(true);
    expect(view).not.toHaveProperty("config");
    expect(view).not.toHaveProperty("message");
  });
});

// ── Issue #240 — the credential form, in the card ──────────────────────
//
// The M10 gap: `connect()` and `storeConfig()` had no caller on any
// screen, so a customer could not connect their WordPress at all. What
// this suite holds is the surface half — that the form exists, that it is
// reached from each of the three states that need a credential and from
// none of the others, and that nothing about the credential is rendered,
// echoed or kept once the call is made.
//
// The Server Function is mocked at its module: what a `connect()` does to
// a row is `tests/publish/destinations/`'s, and driving a database from a
// DOM suite would assert the engine twice and the surface once.
describe("REQ-060 — the one place a WordPress credential is typed", () => {
  it("a destination that has never held one offers Connect, not Reconnect", async () => {
    const host = await mount({ health: "expired", reason: "never_connected" });
    const row = host.querySelector('[data-testid="destination-dest-1"]')!;
    expect(row.textContent).toContain("settings.publishing.connect");
    // The word is the whole point of the fourth action: "Reconnect" tells
    // a founder they did something they did not.
    expect(row.textContent).not.toContain("settings.publishing.reconnect");
  });

  it.each([
    ["never_connected", "expired"],
    ["credentials_expired", "expired"],
    ["cannot_publish", "error"],
  ] as const)("%s reaches the same two fields", async (reason, health) => {
    const host = await mount({ health, reason });
    const control = host.querySelector('[data-testid="wp-credential"] button')!;
    expect(host.querySelector('[data-testid="wp-credential-form"]')).toBeNull();
    await act(async () => {
      control.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const form = host.querySelector('[data-testid="wp-credential-form"]')!;
    expect(form).not.toBeNull();
    // Three since the master's ruling of 2026-09-07: an application
    // password authenticates as `username:app-password`, so the user it
    // was issued to is part of the credential.
    expect(form.querySelectorAll("input")).toHaveLength(3);
    expect(form.textContent).toContain("settings.destination.site-url");
    expect(form.textContent).toContain("settings.destination.username");
    expect(form.textContent).toContain("settings.destination.app-password");
    expect(form.textContent).toContain("settings.destination.submit");
  });

  it("**the password is never rendered in clear text**", async () => {
    const host = await mount({ health: "expired", reason: "never_connected" });
    await act(async () => {
      host
        .querySelector('[data-testid="wp-credential"] button')!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const inputs = [...host.querySelectorAll('[data-testid="wp-credential-form"] input')];
    const password = inputs.find((input) => input.getAttribute("name") === "application-password");
    expect(password?.getAttribute("type")).toBe("password");
    // And the other field is not: a site address is the customer's own
    // public URL and hiding it would help nobody.
    const site = inputs.find((input) => input.getAttribute("name") === "site-url");
    expect(site?.getAttribute("type")).toBe("text");
    // Nor is the user name: it is half of a pair, and hiding it would only
    // stop the customer checking what they typed.
    const user = inputs.find((input) => input.getAttribute("name") === "wp-username");
    expect(user?.getAttribute("type")).toBe("text");
  });

  it("a working destination offers no form at all — there is nothing to connect", async () => {
    const host = await mount({ health: "ok", reason: null });
    expect(host.querySelector('[data-testid="wp-credential"]')).toBeNull();
  });

  it("a destination waiting on DNS offers no form either — it needs a record, not a credential", async () => {
    const host = await mount({ kind: "hosted", health: "expired", reason: "dns_unset" });
    expect(host.querySelector('[data-testid="wp-credential"]')).toBeNull();
    expect(host.textContent).toContain("settings.publishing.set-dns");
  });

  it("the form is closed until it is asked for, and nothing is typed into a card at rest", async () => {
    const host = await mount({ health: "error", reason: "cannot_publish" });
    expect(host.querySelector('[data-testid="wp-credential-form"]')).toBeNull();
    // Scoped to the credential's own subtree: the card's mode and
    // publishing-enabled toggles are inputs too, and they are not fields
    // anything is typed into.
    expect(host.querySelectorAll('[data-testid="wp-credential"] input')).toHaveLength(0);
  });
});
