/** @vitest-environment jsdom */
// Settings › Your voice against board SettingsVoice: its three cards in the board's order, the
// voice options as a radio list saved on choice, and the fixed examples (E15, S3, E28).
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
const { WRITING_VOICE_AUTO, WRITING_VOICE_OPTIONS } = await import("@/app/(account)/app/settings/voice-state");
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

describe("board SettingsVoice: each section in the board's order and words", () => {
  it("draws three cards: the note, who speaks, and never claim", async () => {
    const root = await mount();
    expect(cards(root).map((card) => card.querySelector("h2, legend")?.textContent)).toEqual([
      copy("settings.voice.title"),
      copy("settings.voice.writing.label"),
      copy("settings.voice.never-claim"),
    ]);
  });

  it("the note card: lead, Your note, the before and after example, its caption, then Save", async () => {
    const [note] = cards(await mount());
    inOrder(note!, [
      copy("settings.voice.title"),
      copy("settings.voice.lead"),
      copy("settings.content.voice"),
      copy("settings.voice.example.head"),
      copy("settings.voice.example.without"),
      copy("settings.voice.example.without.text"),
      copy("settings.voice.example.with"),
      copy("settings.voice.example.with.text"),
      copy("settings.voice.example.caption"),
      copy("settings.voice.save"),
    ]);
  });

  it("who speaks: ReachKit's choice then the three voices, each with its example, then the note", async () => {
    const [, who] = cards(await mount());
    inOrder(who!, [
      copy("settings.voice.writing.auto"),
      copy("settings.voice.writing.auto.example"),
      copy("settings.voice.writing.ours"),
      copy("settings.voice.writing.ours.example"),
      copy("settings.voice.writing.guide"),
      copy("settings.voice.writing.guide.example", { business: "Harbour Bike Repair" }),
      copy("settings.voice.writing.short"),
      copy("settings.voice.writing.short.example"),
      copy("settings.voice.writing.note"),
    ]);
  });

  it("never claim: lead, the entries with Remove, the add field, the held-back example, the rule", async () => {
    const [, , never] = cards(await mount({ doNotClaim: ["Open 24 hours"] }));
    expect(never!.querySelector('[data-testid="claim-Open 24 hours"] button')?.getAttribute("aria-label")).toBe(
      copy("settings.voice.remove-claim", { claim: "Open 24 hours" })
    );
    inOrder(never!, [
      copy("settings.voice.never-claim"),
      copy("settings.voice.never-claim.lead"),
      "Open 24 hours",
      copy("settings.voice.add-claim"),
      copy("settings.voice.held.quote", { business: "Harbour Bike Repair" }),
      copy("settings.voice.held.badge"),
      copy("settings.voice.held.told"),
      copy("settings.voice.filter-note"),
    ]);
  });
});

describe("the voice options are a radio list with the select's stored values, saved on choice", () => {
  it("one radio per value the select offered, the stored one checked, and no select", async () => {
    const root = await mount({ writingVoice: "guide" });
    const radios = [...root.querySelectorAll<HTMLInputElement>('[data-testid="setting-writing_voice"] input[type="radio"]')];
    expect(radios.map((r) => r.value)).toEqual([WRITING_VOICE_AUTO, ...WRITING_VOICE_OPTIONS.map((o) => o.voice)]);
    expect(radios.filter((r) => r.checked).map((r) => r.value)).toEqual(["guide"]);
    expect(root.querySelector("select")).toBeNull();
  });

  it("an account that chose nothing has ReachKit's choice checked", async () => {
    const root = await mount({ writingVoice: null });
    expect(root.querySelector<HTMLInputElement>('input[type="radio"]:checked')?.value).toBe(WRITING_VOICE_AUTO);
  });

  it.each([...WRITING_VOICE_OPTIONS.map((o) => o.voice), WRITING_VOICE_AUTO])(
    "choosing %s saves that value at once",
    async (voice) => {
      const root = await mount({ writingVoice: voice === WRITING_VOICE_AUTO ? "ours" : null });
      sent.length = 0;
      await act(async () => {
        root.querySelector<HTMLInputElement>(`input[type="radio"][value="${voice}"]`)!.click();
      });
      expect(sent).toEqual([voice]);
    }
  );
});

describe("the examples are fixed words, labelled as an example, never written for this customer", () => {
  const exampleText = (root: HTMLElement) =>
    ["voice-example", "voice-held-back"].map((id) => root.querySelector(`[data-testid="${id}"]`)?.textContent);

  it("the same words whatever note, voice and list the account has stored", async () => {
    const a = await mount({ voiceText: "Warm and chatty.", writingVoice: "ours", doNotClaim: ["Best in the world"] });
    const b = await mount({ voiceText: "Formal, third person.", writingVoice: "short", doNotClaim: [] });
    expect(exampleText(a)).toEqual(exampleText(b));
    expect(exampleText(a)[0]).toBe(
      [
        "settings.voice.example.head",
        "settings.voice.example.without",
        "settings.voice.example.without.text",
        "settings.voice.example.with",
        "settings.voice.example.with.text",
        "settings.voice.example.caption",
      ]
        .map((key) => copy(key as Parameters<typeof copy>[0]))
        .join("")
    );
  });

  it("the before and after is captioned as an example", async () => {
    const caption = (await mount()).querySelector('[data-testid="voice-example"] figcaption');
    expect(caption?.textContent).toBe(copy("settings.voice.example.caption"));
  });

  it("{business} is the account's own name, and its domain where none is stored", async () => {
    const named = await mount({}, "Tally");
    expect(named.querySelector('[data-testid="voice-held-back"]')?.textContent).toContain(
      copy("settings.voice.held.quote", { business: "Tally" })
    );
    const unnamed = await mount({}, null);
    expect(unnamed.querySelector('[data-testid="writing-voice-guide"]')?.textContent).toContain(
      copy("settings.voice.writing.guide.example", { business: FIXTURE_SETTINGS_FACTS.domain })
    );
  });
});

describe("the voice tab's board icons", () => {
  const classesIn = (el: Element | null | undefined) =>
    [...(el?.querySelectorAll("svg") ?? [])].map((svg) => [...svg.classList].find((c) => c.startsWith("lucide-")));

  it("the held-back flow is FileText → ArrowRight → Ban badge → ArrowRight → MailCheck", async () => {
    const flow = (await mount()).querySelector('[data-testid="voice-held-back"]');
    expect(classesIn(flow)).toEqual(["lucide-file-text", "lucide-arrow-right", "lucide-ban", "lucide-arrow-right", "lucide-mail-check"]);
    expect(flow?.querySelector(".badge svg.lucide-ban")?.parentElement?.textContent).toBe(copy("settings.voice.held.badge"));
  });

  it("the With a note pill carries Check, and each never-say chip's remove carries X", async () => {
    const root = await mount({ doNotClaim: ["Open 24 hours", "Cheapest in town"] });
    expect(classesIn(root.querySelector('[data-testid="voice-example-with"]'))).toEqual(["lucide-check"]);
    const removes = root.querySelectorAll('[data-testid^="claim-"] button');
    expect(removes).toHaveLength(2);
    removes.forEach((button) => expect(classesIn(button)).toEqual(["lucide-x"]));
  });
});
