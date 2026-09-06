// Planted violation: `no-blank-value`. A value position standing empty,
// which is exactly REQ-091 criterion 2's "no blank … value stands anywhere a
// value would sit".
import type React from "react";

export default function BlankValuePage(): React.JSX.Element {
  return (
    <div className="card">
      <div className="card-body">
        <dl>
          <dt>Searches you appear in</dt>
          <dd></dd>
        </dl>
      </div>
    </div>
  );
}
