"use client";

/**
 * The four registered custom surfaces — components.md §2, BP-018.
 *
 * BUILD.md §2.2 admits custom CSS for exactly five things: the calendar
 * grid, the day panel, the AI dot-matrix, chart SVGs, and the sidebar —
 * nothing else. These are four of the five; the fifth is charts.tsx.
 *
 * Every row in components.md §2 is `proposed`. Two of these contracts are
 * WIDENINGS still recorded as gaps (§4 gap 1: the three-state cell with row
 * identity; §4 gap 7: the ways-through slot with three per-route cases) and
 * they are drawn here as widened, which is what the widening is for — not
 * as settled.
 */
import type { ReactNode } from "react";
import { Num } from "@/components/Num";
import { type Tone, toneClass } from "./tone";

/* ── Sidebar ─────────────────────────────────────────────────────────────
   Destinations are a REQUIRED prop — the three destinations are BP-037's
   tuple, not this component's. The publishing-state line is a required
   node. The component names no destination and no state wording of its own.
   A destination with a count of 0 renders NO count at all. */
export type Destination = { label: string; count?: number; current?: boolean };

export function Sidebar({
  domainBlock,
  destinations,
  publishingState,
}: {
  domainBlock: ReactNode;
  destinations: readonly Destination[];
  publishingState: ReactNode;
}) {
  return (
    <nav className="rk-sidebar">
      {domainBlock}
      <div className="stack-1">
        {destinations.map((d) => (
          <a
            key={d.label}
            href="#"
            className="rk-navlink"
            data-current={d.current ? "true" : "false"}
            onClick={(e) => e.preventDefault()}
          >
            <span>{d.label}</span>
            {/* 0 renders no count at all — components.md §2 */}
            {d.count ? <Num>{d.count}</Num> : null}
          </a>
        ))}
      </div>
      <div style={{ marginTop: "auto" }}>{publishingState}</div>
    </nav>
  );
}

/* ── CalendarGrid ────────────────────────────────────────────────────────
   One entry per date. `label` is required on a filled day — a day can never
   render as a coloured cell alone. The grid PERFORMS NO PADDING: an empty
   day is an absent entry the caller decides about, and an out-of-month cell
   is an explicit `off` entry the caller supplies. There is no code path in
   here that invents a cell (§4.6: "the calendar is never padded").

   An empty day's tone is narrowed to neutral | warn: §2.5 forbids `bad` on
   an intended-empty state, and an exhausted supply is intended. `warn` is
   available only because REQ-047 c5's outstanding instruction asks
   something of the customer.

   NARROW VIEWPORT — PROPOSED, needs the surface blueprint's word. §4.6
   fixes `repeat(7,minmax(0,1fr))` and calls the minmax load-bearing; it
   states nothing about a viewport too narrow for seven columns at
   --w-cell-min. Below --breakpoint-md the same entries render as a 7-ROW
   LIST in date order — one row per date, no invented cell, no text below
   --t-floor, and the weekday header suppressed because a one-column list
   has no columns to head. It is a CSS rule in `.rk-cal` and nothing else:
   this component has no second markup path and no `narrow` prop, so the
   contract is unchanged. */
