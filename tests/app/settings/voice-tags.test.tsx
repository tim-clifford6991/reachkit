/** @vitest-environment jsdom */
// BUILD §4.7, REQ-053, UI-SPEC S18 — the never-claim entries are tags (issue #488).
//
// S18 draws "Never claim tags + add": each entry is the set's `.tag.on`
// with its ×, the same tag the rivals take. `VoicePanel` used to build a
// third shape (text beside a ghost `Btn`); it renders `RemovableTag` now,
// in its `phrase` arm, because a claim is a sentence and must fold inside
// its card rather than run past it.
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

const CLAIM = "the fastest onboarding on the market";

function render(doNotClaim: readonly string[]): HTMLElement {
  const settings = assembleSettings({ ...FIXTURE_SETTINGS_FACTS, doNotClaim });
  const root = document.createElement("div");
  root.innerHTML = renderToStaticMarkup(<VoicePanel settings={settings} />);
  return root;
}

describe("S18 — each never-claim entry is the registered RemovableTag", () => {
  it("renders the claim in a tag, named by the removal key with the claim in it", () => {
    const root = render([CLAIM]);
    const tag = root.querySelector(`[data-testid="claim-${CLAIM}"] button.rk-tag`);
    expect(tag).not.toBeNull();
    expect(tag?.getAttribute("type")).toBe("button");
    expect(tag?.getAttribute("aria-label")).toBe(`settings.voice.remove-claim(${CLAIM})`);
  });

  it("a claim is a phrase: mono, and folding at its spaces", () => {
    const value = render([CLAIM]).querySelector("button.rk-tag > .num");
    expect(value?.textContent).toBe(CLAIM);
    expect(value?.classList.contains("num-phrase")).toBe(true);
  });

  it("one tag per entry, and no chip or Btn shape of its own", () => {
    const root = render([CLAIM, "certified by every regulator"]);
    const list = root.querySelector('[data-testid="setting-do_not_claim"]');
    expect(list?.querySelectorAll("button.rk-tag")).toHaveLength(2);
    expect(root.querySelector(".rk-chip")).toBeNull();
    expect(list?.querySelector('[data-testid^="claim-"] .btn')).toBeNull();
  });
});
