// SPEC §4 *How your pages sound*: Write as, Words you use, Your note and Never say, one line each, changed in a dialog.
// Never say is a hard filter: a page that says one of them does not go live. Neither is an engine parameter.
"use client";

import type React from "react";
import { useState } from "react";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../../_shell/written";
import type { BusinessScreen, Line } from "../business-screen";
import { saveVoiceAction, saveWritingVoiceAction } from "../change-actions";
import { EditDialog, fromSetting, listChange, StagedList, TextField, type DialogAnswer } from "../EditDialog";
import { CARD, CARD_BODY, CARD_LEAD, CARD_TITLE } from "../frame";
import { saveClaimsAction } from "../panel-actions";
import { CLAIM_FIELD, CLAIM_REMOVED_FIELD } from "../panel-state";
import { VOICE_FIELD, WRITING_VOICE_FIELD, WRITING_VOICE_OPTIONS } from "../voice-state";
import type { WritingVoice } from "@/lib/generate/voice/register";
import type { BusinessList } from "@/lib/site-profile/business/types";
import { ListDialog } from "./BusinessPanel";
import { SettingLine } from "./SettingRow";

/** The business list this card edits. */
const WORDS: BusinessList = "vocabulary";

/** A write that answers nothing of its own: saved when it returns, refused when it throws. */
async function plain(write: () => Promise<void>): Promise<DialogAnswer> {
  try {
    await write();
    return { ok: true };
  } catch {
    return { ok: false, line: copy("settings.answer.refused") };
  }
}

/** The two radio cards; the choice is saved by the dialog's Save. */
function WritingChoice(p: { chosen: WritingVoice | null; business: string }): React.JSX.Element {
  const [writing, setWriting] = useState<string | null>(p.chosen);
  return (
    <fieldset className="grid min-w-0 grid-cols-1 gap-3" data-testid="setting-writing_voice">
      <legend className="sr-only">{copy("settings.voice.writing.label")}</legend>
      {WRITING_VOICE_OPTIONS.map((choice) => {
        const chosen = writing === choice.voice;
        return (
          <label
            key={choice.voice}
            className={`flex min-w-0 cursor-pointer items-start gap-3 rounded-box border p-4 ${chosen ? "border-primary bg-primary/10" : "border-base-300"}`}
            data-testid={`writing-voice-${choice.voice}`}
          >
            <input
              type="radio"
              className="radio radio-primary mt-0.5"
              name={WRITING_VOICE_FIELD}
              value={choice.voice}
              checked={chosen}
              onChange={() => setWriting(choice.voice)}
            />
            <span className="flex min-w-0 flex-col gap-1 wrap-anywhere">
              <span className="font-semibold">{copy(choice.key)}</span>
              <span className="text-sm text-base-content/70">
                {choice.voice === "guide" ? copy(choice.example, { business: p.business }) : copy(choice.example)}
              </span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

export function VoicePanel(p: {
  voice: NonNullable<BusinessScreen["voice"]>;
  writing: WritingVoice | null;
  note: string;
  never: readonly string[];
  /** Words you use, the business list; `null` where that read failed. */
  words: readonly string[] | null;
  /** The name the guide voice's example uses; the domain where the site has none. */
  business: string;
}): React.JSX.Element {
  function action(line: Line): React.ReactNode {
    if (!line.change) return null;
    switch (line.id) {
      case "writing":
        // Your note is this dialog's second field: one Save writes the choice, then the note.
        return (
          <EditDialog
            label={line.label}
            lead={copy("settings.voice.lead")}
            testId="voice-dialog-writing"
            save={(form) =>
              plain(async () => {
                await saveWritingVoiceAction(form);
                await saveVoiceAction(form);
              })
            }
          >
            <WritingChoice chosen={p.writing} business={p.business} />
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-semibold">{copy("settings.content.voice")}</span>
              <TextField name={VOICE_FIELD} label={copy("settings.content.voice")} value={p.note} rows={4} placeholder={writtenLine("settings.voice.placeholder")} />
            </label>
          </EditDialog>
        );
      case "vocabulary":
        return p.words === null ? null : <ListDialog list={WORDS} label={line.label} items={p.words} lead={copy("settings.voice.lead")} />;
      case "never":
        return (
          <EditDialog
            label={line.label}
            lead={copy("settings.voice.filter-note")}
            testId="voice-dialog-never"
            save={async (form) => {
              const { added, removed } = listChange(form, CLAIM_FIELD, p.never);
              const out = new FormData();
              for (const item of added) out.append(CLAIM_FIELD, item);
              for (const item of removed) out.append(CLAIM_REMOVED_FIELD, item);
              return fromSetting(await saveClaimsAction(out));
            }}
          >
            <StagedList items={p.never} name={CLAIM_FIELD} addLabel={copy("settings.voice.add-claim")} />
          </EditDialog>
        );
      default:
        return null;
    }
  }

  return (
    <section className={CARD} data-testid="settings-voice">
      <div className={CARD_BODY}>
        <div className="flex min-w-0 flex-col">
          <h2 className={CARD_TITLE}>{copy("settings.voice.title")}</h2>
          <p className={CARD_LEAD}>{copy("settings.voice.lead")}</p>
        </div>
        <div className="flex min-w-0 flex-col">
          {p.voice.lines.map((line) => (
            <SettingLine key={line.id} label={line.label} value={line.value} testId={`voice-${line.id}`} action={action(line)} />
          ))}
        </div>
      </div>
    </section>
  );
}
