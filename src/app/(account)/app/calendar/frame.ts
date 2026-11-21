// SPEC §7 *This week* — the screen's frame, shared by the screen and its
// skeleton so the two are one shape.

/** The screen: the head, then the week. From `lg` it fits the viewport (the shell's own padding off), so only its columns scroll. */
export const PLAN = "flex min-w-0 flex-col gap-4 lg:h-[calc(100dvh-3rem)] xl:h-[calc(100dvh-4rem)]";

/** The cards and the pane: one column, two of about half each from `lg`. */
export const BODY = "grid min-w-0 items-start gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)] lg:items-stretch";

/** The cards' column, which scrolls inside itself from `lg`. */
export const COLUMN = "flex min-w-0 flex-col gap-4 lg:min-h-0 lg:overflow-y-auto";

/** The week: one card a day. */
export const WEEK_LIST = "flex min-w-0 flex-col gap-2.5";

/** One day's card. */
export const DAY_ROW = "card card-border min-w-0 gap-2 bg-base-100 p-4";

/** How many days the week draws: Monday to Sunday. */
export const WEEK_DAYS = 7;

/** The regions the layout gate compares, by name. */
export const REGION = {
  body: "plan-body",
  week: "plan-week",
} as const;
