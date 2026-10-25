// src/lib/config/constants/mail.ts — the mail sequences and when they are sent. Imports nothing.

export const NURTURE_H = Object.freeze([24, 72, 168] as const);

// The weekly clock
export const WEEK_START = "monday" as const;                 // not a tunable, pinned so it is stated once
export const WEEKLY_DUE_HOUR_LOCAL = 6 as const;              // site-local, never UTC

// Account lifecycle
export const SETUP_REMINDER_OFFSETS_H = Object.freeze([24, 72, 168] as const);
// SPEC §8 Retention: win-back once at +30 d after access ends.
export const RETENTION_MAIL = Object.freeze({
  winbackAfterAccessDays: 30,
  /** How stale a stored "last seen" may be before an /app visit rewrites it. */
  seenRefreshMinutes: 60,
} as const);
export const NURTURE_MAX_TOUCHES = 3 as const;
export const SEQUENCE_START_DEADLINE_DAYS = 7 as const;
export const FIRST_PAGE_RETRY_WINDOW_H = 24 as const;
export const FIRST_PAGE_RETRY_MINUTES = Object.freeze([5, 30, 120, 360, 720, 1440] as const);
/** A writer's claim on a report's free page older than this never finished (its
 *  invocation died): the next lead may take the scan and write it. Longer than
 *  any one job invocation can live. SPEC §2. */
export const FIRST_PAGE_CLAIM_STALE_MINUTES = 30 as const;

/** SPEC §8: the page-ready mail carries the page's first paragraphs and no
 *  more, because the mail is where a reader decides to open the page, and a
 *  whole draft in an inbox is a page nobody then reads. Three: the
 *  answer-first opening and the two blocks that say whether the page keeps
 *  its promise. */
export const MAIL_PAGE_LINES = 3 as const;
