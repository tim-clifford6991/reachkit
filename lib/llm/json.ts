/**
 * Pull a JSON value out of a model response. Models frequently wrap JSON in
 * ```json fences or surround it with prose, which makes a well-formed answer
 * fail `JSON.parse` and fall through to a degraded path (the cause of the
 * "parse failure" report on the live nudgi.ai run). Strip fences and, failing
 * that, slice from the first bracket to the last matching one.
 */
export function extractJson(text: string): string {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) t = fence[1].trim();
  if (!t.startsWith("{") && !t.startsWith("[")) {
    const s = t.search(/[{[]/);
    const e = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
    if (s !== -1 && e > s) t = t.slice(s, e + 1);
  }
  return t;
}
