"use client";

/**
 * THE IDIOM'S PARTS.
 *
 * Everything in this file is `proposed` (components.md §7). Two of the five
 * are contract WIDENINGS of registered components and are drawn here so the
 * owner can rule on the widening; three are compositions over registered
 * components and are registry rows nowhere, by components.md §4's own rule
 * that a screen composition "must not become" one.
 *
 *   IdiomScope   composition — the scope element and the numeral switch.
 *   CardHead     WIDENING of `Card`: an icon chip and an optional right-hand
 *                pill beside the eyebrow the row already has.
 *   IdiomBtn     WIDENING of `Btn`: an outline secondary and a quiet
 *                tertiary beside the registered primary/ghost, all at
 *                --r-pill.
 *   ActionPanel  A NEW REGISTRY ROW, proposed. The single biggest lift from
 *                the reference: anything that asks the customer to act is a
 *                tinted panel, not an alert and not a bare button.
 *   Bar          WIDENING of `Progress`: the determinate bar skinned for an
 *                accent ground. Not a sixth chart form.
 *
 * No component in this file holds copy. Every label, line and account is a
 * required prop with no default and no fallback (BP-018 decision 2).
 */
import { useState, type ReactNode } from "react";
import { Num } from "@/components/Num";

/* ── IdiomScope ──────────────────────────────────────────────────────────
   The `.ci` scope, plus THE NUMERAL SWITCH — one attribute driving one
   token, defaulting to the value BUILD.md §2.3 states. The control is drawn
   in --pv-* chrome and is preview furniture: it is not a product control
   and no customer ever sees it. */
export function IdiomScope({
  children,
  note,
}: {
  children: ReactNode;
  /** Reviewer-facing. Rendered in --pv-* above the surface, never inside. */
  note?: ReactNode;
}) {
  const [numerals, setNumerals] = useState<"mono" | "sans">("mono");
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--s-3)",
          flexWrap: "wrap",
          padding: "var(--s-2) var(--s-4)",
          borderBottom: "var(--border-hair) solid var(--pv-line)",
          background: "var(--pv-sunk)",
          fontSize: "var(--t-xs)",
          color: "var(--pv-dim)",
        }}
      >
        <span className="pv-flag">nothing here is signed</span>
        <span>headline numerals</span>
        <span className="pv-toggle" role="group" aria-label="headline numerals">
          <button
            type="button"
            data-current={numerals === "mono" ? "true" : "false"}
            onClick={() => setNumerals("mono")}
          >
            mono — conforms to §2.3
          </button>
          <button
            type="button"
            data-current={numerals === "sans" ? "true" : "false"}
            onClick={() => setNumerals("sans")}
          >
            sans 800 — not ruled
          </button>
        </span>
        {note}
      </div>
      <div className="rk ci" data-numerals={numerals}>
        {children}
      </div>
    </>
  );
}

/* ── CardHead ────────────────────────────────────────────────────────────
   A 30px-class rounded-square icon chip in --accent-bg/--accent, an 11px
   uppercase eyebrow at --t-eyebrow-track in --ink-3, and an optional pill
   on the right. The chip is --s-6 square: the ladder is closed and 32 is
   the rung the idiom's drawing lands on (tokens.md §9).

   `eyebrow` is required. A card head with no label is a card that leads
   with a picture, and §2.5 says every card leads with the answer. */
export function CardHead({
  icon,
  eyebrow,
  pill,
}: {
  icon: ReactNode;
  eyebrow: string;
  pill?: ReactNode;
}) {
  return (
    <div className="ci-head">
      <span className="ci-head-l">
        <span className="ci-chip" aria-hidden>
          {icon}
        </span>
        <span className="eb">{eyebrow}</span>
      </span>
      {pill ?? null}
    </div>
  );
}

/* ── IdiomCard ───────────────────────────────────────────────────────────
   The registered `Card`'s classes (`card`/`card-body`, and this app's
   `.rk-card`/`.rk-card-body`) with the head slot the widening adds. It is
   the same box the four sheets draw; what `.ci` changes about it is the
   border, the radius and the shadow, and all three are CSS.

   `head` is required. `pad="lg"` is the "--s-6 for a larger card" arm and
   is opted into by the caller — a card never infers its own padding from
   how wide its column happens to be. */
export function IdiomCard({
  head,
  children,
  pad,
}: {
  head: ReactNode;
  children: ReactNode;
  pad?: "lg";
}) {
  return (
    <section className="card rk-card" data-pad={pad}>
      <div className="card-body rk-card-body">
        {head}
        {children}
      </div>
    </section>
  );
}

/* ── IdiomBtn ────────────────────────────────────────────────────────────
   Three arms, one solid. `primary` is the registered daisyUI `btn-primary`
   at --r-pill; `secondary` and `tertiary` are the proposed widening, and
   `on-accent` is the inversion a solid primary takes when its ground is
   already the accent. `label` is required.

   This does not re-implement `Btn` — it draws the arms `Btn` does not have
   so the owner has something to rule on. Production UI code names `Btn`. */
export type IdiomBtnVariant = "primary" | "secondary" | "tertiary" | "on-accent";

