// BUILD §12 · §15 — the one Resend request, carrying both bodies, so the text alternative cannot be a forgotten second send.
// Nothing here throws: every failure becomes a `VendorResult`, so an unsendable mail never takes down its job.
// Not `safeFetch()`: that guards customer-supplied URLs and is GET-only, and this host is ours. `node:https` keeps the `no-fetch-outside-egress` fence.
// Logs carry no address or body; a truncated digest correlates sends without reaching anyone.
import https from "node:https";
import { createHash } from "node:crypto";
import { env } from "@/lib/config/env";
import { copy } from "@/lib/presentation/copy";
import type { VendorResult, VendorSend } from "./types";

const RESEND_HOST = "api.resend.com";
const RESEND_PATH = "/emails";

/** Long enough for a transactional mail API, short enough that no job is held by one send. */
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

/** The one HTTP call, isolated so a test can replace it without replacing the outcome mapping. */
export type VendorTransport = (payload: string, idempotencyKey: string) => Promise<TransportResponse>;

/** `{template}:{subject}:{period}`: the kind, this recipient's mail as
 *  rendered, and the UTC day. The vendor sends one mail per key for a day,
 *  so a retry, or the same alert from the next tick, is not a second mail. */
export function idempotencyKeyOf(v: VendorSend, now: Date): string {
  const subject = createHash("sha256")
    .update([v.to.trim().toLowerCase(), v.subject, v.html, v.text].join("\n"))
    .digest("hex")
    .slice(0, 32);
  return `${v.kind}:${subject}:${now.toISOString().slice(0, 10)}`;
}

function httpsTransport(payload: string, idempotencyKey: string): Promise<TransportResponse> {
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
          "Idempotency-Key": idempotencyKey,
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

/** Test seam; `null` restores the real transport. */
export function __setVendorTransportForTesting(next: VendorTransport | null): void {
  transport = next ?? httpsTransport;
}

/** A non-rate-limit 4xx is a permanent refusal (bad address, blocked domain); everything else is worth another attempt. */
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

/** RFC 8058's two headers. `List-Unsubscribe-Post` promises the URL unsubscribes on a POST alone, as `src/app/api/opt-out/[token]/route.ts` does;
 *  Gmail and Yahoo ask it of bulk senders, and the body link is a second way in, never a substitute. URIs are angle-bracketed by the grammar. */
function unsubscribeHeaders(url: string | undefined): Record<string, string> {
  if (url === undefined) return {};
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/** One request, both bodies, never a throw. */
export async function sendViaVendor(v: VendorSend): Promise<VendorResult> {
  const recipient = recipientDigest(v.to);
  const { subject, html, text } = v;
  const headers = unsubscribeHeaders(v.listUnsubscribe);
  // §15's `MAIL_FROM`, read at the send. The From carries the shell's wordmark, since a bare address reads as a stranger; replies go
  // to the same read mailbox (RUNBOOK §6). `headers` is omitted with no stop control, so an unstoppable kind never claims one.
  const payload = JSON.stringify({
    from: `${copy("mail.shell.wordmark")} <${env.MAIL_FROM}>`,
    reply_to: env.MAIL_FROM,
    to: [v.to],
    subject,
    html,
    text,
    ...(Object.keys(headers).length === 0 ? {} : { headers }),
  });

  let response: TransportResponse;
  try {
    response = await transport(payload, idempotencyKeyOf(v, new Date()));
  } catch {
    // Socket, DNS, timeout or other transport failure: nothing is known wrong with the address, so retry.
    logSend({ kind: v.kind, recipient, outcome: "transport", status: null, vendorId: null });
    return { ok: false, retriable: true };
  }

  if (response.status >= 200 && response.status < 300) {
    const id = readId(response.body);
    if (id === null) {
      // Accepted but unnamed: re-sending would duplicate it, so it is permanent, not retried.
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
