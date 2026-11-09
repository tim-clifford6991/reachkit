// tests/presentation/copy/__fixtures__/surfaces/src/ui/violation-allowlisted-attr.tsx
//
// WO-279 fixture (supersedes WO-044). Must NOT be flagged: `className` is
// on ATTRIBUTE_ALLOWLIST (ADR-010 point 1's "class names" category) — a
// CSS class name, never the product's voice. Proves the allow-list clears
// a literal that would otherwise sit in a JSX attribute position.
export function AllowlistedAttr() {
  return <div className="card-title" data-testid="allowlisted" />;
}