export function IdiomBtn({
  label,
  variant,
  icon,
  block,
  size,
}: {
  label: string;
  variant: IdiomBtnVariant;
  icon?: ReactNode;
  block?: boolean;
  size?: "sm";
}) {
  const cls = [
    "btn",
    variant === "primary" ? "btn-primary" : "btn-ghost",
    variant === "secondary" ? "ci-btn-secondary" : "",
    variant === "tertiary" ? "ci-btn-tertiary" : "",
    variant === "on-accent" ? "ci-btn-on-accent" : "",
    size === "sm" ? "btn-sm" : "",
    block ? "btn-block" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" className={cls}>
      {icon}
      {label}
    </button>
  );
}

/* ── StatFigure — a PROPOSED WIDENING of `Stat` ──────────────────────────
   `Stat` renders its own eyebrow label. The idiom's card head already
   carries one, and a tile with two eyebrows states the same claim twice
   (rule 2.4) — so `Stat`'s label needs to be PLACEABLE IN THE HEAD rather
   than always printed above the figure. This draws that arm: `Stat` minus
   the label, with everything else held exactly as registered.

   Everything registered about `Stat` survives here and is meant to:
     · the value goes through the mono numeral utility, so the headline
       numeral question is one token away and never a component's business
     · the companion is a union — `delta` XOR `goal`, never neither. A bare
       value has no shape to pass (§4.5's data rule)
     · three states: measured · measured-zero, which PRINTS 0 because 0 is a
       measurement · unmeasured, which prints — plus one written line.

   `label` is still required, and is still the caller's. It is passed
   through to the accessible name so the figure is never an unlabelled
   number to a screen reader just because the label moved into the head. */
type StatFigureBase = {
  label: string;
  state: "measured" | "measured-zero" | "unmeasured";
  value?: string;
  unmeasuredAccount?: string;
  extra?: ReactNode;
};

export type StatFigureProps = StatFigureBase &
  ({ delta: ReactNode; goal?: undefined } | { goal: ReactNode; delta?: undefined });

export function StatFigure(props: StatFigureProps) {
  const { label, state, value, unmeasuredAccount, extra } = props;
  const companion = props.delta ?? props.goal;
  const shown = state === "measured-zero" ? "0" : state === "unmeasured" ? "—" : value;
  return (
    <div className="stack-2">
      <div className="row" style={{ alignItems: "baseline" }}>
        <span className="rk-num-big" aria-label={`${label} ${shown ?? ""}`}>
          {/* Through <Num>, never around it: `Num` is the only thing in src/
              that emits the numeral utility, and the utility is what binds
              --font-mono and tabular-nums together (globals.css §4). */}
          <Num>{shown}</Num>
        </span>
        {companion}
      </div>
      {state === "unmeasured" && unmeasuredAccount ? (
        <p className="explain">{unmeasuredAccount}</p>
      ) : null}
      {extra}
    </div>
  );
}

/* ── ActionPanel — PROPOSED REGISTRY ROW ─────────────────────────────────
   Tone admits `accent` and `warn` and nothing else, and that is a type-level
   refusal rather than a convention: --ok/--warn/--bad are state colours
   (§2.5) and a request to act is not a state. `ok` and `bad` have no
   position to pass.

   Three states, all required to be expressible before this can be built:
     default   the CTA is offered
     in-flight the CTA is disabled while the action posts — never removed,
               so the panel does not change height under the pointer
     withheld  the action cannot be taken right now. ONE WRITTEN LINE takes
               the CTA's place. A disabled button with no account is the
               defect this state exists to make unbuildable, so `withheld`
               carries a required account and has no `cta` member at all. */
export type ActionPanelTone = "accent" | "warn";

type ActionPanelBase = {
  tone: ActionPanelTone;
  icon: ReactNode;
  /** Owner's. Required, no default. */
  title: string;
  /** Owner's. ONE short explanatory line — §2.5's dim line, not a paragraph. */
  line: string;
};

export type ActionPanelProps = ActionPanelBase &
  (
    | { state: "default"; cta: string; withheldAccount?: undefined }
    | { state: "in-flight"; cta: string; withheldAccount?: undefined }
    | { state: "withheld"; withheldAccount: string; cta?: undefined }
  );

export function ActionPanel(props: ActionPanelProps) {
  const { tone, icon, title, line } = props;
  return (
    <div className="ci-panel" data-tone={tone}>
      <span className="ci-panel-chip" aria-hidden>
        {icon}
      </span>
      <div className="ci-panel-body">
        <p className="ci-panel-title">{title}</p>
        <p className="explain">{line}</p>
      </div>
      <div className="ci-panel-cta">
        {props.state === "withheld" ? (
          <span className="explain">{props.withheldAccount}</span>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={props.state === "in-flight"}
          >
            {props.cta}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Bar ─────────────────────────────────────────────────────────────────
   `Progress`, determinate, skinned for an accent ground. `value` and `max`
   are both required and neither is nullable, so an indeterminate bar cannot
   be requested — the registered rule, unchanged. `label` is required and is
   rendered by the caller, not here: on the sign-in panel the label and the
   figure are already above the bar, and printing them again inside it would
   be the same claim twice (rule 2.4). */
export function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <span
      className="ci-bar-track"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <span className="ci-bar-fill" style={{ width: `${(value / max) * 100}%` }} />
    </span>
  );
}
