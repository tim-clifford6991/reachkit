// UI-SPEC S6 — /veto/{token}: two arms, and a write that needs an act.
//
// The component is called directly and its returned element tree is
// inspected, the same direct-call convention `tests/app/opt-out/page.test.tsx`
// uses — no DOM, so this suite runs in the `node` project beside the rest of
// `tests/app/**`.
//
// **What changed with #371, and what this file now holds.** The page used to
// redeem on arrival: one GET, one transition, one line. The approved set
// draws an *ask* and a *done*, so arriving reads and pressing stops — and
// that is a correctness property, not only a fidelity one. A GET that writes
// is a page a mail scanner or a link preview can stop for the customer
// without a person seeing it. The first describe below is that property,
// asserted as itself.
//
// The redemption and the read are `tests/publish/publishable/veto.test.ts`'s
// and are not re-tested here: this suite asserts which seam the surface
// reaches on which request, and which arm it renders for which answer.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type React from "react";
import { applyEnvFixture } from "../../mail/env-fixture";
import { codeOf } from "../../mail/leads/source";
import type { PreviewResult, RedeemResult } from "../../../src/lib/publish/publishable";

applyEnvFixture();

/**
 * The two seams' answers for the test about to run, and what each was asked.
 *
 * Plain functions rather than `vi.fn`s: one of the cases below is a read that
 * *rejects*, and vitest's own tracking of a mock's settled results drops its
 * handler on the rejected promise when the mock is cleared between tests —
 * surfacing as an unhandled rejection against a test that passed. The record
 * this file needs is three arrays.
 */
const LIVE: PreviewResult = {
  ok: true,
  preview: {
    draftId: "draft-2026-09-15",
    title: "How to choose onboarding software",
    query: "best onboarding tools",
    domain: "example.com",
    publishesAt: new Date("2026-09-15T07:00:00.000Z"),
  },
};

let previewAnswer: (token: string) => Promise<PreviewResult> = async () => LIVE;
let redeemAnswer: (token: string) => Promise<RedeemResult> = async () => ({
  ok: true,
  draftId: "draft-2026-09-15",
});
const previewed: string[] = [];
const redeemed: string[] = [];
const redirected: string[] = [];

vi.mock("@/lib/publish/publishable", () => ({
  previewVetoLink: (token: string) => {
    previewed.push(token);
    return previewAnswer(token);
  },
  redeemVetoLink: (token: string) => {
    redeemed.push(token);
    return redeemAnswer(token);
  },
  vetoLinkPath: (token: string) => `/veto/${token}`,
}));

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    redirected.push(to);
    // Next's own `redirect` throws to unwind the render; this stand-in does
    // the same, so a caller that kept working after redirecting fails here.
    throw new Error("NEXT_REDIRECT");
  },
}));

const VetoPage = (await import("../../../src/app/(public)/veto/[token]/page")).default;
const { COPY } = await import("../../../src/lib/presentation/copy");

const PAGE = "src/app/(public)/veto/[token]/page.tsx";

interface Node {
  type: unknown;
  props: Record<string, unknown>;
}

/**
 * Every element in a returned tree, flattened.
 *
 * The page's own two arms — `Ask` and `Told` — are expanded by calling them,
 * because a server component that is not called renders nothing to inspect
 * and this suite is about what they render. Nothing else is expanded: the
 * registered components are `tests/ui/**`'s to render, and descending into
 * them here would make every assertion about a `Btn` an assertion about
 * daisyUI's markup instead.
 */
const OWN_ARMS = new Set(["Ask", "Told"]);

function nodes(element: React.ReactNode): Node[] {
  if (element === null || typeof element !== "object") return [];
  const node = element as unknown as Node;
  const name = (node.type as { name?: string })?.name;
  const expanded =
    typeof node.type === "function" && name !== undefined && OWN_ARMS.has(name)
      ? nodes((node.type as (p: Record<string, unknown>) => React.ReactNode)(node.props))
      : [];
  const children = (node.props?.children ?? null) as React.ReactNode;
  const list = Array.isArray(children) ? children : [children];
  return [node, ...expanded, ...list.flatMap((child) => nodes(child))];
}

function named(tree: React.ReactNode, name: string): Node | undefined {
  return nodes(tree).find((node) => (node.type as { name?: string })?.name === name);
}

function allNamed(tree: React.ReactNode, name: string): Node[] {
  return nodes(tree).filter((node) => (node.type as { name?: string })?.name === name);
}

