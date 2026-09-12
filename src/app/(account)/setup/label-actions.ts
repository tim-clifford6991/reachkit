// SPEC §5 (2026-09-12) — the Server Function behind the subdomain field.
//
// §5 asks setup to refuse "an invalid or already-taken label in one written
// line". Half of that is a string question and is decided in the browser by
// `checkLabel`, which costs no round trip. The other half is a row: whether
// another site already serves at the host this label would compose.
//
// **A Server Function and not a route** (`destination-actions.ts`'s idiom).
// The question is about one account's own site, so the account is the
// session's and is never a value the browser sent — and a route would have
// been a new address on a surface whose addresses are enumerated. It reads
// two values, names the account, calls the seam, and hands back what the
// seam answered (`ARCHITECTURE.md` rule 1).
//
// **It composes no sentence and holds no rule of its own.** The answer is a
// `LabelRefusal` token from a closed union; which written line the founder
// reads is the screen's, chosen from the registry by that token. There is
// no member on the answer a message could travel in.
//
// **It is not the gate.** `POST /api/setup` asks both questions again,
// against the domain it has canonicalised, because an answer from a browser
// is not a fact. This exists so the founder finds out before they press the
// one control.
//
// **The engine is imported at the call, not at the top.** This module is
// imported statically by a client component — that is how a Server Function
// gets its reference — and the publishing seam reaches `@/lib/db`, which
// parses every environment binding the moment it is evaluated. Deferring it
// keeps merely *rendering* setup free of the database, the same way
// `change-actions.ts` and `destination-actions.ts` do.
"use server";

import { redirect } from "next/navigation";
import { SIGNIN_PATH } from "@/lib/account/identity/addresses";
import { checkLabel, hostFor, type LabelRefusal } from "@/lib/publish/destinations/hosted/label";
import { registrableDomain } from "@/lib/market/rivals/domains";

/** What the field learned. Three members, none of which can hold a
 *  sentence: the label as it would be written, the host it would compose,
 *  and which refusal — if any — the screen states. */
export interface LabelAnswer {
  label: string | null;
  hostname: string | null;
  refusal: LabelRefusal | null;
}

export async function checkSubdomainLabel(a: {
  label: string;
  /** The site address as the founder has typed it, or `null` before they
   *  have given one. */
  domain: string | null;
}): Promise<LabelAnswer> {
  const { currentSession } = await import("@/lib/account/identity");
  const session = await currentSession();
  if (session === null) redirect(SIGNIN_PATH);

  const checked = checkLabel(a.label);
  if (!checked.ok) return { label: null, hostname: null, refusal: checked.because };

  // No site address yet: the label is a label, and there is no host to ask
  // about. Answering "free" here would be a claim about a host nobody has
  // composed.
  const domain = a.domain === null ? null : registrableDomain(a.domain);
  if (domain === null) return { label: checked.label, hostname: null, refusal: null };

  const hostname = hostFor({ label: checked.label, domain });
  const { hostnameTaken } = await import("@/lib/publish/destinations/hosted/hostname");
  const { siteAddressFor } = await import("./_setup/store");
  const site = await siteAddressFor(session.userId);
  const taken = await hostnameTaken({
    hostname,
    // A founder re-reading their own setup screen must not be told their
    // own host belongs to somebody else.
    ...(site === null ? {} : { exceptSiteId: site.siteId }),
  });

  return { label: checked.label, hostname, refusal: taken ? "taken" : null };
}
