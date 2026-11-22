/** Version 13 → 14: a page question's answered column gains the rivals it named, and broken links the pages holding them. Neither was read
 *  before, so both stay absent, which reads as not read; the re-score fills the rivals from the answers `fetches` still holds. */
export function upgradeFromVersion13(blob: Record<string, unknown>): Record<string, unknown> {
  return { ...blob, version: 14 };
}

/** Version 14 → 15: the AI panel. A set's item kind may be `search`, an item may carry the question ChatGPT was asked, and an answer may say
 *  its name could be another business's. None was written before, so the older blob reads as it is. */
export function upgradeFromVersion14(blob: Record<string, unknown>): Record<string, unknown> {
  return { ...blob, version: 15 };
}