/**
 * Every string a reader would see, joined.
 *
 * Only *intrinsic* elements — the ones whose type is a tag name — because
 * those are what reach the document. A component's props are arguments, not
 * text: `<Ask token={…} it={…}>` carries the token and the draft's id, and
 * counting those as rendered would make "the token is never echoed" pass or
 * fail on how the page happens to be factored rather than on what it shows.
 */
function text(tree: React.ReactNode): string {
  return JSON.stringify(
    nodes(tree)
      .filter((node) => typeof node.type === "string")
      .map((node) => node.props)
  );
}

async function ask(query: Record<string, string> = {}): Promise<React.ReactNode> {
  return VetoPage({ params: { token: "a-token" }, searchParams: query });
}

beforeEach(() => {
  previewed.length = 0;
  redeemed.length = 0;
  redirected.length = 0;
  previewAnswer = async () => LIVE;
  redeemAnswer = async () => ({ ok: true, draftId: "draft-2026-09-15" });
});

describe("issue #371 — arriving reads, and only pressing stops", () => {
  it("a GET redeems nothing: the page reads the token and leaves it spendable", async () => {
    await ask();
    expect(previewed).toEqual(["a-token"]);
    expect(redeemed, "arriving must not spend the token").toEqual([]);
  });

  it("the stop control is a form action, so the write is behind a POST", async () => {
    const forms = nodes(await ask()).filter((node) => node.type === "form");
    expect(forms).toHaveLength(1);
    expect(typeof forms[0]?.props.action, "the form posts to a server action").toBe("function");
  });

  it("pressing it redeems once, then sends the reader back to the same link", async () => {
    const forms = nodes(await ask()).filter((node) => node.type === "form");
    const action = forms[0]?.props.action as () => Promise<void>;
    await expect(action()).rejects.toThrow("NEXT_REDIRECT");
    expect(redeemed).toEqual(["a-token"]);
    expect(redirected).toEqual(["/veto/a-token?done=1"]);
  });
});

describe("the ask arm — what the set draws, in its own order", () => {
  it("names the moment it publishes, the page, the search and the site", async () => {
    const tree = await ask();
    const rendered = text(tree);
    expect(named(tree, "CardHead")?.props.eyebrow).toBe(
      COPY["publish.veto.ask.head"].replace("{when}", "2026-09-15 07:00 UTC")
    );
    expect(rendered).toContain("How to choose onboarding software");
    expect(rendered).toContain("best onboarding tools");
    expect(rendered).toContain("example.com");
  });

  it("one solid control, labelled as the set labels it, and one quiet line under it", async () => {
    const tree = await ask();
    const buttons = allNamed(tree, "Btn");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.props.label).toBe(COPY["publish.veto.ask.action"]);
    expect(buttons[0]?.props.variant).toBe("primary");
    expect(text(tree)).toContain(COPY["publish.veto.ask.do-nothing"]);
  });

  it("a page with no title, search or site still offers the control", async () => {
    // Every one of the three is nullable at the seam, and none of them is a
    // reason to withhold the stop: a reader who cannot see which page it is
    // must still be able to stop it.
    previewAnswer = async () => ({
      ok: true,
      preview: {
        draftId: "d1",
        title: null,
        query: null,
        domain: null,
        publishesAt: null,
      },
    });
    const tree = await ask();
    expect(allNamed(tree, "Btn")).toHaveLength(1);
    expect(allNamed(tree, "Btn")[0]?.props.label).toBe(COPY["publish.veto.ask.action"]);
  });

  it("the token is never echoed onto the page", async () => {
    // The four facts the set draws are the four the `draft-ready` mail
    // already put in this reader's inbox. The credential is not one of them.
    const tree = await VetoPage({ params: { token: "a-secret-token" }, searchParams: {} });
    expect(text(tree)).not.toContain("a-secret-token");
  });
});

