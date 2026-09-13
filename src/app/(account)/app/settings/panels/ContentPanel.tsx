// Canvas: Settings — the pages the customer owns: how many there are, and
// how to take them all away.
//
// "Always available" is enforced by having no condition: there is no plan,
// setup or account state that gates export, and the way to keep it that way
// is for this file to hold no branch around the control at all.
//
// The pages count is ReachKit's own number, not a billing one.
"use client";

import type React from "react";
import { FileText } from "lucide-react";
import { Btn, Card } from "@/ui/components";
import { copy } from "@/lib/presentation/copy";
import { useAction } from "./useAction";
import type { SettingsModel } from "../model";
import {
  CARD_HEAD,
  CARD_LABEL,
  EXPLAIN,
  FIGURE,
  GLYPH,
  ROW,
  ROW_NAME,
  SECTION,
  STROKE,
} from "../style";

export function ContentPanel(p: { settings: SettingsModel }): React.JSX.Element {
  const action = useAction();

  return (
    <Card
      state="default"
      title={
        <div className={CARD_HEAD}>
          <span className={CARD_LABEL}>
            <FileText size={GLYPH} strokeWidth={STROKE} aria-hidden />
            <span className="eyebrow">{copy("settings.content.title")}</span>
          </span>
        </div>
      }
    >
      <div className={SECTION}>
        {/* The label at the near edge and the figure at the far one: the
            card's one headline number. */}
        <div className={ROW}>
          <span className={ROW_NAME}>{copy("settings.content.pages")}</span>
          <span className={FIGURE} data-testid="content-pages">
            {p.settings.content.pages}
          </span>
        </div>

        {/* The card's own full-width outline pill — outline, not a fill:
            the screen has one solid primary and this is not it. */}
        <div className="min-w-0" data-testid="action-export">
          <Btn
            label={copy("settings.content.export")}
            variant="secondary"
            tone="accent"
            pill
            block
            onClick={() => action.run("export")}
          />
        </div>

        {action.line === null ? null : <p className={EXPLAIN}>{action.line}</p>}
      </div>
    </Card>
  );
}
