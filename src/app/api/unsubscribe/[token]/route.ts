// RFC 8058's one-click endpoint for the Monday mail's List-Unsubscribe header:
// a POST switches the mail off with no session; a GET is sent to the page,
// which does the same and says so. Same token, same write as the page.
import { applyUnsubscribeToken } from "@/lib/mail/notifications/unsubscribe";
import { adapter } from "../../_adapter";

export const runtime = "nodejs";

const ROUTE_ID = "/api/unsubscribe/{token}";

type TokenContext = { params: Promise<{ token: string }> };

export const POST = adapter(ROUTE_ID, async (_request: Request, context: TokenContext) => {
  const { token } = await context.params;
  const applied = await applyUnsubscribeToken(token);
  const status = "switchedOff" in applied ? 200 : applied.error === "unavailable" ? 503 : 404;
  console.log(JSON.stringify({ event: "api_unsubscribe", outcome: "switchedOff" in applied ? "applied" : applied.error }));
  return new Response(null, { status });
});

export const GET = adapter(ROUTE_ID, async (_request: Request, context: TokenContext) => {
  const { token } = await context.params;
  return new Response(null, { status: 303, headers: { location: `/unsubscribe/${token}` } });
});
