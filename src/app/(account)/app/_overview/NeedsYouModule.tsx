// BUILD §4.5 — "Needs you": at most two items, each with one control.
//
// SPEC §4: at most two "needs you" items. The cap and the overflow count are
// the model's (`readAlerts`); this file renders the list it is given as
// daisyUI `alert`s. The page about to publish takes the warning ground,
// because its veto window closes whether or not the customer acts; a broken
// connection takes the plain one, because nothing happens until they do.
//
// **No control here is solid** (docs/DESIGN.md rule 1: one solid primary per
// screen). Since the 2026-09-20 redesign the screen's one solid button is
// *Read it* on the page waiting for review, which this card no longer
// repeats — the model drops the item the card above leads with — so a second
// page in review is an outline control beside it, not a second call to act.
//
// A panel whose title, line or control is unwritten does not render. An
// empty list is a success state, not a blank — and a quiet one (SPEC §4
// 2026-09-24, #1070): a tick and one line, never a green alert.
import type React from "react";
import { Bell, Check, FileText, Globe, Plug, Wrench } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../_shell/written";
import { formatCount } from "./present";
import type { Alert, AlertKind, Overflow } from "./alerts";

const PANEL: Readonly<Record<AlertKind, { alert: string; cta: string; Icon: typeof Bell }>> = {
  // #924: the hosted blog's address, waiting for its record. The accent
  // ground and an outline control — never the error tone, because an
  // address nobody has connected yet is work to do rather than a fault
  // (§2.5 keeps red for the customer's own problem shown to them).
  // The base tone, not a warning: connecting the blog is a thing to do,
  // not a fault. (§2.2 names four tones and no `info` one.)
  connect_blog: { alert: "alert alert-soft", cta: "btn btn-soft btn-primary btn-sm", Icon: Globe },
  pending_veto: { alert: "alert alert-warning alert-soft", cta: "btn btn-soft btn-warning btn-sm", Icon: FileText },
  needs_you: { alert: "alert alert-soft", cta: "btn btn-soft btn-primary btn-sm", Icon: Plug },
  // A technical issue the customer fixes (SPEC §9): error ground when
  // Critical, warning when Worth fixing, and the outline control to the
  // report's fix lines. Its count over its set is the stored one.
  site_issue: { alert: "alert alert-warning alert-soft", cta: "btn btn-soft btn-primary btn-sm", Icon: Wrench },
};

const CRITICAL_ALERT = "alert alert-error alert-soft";

function Panel(p: { alert: Alert }): React.JSX.Element | null {
  const title = writtenLine(p.alert.key, p.alert.vars);
  const cta = writtenLine(p.alert.actionKey);
  const line = writtenLine(p.alert.lineKey, lineVars(p.alert));
  if (title === null || cta === null || line === null) return null;

  const drawn = PANEL[p.alert.kind];
  const ground = p.alert.severity === "critical" ? CRITICAL_ALERT : drawn.alert;
  // `alert-vertical` at every width: the control sits under the line it is
  // about, which is how the approved board draws it and the only arrangement
  // that cannot push a button past the panel's edge when two panels share a
  // half-width column at 1280.
  return (
    <div
      role="alert"
      className={`${ground} alert-vertical justify-items-start text-start`}
      data-kind={p.alert.kind}
      data-testid="overview-alert"
    >
      <drawn.Icon aria-hidden size={20} strokeWidth={1.75} />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-semibold">
          {title}
          {p.alert.figure === undefined ? null : (
            <span className="badge badge-ghost num">{`${formatCount(p.alert.figure.count)}/${formatCount(p.alert.figure.over)}`}</span>
          )}
        </p>
        {/* #946: the alert's own ink, not a thinned arm of it. On the
            tinted grounds these alerts are drawn on, 70% opacity put the
            line under the contrast floor. */}
        <p className="text-xs">{line}</p>
      </div>
      <a className={drawn.cta} href={p.alert.href}>
        {cta}
      </a>
    </div>
  );
}

/** The veto line's one slot, from the model's own numbers. */
function lineVars(alert: Alert): Record<string, string> {
  if (alert.timeLeft === undefined) return {};
  const left = writtenLine("overview.alert.pending-veto.left", {
    hours: formatCount(alert.timeLeft.hours),
    minutes: formatCount(alert.timeLeft.minutes),
  });
  return left === null ? {} : { left };
}

export function NeedsYouModule(p: {
  alerts: readonly Alert[];
  overflow?: Overflow;
  issuesOverflow?: Overflow;
}): React.JSX.Element {
  const panels = p.alerts
    .map((alert) => <Panel key={alert.href} alert={alert} />)
    .filter((panel): panel is React.JSX.Element => panel !== null);
  const overflowLine =
    p.overflow === undefined
      ? null
      : writtenLine(p.overflow.whereKey, { remaining: formatCount(p.overflow.remaining) });
  const issuesOverflowLine =
    p.issuesOverflow === undefined
      ? null
      : writtenLine(p.issuesOverflow.whereKey, { remaining: formatCount(p.issuesOverflow.remaining) });
  const emptyLine = p.alerts.length === 0 ? writtenLine("overview.alerts.empty") : null;

  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid="overview-needs-you">
      <div className="card-body gap-4 p-5" data-testid="overview-alerts">
        {/* The card head, at the sub-head step the approved board draws it
            at. Plain `text-base` since #941 put the heading scale in
            `@layer base` — see `WeekModule` for the whole of it. */}
        <h2 className="card-title text-base">
          <Bell aria-hidden size={20} strokeWidth={1.75} />
          {copy("overview.needs-you.title")}
        </h2>
        {/* A list, not a two-column grid: since the 2026-09-20 redesign this
            card stands in the narrower of the two columns beside the week,
            and two panels sharing that width wrap every title. */}
        {panels.length === 0 ? null : (
          <div className="flex min-w-0 flex-col gap-3" data-testid="overview-alert-panels">
            {panels}
          </div>
        )}
        {emptyLine === null ? null : (
          <div className="flex min-w-0 flex-col items-center gap-3 py-4 text-center" data-testid="overview-alerts-empty">
            <span className="grid size-10 place-items-center rounded-full bg-success/10 text-success">
              <Check size={20} strokeWidth={2} aria-hidden />
            </span>
            <p className="font-semibold">{emptyLine}</p>
          </div>
        )}
        {overflowLine === null ? null : (
          <p className="text-xs text-base-content/70" data-testid="overview-overflow">
            {overflowLine}
          </p>
        )}
        {issuesOverflowLine === null ? null : (
          <p className="text-xs text-base-content/70" data-testid="overview-issues-overflow">
            {issuesOverflowLine}
          </p>
        )}
      </div>
    </section>
  );
}
