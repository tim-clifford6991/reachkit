// BUILD §4.7 — the Server Functions behind the three answers with teeth.
//
// REQ-071's market and competitors cards change what the site is measured
// as. Every rule about what such a change *is* — that a save writes the
// declared answer and nothing else, that its effect falls at the first
// weekly re-measurement that begins after it, that the effective date is
// recomputed after the write, and which values are refused — belongs to
// `@/lib/market/changes` and `@/lib/market/setup/rivals` and is not
// restated here. This file reads a form field, names the account, calls
// the seam, and hands back what the seam answered (`ARCHITECTURE.md`
// rule 1).
//
// **A `"use server"` module may export only async functions**, so the
// state these four hand back, the fields' wire names and the two refusal
// maps live in `./market-state`, where the panels can name them too.
//
// **One argument, and it is the form.** Not `useActionState`'s
// `(previous, form)` pair, which `../account-actions.ts` takes: these four
// answer with a date the card states the moment it comes back, and the
// panel holds that answer itself so that pressing Edit again is a fresh
// question rather than a form still showing the last one. One argument is
// also the site-id guarantee stated as a signature — there is one
// parameter, it is a `FormData`, and the only names read out of it are the
// three wire names below.
//
// **Which account.** The session's, through `_session/account.ts` — never a
// value the browser sent. A Server Function is an addressable endpoint: a
// site id in the request would let any signed-in customer rewrite another
// account's answers, so no field here names one and none is read.
//
// **The rival set is read here, not sent here.** These take one typed
// domain, never the set: a set from the browser is a set a browser can
// rewrite, and `saveRivals` writes whatever it is given. The stored
// answers are read, the engine's own `addRival` / `removeRival` decides
// what the set becomes, and that is what is written — which is also the
// only way `already_present` and `set_full` can be decided against the
// truth rather than against a stale render.
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

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SIGNIN_PATH } from "@/lib/account/identity/addresses";
import type { RivalSet } from "@/lib/market/setup/rivals";
import { DESTINATION_HREF } from "../_shell/destinations";
import { VOICE_FIELD } from "./voice-state";
import {
  DOMAIN_REFUSAL_KEY,
  MARKET_CATEGORY_FIELD,
  MARKET_DOMAIN_FIELD,
  RIVAL_FIELD,
  RIVAL_REFUSAL_KEY,
  type MarketChangeState,
} from "./market-state";

async function siteId(): Promise<string> {
  const { appAccount } = await import("../_session/account");
  const account = await appAccount();
  if (!account.ok) redirect(SIGNIN_PATH);
  return account.account.siteId;
}

/** The one field each form carries, as a string. A missing or file-valued
 *  field reads as the empty string and is refused by the engine like any
 *  other value that is not a domain — never guessed at. */
function typed(form: FormData, field: string): string {
  const raw = form.get(field);
  return typeof raw === "string" ? raw : "";
}

/** What a save answers with. The date is written after the write (the
 *  engine's rule), so the screen states the date this press earned. The
 *  screen is revalidated so the card re-reads the declared answers rather
 *  than believing a client-side guess at them. */
function saved(effectiveOn: Date): MarketChangeState {
  revalidatePath(DESTINATION_HREF.settings);
  // An ISO instant rather than a `Date`: a Server Function's return
  // crosses to the browser, and the screen states the day in the
  // customer's own zone with the one formatter the rest of it uses.
  return { answer: "saved", effectiveOn: effectiveOn.toISOString() };
}

/** REQ-071 c6 and c9 — the domain the site is measured and published under.
 *  Refused where the product cannot reach it, and then nothing is written. */
export async function saveDomainAction(form: FormData): Promise<MarketChangeState> {
  const value = typed(form, MARKET_DOMAIN_FIELD);
  const { saveDomain } = await import("@/lib/market/changes");
  const result = await saveDomain({ siteId: await siteId(), domain: value });
  return result.ok
    ? saved(result.effectiveOn)
    : { answer: "refused", lineKey: DOMAIN_REFUSAL_KEY[result.because], value };
}

/** REQ-071 c1 and c7 — the market the site is measured in.
 *
 *  No refusal, and none is invented: any word a customer uses for their
 *  market is a market somebody is searched for in, and `saveCategory`
 *  answers `SaveOk` alone. A validator here would be this screen deciding
 *  something the engine deliberately does not. */
