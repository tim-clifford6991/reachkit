/** @vitest-environment jsdom */
// tests/app/shell/waiting-card.test.tsx — owner, 2026-10-08 (issue 1337):
// "this must be autopilot, not requiring user approval or interaction".
//
// The side panel's card for an untouched page in review, in the registry's
// own words (`copy()` is real here; `frame.test.tsx` asserts the keys). It
// names the day the page publishes on its own and asks for nothing.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { WaitingCard } from "@/app/(account)/app/_shell/WaitingCard";
import { formatDateTime } from "@/app/(account)/app/_shell/format";
import { copy } from "@/lib/presentation/copy";

const ZONE = "Europe/Berlin";
/** The page the issue names: written on the 8th, publishes 09:00 Berlin on
 *  its calendar day, the 9th. Nobody has touched it. */
const PUBLISHES_AT = new Date("2026-10-09T07:00:00.000Z");
const REVIEW = { draftId: "draft-1", title: "How much does a bike service cost in 2026?", goesLiveAt: PUBLISHES_AT };

function text(): string {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(<WaitingCard review={REVIEW} timeZone={ZONE} />);
  return container.textContent ?? "";
}

describe("the waiting-page card on an untouched page in review", () => {
  it("names the day and time the page publishes on its own", () => {
    const said = text();
    expect(said).toContain(copy("shell.waiting.goes-live", { when: formatDateTime(PUBLISHES_AT, ZONE) }));
    expect(said).toContain("Oct 9, 2026");
    expect(said).toMatch(/on its own/u);
  });

  it("asks for no approval and does not say the page waits on the customer", () => {
    expect(text()).not.toMatch(/approv|waiting for you|waits for you|needs you|your review/iu);
  });
});
