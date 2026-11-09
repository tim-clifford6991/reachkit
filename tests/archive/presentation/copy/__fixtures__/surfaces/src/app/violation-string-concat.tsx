// tests/presentation/copy/__fixtures__/surfaces/src/app/violation-string-concat.tsx
//
// WO-279 fixture (TST-028 finding 1). Violates REQ-093 criterion 1: string
// concatenation of two literals rendered as JSX text is exactly as much
// the product's voice as a bare literal — `"a" + "b"` is not "read through
// copy()" just because it is spelled with a `+`. Exactly one violation.
export function ViolationStringConcat() {
  return <p>{"Hello, " + "world"}</p>;
}
