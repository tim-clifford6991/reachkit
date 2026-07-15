import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SignOutButton } from "./sign-out-button";

describe("SignOutButton (WS6)", () => {
  const html = renderToStaticMarkup(<SignOutButton />);

  it("renders a visible 'Sign out' label (not just a power glyph)", () => {
    expect(html).toContain("Sign out");
  });

  it("keeps sign-out a POST to /auth/signout (never a GET link)", () => {
    expect(html).toContain('action="/auth/signout"');
    expect(html).toContain('method="post"');
  });

  it("the trigger is a type=button (submit only happens after confirm)", () => {
    // The button must NOT be a submit button — it submits the form only after
    // window.confirm() passes, so a stray click can't sign the user out.
    expect(html).toContain('type="button"');
  });

  it("does not shrink — the sidebar name truncates instead (2026-07-15 layout fix)", () => {
    // It sits beside a long, unbreakable userName in the sidebar footer. Without
    // flexShrink:0 the name wins the flex negotiation and squashes/collides with
    // the control (the reported "formatted poorly" bug). The name gives way, not
    // the sign-out affordance.
    expect(html).toMatch(/flex-shrink:\s*0/);
  });
});
