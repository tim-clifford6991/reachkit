// Planted violation: `place-registered`. A place rendered under a name the
// registry has never heard of — which the sweep must fail **by name**, so
// the fix is to register it rather than to delete the marker.
import type React from "react";

export default function UnregisteredPlacePage(): React.JSX.Element {
  return (
    <div className="card">
      <div className="card-body" data-place="overview.rival-gaps.table">
        <p data-place-line="">No rivals measured yet.</p>
      </div>
    </div>
  );
}
