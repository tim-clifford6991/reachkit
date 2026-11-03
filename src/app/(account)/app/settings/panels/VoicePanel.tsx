// SPEC §7, REQ-055, REQ-053 (owner R7, docs/spec/decisions/2026-11-03-2127.md): one card, "How your pages sound",
// holds who speaks, the words the business uses and its note; Never say stays its own card because it is a hard filter.
// Neither is an engine parameter (REQ-070 criterion 3): both constrain content published under the customer's name.
"use client";

import type React from "react";
import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../../_shell/written";
import { saveVoiceAction, saveWritingVoiceAction } from "../change-actions";
import { say } from "@/app/_toast/say";
import { addClaimAction, removeClaimAction } from "../panel-actions";
import { CLAIM_FIELD } from "../panel-state";
import { VOICE_FIELD, WRITING_VOICE_FIELD, WRITING_VOICE_OPTIONS } from "../voice-state";
import { SAVED_BADGE_CLASS, useSetting } from "./useSetting";
import type { SettingsModel } from "../model";

/** One claim, as the remove action reads it. A `FormData` because both
 *  claim writes are ordinary form actions and share one reader. */
function formWith(entry: string): FormData {
  const form = new FormData();
  form.set(CLAIM_FIELD, entry);
  return form;
}

export function VoicePanel(p: {
  settings: SettingsModel;
  /** The name the guide voice's example uses; the domain where the site has none. */
  business?: string | null;
  /** Words you use, drawn from the business read in its own boundary so a slow read leaves only that row waiting. */
  words?: React.ReactNode;
}): React.JSX.Element {
  const business = p.business ?? p.settings.domain;
  // Issue 1196: the voice text's own press — it answers, and spins while it
  // is asked, like every other Settings save.
  const [savingVoice, startSavingVoice] = useTransition();
  function saveVoice(form: FormData): void {
    startSavingVoice(async () => {
      try {
        await saveVoiceAction(form);
        say(copy("settings.answer.saved"), "ok");
      } catch {
        say(copy("settings.answer.refused"), "bad");
      }
    });
  }
  // SPEC §7 (owner, 2026-10-10; issue 1390): who speaks on their pages.
  // Saved as it is chosen: one radio list, no second press.
  const [writing, setWriting] = useState<string | null>(p.settings.voice.writing);
  const [savingWriting, startSavingWriting] = useTransition();
  function chooseWriting(value: string): void {
    setWriting(value);
    const form = new FormData();
    form.set(WRITING_VOICE_FIELD, value);
    startSavingWriting(async () => {
      try {
        await saveWritingVoiceAction(form);
        say(copy("settings.answer.saved"), "ok");
      } catch {
        say(copy("settings.answer.refused"), "bad");
      }
    });
  }
  const placeholder = writtenLine("settings.voice.placeholder");
  // SPEC §4 (2026-09-20, #908, issue #913): the never-claim list writes.
  // Both halves of it were inert — the × on each tag and the Add beside
  // the field — so a filter the customer could not add to and could not
  // remove from was drawn as though they owned it. Both now reach
  // `saveDoNotClaim`, which is the product's one writer of the column and
  // re-checks every page the change affects in the same call.
  const writer = useSetting();
  // What is being typed into the add field. Controlled for the reason the
  // voice box is: React resets a form after its action, and a box that
  // emptied itself the moment it was refused would throw the words away.
  const [claim, setClaim] = useState("");
  // The stored voice, and the customer's edit of it in flight. Controlled
  // for `MarketPanel`'s reason: React resets a form after its action, and
  // a box that emptied itself the moment it saved would look like the save
  // had thrown the text away.
  const [text, setText] = useState(p.settings.voice.text);

  return (
    <>
      <section className="card card-border min-w-0 bg-base-100" data-testid="settings-voice">
        <div className="card-body gap-5">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="card-title min-w-0 wrap-anywhere text-(length:--h3)">{copy("settings.voice.title")}</h2>
            <p className="text-sm text-base-content/70 wrap-anywhere">{copy("settings.voice.lead")}</p>
          </div>
          {/* Saved as it is chosen: one radio list, no second press. */}
          <fieldset className="flex min-w-0 flex-col gap-3" data-testid="setting-writing_voice" disabled={savingWriting}>
            <legend className="mb-3 text-sm font-semibold">{copy("settings.voice.writing.label")}</legend>
            <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2" data-layout="pair">
              {WRITING_VOICE_OPTIONS.map((choice) => {
                const chosen = writing === choice.voice;
                return (
                  <label
                    key={choice.voice}
                    className={`flex min-w-0 cursor-pointer items-start gap-3 rounded-box border p-5 ${
                      chosen ? "border-primary bg-primary/10" : "border-base-300"
                    }`}
                    data-testid={`writing-voice-${choice.voice}`}
                  >
                    <input
                      type="radio"
                      className="radio radio-primary mt-0.5"
                      name={WRITING_VOICE_FIELD}
                      value={choice.voice}
                      checked={chosen}
                      onChange={() => chooseWriting(choice.voice)}
                    />
                    <span className="flex min-w-0 flex-col gap-1 wrap-anywhere">
                      <span className="font-semibold">{copy(choice.key)}</span>
                      <span className="text-sm text-base-content/70">
                        {choice.voice === "guide" ? copy(choice.example, { business }) : copy(choice.example)}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className="flex min-w-0 flex-col gap-2 border-t border-base-300 pt-5" data-testid="business-group-vocabulary">
            <span className="text-sm font-semibold">{copy("settings.business.vocabulary")}</span>
            {p.words}
          </div>
          <div className="border-t border-base-300 pt-5">
            <form action={saveVoice} className="flex min-w-0 flex-col gap-3">
              <label className="flex min-w-0 flex-col gap-2" data-testid="setting-voice_text">
                <span className="text-sm font-semibold">{copy("settings.content.voice")}</span>
                <textarea
                  className="textarea h-auto w-full"
                  rows={4}
                  name={VOICE_FIELD}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  {...(placeholder === null ? {} : { placeholder })}
                />
              </label>
              <span>
                <button type="submit" className="btn btn-primary min-h-11" disabled={savingVoice}>
                  {savingVoice ? <span className="loading loading-spinner loading-xs" aria-hidden /> : null}
                  {copy("settings.voice.save")}
                </button>
              </span>
            </form>
          </div>
        </div>
      </section>

      <section className="card card-border min-w-0 bg-base-100">
        <div className="card-body gap-5" data-testid="setting-do_not_claim">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="card-title min-w-0 flex-wrap text-(length:--h3)">
              <span className="min-w-0 wrap-anywhere">{copy("settings.voice.never-claim")}</span>
              {writer.saved ? (
                <span className={SAVED_BADGE_CLASS} data-testid="voice-saved">
                  {copy("settings.answer.saved-badge")}
                </span>
              ) : null}
            </h2>
            {/* REQ-053: the list is a filter, not a preference, so the card says what it does. */}
            <p className="text-sm text-base-content/70 wrap-anywhere">{copy("settings.voice.filter-note")}</p>
          </div>
          {/* Each claim with its own way out: a filter the customer cannot remove from is not theirs. */}
          <div className="flex min-w-0 flex-wrap gap-2">
            {p.settings.doNotClaim.map((entry) => (
              <span className="min-w-0 max-w-full" key={entry} data-testid={`claim-${entry}`}>
                <button
                  type="button"
                  className="badge badge-ghost h-auto min-h-11 max-w-full cursor-pointer gap-2 px-3.5 text-left text-sm"
                  aria-label={copy("settings.voice.remove-claim", { claim: entry })}
                  disabled={writer.busy}
                  onClick={() => writer.press(removeClaimAction, formWith(entry))}
                >
                  <span className="num-phrase min-w-0 wrap-anywhere">{entry}</span>
                  <X size={16} strokeWidth={1.75} aria-hidden />
                </button>
              </span>
            ))}
          </div>
          {/* A form, so the field submits on Enter as well as on the press. */}
          <form
            action={(form) => {
              writer.press(addClaimAction, form);
              setClaim("");
            }}
            className="flex min-w-0 flex-col gap-2"
          >
            <label htmlFor="add-claim-field" className="text-sm font-semibold">
              {copy("settings.voice.add-claim")}
            </label>
            <div className="flex min-w-0 gap-2">
              <input
                id="add-claim-field"
                className="input min-w-0 grow"
                name={CLAIM_FIELD}
                value={claim}
                onChange={(e) => setClaim(e.target.value)}
                data-testid="add-claim"
              />
              <button
                type="submit"
                className="btn btn-outline border-base-300 bg-base-100 text-primary min-h-11 shrink-0"
                aria-label={copy("settings.voice.add-claim")}
                disabled={writer.busy}
              >
                {writer.busy ? (
                  <span className="loading loading-spinner loading-xs" aria-hidden />
                ) : (
                  <Plus size={16} strokeWidth={1.75} aria-hidden />
                )}
                {copy("settings.voice.add")}
              </button>
            </div>
          </form>
        </div>
      </section>
    </>
  );
}
