// BUILD §9 — the WordPress unpublish: four outcomes, one stored
// discriminator, and no re-read of the customer's site to decide the arm.
//
// A page ReachKit made live in the customer's own WordPress is **returned
// to draft** there by one write of one field. A page it created and never
// made live is **named for the customer and not touched** — zero outbound
// calls, not merely zero writes. A post that is no longer in the site is
// **already gone**, and a site that could not be reached is
// **unreachable**, which is `ok: true` because the customer's stop was
// taken: the page is `unpublished` and the product has stopped treating it
// as live. What did not happen is the write into a site we do not own, and
// that is the outcome, not a failure of the action.
//
// **The discriminator is `publications.made_live_by_us` and there are
// exactly two things that must never be substituted for it** (ADR-082
// Decision 2, carried by ADR-084 Decision 4 — both substitutions read as
// the obvious implementation):
//
//  - **not `pub.liveUrl != null`**, and the reason has changed sign.
//    ADR-081 rejected it because `live_url` was null for every WordPress
//    delivery, so it classified every WordPress page as never-live and
//    quietly reduced "unpublish everything" to "touch nothing". Since
//    ADR-084 it is non-null for every WordPress row, so the same predicate
//    now classifies every WordPress page as made-live-by-us — and would
//    write into a post a future draft-delivery option had left alone. Same
//    substitution, opposite failure, both wrong.
//  - **not a re-read of the post's status at unpublish time.** A customer
//    who published our draft themselves is not a page ReachKit made live,
//    and writing into a post the customer chose to publish is the harm
//    REQ-060's non-goals and §9's unpublish promise name. The stored fact
//    is about what *we* did; the site's state is about what *they* did.
//
// Neither `servesPublicly` nor `hostedByUs` decides between these four
// either: `hostedByUs` chooses the *family* — the hosted `removed` arm
// against these four — one level up, and `servesPublicly` is now `true` at
// both destinations, so reading it here would be actively wrong.
//
// **The empty arm has swapped ends.** Until 2026-09-01 a WordPress post was
// never made live by us, so `returned_to_draft` was the arm with no
// members. That inverted: this adapter sets `status: 'publish'` on every
// create, so `returned_to_draft` is the ordinary outcome and
// **`named_for_removal` is the arm with no members**. It is kept, specified
// and tested for exactly the reason the other one was kept — it is the
// outcome §9 promises for a page ReachKit created but did not make live —
// and deleting it looks like a cleanup with a passing suite.
//
// The archived plan is WO-239.
import type { DestinationConfig, Publication, UnpublishResult } from "../../types";
import type { WordPressConfig } from "./client";
import { setPostDraft } from "./client";
import { classifyPostAnswer } from "./errors";

export async function unpublishWordPress(
  pub: Publication,
  cfg: DestinationConfig
): Promise<UnpublishResult> {
  // The never-made-live arm, first and with no call at all. Not the post
  // status, not a tag, not a comment, not a removal of the marker and not
  // a removal of the stamp: a page ReachKit did not make live is named for
  // the customer, and their site is not written into. The early return is
  // what makes the egress seam unreachable on this path rather than merely
  // unused, and that is what the zero-egress test asserts.
  if (!pub.madeLiveByUs) return { ok: true, outcome: "named_for_removal" };

  // A row that carries no post id records a delivery that never reached a
  // post. There is nothing in their site to return and nothing for them to
  // remove, which is what `already_gone` says.
  if (pub.remoteId === null || pub.remoteId === "") {
    return { ok: true, outcome: "already_gone" };
  }

  const answer = await setPostDraft(cfg as unknown as WordPressConfig, pub.remoteId);
  const classified = classifyPostAnswer(answer);

  switch (classified.kind) {
    case "ok":
      // One write of one field, and idempotent: a post already at `draft`
      // is set to `draft` and the site answers with the post. The customer
      // asked for it not to be live, and it is not live.
      return { ok: true, outcome: "returned_to_draft" };
    case "gone":
      return { ok: true, outcome: "already_gone" };
    case "unreachable":
      // `ok: true`, and the page takes the `published → unpublished` edge
      // exactly as the other three do. Reading it as a failure would leave
      // the customer's stop un-taken, which is the one thing §9 promises
      // in every branch.
      return { ok: true, outcome: "unreachable", retryOffered: true };
    case "failed":
      return { ok: false, reason: classified.reason };
  }
}
