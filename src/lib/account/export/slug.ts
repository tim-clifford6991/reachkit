// BUILD §4.7 — the archive's file names.
//
// A page's file is named by a slug, **never by its title**: a title is the
// customer's own text and can carry a path separator, a leading dot, a
// colon or a run of Unicode that a zip reader on another operating system
// will refuse — and a file the customer cannot open is not content handed
// back. The slug is derived and the title is carried inside the file, in
// its front matter, unchanged.
//
// Collisions are suffixed `-2`, `-3` in manifest order, so two pages that
// share a title still both appear. The order is the manifest's, which is
// `created_at` ascending, so a second run produces the same names.

/** The floor for a title with nothing sluggable in it — a title of
 *  punctuation, or of a script this transliterates nothing from. It is a
 *  file name, not a sentence: no customer reads it as ReachKit speaking. */
const FALLBACK = "page";

const MAX_LENGTH = 80;

export function slugify(title: string): string {
  const slug = title
    .normalize("NFKD")
    // Anything that is not an ASCII letter or digit becomes a separator —
    // which folds away path separators, dots, colons and every combining
    // mark the normalisation just split off, in one rule rather than a
    // blocklist that a future character escapes.
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, MAX_LENGTH)
    .replace(/-+$/g, "");
  return slug.length === 0 ? FALLBACK : slug;
}

/**
 * The slugs for a list of titles, in order, with collisions suffixed.
 *
 * Returned as a list rather than resolved per call because a suffix is a
 * fact about the whole set: `-2` means "the second page whose title
 * slugified to this", and that cannot be known one title at a time.
 */
export function slugsFor(titles: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return titles.map((title) => {
    const base = slugify(title);
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base}-${count}`;
  });
}
