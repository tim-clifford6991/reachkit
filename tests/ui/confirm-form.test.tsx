// tests/ui/confirm-form.test.tsx — the sign-in link's one button (board AuthConfirm).
//
// A second press would post a link the first press already spent, and land
// the customer on the dead-link screen just after signing in.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { ConfirmForm } from "@/app/(public)/auth/confirm/ConfirmForm";

describe("the confirm button", () => {
  it("locks on the first press and keeps the fields it posts", () => {
    const host = document.createElement("div");
    document.body.append(host);
    act(() => createRoot(host).render(<ConfirmForm action="/auth/confirm/redeem" fields={{ token_hash: "h", type: "magiclink" }} label="Sign in" />));
    const form = host.querySelector("form")!;
    const button = host.querySelector("button")!;
    expect(button.disabled).toBe(false);

    act(() => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect([...form.querySelectorAll("input")].map((i) => [i.name, i.value, i.disabled])).toEqual([
      ["token_hash", "h", false],
      ["type", "magiclink", false],
    ]);
  });
});
