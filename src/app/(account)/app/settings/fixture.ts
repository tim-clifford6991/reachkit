// BUILD §4.7 — Settings' facts, as a fixture.
//
// **This is the reserved fixture account's Settings, and nobody else's.**
// `provider.ts` answers `isReservedFixtureAccount` from here and reads every
// other account's facts live, each through the module that owns it, so what
// this file holds is one account's data rather than a placeholder for a
// missing one. Two of those reads have a designed degraded arm and fall back
// to the values below — billing and destinations (REQ-097 c5/c6); every
// other unread fact reaches the error boundary instead.
//
// Where each field comes from for a live account:
//
//   domain / category / competitors / voice / do-not-claim → the `sites` row
//   mode / veto / publish time / zone / enabled            → §9 publishing
//   destinations + health                                  → §9 destinations
//   name / email                                           → §13 identity
//   notifyPrefs                                            → §12 notifications
//   billing                                                → §13 Stripe
//   publishedPages                                         → §9 publications
//
// One exported constant, not a generator: a fixture that varied per call
// would make the layout conformance sweep non-deterministic. Its state is the
// ordinary one — a running plan, an autopilot site with five rivals and two
// destinations — because that is the state the screen is designed against.
// The states that branch (a cancelled plan; a destination in `error`; no
// competitors yet) are exercised by `tests/app/settings/`, which drives
// `assembleSettings` and the panels directly.
//
// The domain and the zone agree with the shell's fixture on purpose: the two
// are the same site, and a settings screen that named a different domain from
// the sidebar beside it would be the one bug this file can cause.
import { ACCOUNT_NOTE_KEYS } from "@/lib/account/identity/notes";
import { destinationView } from "@/lib/publish/destinations/view";
import type { BillingFacts, SettingsFacts } from "./model";
import { FIXTURE_DOMAIN } from "../_shell/fixture";

/** The billing facts, as `billingSummary` answers them (#34). Three
 *  members and no billing value: REQ-097 criterion 5 keeps the next
 *  invoice, the card and the invoice history off every ReachKit surface,
 *  and `billing.ts` records the owner's ruling that settled which of §4.7's
 *  four things survive it. `surfaceHref` is the one destination criterion 1
 *  names — the billing portal — and all three billing controls lead to it.
 *
 *  A fixed instant, not `Date.now() + n`: a fixture that moved would make
 *  the layout conformance sweep non-deterministic, and this one is a
 *  specimen of a paid-up account rather than a clock. */
const FIXTURE_BILLING: BillingFacts = Object.freeze({
  readable: true,
  state: "active",
  paidThrough: new Date("2026-10-01T00:00:00.000Z"),
  surfaceHref: "https://billing.stripe.com/p/session/fixture",
  // The approved S18 draws a card row, and this is the fixture's own four
  // digits for it (#374). The live path answers `null` — `users` holds no
  // card — so the row is drawn here and nowhere else until a Stripe read
  // exists; `billing.ts` states why it is not invented in between.
  cardLast4: "4242",
});

export const FIXTURE_SETTINGS_FACTS: SettingsFacts = Object.freeze({
  // A fixed instant, for the same reason `FIXTURE_BILLING.paidThrough` is
  // one: this account's screen is photographed by the layout sweep, and a
  // fixture that read the clock would make the picture a function of the
  // day it was taken (issue #304).
  now: new Date("2026-09-15T14:00:00.000Z"),
  domain: FIXTURE_DOMAIN,
  category: "user onboarding software",
  // REQ-071 c1 and c6 (issue #204): the ordinary state is that no market
  // answer is being replaced, so the card states its standing §4.7 line and
  // neither dated one. The same reason `FIXTURE_SHELL_FACTS` keeps
  // `stopped: null` — a fixture that carried the exceptional state would
  // make every screen suite assert the exception, and the two dated lines
  // are exercised by `tests/app/settings/market-change.test.tsx` over facts
  // of its own.
  pendingChange: null,
  editing: null,
  competitors: Object.freeze([
    "appcues.com",
    "userpilot.com",
    "pendo.io",
    "whatfix.com",
    "chameleon.io",
  ]),
  // `VETO.defaultHours`. Written as the stored value rather than imported,
  // because a fixture states what this site happens to hold, not what the
  // default is — a fixture that tracked the constant would stop being a
  // specimen of a stored value the day the default moved.
  vetoHours: 24,
  publishTime: "09:00",
  timeZone: "America/New_York",
  publishingEnabled: true,
  voiceText: "Plain and specific. No hype, no superlatives, first person plural.",
  doNotClaim: Object.freeze(["fastest on the market", "GDPR certified"]),
  // **One destination, and one only.** §9 publishes to the destination the
  // customer chose and to no other, and the `destinations` migration makes
  // that a database invariant (one live row per site). A fixture showing two
  // would be a specimen of a state the database refuses.
  //
  // Its state is `expired` / `credentials_expired` — a credential that has
  // run out, which is the ordinary broken case and the one §9 names: the
  // queue holds, one line says so, and Reconnect is offered. The screen is
  // designed against a destination that needs the customer, because a
  // destination that does not need them draws nothing.
  //
  // Built through the registry's own `destinationView`, never hand-written:
  // the action and the copy keys the panel renders are the engine's mapping,
  // so a fixture cannot show a control the engine would not offer.
  destinationsReadable: true,
  destinations: Object.freeze([
    destinationView({
      id: "dest-wordpress",
      kind: "wordpress",
      health: "expired",
      reason: "credentials_expired",
      lastCheckedAt: new Date("2026-09-06T07:00:00.000Z"),
      heldPages: 3,
    }),
  ]),
  name: "Dana Whitfield",
  email: "dana@example.com",
  // No change in flight (#134). The fixture draws the card at rest,
  // because that is the state a preview with no session is honestly in:
  // a pending address belongs to a real account and there is none here.
  pendingEmail: null,
  // REQ-077 c1's two note lines, in identity's own order. Taken from the
  // module rather than repeated, so the fixture and the read cannot state
  // a different pair.
  noteKeys: ACCOUNT_NOTE_KEYS,
  // Two on, one off — so the screen is drawn in a state where the switches
  // are the customer's own choices rather than a uniform default.
  notifyPrefs: Object.freeze({ weekly: false }),
  billing: FIXTURE_BILLING,
  publishedPages: 17,
});
