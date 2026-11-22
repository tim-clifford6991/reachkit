// src/lib/config/constants/offer.ts — the first-50 offer: how many spots, when it closes, when few are left. Imports nothing.

export const OFFER_SPOTS = 50 as const;
/** The end of 31 Jan 2027 UTC: one fixed moment for everyone. */
export const OFFER_ENDS_AT = "2027-02-01T00:00:00Z" as const;
/** The offer's last day in UTC, as printed: "31 Jan 2027". */
export const OFFER_ENDS_ON = new Date(Date.parse(OFFER_ENDS_AT) - 1).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const OFFER_FEW_LEFT = 4 as const;
/** A full refund this many days after the spot was taken still gives it back. */
export const OFFER_FREE_REFUND_DAYS = 14 as const;
/** The ended or all-taken line stays this many days after the offer closed, then nothing is drawn. */
export const OFFER_SHOWN_DAYS = 30 as const;
/** The founder's free booking link; empty until the owner makes one, and "Book 15 Minutes" is drawn only when it is set. */
export const OFFER_BOOKING_URL: string = "";
/** The founder checks in with a spot holder this many days after the spot was taken. */
export const OFFER_CHECKIN_DAYS = [14, 30] as const;
/** The founder sends the report video within a day (`marketing/first-customers/walkthrough-video.md`). */
export const OFFER_VIDEO_DAYS = 1 as const;
/** A spot's founder due dates, the Billing tab's and the owner's paid mail's one source. */
export const founderDates = (takenAt: Date): { video: Date; checkIns: Date[] } => ({
  video: new Date(takenAt.getTime() + OFFER_VIDEO_DAYS * 86_400_000),
  checkIns: OFFER_CHECKIN_DAYS.map((days) => new Date(takenAt.getTime() + days * 86_400_000)),
});
