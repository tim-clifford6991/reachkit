// A second press would post a link the first press spent, and land the customer on the dead-link screen.
import { StrictMode, act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmForm } from "@/app/(public)/auth/confirm/ConfirmForm";

afterEach(() => void vi.restoreAllMocks());

/** Mounted under StrictMode, with `requestSubmit` firing the submit event as the browser's does. */
function mount(auto?: boolean) {
  const submit = vi.spyOn(HTMLFormElement.prototype, "requestSubmit").mockImplementation(function (this: HTMLFormElement) {
    this.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  const host = document.createElement("div");
  document.body.append(host);
  const form = <ConfirmForm action="/auth/confirm/redeem" fields={{ token_hash: "h", type: "magiclink" }} label="Sign in" auto={auto} />;
  act(() => createRoot(host).render(<StrictMode>{form}</StrictMode>));
  return { submit, button: host.querySelector("button")! };
}

describe("the confirm button", () => {
  it("locks on the first press and keeps the fields it posts", () => {
    const host = document.createElement("div");
    document.body.append(host);
    act(() => createRoot(host).render(<ConfirmForm action="/auth/confirm/redeem" fields={{ token_hash: "h", type: "magiclink" }} label="Sign in" />));
    const form = host.querySelector("form")!;
    const button = host.querySelector("button")!;
    expect(button.disabled).toBe(false);

    act(() => void form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));

    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect([...form.querySelectorAll("input")].map((i) => [i.name, i.value, i.disabled])).toEqual([
      ["token_hash", "h", false],
      ["type", "magiclink", false],
    ]);
  });

  it("told to, it sends itself exactly once under StrictMode and locks as after a press", () => {
    const { submit, button } = mount(true);
    expect([submit.mock.calls.length, button.disabled, button.getAttribute("aria-busy")]).toEqual([1, true, "true"]);
  });

  it("not told to, it waits for the press", () => {
    const { submit, button } = mount();
    expect([submit.mock.calls.length, button.disabled]).toEqual([0, false]);
  });
});
