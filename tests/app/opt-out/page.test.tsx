// UI-SPEC S7 — GET /opt-out/{token}: one card, and the head says which arm.
//
// The component is called directly and its returned element tree is
// inspected, the same direct-call convention `tests/app/layout.test.ts`
// uses for `RootLayout` — no DOM, so this suite runs in the `node` project
// beside the rest of `tests/app/**`.
//
// **Two of this suite's promises were reversed by the approved set**
// (owner, 2026-09-08; issue #372), and they are asserted the other way
// round here rather than deleted:
//
//   - the address **is** echoed, because S7 draws it inside the
//     confirmation line. This file used to assert it never appeared, on
//     this build's own reasoning about forwarded links; the owner's drawing
//     of the screen settles it, and UI-SPEC wins over BUILD §4 until §4's
//     amendment lands (UI-SPEC's own header). What is still asserted is
//     that the address appears *only* on the arm that opted somebody out —
//     a link that was not ours discloses nothing.
//   - there **is** one control, the quiet "Back to ReachKit" the set draws.
//     What no arm has is a second one, a form or a field: nothing on this
//     page asks the reader to do anything.
//
// All three arms render (issue #261). The unavailable arm's sentence and
// the unresolved arms' head were the owner's and rendered the `TODO(copy)`
// marker; since issue #458 (the owner's 2026-09-10 approval) both carry
// their approved sentence, and no arm renders the marker.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type React from "react";
import { applyEnvFixture } from "../../mail/env-fixture";
import { blankLead, memoryStore, newMemoryState, type MemoryState } from "../../mail/leads/memory-store";
import { codeOf } from "../../mail/leads/source";

applyEnvFixture();

const OptOutPage = (await import("../../../src/app/(public)/opt-out/[token]/page")).default;
const { optOutTokenFor } = await import("../../../src/lib/mail/leads/optout");
const { setLeadStore } = await import("../../../src/lib/mail/leads/store");
const { COPY, copy } = await import("../../../src/lib/presentation/copy");
const { TODO_COPY_MARKER } = await import("../../../src/lib/presentation/copy/registry");

let state: MemoryState;

interface Node {
  type: unknown;
  props: Record<string, unknown>;
}

/** Every element in a returned tree, flattened.
 *
 *  It descends through **every** prop and not only `children`: the approved
 *  idiom hands a card its head as a prop (`IdiomCard head={<CardHead/>}`),
 *  and a walker that followed children alone would report this page as
 *  having no head at all. */
function nodes(element: React.ReactNode): Node[] {
  if (element === null || typeof element !== "object") return [];
  const node = element as unknown as Node;
  const nested: React.ReactNode[] = [];
  for (const value of Object.values(node.props ?? {})) {
    if (Array.isArray(value)) nested.push(...(value as React.ReactNode[]));
    else nested.push(value as React.ReactNode);
  }
  return [node, ...nested.flatMap((child) => nodes(child))];
}

function named(tree: React.ReactNode, name: string): Node | undefined {
  return nodes(tree).find((node) => (node.type as { name?: string })?.name === name);
}

/** The card's own head — S7's mail chip and its eyebrow. */
function eyebrowOf(tree: React.ReactNode): unknown {
  return named(tree, "CardHead")?.props.eyebrow;
}

/** Every string-valued prop anywhere in the tree — the words the page puts
 *  in front of a reader, and the values it hands its components. Collected
 *  as strings rather than as one JSON blob so a sentence carrying a quoted
 *  word (`optout.invalid` carries `"stop"`) is compared as itself and not
 *  against its escaped form. */
function textsOf(tree: React.ReactNode): string[] {
  return nodes(tree).flatMap((node) =>
    Object.values(node.props ?? {}).filter((value): value is string => typeof value === "string")
  );
}

beforeEach(() => {
  state = newMemoryState();
  setLeadStore(memoryStore(state));
});

afterEach(() => setLeadStore(null));

