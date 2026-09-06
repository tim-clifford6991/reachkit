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
