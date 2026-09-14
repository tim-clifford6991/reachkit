/** @vitest-environment jsdom */
// tests/app/theme/theme.test.ts — #681: Light / Dark / System survives a
// reload, and System leaves the OS in charge.
import { beforeEach, describe, expect, it } from "vitest";
import { applyThemeChoice, readThemeChoice, THEME_SCRIPT } from "@/app/_theme/theme";

/** A reload: a fresh document root, then the before-paint script. */
function reload(): string | null {
  document.documentElement.removeAttribute("data-theme");
  new Function(THEME_SCRIPT)();
  return document.documentElement.getAttribute("data-theme");
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("#681 — the theme choice", () => {
  it("light and dark set data-theme now and again after a reload", () => {
    for (const choice of ["light", "dark"] as const) {
      applyThemeChoice(choice);
      expect(document.documentElement.getAttribute("data-theme")).toBe(choice);
      expect(reload()).toBe(choice);
      expect(readThemeChoice()).toBe(choice);
    }
  });

  it("system sets no data-theme, before or after a reload, so the media query decides", () => {
    applyThemeChoice("dark");
    applyThemeChoice("system");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(reload()).toBeNull();
    expect(readThemeChoice()).toBe("system");
  });

  it("a first visit or a stored value that is not a choice is system", () => {
    expect(reload()).toBeNull();
    window.localStorage.setItem("reachkit-theme", "neon");
    expect(reload()).toBeNull();
    expect(readThemeChoice()).toBe("system");
  });
});
