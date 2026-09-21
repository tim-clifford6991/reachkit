// SPEC §4 (2026-09-20, #908, issue #913) — the Server Functions behind the
// seven Settings controls that did nothing.
//
// Until this issue the veto stepper, the publish time, the time zone, the
// publishing switch, the three mail switches and the never-claim list were
// drawn and inert: every one of them was already in `SETTABLE`'s closed
// offer, and none of them had a write path. §4.7's own rule is that
// Settings offers exactly `SETTABLE` and `ACTIONS` — what it did not say,
// and what the redesign now does, is that an offered control must be able
// to act.
//
// **This file decides nothing.** Which veto windows are legal, what a
// publish-time change does to the drafts already in review, whether a zone
// resolves, what a stopped switch holds back, whether a mail may be
// stopped and what re-checking a changed claim list costs all belong to
// the modules that own them — `@/lib/publish/settings`,
// `@/lib/publish/switch`, `@/lib/mail/notifications`,
// `@/lib/generate/claims`. Each is asked, and what it answers is handed
// back (`ARCHITECTURE.md` rule 1).
//
// **Which account.** The session's, through `_session/account.ts` — never
// a value the browser sent. A Server Function is an addressable endpoint:
// a site id in the request would let any signed-in customer rewrite
// another account's settings, so no field here names one and none is read.
//
// **A session-less press lands on `/signin`**, like every other settings
// outcome (DECISIONS 2026-09-07, #134).
//
// **Every engine is imported at the call, not at the top.** This module is
// imported statically by client panels — that is how a Server Function
// gets its reference — and each of these engines reaches `@/lib/db`, which
// parses every environment binding the moment it is evaluated. Deferring
// them keeps merely *rendering* Settings free of the database, exactly as
// `./change-actions.ts` does.
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SIGNIN_PATH } from "@/lib/account/identity/addresses";
import type { Actor } from "@/lib/publish/types";
import { DESTINATION_HREF } from "../_shell/destinations";
import {
  CLAIM_FIELD,
  NOTIFY_KIND_FIELD,
  NOTIFY_ON_FIELD,
  ON,
  PUBLISHING_ENABLED_FIELD,
  PUBLISH_TIME_FIELD,
  TIME_ZONE_FIELD,
  VETO_HOURS_FIELD,
  type SettingAnswer,
} from "./panel-state";

/** The signed-in account, or §4.3's refusal. */
async function actor(): Promise<{ siteId: string; userId: string; by: Actor }> {
  const { appAccount } = await import("../_session/account");
  const account = await appAccount();
  if (!account.ok) redirect(SIGNIN_PATH);
  return {
    siteId: account.account.siteId,
    userId: account.account.userId,
    by: { kind: "customer", userId: account.account.userId },
  };
}

/** One field, as a string. A missing or file-valued field reads as the
 *  empty string and is refused by the engine like any other value that is
 *  not a setting — never guessed at. */
function typed(form: FormData, field: string): string {
  const raw = form.get(field);
  return typeof raw === "string" ? raw : "";
}

/** The screen re-reads, so every card states the stored value rather than
 *  a client-side belief about it. The shell is revalidated too: the side
 *  panel names the autopilot state, and the publishing switch is what that
 *  sentence is about. */
function saved(effect: "now" | "next-page"): SettingAnswer {
  revalidatePath(DESTINATION_HREF.settings);
  revalidatePath("/app", "layout");
  return { answer: "saved", effect };
}

const REFUSED: SettingAnswer = { answer: "refused" };

/**
 * REQ-070 c1's veto window — §4.7's stepper, in whole days.
 *
 * The number arrives in **hours**, because hours is what the column
 * stores and what the validator speaks; the panel converts with
 * `vetoHoursFromDays`, which is the one place that arithmetic exists. A
 * value outside 1–7 days, or one that is not whole days, is refused by
 * `savePublishingSettings` and nothing is written — including the three
 * settings the patch does not name, because that writer refuses a patch
 * whole.
 */
export async function saveVetoHoursAction(form: FormData): Promise<SettingAnswer> {
  const hours = Number(typed(form, VETO_HOURS_FIELD));
  if (!Number.isFinite(hours)) return REFUSED;
  const { siteId, by } = await actor();
  const { savePublishingSettings } = await import("@/lib/publish/settings");
  const result = await savePublishingSettings(siteId, { vetoHours: hours }, by);
  // A saved window re-deadlines every page not yet published, there and
  // then (the writer's own rule) — so it takes effect straight away, and
  // a page whose governing pair changed is told again.
  return result.ok ? saved("now") : REFUSED;
}

