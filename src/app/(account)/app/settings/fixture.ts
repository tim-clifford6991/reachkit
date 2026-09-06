// BUILD §4.7 — Settings' facts, as a fixture.
//
// Issue #18 builds this screen on FIXTURE data behind the typed provider in
// `provider.ts`, exactly as issue #9 built the shell. Every field below is a
// stand-in for a read that does not exist yet, each naming the issue that
// will supply it:
//
//   domain / category / competitors / voice / do-not-claim → `sites` (#42)
//   mode / veto / publish time / zone / enabled            → §9 publishing (#46)
//   destinations + health                                  → §9 destinations (#48)
//   name / email                                           → §13 identity (#35)
//   notifyPrefs                                            → §12 notifications (#31)
//   billing                                                → §13 Stripe (#34)
//   publishedPages                                         → §9 publications (#45)
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
  state: "active",
  paidThrough: new Date("2026-10-01T00:00:00.000Z"),
  surfaceHref: "https://billing.stripe.com/p/session/fixture",
});

export const FIXTURE_SETTINGS_FACTS: SettingsFacts = Object.freeze({
  domain: FIXTURE_DOMAIN,
  category: "user onboarding software",
  competitors: Object.freeze([
    "appcues.com",
    "userpilot.com",
    "pendo.io",
    "whatfix.com",
    "chameleon.io",
  ]),
  mode: "autopilot",
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
  destinations: Object.freeze([
    { id: "dest-hosted", kind: "hosted", health: "ok" },
    // The state, not an error: an expired credential holds the queue and asks
    // to be reconnected (ADR-086, §9).
    { id: "dest-wordpress", kind: "wordpress", health: "expired" },
  ] as const),
  name: "Dana Whitfield",
  email: "dana@example.com",
  // Two on, one off — so the screen is drawn in a state where the switches
  // are the customer's own choices rather than a uniform default.
  notifyPrefs: Object.freeze({ weekly: false }),
  billing: FIXTURE_BILLING,
  publishedPages: 17,
});
