// The draft editor is a `next/dynamic` island, so its module arrives after the
// edit arm first opens. A suite that drives the edit arm synchronously, under a
// fake clock, opens it once here first: every later render then finds the
// module already resolved, as a customer's second edit does.
import type React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { vi } from "vitest";

/** Opens the edit arm of `screen` through the control `editTestId` names and
 *  waits until the editor has rendered. */
export async function loadEditor(
  screen: React.ReactElement,
  editTestId = "draft-action-draft.action.edit"
): Promise<void> {
  const EDIT = `[data-testid="${editTestId}"]`;
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  try {
    await act(async () => root.render(screen));
    const at = host.querySelector(EDIT);
    const button = at instanceof HTMLButtonElement ? at : at?.querySelector("button");
    if (!(button instanceof HTMLButtonElement)) throw new Error(`no button at ${EDIT}`);
    await act(async () => button.click());
    await vi.waitFor(
      async () => {
        await act(async () => {});
        if (host.querySelector('[data-testid="draft-editor"]') === null) throw new Error("the editor has not loaded");
      },
      { timeout: 10_000 }
    );
  } finally {
    act(() => root.unmount());
    host.remove();
  }
}
