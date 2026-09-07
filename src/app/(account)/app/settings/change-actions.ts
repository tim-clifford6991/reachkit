// BUILD §4.7 — the Server Functions behind the three answers with teeth.
//
// REQ-071's market and competitors cards change what the site is measured
// as. Every rule about what such a change *is* — that a save writes the
// declared answer and nothing else, that its effect falls at the first
// weekly re-measurement that begins after it, that the effective date is
// recomputed after the write — belongs to `@/lib/market/changes` and is not
// restated here. This file reads a value, names the account, calls the
// seam, and hands back what the seam answered (`ARCHITECTURE.md` rule 1).
//
// **A `"use server"` module may export only async functions**, so the
// refusal shape and the outcome type live in `./settable` and `./actions`
// where both this file and the panels can name them.
//
// **Which account.** The session's, through `_session/account.ts` — never a
// value the browser sent. A Server Function is an addressable endpoint: a
// site id in the request would let any signed-in customer rewrite another
// account's answers, so no argument here names one.
//
// **A session-less press lands on `/signin`**, like every other settings
// outcome (DECISIONS 2026-09-07, #134): one rule, no exception, and no
// sentence about whether an account exists.
//
// **The engine is imported at the call, not at the top.** This module is
// imported statically by a client component — that is how a Server Function
// gets its reference — and `@/lib/market/changes` reaches `@/lib/db`, which
// parses every environment binding the moment it is evaluated. Deferring it
// keeps merely *rendering* Settings free of the database.
"use server";

import { redirect } from "next/navigation";
import { SIGNIN_PATH } from "@/lib/account/identity/addresses";
import type { RivalSet } from "@/lib/market/setup/rivals";

/** What a change answered. `effectiveOn` is an ISO instant rather than a
 *  `Date` because a Server Function's return crosses to the browser, and
 *  the screen states it in the customer's own zone with the one formatter
 *  the rest of the screen uses. */
export type ChangeOutcome =
  | { saved: true; effectiveOn: string }
  | { saved: false; because: "unreachable" };

async function siteId(): Promise<string> {
  const { appAccount } = await import("../_session/account");
  const account = await appAccount();
  if (!account.ok) redirect(SIGNIN_PATH);
  return account.account.siteId;
}

/** REQ-071 c6 and c9 — the domain the site is measured and published under.
 *  Refused where the product cannot reach it, and then nothing is written. */
export async function saveDomainAction(domain: string): Promise<ChangeOutcome> {
  const { saveDomain } = await import("@/lib/market/changes");
  const result = await saveDomain({ siteId: await siteId(), domain });
  return result.ok
    ? { saved: true, effectiveOn: result.effectiveOn.toISOString() }
    : { saved: false, because: result.because };
}

/** REQ-071 c1 and c7 — the market the site is measured in. */
export async function saveCategoryAction(category: string): Promise<ChangeOutcome> {
  const { saveCategory } = await import("@/lib/market/changes");
  const result = await saveCategory({ siteId: await siteId(), category });
  return { saved: true, effectiveOn: result.effectiveOn.toISOString() };
}

/** REQ-071 c2, c3, c8 and c16 — the set the site is compared against.
 *  Adding and removing are `setup/rivals.ts`'s rules, which REQ-071 c4 says
 *  are the same rules; this persists the result, including an empty set. */
export async function saveRivalsAction(rivals: RivalSet): Promise<ChangeOutcome> {
  const { saveRivals } = await import("@/lib/market/changes");
  const result = await saveRivals({ siteId: await siteId(), rivals });
  return { saved: true, effectiveOn: result.effectiveOn.toISOString() };
}
