// Planted violation: `nothing-borrowed`. REQ-091 criterion 3 — "no rival,
// target, question or opportunity is manufactured to fill a list that came
// out empty". Here another customer's measured rival stands in the empty
// list, which reads as data and is not the customer's.
import type React from "react";

export default function BorrowedRivalPage(): React.JSX.Element {
  return (
    <div className="card">
      <div className="card-body">
        <h2>Rivals holding the ground</h2>
        <ul>
          <li>rival-one.example.net</li>
        </ul>
      </div>
    </div>
  );
}
