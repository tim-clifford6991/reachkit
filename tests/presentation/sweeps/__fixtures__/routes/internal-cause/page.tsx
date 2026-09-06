// Planted violation: `no-internal-cause`. REQ-092 criterion 8 — a stopped
// day handing the customer the product's own internals: the spend cap that
// stopped it, the vendor that did not answer, and the status code it
// answered with.
import type React from "react";

export default function InternalCausePage(): React.JSX.Element {
  return (
    <div className="card">
      <div className="card-body" data-testid="shell-stopped">
        <p>No page today: the daily spend cap was reached at 12 cents.</p>
        <p>DataForSEO answered HTTP 429 and the run was rate-limited.</p>
      </div>
    </div>
  );
}
