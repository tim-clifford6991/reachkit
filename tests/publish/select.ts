// How PostgREST answers a select's JSON paths, for the doubles that serve `fetches`; no side effects, so any suite may import it.
type Row = Record<string, unknown>;

/** `alias:column->key…`, as PostgREST answers it: `->` keeps the JSON value
 *  (a number keys an array, never an object), a last `->>` gives it as text. */
export function project(columns: string, row: Row): Row {
  const out = { ...row };
  for (const [, alias, column, path] of columns.matchAll(/(\w+):(\w+)((?:->>?\w+)+)/g)) {
    const held = row[column as string];
    if (held === undefined || alias! in row) continue;
    const steps = [...path!.matchAll(/->(>?)(\w+)/g)];
    let value: unknown = held;
    for (const [, text, key] of steps) {
      value = /^\d+$/.test(key!) ? (Array.isArray(value) ? value[Number(key)] : undefined) : value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>)[key!] : undefined;
      if (text === ">" && value !== undefined && value !== null && typeof value !== "string") value = JSON.stringify(value);
    }
    out[alias as string] = value === undefined ? null : value;
  }
  return out;
}
