// SPEC §4 (2026-09-20, #908) — Settings › **Your voice**, at
// `/app/settings/voice`.
//
// One card, moved as it is: how the pages sound, and what they may never
// claim. The tab's word is the redesign's — "Your voice" — and the card
// keeps its own title, "How your pages sound" (`settings.voice.title`,
// REQ-055). The two are not the same sentence and neither replaces the
// other: the bar names the subject in two words, the card says what it does.
import type React from "react";
import { readSettings } from "../provider";
import { VoicePanel } from "../panels/VoicePanel";

export default async function SettingsVoiceTab(): Promise<React.JSX.Element> {
  const settings = await readSettings();

  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="settings-tab-panel-voice">
      <VoicePanel settings={settings} />
    </div>
  );
}
