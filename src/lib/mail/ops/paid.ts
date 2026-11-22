// The owner's paid mail: who paid, their first-50 spot, and the founder work the offer card promised them, with its due dates.
// Never throws: provisioning has finished before this runs, and a mail that fails must not undo or retry it.
import { founderDates, OFFER_BOOKING_URL, OFFER_CHECKIN_DAYS, OFFER_SPOTS } from "@/lib/config/constants";
import { env } from "@/lib/config/env";
import { spotOf } from "@/lib/account/offer/spots";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { FactRow, MailBlock } from "../blocks/types";
import { sendEmail } from "../send";

const SUBJECT = "ops.paid.subject" satisfies CopyKey;
const HEADING = "ops.paid.heading" satisfies CopyKey;
const SPOT = "ops.paid.spot" satisfies CopyKey;
const NO_SPOT = "ops.paid.no-spot" satisfies CopyKey;

/** A UTC day as the owner reads it: "Sat 7 Nov 2026". */
const day = (at: Date): string =>
  at.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function buildPaidMail(domain: string | null, spot: { place: number; takenAt: Date } | null): readonly MailBlock[] {
  const site = domain ?? copy("ops.paid.no-domain");
  if (spot === null) return [{ block: "heading", text: HEADING }, { block: "paragraph", text: NO_SPOT, vars: { domain: site } }];
  const dates = founderDates(spot.takenAt);
  const items: FactRow[] = [
    { label: "ops.paid.fact.call", value: OFFER_BOOKING_URL || copy("ops.paid.call.no-link") },
    { label: "ops.paid.fact.video", value: day(dates.video) },
    ...dates.checkIns.map((at, i): FactRow => ({ label: "ops.paid.fact.check-in", labelVars: { days: OFFER_CHECKIN_DAYS[i] ?? 0 }, value: day(at) })),
  ];
  return [
    { block: "heading", text: HEADING },
    { block: "paragraph", text: SPOT, vars: { domain: site, place: spot.place, of: OFFER_SPOTS } },
    { block: "facts", items },
  ];
}

/** One mail per owner address; the caller sends it once, from the payment's first provisioning only. */
export async function reportPaid(a: { userId: string; domain: string | null }): Promise<void> {
  try {
    const blocks = buildPaidMail(a.domain, await spotOf(a.userId));
    for (const to of env.OWNER_EMAILS) {
      const result = await sendEmail({ kind: "ops", to, event: `paid/${a.userId}`, subject: SUBJECT, blocks }).catch(() => null);
      console.warn(JSON.stringify({ event: "ops_paid_mail", outcome: result === null ? "threw" : result.sent ? "sent" : result.reason }));
    }
  } catch (error) {
    console.warn(JSON.stringify({ event: "ops_paid_mail", outcome: "threw", detail: String(error) }));
  }
}
