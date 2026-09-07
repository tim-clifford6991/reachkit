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
// Cold start (§6.6): an empty set renders the add control and no chips —
// and, since issue #204, REQ-071 c16's one line where the chips would be.
//
// **That reverses this file's earlier reading, on the criterion's own
// words.** It said no empty-state sentence was owed, because a customer
// looking at an add control is looking at the one thing there is to do.
// c16 is about a different fact: not what the customer may do next, but
// what the *product* will not do until they do it — there is no rival
// comparison to make, so none is made. A control cannot say that, and §2.5
// requires an empty state to be designed rather than blank.
import type React from "react";
import { Btn } from "@/ui/components/Btn";
import { Card } from "@/ui/components/Card";
import { Input } from "@/ui/components/Input";
import { copy } from "@/lib/presentation/copy";
import { BATTERY } from "@/lib/config/constants";
import { writtenLine } from "../../_shell/written";
import type { SettingsModel } from "../model";

/** c16's line, or nothing while the owner has not written it — never a
 *  placeholder standing where a sentence belongs (REQ-091 c2). */
function EmptyLine(): React.JSX.Element | null {
  const line = writtenLine("settings.competitors.none-yet");
  return line === null ? null : (
    <p className="text-xs opacity-60 wrap-anywhere" data-testid="competitors-none-yet-line">
      {line}
    </p>
  );
}

export function CompetitorsPanel(p: { settings: SettingsModel }): React.JSX.Element {
  const full = p.settings.competitors.length >= BATTERY.COMPETITORS_MAX;

  return (
    <Card state="default" title={<h2>{copy("settings.competitors.title")}</h2>}>
      <div className="flex min-w-0 flex-col gap-3" data-testid="setting-competitors">
        {p.settings.competitors.length > 0 ? null : (
          // REQ-071 c16. No slot: there is no date and no change to name,
          // only that comparison begins when a rival is added.
          <EmptyLine />
        )}
        <div className="flex min-w-0 flex-wrap gap-2">
          {p.settings.competitors.map((domain) => (
            <span className="inline-flex min-w-0 items-center gap-2 wrap-anywhere" key={domain} data-testid={`competitor-${domain}`}>
              {/* §2.3: a domain is a URL-shaped value. */}
              <span className="num">{domain}</span>
              <Btn label={copy("settings.competitors.remove")} size="sm" variant="ghost" />
            </span>
          ))}
        </div>

        {full ? null : (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
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
