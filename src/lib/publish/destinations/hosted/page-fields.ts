// The hosted store's readers of a draft's `meta`, each defensive: a field that is absent, blank or not text reads as none.

/** `drafts.meta.description`, read defensively: blank is none, never an empty meta tag. */
export function readDescription(meta: Record<string, unknown> | null): string | null {
  const raw = meta?.description;
  if (typeof raw !== "string") return null;
  const text = raw.replace(/\s+/g, " ").trim();
  return text === "" ? null : text;
}

/** The heading generation recorded for one of the template's sections, or
 *  `null` where `drafts.meta.sections` holds none for it. */
export function readSectionHeading(meta: Record<string, unknown> | null, key: string): string | null {
  const sections = meta?.sections;
  if (!Array.isArray(sections)) return null;
  const found = sections.find((section): section is { key: string; heading: string } => section?.key === key && typeof section.heading === "string");
  return found === undefined ? null : emptyToNull(found.heading);
}

/** The date a mended version keeps (SPEC §7): a version that only repaired its predecessor in code is dated as it, so
 *  its updated date, `dateModified` and `lastmod` do not move. `null` for every other version. */
export function datedAt(meta: Record<string, unknown> | null): Date | null {
  const raw = meta?.datedAs;
  if (typeof raw !== "string") return null;
  const at = new Date(raw);
  return Number.isNaN(at.getTime()) ? null : at;
}

/** `drafts.meta.heading`, read the same way. */
export function readHeading(meta: Record<string, unknown> | null): string | null {
  const raw = meta?.heading;
  if (typeof raw !== "string") return null;
  const text = raw.replace(/\s+/g, " ").trim();
  return text === "" ? null : text;
}

/** A stated value, or `null`: an empty string would draw an empty eyebrow. */
export function emptyToNull(value: string | null): string | null {
  return value === null || value.trim() === "" ? null : value;
}