describe("three arms, three heads, no fourth rendering and no default arm", () => {
  it("a valid token renders S7's head, the set's line, and the address inside it", async () => {
    state.leads = [
      blankLead({
        id: "l1",
        email: "anna@example.com",
        domain: "acme.com",
        sequence_state: "running",
      }),
    ];

    const tree = await OptOutPage({ params: { token: optOutTokenFor("anna@example.com") } });

    expect(eyebrowOf(tree)).toBe(COPY["optout.head"]);
    // The line is composed, not resolved: the set draws the address inside
    // the sentence in the mono face, so the page hands `AddressLine` the
    // key and the address rather than a finished string.
    const line = named(tree, "AddressLine");
    expect(line?.props.copyKey).toBe("optout.confirmed");
    expect(line?.props.address).toBe("anna@example.com");

    expect(state.suppressions.get("anna@example.com")).toBe("opt_out");
    expect(state.leads[0]?.sequence_state).toBe("stopped");
  });

  it("a token that is not one of ours renders the invalid line and writes nothing", async () => {
    const tree = await OptOutPage({ params: { token: "not-a-token" } });

    expect(textsOf(tree)).toContain(COPY["optout.invalid"]);
    expect(state.suppressions.size).toBe(0);
  });

  it("our store being down is its own arm, and its own line renders rather than the page going down", async () => {
    state.failSuppressionWrite = true;

    // Issue #261. This arm is reached at the moment the store is
    // unavailable, which is the moment a reader can least afford a blank
    // page — so the page still renders, with the line written for this arm
    // (filled by #458) and not the marker it carried before.
    const tree = await OptOutPage({
      params: { token: optOutTokenFor("anna@example.com") },
    });
    const texts = textsOf(tree);

    expect(COPY["optout.unavailable"]).not.toBe("");
    expect(texts).toContain(COPY["optout.unavailable"]);
    expect(texts).not.toContain(TODO_COPY_MARKER);
    expect(texts).not.toContain(COPY["optout.invalid"]);
    // It renders the line without having suppressed anything: the arm
    // says the write did not happen, and it did not.
    expect(state.suppressions.size).toBe(0);
  });

  it("only the arm that opted somebody out wears S7's head", async () => {
    // "Opted out" over "that unsubscribe link isn't valid any more" would
    // be the card contradicting itself in its own head. The other two arms
    // take their own head (filled by #458), never the marker.
    for (const token of ["not-a-token", ""]) {
      const tree = await OptOutPage({ params: { token } });
      expect(eyebrowOf(tree)).toBe(COPY["optout.head.unresolved"]);
      expect(eyebrowOf(tree)).not.toBe(TODO_COPY_MARKER);
      expect(eyebrowOf(tree)).not.toBe(COPY["optout.head"]);
    }
  });

  it("Next's promised params and a resolved object are both accepted", async () => {
    const token = optOutTokenFor("anna@example.com");
    const fromPromise = await OptOutPage({ params: Promise.resolve({ token }) });
    expect(eyebrowOf(fromPromise)).toBe(COPY["optout.head"]);
  });
});

describe("the set's card, and nothing else on the page", () => {
  it("it is the approved idiom's card with the mail chip in its head", async () => {
    const tree = await OptOutPage({ params: { token: "not-a-token" } });
    const types = nodes(tree).map((node) => (node.type as { name?: string })?.name ?? node.type);

    expect(types).toContain("IdiomCard");
    expect(types).toContain("CardHead");
    // The `Alert` block this page used to render is on no screen the set
    // draws: the line is the card's body.
    expect(types).not.toContain("Alert");
  });

  it("one control on every arm — the quiet way back — and no form, field or toggle", async () => {
    for (const token of ["not-a-token", optOutTokenFor("anna@example.com")]) {
      const tree = await OptOutPage({ params: { token } });
      const buttons = nodes(tree).filter((node) => (node.type as { name?: string })?.name === "Btn");

      expect(buttons).toHaveLength(1);
      expect(buttons[0]?.props.label).toBe(copy("chrome.back-to-reachkit"));
      expect(buttons[0]?.props.variant).toBe("tertiary");
      expect(buttons[0]?.props.href).toBe("/");

      const types = nodes(tree).map((node) => (node.type as { name?: string })?.name ?? node.type);
      expect(types).not.toContain("Input");
      expect(types).not.toContain("Toggle");
      expect(types).not.toContain("form");
    }
  });

  it("the address reaches the page only on the arm that opted that address out", async () => {
    // S7 draws the address on the confirmation. A link that was not ours
    // opted nobody out and so has no address to name — a forwarded dud
    // still discloses nothing.
    const tree = await OptOutPage({ params: { token: "not-a-token" } });
    expect(textsOf(tree).join(" ")).not.toContain("anna@example.com");
  });

  it("it is composed from registered components and holds no string a person reads", () => {
    const code = codeOf("src/app/(public)/opt-out/[token]/page.tsx");
    expect(code).toMatch(/from "@\/ui\/idiom"/);
    expect(code).toMatch(/from "@\/ui\/layout"/);
    // Every sentence goes through `copy()`; nothing is written here.
    expect(code).not.toMatch(/label=\{"|label="/);
  });

  it("it renders without a session, a cookie or a payment", () => {
    const code = codeOf("src/app/(public)/opt-out/[token]/page.tsx");
    expect(code).not.toMatch(/cookies\(|headers\(|currentSession|hasActiveAccess/);
  });

  it("the route is on the public allow-list", async () => {
    const { PUBLIC_PATHS } = await import("../../../src/middleware");
    expect(PUBLIC_PATHS).toContain("/opt-out/:token");
  });
});

describe("the surface reads one arm per request and holds no suppression logic", () => {
  it("it calls applyOptOutToken and never suppressAddress — one entry point to one capability", () => {
    const code = codeOf("src/app/(public)/opt-out/[token]/page.tsx");
    expect(code).toMatch(/applyOptOutToken/);
    expect(code).not.toMatch(/suppressAddress|email_suppressions|leadStore/);
  });
});
