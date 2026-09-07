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
  // REQ-071 c1 and c6 (issue #204). One written line either way: a dated
  // one while a change stands, the card's standing one otherwise. The
  // model chose which and wrote the date; this panel renders it and states
  // nothing of its own — `{change}` is the owner's word for the answer,
  // read from its own key, never the engine's `domain` / `category`.
  // `data-testid` is `market-change-line` and not `setting-market-change`:
  // the `setting-*` namespace is REQ-070 c1's closed offer of exactly the
  // fourteen controls, and this is a written line rather than a control
  // (`screen.test.tsx` reads that namespace off the document).
  const change = p.settings.market.change;
  const dated =
    change === null
      ? null
      : change.saved
        ? writtenLine("settings.market.effectiveOn", { date: change.on })
        : writtenLine("settings.market.pending", {
            date: change.on,
            change: copy(change.changeKey),
          });
  const effect = change === null ? writtenLine("settings.market.effect") : null;

  return (
    <Card state="default" title={<h2>{copy("settings.market.title")}</h2>}>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex min-w-0 flex-col gap-1" data-testid="setting-category">
          <span className="eyebrow opacity-60">{copy("settings.market.category")}</span>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {/* §2.3: a search query and the buyer vocabulary it is written in
                are code-like strings, so the chip is mono. */}
            <span className="num inline-flex min-w-0 items-center gap-2 wrap-anywhere">{p.settings.market.category}</span>
            <Btn label={copy("settings.edit")} size="sm" />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-1" data-testid="setting-domain">
          <span className="eyebrow opacity-60">{copy("settings.market.domain")}</span>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="num min-w-0 wrap-anywhere">{p.settings.domain}</span>
            <Btn label={copy("settings.edit")} size="sm" />
          </div>
        </div>
      </div>

      {effect === null ? null : <p className="text-xs opacity-60 wrap-anywhere">{effect}</p>}
      {dated === null ? null : (
        <p
          className={
            change?.saved === false
              ? "border-warning/40 bg-warning/10 text-warning rounded-field border px-2.5 py-2 text-xs wrap-anywhere"
              : "text-xs opacity-60 wrap-anywhere"
          }
          data-testid="market-change-line"
        >
          {dated}
        </p>
      )}
    </Card>
  );
}
