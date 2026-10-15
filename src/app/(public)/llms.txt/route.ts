// Issue 1458 — llms.txt, at the address v1 and v2 served: what ReachKit is
// today and the pages worth reading, for an AI reader.
import { PUBLIC_ORIGIN } from "../_chrome/canonical";
import { llmsText } from "../_library/feeds";

export const dynamic = "force-static";

export function GET(request: Request): Response {
  return new Response(llmsText(PUBLIC_ORIGIN ?? new URL(request.url).origin), {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
