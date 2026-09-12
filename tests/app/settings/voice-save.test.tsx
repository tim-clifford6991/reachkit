/** @vitest-environment jsdom */
// tests/app/settings/voice-save.test.tsx — SPEC.md §5 (2026-09-12)
//
// "The brand-voice summary is shown at setup, an edit to it persists, and
// settings shows the same text."
//
// This file is settings' half of that: the card shows the stored voice,
// and the field is the write path rather than a box that looks like one.
// The idiom is `voice-tags.test.tsx`'s — the env fixture first, because
// the action module reaches `@/lib/db`, then `copy()` mocked to its key so
// the assertions are about which sentence is asked for, never the owner's
// wording.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

vi.mock("@/lib/presentation/copy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/presentation/copy")>();
  return {
    ...actual,
    copy: (key: string, vars?: Record<string, string | number>) =>
      vars === undefined ? key : `${key}(${Object.values(vars).join("|")})`,
  };
});

const { assembleSettings } = await import("@/app/(account)/app/settings/model");
const { FIXTURE_SETTINGS_FACTS } = await import("@/app/(account)/app/settings/fixture");
const { VoicePanel } = await import("@/app/(account)/app/settings/panels/VoicePanel");
const { VOICE_FIELD } = await import("@/app/(account)/app/settings/voice-state");

function render(voiceText: string): HTMLElement {
  const settings = assembleSettings({ ...FIXTURE_SETTINGS_FACTS, voiceText });
  const root = document.createElement("div");
  root.innerHTML = renderToStaticMarkup(<VoicePanel settings={settings} />);
  return root;
}

const READ_FROM_SITE = "Plain and direct, second person. Says “projects”, not “engagements”.";

describe("SPEC.md §5 — settings shows the same voice, and the field stores it", () => {
  it("the stored text is what the box shows", () => {
    const box = render(READ_FROM_SITE).querySelector("textarea");
    expect(box?.textContent).toBe(READ_FROM_SITE);
  });

  it("the field is inside a form and carries the wire name the action reads", () => {
    const box = render(READ_FROM_SITE).querySelector(`textarea[name="${VOICE_FIELD}"]`);
    expect(box).not.toBeNull();
    expect(box?.closest("form")).not.toBeNull();
  });

  it("the form has one submit, so a voice is stored by pressing rather than by hoping", () => {
    const form = render(READ_FROM_SITE).querySelector("form");
    const submits = [...(form?.querySelectorAll("button") ?? [])].filter(
      (button) => button.getAttribute("type") === "submit"
    );
    expect(submits).toHaveLength(1);
  });

  it("a site that has written no voice shows an empty box, never an invented one", () => {
    const box = render("").querySelector("textarea");
    expect(box?.textContent).toBe("");
  });
});
