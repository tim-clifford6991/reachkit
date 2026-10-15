// Issue 1458 — the teardowns' RSS feed, at the address v1 published.
import { PUBLIC_ORIGIN } from "../../_chrome/canonical";
import { teardownsFeed } from "../../_library/feeds";

export const dynamic = "force-static";

export function GET(request: Request): Response {
  return new Response(teardownsFeed(PUBLIC_ORIGIN ?? new URL(request.url).origin), {
    status: 200,
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
