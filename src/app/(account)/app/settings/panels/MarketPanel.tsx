// BUILD §4.7 — "**Your market** (chip + Edit + 'changing this rebuilds the
// search set and the 12 questions next Monday')".
//
// Two of the fourteen settable keys live here: `category`, which §4.7 draws as
// a chip with an Edit beside it, and `domain` — "the domain the site is
// measured and published under" (REQ-070 c1), which belongs with the market
// because changing either one has the same consequence and the same clock.
//
// That consequence is the card's one written line, and it is stated once for
// the card rather than twice for the two controls: REQ-071 puts the domain,
// the category and the competitor set all at the next weekly re-measurement
// and never on save, so a second copy of the line beside the second control
// would be the same sentence pretending to be two facts.
//
// The controls are offered; nothing here writes. The write path is
// `applySettings` and the change rules that give it teeth (issue #42) — until
// then Edit is a control with no handler, which `Btn` supports by making
// `onClick` optional, rather than a control wired to a second way of changing
// the market.
import type React from "react";
import { Btn } from "@/ui/components/Btn";
import { Card } from "@/ui/components/Card";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../../_shell/written";
import type { SettingsModel } from "../model";

export function MarketPanel(p: { settings: SettingsModel }): React.JSX.Element {
  const effect = writtenLine("settings.market.effect");

  return (
    <Card state="default" title={<h2>{copy("settings.market.title")}</h2>}>
      <div className="rk-settings-fields">
        <div className="rk-settings-field" data-testid="setting-category">
          <span className="rk-settings-label">{copy("settings.market.category")}</span>
          <div className="rk-settings-row">
            {/* §2.3: a search query and the buyer vocabulary it is written in
                are code-like strings, so the chip is mono. */}
            <span className="rk-settings-chip num">{p.settings.market.category}</span>
            <Btn label={copy("settings.edit")} size="sm" />
          </div>
        </div>

        <div className="rk-settings-field" data-testid="setting-domain">
          <span className="rk-settings-label">{copy("settings.market.domain")}</span>
          <div className="rk-settings-row">
            <span className="rk-settings-value num">{p.settings.domain}</span>
            <Btn label={copy("settings.edit")} size="sm" />
          </div>
        </div>
      </div>

      {effect === null ? null : <p className="rk-settings-line">{effect}</p>}
    </Card>
  );
}