export type DayEntry =
  | { kind: "off"; date: string }
  | { kind: "filled"; date: string; stage: string; tone: Tone; label: string; today?: boolean }
  | {
      kind: "empty";
      date: string;
      account: string;
      accountTone: Extract<Tone, "neutral" | "warn">;
      today?: boolean;
    };

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export function CalendarGrid({ entries }: { entries: readonly DayEntry[] }) {
  return (
    <div className="rk-cal">
      {WEEKDAYS.map((d) => (
        <div key={d} className="rk-cal-h">
          {d}
        </div>
      ))}
      {entries.map((e) => {
        if (e.kind === "off") {
          return (
            <div key={e.date} className="rk-day rk-day-off">
              <span className="d">{e.date}</span>
            </div>
          );
        }
        const today = "today" in e && e.today;
        if (e.kind === "empty") {
          return (
            <div
              key={e.date}
              className={`rk-day rk-day-empty${today ? " rk-day-today" : ""}`}
              title={e.account}
            >
              <span className="d">{e.date}</span>
              <span
                className="t"
                style={{
                  color: e.accountTone === "warn" ? "var(--warn)" : "var(--ink-2)",
                }}
              >
                {e.account}
              </span>
            </div>
          );
        }
        /* The label is clamped to two lines in a --w-cell-min cell and its
           full value rides on the cell itself, so a truncation is
           recoverable rather than a loss. The alternative was type below
           --t-floor, which the floor refuses. */
        return (
          <div
            key={e.date}
            className={`rk-day${today ? " rk-day-today" : ""}`}
            title={e.label}
            aria-label={e.label}
          >
            <span className="d">{e.date}</span>
            <span className={`badge ${toneClass(e.tone)}`}>{e.stage}</span>
            <span className="t">{e.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── DayPanel ────────────────────────────────────────────────────────────
   290px, sticky beside the grid, NOT a drawer (§4.6) — at and above
   --breakpoint-xl, where a 290px column and the grid at its own cell floor
   both fit. Below that there is no "beside" left and §4.6 says nothing
   about what happens then, so the panel becomes a full-width block
   FOLLOWING the grid, in flow, not sticky. Still not a drawer: nothing
   slides over anything and nothing is dismissed. PROPOSED — this needs the
   surface blueprint's word, and it is a preview's proposal, not a found
   rule. The behaviour is entirely in `.rk-panel` (globals.css): there is no
   second markup path and no `narrow` prop.

   Supplies no string and offers no default action.

   The ways-through slot is components.md §4 gap 7's widening: an ORDERED
   list of routes, each with its own label and address, each of which may be
   offered, withheld with its own account, or not applicable — and the third
   renders as NOTHING. `not-applicable` carries no account by construction:
   a route the customer never chose has no record to state.

   `undefined` is not a fourth case: the union is closed, so a caller cannot
   omit a route's disposition. */
export type Way =
  | { kind: "offered"; label: string; addressKey: string; address: string; primary: boolean }
  | { kind: "withheld"; label: string; account: string }
  | { kind: "not-applicable" };

export function DayPanel({
  stage,
  date,
  heading,
  account,
  why,
  waysLabel,
  ways,
  actions,
  provenance,
}: {
  stage: ReactNode;
  date: ReactNode;
  /** A day holding a page: the page's own heading node. */
  heading?: ReactNode;
  /** A day holding no page: exactly one account, and no second one. */
  account?: ReactNode;
  why?: readonly { k: string; v: string }[];
  waysLabel?: string;
  ways?: readonly Way[];
  actions?: ReactNode;
  provenance?: ReactNode;
}) {
  const rendered = (ways ?? []).filter((w) => w.kind !== "not-applicable");
  return (
    <aside className="rk-panel">
      <div className="between">
        {stage}
        <span className="prov">{date}</span>
      </div>
      {heading ? <p className="rk-h4">{heading}</p> : null}
      {account ? <div className="sunk t-sm">{account}</div> : null}
      {why && why.length > 0 ? (
        <div className="sunk">
          <p className="eb">why this page</p>
          <div className="rk-why">
            {why.map((r) => (
              <div className="r" key={r.k}>
                <span className="k">{r.k}</span>
                <span className="v">
                  <Num>{r.v}</Num>
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {rendered.length > 0 ? (
        <div className="stack-2">
          {waysLabel ? <p className="eb">{waysLabel}</p> : null}
          <ul className="rk-ways">
            {rendered.map((w, i) =>
              w.kind === "offered" ? (
                <li className="rk-way" key={i}>
                  <span className="grow">
                    <span className="lab">{w.label}</span>
                    <span className="addr">
                      <span className="addr-key">{w.addressKey}</span>
                      <Num>{w.address}</Num>
                    </span>
                  </span>
                  <button
                    type="button"
                    className={`btn btn-sm ${w.primary ? "btn-primary" : "btn-ghost"}`}
                  >
                    {w.label}
                  </button>
                </li>
              ) : (
                /* Withheld: the account renders IN PLACE OF the way through.
                   No button, disabled or otherwise — an action that cannot
                   succeed is not offered at all (REQ-043 c9). */
                <li className="rk-way" key={i}>
                  <span className="grow">
                    <span className="lab dim">{w.label}</span>
                    <span className="explain">{w.account}</span>
                  </span>
                </li>
              ),
            )}
          </ul>
        </div>
      ) : null}
      {actions ? (
        <>
          <hr className="hr" />
          {actions}
        </>
      ) : null}
      {provenance ? <p className="prov">{provenance}</p> : null}
    </aside>
  );
}

/* ── AiDotMatrix ─────────────────────────────────────────────────────────
   components.md §4 gap 1's widening, drawn. THREE cell states, not two, and
   row identity is part of the contract:
     · cited      — a row cited in the AI answer
     · not-cited  — a miss. On the customer's OWN row this is the red ring
                    §4.1 requires; on a rival's row it is simply empty.
     · muted      — a question with no AI answer at all. §6.2: "never as a
                    miss." A boolean could hold neither this nor the ring.
   Every cell carries a required label. No legend-only mode: a written count
   renders alongside, caller-supplied. */
export type MatrixCell = { label: string; state: "cited" | "not-cited" | "muted" };
export type MatrixRow = { identity: "you" | "rival"; name: string; cells: readonly MatrixCell[] };

export function AiDotMatrix({
  rows,
  countLine,
}: {
  rows: readonly MatrixRow[];
  /** Required — the written count that renders alongside. */
  countLine: string;
}) {
  return (
    <div className="stack-2">
      <div className="rk-matrix">
        {rows.map((r) => (
          <div className="rk-matrix-row" key={r.name}>
            <span
              className="rk-matrix-name"
              style={r.identity === "you" ? { color: "var(--accent)" } : undefined}
            >
              {r.name}
            </span>
            <span className="rk-cells">
              {r.cells.map((c, i) => (
                <span
                  key={i}
                  className="rk-cell"
                  data-state={c.state}
                  data-you={r.identity === "you" ? "true" : "false"}
                  title={c.label}
                  aria-label={c.label}
                />
              ))}
            </span>
          </div>
        ))}
      </div>
      <p className="explain">{countLine}</p>
    </div>
  );
}
