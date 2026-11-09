// tests/presentation/copy/__fixtures__/surfaces/src/app/clean.tsx
//
// WO-279 fixture (supersedes WO-044). A clean src/app file: every string a
// reader sees arrives through copy() or renderGenerated(), never as a
// literal. Self-contained stand-ins for copy()/renderGenerated() — this
// fixture tree carries no dependency on the real module, so both sweeps
// discriminate from the first run (WO-279 rests-on row 3).
function copy(key: string): string {
  return key;
}
function renderGenerated(
  field: { text: string },
  page: unknown
): { label: string; text: string; proposed: boolean } {
  void page;
  return { label: "a label", text: field.text, proposed: false };
}

export function CleanApp(p: { field: { text: string }; page: unknown }) {
  return (
    <div className="panel" data-testid="clean-app">
      <h1>{copy("fixture.heading")}</h1>
      <p>{renderGenerated(p.field, p.page).text}</p>
    </div>
  );
}
