/** Version 13 → 14: a page question's answered column gains the rivals it named, and broken links the pages holding them. Neither was read
 *  before, so both stay absent, which reads as not read; the re-score fills the rivals from the answers `fetches` still holds. */
export function upgradeFromVersion13(blob: Record<string, unknown>): Record<string, unknown> {
  return { ...blob, version: 14 };
}
