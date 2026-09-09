// src/ui/components/custom/DayPanel.tsx — BUILD §2.2, §4.6
//
// The second of the five surfaces §2.2 allows custom CSS for. Registered in
// `components.md` as: "Required heading node, required account node,
// actions slot … Supplies none of them and offers **no default action**.
// Width `--w-day-panel`; sticky beside the grid, **not a drawer** (§4.6)."
//
// Three required nodes and one optional slot, and the component supplies
// none of their content — BP-018 decision 2: "no component has a default
// string." `heading` and `account` are **required**, so a panel that
// renders a day without saying which day, or without the day's one account,
// does not compile.
//
// `DayPanelLayout` is the panel's own placement, and it is here rather than
// in a screen's stylesheet because "sticky beside the grid" is part of the
// panel's registered contract, not the calendar's arrangement of it.
import type React from "react";
import "./day-panel.css";

/**
 * The panel itself — the box, with nothing said about what is in it.
 *
 * §2.2 registers one panel ("Day panel · `.panel` · 290 sticky beside the
 * grid, in flow below") and the approved set spends that one class on two
 * screens: S15's day detail beside the calendar grid, and S16's Decide rail
 * beside the draft. So there is one box here rather than a second one under
 * another name in `idiom.css` — the surface, its width and its stickiness
 * are stated once, and the two screens cannot drift apart on any of them.
 *
 * What differs between them is the *slots*, which is why `DayPanel` below
 * is a shape over this rather than the only way in: S15's three required
 * nodes are the calendar's contract and say nothing about a rail of
 * controls and a list of check results.
 */
export function Panel(p: {
  children: React.ReactNode;
  testId: string;
}): React.JSX.Element {
  return (
    <aside className="rk-daypanel" data-testid={p.testId}>
      <div className="rk-daypanel-inner">{p.children}</div>
    </aside>
  );
}

/**
 * The placement: one column below the wide band, two beside each other at
 * and above it, the panel sticky only there. `DayPanelLayout` is this under
 * the calendar's own names.
 */
export function PanelLayout(p: {
  main: React.ReactNode;
  panel: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="rk-day-layout">
      <div className="rk-day-layout-grid">{p.main}</div>
      {p.panel}
    </div>
  );
}

export function DayPanel(p: {
  /** The day's own head — required. Typically a stage badge and the date. */
  heading: React.ReactNode;
  /** REQ-043 c5 and c11: the day's one account — the page's detail, or the
   *  one written line for an empty date. Required, never defaulted. */
  account: React.ReactNode;
  /** The stage-appropriate controls. Absent is a decision the caller makes
   *  (an empty day offers none), never a default set of this component's. */
  actions?: React.ReactNode;
  /**
   * §4.6's "one dim provenance line", **last** — after the controls, which
   * is where every one of S15's five arms draws it (issue #354).
   *
   * It is a slot of this component rather than the tail of `account`
   * because its position is part of what the panel is: §2.5 rules
   * provenance "always visible but always quiet", and a line that has to
   * be quiet cannot sit above the one control the panel is asking for.
   * Optional — an arm with nothing measured behind it states nothing, and
   * a placeholder date would be the invention the whole rule exists to
   * refuse.
   */
  provenance?: React.ReactNode;
}): React.JSX.Element {
  return (
    <Panel testId="day-panel">
      <div className="rk-daypanel-head">{p.heading}</div>
      <div className="rk-daypanel-account">{p.account}</div>
      {p.actions === undefined ? null : (
        <div className="rk-daypanel-actions">{p.actions}</div>
      )}
      {p.provenance === undefined ? null : p.provenance}
    </Panel>
  );
}

/**
 * §4.6: the panel is "sticky, beside the grid — **not a drawer**". At and
 * above `--breakpoint-xl` — the width at which a 290px column and the grid
 * at its own cell floor both fit — the two sit side by side and the panel
 * sticks. Below it the panel is a full-width block **following** the grid,
 * in flow, not sticky, and still not a drawer: nothing slides over anything
 * and nothing is dismissed.
 */
export function DayPanelLayout(p: {
  grid: React.ReactNode;
  panel: React.ReactNode;
}): React.JSX.Element {
  return <PanelLayout main={p.grid} panel={p.panel} />;
}
