// BUILD §4.2 — one insert, confirmed only after it commits; the argument type admits an email address and nothing else.
// Fails closed (REQ-003 c10), unlike the scan limiter: telling a founder their address was taken when it was not costs them the page.
// No model or queue on the visitor's request; the page is written in the job. The one vendor call is the stored report's mail (SPEC §8).
// Read ADR-041 before adding a suppression check: a suppressed address still gets a new domain's page, via `stoppable: false`.
import { takeLimits } from "@/lib/limits";
import type { NetworkKey } from "@/lib/scan/admission";
import { mailReport } from "./report";
import { leadStore } from "./store";
import { normaliseAddress } from "./suppress";

/** Form only: one `@`, a dot in the domain, no whitespace. Deliverability is the send's question; anything stricter refuses real addresses. */
export const ADDRESS_FORM = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export type CaptureResult =
  | { captured: true; leadId: string }
  | { captured: false; reason: "invalid-address" | "unavailable" | "limited" };

/** `network` is the request's hashed client address, never a field the visitor sends. */
export async function captureLead(a: {
  scanId: string;
  email: string;
  network: NetworkKey;
}): Promise<CaptureResult> {
  const email = normaliseAddress(a.email);
  if (!ADDRESS_FORM.test(email)) return { captured: false, reason: "invalid-address" };

  // Counted before the scan read, so an unknown scan id costs the same as a known one and a flood mails nobody.
  // Postgres reads any case, braces and hyphens of a uuid as one scan, so the cap counts its hex digits alone.
  const scanKey = a.scanId.toLowerCase().replace(/[^0-9a-f]/g, "");
  if (!(await takeLimits("lead", { network: a.network, email, scanId: scanKey }))) {
    return { captured: false, reason: "limited" };
  }

  const store = leadStore();

  // The domain is written onto the lead and read-only after: the sequence's natural key is `(lower(email), domain)`,
  // and a unique index cannot reach through `scan_id` to `scans.domain`.
  const scan = await store.scanDomain(a.scanId);
  if (!scan.ok || scan.domain === null) {
    // Unreadable and missing scans are both `unavailable` to the visitor; the logged cause keeps them apart for us.
    console.warn(
      JSON.stringify({
        event: "lead_capture_refused",
        cause: scan.ok ? "scan-absent" : "scan-unreadable",
        scanId: a.scanId,
      })
    );
    return { captured: false, reason: "unavailable" };
  }

  // Read before this lead's row exists: an earlier lead for the address on this scan has had its report mail.
  const earlier = await store.leadsForAddress(email);
  const firstForScan = earlier.ok && !earlier.leads.some((lead) => lead.scan_id.toLowerCase() === a.scanId.toLowerCase());

  const inserted = await store.insertLead({
    scanId: a.scanId,
    email,
    domain: scan.domain.toLowerCase(),
  });
  if (!inserted.ok) {
    console.warn(JSON.stringify({ event: "lead_capture_refused", cause: "insert-failed" }));
    return { captured: false, reason: "unavailable" };
  }

  // A report mail that does not go is logged by the seam and never refuses the lead.
  if (firstForScan) await mailReport({ scanId: a.scanId, email, period: scanKey });

  // Last statement in the function, and after the write: the row exists.
  return { captured: true, leadId: inserted.id };
}
