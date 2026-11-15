// The outreach channel a free scan came from, read off the landing's `?ref=` (owner D7, 2026-11-15).
// Server code only: an allow-list, so no name, address or free text ever reaches `scans.ref`.

export const REF_TAGS = [
  "linkedin",
  "x",
  "email",
  "reddit",
  "indiehackers",
  "producthunt",
  "community",
  "network",
  "event",
  "video",
] as const;

export type RefTag = (typeof REF_TAGS)[number];

/** The tag when `value` is one on the list once trimmed and lowercased; anything else is `null`. */
export function refOf(value: unknown): RefTag | null {
  if (typeof value !== "string") return null;
  const tag = value.trim().toLowerCase();
  return (REF_TAGS as readonly string[]).includes(tag) ? (tag as RefTag) : null;
}
