// The box's trigger for reachkit.app's re-run and test write. It decides nothing itself: `boxTrigger` checks the secret,
// the caps and the payload, and this route hands it the request and the one sender, so the event key never leaves the app.
import { sendSubjectEvents } from "@/jobs/client";
import { env } from "@/lib/config/env";
import { boxTrigger } from "@/lib/ops/trigger";
import { adapter } from "../../_adapter";

export const runtime = "nodejs";

export const POST = adapter("/api/ops/trigger", async (request: Request) => {
  const { status, body } = await boxTrigger({
    authorization: request.headers.get("authorization"),
    secret: env.BOX_TRIGGER_SECRET,
    read: () => request.text(),
    now: new Date(),
    send: sendSubjectEvents,
  });
  return Response.json(body, { status });
});
