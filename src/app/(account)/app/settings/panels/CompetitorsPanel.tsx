// Canvas: Settings — the rival set: the domains as tags, a remove beside
// each, and a way to add while the set has room.
//
// `COMPETITORS_MAX` is a pinned engine constant — it bounds the set and is
// not a number this screen offers anyone to change, so the add control is
// absent once the set is full rather than present-and-refusing.
//
// The set is the customer's own answer, not a derivation: a cold-start
// founder knows their competitors even when no dataset does. An empty set
// renders the add control, no tags, and the one line saying what the
// product will not do until they add one.
//
// Add and remove write through `../change-actions.ts`: this card sends one
// typed domain or one pressed tag and never the set, because a set from the
// browser is one a browser can rewrite and a stale one besides.
"use client";

import type React from "react";
import { Users } from "lucide-react";
import { useState } from "react";
import { Badge, Btn, Card, Input } from "@/ui/components";
import { RemovableTag } from "@/ui/idiom";
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
import {
  CARD_HEAD,
  CARD_LABEL,
  CONTROLS,
  EXPLAIN,
  GLYPH,
  SECTION,
  STACK,
  STROKE,
  TAGS,
} from "../style";

/** The empty-set line, or nothing while the owner has not written it —
 *  never a placeholder standing where a sentence belongs. */
function EmptyLine(): React.JSX.Element | null {
  const line = writtenLine("settings.competitors.none-yet");
  return line === null ? null : (
    <p className={EXPLAIN} data-testid="competitors-none-yet-line">
      {line}
    </p>
  );
}

export function CompetitorsPanel(p: {
  competitors: SettingsModel["competitors"];
}): React.JSX.Element {
  const full = p.competitors.length >= BATTERY.COMPETITORS_MAX;
  // The typed domain, kept across a refusal, and the answer the last press
  // gave. Neither is a copy of the set: the set is the model's, re-read
  // after every save.
  const [value, setValue] = useState("");
  const [answer, setAnswer] = useState<MarketChangeState>(MARKET_CHANGE_INITIAL);

  async function add(form: FormData): Promise<void> {
    const next = await addRivalAction(form);
    setAnswer(next);
    setValue(next.answer === "refused" ? next.value : "");
  }

  async function remove(form: FormData): Promise<void> {
    // `removeRival` cannot refuse: the tag is gone from the set the next
    // read returns, which is the whole of what happened.
    setAnswer(await removeRivalAction(form));
  }

  const refusal = refusalKeyOf(answer);
  const refusalLine = refusal === null ? null : writtenLine(refusal);

  return (
    <Card
      state="default"
      title={
        <div className={CARD_HEAD}>
          <span className={CARD_LABEL}>
            <Users size={GLYPH} strokeWidth={STROKE} aria-hidden />
            <span className="eyebrow">{copy("settings.competitors.title")}</span>
          </span>
          {/* How many of the five are taken, in the set's own words: a
              value, so it carries its denominator and the cap is the one
              constant rather than a five typed here. */}
          <Badge tone="neutral">
            <span className="num-phrase" data-testid="competitor-count">
              {copy("settings.competitors.count", {
                taken: String(p.competitors.length),
                max: String(BATTERY.COMPETITORS_MAX),
              })}
            </span>
          </Badge>
        </div>
      }
    >
      <div className={SECTION} data-testid="setting-competitors">
        {p.competitors.length > 0 ? null : <EmptyLine />}
        <div className={TAGS}>
          {p.competitors.map((domain) => (
            // The domain travels in the form rather than in a closure, so
            // the press carries exactly one named value and the tag is the
            // form's submit. Its accessible name is setup's own removal
            // key: the same act on the same set.
            <div className="min-w-0 max-w-full" key={domain} data-testid={`competitor-${domain}`}>
              <form action={remove} className="min-w-0 max-w-full">
                <input type="hidden" name={RIVAL_FIELD} value={domain} readOnly />
                <RemovableTag
                  value={domain}
                  removeLabel={copy("setup.competitors.remove", { rival: domain })}
                  submits
                />
              </form>
            </div>
          ))}
        </div>

        {full ? null : (
          <form action={add} className={STACK} data-testid="add-competitor">
            {/* Two calls, not one with a spread: `InputProps` is a union in
                which `invalid` and `invalidMessage` arrive together. */}
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
            <div className={CONTROLS}>
              <Btn
                label={copy("settings.competitors.add")}
                size="sm"
                variant="secondary"
                pill
                type="submit"
              />
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}
