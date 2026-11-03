// Settings › Account (board SettingsAccount): the name, the address and how
// you sign in, the export as one row, sign out, and the danger zone folded shut.
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
  it("reads Name, Email and Your pages, the address in mono with how you sign in under it", () => {
    expect([...doc.querySelectorAll('[data-testid^="setting-"], [data-testid="action-export"]')].map((el) => el.getAttribute("data-testid"))).toEqual([
      "setting-name",
      "setting-email",
      "action-export",
    ]);
    const email = doc.querySelector('[data-testid="setting-email"]')!;
    expect(email.querySelector(".num")?.textContent).toBe("dana@example.com");
    expect(text(email)).toContain("Email dana@example.com Change email You sign in with a link sent here. No password.");
    expect(email.querySelector('[data-testid="email-change"]')).toBeNull();
  });

  it("offers the export with no condition as one row, saying what it holds, above sign out", () => {
    const exp = doc.querySelector('[data-testid="action-export"]')!;
    expect(text(exp)).toBe("Your pages 14 pages, with images Export everything");
    expect(exp.querySelector("button svg.lucide-download")).not.toBeNull();
    expect(exp.querySelector("button")?.hasAttribute("disabled")).toBe(false);
    const signOut = doc.querySelector('[data-testid="action-sign_out"]')!;
    expect(text(signOut)).toBe("Sign out");
    expect(exp.compareDocumentPosition(signOut) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("one page is one page", () => {
    const one = new DOMParser().parseFromString(renderToStaticMarkup(<AccountPanel account={settings.account} pages={1} />), "text/html");
    expect(text(one.querySelector('[data-testid="action-export"]'))).toBe("Your pages 1 page, with images Export everything");
  });
});

describe("the danger zone", () => {
  const zone = doc.querySelector('details[data-testid="settings-danger"]')!;

  it("is folded shut, its summary saying what is inside and how to only stop new pages", () => {
    expect(zone.hasAttribute("open")).toBe(false);
    expect(text(zone.querySelector("summary"))).toBe(
      "Danger zone Take every page down, or delete your account."
    );
    const pause = zone.querySelector(".collapse-content > p")!;
    expect(text(pause)).toBe("To stop new pages without taking any down, pause publishing instead.");
    expect(pause.querySelector("a")?.getAttribute("href")).toBe("/app/settings/publishing");
  });

  it("is a calm fold: only the two confirming presses are red", () => {
    expect([...zone.querySelectorAll(".btn-error")].map(text)).toEqual(["Take every page down", "Delete my account"]);
    expect(zone.querySelectorAll('[class*="text-error"], [class*="border-error"]')).toHaveLength(0);
    expect(zone.className).not.toContain("error");
  });

  it("then each action, its consequence and the word it is confirmed with, and no comparison grid", () => {
    expect(zone.querySelector('[data-testid="danger-compare"]')).toBeNull();
    for (const [action, title, word, consequence] of [
      ["unpublish_all", "Take every page down", "unpublish all", "We send your export first, then take every page down and pause publishing. Your account stays, and you can turn publishing on again."],
      ["delete_account", "Delete my account", "delete account", "We send your export, then take every page down. Your account closes for good, with no more charges."],
    ] as const) {
      const step = zone.querySelector(`[data-testid="danger-${action}"]`)!;
      expect(text(step.querySelector("h3"))).toBe(title);
      expect(text(step.querySelector(`[data-testid="consequence-${action}"]`))).toBe(consequence);
      expect(text(step.querySelector("label"))).toBe(`Type “${word}” to confirm`);
      expect(text(step.querySelector(`[data-testid="confirm-${action}"] button`))).toBe(title);
    }
  });
});
