// src/app/api/danger/[action]/route.ts — BUILD §4.7, REQ-079 c3
//
// The export half of the ticket-and-download handshake: the one address
// that builds a danger action's archive, hands it to the customer, and
// records that it left.
//
// REQ-079 criterion 3: "an export of their pages is produced and downloaded
// by them before anything is unpublished or deleted; if it cannot be
// produced, or they do not take it, the action does not proceed and says
// why." `beginDangerAction` is what produces it and writes the ticket that
// authorises nothing by itself; this route is what hands it over.
//
// **It is a route and not a Server Function because a Server Function
// cannot stream a file.** The archive is a `ReadableStream`, the customer
// receives it as a download, and the response has to carry
// `content-disposition` — none of which a function returning a value can
// do. The panel's own controls are Server Functions; this one address is
// the exception the file format forces.
//
// **The ticket travels in an HttpOnly cookie, not in the body or the URL.**
// It is a capability: whoever holds it can confirm an irreversible action
// once the archive has been taken. So it is never in a URL (which is
// logged, shared and kept in history), never in the response body (which
// is a zip), and never readable by script. The confirming Server Function
// reads it from the request the browser sends back, which is the same
// mechanism the session itself uses.
//
// **`markExportTaken` is stamped after the last byte, and only then.** A
// stamp written when the response was constructed would say the archive
// left when the connection might still fail halfway; the strongest claim
// available is that the whole stream was written without error, which is
// what the `tee` below waits for. A download the customer aborts leaves the
// ticket unstamped and `confirmDangerAction` refuses it — REQ-079 c3's "or
// they do not take it", enforced rather than assumed.
//
// **A failed export hands nothing over and writes no ticket.** The engine
// returns before writing one, and this route answers the line key with no
// body at all: a truncated zip can never be what the customer receives.
import { adapter } from "../../_adapter";
import { beginDangerAction, isDangerAction, markExportTaken } from "@/lib/account/lifecycle";
import { currentSession } from "@/lib/account/identity";
import { DANGER_TICKET_COOKIE, dangerTicketCookieOptions } from "@/app/(account)/app/settings/danger-ticket";

const SIGN_IN_STATUS = 401;
const NOT_AN_ACTION_STATUS = 404;
const FAILED_STATUS = 503;

export const GET = adapter(
  "GET /api/danger/{action}",
  async (_request: Request, context: { params: Promise<{ action: string }> }): Promise<Response> => {
    const { action } = await context.params;
    // The two §4.7 prints and no third: an address naming anything else is
    // not an address this product has.
    if (!isDangerAction(action)) return new Response(null, { status: NOT_AN_ACTION_STATUS });

    const session = await currentSession();
    if (session === null || session.siteId === null) {
      return new Response(null, { status: SIGN_IN_STATUS });
    }

    const begun = await beginDangerAction({ siteId: session.siteId, action });
    if (!begun.ok) {
      return Response.json({ lineKey: begun.lineKey }, { status: FAILED_STATUS });
    }

    // Two readers of one stream: the customer's download, and the watcher
    // that stamps the ticket once the last byte has gone. `tee` is what
    // lets the stamp wait for the end of a body the customer is already
    // receiving, rather than guessing at it from the start.
    const [toCustomer, toWatcher] = begun.archive.tee();
    void drain(toWatcher).then((whole) => (whole ? markExportTaken(begun.ticket) : undefined));

    const response = new Response(toCustomer, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${begun.filename}"`,
      },
    });
    // `secure` follows the deployment's own origin rather than `NODE_ENV`,
    // exactly as the session cookie's does: a preview on https gets a
    // secure cookie and a local http dev server gets one a browser will
    // actually store.
    const { env } = await import("@/lib/config/env");
    response.headers.append(
      "set-cookie",
      `${DANGER_TICKET_COOKIE}=${begun.ticket}; ` +
        dangerTicketCookieOptions(env.NEXT_PUBLIC_APP_URL.startsWith("https://"))
    );
    return response;
  }
);

/** Reads a stream to its end. `true` where it ended without error — which
 *  is the whole of what "the archive left this process" can mean here. */
async function drain(stream: ReadableStream<Uint8Array>): Promise<boolean> {
  const reader = stream.getReader();
  try {
    for (;;) {
      const { done } = await reader.read();
      if (done) return true;
    }
  } catch {
    // An aborted download leaves the ticket unstamped, and the confirming
    // action refuses it. Nothing is logged here that a request line does
    // not already carry.
    return false;
  } finally {
    reader.releaseLock();
  }
}
