// Issue #926 — the five things a customer may do to their business profile.
//
// Remove an item, add one, reword what the business does, switch a quotable
// fact off, switch it back on. Each is a Server Function, each reads the
// stored decisions, changes one of them and writes the row back — the
// read-modify-write shape `./panel-actions.ts`'s `writeClaims` already uses
// for the do-not-claim list, and for the same reason: the list is the unit
// the database holds, so a change to one member is a write of the list.
//
// **Every one of them records what the customer has seen.** That is what
// makes #926's "the refresh may only add new findings as suggestions" true:
// they are looking at the screen as they press, so everything on it has been
// in front of them, and only what a later pass finds is new.
// `seenNow` takes that list off the same derived reading the screen drew.
//
// **`revalidatePath` on the tab, and nothing wider.** The decision changes
// this one screen; the rest of Settings and the Overview read nothing that
// moved.
//
// SPEC §4 (2026-09-20): "Every action answers." Each returns the same three
// arms `SettingAnswer` already carries, so the panel says *saved* or *not
// saved* in words rather than leaving the customer to compare lists.
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SIGNIN_PATH } from "@/lib/account/identity/addresses";
import { BUSINESS_LISTS, type BusinessEdits, type BusinessList } from "@/lib/site-profile/business/types";
import { SETTINGS_TAB_HREF } from "./tabs";
import { type SettingAnswer } from "./panel-state";

/** The native `name`s the forms carry. Internal (rule 1.1), not sentences. */
export const BUSINESS_LIST_FIELD = "business_list";
export const BUSINESS_ITEM_FIELD = "business_item";
export const BUSINESS_JOB_FIELD = "business_job";
export const BUSINESS_FACT_FIELD = "business_fact";

const REFUSED: SettingAnswer = { answer: "refused" };

function typed(form: FormData, field: string): string {
  const value = form.get(field);
  return typeof value === "string" ? value : "";
}

/** The field a form names, or `undefined` where it named nothing in the
 *  tuple. A form that arrives with a seventh list name is refused rather
 *  than written under a key nothing reads. */
function listOf(form: FormData): BusinessList | undefined {
  const named = typed(form, BUSINESS_LIST_FIELD);
  return BUSINESS_LISTS.find((list) => list === named);
}

/**
 * Read the decisions, change them, write them back — with the derived
 * reading recorded as seen.
 *
 * The account is resolved here and not passed in: a Server Function is a
 * public entry point, and the site it writes to must come from the session
 * rather than from the form. A request with no session is sent to sign-in,
 * the same road every other `(account)` write takes.
 */
async function write(change: (stored: BusinessEdits) => BusinessEdits): Promise<SettingAnswer> {
  const { appAccount } = await import("../_session/account");
  const resolved = await appAccount();
  if (!resolved.ok) redirect(SIGNIN_PATH);
  const account = resolved.account;

  try {
    const { readBusinessEdits, writeBusinessEdits } = await import(
      "@/lib/site-profile/business/edits"
    );
    const { seenNow } = await import("@/lib/site-profile/business/confirm");
    const { readBusinessFacts } = await import("./business-store");

    const facts = await readBusinessFacts(account);
    const stored = await readBusinessEdits(account.siteId);
    await writeBusinessEdits({
      siteId: account.siteId,
      edits: change(stored),
      seen: seenNow({ profile: facts.profile, market: facts.market }),
    });
  } catch {
    return REFUSED;
  }

  revalidatePath(SETTINGS_TAB_HREF.business);
  // `now`: the next page ReachKit writes is written from what is on this
  // screen, and the screen itself already shows the change. `next-page`
  // would be a promise about a later moment, which is not what happened.
  return { answer: "saved", effect: "now" };
}

/** Adds to one of the per-field lists, without duplicating. */
function withEntry(
  stored: Readonly<Partial<Record<BusinessList, readonly string[]>>>,
  list: BusinessList,
  entry: string
): Partial<Record<BusinessList, readonly string[]>> {
  const current = stored[list] ?? [];
  const already = current.some((value) => value.toLocaleLowerCase() === entry.toLocaleLowerCase());
  return { ...stored, [list]: already ? current : [...current, entry] };
}

/** Takes out of one of the per-field lists. */
function withoutEntry(
  stored: Readonly<Partial<Record<BusinessList, readonly string[]>>>,
  list: BusinessList,
  entry: string
): Partial<Record<BusinessList, readonly string[]>> {
  const current = stored[list] ?? [];
  return {
    ...stored,
    [list]: current.filter((value) => value.toLocaleLowerCase() !== entry.toLocaleLowerCase()),
  };
}

/**
 * Removes an item.
 *
 * **Both halves, because an item may be either kind.** A derived item is
 * removed by recording the decision; one the customer added is removed by
 * dropping it from their own list. Doing only the first would leave an added
 * item on screen with a remove control that did nothing; doing only the
 * second would let Monday's refresh bring a derived item back.
 */
export async function removeBusinessItemAction(form: FormData): Promise<SettingAnswer> {
  const list = listOf(form);
  const entry = typed(form, BUSINESS_ITEM_FIELD).trim();
  if (list === undefined || entry === "") return REFUSED;
  return write((stored) => ({
    ...stored,
    removed: withEntry(stored.removed, list, entry),
    added: withoutEntry(stored.added, list, entry),
  }));
}

/**
 * Adds an item.
 *
 * It also clears any standing removal of the same text: a customer who took
 * something out and types it back in means to have it, and leaving the
 * removal in place would make their own addition invisible.
 */
export async function addBusinessItemAction(form: FormData): Promise<SettingAnswer> {
  const list = listOf(form);
  const entry = typed(form, BUSINESS_ITEM_FIELD).trim();
  // An empty entry is not an item, and storing it would put a row with a
  // remove control on it and no text — which reads as a bug, not as a save.
  if (list === undefined || entry === "") return REFUSED;
  return write((stored) => ({
    ...stored,
    added: withEntry(stored.added, list, entry),
    removed: withoutEntry(stored.removed, list, entry),
  }));
}

/**
 * Rewords what the business does.
 *
 * An empty submission clears the customer's wording rather than storing a
 * blank sentence, so the derived reading comes back — which is the only way
 * back to it, and is what a customer emptying the field is asking for.
 */
export async function rewordBusinessJobAction(form: FormData): Promise<SettingAnswer> {
  const entry = typed(form, BUSINESS_JOB_FIELD).trim();
  return write((stored) => ({ ...stored, job: entry === "" ? null : entry }));
}

/** Switches a quotable fact off — ReachKit may no longer quote it. */
export async function switchFactOffAction(form: FormData): Promise<SettingAnswer> {
  const passage = typed(form, BUSINESS_FACT_FIELD);
  if (passage === "") return REFUSED;
  return write((stored) =>
    stored.factsOff.includes(passage)
      ? stored
      : { ...stored, factsOff: [...stored.factsOff, passage] }
  );
}

/** Switches one back on. */
export async function switchFactOnAction(form: FormData): Promise<SettingAnswer> {
  const passage = typed(form, BUSINESS_FACT_FIELD);
  if (passage === "") return REFUSED;
  return write((stored) => ({
    ...stored,
    factsOff: stored.factsOff.filter((entry) => entry !== passage),
  }));
}
