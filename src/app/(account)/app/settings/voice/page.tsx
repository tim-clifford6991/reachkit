// SPEC §4 (2026-09-20, #908) — Settings › **Your voice**, at
// `/app/settings/voice`.
//
// Three cards, in board SettingsVoice's order: the note with its example, who
// speaks with an example per voice, and what the pages may never claim. The
// tab's word is the redesign's — "Your voice" — and the first card keeps its
// own title, "How your pages sound" (`settings.voice.title`,
// REQ-055). The two are not the same sentence and neither replaces the
// other: the bar names the subject in two words, the card says what it does.
import type React from "react";
import type { Metadata } from "next";
import { copy } from "@/lib/presentation/copy";
import { readSettings } from "../provider";
import { readsLanded } from "../model";
import { landed, Unread } from "../Unread";
import { VoicePanel } from "../panels/VoicePanel";
import { readBusinessName } from "./name";

/** This tab's own `<title>` (#945, #925). Each sibling names itself
 *  inside Settings — `account-title.test.ts` forbids two screens
 *  announcing the same thing, so a shared title is not available and
 *  would not serve a reader anyway. */
export const metadata: Metadata = { title: copy("meta.app.settings.voice.title") };

export default async function SettingsVoiceTab(): Promise<React.JSX.Element> {
  // The examples read as unnamed where the name did not load, as they do where none is stored.
  const [all, business] = await Promise.all([landed(readSettings(), "settings"), landed(readBusinessName(), "businessName")]);
  const settings = readsLanded(all, "site", "pages");

  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="settings-tab-panel-voice">
      {settings === null ? <Unread testId="settings-unread-voice" /> : <VoicePanel settings={settings} business={business} />}
    </div>
  );
}
