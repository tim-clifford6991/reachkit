// BUILD §4.7 — "**Notifications** (3 toggles)".
//
// One settable key, `notifications`, and the rows are *projected* rather than
// counted out: `notificationRows` reads the `stoppable: 'toggle'` subset off
// `MAIL_KINDS` (WO-179 decision 4). §4.7 says three because three is what the
// register holds; this panel maps over whatever it holds, so a fourth
// stoppable mail arrives here as a fourth switch and never as a mail a
// customer was told they could stop and could not.
//
// ADR-042 is why these switches reach nothing else: they are the customer's
// own three, over their own recurring mails, and they never touch the
// address-wide suppression store. With all three off, the sign-in link, the
// account and subscription notices, the setup reminder and the one
// unsuppressible draft-ready announcement all still arrive.
//
// **The row is a name at the near edge and a switch at the far one** (issue
// #374, UI-SPEC S18), separated by hairlines — the shape every settable row
// on this screen takes, so a customer reads one column of names and one
// column of controls rather than three switches each carrying its own word.
// `Toggle`'s `labelHidden` is what moves the word without losing it: the
// label stays required and still reaches the accessibility tree.
//
// REQ-075's own promise closes the card: the mail that cannot be switched
// off is named. That is what makes turning all three off a decision rather
// than a risk, and it is why the line belongs here and not in a footnote
// somewhere else.
import type React from "react";
import { Card } from "@/ui/components/Card";
import { Toggle } from "@/ui/components/Toggle";
import { CardHead } from "@/ui/idiom";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../../_shell/written";
import type { SettingsModel } from "../model";

export function NotificationsPanel(p: { settings: SettingsModel }): React.JSX.Element {
  const alwaysOn = writtenLine("settings.notifications.always-on");

  return (
    <Card state="default" title={<CardHead eyebrow={copy("settings.notifications.title")} />}>
      <div className="flex min-w-0 flex-col" data-testid="setting-notifications">
        {p.settings.notifications.map((row) => (
          <div
            key={row.kind}
            className="border-base-300 flex min-w-0 flex-wrap items-center justify-between gap-2 border-t py-2 first:border-t-0"
            data-testid={`notification-${row.kind}`}
          >
            <span className="min-w-0 text-sm wrap-anywhere">{copy(row.copyKey)}</span>
            <Toggle label={copy(row.copyKey)} labelHidden checked={row.on} />
          </div>
        ))}
      </div>

      {alwaysOn === null ? null : (
        <p className="text-xs opacity-60 wrap-anywhere" data-testid="notifications-always-on">
          {alwaysOn}
        </p>
      )}
    </Card>
  );
}
