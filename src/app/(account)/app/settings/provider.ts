// BUILD §4.7 — the one read Settings makes.
//
// The typed seam WO-179 calls `readSettings`. The screen calls it and
// nothing else. Behind the type there are exactly three steps: resolve the
// signed-in account, take one branch, and assemble the model.
//
// **Where the facts come from** (#228): `./store`, which reads every one of
// them for the account that owns it. Until #228 this file spread
// `FIXTURE_SETTINGS_FACTS` and overrode four groups from live reads, so a
// real customer read ten of their settings — the mode their pages publish
// under, the veto window, the publish time, the zone, whether publishing
// was on at all, their voice, their do-not-claim list, their notification
// switches, their page count and REQ-071's pending market change — off a
// fixture. The spread is gone. The
// fixture is reached on one branch and no other, and that branch is a fact
// about the name: `example.com` is IANA-reserved, so no customer can hold
// it (`isReservedFixtureAccount`, #192).
//
// **No fallback towards the fixture, on any read.** Two facts have a stated
// degraded arm because REQ-097 c5/c6 design one for them (billing) and
// because an unreadable registry is not an empty one (destinations); the
// rest propagate. `./store`'s header carries the reasoning. What this file
// no longer does is answer a failed read with settings the customer never
// chose.
//
// `React.cache` is what makes it one read per request even though the
// screen and any panel that later asks for itself would each ask: the page
// asks once and passes the model down today, and a later caller gets the
// same object rather than a second query. It is the same shape
// `_shell/provider.ts` uses, deliberately — two reads with two idioms is
// how a screen and its frame end up disagreeing about the site they are
// describing.
//
// **`portalLink` is not called here.** A portal session is short-lived, and
// one minted on every render of Settings would be a vendor round trip per
// page view and an address that had expired by the time anybody pressed it.
// The card's controls take the customer to it through the action seam
// (`actions.ts`), which mints one at the press. `surfaceHref` on the model
// is the fallback destination for a render with no action available.
//
// WO-179 step 2: no measurement, no vendor call and no model call happens
// here or downstream of here for the site's own facts. `listDestinations`
// reaches Postgres and resolves DNS for a hosted destination, and neither
// is a measurement, a vendor call or a model call.
import type { LinkMap } from "@/lib/known-content/link-map";
import type { MonthGot } from "@/lib/account/billing";
import { cache } from "react";
import { assembleSettings, type SettingsModel } from "./model";
import { FIXTURE_MONTH_GOT, FIXTURE_SETTINGS_FACTS } from "./fixture";
import { isReservedFixtureAccount, requireSetUpAccount } from "../_session/account";

// **Every read moved to `./store` in #228.** They lived here while this
// screen's facts were a fixture with four live overrides; now that every
// fact is read, they are one module's job, and this file is the seam
// again: the session, the one fixture branch, and the assembly.

export const readSettings = cache(async function readSettings(): Promise<SettingsModel> {
  // The session first, and §4.3's refusal where there is none — the same
  // road every other `/app` surface takes since #192. Settings used to fall
  // back to the fixture here so a preview would render; that fallback is
  // what put fixture facts on a real customer's screen, and the layout
  // sweep signs in against the substrate now (#193), so nothing needs it.
  const account = await requireSetUpAccount();

  // **The one fixture branch, and no other** (#228). `example.com` is
  // IANA-reserved, so no customer can hold the name that reaches it.
  if (isReservedFixtureAccount(account)) return assembleSettings(FIXTURE_SETTINGS_FACTS);

  const { readLiveSettingsFacts } = await import("./store");
  return assembleSettings(await readLiveSettingsFacts(account));
});

/**
 * The site link map (SPEC §7, 2026-10-10, issue 1391): which of the
 * customer's pages their live articles link, and which articles stand
 * alone. The reserved account reads its fixture's.
 */
export const readLinkMap = cache(async function readLinkMap(): Promise<LinkMap> {
  const account = await requireSetUpAccount();
  if (isReservedFixtureAccount(account)) {
    return {
      articles: 5,
      receiving: [
        { url: "https://example.com/pricing", articles: 3 },
        { url: "https://example.com/features/migration", articles: 2 },
        { url: "https://example.com/about", articles: 1 },
        // Longer than a phone is wide, with nowhere to break (issue 1456).
        { url: "https://example.com/journal/2026/10/0f8c2a7e5b9d4c1aa3e6f0b2d8c4e1a9b7f3d5c2e8a0b4f6d1c3e5a7b9d2f4e6", articles: 1 },
      ],
      alone: [
        { url: "https://example.com/blog/crm-export-checklist", title: "CRM export checklist: what to ask before you switch", linkedFrom: 0, linksOut: 3 },
        { url: "https://example.com/blog/7c1e9a3f5d2b8e4a6c0f1d3b5e7a9c2e4f6a8b0d1c3e5f7a9b2d4c6e8f0a1b3c5", title: "", linkedFrom: 1, linksOut: 2 },
      ],
    };
  }
  const { siteLinkMap } = await import("@/lib/known-content/link-map");
  return siteLinkMap(account.siteId);
});

/** Billing's "What you got this month" (SPEC §4, E3). The reserved account
 *  reads the densest fixture; `got` is `null` where the month could not be
 *  read, so the card says so and the subscription card beside it still draws. */
export const readMonthGot = cache(async function readMonthGot(): Promise<{ got: MonthGot | null; timeZone: string }> {
  const account = await requireSetUpAccount();
  if (isReservedFixtureAccount(account)) return { got: FIXTURE_MONTH_GOT, timeZone: account.timeZone };
  const { monthGot } = await import("@/lib/account/billing");
  return { got: await monthGot(account.userId, account.siteId), timeZone: account.timeZone };
});
