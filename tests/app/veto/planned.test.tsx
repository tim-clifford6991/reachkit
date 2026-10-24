// Issue 1674 — /veto/{token} for the Monday mail's link to a page planned but
// not written yet: arriving shows the planned page and writes nothing,
// pressing stops it, and a page written since is sent to the plan.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type React from "react";
import { renderToStaticMarkup } from "react-dom/server";
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

/** The neutral chip a link that cannot be spent draws, and the lucide icons inside it. */
function refusedChip(tree: React.ReactNode): { cls: string; icons: string[] } {
  const chip = nodes(tree).find((node) => node.props?.["data-testid"] === "veto-refused-chip");
  if (chip === undefined) return { cls: "", icons: [] };
  const markup = renderToStaticMarkup(chip as unknown as React.ReactElement);
  return { cls: String(chip.props.className), icons: [...markup.matchAll(/class="lucide lucide-([a-z-]+)/g)].map((m) => m[1]!) };
}

const tinted = (tree: React.ReactNode): boolean =>
  nodes(tree).some((node) => String(node.props?.className ?? "").includes("bg-success"));

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

  it("says why ReachKit chose the planned page, from the reason the week stored", async () => {
    db.rows("opportunities")[0]!.plan_reason = { points: 4, parts: [{ part: "demand", n: 2 }], rule: null };
    const why = nodes(await VetoPage({ params: { token: TOKEN } })).find((node) => node.props?.["data-testid"] === "veto-why");
    const said = nodes(why as unknown as React.ReactNode).flatMap((node) => {
      const children = node.props?.children;
      return (Array.isArray(children) ? children : [children]).filter((c): c is string => typeof c === "string");
    });
    expect(said).toContain(COPY["publish.veto.why"]);
    expect(said).toContain("searched every month.");
  });

  it("a planned page whose week kept no reason states none", async () => {
    const tree = await VetoPage({ params: { token: TOKEN } });
    expect(nodes(tree).some((node) => node.props?.["data-testid"] === "veto-why")).toBe(false);
  });

  it("a page written since its mail is sent to the plan, and is not stopped here", async () => {
    db.rows("opportunities")[0]!.status = "queued";
    const tree = await VetoPage({ params: { token: TOKEN } });
    expect(strings(tree)).toContain(COPY["publish.veto.written"]);
    expect(nodes(tree).some((node) => node.type === "form")).toBe(false);
  });

  it("a planned day already stopped, reached again, draws the used arm's neutral circle-stop chip", async () => {
    db.rows("opportunities")[0]!.status = "dismissed";
    const tree = await VetoPage({ params: { token: TOKEN } });
    expect(strings(tree)).toContain(COPY["publish.veto.used.head"]);
    const chip = refusedChip(tree);
    expect(chip.cls).toContain("bg-base-200");
    expect(chip.icons).toEqual(["circle-stop"]);
    expect(tinted(tree)).toBe(false);
  });

  it("a page written since its mail draws the closed arm's neutral clock chip", async () => {
    db.rows("opportunities")[0]!.status = "queued";
    const tree = await VetoPage({ params: { token: TOKEN } });
    const chip = refusedChip(tree);
    expect(chip.cls).toContain("bg-base-200");
    expect(chip.icons).toEqual(["clock"]);
    expect(tinted(tree)).toBe(false);
  });
});
