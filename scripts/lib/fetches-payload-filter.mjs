// From the first migration that keeps `fetches` off `payload`, none filters on a jsonb operator over it (docs/RUNBOOK.md §9).
const FROM = "20261121100000";
const OPERATOR = /payload\s*(\?|->|#>|@>)/;

export function fetchesPayloadFilters(texts) {
  return texts
    .filter(({ rel, text }) => {
      const name = /^supabase\/migrations\/(\d+)_[^/]+\.sql$/.exec(rel);
      return name && name[1] >= FROM && text.includes("public.fetches") && OPERATOR.test(text);
    })
    .map(({ rel }) => `${rel} puts a jsonb operator on fetches.payload; a fetches filter reads an indexed column`);
}