export async function saveCategoryAction(form: FormData): Promise<MarketChangeState> {
  const { saveCategory } = await import("@/lib/market/changes");
  const result = await saveCategory({
    siteId: await siteId(),
    category: typed(form, MARKET_CATEGORY_FIELD),
  });
  return saved(result.effectiveOn);
}

/**
 * SPEC.md §5 (2026-09-12) — "the same voice summary is editable in
 * settings, and the stored text is what drafting reads".
 *
 * It writes `sites.voice_text`, which is already `DraftPromptInputs`'s
 * `voiceText` — so there is one stored voice, one field, and no second
 * source of truth for a draft to disagree with. The leaf's writer stamps
 * the edit, which is what keeps a weekly refresh from overwriting it.
 *
 * **No refusal, and none is invented**: any words a customer uses for how
 * their own pages should sound are words they may use. It answers nothing
 * for the card to state beyond the revalidated read — the same posture
 * `saveCategoryAction` takes towards a market nobody may refuse.
 *
 * The leaf is imported at the call, like every engine this module
 * reaches: it touches `@/lib/db`, and merely rendering Settings must not
 * need a database.
 */
export async function saveVoiceAction(form: FormData): Promise<void> {
  const { saveVoiceText } = await import("@/lib/site-profile");
  await saveVoiceText({ siteId: await siteId(), text: typed(form, VOICE_FIELD) });
  revalidatePath(DESTINATION_HREF.settings);
}

/** The stored set, as the editing type. Every domain reads back `typed`:
 *  `sites.competitors` carries no origin, and origin is setup's fact —
 *  REQ-026 c12's suggestion-clearing on a domain change — not a settings
 *  one. A rival added here was typed here, so nothing is invented by
 *  saying so. */
function editable(rivals: readonly string[]): RivalSet {
  return rivals.map((domain) => ({ domain, origin: "typed" as const }));
}

/**
 * REQ-071 c2, c3, c4 and c8 — one rival added to the set.
 *
 * The rules are `setup/rivals.ts`'s, which REQ-071 c4 says are the same
 * rules. `addRival` decides, in its own refusal order, and this supplies
 * the three facts it asks for: the canonical form of what was typed, the
 * account's own domain to compare it against, and whether it resolves.
 *
 * The resolver runs for every value that is a domain at all, including one
 * the engine will refuse for a different reason. Asking DNS only for the
 * values that need it would mean deciding the refusal order out here — and
 * the order is deliberate and asserted in `setup/rivals.ts`, which is the
 * one place it may be decided.
 */
export async function addRivalAction(form: FormData): Promise<MarketChangeState> {
  const value = typed(form, RIVAL_FIELD);
  const site = await siteId();

  const { declaredAnswers, saveRivals } = await import("@/lib/market/changes");
  const { registrableDomain } = await import("@/lib/market/rivals/domains");
  const { addRival } = await import("@/lib/market/setup/rivals");
  const { resolvesInDns } = await import("@/lib/egress/dns");

  const answers = await declaredAnswers(site);
  const domain = registrableDomain(value);
  const added = addRival(editable(answers.rivals), {
    domain,
    origin: "typed",
    ownDomain: registrableDomain(answers.domain),
    resolves: domain === null ? false : await resolvesInDns(domain),
  });
  if (!added.ok) return { answer: "refused", lineKey: RIVAL_REFUSAL_KEY[added.because], value };

  const result = await saveRivals({ siteId: site, rivals: added.set });
  return saved(result.effectiveOn);
}

/**
 * REQ-071 c2 and c16 — one rival taken out of the set.
 *
 * `removeRival` cannot refuse: a domain that is not in the set answers the
 * set unchanged, which is what pressing Remove twice is. **An empty set is
 * saved like any other** (c16) — the account goes on running with none,
 * and the card says no comparison will be shown until one is added.
 */
export async function removeRivalAction(form: FormData): Promise<MarketChangeState> {
  const site = await siteId();
  const { declaredAnswers, saveRivals } = await import("@/lib/market/changes");
  const { removeRival } = await import("@/lib/market/setup/rivals");

  const answers = await declaredAnswers(site);
  const result = await saveRivals({
    siteId: site,
    rivals: removeRival(editable(answers.rivals), typed(form, RIVAL_FIELD)),
  });
  return saved(result.effectiveOn);
}
