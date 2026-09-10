// BUILD §12 · §15 — the one Resend request, carrying both bodies.
//
// One request per send, both bodies inside it, so the plain-text
// alternative is a property of the request rather than of a second send
// that could be forgotten. **Nothing here throws:** every failure — a
// refused socket, a timeout, a 4xx, an unreadable response — becomes a
// `VendorResult`, because a mail that cannot be sent must never take down
// the job that was sending it.
//
// Not `safeFetch()`. BP-006's guard exists for URLs a *customer* or a
// dataset supplied — it resolves, checks the address against a policy and
// refuses private space. The Resend API host is one we wrote down, not one
// anybody handed us, and `safeFetch` is a GET-only reader besides.
// `node:https` is used directly here for the same reason `safe-fetch.ts`
// itself uses it, and this module makes no `fetch()` call, so the
// `no-fetch-outside-egress` fence is kept rather than worked around.
// Recorded so the next reader does not "fix" it.
//
// **Logs carry no address and no body.** The recipient appears only as a
// truncated digest, which is enough to correlate two sends to the same
// person and not enough to reach them.
import https from "node:https";
import { createHash } from "node:crypto";
import { env } from "@/lib/config/env";
import type { VendorResult, VendorSend } from "./types";

const RESEND_HOST = "api.resend.com";
const RESEND_PATH = "/emails";

/** How long one send may take before it is a retriable failure. A
 *  parameter (rule 1.1): long enough for a transactional mail API,
 *  short enough that a job is never held by one. Reversal cost: this
 *  constant. */
const SEND_TIMEOUT_MS = 10_000;

/** Enough of a recipient to correlate sends, never enough to reach one. */
export function recipientDigest(address: string): string {
  return createHash("sha256").update(address.trim().toLowerCase()).digest("hex").slice(0, 12);
}

interface TransportResponse {
  status: number;
  headers: Readonly<Record<string, string | string[] | undefined>>;
  body: string;
}

/** The one HTTP call, isolated so a test can stand in for it without
 *  standing in for this module's own mapping of outcomes to values. */
export type VendorTransport = (payload: string) => Promise<TransportResponse>;

function httpsTransport(payload: string): Promise<TransportResponse> {
  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        host: RESEND_HOST,
        port: 443,
        path: RESEND_PATH,
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () =>
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          })
        );
        response.on("error", reject);
      }
    );
    request.setTimeout(SEND_TIMEOUT_MS, () => request.destroy(new Error("resend: request timed out")));
    request.on("error", reject);
    request.end(payload);
  });
}

let transport: VendorTransport = httpsTransport;

/** Test seam. Production code never calls this; `null` restores the real
 *  transport. */
export function __setVendorTransportForTesting(next: VendorTransport | null): void {
  transport = next ?? httpsTransport;
}

/** A 4xx that is not a rate limit is the vendor refusing this mail for
 *  good — a malformed address, a blocked domain. Retrying it spends the
 *  whole window on an outcome that will not change. Everything else is
 *  worth another attempt. */
function isRetriable(status: number): boolean {
  if (status === 429) return true;
  return status < 400 || status >= 500;
}

function retryUntilFrom(headers: TransportResponse["headers"], now: Date): Date | undefined {
  const raw = headers["retry-after"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined) return undefined;
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  return new Date(now.getTime() + seconds * 1000);
}

function readId(body: string): string | null {
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed !== null && typeof parsed === "object" && "id" in parsed) {
      const id = (parsed as { id: unknown }).id;
      if (typeof id === "string" && id !== "") return id;
    }
  } catch {
    return null;
  }
  return null;
}

function logSend(a: {
  kind: string;
  recipient: string;
  outcome: string;
  status: number | null;
  vendorId: string | null;
}): void {
  console.log(JSON.stringify({ event: "mail_send", ...a }));
}

/** One request, both bodies, never a throw. */
export async function sendViaVendor(v: VendorSend): Promise<VendorResult> {
  const recipient = recipientDigest(v.to);
  const { subject, html, text } = v;
  // §15's `MAIL_FROM` (issue #81), read at the send. Not derived from
  // `NEXT_PUBLIC_APP_URL` any more: that address was only ever right on
  // production, and the boot refuses a deployment that names no mailbox.
  const payload = JSON.stringify({ from: env.MAIL_FROM, to: [v.to], subject, html, text });

  let response: TransportResponse;
  try {
    response = await transport(payload);
  } catch {
    // A refused socket, a DNS failure, a timeout, or a transport that
    // rejected for any other reason. Nothing about the address is known
    // to be wrong, so this is worth another attempt.
    logSend({ kind: v.kind, recipient, outcome: "transport", status: null, vendorId: null });
    return { ok: false, retriable: true };
  }

  if (response.status >= 200 && response.status < 300) {
    const id = readId(response.body);
    if (id === null) {
      // The vendor accepted it and we cannot name what it accepted. That
      // is not a failure to send — re-sending would duplicate the mail —
      // but it is not a send we can refer to either, so it is reported as
      // permanent rather than retried.
      logSend({ kind: v.kind, recipient, outcome: "unreadable_ack", status: response.status, vendorId: null });
      return { ok: false, retriable: false };
    }
    logSend({ kind: v.kind, recipient, outcome: "sent", status: response.status, vendorId: id });
    return { ok: true, id };
  }

  const retriable = isRetriable(response.status);
  const retryUntil = retriable ? retryUntilFrom(response.headers, new Date()) : undefined;
  logSend({
    kind: v.kind,
    recipient,
    outcome: retriable ? "retriable" : "rejected",
    status: response.status,
    vendorId: null,
  });
  return retryUntil === undefined ? { ok: false, retriable } : { ok: false, retriable, retryUntil };
}
