// tests/presentation/copy/__fixtures__/surfaces/src/app/violation-generated-no-identity.tsx
//
// WO-279 fixture (supersedes WO-044). Violates REQ-093 criterion 2 / BP-020
// `## Error & edge behavior` tenth bullet: a GeneratedText field's raw
// `.text` reaches JSX directly — `identity.title.text` — even though the
// PageIdentity (`identity`) is right there in scope; renderGenerated() is
// never called to bind the text to it. Exactly one violation.
export function ViolationNoPageIdentity(p: { identity: { title: { text: string } } }) {
  return <p>{p.identity.title.text}</p>;
}
