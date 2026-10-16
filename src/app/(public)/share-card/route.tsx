// Issue 1458 — the site's share card at a fixed address.
//
// v1 and v2 served it at `/opengraph-image`, and that address is still
// linked. Today's file-based card carries a build hash in its address, so
// the middleware serves this one at the old address (`_seo/moved.ts`). It is
// the same drawing: the group's `opengraph-image.tsx` default export.
import Image from "../opengraph-image";

export function GET(): Response {
  return Image();
}
