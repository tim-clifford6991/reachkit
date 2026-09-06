// BUILD §9 — GET /veto/{token}: one line, four arms, and nothing else on
// the page.
//
// The component is called directly and its returned element tree is
// inspected, the same direct-call convention `tests/app/opt-out/page.test.tsx`
// uses — no DOM, so this suite runs in the `node` project beside the rest
// of `tests/app/**`.
//
// The redemption itself is `tests/publish/publishable/veto.test.ts`'s and is
// not re-tested here: this suite asserts that the surface asks for it
// exactly once per request and renders one arm per answer.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type React from "react";
import { applyEnvFixture } from "../../mail/env-fixture";
import { codeOf } from "../../mail/leads/source";
import type { RedeemResult } from "../../../src/lib/publish/publishable";

applyEnvFixture();

/** The redemption's answer for the test about to run, and the tokens it was
 *  asked about. A plain function rather than a `vi.fn`: one of the cases
 *  below is a redemption that *rejects*, and vitest's own tracking of a
 *  mock's settled results drops its handler on the rejected promise when
 *  the mock is cleared between tests — surfacing as an unhandled rejection
 *  against a test that passed. The record this file needs is one array. */
let answer: (token: string) => Promise<RedeemResult> = async () => ({
  ok: false,
  reason: "unknown",
});
const asked: string[] = [];

vi.mock("@/lib/publish/publishable", () => ({
  redeemVetoLink: (token: string) => {
    asked.push(token);
    return answer(token);
  },
}));

const VetoPage = (await import("../../../src/app/(public)/veto/[token]/page")).default;
const { COPY } = await import("../../../src/lib/presentation/copy");

const PAGE = "src/app/(public)/veto/[token]/page.tsx";

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

async function render(result: RedeemResult): Promise<Node | undefined> {
  answer = async () => result;
  return named(await VetoPage({ params: { token: "a-token" } }), "Alert");
}

beforeEach(() => {
  asked.length = 0;
  answer = async () => ({ ok: false, reason: "unknown" });
});

describe("four arms, one written line, no fifth rendering and no default arm", () => {
  it("a valid link is vetoed, and says so", async () => {
    const alert = await render({ ok: true, draftId: "d1" });
    expect(alert?.props.tone).toBe("ok");
    expect(alert?.props.message).toBe(COPY["publish.veto.stopped"]);
  });

  it("a link already used says it was already used, not that it is not a link", async () => {
    const alert = await render({ ok: false, reason: "used" });
    expect(alert?.props.tone).toBe("neutral");
    expect(alert?.props.message).toBe(COPY["publish.veto.alreadyUsed"]);
  });

  it("a link past its expiry says the moment to stop has passed", async () => {
    const alert = await render({ ok: false, reason: "expired" });
    expect(alert?.props.tone).toBe("warn");
    expect(alert?.props.message).toBe(COPY["publish.veto.expired"]);
  });

  it("a page that has already left review reads as the same fact, and names nothing about the page", async () => {
    // To the holder of the link, `expired` and `not_in_review` are one
    // thing: there is no longer anything to stop. What became of the page
    // is a fact this screen holds no session to be told.
    const alert = await render({ ok: false, reason: "not_in_review" });
    expect(alert?.props.message).toBe(COPY["publish.veto.expired"]);
  });

  it("a link that is not one of ours says so, and no arm renders blank", async () => {
    const alert = await render({ ok: false, reason: "unknown" });
    expect(alert?.props.tone).toBe("warn");
    expect(alert?.props.message).toBe(COPY["publish.veto.unknown"]);
  });

  it("every arm renders a line — the four keys are the marker, never an empty string", async () => {
    const results: RedeemResult[] = [
      { ok: true, draftId: "d1" },
      { ok: false, reason: "used" },
      { ok: false, reason: "expired" },
      { ok: false, reason: "not_in_review" },
      { ok: false, reason: "unknown" },
    ];
    for (const result of results) {
      expect(String((await render(result))?.props.message).length).toBeGreaterThan(0);
    }
  });

  it("a redemption that fails outright is the unknown-link line, never an error screen", async () => {
    answer = async () => {
      throw new Error("the database is down");
    };
    const alert = named(await VetoPage({ params: { token: "a-token" } }), "Alert");
    expect(alert?.props.message).toBe(COPY["publish.veto.unknown"]);
  });

  it("a redemption that never comes back is bounded, and answers the same way", async () => {
    // A `catch` alone does not cover this: a request that never settles
    // never rejects. The reader gets the line that says this is not a link
    // ReachKit can act on — which is what they are holding — rather than a
    // page that never loads.
    // A read that settles a little *after* the deadline, rather than one
    // that never settles at all: the assertion is about what the page does
    // with a slow read, and a promise left pending for the life of the
    // process is a handle this file would leave behind for every later one.
    answer = () =>
      new Promise<RedeemResult>((resolve) => {
        setTimeout(() => resolve({ ok: true, draftId: "d1" }), 3_000);
      });
    const started = Date.now();
    const alert = named(await VetoPage({ params: { token: "a-token" } }), "Alert");
    expect(alert?.props.message).toBe(COPY["publish.veto.unknown"]);
    expect(Date.now() - started).toBeLessThan(4_000);
  });

  it("Next's promised params and a resolved object are both accepted", async () => {
    answer = async () => ({ ok: true, draftId: "d1" });
    const tree = await VetoPage({ params: Promise.resolve({ token: "a-token" }) });
    expect(named(tree, "Alert")?.props.tone).toBe("ok");
  });
});

