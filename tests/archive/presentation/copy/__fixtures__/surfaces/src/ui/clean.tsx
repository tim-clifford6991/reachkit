// tests/presentation/copy/__fixtures__/surfaces/src/ui/clean.tsx
//
// WO-279 fixture (supersedes WO-044). A clean file under the src/ui glob.
function copy(key: string): string {
  return key;
}

export function CleanUi() {
  return (
    <button className="btn" type="button" aria-label={copy("fixture.ui.aria")}>
      {copy("fixture.ui.label")}
    </button>
  );
}
