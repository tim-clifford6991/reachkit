// tests/presentation/copy/__fixtures__/surfaces/src/app/violation-text-prop.tsx
//
// WO-279 fixture (supersedes WO-044). Violates REQ-093 criterion 1: a
// text-bearing JSX attribute holding a literal, never read through
// copy(). Exactly one violation, the `label` attribute below (`label` is
// not on the allow-list — ATTRIBUTE_ALLOWLIST names only structural
// attributes, never a component's own text prop).
function Btn(p: { label: string }) {
  return <button>{p.label}</button>;
}

export function ViolationTextProp() {
  return <Btn label="Click here to continue" />;
}
