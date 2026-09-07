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
//
// **Add and remove write, since issue #231.** Both go through
// `../change-actions.ts` and therefore through `addRival` / `removeRival`
// and `saveRivals` — REQ-071 c4's "the same rules" as setup, applied on the
// server against the stored set. This card sends one typed domain and one
// pressed chip; it never sends the set. A set from the browser is a set a
// browser can rewrite, and it is also a stale one, which is how a fifth
// rival gets added to a set that already holds five.
//
// **The refusal belongs to the field, not to the chips.** Every one of
// `addRival`'s five is about the value that was typed, so it is shown on
// the field that holds it, with the value intact (`Input`'s contract).
//
// **The field has its own name, since issue #270.** It was labelled with
// the card's heading key, so the card read "Competitors … Competitors": a
// heading naming the set and a field under it repeating the word rather
// than naming what is typed into it. `settings.competitors.add-label` is
// the field's, passed as both label and placeholder — ADR-093's "one
// string, once", which `Input` renders by omitting a placeholder equal to
// the label. The heading key is read once, by the heading.
"use client";

import type React from "react";
import { useState } from "react";
import { Btn } from "@/ui/components/Btn";
import { Card } from "@/ui/components/Card";
import { Input } from "@/ui/components/Input";
import { copy } from "@/lib/presentation/copy";
import { BATTERY } from "@/lib/config/constants";
import { writtenLine } from "../../_shell/written";
import { addRivalAction, removeRivalAction } from "../change-actions";
import {
  MARKET_CHANGE_INITIAL,
  RIVAL_FIELD,
  refusalKeyOf,
  type MarketChangeState,
} from "../market-state";
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

/** The set, and no more of the model: a client panel takes what it renders
 *  (`AccountPanel`'s shape, since #134). */
export function CompetitorsPanel(p: {
  competitors: SettingsModel["competitors"];
}): React.JSX.Element {
  const full = p.competitors.length >= BATTERY.COMPETITORS_MAX;
  // The typed domain, kept across a refusal, and the answer the last press
  // gave. Neither is a copy of the set: the set is the model's, re-read
  // after every save, and this card holds no second one to fall out of
  // step with it.
  const [value, setValue] = useState("");
  const [answer, setAnswer] = useState<MarketChangeState>(MARKET_CHANGE_INITIAL);

  async function add(form: FormData): Promise<void> {
    const next = await addRivalAction(form);
    setAnswer(next);
    // A rival that went in is no longer a value being typed; a refused one
    // stays in the field with the reason beside it.
    setValue(next.answer === "refused" ? next.value : "");
  }

  async function remove(form: FormData): Promise<void> {
    // `removeRival` cannot refuse, so there is nothing to state and
    // nothing to keep: the chip is gone from the set the next read
    // returns, which is the whole of what happened.
    setAnswer(await removeRivalAction(form));
  }

  const refusal = refusalKeyOf(answer);
  const refusalLine = refusal === null ? null : writtenLine(refusal);

  return (
    <Card state="default" title={<h2>{copy("settings.competitors.title")}</h2>}>
      <div className="flex min-w-0 flex-col gap-3" data-testid="setting-competitors">
        {p.competitors.length > 0 ? null : (
          // REQ-071 c16. No slot: there is no date and no change to name,
          // only that comparison begins when a rival is added.
          <EmptyLine />
        )}
        <div className="flex min-w-0 flex-wrap gap-2">
          {p.competitors.map((domain) => (
            <span className="inline-flex min-w-0 items-center gap-2 wrap-anywhere" key={domain} data-testid={`competitor-${domain}`}>
              {/* §2.3: a domain is a URL-shaped value. */}
              <span className="num">{domain}</span>
              {/* The domain travels in the form rather than in a closure,
                  so the press carries exactly one named value and the
                  chip works the same way the field does. */}
              <form action={remove}>
                <input type="hidden" name={RIVAL_FIELD} value={domain} readOnly />
                <Btn label={copy("settings.competitors.remove")} size="sm" variant="ghost" type="submit" />
              </form>
            </span>
          ))}
        </div>

        {full ? null : (
          <form action={add} className="flex min-w-0 flex-col gap-1" data-testid="add-competitor">
            {/* Two calls, not one with a spread: `InputProps` is a union in
                which `invalid: true` and `invalidMessage` arrive together. */}
            {refusalLine === null ? (
              <Input
                label={copy("settings.competitors.add-label")}
                placeholder={copy("settings.competitors.add-label")}
                name={RIVAL_FIELD}
                value={value}
                onChange={setValue}
              />
            ) : (
              <Input
                label={copy("settings.competitors.add-label")}
                placeholder={copy("settings.competitors.add-label")}
                name={RIVAL_FIELD}
                value={value}
                onChange={setValue}
                invalid
                invalidMessage={refusalLine}
              />
            )}
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Btn label={copy("settings.competitors.add")} size="sm" type="submit" />
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}
