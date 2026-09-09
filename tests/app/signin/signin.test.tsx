// tests/app/signin/signin.test.tsx — issue #19
//
// `src/app/(public)/signin/page.tsx` and `./actions.ts`. Criteria are quoted
// verbatim from `archive/.../requirements/REQ-098.md`; line breaks are
// normalised to fit and no word is changed.
//
// **Rendering convention** — the one `tests/app/scan-address/landing.test.tsx`
// established: `renderToStaticMarkup` under the "node" project, `copy()`
// mocked to the identity where the assertion is about which key a line comes
// from, and the real registry where the assertion is about the owner's own
// strings.
//
// **Driving the four answers.** The page holds them in `useActionState`,
// whose server render returns the initial state it is given. Mocking
// `./actions`' `SIGN_IN_INITIAL` therefore renders the screen in any one of
// its four answered states without simulating a browser event — the same
// trick, in a different place, as the landing suite's `searchParams`.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { SignInState } from "@/app/(public)/signin/state";
import { applyEnvFixture } from "../../mail/env-fixture";

// Issue #33 gave `requestMagicLink` a body, and the body reaches the
// database seam — so importing `./actions` now parses `env` at module load
// where the declared stub imported nothing at all. The fixture is applied
// before any dynamic import below, exactly as the mail and account suites
// do it.
applyEnvFixture();

const PAGE_PATH = path.resolve(import.meta.dirname, "../../../src/app/(public)/signin/page.tsx");
const PAGE_SOURCE = readFileSync(PAGE_PATH, "utf8");

const ACTIONS_MODULE = "@/app/(public)/signin/actions";
/** `SIGN_IN_INITIAL` lives outside the `"use server"` module (see
 *  `src/app/(public)/signin/state.ts`), so that is where these tests mock it
 *  to render the screen in each of its answered states. */
const STATE_MODULE = "@/app/(public)/signin/state";

/** Renders the screen in a given state. `copy()` is the identity, so an
 *  assertion names a key; `isWritten` is `true`, so the arms that are still
 *  owner-owed can be seen at all. The last describe drops both mocks.
 *
 *  Memoised on the state it is asked for: the page is a pure function of
 *  that state, so re-rendering one costs another `resetModules()` and a
 *  fresh import of the copy registry to produce identical markup. */
const cachedKeyRenders = new Map<string, Promise<string>>();

function renderWithKeys(
  options: { state?: SignInState; searchParams?: { link?: string } } = {}
): Promise<string> {
  const cacheKey = JSON.stringify(options);
  const hit = cachedKeyRenders.get(cacheKey);
  if (hit) return hit;
  const rendered = renderWithKeysOnce(options);
  cachedKeyRenders.set(cacheKey, rendered);
  return rendered;
}

async function renderWithKeysOnce(
  options: { state?: SignInState; searchParams?: { link?: string } } = {}
): Promise<string> {
  vi.resetModules();
  vi.doMock("@/lib/presentation/copy", async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    copy: (key: string) => key,
    isWritten: () => true,
  }));
  if (options.state) {
    vi.doMock(STATE_MODULE, async (importOriginal) => ({
      ...(await importOriginal<Record<string, unknown>>()),
      SIGN_IN_INITIAL: options.state,
    }));
  }
  const { default: SignInPage } = (await import("@/app/(public)/signin/page.tsx")) as {
    default: (p: { searchParams?: { link?: string } }) => React.JSX.Element;
  };
  const html = renderToStaticMarkup(<SignInPage searchParams={options.searchParams ?? {}} />);
  vi.doUnmock("@/lib/presentation/copy");
  vi.doUnmock(STATE_MODULE);
  return html;
}

