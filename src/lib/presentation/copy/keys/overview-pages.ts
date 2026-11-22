// The Pages Live detail, `/app/pages` (owner, 2026-11-20, #2982; plate O2): its own partition, as `overview.ts` is over the file cap.
import type { CopyPartition } from "../registry.ts";

export const OVERVIEW_PAGES_COPY = Object.freeze({
  "overview.pages.lead": "Every page we published that is on your site now.",
  "overview.pages.caption": "Your live pages",
  "overview.pages.col.page": "Page",
  "overview.pages.col.live": "Went Live",
  "overview.pages.col.google": "On Google",
  "overview.pages.col.ai": "AI Answers, {weeks} Weeks",
  "overview.pages.open": "Open",
  "overview.pages.open.name": "Open {title}",
  "overview.pages.live": "Live {date} · {place}",
  "overview.pages.crawled": "Visited by Google {date}. Not added yet.",
  "overview.pages.foot": "Newest first. Stop or edit a page from its own screen.",
  "overview.pages.none": "No page is live yet. Your first goes live {day} at {time}.",
  "overview.pages.paused": "Publishing is off, so no page goes live. Turn it on in Settings › Pages.",
  "overview.pages.all.label": "Every live page",
  "overview.detail.show-all.pages": "Show All {n} Pages",
}) satisfies CopyPartition;
