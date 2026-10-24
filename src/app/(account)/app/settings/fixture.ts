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
// ordinary one — a running plan, an autopilot site with two rivals and a
// live hosted address — because that is the state the boards draw.
// The states that branch (a cancelled plan; a destination in `error`; no
// competitors yet) are exercised by `tests/app/settings/`, which drives
// `assembleSettings` and the panels directly.
//
// The domain and the zone agree with the shell's fixture on purpose: the two
// are the same site, and a settings screen that named a different domain from
// the sidebar beside it would be the one bug this file can cause.
import { ACCOUNT_NOTE_KEYS } from "@/lib/account/identity/notes";
import { destinationView } from "@/lib/publish/destinations/view";
import type { MonthGot } from "@/lib/account/billing";
import type { BillingFacts, SettingsFacts } from "./model";
import { FIXTURE_DOMAIN } from "../_shell/fixture";
import { FIXTURE_RIVALS_FACTS } from "../_overview/rivals-fixture";

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
  // Shown in the specimen so the layout sweep measures the refund line.
  refundUntil: new Date("2026-09-15T00:00:00.000Z"),
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
  // The Competitors tab fixture's tracked pair, so both screens read one set.
  competitors: FIXTURE_RIVALS_FACTS.rivals,
  measuredRivals: FIXTURE_RIVALS_FACTS.rivals,
  // D28 (#1185): what ReachKit concluded, each with its reason.
  concluded: Object.freeze({
    category: "user onboarding software",
    categoryReason: "The site sells in-app product tours and checklists that help new users get started.",
    reasons: Object.freeze({
      [FIXTURE_RIVALS_FACTS.rivals[0] as string]: "In-app onboarding flows sold to product teams.",
      [FIXTURE_RIVALS_FACTS.rivals[1] as string]: "Product tours and onboarding checklists for SaaS teams.",
    }),
    categoryOverridden: false,
    rivalsOverridden: false,
  }),
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
  // **One destination, and one only** — the database allows one live row
  // per site. A live hosted address on the shell fixture's own blog host,
  // the state the Publishing board draws; the broken arms are exercised by
  // `tests/app/settings/destinations.test.tsx` over facts of its own.
  //
  // Built through the registry's own `destinationView`, never hand-written,
  // so a fixture cannot show a control the engine would not offer.
  destinationsReadable: true,
  // A hostname, never a sentence — the value setup's fixture carries.
  cnameTarget: "content.dev.reachkit.app",
  destinations: Object.freeze([
    destinationView({
      id: "dest-hosted",
      kind: "hosted",
      health: "ok",
      reason: null,
      lastCheckedAt: new Date("2026-09-06T07:00:00.000Z"),
      heldPages: 0,
      hostname: "blog.example.com",
      hostnameState: "live",
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
  // Both switches on, the Mail board's own state.
  notifyPrefs: Object.freeze({}),
  billing: FIXTURE_BILLING,
  publishedPages: 17,
});

/** The period ending on `FIXTURE_BILLING.paidThrough`: two pages live, two
 *  Monday mails, and the newest pass's searches and AI questions. */
export const FIXTURE_MONTH_GOT: MonthGot = Object.freeze({
  from: new Date("2026-09-01T00:00:00.000Z"),
  to: new Date("2026-10-01T00:00:00.000Z"),
  live: 2,
  liveAt: [new Date("2026-09-08T13:00:00.000Z"), new Date("2026-09-10T13:00:00.000Z")],
  reports: [new Date("2026-09-07T12:00:00.000Z"), new Date("2026-09-14T12:00:00.000Z")],
  asked: { searches: 12, questions: 23 },
});
