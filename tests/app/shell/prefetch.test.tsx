/** @vitest-environment jsdom */
// tests/app/shell/prefetch.test.tsx — SPEC §4 (2026-10-08), issue 1341
//
// **A link to another screen of the app is a `next/link` that prefetches
// the full route.** `next/link` and a plain `<a>` render the same anchor,
// so the markup cannot tell them apart; what can is which component drew
// it. `next/link` is replaced here by one that writes down what it was
// given, and each screen is asked what it drew.
//
// What a prefetched transition then does in a browser — the shared layout
// staying mounted — is `tests/ui/layout/in-app-navigation.test.ts`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

vi.mock("next/link", () => ({
  default: (p: { href: string; prefetch?: unknown; children?: React.ReactNode }) => (
    <a href={p.href} data-next-link="" data-prefetch={String(p.prefetch)}>
      {p.children}
    </a>
  ),
}));

const at = vi.hoisted(() => ({ pathname: "/app" }));
vi.mock("next/navigation", () => ({
  usePathname: () => at.pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import AccountError from "@/app/(account)/error";
import AccountNotFound from "@/app/(account)/not-found";
import DraftPage from "@/app/(account)/app/draft/[draftId]/page";
import { FIXTURE_DRAFT_ID } from "@/app/(account)/app/draft/[draftId]/fixture";
import { OverviewTabs } from "@/app/(account)/app/_overview/OverviewTabs";
import { RivalPresence } from "@/app/(account)/app/_overview/RivalPresence";
import { assembleRivals } from "@/app/(account)/app/_overview/rivals-model";
import { FIXTURE_RIVALS_FACTS } from "@/app/(account)/app/_overview/rivals-fixture";
import { OVERVIEW_TABS, TAB_HREF } from "@/app/(account)/app/_overview/tabs";
import { AppDock } from "@/app/(account)/app/_shell/AppDock";
import { DESTINATIONS, DESTINATION_HREF } from "@/app/(account)/app/_shell/destinations";
import { Shortcuts } from "@/app/(account)/app/_shell/Shortcuts";
import { SidebarNav } from "@/app/(account)/app/_shell/SidebarNav";
import { WaitingCard } from "@/app/(account)/app/_shell/WaitingCard";
import { SettingsTabs } from "@/app/(account)/app/settings/SettingsTabs";
import { SETTINGS_TABS, SETTINGS_TAB_HREF } from "@/app/(account)/app/settings/tabs";
import { resetAccount, signedInAs } from "../account-door";

beforeEach(() => signedInAs());
afterEach(() => resetAccount());

interface Drawn {
  readonly href: string;
  /** Drawn by `next/link`, not by a plain `<a>`. */
  readonly link: boolean;
  /** The `prefetch` prop as given: `"true"` is the full route. */
  readonly prefetch: string | null;
}

/** Every anchor a tree draws, and how it was drawn. */
function anchors(tree: React.ReactNode): Drawn[] {
  const root = document.createElement("div");
  root.innerHTML = renderToStaticMarkup(tree);
  return Array.from(root.querySelectorAll("a")).map((a) => ({
    href: a.getAttribute("href") ?? "",
    link: a.hasAttribute("data-next-link"),
    prefetch: a.getAttribute("data-prefetch"),
  }));
}

const prefetched = (href: string): Drawn => ({ href, link: true, prefetch: "true" });

const NO_WAIT = Promise.resolve(0);
const RIVALS = assembleRivals(FIXTURE_RIVALS_FACTS);

describe("SPEC §4 (2026-10-08) — a link to another screen of the app prefetches the full route", () => {
  it.each([
    { name: "the side panel's menu", tree: <SidebarNav waiting={NO_WAIT} /> },
    { name: "the icon rail's menu", tree: <SidebarNav waiting={NO_WAIT} rail /> },
    { name: "the phone's dock", tree: <AppDock waiting={NO_WAIT} /> },
  ])("$name: all three destinations", ({ tree }) => {
    expect(anchors(tree)).toEqual(DESTINATIONS.map((d) => prefetched(DESTINATION_HREF[d])));
  });

  it("Settings' seven tabs", () => {
    at.pathname = SETTINGS_TAB_HREF.business;
    expect(anchors(<SettingsTabs />)).toEqual(SETTINGS_TABS.map((t) => prefetched(SETTINGS_TAB_HREF[t])));
  });

  it("Overview's four tabs", () => {
    at.pathname = "/app";
    expect(anchors(<OverviewTabs />)).toEqual(OVERVIEW_TABS.map((t) => prefetched(TAB_HREF[t])));
  });

  it("the Waiting for you card opens its draft", () => {
    const review = { draftId: "draft-1", title: "A page", goesLiveAt: null };
    expect(anchors(<WaitingCard review={review} timeZone="UTC" />)).toEqual([prefetched("/app/draft/draft-1")]);
  });

  it("Rivals' way through to AI answers", () => {
    const drawn = anchors(
      <RivalPresence
        firstPage={RIVALS.firstPage}
        named={RIVALS.named}
        startedLine={null}
        enginesLine="Google AI Overview"
        answersHref={TAB_HREF.ai_answers}
      />
    );
    expect(drawn).toContainEqual(prefetched(TAB_HREF.ai_answers));
  });

  it("the draft's back to Plan, on the draft and where there is none", async () => {
    for (const draftId of [FIXTURE_DRAFT_ID, "draft-nobody-owns"]) {
      const drawn = anchors(await DraftPage({ params: Promise.resolve({ draftId }) }));
      expect(drawn, draftId).toContainEqual(prefetched(DESTINATION_HREF.calendar));
    }
  });

  it("the account not-found screen's way back to Overview", () => {
    expect(anchors(<AccountNotFound />)).toEqual([prefetched("/app")]);
  });
});

describe("the account error screen's way back is a full load", () => {
  // Next's error boundary clears its error only when the pathname changes,
  // so a client transition from a failed `/app` to `/app` would leave the
  // error standing and the control dead. The full load is the retry.
  it("an ordinary link to Overview", () => {
    expect(anchors(<AccountError />)).toEqual([{ href: "/app", link: false, prefetch: null }]);
  });
});

describe("a link that leaves the app stays an ordinary link", () => {
  it("the blog shortcut and Help are not client transitions", () => {
    const drawn = anchors(<Shortcuts blog="https://blog.example.com" />);
    expect(drawn.length).toBe(2);
    expect(drawn.filter((a) => a.link)).toEqual([]);
  });
});
