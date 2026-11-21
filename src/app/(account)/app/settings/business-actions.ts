// Issue #926 — the five things a customer may do to their business profile.
//
// Save a list, reword what the business does, switch a quotable
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
// this one screen (a fact's, the page detail that draws it); the rest of
// Settings and the Overview read nothing that moved.
//
// SPEC §4 (2026-09-20): "Every action answers." Each returns the same three
// arms `SettingAnswer` already carries, so the panel says *saved* or *not
// saved* in words rather than leaving the customer to compare lists.
//
// **This file exports async functions and nothing else**, which is not a
// style but the rule: a `"use server"` module may export only those, and a
// constant beside them fails `next build` with "Only async functions are
// allowed to be exported in a `use server` file" — and then once per form
// that imported it. The four wire names are in `./panel-state.ts` with the
// rest of the screen's, which is the reason that file exists.
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SIGNIN_PATH } from "@/lib/account/identity/addresses";
import { BUSINESS_LISTS, type BusinessEdits, type BusinessList } from "@/lib/site-profile/business/types";
import { SETTINGS_TAB_HREF } from "./tabs";
import { FOUNDER_QUESTIONS, founderAnswers } from "@/lib/site-profile/knowledge/types";
import {
  BUSINESS_FACT_FIELD,
  BUSINESS_ITEM_FIELD,
  BUSINESS_ANSWER_FIELD,
  BUSINESS_JOB_FIELD,
  BUSINESS_LIST_FIELD,
  BUSINESS_REMOVED_FIELD,
  type SettingAnswer,
} from "./panel-state";

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
  const { appAccountForWrite } = await import("../_session/account");
  const resolved = await appAccountForWrite();
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
 * Saves one list as a dialog left it: every item taken out and every one added, in one write.
 *
 * A derived item is removed by recording the decision and one the customer added by dropping it from their own
 * list, so Monday's refresh cannot bring it back. An addition clears a standing removal of the same text: a
 * customer who types it back in means to have it.
 */
export async function saveBusinessListAction(form: FormData): Promise<SettingAnswer> {
  const list = listOf(form);
  const entries = (field: string): string[] =>
    form.getAll(field).map((value) => (typeof value === "string" ? value.trim() : "")).filter((value) => value !== "");
  const removed = entries(BUSINESS_REMOVED_FIELD);
  const added = entries(BUSINESS_ITEM_FIELD);
  if (list === undefined) return REFUSED;
  return write((stored) => {
    let next = stored;
    for (const entry of removed) {
      next = { ...next, removed: withEntry(next.removed, list, entry), added: withoutEntry(next.added, list, entry) };
    }
    for (const entry of added) {
      next = { ...next, added: withEntry(next.added, list, entry), removed: withoutEntry(next.removed, list, entry) };
    }
    return next;
  });
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

/**
 * Saves the five answers as the form left them (#1133). An emptied field
 * clears its answer; none of them is required.
 */
export async function saveFounderAnswersAction(form: FormData): Promise<SettingAnswer> {
  const answers = founderAnswers(
    Object.fromEntries(
      FOUNDER_QUESTIONS.map((question) => [question, typed(form, `${BUSINESS_ANSWER_FIELD}${question}`)])
    )
  );
  return write((stored) => ({ ...stored, answers }));
}

/** The live page's detail, where the facts card is drawn. */
const PAGE_DETAIL = "/app/draft/[draftId]";

/** Switches a quotable fact off — ReachKit may no longer quote it. */
export async function switchFactOffAction(form: FormData): Promise<SettingAnswer> {
  const passage = typed(form, BUSINESS_FACT_FIELD);
  if (passage === "") return REFUSED;
  const answer = await write((stored) =>
    stored.factsOff.includes(passage)
      ? stored
      : { ...stored, factsOff: [...stored.factsOff, passage] }
  );
  revalidatePath(PAGE_DETAIL, "page");
  return answer;
}

/** Switches one back on. */
export async function switchFactOnAction(form: FormData): Promise<SettingAnswer> {
  const passage = typed(form, BUSINESS_FACT_FIELD);
  if (passage === "") return REFUSED;
  const answer = await write((stored) => ({
    ...stored,
    factsOff: stored.factsOff.filter((entry) => entry !== passage),
  }));
  revalidatePath(PAGE_DETAIL, "page");
  return answer;
}
