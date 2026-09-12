// BUILD §4.3 — the reads the setup screens make.
//
// The typed seam every `/setup` surface calls, and nothing else. What it
// reads behind the type is the signed-in founder's own rows (issue #169);
// #133 had already made the *writes* live, and a screen drawn from a
// fixture in front of a store that writes real rows is the half-wired
// state this finishes.
//
// **Which account, and why not `requireAppAccount()`.** The session's own
// user id, through `currentSession()` directly. The `/app` surfaces use
// `_session/account.ts`, which redirects a session with no site to
// `/setup` — on the setup screen itself that is a loop, and setup is
// precisely where a founder who has no finished site belongs. So this
// file asks for the account and nothing more, and answers §4.3's refusal
// only for the one case that is really a refusal: no session at all.
//
// **No fixture branch here, deliberately.** The `/app` surfaces keep one
// for the reserved `example.com` account; setup cannot key on a domain,
// because the domain is the thing being set. #133 made the store live for
// every founder and this follows it: the fixture stays for the suites that
// drive `assembleSetup` and `completeSetup` directly.
//
// `React.cache` is what makes it one read per request even though the page
// and the form each ask.
import { cache } from "react";
import { redirect } from "next/navigation";
import { env } from "@/lib/config/env";
import { assembleSetup, type SetupScreenModel } from "./facts";
import { liveSetupStore, siteAddressFor } from "./store";
import type { PassProgress } from "./progress";
import type { SetupStore } from "../submit";
import type { ReportFacts } from "@/lib/market/setup/state";
import type { SiteProfile } from "@/lib/site-profile/types";

/** The signed-in founder, or §4.3's refusal. `src/middleware.ts` has
 *  already refused a request carrying no cookie at all, so the `null` arm
 *  is the forged, expired or ended one — answered the way every other
 *  account surface answers it, with no sentence about whether an account
 *  or a payment exists (REQ-020 c5). */
const currentFounder = cache(async function currentFounder(): Promise<{
  userId: string;
  siteId: string;
  domain: string;
}> {
  const { currentSession } = await import("@/lib/account/identity");
  const session = await currentSession();
  if (session === null) redirect("/signin");

  const address = await siteAddressFor(session.userId);
  // Provisioning creates the site row from the payment (§13), so a founder
  // who reached `/setup` has one. Where it is somehow absent the screen
  // opens on REQ-021 c7's arm — an empty address field — rather than
  // throwing them off their own setup page.
  return {
    userId: session.userId,
    siteId: address?.siteId ?? "",
    domain: address?.domain ?? "",
  };
});

/**
 * §4.3's screen, for the founder who is signed in.
 *
 * `measured` is REQ-021 c6 versus c7: the completed report for the address
 * this account will use, or `null` for a purchase with no report behind it
 * — in which case the address field is empty and nothing is pre-filled.
 *
 * **`suggestedRivals` is `null` on a screen read, and that is the honest
 * value rather than a gap.** `suggestRivals` is a vendor call through the
 * cost seam (`CostContext`), and REQ-026 c7's suggestions are sought when
 * the market settles — not on every render of a page a founder returns to
 * each time they retype their address. `null` is the state the shape
 * declares for "no market known yet and none has been sought", which is
 * exactly what a screen read knows; an empty array would be the different,
 * stronger claim that some source was asked and offered nothing
 * (REQ-026 c10).
 */
export const readSetupScreen = cache(async function readSetupScreen(): Promise<SetupScreenModel> {
  const founder = await currentFounder();
  const measured =
    founder.domain === ""
      ? null
      : await (async () => {
          const report = await readReportFor(founder.domain);
          return report === null ? null : { domain: founder.domain, report };
        })();

  return assembleSetup({
    measured,
    suggestedRivals: null,
    // SPEC.md §5 (2026-09-12): what the scan read of this site. Keyed by
    // the domain, because the free scan that built it had no account
    // behind it to key it by.
    profile: founder.domain === "" ? null : await readProfileFor(founder.domain),
    // §9's edge hostname is a deployment binding, never a string in a
    // card and never a fixture value in production.
    cnameTarget: env.HOSTED_EDGE_CNAME_TARGET,
  });
});

/**
 * The stored site profile for one domain, or `null`.
 *
 * **Imported at the call**, like every other read this file makes: the
 * store reaches `@/lib/db`, which parses every environment binding the
 * moment it is evaluated, and merely rendering `/setup` must not need a
 * database to be reachable.
 *
 * A read that fails is `null` — the card simply does not render — never a
 * screen the founder cannot get past. The profile is a thing the product
 * read *about* them; nothing they must answer.
 */
