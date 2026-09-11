"use client";

/**
 * The fifteen registered daisyUI primitives — components.md §1, BP-018.
 *
 * STATUS: every row in components.md §1 is `proposed`. Nothing here is
 * approved; this file is the drawing, not the signature.
 *
 * Two rules hold across all fifteen:
 *   · No component holds copy (BP-018 decision 2). Every label, empty state
 *     and tooltip is a REQUIRED prop with no default and no fallback. A
 *     default string is a product sentence nobody wrote and nobody can find
 *     — so the types below have no optional label anywhere.
 *   · Structure is daisyUI's class, tone is a named token. There is no hex
 *     and no px in this file.
 */
import type { ReactNode } from "react";
import { Num } from "@/components/Num";
import { type IntendedEmptyTone, type Tone, toneClass } from "./tone";

/* ── 1 · Btn ─────────────────────────────────────────────────────────────
   daisyUI `btn`. `label` required. Also carries the copy-to-clipboard
   affordance — no separate copy component exists, and none should be
   registered (components.md §4, "Not gaps"). */
export type BtnVariant = "primary" | "ghost" | "danger";
export type BtnState = "default" | "disabled" | "in-flight";

export function Btn({
  label,
  variant = "primary",
  size,
  block,
  state = "default",
  icon,
}: {
  label: string;
  variant?: BtnVariant;
  size?: "sm";
  block?: boolean;
  state?: BtnState;
  icon?: ReactNode;
}) {
  const cls = [
    "btn",
    variant === "primary" ? "btn-primary" : "btn-ghost",
    size === "sm" ? "btn-sm" : "",
    block ? "btn-block" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      className={cls}
      disabled={state !== "default"}
      style={
        variant === "danger"
          ? { color: "var(--bad)", borderColor: "var(--bad-line)" }
          : undefined
      }
    >
      {icon}
      {label}
      {state === "in-flight" ? <Num>…</Num> : null}
    </button>
  );
}

/* ── 2 · Card ────────────────────────────────────────────────────────────
   The title slot takes a VERDICT NODE, not a metric label — §2.5: the card
   leads with the answer. `degraded` renders one written line in place of a
   missing section: never an empty card, never a spinner. */
export function Card({
  eyebrow,
  verdict,
  children,
  degraded,
  provenance,
  accent,
}: {
  eyebrow?: string;
  verdict: ReactNode;
  children?: ReactNode;
  degraded?: string;
  provenance?: ReactNode;
  accent?: boolean;
}) {
  return (
    <section className={`card rk-card${accent ? " rk-card-accent" : ""}`}>
      <div className="card-body rk-card-body">
        {eyebrow ? <p className="eb">{eyebrow}</p> : null}
        <div className="card-title" style={{ margin: 0 }}>
          {verdict}
        </div>
        {degraded ? <p className="explain">{degraded}</p> : children}
        {provenance ? <p className="prov">{provenance}</p> : null}
      </div>
    </section>
  );
}

/* ── 3 · Badge ───────────────────────────────────────────────────────────
   Requires a text child — a tone alone may never carry meaning. */
export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`badge ${toneClass(tone)}`}>{children}</span>;
}

/* ── 4 · Alert ───────────────────────────────────────────────────────────
   `message` required; no default empty-state sentence. */
export function Alert({
  tone,
  message,
  action,
}: {
  tone: Tone;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className={`alert ${toneClass(tone)}`} role="status">
      <span className="grow">{message}</span>
      {action}
    </div>
  );
}

/** The empty state, typed. §2.5: an empty queue is a success state — so the
 *  tone here admits `neutral` and `ok` and nothing else. Passing `bad` is a
 *  compile error, which is the only way this rule is ever actually held. */
export function EmptyState({
  tone,
  message,
}: {
  tone: IntendedEmptyTone;
  message: string;
}) {
  return <Alert tone={tone} message={message} />;
}

/* ── 5 · Stat ────────────────────────────────────────────────────────────
   Value renders through the mono numeral utility. One headline number per
   module; every value carries its delta OR its goal, never bare — expressed
   as a union so "bare" has no representation. */
type StatBase = {
  label: string;
  /** `measured` prints the value · `measured-zero` prints 0, a measurement
   *  and never an error · `unmeasured` prints — plus one written line. */
  state: "measured" | "measured-zero" | "unmeasured";
  value?: string;
  unmeasuredAccount?: string;
  extra?: ReactNode;
};

/** Exactly one companion, and never none: a bare value has no shape to pass. */
export type StatProps = StatBase &
  ({ delta: ReactNode; goal?: undefined } | { goal: ReactNode; delta?: undefined });

export function Stat(props: StatProps) {
  const { label, state, value, unmeasuredAccount, extra } = props;
  const companion = props.delta ?? props.goal;
  return (
    <div className="stats" style={{ background: "transparent", display: "block" }}>
      <div className="stat" style={{ padding: 0 }}>
        <p className="eb">{label}</p>
        <div className="row" style={{ alignItems: "baseline" }}>
          <span className="rk-num-big">
            <Num>{state === "measured-zero" ? "0" : state === "unmeasured" ? "—" : value}</Num>
          </span>
          {companion}
        </div>
        {state === "unmeasured" && unmeasuredAccount ? (
          <p className="explain">{unmeasuredAccount}</p>
        ) : null}
        {extra}
      </div>
    </div>
  );
}

