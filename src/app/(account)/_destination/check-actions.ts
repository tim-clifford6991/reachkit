// SPEC §5 — the founder's own "check connection" press, from `/setup` and
// from Settings (issue #757; owner ruling 2026-09-16).
//
// One Server Function for both screens, so the two cannot come to ask about
// different hosts or read one answer two ways (#754's lesson). It names the
// account, derives the host, and hands back what `checkHostnameNow` learned.
//
// **The host is never the browser's.** A signed-in account must not be able
// to attach an arbitrary host to our project. So:
//
//   * From Settings (`draft: null`) the host is the one the site's own live
//     hosted destination stores.
//   * From `/setup`, before any destination exists, the host is
//     `<label>.<the site's address as its row holds it>`. The browser sends
//     the label it typed and the address on screen; the label is checked by
//     `checkLabel`, and the address is only compared with the stored one. An
//     address the founder has changed on screen but not yet submitted is not
//     one the server knows as theirs, and is refused rather than asked about.
//   * A host another site already holds is refused as taken, before the
//     vendor is asked — its answer would be about somebody else's record.
//
// **What an abandoned check leaves behind.** A press attaches the host to the
// project's domain list, idempotently: pressing again for the same label
// reuses the one entry. A founder who checks a label and then submits a
// different one, or never submits, leaves that entry attached. Nothing here
// removes it: removing a domain from the project on the strength of a label
// typed on this screen could detach a host something else serves, and
// knowing which entries a press created needs a record this change does not
// add. The PR states the bound this puts on the project's domain list.
//
// **The engine is imported at the call, not at the top**, for the reason
// `label-actions.ts` gives: this module is imported statically by client
// components, and the publishing seam reaches `@/lib/db`.
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SIGNIN_PATH } from "@/lib/account/identity/addresses";
import { checkLabel, hostFor, type LabelRefusal } from "@/lib/publish/destinations/hosted/label";
import type { HostnameCheck } from "@/lib/publish/destinations/hosted/hostname";

/** The Settings route, redrawn when a press has written a destination's
 *  state. An internal route name, not a customer-visible string. */
const SETTINGS_PATH = "/app/settings";

/**
 * What a press answers. `HostnameCheck`'s three outcomes, plus the refusals
 * that stop a press before the vendor is asked:
 *
 *   * `not_a_label` / `taken` — §5's two label refusals, the same tokens the
 *     field's own check answers.
 *   * `address_unsaved` — the address on screen is not the site's own.
 *   * `no_host` — the account has no hosted destination to check.
 *
 * No member can hold a sentence; the screen chooses the line.
 */
export type ConnectionCheck =
  | HostnameCheck
  | { outcome: "refused"; because: LabelRefusal | "address_unsaved" | "no_host" };

export async function checkConnection(a: {
  /** What `/setup` shows before submit: the label typed and the address on
   *  screen. `null` from Settings, where the destination names its host. */
  draft: { label: string; domain: string | null } | null;
}): Promise<ConnectionCheck> {
  const { currentSession } = await import("@/lib/account/identity");
  const session = await currentSession();
  if (session === null) redirect(SIGNIN_PATH);

  const { siteAddressFor } = await import("../setup/_setup/store");
  const { checkHostnameNow, hostedDestinationOf, hostnameTakenStrict } = await import(
    "@/lib/publish/destinations/hosted/hostname"
  );
  const site = await siteAddressFor(session.userId);
  if (site === null) return { outcome: "refused", because: "no_host" };
  const destination = await hostedDestinationOf(site.siteId);

  if (a.draft === null) {
    if (destination === null) return { outcome: "refused", because: "no_host" };
    const checked = await checkHostnameNow({
      siteId: site.siteId,
      hostname: destination.hostname,
      destinationId: destination.id,
    });
    // The press wrote the row's state: the card is redrawn from it.
    if (checked.outcome !== "too_soon") revalidatePath(SETTINGS_PATH);
    return checked;
  }

  const label = checkLabel(a.draft.label);
  if (!label.ok) return { outcome: "refused", because: label.because };
  // The record on screen is `dnsRecordFor()`'s, composed from the address
  // as the screen holds it — the stored one, unless the founder changed it.
  const own = site.domain.trim().toLowerCase();
  const onScreen = a.draft.domain?.trim().toLowerCase() ?? null;
  if (own === "" || onScreen !== own) {
    return { outcome: "refused", because: "address_unsaved" };
  }

  const hostname = hostFor({ label: label.label, domain: own });
  let taken: boolean;
  try {
    taken = await hostnameTakenStrict({ hostname, exceptSiteId: site.siteId });
  } catch {
    // A read that could not answer is not a free host, and asking the
    // vendor about a host that may be somebody else's is not a check of
    // this founder's record. Nothing was asked.
    return { outcome: "could_not_ask" };
  }
  if (taken) return { outcome: "refused", because: "taken" };

  return checkHostnameNow({
    siteId: site.siteId,
    hostname,
    // A founder back on `/setup` whose destination already holds this host
    // has the answer recorded on it too.
    destinationId: destination?.hostname === hostname ? destination.id : null,
  });
}
