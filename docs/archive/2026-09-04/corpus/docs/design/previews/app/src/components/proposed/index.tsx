"use client";

/**
 * PROPOSED ADDITIONS — not registered, not usable in production.
 *
 * Everything in this file answers a gap components.md §4 records as OPEN.
 * None of it may be built against until it is registered and approved
 * (duty 3). Each component renders its own `proposed` mark on screen, in
 * every route it appears in, so nothing here can be mistaken for a
 * registered component by looking at the running app.
 *
 *   Textarea   — §4 gap 2. §2.2's set has `input` and no multi-line control.
 *   CodeBlock  — §4 gap 3. `Kbd` is an inline key cap, not a block, and
 *                §2.2's custom-CSS allowance lists five surfaces without one.
 *   TabBar     — §4 gap 5. §4.4's "Mobile: sidebar hidden, top tabs". Built
 *                here as a shell-local composition over registered `Tabs`
 *                needing no custom CSS — which is the architect's boundary
 *                call to make, and this drawing is the evidence for it.
 *   StaleWhileRemeasuring — components.md §6's proposed loading rule. A
 *                surface that is re-measuring keeps showing the last
 *                measurement and says which one. Never a skeleton, never a
 *                spinner, never an indeterminate bar.
 *   FailedMeasurement — the same proposal's second part: `warn`, never
 *                `bad`, because a measurement ReachKit could not take is
 *                ReachKit's problem.
 */
import type { ReactNode } from "react";
import { Num } from "@/components/Num";
import { Tabs } from "@/components/registry/primitives";
import type { FailedMeasurementTone } from "@/components/registry/tone";

export function ProposedMark({ what }: { what: string }) {
  return (
    <span className="pv-flag" title="Not registered. components.md §4.">
      proposed · {what}
    </span>
  );
}

/** §4 gap 2 — the Markdown editor's multi-line control (§4.6, owner ruling). */
export function Textarea({
  label,
  placeholder,
  value,
  onChange,
  rows = 12,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="stack-1">
      <span className="row">
        <span className="eb">{label}</span>
        <ProposedMark what="Textarea" />
      </span>
      <textarea
        className="input num"
        style={{
          height: "auto",
          minHeight: "var(--s-7)",
          padding: "var(--s-3)",
          lineHeight: "var(--t-body-line)",
          /* No inline font-size: `.input` sizes it, and the narrow-viewport
             rule in globals.css raises controls to --t-h4 so mobile Safari
             does not zoom the viewport on focus. An inline value here would
             outrank that rule and put the zoom back. */
          background: "var(--surface)",
          borderColor: "var(--line)",
          borderWidth: "var(--border-hair)",
          borderStyle: "solid",
          borderRadius: "var(--r-field)",
          width: "100%",
          resize: "vertical",
        }}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/** §4 gap 3 — the robots lines verbatim, copyable (REQ-009 c2). */
export function CodeBlock({ lines, copyLabel }: { lines: readonly string[]; copyLabel: string }) {
  return (
    <div className="stack-1">
      <div className="between">
        <ProposedMark what="CodeBlock" />
        <button type="button" className="btn btn-ghost btn-sm">
          {copyLabel}
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          background: "var(--sunk)",
          border: "var(--border-hair) solid var(--line)",
          borderRadius: "var(--r-field)",
          padding: "var(--s-3)",
          overflowX: "auto",
          fontSize: "var(--t-xs)",
        }}
      >
        <code className="num">{lines.join("\n")}</code>
      </pre>
    </div>
  );
}

/** §4 gap 5 — narrow-viewport nav. A composition over registered `Tabs`. */
export function TabBar({
  destinations,
  selected,
  onSelect,
}: {
  destinations: readonly string[];
  selected: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="stack-1">
      <ProposedMark what="TabBar (composition over Tabs)" />
      <Tabs tabs={destinations} selected={selected} onSelect={onSelect} />
    </div>
  );
}

/** components.md §6 — the proposed loading rule, in no component's States
 *  cell. The provenance line §2.5 already requires is the carrier, so a
 *  surface spends nothing new. */
export function StaleWhileRemeasuring({
  lastMeasurement,
  reMeasuringLine,
  children,
}: {
  /** Which measurement is on screen — mono, quiet, always visible. */
  lastMeasurement: string;
  /** One written line. Caller-supplied; no default exists. */
  reMeasuringLine: string;
  children: ReactNode;
}) {
  return (
    <div className="stack-2">
      <div className="row">
        <ProposedMark what="loading rule" />
        <span className="prov">
          {reMeasuringLine} · <Num>{lastMeasurement}</Num>
        </span>
      </div>
      {children}
    </div>
  );
}

/** The same proposal's second part: a failed measurement takes `warn`. The
 *  tone is not a prop — it is a type with one member. */
export function FailedMeasurement({ line }: { line: string }) {
  const tone: FailedMeasurementTone = "warn";
  return (
    <div className="stack-1">
      <ProposedMark what="failed-measurement tone" />
      <div className={`alert tone-${tone}`} role="status">
        {line}
      </div>
    </div>
  );
}