/* ── 6 · Tabs ────────────────────────────────────────────────────────────
   Boxed + bordered. Every tab label required. */
export function Tabs({
  tabs,
  selected,
  onSelect,
}: {
  tabs: readonly string[];
  selected: number;
  onSelect?: (i: number) => void;
}) {
  return (
    <div role="tablist" className="tabs tabs-box tabs-border">
      {tabs.map((label, i) => (
        <button
          key={label}
          type="button"
          role="tab"
          className={`tab${i === selected ? " tab-active" : ""}`}
          aria-selected={i === selected}
          onClick={onSelect ? () => onSelect(i) : undefined}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/* ── 7 · Table ───────────────────────────────────────────────────────────
   ALWAYS inside an overflow-x-auto wrap — the wrap is part of the
   component, not the caller's job. Empty takes a caller-supplied written
   line. Never a skeleton: there is no `loading` prop to pass. */
export function Table({
  columns,
  rows,
  empty,
}: {
  columns: readonly string[];
  rows: readonly ReactNode[][];
  /** Required: components.md gives Table no default empty sentence. */
  empty: string;
}) {
  return (
    <div className="overflow-x-auto">
      {rows.length === 0 ? (
        <p className="explain" style={{ padding: "var(--s-3)" }}>
          {empty}
        </p>
      ) : (
        <table className="table table-zebra">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c} className="t-xs">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((cell, j) => (
                  <td key={j} className="t-sm">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ── 8 · Progress ────────────────────────────────────────────────────────
   DETERMINATE ONLY. `value` and `max` are both required and neither is
   nullable, so an indeterminate bar cannot be requested. This is also the
   three driver mini-bars of the report header strip — not a sixth chart. */
export function Progress({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  return (
    <div className="stack-1">
      <div className="between t-xs">
        <span className="dim">{label}</span>
        <Num>
          {value}/{max}
        </Num>
      </div>
      <progress className="progress" value={value} max={max} />
    </div>
  );
}

/* ── 9 · Toggle ──────────────────────────────────────────────────────────
   Label required; no default on/off wording. */
export function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <label className="row t-sm" style={{ cursor: disabled ? "default" : "pointer" }}>
      <input
        type="checkbox"
        className="toggle"
        checked={checked}
        disabled={disabled}
        onChange={onChange ? (e) => onChange(e.target.checked) : () => undefined}
      />
      <span>{label}</span>
    </label>
  );
}

/* ── 10 · Steps ──────────────────────────────────────────────────────────
   EACH step's label is required — this is what a scan's named stages render
   through, so an unlabelled step cannot exist (REQ-003 c1: never an
   unlabelled spinner). */
export type Step = { label: string; state: "pending" | "active" | "done" };

export function Steps({ steps }: { steps: readonly Step[] }) {
  return (
    <ul className="steps">
      {steps.map((s) => (
        <li
          key={s.label}
          className="step t-xs"
          style={{
            color: s.state === "pending" ? "var(--ink-3)" : "var(--ink)",
          }}
          data-state={s.state}
        >
          {s.label}
        </li>
      ))}
    </ul>
  );
}

/* ── 11 · Join ───────────────────────────────────────────────────────────
   Layout only. */
export function Join({ children }: { children: ReactNode }) {
  return <div className="join">{children}</div>;
}

/* ── 12 · Collapse ───────────────────────────────────────────────────────
   Summary text required. Server-rendered body, not a lazy fetch — REQ-009
   c6 is readable without JavaScript, so this is <details>, which is. */
export function Collapse({
  summary,
  children,
  open,
}: {
  summary: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details
      className="collapse collapse-arrow rk-card"
      open={open}
      style={{ borderRadius: "var(--r-field)" }}
    >
      <summary className="collapse-title t-sm" style={{ fontWeight: 700 }}>
        {summary}
      </summary>
      <div className="collapse-content">{children}</div>
    </details>
  );
}

/* ── 13 · Input ──────────────────────────────────────────────────────────
   Placeholder AND label required, never defaulted. */
export function Input({
  label,
  placeholder,
  value,
  state = "default",
  invalidAccount,
  onChange,
}: {
  label: string;
  placeholder: string;
  value?: string;
  state?: "default" | "invalid" | "disabled";
  /** Required when state is invalid — one written line, value intact. */
  invalidAccount?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <label className="stack-1">
      <span className="eb">{label}</span>
      <input
        className="input"
        placeholder={placeholder}
        value={value}
        disabled={state === "disabled"}
        onChange={onChange ? (e) => onChange(e.target.value) : () => undefined}
        style={
          state === "invalid"
            ? { borderColor: "var(--bad-line)", background: "var(--bad-bg)" }
            : undefined
        }
      />
      {state === "invalid" && invalidAccount ? (
        <span className="explain" style={{ color: "var(--bad)" }}>
          {invalidAccount}
        </span>
      ) : null}
    </label>
  );
}

/* ── 14 · Divider ────────────────────────────────────────────────────────
   Layout only. */
export function Divider() {
  return <div className="divider" style={{ margin: "var(--s-2) 0" }} />;
}

/* ── 15 · Kbd ────────────────────────────────────────────────────────────
   Renders through the mono utility — a code-like string under §2.3.
   INLINE ONLY; it is not a code block. */
export function Kbd({ children }: { children: string }) {
  return (
    <kbd className="kbd kbd-sm">
      <Num>{children}</Num>
    </kbd>
  );
}
