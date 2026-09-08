// BUILD §2.2, §2.5 — the approved card idiom's tinted panel (issue #266).
// src/ui/idiom/ActionPanel.tsx
//
// design/tokens.md §9.1, verbatim: "**Anything asking the customer to act
// is a tinted panel** — `--accent-bg` or `--warn-bg`, a white icon chip, a
// bold title, one dim explanatory line, a pill CTA." It is the idiom's one
// genuinely new row (`components.md` §7, `proposed`), and it is **not** a
// daisyUI component: BUILD §2.2's set of fifteen is closed and this is not
// a sixteenth member of it, which is why it lives here and not in
// `src/ui/components/`'s barrel.
//
// TONE ADMITS `accent` AND `warn` ONLY. `--ok`/`--warn`/`--bad` are state
// colours (§2.5) and a panel is not a state, so `ok` and `bad` have no
// position here. The union below is what enforces it; the stylesheet alone
// could not.
//
// The three states are a discriminated union so that a panel cannot be
// asked for without the thing it needs: `default` and `in-flight` require
// the CTA's label, and `withheld` requires the one written line that says
// why the action is not offered — never a disabled control with no account.
//
// **The CTA may navigate, and then it is an `<a>`** (issue #353). Overview's
// two Needs-you panels take the customer to a draft and to the settings
// card; `Btn` is a `<button>` with an `onClick`, and a panel that posted
// nowhere would need client JavaScript to move. So `href` selects an anchor
// carrying the same classes the rank would have put on the button — the
// third instance of the "link that reads as a button" case the component
// registry already records two rows for, and it carries its own row.
//
// **The rank is the caller's** (issue #353). The set draws the veto panel's
// "Read it" as the solid primary and the reconnect panel's "Reconnect" as
// the outline secondary in accent: two calls to act, one screen, and §9.1
// gives the screen one solid fill. `rank` defaults to `primary`, so the
// panel keeps the single shape it shipped with wherever a caller says
// nothing.
import type React from "react";
import { Btn } from "../components/Btn";

export type ActionPanelTone = "accent" | "warn";

/** The two ranks a panel's CTA may take. The outline arm is always the
 *  accent tone — an untoned outline beside a solid primary reads as the
 *  quiet tertiary, and this control is not quiet. */
export type ActionPanelRank = "primary" | "secondary";

/** The classes an anchor needs to read as the ranked pill. daisyUI's own,
 *  written here because the rank's markup is a `<button>` and this control
 *  navigates; `component-registry.test.ts` carries the row. */
const LINK_CLASS: Readonly<Record<ActionPanelRank, string>> = Object.freeze({
  primary: "btn btn-sm btn-primary rk-pill",
  secondary: "btn btn-sm btn-ghost rk-btn-outline rk-pill",
});

type ActionPanelBase = {
  tone: ActionPanelTone;
  icon: React.ReactNode;
  /** Owner's. Required, no default. */
  title: string;
  /** Owner's. One short explanatory line — §2.5's dim line, not a paragraph. */
  line: string;
};

export type ActionPanelProps = ActionPanelBase & {
  /** The CTA's rank. `primary` where a caller says nothing. */
  rank?: ActionPanelRank;
} & (
    | {
        state: "default";
        cta: string;
        /** Where the CTA goes, for a panel whose action is a navigation.
         *  Mutually exclusive with `onAct`: a control that both moved and
         *  fired would be two actions on the panel §9.1 gives one. */
        href?: string;
        onAct?: undefined;
      }
    | { state: "default"; cta: string; onAct?: () => void; href?: undefined }
    | { state: "in-flight"; cta: string; onAct?: undefined; href?: undefined }
    | { state: "withheld"; withheldAccount: string; cta?: undefined; onAct?: undefined; href?: undefined }
  );

export function ActionPanel(p: ActionPanelProps): React.JSX.Element {
  return (
    <div className="rk-panel" data-tone={p.tone}>
      <span className="rk-panel-chip" aria-hidden>
        {p.icon}
      </span>
      <div className="rk-panel-body">
        <p className="rk-panel-title">{p.title}</p>
        <p className="rk-quiet">{p.line}</p>
      </div>
      <div className="rk-panel-cta">
        {/* The registered `Btn`, not markup of its own: daisyUI component
            classes are written inside `src/ui/components/**` and nowhere
            else, and a panel that hand-wrote `btn` would be the sixteenth
            component arriving by class name. */}
        {p.state === "withheld" ? (
          <span className="rk-quiet">{p.withheldAccount}</span>
        ) : p.state === "default" && p.href !== undefined ? (
          <a className={LINK_CLASS[p.rank ?? "primary"]} href={p.href} data-tone={toneOf(p.rank)}>
            {p.cta}
          </a>
        ) : (p.rank ?? "primary") === "secondary" ? (
          <Btn
            label={p.cta}
            variant="secondary"
            tone="accent"
            size="sm"
            pill
            disabled={p.state === "in-flight"}
            inFlight={p.state === "in-flight"}
            onClick={p.state === "default" ? p.onAct : undefined}
          />
        ) : (
          <Btn
            label={p.cta}
            variant="primary"
            size="sm"
            pill
            disabled={p.state === "in-flight"}
            inFlight={p.state === "in-flight"}
            onClick={p.state === "default" ? p.onAct : undefined}
          />
        )}
      </div>
    </div>
  );
}

/** The outline rank's tone, as the attribute `idiom.css` keys the accent
 *  edge off. The solid rank carries none: a tone on a fill is the second
 *  solid §9.1 forbids. */
function toneOf(rank: ActionPanelRank | undefined): "accent" | undefined {
  return (rank ?? "primary") === "secondary" ? "accent" : undefined;
}
