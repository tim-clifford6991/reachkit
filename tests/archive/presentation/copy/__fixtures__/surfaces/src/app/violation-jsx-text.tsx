// tests/presentation/copy/__fixtures__/surfaces/src/app/violation-jsx-text.tsx
//
// WO-279 fixture (supersedes WO-044). Violates REQ-093 criterion 1: a
// product sentence written directly as JSX text, never read through
// copy(). Exactly one violation, on the <p> line below.
export function ViolationJsxText() {
  return <p>This sentence was written directly in the surface.</p>;
}
