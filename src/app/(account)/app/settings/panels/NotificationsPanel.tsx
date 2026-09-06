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
import type React from "react";
import { Card } from "@/ui/components/Card";
import { Toggle } from "@/ui/components/Toggle";
import { copy } from "@/lib/presentation/copy";
import type { SettingsModel } from "../model";

export function NotificationsPanel(p: { settings: SettingsModel }): React.JSX.Element {
  return (
    <Card state="default" title={<h2>{copy("settings.notifications.title")}</h2>}>
      <div className="flex min-w-0 flex-col gap-3" data-testid="setting-notifications">
        {p.settings.notifications.map((row) => (
          <div key={row.kind} data-testid={`notification-${row.kind}`}>
            <Toggle label={copy(row.copyKey)} checked={row.on} />
          </div>
        ))}
      </div>
    </Card>
  );
}
