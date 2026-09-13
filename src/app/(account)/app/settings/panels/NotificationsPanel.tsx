// Canvas: Settings — the recurring mails the customer may switch off.
//
// One settable key, `notifications`, and the rows are projected rather than
// counted out: `notificationRows` reads the `stoppable: 'toggle'` subset off
// `MAIL_KINDS`, so a fourth stoppable mail arrives here as a fourth switch.
//
// These switches reach nothing else — they are the customer's own, over
// their own recurring mails, and never the address-wide suppression store.
// REQ-075's promise closes the card: the mail that cannot be switched off is
// named, which is what makes turning all of them off a decision.
import type React from "react";
import { Bell } from "lucide-react";
import { Card, Toggle } from "@/ui/components";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../../_shell/written";
import type { SettingsModel } from "../model";
import {
  CARD_HEAD,
  CARD_LABEL,
  EXPLAIN,
  GLYPH,
  ROW,
  ROW_VALUE,
  SECTION,
  STROKE,
} from "../style";

export function NotificationsPanel(p: { settings: SettingsModel }): React.JSX.Element {
  const alwaysOn = writtenLine("settings.notifications.always-on");

  return (
    <Card
      state="default"
      title={
        <div className={CARD_HEAD}>
          <span className={CARD_LABEL}>
            <Bell size={GLYPH} strokeWidth={STROKE} aria-hidden />
            <span className="eyebrow">{copy("settings.notifications.title")}</span>
          </span>
        </div>
      }
    >
      {/* The row is a name at the near edge and a switch at the far one, so
          the customer reads one column of names and one of controls.
          `labelHidden` moves the word without losing it. */}
      <div className={SECTION} data-testid="setting-notifications">
        {p.settings.notifications.map((row) => (
          <div key={row.kind} className={ROW} data-testid={`notification-${row.kind}`}>
            <span className="min-w-0 wrap-anywhere">{copy(row.copyKey)}</span>
            <span className={ROW_VALUE}>
              <Toggle label={copy(row.copyKey)} labelHidden checked={row.on} />
            </span>
          </div>
        ))}
      </div>

      {alwaysOn === null ? null : (
        <p className={EXPLAIN} data-testid="notifications-always-on">
          {alwaysOn}
        </p>
      )}
    </Card>
  );
}
