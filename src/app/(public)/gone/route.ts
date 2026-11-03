// Issue 1458 — the answer for an address of an earlier ReachKit that has
// nothing in its place: `410 Gone`, which tells a crawler to stop asking.
//
// The middleware rewrites each such address here (`_seo/moved.ts`), and
// `/gone` answers the same itself, as it did in v2.
//
// A plain document, like the removed report's (`removedDocument`): only a
// route can set the status, and a route cannot render a component. It says
// what happened and gives one way on.
import { copy } from "@/lib/presentation/copy";
import { plainDocument } from "@/lib/publish/render/plain-document";

function goneDocument(): string {
  return plainDocument({ head: copy("gone.head"), line: copy("gone.line"), onward: copy("landing.start.cta") });
}

export function GET(): Response {
  return new Response(goneDocument(), {
    status: 410,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
