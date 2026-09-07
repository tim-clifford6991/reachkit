// BUILD §4.2 — GET /opt-out/{token}: one line, and nothing else on the page.
//
// The component is called directly and its returned element tree is
// inspected, the same direct-call convention `tests/app/layout.test.ts`
// uses for `RootLayout` — no DOM, so this suite runs in the `node` project
// beside the rest of `tests/app/**`.
//
// All three arms render (issue #261). The third one's sentence is still
// the owner's and still unwritten; what changed is that the page says so
// with the marker instead of throwing, so "the store is down" no longer
// means "and so is this page".
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type React from "react";
import { applyEnvFixture } from "../../mail/env-fixture";
import { blankLead, memoryStore, newMemoryState, type MemoryState } from "../../mail/leads/memory-store";
import { codeOf } from "../../mail/leads/source";

applyEnvFixture();

const OptOutPage = (await import("../../../src/app/(public)/opt-out/[token]/page")).default;
const { optOutTokenFor } = await import("../../../src/lib/mail/leads/optout");
const { setLeadStore } = await import("../../../src/lib/mail/leads/store");
const { COPY } = await import("../../../src/lib/presentation/copy");
const { TODO_COPY_MARKER } = await import("../../../src/lib/presentation/copy/registry");

let state: MemoryState;

interface Node {
  type: unknown;
  props: Record<string, unknown>;
}

/** Every element in a returned tree, flattened. */
function nodes(element: React.ReactNode): Node[] {
  if (element === null || typeof element !== "object") return [];
  const node = element as unknown as Node;
  const children = (node.props?.children ?? null) as React.ReactNode;
  const list = Array.isArray(children) ? children : [children];
  return [node, ...list.flatMap((child) => nodes(child))];
}

function named(tree: React.ReactNode, name: string): Node | undefined {
  return nodes(tree).find((node) => (node.type as { name?: string })?.name === name);
}

beforeEach(() => {
  state = newMemoryState();
  setLeadStore(memoryStore(state));
});

afterEach(() => setLeadStore(null));

describe("three arms, three tones, no fourth rendering and no default arm", () => {
  it("a valid token renders the confirmation line, and the address is suppressed", async () => {
    state.leads = [
      blankLead({
        id: "l1",
        email: "anna@example.com",
        domain: "acme.com",
        sequence_state: "running",
      }),
    ];

    const tree = await OptOutPage({ params: { token: optOutTokenFor("anna@example.com") } });
    const alert = named(tree, "Alert");

    expect(alert?.props.tone).toBe("ok");
    expect(alert?.props.message).toBe(COPY["optout.confirmed"]);
    expect(state.suppressions.get("anna@example.com")).toBe("opt_out");
    expect(state.leads[0]?.sequence_state).toBe("stopped");
  });

  it("a token that is not one of ours renders the invalid line and writes nothing", async () => {
    const tree = await OptOutPage({ params: { token: "not-a-token" } });
    const alert = named(tree, "Alert");

    expect(alert?.props.tone).toBe("warn");
    expect(alert?.props.message).toBe(COPY["optout.invalid"]);
    expect(state.suppressions.size).toBe(0);
  });

  it("our store being down is its own arm, and its owner-owed line renders as the marker rather than taking the page down", async () => {
    state.failSuppressionWrite = true;

    // Issue #261. This arm is reached at the moment the store is
    // unavailable, which is the moment a reader can least afford a blank
    // page — so the unwritten line shows the `TODO(copy)` marker and the
    // page still renders, on the standing screen rule. The arm is still
    // distinct: its own tone, and neither of the other two lines.
    const tree = await OptOutPage({
      params: { token: optOutTokenFor("anna@example.com") },
    });
    const alert = named(tree, "Alert");

    expect(alert?.props.tone).toBe("neutral");
    expect(alert?.props.message).toBe(TODO_COPY_MARKER);
    expect(alert?.props.message).not.toBe(COPY["optout.confirmed"]);
    expect(alert?.props.message).not.toBe(COPY["optout.invalid"]);
    // It renders the marker without having suppressed anything: the arm
    // says the write did not happen, and it did not.
    expect(state.suppressions.size).toBe(0);
  });

  it("Next's promised params and a resolved object are both accepted", async () => {
    const token = optOutTokenFor("anna@example.com");
    const fromPromise = await OptOutPage({ params: Promise.resolve({ token }) });
    expect(named(fromPromise, "Alert")?.props.tone).toBe("ok");
  });
});

describe("nothing else is on the page", () => {
  it("no control, no form, no field, and no navigation into the product", async () => {
    const tree = await OptOutPage({ params: { token: optOutTokenFor("anna@example.com") } });
    const types = nodes(tree).map((node) => (node.type as { name?: string })?.name ?? node.type);

    expect(types).not.toContain("Btn");
    expect(types).not.toContain("Input");
    expect(types).not.toContain("Toggle");
    expect(types).not.toContain("form");
    expect(types).not.toContain("a");
  });

  it("the address is never echoed back onto the page", async () => {
    const tree = await OptOutPage({ params: { token: optOutTokenFor("anna@example.com") } });
    // An opt-out link forwarded to someone else must not disclose whose it
    // was.
    expect(JSON.stringify(nodes(tree).map((node) => node.props))).not.toContain(
      "anna@example.com"
    );
  });

  it("it is composed from registered components and holds no string a person reads", () => {
    const code = codeOf("src/app/(public)/opt-out/[token]/page.tsx");
    expect(code).toMatch(/from "@\/ui\/components"/);
    expect(code).toMatch(/from "@\/ui\/layout"/);
    // Every sentence goes through `copy()`; nothing is written here.
    expect(code).not.toMatch(/message=\{"|message="/);
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