describe("exactly one transition — the surface redeems once and owns no token knowledge", () => {
  it("one render asks for one redemption, with the segment as given", async () => {
    answer = async () => ({ ok: true, draftId: "d1" });
    await VetoPage({ params: { token: "the-token" } });
    expect(asked).toEqual(["the-token"]);
  });

  it("it calls redeemVetoLink and reaches neither the machine nor the token's own hashing", () => {
    const code = codeOf(PAGE);
    expect(code).toMatch(/redeemVetoLink/);
    expect(code).not.toMatch(/transition\(|hashToken|redeem_veto_token|veto_token_hash|createHash/);
  });
});

describe("nothing else is on the page", () => {
  it("no control, no form, no field, and no navigation into the product", async () => {
    answer = async () => ({ ok: true, draftId: "d1" });
    const tree = await VetoPage({ params: { token: "a-token" } });
    const types = nodes(tree).map((node) => (node.type as { name?: string })?.name ?? node.type);

    expect(types).not.toContain("Btn");
    expect(types).not.toContain("Input");
    expect(types).not.toContain("Toggle");
    expect(types).not.toContain("form");
    expect(types).not.toContain("a");
  });

  it("neither the token nor the draft it moved is echoed back onto the page", async () => {
    answer = async () => ({ ok: true, draftId: "draft-2026-09-15" });
    const tree = await VetoPage({ params: { token: "a-secret-token" } });
    const rendered = JSON.stringify(nodes(tree).map((node) => node.props));
    expect(rendered).not.toContain("a-secret-token");
    expect(rendered).not.toContain("draft-2026-09-15");
  });

  it("one Surface at the root, one Card, and it holds no string a person reads", () => {
    const code = codeOf(PAGE);
    expect(code).toMatch(/from "@\/ui\/components"/);
    expect(code).toMatch(/from "@\/ui\/layout"/);
    expect(code).not.toMatch(/message=\{"|message="/);
  });

  it("it renders without a session, a cookie or a payment", () => {
    const code = codeOf(PAGE);
    expect(code).not.toMatch(/cookies\(|headers\(|currentSession|hasActiveAccess/);
  });
});

describe("the address: public, and never indexed", () => {
  it("the route is on the public allow-list", async () => {
    const { PUBLIC_PATHS } = await import("../../../src/middleware");
    expect(PUBLIC_PATHS).toContain("/veto/:token");
  });

  it("the route exports metadata that turns indexing and following off", () => {
    expect(codeOf(PAGE)).toMatch(/robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  });

  it("`next.config.ts` declares the X-Robots-Tag header for this path", () => {
    const config = codeOf("next.config.ts");
    expect(config).toContain('source: "/veto/:token"');
    expect(config).toContain('key: "X-Robots-Tag"');
    expect(config).toContain("noindex, nofollow");
  });

  it("no response is shared: the redemption writes, so nothing is cached or revalidated", () => {
    const code = codeOf(PAGE);
    expect(code).toMatch(/export const dynamic = "force-dynamic"/);
    expect(code).toMatch(/export const revalidate = 0/);
  });
});
