// Planted violation: `exactly-one-line`. Two accounts of one empty place —
// what ADR-011 exists to make impossible, and what REQ-043 criterion 5
// ("exactly one account of itself and no second one") forbids by name.
import type React from "react";

export default function TwoLinesPage(): React.JSX.Element {
  return (
    <div className="card">
      <div className="card-body" data-place="calendar.date.page">
        <p data-place-line="">Nothing was worth publishing that day.</p>
        <p data-place-line="">Publishing is paused.</p>
      </div>
    </div>
  );
}
