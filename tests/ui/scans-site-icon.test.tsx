// tests/ui/scans-site-icon.test.tsx — #1108, #1110 §6.
//
// A gallery card with no stored logo shows the site's own icon, and its
// first letter once neither icon loads — never a broken image.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { SiteIcon } from "@/app/(public)/scans/SiteIcon";

function mount(): HTMLElement {
  const host = document.createElement("div");
  document.body.append(host);
  act(() => createRoot(host).render(<SiteIcon domain="harbour.example" letter="H" look="card" noLogo="no logo found" />));
  return host;
}

function fail(host: HTMLElement): void {
  act(() => {
    host.querySelector("img")?.dispatchEvent(new Event("error"));
  });
}

describe("the icon of a site with no stored logo", () => {
  it("asks the site for its touch icon, then its favicon, then draws its letter", () => {
    const host = mount();
    expect(host.querySelector("img")?.getAttribute("src")).toBe("https://harbour.example/apple-touch-icon.png");
    expect(host.querySelector("img")?.getAttribute("referrerpolicy")).toBe("no-referrer");
    fail(host);
    expect(host.querySelector("img")?.getAttribute("src")).toBe("https://harbour.example/favicon.ico");
    fail(host);
    expect(host.querySelector("img")).toBeNull();
    expect(host.textContent).toBe("Hno logo found");
  });
});
