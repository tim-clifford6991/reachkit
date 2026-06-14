// Count how many community items mention a given name (case-insensitive). Used
// to derive a REAL "them vs you" competitor signal from data we already have —
// the `communities` raw_documents — instead of a 1-vs-0 placeholder. Pure and
// DB-free: the DB read happens in the caller (full-scan readCompetitorGap).
//
// `communityBodies` is the list of raw_document.body values for source_type
// "communities". Each body is itself an array of community items ({ title, … }).

function itemText(item: unknown): string {
  if (typeof item === "string") return item.toLowerCase();
  if (item && typeof item === "object") {
    const obj = item as Record<string, unknown>;
    return [obj["title"], obj["body"]]
      .filter((s): s is string => typeof s === "string")
      .join(" ")
      .toLowerCase();
  }
  return "";
}

export function countMentions(name: string, communityBodies: unknown[]): number {
  const needle = name.trim().toLowerCase();
  if (!needle) return 0;
  let count = 0;
  for (const body of communityBodies) {
    const items = Array.isArray(body) ? body : [body];
    for (const item of items) {
      if (itemText(item).includes(needle)) count++;
    }
  }
  return count;
}
