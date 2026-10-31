// src/app/api/lead/route.ts — BUILD §4.2
//
// The transport adapter over lead capture. It reads exactly two fields from
// the body, hashes the client address, calls one exported function, and maps its arms to a
// response. It holds no lead logic: no address validation of its own beyond
// what the body parse requires, no mail call, no sequence start, no clock
// and no database access.
//
// **Every response body carries a `CopyKey`, never a sentence and never a
// vendor payload.** The surface renders the sentence from the key; an error
// from the store never reaches a visitor as text.
//
// **The body admits nothing else.** REQ-010 criterion 1's control asks for
// an email address and nothing else — "no account, no password, no
// payment, no further field" — so a body carrying a further property is
// rejected rather than silently ignored. A field quietly dropped here is a
// field that could be added to the form tomorrow and reach the engine.
import type { CopyKey } from "@/lib/presentation/copy";
import { captureLead } from "@/lib/mail/leads";
import { networkKeyOf } from "@/lib/scan/admission";

export type LeadResponse =
  | { ok: true; message: CopyKey }
  | { ok: false; message: CopyKey };

/** 202, not 200: the address was accepted, which is the only thing true at
 *  that moment. The page is written and sent in the job, so a body claiming
 *  a delivery here would be claiming something that has not happened. */
const ACCEPTED = 202;
const MALFORMED = 400;
const INVALID_ADDRESS = 422;
const STORE_UNAVAILABLE = 503;

const RESPONSES = Object.freeze({
  accepted: "lead.accepted",
  invalid: "lead.invalid_address",
  unavailable: "lead.unavailable",
} as const satisfies Record<string, CopyKey>);

type ParsedBody = { ok: true; scanId: string; email: string } | { ok: false };

/** Exactly `{ scanId, email }`, both strings, and no third property. */
function readBody(parsed: unknown): ParsedBody {
  if (typeof parsed !== "object" || parsed === null) return { ok: false };
  const keys = Object.keys(parsed);
  if (keys.length !== 2) return { ok: false };
  const body = parsed as { scanId?: unknown; email?: unknown };
  if (typeof body.scanId !== "string" || typeof body.email !== "string") return { ok: false };
  return { ok: true, scanId: body.scanId, email: body.email };
}

function json(status: number, body: LeadResponse): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(request: Request): Promise<Response> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return json(MALFORMED, { ok: false, message: RESPONSES.invalid });
  }

  const body = readBody(parsed);
  if (!body.ok) return json(MALFORMED, { ok: false, message: RESPONSES.invalid });

  const captured = await captureLead({
    scanId: body.scanId,
    email: body.email,
    network: networkKeyOf(request.headers),
  });
  const outcome = captured.captured ? "accepted" : captured.reason;
  // The visitor's address never appears in the log line.
  console.log(JSON.stringify({ event: "api_lead", outcome, scanId: body.scanId }));

  // A limited lead gets the accepted answer byte for byte, so the response says nothing about the limit.
  if (outcome === "accepted" || outcome === "limited") {
    return json(ACCEPTED, { ok: true, message: RESPONSES.accepted });
  }
  return outcome === "invalid-address"
    ? json(INVALID_ADDRESS, { ok: false, message: RESPONSES.invalid })
    : json(STORE_UNAVAILABLE, { ok: false, message: RESPONSES.unavailable });
}
