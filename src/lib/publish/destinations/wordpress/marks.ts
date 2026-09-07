// BUILD §9 — the two marks a ReachKit post carries in a customer's
// WordPress, and the reason they are two.
//
// ADR-083 Decision 3, as a table:
//
// |                    | the marker                     | the stamp                          |
// |--------------------|--------------------------------|------------------------------------|
// | what it is         | a token in the post's own body | one `post_tag` term                |
// | who reads it       | ReachKit, before creating      | the customer, in their own wp-admin |
// | the question       | "is this the post for draft X?"| "show me every post ReachKit made" |
// | grain              | one post                       | all of them                        |
// | whose it is        | ours                           | theirs, to rename or delete        |
// | lost ⇒             | a duplicate article on a       | REQ-060 c6's list, and the mail    |
// |                    | paying customer's blog         | that names a place, are gone       |
//
// **Neither does the other's job, permanently.** The idempotency search
// looks for the marker and never for the stamp — a guard the customer can
// delete from their own admin screen is not a guard — and a post whose
// stamp has been removed is still found by it. That asymmetry is the whole
// argument and there is a test for it.
//
// **Why the marker is a token in the body and not post meta.** ADR-080
// decision 5 fixes that a marker exists and that changing its shape is a
// migration of somebody else's site; which shape it takes is this
// implementation's, and WordPress core decides it for us. Core's REST API
// carries `meta` only for meta keys a plugin or theme has registered with
// `show_in_rest`, so post meta ReachKit invents is silently dropped on
// create and absent on read at the very sites this has to work at — every
// install we do not control. Core search, by contrast, covers the post
// body, and the body is writable in the one create call. So the marker is
// an HTML comment at the end of the content: invisible to a reader of the
// page, carried by the create, and findable by the site's own search.
//
// The cost, stated rather than hidden: a customer editing the post in
// their own editor's code view can see and delete it, where registered
// meta would have been out of their way. That is the price of using only
// what core guarantees, and it is the same price ADR-083 accepts for the
// stamp, which the customer may also delete. The publication row is the
// half of the at-most-once guarantee that lives where the customer cannot
// reach it (ADR-080), and it is not weakened by this.
//
// The archived plans are WO-236, WO-237.
import { WORDPRESS } from "@/lib/config/constants";

/** The token itself — what the search asks for and what a candidate is
 *  confirmed against. One draft, one token. */
export function markerToken(draftId: string): string {
  return `${WORDPRESS.markerPrefix}:${draftId}`;
}

/** The marker as it sits in the post body. An HTML comment: it renders as
 *  nothing on the customer's page. */
export function markerComment(draftId: string): string {
  return `<!-- ${markerToken(draftId)} -->`;
}

/**
 * The post body ReachKit creates: the page, then the marker. Appended
 * rather than prepended so that a site which truncates a body for an
 * excerpt does not lead with our comment.
 *
 * **It takes the body as it will be sent — HTML, not Markdown — and the
 * order is load-bearing** (issue #158). The renderer escapes every
 * character of its input, which is what makes its output safe to set as
 * HTML; a marker passed through it would come back as `&lt;!-- … --&gt;`
 * and publish as a visible line of punctuation at the foot of a paying
 * customer's page, while the search that looks for the raw comment would
 * find nothing and the next attempt would create a second post. So the
 * body is rendered first and marked second, here.
 */
export function bodyWithMarker(body: string, draftId: string): string {
  return `${body}\n\n${markerComment(draftId)}`;
}

/**
 * Is this the post for this draft?
 *
 * An exact search for the marker in the raw content, never a prefix or a
 * fuzzy match: the site's own search is what produced the candidate and it
 * may match loosely, so this is the confirmation that makes a false
 * positive impossible. A candidate that does not carry the exact token is
 * somebody else's post and is not returned as ours.
 */
export function carriesMarker(rawContent: string, draftId: string): boolean {
  return rawContent.includes(markerToken(draftId));
}
