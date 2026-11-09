// tests/presentation/copy/__fixtures__/surfaces/src/app/violation-drafts-body.tsx
//
// WO-279 fixture (supersedes WO-044). Violates REQ-093 criterion 2: a raw
// read of `drafts.body` — one of GeneratedColumn's seven stored columns —
// reaching JSX directly, without ever passing through renderGenerated().
// Exactly one violation, the `drafts.body` chain below.
export function ViolationDraftsBody(p: { drafts: { body: string } }) {
  const { drafts } = p;
  return <p>{drafts.body}</p>;
}
