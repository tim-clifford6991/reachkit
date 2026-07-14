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

  it("does not sign out on initial render — the confirm dialog is closed", () => {
    // The destructive copy only appears once the dialog opens; the initial
    // static markup is just the trigger + hidden form.
    expect(html).not.toContain("need your email to sign back in");
  });
});
