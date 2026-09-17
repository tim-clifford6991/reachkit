// SPEC §5 — where the founder's DNS is managed, for the line beside the
// CNAME record on `/setup` and in Settings (issue 760; owner ruling
// 2026-09-16).
//
// One Server Function for both screens, as `check-actions.ts` is: the record
// block asks it once the record is on screen, and draws the static line until
// it answers.
//
// **The domain is never the browser's.** The lookup is on the zone of the
// site's own stored address. The browser names the address its record sits
// under, and that is only compared with the stored one: an address changed
// on screen and not yet submitted is not one the server knows as theirs, and
// is answered `unknown` — the static line — rather than looked up.
//
// Nothing here may fail the block: no session, no site, an unparseable
// address, a lookup that fails or hangs past its bound — each is `unknown`.
//
// **Imports are at the call, not at the top**, for the reason
// `check-actions.ts` gives: this module is imported statically by a client
// component, and the setup store reaches `@/lib/db`.
"use server";

import type { DnsWhere } from "@/lib/publish/destinations/hosted/dns-provider";

export async function whereDnsIs(a: {
  /** The site address the record on screen sits under. */
  domain: string;
}): Promise<DnsWhere> {
  const unknown: DnsWhere = { kind: "unknown" };
  try {
    const { currentSession } = await import("@/lib/account/identity");
    const session = await currentSession();
    if (session === null) return unknown;

    const { siteAddressFor } = await import("../setup/_setup/store");
    const site = await siteAddressFor(session.userId);
    const own = site?.domain.trim().toLowerCase() ?? "";
    if (own === "" || a.domain.trim().toLowerCase() !== own) return unknown;

    const { dnsZoneOf, dnsWhereFrom } = await import("@/lib/publish/destinations/hosted/dns-provider");
    const zone = dnsZoneOf(own);
    if (zone === null) return unknown;

    const { nameserversOf } = await import("@/lib/egress");
    return dnsWhereFrom(await nameserversOf(zone));
  } catch {
    return unknown;
  }
}
