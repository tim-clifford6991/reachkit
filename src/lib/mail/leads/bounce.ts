// The mail vendor's webhook: a hard bounce, a spam complaint or the vendor's own suppression of an address reaches the address-wide
// suppression store, so follow-up mail stops there, and the owner hears when the address is a paying account's.
// The signature is the whole trust boundary and is checked by the vendor's SDK over the bytes received; nothing is read before it.
import { Resend, type WebhookEventPayload } from "resend";
import { env } from "@/lib/config/env";
import { dbAdmin } from "@/lib/db";
import { sitesWithActiveAccess } from "@/lib/account/billing";
import { claimOwnerMail, releaseOwnerMail, reportIncident } from "../ops";
import { normaliseAddress, suppressAddress } from "./suppress";

export interface WebhookHeaders {
  id: string;
  timestamp: string;
  signature: string;
}

type Stop = { address: string; cause: "bounced" | "complained" };

/** `handled: false` is a refused signature or a store that could not be written, which the vendor retries. */
export async function handleMailWebhook(payload: string, headers: WebhookHeaders): Promise<{ handled: boolean }> {
  const secret = env.RESEND_WEBHOOK_SECRET;
  if (secret === undefined) return { handled: false };
  let event: WebhookEventPayload;
  try {
    event = new Resend(env.RESEND_API_KEY).webhooks.verify({ payload, headers, webhookSecret: secret });
  } catch {
    console.warn(JSON.stringify({ event: "mail_webhook", outcome: "bad-signature" }));
    return { handled: false };
  }

  const stops = stopsOf(event);
  for (const stop of stops) {
    const written = await suppressAddress(stop.address, stop.cause);
    if (!written.suppressed) return { handled: false };
    await tellOwnerIfPaying(stop, headers.id, event.created_at);
  }
  console.log(JSON.stringify({ event: "mail_webhook", type: event.type, stops: stops.length }));
  return { handled: true };
}

function stopsOf(event: WebhookEventPayload): Stop[] {
  switch (event.type) {
    case "email.bounced":
      // A transient bounce (a full inbox, a greylist) is not a dead address.
      return event.data.bounce.type === "Permanent" ? event.data.to.map((address) => ({ address, cause: "bounced" })) : [];
    case "email.complained":
      return event.data.to.map((address) => ({ address, cause: "complained" }));
    case "email.suppressed":
      return event.data.to.map((address) => ({ address, cause: "bounced" }));
    case "suppression.added":
      return [{ address: event.data.email, cause: event.data.origin === "complaint" ? "complained" : "bounced" }];
    default:
      return [];
  }
}

/** One owner mail per delivered event: the claim is keyed by the vendor's event id, so a redelivery tells nobody twice. */
async function tellOwnerIfPaying(stop: Stop, eventId: string, createdAt: string): Promise<void> {
  try {
    const domains = await payingDomainsOf(normaliseAddress(stop.address));
    if (domains.length === 0) return;
    const key = { jobId: "mail/stopped", errorName: eventId, day: createdAt.slice(0, 10) };
    if (!(await claimOwnerMail(key, new Date()))) return;
    const told = await reportIncident({ occasion: "mail-stopped", domains, cause: stop.cause }, eventId);
    if (!told) await releaseOwnerMail(key);
  } catch {
    // The stop is already written; a failed alert is logged and does not make the vendor redeliver.
    console.warn(JSON.stringify({ event: "mail_webhook", outcome: "owner-alert-failed" }));
  }
}

/** The domains of the account's sites that pay today, through the one access gate. */
async function payingDomainsOf(address: string): Promise<string[]> {
  const users = await dbAdmin().from("users").select("id").eq("email", address);
  if (users.error !== null) throw new Error(users.error.message);
  const ids = (users.data ?? []).map((row) => row.id);
  if (ids.length === 0) return [];
  const sites = await dbAdmin().from("sites").select("id, domain").in("user_id", ids);
  if (sites.error !== null) throw new Error(sites.error.message);
  const paying = await sitesWithActiveAccess((sites.data ?? []).map((site) => site.id));
  return (sites.data ?? []).filter((site) => paying.has(site.id)).map((site) => site.domain ?? "unknown");
}
