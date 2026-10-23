// Settings › Account (board SettingsAccount): how a sign-in goes, the export,
// and the danger zone folded shut with what each way out does.
/** @vitest-environment jsdom */
import "../../generate/env";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { assembleSettings } from "@/app/(account)/app/settings/model";
import { FIXTURE_SETTINGS_FACTS } from "@/app/(account)/app/settings/fixture";
import { AccountPanel } from "@/app/(account)/app/settings/panels/AccountPanel";
import { DangerZone } from "@/app/(account)/app/settings/panels/DangerZone";

const settings = assembleSettings(FIXTURE_SETTINGS_FACTS);
const doc = new DOMParser().parseFromString(
  renderToStaticMarkup(
    <>
      <AccountPanel account={settings.account} pages={14} />
      <DangerZone />
    </>
  ),
  "text/html"
);
/** An element's text nodes, word-separated as a reader hears them. */
const text = (el: Element | null | undefined): string => {
  if (!el) return "";
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) parts.push(node.textContent ?? "");
  return parts.map((part) => part.trim()).filter(Boolean).join(" ").replace(/ ([,.;:!?])/g, "$1");
};

describe("the account card", () => {
  it("shows how you sign in, under the address it mails", () => {
    const signin = doc.querySelector('[data-testid="account-signin"]')!;
    expect(signin.getAttribute("aria-label")).toBe("How you sign in");
    expect(text(signin)).toBe("We mail you a link You open it You’re in. No password.");
    const email = doc.querySelector('[data-testid="setting-email"]')!;
    expect(email.compareDocumentPosition(signin) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("offers the export with no condition, saying what it holds, above sign out", () => {
    const exp = doc.querySelector('[data-testid="action-export"]')!;
    expect(text(exp.querySelector("div"))).toBe(
      "Export everything Every page we wrote for you, 14 so far, live or not, as files with their images. Always available, whatever your plan."
    );
    expect(text(exp.querySelector("button"))).toBe("Export everything");
    expect(exp.querySelector("button")?.hasAttribute("disabled")).toBe(false);
    const signOut = doc.querySelector('[data-testid="action-sign_out"]')!;
    expect(exp.compareDocumentPosition(signOut) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("the danger zone", () => {
  const zone = doc.querySelector('details[data-testid="settings-danger"]')!;

  it("is folded shut, its summary saying what is inside and how to only stop new pages", () => {
    expect(zone.hasAttribute("open")).toBe(false);
    expect(text(zone.querySelector("summary"))).toBe(
      "Danger zone Take every page down, or delete your account. To only stop new pages, pause publishing."
    );
    const pause = zone.querySelector(".collapse-content > p")!;
    expect(text(pause)).toBe("To stop new pages without taking any down, pause publishing instead.");
    expect(pause.querySelector("a")?.getAttribute("href")).toBe("/app/settings/publishing");
  });

  it("says what each one does", () => {
    const compare = zone.querySelector('[data-testid="danger-compare"]')!;
    expect(text(compare.querySelector(".eyebrow"))).toBe("What each one does");
    const ways = [...compare.querySelectorAll(":scope > ul > li")].map((li) => [
      text(li.querySelector(":scope > span")),
      ...[...li.querySelectorAll("li")].map(text),
    ]);
    expect(ways).toEqual([
      ["Pause publishing", "Live pages Stay up", "New pages None until you turn it on", "Account, drafts and plan Kept", "Your pages exported to you Not needed", "Can you undo it? Yes, one switch"],
      ["Take every page down", "Live pages Taken down", "New pages None; publishing off", "Account, drafts and plan Kept", "Your pages exported to you First, before anything", "Can you undo it? Yes, turn publishing on"],
      ["Delete my account", "Live pages Taken down", "New pages None", "Account, drafts and plan Closed for good", "Your pages exported to you First, before anything", "Can you undo it? No"],
    ]);
  });

  it("then each action, its consequence and the word it is confirmed with", () => {
    for (const [action, title, word] of [
      ["unpublish_all", "Take every page down", "unpublish all"],
      ["delete_account", "Delete my account", "delete account"],
    ] as const) {
      const step = zone.querySelector(`[data-testid="danger-${action}"]`)!;
      expect(text(step.querySelector("h3"))).toBe(title);
      expect(text(step.querySelector("label"))).toBe(`Type “${word}” to confirm`);
      expect(text(step.querySelector(`[data-testid="confirm-${action}"] button`))).toBe(title);
    }
  });
});
