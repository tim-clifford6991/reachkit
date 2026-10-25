// BUILD §9 — the WordPress unpublish: four outcomes, one stored discriminator, no re-read of the customer's site.
// Made live by us → returned to draft by one write of one field. Created but never made live → named for the customer
// with zero outbound calls. Post gone → already gone. Site unreachable → `ok: true`, since the customer's stop was taken.
// The discriminator is `publications.made_live_by_us` (ADR-082 decision 2, ADR-084 decision 4), never substituted by:
//  - `pub.liveUrl != null`, which is non-null for every WordPress row and would write into a post we left alone;
//  - a re-read of the post's status, since a customer who published our draft themselves is not a page we made live.
// `hostedByUs` picks the family one level up, and `servesPublicly` is `true` at both destinations, so neither decides here.
// `named_for_removal` has no members today, as every create publishes; it is kept, since §9 promises it for a page we did not make live.
import type { DestinationConfig, Publication, UnpublishResult } from "../../types";
import type { WordPressConfig } from "./client";
import { setPostDraft } from "./client";
import { classifyPostAnswer } from "./errors";

export async function unpublishWordPress(
  pub: Publication,
  cfg: DestinationConfig
): Promise<UnpublishResult> {
  // First and with no call at all, not even to the marker or the stamp: the early return makes egress unreachable here.
  if (!pub.madeLiveByUs) return { ok: true, outcome: "named_for_removal" };

  // No post id: the delivery never reached a post, so there is nothing in their site to return.
  if (pub.remoteId === null || pub.remoteId === "") {
    return { ok: true, outcome: "already_gone" };
  }

  const answer = await setPostDraft(cfg as unknown as WordPressConfig, pub.remoteId);
  const classified = classifyPostAnswer(answer);

  switch (classified.kind) {
    case "ok":
      // Idempotent: a post already at `draft` is set to `draft` again.
      return { ok: true, outcome: "returned_to_draft" };
    case "gone":
      return { ok: true, outcome: "already_gone" };
    case "unreachable":
      // `ok: true`: as a failure, the customer's stop would be left un-taken, which §9 promises in every branch.
      return { ok: true, outcome: "unreachable", retryOffered: true };
    case "failed":
      return { ok: false, reason: classified.reason };
  }
}
