// BUILD §9 — the two marks a ReachKit post carries in a customer's WordPress (ADR-083 decision 3).
// The marker is ours: a token in the body that ReachKit searches before creating, so losing it means a duplicate post.
// The stamp is the customer's: one `post_tag` term listing every post we made (REQ-060 c6), theirs to rename or delete.
// Neither does the other's job: the idempotency search never looks for the stamp, since a guard the customer can delete is not one.
// The marker is an HTML comment at the end of the body, not post meta: core REST drops meta keys nobody registered with
// `show_in_rest`, while core search covers the body. A customer can delete it in code view; the publication row is the
// half of at-most-once they cannot reach (ADR-080).
import { WORDPRESS } from "@/lib/config/constants";

/** The token the search asks for and a candidate is confirmed against; one per draft. */
export function markerToken(draftId: string): string {
  return `${WORDPRESS.markerPrefix}:${draftId}`;
}

/** The marker in the post body, an HTML comment that renders as nothing. */
export function markerComment(draftId: string): string {
  return `<!-- ${markerToken(draftId)} -->`;
}

/** The page, then the marker, appended so an excerpt never leads with our comment. It takes the rendered HTML: the
 *  renderer escapes its input, so a marker passed through it would show as punctuation and never be found again. */
export function bodyWithMarker(body: string, draftId: string): string {
  return `${body}\n\n${markerComment(draftId)}`;
}

/** Is this the post for this draft? The exact token in the raw content, since the site's search may match loosely;
 *  a candidate without it is somebody else's post. */
export function carriesMarker(rawContent: string, draftId: string): boolean {
  return rawContent.includes(markerToken(draftId));
}