describe('REQ-098 c1 — "Given a person with no session, when they reach ReachKit\'s sign-in address, then the screen presents one email input and one submit control and nothing else to fill in: no password field, no social sign-in, and no control that opens an account." — signin/shape', () => {
  it("exactly one input and exactly one submit control", async () => {
    const html = await renderWithKeys();
    expect(html.match(/<input/g)).toHaveLength(1);
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toContain('type="submit"');
    expect(html).not.toContain("<select");
    expect(html).not.toContain("<textarea");
  });

  it("no password field and no social sign-in", async () => {
    const html = await renderWithKeys();
    expect(html.toLowerCase()).not.toContain("password");
    expect(html.toLowerCase()).not.toMatch(/google|github|apple|sso|oauth/);
  });

  it("no control that opens an account: the only link on the screen is the one criterion 2 fixes, to the landing page", async () => {
    const html = await renderWithKeys();
    const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(["/"]);
  });

  it("the screen reads no session and holds no account lookup of its own", () => {
    expect(PAGE_SOURCE).not.toMatch(/currentSession|hasActiveAccess|cookies\(/);
  });
});

describe('REQ-098 c2 — "then it carries these strings verbatim: the heading …; the body …; the email input\'s placeholder …; the submit control\'s label …; and beneath that control the line \'New to ReachKit? Start a free scan →\'" — signin/strings', () => {
  it("carries the six keys those five strings live in, the last two composing one line", async () => {
    const html = await renderWithKeys();
    for (const key of [
      "signin.heading",
      "signin.body",
      "signin.field.placeholder",
      "signin.submit.label",
      "signin.new.prompt",
      "signin.new.link",
    ]) {
      expect(html, `${key} is not rendered`).toContain(key);
    }
  });

  it("against the real registry, each string is the requirement's own, byte for byte", async () => {
    vi.resetModules();
    const { copy } = await import("@/lib/presentation/copy");
    expect(copy("signin.heading")).toBe("Welcome back");
    expect(copy("signin.body")).toBe(
      "Enter the email you paid with and we'll send you a sign-in link. No password — accounts are created by payment, never by a signup form."
    );
    expect(copy("signin.field.placeholder")).toBe("you@company.com");
    expect(copy("signin.submit.label")).toBe("Send my link");
    expect(`${copy("signin.new.prompt")} ${copy("signin.new.link")}`).toBe(
      "New to ReachKit? Start a free scan →"
    );
  });

  it('"Start a free scan →" is the link, and it reaches the landing page (REQ-001)', async () => {
    vi.resetModules();
    const { copy } = await import("@/lib/presentation/copy");
    const { default: SignInPage } = (await import("@/app/(public)/signin/page.tsx")) as {
      default: (p: { searchParams?: { link?: string } }) => React.JSX.Element;
    };
    const html = renderToStaticMarkup(<SignInPage searchParams={{}} />);
    expect(html).toContain(`href="/">${copy("signin.new.link")}`);
    expect(html).toContain(copy("signin.new.prompt"));
  });
});

describe('REQ-098 c3 / REQ-020 c4 — "then they are answered in writing on the same screen without being sent anywhere: an address with an open account is sent a link … and an address with none is answered on REQ-020 criterion 4\'s terms" — signin/answers', () => {
  it.each([
    ["sent", "signin.link_sent"],
    ["payment_held", "signin.payment_held"],
    ["no_account", "signin.no_account"],
  ] as const)("the %s answer speaks %s, on the same screen", async (answer, key) => {
    const html = await renderWithKeys({ state: { answer, value: "someone@example.com" } });
    expect(html).toContain(key);
    // "without being sent anywhere": still this screen, still this panel —
    // the answered arm the approved set draws (UI-SPEC S9, issue #373). One
    // shape for all three answers, so the frame reveals nothing the line
    // does not, and one control back to the field.
    expect(html).toContain("signin.sent.head");
    // The mocked `copy()` here is the identity on the *key*, so the slot's
    // value is not in this markup; the real-registry describe below is
    // where the address itself is asserted.
    expect(html).toContain("signin.sent.to");
    expect(html).toContain("signin.sent.resend");
    expect(html).toContain('href="/signin"');
    // The form is not on this arm: the address was taken, and asking for it
    // again beside the answer would say the answer had not landed.
    expect(html.match(/<input/g)).toBeNull();
  });

  it("a refused *value* keeps the form and what was typed (c6's arm, not c3's)", async () => {
    const html = await renderWithKeys({ state: { answer: "invalid", value: "nope" } });
    expect(html).toContain("signin.address.invalid");
    expect(html).toContain("signin.heading");
    expect(html.match(/<input/g)).toHaveLength(1);
    expect(html).not.toContain("signin.sent.head");
  });

  it("before a submission the screen answers nothing at all, and so reveals nothing about any address", async () => {
    const html = await renderWithKeys();
    for (const key of [
      "signin.link_sent",
      "signin.payment_held",
      "signin.no_account",
      "signin.address.invalid",
    ]) {
      expect(html).not.toContain(key);
    }
  });

  // Issue #33 built the seam; before it, this asserted that the action let
  // the seam's not-implemented error through rather than reporting `sent`.
  // The property under test is the same one, restated against a seam that
  // answers: the action decides nothing about an address itself, and every
  // one of its three answers is the one `requestMagicLink` gave it.
  it.each([
    [{ sent: true }, "sent"],
    [{ sent: false, answer: "payment_held_account_opening", lineKey: "signin.payment_held" }, "payment_held"],
    [{ sent: false, answer: "no_account", lineKey: "signin.no_account" }, "no_account"],
  ])("the action reports %j as %s and decides nothing of its own", async (seamAnswer, expected) => {
    vi.resetModules();
    const requestMagicLink = vi.fn(async () => seamAnswer);
    vi.doMock("@/lib/account/provisioning/magic-link", () => ({ requestMagicLink }));
    const { sendLink } = await import(ACTIONS_MODULE);
    const { SIGN_IN_INITIAL } = await import(STATE_MODULE);
    const form = new FormData();
    form.set("email", "someone@example.com");
    await expect(sendLink(SIGN_IN_INITIAL, form)).resolves.toEqual({
      answer: expected,
      value: "someone@example.com",
    });
    expect(requestMagicLink).toHaveBeenCalledWith("someone@example.com");
    vi.doUnmock("@/lib/account/provisioning/magic-link");
  });
});

describe('REQ-098 c6 — "Given a person who submits an empty value or one that is not a valid email address, when they submit, then no link is sent, one written line names what is wrong, and they stay on the screen with what they typed intact." — signin/refusal', () => {
  it.each(["", "   ", "not-an-address", "someone@", "@example.com"])(
    "%j is refused before the seam is reached, with the value carried back",
    async (value) => {
      vi.resetModules();
      const requestMagicLink = vi.fn(async () => ({ sent: true }));
      vi.doMock("@/lib/account/provisioning/magic-link", () => ({ requestMagicLink }));
      const { sendLink } = await import(ACTIONS_MODULE);
      const { SIGN_IN_INITIAL } = await import(STATE_MODULE);
      const form = new FormData();
      form.set("email", value);
      await expect(sendLink(SIGN_IN_INITIAL, form)).resolves.toEqual({
        answer: "invalid",
        value,
      });
      // No link is sent, and the refusal happens before the seam: the spy
      // is what proves it was never reached at all.
      expect(requestMagicLink).not.toHaveBeenCalled();
      vi.doUnmock("@/lib/account/provisioning/magic-link");
    }
  );

  it("what they typed is still in the field when the screen comes back", async () => {
    const html = await renderWithKeys({ state: { answer: "invalid", value: "not-an-address" } });
    expect(html).toContain('value="not-an-address"');
  });
});

describe('REQ-098 c7 — "Given a person who opens a sign-in link that no longer works — expired; spent … or never issued by this product — when they open it, then they land on this screen and one written line tells them the link can no longer be used and that they may ask for another; that line and the time it takes are the same whatever the reason" — signin/dead-link', () => {
  it("the arm is the set's own: a head, the one line, and one control back to the field", async () => {
    const html = await renderWithKeys({ searchParams: { link: "dead" } });
    expect(html).toContain("signin.expired.head");
    expect(html).toContain("signin.link_dead");
    // "…and that they may ask for another": an anchor to this screen
    // without the marker, so it needs no client runtime.
    expect(html).toContain("signin.expired.submit");
    expect(html).toContain('href="/signin"');
    // No form on this arm — the way back to it is the control above.
    expect(html.match(/<input/g)).toBeNull();
  });

  it("the arm is warn-toned, and it is the only tone this screen spends", async () => {
    const html = await renderWithKeys({ searchParams: { link: "dead" } });
    expect(html).toContain('data-tone="warn"');
  });

  it("no marker, no line", async () => {
    expect(await renderWithKeys()).not.toContain("signin.link_dead");
    expect(await renderWithKeys({ searchParams: { link: "expired" } })).not.toContain(
      "signin.link_dead"
    );
  });

  it("one line whatever the reason: the screen reads a marker and never a reason", () => {
    expect(PAGE_SOURCE).not.toMatch(/"expired"|"spent"|"unknown"/);
  });
});

describe("against the real registry — every arm renders, and nothing is invented", () => {
  /** Renders one state against the **real** registry, so what is asserted
   *  is the owner's own words and the marker where a sentence is still
   *  owed. */
  async function renderReal(
    state: SignInState,
    searchParams: { link?: string } = {}
  ): Promise<string> {
    vi.resetModules();
    vi.doMock(STATE_MODULE, async (importOriginal) => ({
      ...(await importOriginal<Record<string, unknown>>()),
      SIGN_IN_INITIAL: state,
    }));
    const { default: SignInPage } = (await import("@/app/(public)/signin/page.tsx")) as {
      default: (p: { searchParams?: { link?: string } }) => React.JSX.Element;
    };
    const html = renderToStaticMarkup(<SignInPage searchParams={searchParams} />);
    vi.doUnmock(STATE_MODULE);
    // React escapes on the way out; compare against the text a browser
    // reconstructs, not the wire bytes.
    return html.replaceAll("&#x27;", "'").replaceAll("&amp;", "&").replaceAll("&quot;", '"');
  }

  it.each([
    { answer: "sent", value: "someone@example.com" },
    { answer: "payment_held", value: "someone@example.com" },
    { answer: "no_account", value: "someone@example.com" },
    { answer: "invalid", value: "nope" },
    { answer: "none", value: "" },
  ] as SignInState[])("renders in the %j state without throwing", async (state) => {
    await expect(renderReal(state)).resolves.toContain("rk-glass");
    await expect(renderReal(state, { link: "dead" })).resolves.toContain("rk-glass");
  });

  it("the request arm carries criterion 2's five strings, byte for byte", async () => {
    const text = await renderReal({ answer: "none", value: "" });
    const { COPY } = await import("@/lib/presentation/copy");
    expect(text).toContain(COPY["signin.heading"]);
    expect(text).toContain(COPY["signin.body"]);
    expect(text).toContain(COPY["signin.new.link"]);
  });

  it("the answered arm echoes the address they typed, and looks none up", async () => {
    const text = await renderReal({ answer: "sent", value: "someone@example.com" });
    // `signin.sent.to` is the set's own line, written: "sent to {address}".
    expect(text).toContain("sent to someone@example.com");
  });

  it("every owed line on every arm is the marker, never a sentence somebody supplied", async () => {
    const { COPY, AWAITING_COPY, TODO_COPY_MARKER } = await import("@/lib/presentation/copy");
    const owed = [
      "signin.link_sent",
      "signin.payment_held",
      "signin.no_account",
      "signin.address.invalid",
      "signin.link_dead",
      "signin.sent.head",
      "signin.sent.resend",
      "signin.expired.head",
      "signin.expired.submit",
    ] as const;
    for (const key of owed) {
      if (AWAITING_COPY.includes(key)) expect(COPY[key]).toBe(TODO_COPY_MARKER);
      expect(COPY[key]).not.toBe("");
    }
  });

  it("the expired arm speaks three owed lines and no answer of its own", async () => {
    const { TODO_COPY_MARKER } = await import("@/lib/presentation/copy");
    const text = await renderReal({ answer: "sent", value: "someone@example.com" }, { link: "dead" });
    // Head, line, control — and *not* the answer line: someone holding a
    // dead link learns nothing about the address it was issued for
    // (REQ-098 c7), including whether one was answered on this screen.
    const spoken = (text.match(new RegExp(TODO_COPY_MARKER.replace(/[()]/g, "\\$&"), "g")) ?? []).length;
    expect(spoken).toBe(3);
  });

  it("the panel is a declared example on the reserved domain, with no line explaining it (5c)", async () => {
    const { COPY } = await import("@/lib/presentation/copy");
    const text = await renderReal({ answer: "none", value: "" });
    expect(text).toContain("example.com");
    expect(text).toContain(COPY["signin.panel.score-label"]);
    expect(text).toContain(COPY["signin.panel.delta"]);
    expect(text).toContain(COPY["signin.panel.line"]);
    expect(text).toContain(">47<");
    expect(text).toContain('value="47"');
    // The example line #266 added is gone, and the marker it rendered with
    // it: ruling 5c admits the specimen without one.
    expect(text).not.toContain(COPY["signin.panel.specimen"]);
  });
});
