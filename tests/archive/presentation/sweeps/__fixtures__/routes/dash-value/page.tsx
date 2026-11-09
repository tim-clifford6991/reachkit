// Planted violation: `no-placeholder-value`. A bare dash standing where a
// value would sit, with nothing saying a measurement could not be taken —
// the reading REQ-091 criterion 2 forbids and REQ-004 criterion 8 keeps
// separate from a cold start.
import type React from "react";

export default function DashValuePage(): React.JSX.Element {
  return (
    <div className="card">
      <div className="card-body">
        <dl>
          <dt>AI answers naming you</dt>
          <dd>
            <span>—</span>
          </dd>
        </dl>
      </div>
    </div>
  );
}
