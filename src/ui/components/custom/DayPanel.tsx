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

export function DayPanel(p: {
  /** The day's own head — required. Typically a stage badge and the date. */
  heading: React.ReactNode;
  /** REQ-043 c5 and c11: the day's one account — the page's detail, or the
   *  one written line for an empty date. Required, never defaulted. */
  account: React.ReactNode;
  /** The stage-appropriate controls. Absent is a decision the caller makes
   *  (an empty day offers none), never a default set of this component's. */
  actions?: React.ReactNode;
}): React.JSX.Element {
  return (
    <aside className="rk-daypanel" data-testid="day-panel">
      <div className="rk-daypanel-inner">
        <div className="rk-daypanel-head">{p.heading}</div>
        <div className="rk-daypanel-account">{p.account}</div>
        {p.actions === undefined ? null : (
          <div className="rk-daypanel-actions">{p.actions}</div>
        )}
      </div>
    </aside>
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
  return (
    <div className="rk-day-layout">
      <div className="rk-day-layout-grid">{p.grid}</div>
      {p.panel}
    </div>
  );
}
