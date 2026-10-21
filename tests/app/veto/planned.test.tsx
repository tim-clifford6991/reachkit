// Issue 1674 — /veto/{token} for the Monday mail's link to a page planned but
// not written yet: arriving shows the planned page and writes nothing,
// pressing stops it, and a page written since is sent to the plan.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type React from "react";
import { applyEnvFixture } from "../../mail/env-fixture";
import { fakeDb } from "../../publish/harness";

applyEnvFixture();

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
const redirected: string[] = [];
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    redirected.push(to);
    throw new Error("NEXT_REDIRECT");
  },
}));

const VetoPage = (await import("../../../src/app/(public)/veto/[token]/page")).default;
const { COPY } = await import("../../../src/lib/presentation/copy");
const { plannedStopToken } = await import("../../../src/lib/opportunities/stop");
const { formatMailDay } = await import("../../../src/lib/mail/blocks/format");

// Far enough ahead that the link has not run out whenever this suite runs.
const DAY = "2099-01-06";
const TOKEN = plannedStopToken({ siteId: "site-1", opportunityId: "o1", day: DAY });

interface Node {
  type: unknown;
  props: Record<string, unknown>;
}

function nodes(element: React.ReactNode): Node[] {
  if (element === null || typeof element !== "object") return [];
  if (Array.isArray(element)) return element.flatMap((child) => nodes(child as React.ReactNode));
  const node = element as unknown as Node;
  const name = (node.type as { name?: string })?.name;
  const expanded =
    typeof node.type === "function" && (name === "Ask" || name === "Told" || name === "Surface")
      ? nodes((node.type as (p: Record<string, unknown>) => React.ReactNode)(node.props))
      : [];
  return [node, ...expanded, ...nodes((node.props?.children ?? null) as React.ReactNode)];
}

const strings = (tree: React.ReactNode): string[] =>
  nodes(tree).flatMap((node) => (typeof node.props?.children === "string" ? [node.props.children] : []));

const status = () => db.rows("opportunities")[0]!.status;

beforeEach(() => {
  redirected.length = 0;
  db.reset();
  db.seed("sites", [{ id: "site-1", domain: "harbor-plumbing.example" }]);
  db.seed("opportunities", [
    {
      id: "o1",
      site_id: "site-1",
      family: "new",
      target_query: "slab leak repair cost",
      target_ref: "slab leak repair cost",
      volume: 320,
      evidence: { family: "new", volume: 320 },
      status: "open",
      plan_place: 3,
      planned_for: DAY,
    },
  ]);
});

describe("the stop link to a page not written yet", () => {
  it("arriving shows the planned page by its day and search, and stops nothing", async () => {
    const tree = await VetoPage({ params: { token: TOKEN } });
    const seen = strings(tree);
    expect(seen).toContain(COPY["publish.veto.planned.title"].replace("{day}", formatMailDay(DAY)));
    expect(seen.some((s) => s.startsWith("slab leak repair cost"))).toBe(true);
    expect(seen).toContain("harbor-plumbing.example");
    expect(status()).toBe("open");
  });

  it("pressing stops it, and the page then says it is stopped", async () => {
    const form = nodes(await VetoPage({ params: { token: TOKEN } })).find((node) => node.type === "form")!;
    await expect((form.props.action as () => Promise<void>)()).rejects.toThrow("NEXT_REDIRECT");
    expect(status()).toBe("dismissed");
    expect(redirected).toEqual([`/veto/${encodeURIComponent(TOKEN)}?done=1`]);

    const done = strings(await VetoPage({ params: { token: TOKEN }, searchParams: { done: "1" } }));
    expect(done).toContain(COPY["publish.veto.done.head"]);
  });

  it("a page written since its mail is sent to the plan, and is not stopped here", async () => {
    db.rows("opportunities")[0]!.status = "queued";
    const tree = await VetoPage({ params: { token: TOKEN } });
    expect(strings(tree)).toContain(COPY["publish.veto.written"]);
    expect(nodes(tree).some((node) => node.type === "form")).toBe(false);
  });
});
