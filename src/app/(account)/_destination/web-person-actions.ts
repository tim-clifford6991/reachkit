// SPEC §5 — a signed-in buyer sends the connect steps to whoever runs their web address, from `/setup` and Settings.
// The host is only compared with the site's own address, as `check-actions.ts` does, so no account mails a record for
// somebody else's domain. The typed address goes to the vendor and nowhere else; the limiter keeps a hashed site count.
// Imports are at the call: a client component imports this module, and the store reaches `@/lib/db`.
"use server";

import { redirect } from "next/navigation";
import { SIGNIN_PATH } from "@/lib/account/identity/addresses";

export type WebPersonSend =
  | { outcome: "sent" }
  | { outcome: "refused"; because: "not_an_address" | "limited" | "no_host" }
  | { outcome: "failed" };

export async function sendToWebPerson(a: { host: string; to: string }): Promise<WebPersonSend> {
  const { accountCard, currentSession } = await import("@/lib/account/identity");
  const session = await currentSession();
  if (session === null) redirect(SIGNIN_PATH);

  const { ADDRESS_FORM } = await import("@/lib/mail/leads/capture");
  const to = a.to.trim();
  if (!ADDRESS_FORM.test(to)) return { outcome: "refused", because: "not_an_address" };

  const { siteAddressFor } = await import("../setup/_setup/store");
  const { hostFor } = await import("@/lib/publish/destinations/hosted/label");
  const { recordForHost } = await import("@/lib/publish/setup/cards");
  const { env } = await import("@/lib/config/env");
  const site = await siteAddressFor(session.userId);
  const domain = site?.domain.trim().toLowerCase() ?? "";
  const host = a.host.trim().toLowerCase();
  const record = recordForHost({ hostname: host, cnameTarget: env.HOSTED_EDGE_CNAME_TARGET });
  if (site === null || domain === "" || record === null || hostFor({ label: host.split(".")[0] ?? "", domain }) !== host) {
    return { outcome: "refused", because: "no_host" };
  }

  const buyer = await accountCard(session.userId);
  if (buyer === null) return { outcome: "failed" };

  const { takeLimits } = await import("@/lib/limits");
  if (!(await takeLimits("web_person", { site: site.siteId }))) return { outcome: "refused", because: "limited" };

  const { dnsWhereFrom, dnsZoneOf } = await import("@/lib/publish/destinations/hosted/dns-provider");
  const { guideView } = await import("@/lib/publish/destinations/hosted/dns-guide");
  const { nameserversOf } = await import("@/lib/egress");
  const zone = dnsZoneOf(domain) ?? domain;
  const where = dnsWhereFrom(await nameserversOf(zone).catch(() => null));

  const { buildWebPersonMail } = await import("@/lib/mail/templates/web-person");
  const { sendEmail } = await import("@/lib/mail/send");
  const mail = buildWebPersonMail({ domain, host, view: guideView({ record, where, zone }) });
  const sent = await sendEmail({ kind: "web-person", to, replyTo: buyer.email, ...mail });
  return sent.sent ? { outcome: "sent" } : { outcome: "failed" };
}
