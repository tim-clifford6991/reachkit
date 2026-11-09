// A cold-start screen done right: nothing is blank, nothing is hidden, and
// each place holding nothing carries exactly one written line.
import type React from "react";

export default function CleanPage(): React.JSX.Element {
  return (
    <div>
      <h1>Your first week</h1>
      <div className="card">
        <div className="card-body">
          <h2>Where you appear</h2>
          <p>You appear in 0 of the 12 searches we measured.</p>
        </div>
      </div>
      <div className="card">
        <div className="card-body" data-place="overview.weekly-presence.chart">
          <h2>Weekly presence</h2>
          <p data-place-line="">
            No weeks measured yet — the first line appears after your first Monday.
          </p>
        </div>
      </div>
    </div>
  );
}