describe("the done arm, and the refusals that wear its shape", () => {
  it("coming back from the control, on a token that now reads as spent, says it stopped", async () => {
    previewAnswer = async () => ({ ok: false, reason: "used" });
    const tree = await ask({ done: "1" });
    expect(named(tree, "CardHead")?.props.eyebrow).toBe(COPY["publish.veto.done.head"]);
    const alert = named(tree, "Alert");
    expect(alert?.props.tone).toBe("ok");
    expect(alert?.props.message).toBe(COPY["publish.veto.stopped"]);
    expect(named(tree, "Btn")?.props.href).toBe("/app/calendar");
    expect(named(tree, "Btn")?.props.label).toBe(COPY["publish.veto.calendar"]);
  });

  it("`?done=1` typed against a live link shows the ask, and stops nothing", async () => {
    // The marker is not a claim on its own: the done arm needs the store to
    // agree. Without this, anyone could be told their page was stopped.
    const tree = await ask({ done: "1" });
    expect(allNamed(tree, "Btn")[0]?.props.label).toBe(COPY["publish.veto.ask.action"]);
    expect(redeemed).toEqual([]);
  });

  it("a spent link reached cold says it was already used, not that it stopped", async () => {
    previewAnswer = async () => ({ ok: false, reason: "used" });
    const alert = named(await ask(), "Alert");
    expect(alert?.props.tone).toBe("neutral");
    expect(alert?.props.message).toBe(COPY["publish.veto.alreadyUsed"]);
  });

  it("a link past its expiry says the moment to stop has passed", async () => {
    previewAnswer = async () => ({ ok: false, reason: "expired" });
    const alert = named(await ask(), "Alert");
    expect(alert?.props.tone).toBe("warn");
    expect(alert?.props.message).toBe(COPY["publish.veto.expired"]);
  });

  it("a page that has already left review reads as the same fact", async () => {
    // To the holder of the link, `expired` and `not_in_review` are one
    // thing: there is no longer anything to stop. What became of the page is
    // a fact this screen holds no session to be told.
    previewAnswer = async () => ({ ok: false, reason: "not_in_review" });
    expect(named(await ask(), "Alert")?.props.message).toBe(COPY["publish.veto.expired"]);
  });

  it("a link that is not one of ours says so, and no arm renders blank", async () => {
    previewAnswer = async () => ({ ok: false, reason: "unknown" });
    const alert = named(await ask(), "Alert");
    expect(alert?.props.tone).toBe("warn");
    expect(alert?.props.message).toBe(COPY["publish.veto.unknown"]);
  });

  it("every refusal renders a line — the three keys are the marker, never empty", async () => {
    for (const reason of ["used", "expired", "not_in_review", "unknown"] as const) {
      previewAnswer = async () => ({ ok: false, reason });
      expect(String(named(await ask(), "Alert")?.props.message).length).toBeGreaterThan(0);
    }
  });

  it("a read that fails outright is the unknown-link line, never an error screen", async () => {
    previewAnswer = async () => {
      throw new Error("the database is down");
    };
    expect(named(await ask(), "Alert")?.props.message).toBe(COPY["publish.veto.unknown"]);
  });

  it("a read that never comes back is bounded, and answers the same way", async () => {
    // A `catch` alone does not cover this: a request that never settles
    // never rejects. A read that settles a little *after* the deadline,
    // rather than one that never settles at all — a promise left pending for
    // the life of the process is a handle this file would leave behind.
    previewAnswer = () =>
      new Promise<PreviewResult>((resolve) => {
        setTimeout(() => resolve(LIVE), 3_000);
      });
    const started = Date.now();
    expect(named(await ask(), "Alert")?.props.message).toBe(COPY["publish.veto.unknown"]);
    expect(Date.now() - started).toBeLessThan(4_000);
  });

  it("Next's promised params and search params are both accepted", async () => {
    const tree = await VetoPage({
      params: Promise.resolve({ token: "a-token" }),
      searchParams: Promise.resolve({}),
    });
    expect(allNamed(tree, "Btn")[0]?.props.label).toBe(COPY["publish.veto.ask.action"]);
  });
});

describe("the surface owns no token knowledge", () => {
  it("it reaches the two named seams and neither the machine nor the token's hashing", () => {
    const code = codeOf(PAGE);
    expect(code).toMatch(/previewVetoLink/);
    expect(code).toMatch(/redeemVetoLink/);
    expect(code).not.toMatch(/transition\(|hashToken|redeem_veto_token|veto_token_hash|createHash/);
  });

  it("the draft's id is never rendered, though its title now is", async () => {
    // The set names the page so a person can tell which one they are
    // stopping. An internal id is not that, and is still not shown.
    expect(text(await ask())).not.toContain("draft-2026-09-15");
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

  it("no response is shared: the ask must not outlive the page it offers", () => {
    const code = codeOf(PAGE);
    expect(code).toMatch(/export const dynamic = "force-dynamic"/);
    expect(code).toMatch(/export const revalidate = 0/);
  });
});
