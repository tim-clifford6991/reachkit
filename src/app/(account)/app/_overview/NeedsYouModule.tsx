// UI-SPEC S12 · BUILD §4.5 item 5 — "Needs you", the tinted panels.
//
// The approved set (owner, 2026-09-08) draws the alerts as their own card,
// headed "Needs you", each alert an `ActionPanel`: a chip, a bold title, one
// dim line and one pill. §4.5 wrote them as rows under "This week"; the set
// is the newer artifact and this is where they moved (issue #353).
//
// **The two kinds are two panels, and the difference is not decoration.**
// tokens.md §9.1 gives a screen one solid fill, and this card is where the
// set spends it: the page about to publish takes the warn ground and the
// solid "Read it", because the window closes whether or not the customer
// acts; the broken connection takes the accent ground and the outline
// "Reconnect", because nothing happens until they do. `PANEL` is that
// mapping, a `Record` over the model's own union — so a third alert kind
// would not compile rather than render an untoned panel.
//
// **At most two alerts, each with one control.** The cap is the model's
// (`readAlerts`), so this file cannot raise it — it renders the list it is
// given. Where more exist, the remainder is a written count with where to
// see it, never a third panel.
//
// **A panel whose words are not written does not render.** This screen's
// rule (`tests/app/overview/page.test.tsx`: "no owner-owed key renders
// anything at all") is stricter than the app's, and the set draws both
// alert titles bracketed — they are the owner's. So today this card states
// its head and, where nothing is waiting, its empty line; each panel
// appears the moment its title and its line are written, with no code
// change here. A tinted panel with a blank title would be the placeholder
// the rule exists to forbid.
//
// **An empty alert list is a success state, not a blank.** §2.5: "an empty
// queue is a success state". Where nothing is waiting the module states
// `overview.alerts.empty` rather than dropping a region out of the page.
import type React from "react";
import { Bell, FileText, Plug } from "lucide-react";
import { Alert as AlertBox } from "@/ui/components";
import { copy } from "@/lib/presentation/copy";
import type { AlertTone } from "@/ui/components";
import { ActionPanel, CardHead, type ActionPanelRank, type ActionPanelTone } from "@/ui/idiom";
import { writtenLine } from "../_shell/written";
import { formatCount } from "./present";
import type { Alert, AlertKind, Overflow } from "./alerts";
import { STACK } from "./style";

/** §2.5's third rule: an intended-empty state takes `neutral` or `ok`,
 *  never `bad`/`warn`. */
const NOTHING_WAITING_TONE: AlertTone = "ok";

/** The chip's glyph size — 14px inside `.rk-head-chip`'s 32px square. */
const ICON = 14;

/** How each kind of alert is drawn, from the set's own two panels. The
 *  ground, the glyph and the CTA's rank travel together because they are
 *  one decision: what this alert is asking of the customer. */
const PANEL: Readonly<
  Record<AlertKind, { tone: ActionPanelTone; rank: ActionPanelRank; icon: React.ReactNode }>
> = Object.freeze({
  pending_veto: {
    tone: "warn",
    rank: "primary",
    icon: <FileText aria-hidden size={ICON} />,
  },
  needs_you: {
    tone: "accent",
    rank: "secondary",
    icon: <Plug aria-hidden size={ICON} />,
  },
});

/** One alert, as the set's panel — or nothing.
 *
 *  The title, the line and the control's word are owed together: a panel is
 *  a title over an explanation over a control, and any one of the three
 *  missing makes the other two state something the product cannot finish.
 *  Nothing here composes a stand-in for a key the owner has not written. */
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

/** The veto line's one slot, written from the model's own numbers. The
 *  units are a registry key's characters (`…pending-veto.left`), so no "h"
 *  or "m" is written at a call site and the module never divides. */
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
    <section className="rk-idiom-card" data-testid="overview-needs-you">
      <CardHead icon={<Bell aria-hidden size={ICON} />} eyebrow={copy("overview.needs-you.title")} />
      <div style={STACK} data-testid="overview-alerts">
        {panels}
        {emptyLine === null ? null : <AlertBox tone={NOTHING_WAITING_TONE} message={emptyLine} />}
        {overflowLine === null ? null : (
          <p className="rk-quiet" data-testid="overview-overflow">
            {overflowLine}
          </p>
        )}
      </div>
    </section>
  );
}
