// src/app/api/opt-out/[token]/route.ts — SPEC §8, issue 889
//
// RFC 8058's one-click unsubscribe endpoint: the address a *mail client*
// reaches when the reader presses the client's own Unsubscribe control,
// rather than the link inside the body.
//
// **Why a second address for the same stop.** `/opt-out/{token}` is the
// page a person lands on, and Next serves a `page.tsx` and a `route.ts`
// from one segment never — so the endpoint takes its own address over the
// same token. There is one token format, one signing key and one
// suppression write (`applyOptOutToken`); this file holds none of the three
// and adds no second way to be opted out.
//
// **POST is the whole of the mechanism, and it asks nothing further.** RFC
// 8058 §3.2: a client that sees `List-Unsubscribe-Post` may POST once and
// must be unsubscribed by that POST alone — no page, no confirmation, no
// session. The body it sends is `List-Unsubscribe=One-Click` and is not
// read here: the token in the path is the whole credential, and a body
// check would make a conforming client that formats it differently fail to
// unsubscribe somebody who asked to be.
//
// **A prefetch that opts somebody out costs them nothing they cannot
// undo** — the reasoning `src/lib/mail/leads/optout.ts` already records for
// the page applying on arrival, and it holds identically here. What it
// stops is the follow-up; the page a lead asked for is `stoppable: false`
// and still arrives.
//
// **GET is not the endpoint.** Some clients and scanners follow the header
// with a GET rather than a POST; those are sent to the page, which applies
// the token and says what happened in the product's own words. So neither
// verb leaves a reader who pressed Unsubscribe still subscribed.
//
// The response carries no body on either verb. A mail client renders
// nothing it is given here, and a body would be a sentence spoken outside
// the copy registry.
import { applyOptOutToken } from "@/lib/mail/leads";
import { adapter } from "../../_adapter";

export const runtime = "nodejs";

const ROUTE_ID = "/api/opt-out/{token}";
const APPLIED = 200;
/** The store could not be written. Told apart from a bad token so a client
 *  that retries has something true to retry against — and so a reader is
 *  never recorded as unsubscribed on a write that did not happen. */
const UNAVAILABLE = 503;
const INVALID = 404;
const SEE_PAGE = 303;

type TokenParams = { token: string };
type TokenContext = { params: Promise<TokenParams> };

export const POST = adapter(ROUTE_ID, async (_request: Request, context: TokenContext) => {
  const { token } = await context.params;
  const applied = await applyOptOutToken(token);

  if ("email" in applied) {
    // No address in the log line, here as everywhere: the outcome is the
    // whole of what a person debugging this may have.
    console.log(JSON.stringify({ event: "api_opt_out", outcome: "applied" }));
    return new Response(null, { status: APPLIED });
  }

  console.log(JSON.stringify({ event: "api_opt_out", outcome: applied.error }));
  return new Response(null, {
    status: applied.error === "unavailable" ? UNAVAILABLE : INVALID,
  });
});

export const GET = adapter(ROUTE_ID, async (_request: Request, context: TokenContext) => {
  const { token } = await context.params;
  // 303 and not 307: what follows is a page to read, and the verb must not
  // be carried over to it.
  //
  // The location is relative on purpose. An absolute one would have to name
  // a host — either the request's, which behind a proxy is not necessarily
  // the address the reader typed, or `NEXT_PUBLIC_APP_URL`, which would move
  // a reader off the deployment they are on. A relative Location is what
  // keeps them exactly where they already are.
  return new Response(null, {
    status: SEE_PAGE,
    headers: { location: `/opt-out/${token}` },
  });
});
