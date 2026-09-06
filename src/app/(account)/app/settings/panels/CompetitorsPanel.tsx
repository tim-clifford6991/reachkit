// BUILD §4.7 — "**Competitors** (chips ×5, add/remove)".
//
// One settable key, `competitors`, and the whole of what §4.7 asks of it: the
// set as chips, a remove beside each, and a way to add. `COMPETITORS_MAX` is
// five (§6.1) and is a pinned engine constant — it bounds the set, it is not a
// number this screen offers anyone to change, and the add control is simply
// absent once the set is full rather than present-and-refusing.
//
// The set is the customer's own answer, not a derivation: §6.6 rules that
// "the customer can always type a rival manually — a cold-start founder knows
// their competitors even when no dataset does". Suggestions from the market
// (`deriveRivals`) are a setup-time offer (issue #37), not a settings-screen
// list, so none is rendered here.
//
// Cold start (§6.6): an empty set renders the add control and no chips. There
// is no empty-state sentence, because a customer who has removed all five is
// not being told about an absence — they are looking at a control that does
// the one thing there is to do.
import type React from "react";
import { Btn } from "@/ui/components/Btn";
import { Card } from "@/ui/components/Card";
import { Input } from "@/ui/components/Input";
import { copy } from "@/lib/presentation/copy";
import { BATTERY } from "@/lib/config/constants";
import type { SettingsModel } from "../model";

export function CompetitorsPanel(p: { settings: SettingsModel }): React.JSX.Element {
  const full = p.settings.competitors.length >= BATTERY.COMPETITORS_MAX;

  return (
    <Card state="default" title={<h2>{copy("settings.competitors.title")}</h2>}>
      <div className="rk-settings-fields" data-testid="setting-competitors">
        <div className="rk-settings-chips">
          {p.settings.competitors.map((domain) => (
            <span className="rk-settings-chip" key={domain} data-testid={`competitor-${domain}`}>
              {/* §2.3: a domain is a URL-shaped value. */}
              <span className="num">{domain}</span>
              <Btn label={copy("settings.competitors.remove")} size="sm" variant="ghost" />
            </span>
          ))}
        </div>

        {full ? null : (
          <div className="rk-settings-row">
            <Input
              label={copy("settings.competitors.title")}
              placeholder={copy("settings.market.domain")}
              name="competitor"
            />
            <Btn label={copy("settings.competitors.add")} size="sm" />
          </div>
        )}
      </div>
    </Card>
  );
}
