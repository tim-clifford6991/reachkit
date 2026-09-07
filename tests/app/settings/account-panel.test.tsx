/** @vitest-environment jsdom */
// tests/app/settings/account-panel.test.tsx — BUILD §4.7, REQ-077 c1/c4,
// issue #134
//
// What the account card *states*, arm by arm. The server boundary is doubled
// here — a jsdom mount has no server, and what those three functions do is
// `account-actions.test.ts`'s question against the real seam. This file asks
// the other half: given a card, does the screen show the right thing.
//
// **`copy()` resolves to its key and `COPY` is real**, the convention the
// shell's suites set: the assertions are about which key a line comes from,
// never the owner's wording, and a real `COPY` is what lets `writtenLine`'s
// owner-owed branch behave here exactly as it does in production — which is
// the branch both note lines are on today.
//
// That last fact is why the notes are asserted twice. Both of
// `ACCOUNT_NOTE_KEYS` are owner-owed, so a card that read the prop and a
// card that ignored it render the same nothing; the discriminating test
// hands the card two keys that *are* written and reads back what it drew,
// in the order it was given them.
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";

vi.mock("@/lib/presentation/copy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/presentation/copy")>();
  return {
    ...actual,
    copy: (key: string, vars?: Record<string, string>) =>
      vars === undefined ? key : `${key}:${Object.values(vars).join(",")}`,
  };
});

const { begun } = vi.hoisted(() => ({ begun: [] as string[] }));

vi.mock("@/app/(account)/app/settings/account-actions", () => ({
  signOutAction: async () => ({ done: "elsewhere", href: "/" }),
  beginEmailChangeAction: async (_previous: unknown, form: FormData) => {
    begun.push(String(form.get("new_email")));
    return { answer: "idle" };
  },
  cancelEmailChangeAction: async () => undefined,
}));

const { AccountPanel } = await import("@/app/(account)/app/settings/panels/AccountPanel");
const { ACCOUNT_NOTE_KEYS } = await import("@/lib/account/identity/notes");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type AccountView = React.ComponentProps<typeof AccountPanel>["account"];

const AT_REST: AccountView = {
  name: "A Founder",
  email: "founder@example.com",
  pending: null,
  noteKeys: ACCOUNT_NOTE_KEYS,
};

async function mount(account: AccountView): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(<AccountPanel account={account} />);
  });
  return container;
}

const text = (root: HTMLElement): string => root.textContent ?? "";

/** The card's own code, comments stripped — citing a rule is not reaching
 *  for the mechanism it forbids (`tests/mail/leads/source.ts`'s reason). */
function panelSource(): string {
  return readFileSync(
    path.resolve(import.meta.dirname, "../../../src/app/(account)/app/settings/panels/AccountPanel.tsx"),
    "utf8"
  )
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}

beforeEach(() => {
  document.body.innerHTML = "";
  begun.length = 0;
});

describe("REQ-077 c1 — what the card shows at rest", () => {
  it("states the name and the address the account signs in with", async () => {
    const root = await mount(AT_REST);
    expect(text(root)).toContain("A Founder");
    expect(text(root)).toContain("founder@example.com");
  });

  it("an account with no name renders an empty value, never the word null", async () => {
    const root = await mount({ ...AT_REST, name: null });
    expect(text(root)).not.toContain("null");
    // The label still names what is missing.
    expect(text(root)).toContain("settings.account.name");
  });

  it("§2.3 — the address is a code-like string and renders in the mono face", async () => {
    const root = await mount(AT_REST);
    const address = [...root.querySelectorAll(".num")].map((el) => el.textContent);
    expect(address).toContain("founder@example.com");
  });

  it("the notes are whatever keys identity returned, in that order — the card holds no list", async () => {
    // Two keys the owner *has* written, so the card's own rendering can be
    // read back. Handed in this order deliberately: a card with the pair
    // hardcoded would draw them the other way round, or draw the real two.
    const given = ["settings.account.sign-out", "settings.account.name"] as unknown as typeof ACCOUNT_NOTE_KEYS;
    const root = await mount({ ...AT_REST, noteKeys: given });
    const notes = [...root.querySelectorAll("p")].map((el) => el.textContent);
    expect(notes).toEqual([...given]);
  });

  it("the card names no note key of its own — it renders the ones it is handed", async () => {
    const source = panelSource();
    for (const key of ACCOUNT_NOTE_KEYS) expect(source).not.toContain(key);
    expect(source).toContain("noteKeys.map");
  });

  it("a note the owner has not written renders as nothing, never as a placeholder", async () => {
    // Both of `ACCOUNT_NOTE_KEYS` are owner-owed today, so the card draws
    // neither line — and draws no stand-in for them either.
    const root = await mount(AT_REST);
    const body = text(root);
    for (const key of ACCOUNT_NOTE_KEYS) expect(body).not.toContain(key);
    expect(root.querySelectorAll("p")).toHaveLength(0);
  });
});

describe("REQ-077 c4 — a change awaiting confirmation", () => {
  const PENDING: AccountView = {
    ...AT_REST,
    pending: { email: "new@example.com", expiresAt: "7 Sep 2026, 12:00" },
  };

  it("nothing pending renders no pending block at all", async () => {
    const root = await mount(AT_REST);
    expect(root.querySelector('[data-testid="email-pending"]')).toBeNull();
  });

  it("shows the address awaiting confirmation, and it is not the signed-in one", async () => {
    const root = await mount(PENDING);
    const block = root.querySelector('[data-testid="email-pending"]');
    expect(block).not.toBeNull();
    expect(block?.textContent).toContain("new@example.com");

    // The card must not read as though the change had happened: the address
    // the account signs in with is still stated, and still the old one.
    const signedIn = root.querySelector('[data-testid="setting-email"]');
    expect(signedIn?.textContent).toContain("founder@example.com");
    expect(signedIn?.textContent).not.toContain("new@example.com");
  });

  it("names when the link lapses, from the moment the model formatted — not one it computes", async () => {
    const root = await mount(PENDING);
    const block = root.querySelector('[data-testid="email-pending"]');
    expect(block?.textContent).toContain("settings.account.email-pending-expires:7 Sep 2026, 12:00");
  });

  it("offers cancelling it", async () => {
    const root = await mount(PENDING);
    const block = root.querySelector('[data-testid="email-pending"]') as HTMLElement;
    expect(block.querySelector("form")).not.toBeNull();
    expect(block.textContent).toContain("settings.account.cancel-change");
  });

  it("offers replacing it — the same one field, whether or not a change is in flight", async () => {
    for (const account of [AT_REST, PENDING]) {
      const root = await mount(account);
      const form = root.querySelector('[data-testid="email-change"]') as HTMLFormElement;
      expect(form).not.toBeNull();
      expect(form.querySelector(`[name="new_email"]`)).not.toBeNull();
    }
  });
});

describe("the card decides nothing about an address change", () => {
  it("submitting hands the typed address to the seam, verbatim", async () => {
    const root = await mount(AT_REST);
    const form = root.querySelector('[data-testid="email-change"]') as HTMLFormElement;
    const field = form.querySelector('[name="new_email"]') as HTMLInputElement;

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      setter?.call(field, "typed@example.com");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      form.requestSubmit();
    });

    expect(begun).toEqual(["typed@example.com"]);
  });

  it("the card holds no validator, no clock and no second copy of the window", () => {
    expect(panelSource()).not.toMatch(/EMAIL_CHANGE_TTL_H|new Date\(|Date\.now|z\.email|@\/lib\/db/);
  });
});
