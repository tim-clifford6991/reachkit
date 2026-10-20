// The owner's review screen, `/app/review`: each paying site's week and why
// each page was chosen. Owner-only; no customer reads these.
import type { CopyPartition } from "../registry.ts";

export const REVIEW_COPY = Object.freeze({
  "review.meta.title": ["Review · ReachKit", { slots: {}, fixedBy: "issue 1702 (drafted)" }],
  "review.eyebrow": ["Owner only", { slots: {}, fixedBy: "issue 1702 (drafted)" }],
  "review.title": ["Review", { slots: {}, fixedBy: "issue 1702 (drafted)" }],
  "review.lead": [
    "Each paying site's week, read from what the last commit stored. Nothing here changes a site.",
    { slots: {}, fixedBy: "issue 1702 (drafted)" },
  ],
  "review.unreadable": ["The sites could not be read just now.", { slots: {}, fixedBy: "issue 1702 (drafted)" }],
  "review.no-sites": ["No site has active access.", { slots: {}, fixedBy: "issue 1702 (drafted)" }],
  "review.week.title": ["The committed week", { slots: {}, fixedBy: "issue 1702 (drafted)" }],
  "review.week.empty": ["No week committed yet", { slots: {}, fixedBy: "issue 1702 (drafted)" }],
  "review.spare": ["spare", { slots: {}, fixedBy: "issue 1702 (drafted)" }],
  "review.col.place": ["Place", { slots: {}, fixedBy: "issue 1702 (drafted)" }],
  "review.col.day": ["Day", { slots: {}, fixedBy: "issue 1702 (drafted)" }],
  "review.col.search": ["Search", { slots: {}, fixedBy: "issue 1702 (drafted)" }],
  "review.col.type": ["Type", { slots: {}, fixedBy: "issue 1702 (drafted)" }],
  "review.col.fit": ["Fit", { slots: {}, fixedBy: "issue 1702 (drafted)" }],
  "review.col.volume": ["Volume", { slots: {}, fixedBy: "issue 1702 (drafted)" }],
  "review.col.points": ["Points", { slots: {}, fixedBy: "issue 1702 (drafted)" }],
  "review.col.rule": ["Rule", { slots: {}, fixedBy: "issue 1702 (drafted)" }],
  "review.col.write-as": ["Written as", { slots: {}, fixedBy: "issue 1702 (drafted)" }],
  "review.col.reason": ["Reason", { slots: {}, fixedBy: "issue 1702 (drafted)" }],
  "review.rejected.title": ["Not chosen ({count}) and why", { slots: { count: "text" }, fixedBy: "issue 1702 (drafted)" }],
  "review.pages.title": ["Live pages", { slots: {}, fixedBy: "issue 1702 (drafted)" }],
  "review.pages.empty": ["No live pages yet.", { slots: {}, fixedBy: "issue 1702 (drafted)" }],
  "review.label.working": ["Working", { slots: {}, fixedBy: "issue 1702 (drafted)" }],
  "review.label.climbing": ["Climbing", { slots: {}, fixedBy: "issue 1702 (drafted)" }],
  "review.label.too_early": ["Too early", { slots: {}, fixedBy: "issue 1702 (drafted)" }],
  "review.label.not_moving": ["Not moving", { slots: {}, fixedBy: "issue 1702 (drafted)" }],
  "review.label.unmeasured": ["not measured", { slots: {}, fixedBy: "issue 1702 (drafted)" }],
}) satisfies CopyPartition;
