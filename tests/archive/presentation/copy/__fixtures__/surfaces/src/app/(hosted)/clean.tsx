// tests/presentation/copy/__fixtures__/surfaces/src/app/(hosted)/clean.tsx
//
// WO-279 fixture (supersedes WO-044). A clean file under the
// src/app/(hosted) glob.
function copy(key: string): string {
  return key;
}

export function CleanHosted() {
  return (
    <div className="hosted-panel" data-testid="clean-hosted">
      {copy("fixture.hosted-heading")}
    </div>
  );
}
