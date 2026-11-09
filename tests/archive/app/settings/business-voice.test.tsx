/** @vitest-environment jsdom */
// Settings › Your business, "How your pages sound" (board SettingsIndex, owner R7): one card holding Write as,
// Words you use and Your note, and nothing else; Never say is its own card. Plumber and SaaS, same card.
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import { CUSTOMERS } from "./business-fixtures";

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
const { ListEditor } = await import("@/app/(account)/app/settings/panels/BusinessPanel");
const { WRITING_VOICE_OPTIONS } = await import("@/app/(account)/app/settings/voice-state");
const { copy } = await import("@/lib/presentation/copy");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Facts = Parameters<typeof assembleSettings>[0];

async function mount(facts: Partial<Facts> = {}, business: string | null = "Harbour Bike Repair", words?: React.ReactNode): Promise<HTMLElement> {
  const settings = assembleSettings({ ...FIXTURE_SETTINGS_FACTS, ...facts });
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(<VoicePanel settings={settings} business={business} words={words} />);
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

describe("one card, How your pages sound: Write as, Words you use and Your note, and nothing else", () => {
  it("draws two cards: How your pages sound, then Never say", async () => {
    const root = await mount();
    expect(cards(root).map((card) => card.querySelector("h2")?.textContent)).toEqual([copy("settings.voice.title"), copy("settings.voice.never-claim")]);
  });

  it("the card holds the three controls in the board's order, under its title and lead", async () => {
    const [voice] = cards(await mount({}, "Harbour Bike Repair", <span>the stored words</span>));
    inOrder(voice!, [
      copy("settings.voice.title"),
      copy("settings.voice.lead"),
      copy("settings.voice.writing.label"),
      copy("settings.voice.writing.ours"),
      copy("settings.voice.writing.guide.example", { business: "Harbour Bike Repair" }),
      copy("settings.business.vocabulary"),
      "the stored words",
      copy("settings.content.voice"),
      copy("settings.voice.save"),
    ]);
    const controls = [...voice!.querySelectorAll("[data-testid]")].map((el) => el.getAttribute("data-testid")).filter((id) => /^(setting|business-group)-/.test(id!));
    expect(controls).toEqual(["setting-writing_voice", "business-group-vocabulary", "setting-voice_text"]);
    // Two radios, one note and one Save: no length, no Let ReachKit choose, no tone, no self-reference, no example figure.
    expect([...voice!.querySelectorAll("input, textarea, select, button")].map((el) => el.getAttribute("type") ?? el.tagName.toLowerCase())).toEqual(["radio", "radio", "textarea", "submit"]);
    for (const gone of ["Let ReachKit choose", "Short answers", "Tone", "How you refer to yourself"]) expect(voice!.textContent).not.toContain(gone);
    expect(voice!.querySelector("figure")).toBeNull();
  });

  it.each(CUSTOMERS)("$name: Words you use draws each stored word as a chip with its Remove, and an Add", async (c) => {
    const [voice] = cards(await mount({}, c.name, <ListEditor list="vocabulary" items={c.profile.lists.vocabulary} />));
    const words = voice!.querySelector('[data-testid="business-group-vocabulary"]')!;
    expect(words.querySelectorAll('[data-testid="business-item"]')).toHaveLength(c.profile.lists.vocabulary.length);
    expect(words.querySelector(`button[aria-label="Remove ${c.word}"]`)?.classList.contains("size-11")).toBe(true);
    expect(words.querySelector('[data-testid="business-open-add-vocabulary"]')?.getAttribute("aria-label")).toBe("Add to Words you use");
  });

  it("never say: the rule under the title, the entries with Remove, then the add field, and no held-back example", async () => {
    const [, never] = cards(await mount({ doNotClaim: ["Open 24 hours"] }));
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
