"use client";

import type { ReactNode } from "react";

/**
 * Every walkthrough route carries this, at the top, unavoidably.
 *
 * A walkthrough is how the whole is seen. It is NOT a gate anyone has
 * passed: no work order is released by it, no components.md row moves
 * because of it, and no `Signed-off:` date follows from it.
 */
export function WalkBanner({
  screen,
  spec,
  primaryAction,
  proposed,
  children,
}: {
  screen: string;
  spec: string;
  /** Rule 7.3: one primary action per screen. Named here so it is checkable
   *  by looking, not by arguing. */
  primaryAction: string;
  /** Proposed-not-registered components this screen spends, if any. */
  proposed?: readonly string[];
  children?: ReactNode;
}) {
  return (
    <div className="pv-stop" style={{ marginBottom: "var(--s-5)" }}>
      <p style={{ margin: 0, fontWeight: 700 }}>
        Walkthrough — assembled from registered components for review. Not a signed preview of
        any work order.
      </p>
      <p style={{ margin: "var(--s-2) 0 0" }} className="pv-mono">
        {screen} · {spec}
      </p>
      <p style={{ margin: "var(--s-1) 0 0" }} className="pv-mono">
        primary action: {primaryAction}
      </p>
      {proposed && proposed.length > 0 ? (
        <p style={{ margin: "var(--s-1) 0 0" }} className="pv-mono">
          spends proposed-not-registered: {proposed.join(" · ")}
        </p>
      ) : null}
      {children}
    </div>
  );
}

/** The state selector every data view on a walkthrough carries. Rule 7.3:
 *  every data view specifies loading, empty and error. Here they are not
 *  described — they are switchable, at a real viewport, in a real theme. */
export function StateBar({
  states,
  value,
  onChange,
}: {
  states: readonly string[];
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <div className="pv-toggle" role="group" aria-label="view state">
      {states.map((s) => (
        <button key={s} type="button" data-current={s === value ? "true" : "false"} onClick={() => onChange(s)}>
          {s}
        </button>
      ))}
    </div>
  );
}