/** REQ-070 c1's publish time, `HH:mm` in the site's own zone. */
export async function savePublishTimeAction(form: FormData): Promise<SettingAnswer> {
  const { siteId, by } = await actor();
  const { savePublishingSettings } = await import("@/lib/publish/settings");
  const result = await savePublishingSettings(siteId, { publishTime: typed(form, PUBLISH_TIME_FIELD) }, by);
  // The one setting here that does not bite at once: today's queue was
  // decided against the old time, and the new one is what the next page
  // goes out at.
  return result.ok ? saved("next-page") : REFUSED;
}

/** REQ-070 c1's time zone — an IANA name the runtime can resolve, and no
 *  second list of zones to fall out of date (`isResolvableZone`). */
export async function saveTimeZoneAction(form: FormData): Promise<SettingAnswer> {
  const { siteId, by } = await actor();
  const { savePublishingSettings } = await import("@/lib/publish/settings");
  const result = await savePublishingSettings(siteId, { timezone: typed(form, TIME_ZONE_FIELD) }, by);
  return result.ok ? saved("now") : REFUSED;
}

/**
 * REQ-070 c1's publishing switch — §9's "whether pages publish at all".
 *
 * `setPublishing` moves no page and takes no transition: every publish
 * attempt reads the column, so recording the switch is the entire act.
 * That is why this answers "straight away" — there is no queue to drain
 * before it is true.
 */
export async function setPublishingAction(form: FormData): Promise<SettingAnswer> {
  const on = typed(form, PUBLISHING_ENABLED_FIELD) === ON;
  const { siteId, by } = await actor();
  const { setPublishing } = await import("@/lib/publish/switch");
  try {
    await setPublishing(siteId, on, by);
  } catch {
    return REFUSED;
  }
  return saved("now");
}

/**
 * §4.7's three mail switches — one stoppable mail each (ADR-042: they
 * never touch address-wide suppression).
 *
 * The kind is checked against the register rather than trusted: this is an
 * addressable endpoint, and a kind outside `TOGGLABLE_KINDS` is a mail the
 * customer may not stop — the sign-in mail among them.
 */
export async function setNotificationAction(form: FormData): Promise<SettingAnswer> {
  const kind = typed(form, NOTIFY_KIND_FIELD);
  const on = typed(form, NOTIFY_ON_FIELD) === ON;
  const { userId } = await actor();
  const { TOGGLABLE_KINDS, setNotifyPref } = await import("@/lib/mail/notifications");
  const togglable = TOGGLABLE_KINDS.find((candidate) => candidate === kind);
  if (togglable === undefined) return REFUSED;
  try {
    await setNotifyPref({ userId, kind: togglable, on });
  } catch {
    return REFUSED;
  }
  return saved("now");
}

/**
 * REQ-053's never-claim list — one entry added, or one taken out.
 *
 * **The list is read here, not sent here**, for the reason the rival set
 * is (`./change-actions.ts`): a list from the browser is a list a browser
 * can rewrite, and `saveDoNotClaim` writes whatever it is given. The
 * stored list is read, the entry is added to or removed from it, and that
 * is what is written.
 *
 * `saveDoNotClaim` is the product's **one** writer of the column, and it
 * re-checks every page the change affects in the same call — which is why
 * neither of these two goes near the column itself.
 */
async function writeClaims(change: (stored: readonly string[]) => readonly string[]): Promise<SettingAnswer> {
  const { siteId } = await actor();
  const { generateStore } = await import("@/lib/generate/store");
  const facts = await generateStore().siteFacts(siteId);
  if (facts === null) return REFUSED;
  // The scan every ledger row the re-check writes is keyed to. A site with
  // no current scan has no page written from it to re-check, and the
  // writer takes `null` for exactly that case.
  const { measuredAnswers } = await import("@/lib/market/changes");
  const measured = await measuredAnswers(siteId);
  const { saveDoNotClaim } = await import("@/lib/generate/claims/save");
  try {
    await saveDoNotClaim({
      siteId,
      entries: change(facts.doNotClaim),
      scanId: measured === null ? null : measured.scanId,
    });
  } catch {
    return REFUSED;
  }
  return saved("now");
}

export async function addClaimAction(form: FormData): Promise<SettingAnswer> {
  const entry = typed(form, CLAIM_FIELD).trim();
  // An empty entry is not a claim, and `normaliseClaimList` would drop it
  // silently — which would look exactly like a save that worked.
  if (entry === "") return REFUSED;
  return writeClaims((stored) => [...stored, entry]);
}

export async function removeClaimAction(form: FormData): Promise<SettingAnswer> {
  const entry = typed(form, CLAIM_FIELD);
  return writeClaims((stored) => stored.filter((claim) => claim !== entry));
}
