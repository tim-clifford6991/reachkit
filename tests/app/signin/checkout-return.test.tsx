// `/signin?from=checkout`: where a return from payment that could not sign
// the buyer in lands. One honest line above the form, and no way back to the price page.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { default: SignInPage } = await import("@/app/(public)/signin/page.tsx");
const { copy } = await import("@/lib/presentation/copy");
const { checkoutSignInPath } = await import("@/lib/account/identity/addresses");

const render = (searchParams: Record<string, string>): string =>
  renderToStaticMarkup(<SignInPage searchParams={searchParams} />);

const markerOf = (): Record<string, string> =>
  Object.fromEntries(new URL(checkoutSignInPath(), "https://reachkit.example").searchParams);

const LINE = copy("signin.checkout_return");

describe("a checkout return's sign-in screen", () => {
  it("the route's own marker shows the line under the heading, above the body and the form", () => {
    const html = render(markerOf());
    expect(html).toContain(LINE);
    expect(html.indexOf(LINE)).toBeGreaterThan(html.indexOf(copy("signin.heading")));
    expect(html.indexOf(LINE)).toBeLessThan(html.indexOf(copy("signin.body")));
    expect(html.indexOf(LINE)).toBeLessThan(html.indexOf("<form"));
  });

  it("offers no pricing link and no buy button", () => {
    const html = render(markerOf());
    expect(html).not.toContain("/pricing");
    expect(html).not.toContain(copy("chrome.nav.pricing"));
  });

  it("is the plain screen with exactly that one line added", () => {
    const withLine = render(markerOf());
    const plain = render({});
    expect(plain).not.toContain(LINE);
    expect(withLine.replace(`<p class="text-sm text-base-content/70">${LINE}</p>`, "")).toBe(plain);
  });

  it.each<Record<string, string>>([{ from: "elsewhere" }, { link: "dead" }])("no line without the marker: %j", (params) => {
    expect(render(params)).not.toContain(LINE);
  });
});
