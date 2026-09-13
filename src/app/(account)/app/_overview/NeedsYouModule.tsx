// Canvas: Dashboard — "Needs you", the tinted panels.
//
// At most two alerts, each with one control; the cap is the model's, so this
// file renders the list it is given and the remainder is a written count,
// never a third panel. The page about to publish takes the warn ground and
// the solid fill — the window closes whether or not the customer acts; the
// broken connection takes the accent ground and the outline, because nothing
// happens until they do.
//
// A panel whose title, line or control the owner has not written does not
// render: a tinted panel with a blank title is the placeholder the rule
// exists to forbid. An empty list is a success state, not a blank.
import type React from "react";
import { Bell, FileText, Plug } from "lucide-react";
import { Alert as AlertBox, Card } from "@/ui/components";
import { copy } from "@/lib/presentation/copy";
import type { AlertTone } from "@/ui/components";
import { ActionPanel, type ActionPanelRank, type ActionPanelTone } from "@/ui/idiom";
import { writtenLine } from "../_shell/written";
import { formatCount } from "./present";
import type { Alert, AlertKind, Overflow } from "./alerts";
import { CARD_HEAD, CARD_LABEL, GLYPH, QUIET, SECTION, STROKE } from "./style";

/** §2.5's third rule: an intended-empty state takes `neutral` or `ok`. */
const NOTHING_WAITING_TONE: AlertTone = "ok";

/** The glyph inside a panel's own chip, at the idiom's proportion. */
const PANEL_GLYPH = 14;

/** How each kind of alert is drawn. The ground, the glyph and the CTA's rank
 *  travel together because they are one decision: what this alert asks of
 *  the customer. A `Record` over the model's union, so a third kind would
 *  not compile rather than render an untoned panel. */
const PANEL: Readonly<
  Record<AlertKind, { tone: ActionPanelTone; rank: ActionPanelRank; icon: React.ReactNode }>
> = Object.freeze({
  pending_veto: { tone: "warn", rank: "primary", icon: <FileText aria-hidden size={PANEL_GLYPH} /> },
  needs_you: { tone: "accent", rank: "secondary", icon: <Plug aria-hidden size={PANEL_GLYPH} /> },
});

/** One alert, as the artboard's panel — or nothing. The title, the line and
 *  the control's word are owed together: any one of the three missing makes
 *  the other two state something the product cannot finish. */
function Panel(p: { alert: Alert }): React.JSX.Element | null {
  const title = writtenLine(p.alert.key, p.alert.vars);
  const cta = writtenLine(p.alert.actionKey);
  const line = writtenLine(p.alert.lineKey, lineVars(p.alert));
  if (title === null || cta === null || line === null) return null;

  const drawn = PANEL[p.alert.kind];
  return (
    <ActionPanel
      state="default"
      tone={drawn.tone}
      rank={drawn.rank}
      icon={drawn.icon}
      title={title}
      line={line}
      cta={cta}
      href={p.alert.href}
    />
  );
}

/** The veto line's one slot. The units are a registry key's characters, so
 *  no "h" or "m" is written here and the module never divides. */
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
}): React.JSX.Element {
  const panels = p.alerts
    .map((alert) => <Panel key={alert.href} alert={alert} />)
    .filter((panel): panel is React.JSX.Element => panel !== null);
  const overflowLine =
    p.overflow === undefined
      ? null
      : writtenLine(p.overflow.whereKey, { remaining: formatCount(p.overflow.remaining) });
  const emptyLine = p.alerts.length === 0 ? writtenLine("overview.alerts.empty") : null;

  return (
    <section data-testid="overview-needs-you">
      <Card
        state="default"
        title={
          <div className={CARD_HEAD}>
            <span className={CARD_LABEL}>
              <Bell aria-hidden size={GLYPH} strokeWidth={STROKE} />
              <span className="eyebrow">{copy("overview.needs-you.title")}</span>
            </span>
          </div>
        }
      >
        <div className={SECTION} data-testid="overview-alerts">
          {/* The artboard's pair: side by side from the medium band up,
              stacked below it, and a lone panel takes the whole row. */}
          {panels.length === 0 ? null : (
            <div className={PANEL_PAIR} data-testid="overview-alert-panels">
              {panels}
            </div>
          )}
          {emptyLine === null ? null : <AlertBox tone={NOTHING_WAITING_TONE} message={emptyLine} />}
          {overflowLine === null ? null : (
            <p className={QUIET} data-testid="overview-overflow">
              {overflowLine}
            </p>
          )}
        </div>
      </Card>
    </section>
  );
}

const PANEL_PAIR = "grid min-w-0 grid-cols-1 gap-(--s-3) lg:grid-cols-2";
