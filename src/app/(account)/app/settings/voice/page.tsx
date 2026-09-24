// SPEC §4 (2026-09-20, #908) — Settings › **Your voice**, at
// `/app/settings/voice`.
//
// One card, moved as it is: how the pages sound, and what they may never
// claim. The tab's word is the redesign's — "Your voice" — and the card
// keeps its own title, "How your pages sound" (`settings.voice.title`,
// REQ-055). The two are not the same sentence and neither replaces the
// other: the bar names the subject in two words, the card says what it does.
import type React from "react";
import type { Metadata } from "next";
import { copy } from "@/lib/presentation/copy";
import { readSettings } from "../provider";
import { VoicePanel } from "../panels/VoicePanel";

/** This tab's own `<title>` (#945, #925). Each sibling names itself
 *  inside Settings — `account-title.test.ts` forbids two screens
 *  announcing the same thing, so a shared title is not available and
 *  would not serve a reader anyway. */
export const metadata: Metadata = { title: copy("meta.app.settings.voice.title") };

export default async function SettingsVoiceTab(): Promise<React.JSX.Element> {
  const settings = await readSettings();

  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="settings-tab-panel-voice">
      <VoicePanel settings={settings} />
    </div>
  );
}
