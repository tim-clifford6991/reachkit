// Not a violation, and the rule must say so: REQ-004's own dash, marked as
// itself, beside the written line that says why. A sweep that flagged this
// would push the next author into rendering a zero for an outage.
import type React from "react";

export default function HonestDashPage(): React.JSX.Element {
  return (
    <div className="card">
      <div className="card-body">
        <dl>
          <dt>Readers you block</dt>
          <dd>
            <span data-unmeasured="">—</span>
          </dd>
        </dl>
        <p>Readers you block couldn’t be measured — nothing came back that could be read.</p>
      </div>
    </div>
  );
}
