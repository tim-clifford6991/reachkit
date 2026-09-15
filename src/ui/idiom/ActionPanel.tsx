// BUILD §2.2, §2.5 — the approved card idiom's tinted panel (issue #266).
// src/ui/idiom/ActionPanel.tsx
//
// design/tokens.md §9.1, verbatim: "**Anything asking the customer to act
// is a tinted panel** — `--accent-bg` or `--warn-bg`, a white icon chip, a
// bold title, one dim explanatory line, a pill CTA." It is the idiom's one
// genuinely new row (`components.md` §7, `proposed`), and it is **not** a
// daisyUI component. Its call to action is daisyUI's own `btn`, written in
// place (DESIGN.md rule 1 — no wrapper over daisyUI, issue 732).
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
// card; a `<button>` needs an `onClick`, and a panel that posted
// nowhere would need client JavaScript to move. So `href` selects an anchor
// carrying the same classes the rank puts on the button.
//
// **The rank is the caller's** (issue #353). The set draws the veto panel's
// "Read it" as the solid primary and the reconnect panel's "Reconnect" as
// the outline secondary in accent: two calls to act, one screen, and §9.1
// gives the screen one solid fill. `rank` defaults to `primary`, so the
// panel keeps the single shape it shipped with wherever a caller says
// nothing.
import type React from "react";

export type ActionPanelTone = "accent" | "warn";

/** The two ranks a panel's CTA may take. The outline arm is always the
 *  accent tone — an untoned outline beside a solid primary reads as the
 *  quiet tertiary, and this control is not quiet. */
export type ActionPanelRank = "primary" | "secondary";

/** The classes the ranked pill carries, as a `<button>` or as an `<a>`:
 *  daisyUI's own `btn`, the outline rank's edge in the accent. */
const CTA_CLASS: Readonly<Record<ActionPanelRank, string>> = Object.freeze({
  primary: "btn btn-sm btn-primary rounded-(--r-pill)",
  secondary: "btn btn-sm btn-outline [--btn-color:var(--accent)] rounded-(--r-pill)",
});

type ActionPanelBase = {
  tone: ActionPanelTone;
  icon: React.ReactNode;
  /** Owner's. Required, no default. */
  title: string;
  /** Owner's. One short explanatory line — §2.5's dim line, not a paragraph.
   *  Optional: the report's incomplete notice is drawn with its sentence and
   *  its control alone, so a panel with nothing more to say says nothing. */
  line?: string;
};

/** **`specimen` is a fourth arm and not a fourth state** (issue #351).
 *
 *  The three arms below are the panel *asking a customer to act*: the CTA
 *  is offered, the CTA is posting, or the action cannot be taken and one
 *  written line says why. The approved screen set draws the panel one more
 *  way, and it is none of those three — inside the landing's This-week card
 *  (UI-SPEC S1), where the panel is a **picture of the product** shown to a
 *  stranger. It carries no CTA there (the set draws none, and a solid
 *  accent CTA a visitor cannot use would be a third solid on a page ruling
 *  2b gives two) and no withheld account either, because nothing is being
 *  withheld from anyone: the panel is showing what the product does, not
 *  refusing to do it.
 *
 *  `withheld` is deliberately not reused for it. That arm's whole guarantee
 *  is "a disabled button with no account is unbuildable", which it keeps by
 *  requiring the account — and making the account optional to fit this case
 *  would give the guarantee away on the two screens that do ask for action.
 *
 *  Its title and line stay required and stay the owner's: a specimen of a
 *  panel is a panel, and it says what the real one says. */
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
    | { state: "specimen"; cta?: undefined; onAct?: undefined; href?: undefined; withheldAccount?: undefined }
  );

export function ActionPanel(p: ActionPanelProps): React.JSX.Element {
  return (
    <div className="rk-panel" data-tone={p.tone}>
      <span className="rk-panel-chip" aria-hidden>
        {p.icon}
      </span>
      <div className="rk-panel-body">
        <p className="rk-panel-title">{p.title}</p>
        {p.line === undefined ? null : <p className="rk-quiet">{p.line}</p>}
      </div>
      {p.state === "specimen" ? null : (
        <div className="rk-panel-cta">
          {p.state === "withheld" ? (
            <span className="rk-quiet">{p.withheldAccount}</span>
          ) : p.state === "default" && p.href !== undefined ? (
            <a className={CTA_CLASS[p.rank ?? "primary"]} href={p.href} data-tone={toneOf(p.rank)}>
              {p.cta}
            </a>
          ) : (
            <button
              type="button"
              className={CTA_CLASS[p.rank ?? "primary"]}
              data-tone={toneOf(p.rank)}
              disabled={p.state === "in-flight"}
              aria-busy={p.state === "in-flight" ? "true" : undefined}
              onClick={p.state === "default" ? p.onAct : undefined}
            >
              {p.cta}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** The outline rank's tone, as the attribute `idiom.css` keys the accent
 *  edge off. The solid rank carries none: a tone on a fill is the second
 *  solid §9.1 forbids. */
function toneOf(rank: ActionPanelRank | undefined): "accent" | undefined {
  return (rank ?? "primary") === "secondary" ? "accent" : undefined;
}
