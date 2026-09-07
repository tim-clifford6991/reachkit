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
import type React from "react";

export type ActionPanelTone = "accent" | "warn";

type ActionPanelBase = {
  tone: ActionPanelTone;
  icon: React.ReactNode;
  /** Owner's. Required, no default. */
  title: string;
  /** Owner's. One short explanatory line — §2.5's dim line, not a paragraph. */
  line: string;
};

export type ActionPanelProps = ActionPanelBase &
  (
    | { state: "default"; cta: string; onAct?: () => void; withheldAccount?: undefined }
    | { state: "in-flight"; cta: string; onAct?: undefined; withheldAccount?: undefined }
    | { state: "withheld"; withheldAccount: string; cta?: undefined; onAct?: undefined }
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
        {p.state === "withheld" ? (
          <span className="rk-quiet">{p.withheldAccount}</span>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-sm rk-pill"
            disabled={p.state === "in-flight"}
            onClick={p.state === "default" ? p.onAct : undefined}
          >
            {p.cta}
          </button>
        )}
      </div>
    </div>
  );
}
