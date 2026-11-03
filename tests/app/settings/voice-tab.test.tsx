/** @vitest-environment jsdom */
// Settings › Your business, the voice cards (board SettingsIndex, canvas v36): its three cards in the board's order,
// and the voice options as two radio cards saved on choice.
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const sent: string[] = [];
vi.mock("@/app/(account)/app/settings/change-actions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/(account)/app/settings/change-actions")>();
  return {
    ...actual,
    saveWritingVoiceAction: async (form: FormData) => {
      sent.push(String(form.get("writing_voice")));
    },
  };
});

const { assembleSettings } = await import("@/app/(account)/app/settings/model");
const { FIXTURE_SETTINGS_FACTS } = await import("@/app/(account)/app/settings/fixture");
const { VoicePanel } = await import("@/app/(account)/app/settings/panels/VoicePanel");
const { WRITING_VOICE_OPTIONS } = await import("@/app/(account)/app/settings/voice-state");
const { copy } = await import("@/lib/presentation/copy");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Facts = Parameters<typeof assembleSettings>[0];

async function mount(facts: Partial<Facts> = {}, business: string | null = "Harbour Bike Repair"): Promise<HTMLElement> {
  const settings = assembleSettings({ ...FIXTURE_SETTINGS_FACTS, ...facts });
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(<VoicePanel settings={settings} business={business} />);
  });
  return container;
}

/** Each string's place in the text, which must rise: the board's order. */
function inOrder(root: HTMLElement, strings: string[]): void {
  const text = root.textContent ?? "";
  const at = strings.map((s) => {
    const i = text.indexOf(s);
    expect(i, `"${s}" is drawn`).toBeGreaterThanOrEqual(0);
    return i;
  });
  expect(at).toEqual([...at].sort((a, b) => a - b));
}

const cards = (root: HTMLElement) => [...root.querySelectorAll("section.card")] as HTMLElement[];

describe("board SettingsIndex's voice cards: each section in the board's order and words", () => {
  it("draws three cards: the note, who speaks, and never claim", async () => {
    const root = await mount();
    expect(cards(root).map((card) => card.querySelector("h2, legend")?.textContent)).toEqual([
      copy("settings.voice.title"),
      copy("settings.voice.writing.label"),
      copy("settings.voice.never-claim"),
    ]);
  });

  it("the note card: title, lead, Your note, then Save, with no example", async () => {
    const [note] = cards(await mount());
    inOrder(note!, [
      copy("settings.voice.title"),
      copy("settings.voice.lead"),
      copy("settings.content.voice"),
      copy("settings.voice.save"),
    ]);
    expect(note!.querySelector("figure")).toBeNull();
  });

  it("write as: the two voices, each with its example; length and the choice for each page are ReachKit's", async () => {
    const [, who] = cards(await mount());
    expect(who!.textContent).not.toContain("Let ReachKit choose");
    expect(who!.textContent).not.toContain("Short answers");
    inOrder(who!, [
      copy("settings.voice.writing.label"),
      copy("settings.voice.writing.ours"),
      copy("settings.voice.writing.ours.example"),
      copy("settings.voice.writing.guide"),
      copy("settings.voice.writing.guide.example", { business: "Harbour Bike Repair" }),
    ]);
  });

  it("never say: the rule under the title, the entries with Remove, then the add field, and no held-back example", async () => {
    const [, , never] = cards(await mount({ doNotClaim: ["Open 24 hours"] }));
    expect(never!.querySelector('[data-testid="claim-Open 24 hours"] button')?.getAttribute("aria-label")).toBe(
      copy("settings.voice.remove-claim", { claim: "Open 24 hours" })
    );
    inOrder(never!, [copy("settings.voice.never-claim"), copy("settings.voice.filter-note"), "Open 24 hours", copy("settings.voice.add-claim")]);
    expect(never!.querySelector("figure")).toBeNull();
  });
});

describe("the voice options are a radio list with the select's stored values, saved on choice", () => {
  it("one radio per value the select offered, the stored one checked, and no select", async () => {
    const root = await mount({ writingVoice: "guide" });
    const radios = [...root.querySelectorAll<HTMLInputElement>('[data-testid="setting-writing_voice"] input[type="radio"]')];
    expect(radios.map((r) => r.value)).toEqual(["ours", "guide"]);
    expect(radios.filter((r) => r.checked).map((r) => r.value)).toEqual(["guide"]);
    expect(root.querySelector("select")).toBeNull();
  });

  it("an account that chose nothing has no voice checked: ReachKit picks for each page", async () => {
    const root = await mount({ writingVoice: null });
    expect(root.querySelector('input[type="radio"]:checked')).toBeNull();
  });

  it.each(WRITING_VOICE_OPTIONS.map((o) => o.voice))(
    "choosing %s saves that value at once",
    async (voice) => {
      const root = await mount({ writingVoice: null });
      sent.length = 0;
      await act(async () => {
        root.querySelector<HTMLInputElement>(`input[type="radio"][value="${voice}"]`)!.click();
      });
      expect(sent).toEqual([voice]);
    }
  );
});

describe("the voice tab's board icons and names", () => {
  const classesIn = (el: Element | null | undefined) =>
    [...(el?.querySelectorAll("svg") ?? [])].map((svg) => [...svg.classList].find((c) => c.startsWith("lucide-")));

  it("each never-say chip's remove carries X, and Add carries Plus", async () => {
    const root = await mount({ doNotClaim: ["Open 24 hours", "Cheapest in town"] });
    const removes = root.querySelectorAll('[data-testid^="claim-"] button');
    expect(removes).toHaveLength(2);
    removes.forEach((button) => expect(classesIn(button)).toEqual(["lucide-x"]));
    expect(classesIn(root.querySelector('[data-testid="setting-do_not_claim"] button[type="submit"]'))).toEqual(["lucide-plus"]);
  });

  it("the guide's example names the account, and its domain where none is stored", async () => {
    const unnamed = await mount({}, null);
    expect(unnamed.querySelector('[data-testid="writing-voice-guide"]')?.textContent).toContain(
      copy("settings.voice.writing.guide.example", { business: FIXTURE_SETTINGS_FACTS.domain })
    );
  });
});
