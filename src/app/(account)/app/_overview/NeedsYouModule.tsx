// BUILD §4.5 — "Needs you": at most two items, each with one control.
//
// SPEC §4: at most two "needs you" items. The cap and the overflow count are
// the model's (`readAlerts`); this file renders the list it is given as
// daisyUI `alert`s. The page about to publish takes the warning ground and
// the screen's one solid button, because its veto window closes whether or
// not the customer acts; a broken connection takes the outline, because
// nothing happens until they do.
//
// A panel whose title, line or control is unwritten does not render. An
// empty list is a success state, not a blank.
import type React from "react";
import { Bell, FileText, Plug, Wrench } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../_shell/written";
import { formatCount } from "./present";
import type { Alert, AlertKind, Overflow } from "./alerts";

const PANEL: Readonly<Record<AlertKind, { alert: string; cta: string; Icon: typeof Bell }>> = {
  pending_veto: { alert: "alert alert-warning alert-soft", cta: "btn btn-primary btn-sm", Icon: FileText },
  needs_you: { alert: "alert alert-soft", cta: "btn btn-outline btn-sm", Icon: Plug },
  // A technical issue the customer fixes (SPEC §9): error ground when
  // Critical, warning when Worth fixing, and the outline control to the
  // report's fix lines. Its count over its set is the stored one.
  site_issue: { alert: "alert alert-warning alert-soft", cta: "btn btn-outline btn-sm", Icon: Wrench },
};

const CRITICAL_ALERT = "alert alert-error alert-soft";

function Panel(p: { alert: Alert }): React.JSX.Element | null {
  const title = writtenLine(p.alert.key, p.alert.vars);
  const cta = writtenLine(p.alert.actionKey);
  const line = writtenLine(p.alert.lineKey, lineVars(p.alert));
  if (title === null || cta === null || line === null) return null;

  const drawn = PANEL[p.alert.kind];
  const ground = p.alert.severity === "critical" ? CRITICAL_ALERT : drawn.alert;
  return (
    <div role="alert" className={ground} data-kind={p.alert.kind} data-testid="overview-alert">
      <drawn.Icon aria-hidden size={20} strokeWidth={1.75} />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-semibold">
          {title}
          {p.alert.figure === undefined ? null : (
            <span className="badge badge-ghost num">{`${formatCount(p.alert.figure.count)}/${formatCount(p.alert.figure.over)}`}</span>
          )}
        </p>
        <p className="text-xs opacity-70">{line}</p>
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
        <h2 className="card-title text-xs font-semibold uppercase tracking-wide text-base-content/60">
          <Bell aria-hidden size={20} strokeWidth={1.75} />
          {copy("overview.needs-you.title")}
        </h2>
        {panels.length === 0 ? null : (
          <div className="grid gap-3 md:grid-cols-2" data-testid="overview-alert-panels">
            {panels}
          </div>
        )}
        {emptyLine === null ? null : (
          <div role="alert" className="alert alert-success alert-soft">
            <span>{emptyLine}</span>
          </div>
        )}
        {overflowLine === null ? null : (
          <p className="text-xs text-base-content/60" data-testid="overview-overflow">
            {overflowLine}
          </p>
        )}
        {issuesOverflowLine === null ? null : (
          <p className="text-xs text-base-content/60" data-testid="overview-issues-overflow">
            {issuesOverflowLine}
          </p>
        )}
      </div>
    </section>
  );
}
