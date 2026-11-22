// SPEC §4 *Competitors tab* — the words for what ReachKit is doing about a search; a missing status is a compile error.
import type { CopyKey } from "@/lib/presentation/copy";
import type { RivalSearchStatus } from "./rivals-model";

export const RIVAL_STATUS_COPY_KEY: Readonly<Record<RivalSearchStatus, CopyKey>> = Object.freeze({
  in_review: "overview.rivals.status.in-review",
  up_next: "overview.rivals.status.up-next",
  needs_page: "overview.rivals.status.needs-page",
  too_big: "overview.rivals.status.too-big",
  live: "overview.search.status.live",
});