async function readProfileFor(domain: string): Promise<SiteProfile | null> {
  try {
    const { readSiteProfile } = await import("@/lib/site-profile");
    return await readSiteProfile(domain);
  } catch {
    return null;
  }
}

/**
 * The deep pass's current state. One arm carries which step is running;
 * the other carries that it ended, degraded or not. Neither carries a
 * time.
 *
 * The engine behind this is `passProgressFor(siteId)` (issue #36): it
 * reads the founder's recorded stage and the release latch, and the read
 * itself is what latches the ten-minute deadline — there is no scheduled
 * job in that path. It takes a `siteId`, which the session now supplies
 * (issue #169).
 *
 * **The read is what latches the deadline, so it is made once per request**
 * — `cache` is load-bearing here and not only an optimisation: the waiting
 * screen and anything beside it asking twice must not latch twice.
 *
 * A founder with no site row has no pass to report on: the screen shows
 * the pass as not running rather than latching a deadline against a site
 * that does not exist.
 */
export const readPassProgress = cache(async function readPassProgress(): Promise<PassProgress> {
  const founder = await currentFounder();
  if (founder.siteId === "") return { running: false, degraded: false };
  const { passProgressFor } = await import("@/lib/scan/deep/progress");
  return passProgressFor(founder.siteId);
});

/**
 * The writes completing setup makes. The route handler holds no knowledge
 * of which implementation it got.
 *
 * **This is the live store, since #133.** `liveSetupStore()` (issue #36)
 * writes the rows: the three answers, `applySetupChoice()`'s
 * mode-and-destination transaction, the `setup_completed_at` stamp and the
 * `scan/run` event at tier `deep`. It reads and writes **one account's**
 * rows, which is why it waited on issue #35 — and `currentSession()` has
 * landed, so `POST /api/setup` now hands it the session's own user id
 * rather than a fixture one. The two halves are one switch: a live store
 * behind a fixture account would read rows for an account that does not
 * exist and throw on the first submit, and a session behind a fixture
 * store would record a real founder's three answers nowhere. Nothing in
 * `submit.ts` changed for either.
 *
 * `fixtureSetupStore()` stays where it is — it is what `submit.test.ts`
 * and the route suite drive `completeSetup` with, and a store that never
 * ships is not a stand-in for one that does.
 */
export function setupStore(): SetupStore {
  return liveSetupStore();
}

/**
 * The completed report the product holds for one address, projected to the
 * three facts the market card needs (REQ-026 c1 versus c3).
 *
 * **Live since #169.** `readCurrentReport(domain)` landed with #25 and
 * `StoredReport` carries `scanId` and `category` directly; the rival names
 * come off the presence card, which is where `deriveRivals` put them in
 * score order.
 *
 * The projection is deliberate and stays one — `ReportFacts` is not
 * `StoredReport`, for the cycle reason `src/lib/market/setup/state.ts`'s
 * header gives, and the market card needs three facts and no more.
 *
 * **A report with no category is `null`, not a report with an empty
 * market.** REQ-026 c1 versus c3: an inferred market card is drawn from a
 * category that was measured, and a scan that measured none leaves the
 * card empty for the founder to fill — which is the `null` arm here, not a
 * card claiming a market nobody derived.
 *
 * It reads on every render of the address the founder is typing against,
 * and that is what makes REQ-026 c6 true rather than only tested: change
 * the address away from a measured one and the market card goes empty,
 * change it back and the inferred card returns. A read that fails is
 * `null` — the empty card — never a screen the founder cannot get past.
 */
export async function readReportFor(domain: string): Promise<ReportFacts | null> {
  let report: Awaited<ReturnType<typeof import("@/lib/scan/report").readCurrentReport>>;
  try {
    const { readCurrentReport } = await import("@/lib/scan/report");
    report = await readCurrentReport(domain);
  } catch {
    return null;
  }
  if (report === null) return null;
  // #103: the category has one home — the market the profile inferred —
  // and `categoryOf` is its one derivation.
  const { categoryOf } = await import("@/lib/scan/sections");
  const category = categoryOf(report.market);
  if (category === null) return null;
  return {
    scanId: report.scanId,
    category,
    rivals: (report.presence?.rivals ?? []).map((rival) => rival.domain),
  };
}
