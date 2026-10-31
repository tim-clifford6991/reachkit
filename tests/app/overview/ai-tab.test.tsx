/** @vitest-environment jsdom */
// SPEC §4 · §6 (board AppAI): the AI tab, driven through the real
// `/app/ai-answers` page for the reserved fixture account the layout sweep
// reads, and its parts over stored readings.
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { boardFile, compare, readAllow, segments } from "../../../scripts/design/parity.mjs";
import type { PageReading } from "@/lib/measure/page-reading";
import type { PublishedPage } from "@/lib/measure/published";
import type { BlogReadsModel } from "@/lib/publish/reads/model";
import type { AnswerMark } from "@/app/(account)/app/_overview/answers-model";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/app/ai-answers",
  redirect: vi.fn(),
}));

const { default: AiPage } = await import("@/app/(account)/app/(tabs)/ai-answers/page");
const { AiTiles, AiPagesCard } = await import("@/app/(account)/app/_overview/AiTab");
const { aiPagesFor } = await import("@/app/(account)/app/_overview/ai-pages");
const { readAnswers } = await import("@/app/(account)/app/_overview/answers-provider");
const { readPublished } = await import("@/app/(account)/app/_overview/content-provider");
const { readBlogReads } = await import("@/app/(account)/app/_overview/blog-reads-provider");
const { readPromptsAt } = await import("@/app/(account)/app/_overview/prompts-provider");
const { readOverview } = await import("@/app/(account)/app/_overview/provider");
const { readShell } = await import("@/app/(account)/app/_shell/provider");
const { aiPagesOf } = await import("@/lib/measure/figures");
const { fromStored } = await import("@/lib/presentation/generated");
const { copy } = await import("@/lib/presentation/copy");
const { formatCount } = await import("@/app/(account)/app/_overview/present");
const { resetAccount, signedInAs } = await import("../account-door");

const text = (el: Element | null | undefined): string => (el?.textContent ?? "").replace(/\s+/gu, " ").trim();
const NOW = new Date("2026-10-19T06:00:00.000Z");

async function render(): Promise<Document> {
  return new DOMParser().parseFromString(renderToStaticMarkup(await AiPage()), "text/html");
}

function reading(over: Partial<PageReading> = {}): PageReading {
  return { at: NOW.toISOString(), crawled: true, place: null, first: null, best: null, prev: null, linkedBy: [], aiReads: null, variants: [], reached: {}, google: null, bing: null, ...over };
}

function page(id: string, r: PageReading | null): PublishedPage {
  return { id, title: `Page ${id}`, url: `https://example.com/${id}`, publishedAt: new Date(NOW.getTime() - 86_400_000), draftId: `d-${id}`, reading: r };
}

function reads(over: Partial<BlogReadsModel> = {}): BlogReadsModel {
  return {
    fetches: { kind: "measured", value: 14, at: NOW },
    referrals: { kind: "measured", value: 2, at: NOW },
    byEngine: [],
    windowDays: 7,
    weekly: [],
    show: true,
    ...over,
  } as BlogReadsModel;
}

describe("board AppAI, on the account the layout sweep reads", () => {
  beforeEach(() => signedInAs());
  afterEach(() => resetAccount());

  it("the head is the week, the name and the day AI was asked", async () => {
    const [dom, shell] = await Promise.all([render(), readShell()]);
    const head = dom.querySelector("header");
    const n = shell.weeks.kind === "counted" ? String(shell.weeks.weeks) : "";
    expect(text(head?.querySelector('[data-testid="ai-answers-eyebrow"]'))).toBe(copy("overview.tab.eyebrow", { n }));
    expect(text(head?.querySelector("h1"))).toBe(copy("overview.tile.ai-answers.label"));
    expect(text(head?.querySelector('[data-testid="ai-answers-measured"]'))).toMatch(/^Measured /u);
  });

  it("three tiles, each with its figure and What this means closed under it, counted as Overview counts them", async () => {
    const [dom, published, blog] = await Promise.all([render(), readPublished(), readBlogReads()]);
    const ai = aiPagesOf(published.pages!.filter((p) => p.publishedAt <= published.now))!;
    const tiles = [...dom.querySelectorAll('[data-testid="ai-tiles"] > section')];
    expect(tiles.map((tile) => tile.getAttribute("data-testid"))).toEqual(["ai-tile-linked", "ai-tile-reads", "ai-tile-visits"]);
    for (const tile of tiles) {
      expect(text(tile.querySelector("summary"))).toContain(copy("overview.means"));
      expect(tile.querySelector("details")?.hasAttribute("open")).toBe(false);
    }
    expect(text(dom.querySelector('[data-testid="ai-tile-linked-value"]'))).toBe(String(ai.linked.length));
    expect(text(dom.querySelector('[data-testid="ai-tile-linked"]'))).toContain(copy("overview.answers.pages-cited.of", { of: String(ai.asked.length) }));
    expect(text(dom.querySelector('[data-testid="ai-tile-linked-split"]'))).toBe(
      `${copy("overview.answers.linked.line")} ${copy("overview.answers.linked.mentioned", { n: "2" })}`
    );
    expect(blog.fetches.kind).toBe("measured");
    expect(text(dom.querySelector('[data-testid="ai-tile-reads-value"]'))).toBe(blog.fetches.kind === "unmeasured" ? "" : formatCount(blog.fetches.value));
    expect(text(dom.querySelector('[data-testid="ai-tile-visits-value"]'))).toBe(blog.referrals.kind === "unmeasured" ? "" : formatCount(blog.referrals.value));
  });

  it("each page in AI answers: its question, its step and one mark per engine, the linked page first", async () => {
    const dom = await render();
    const card = dom.querySelector('[data-testid="ai-pages"]');
    expect(text(card?.querySelector("h2"))).toBe(copy("overview.answers.pages.title"));
    expect(text(card?.querySelector('[data-testid="answers-legend"]'))).toContain(copy("overview.answers.mark.not-measured"));
    const rows = [...(card?.querySelectorAll('[data-testid="ai-page"]') ?? [])];
    expect(rows.map((row) => text(row.querySelector('[data-testid="ai-page-step"]')))).toEqual([
      copy("draft.ladder.linked"),
      copy("draft.ladder.visit"),
      copy("draft.ladder.read"),
      copy("overview.answers.pages.unread"),
    ]);
    expect(text(rows[0])).toContain("Which payment terms should a small business offer?");
    expect([...rows[0]!.querySelectorAll("li")].map(text)).toEqual([
      `${copy("ai-answers.engine.chatgpt")}${copy("overview.answers.mark.links")}`,
      `${copy("ai-answers.engine.ai-mode")}${copy("overview.answers.mark.others")}`,
      `${copy("ai-answers.engine.ai-overview")}${copy("overview.answers.mark.others")}`,
    ]);
    // An AI Overview Google did not show is the search's own fact.
    expect(text(rows[1])).toContain(copy("overview.answers.engine.none"));
    expect(text(card?.querySelector('[data-testid="ai-pages-shown"]'))).toBe(copy("overview.answers.pages.shown", { shown: "4", total: "4" }));
  });

  it("each mark draws its E29 icon, in the cells and in the legend", async () => {
    const dom = await render();
    const glyph = (el: Element | null | undefined) => (el?.querySelector("svg")?.getAttribute("class") ?? "").split(" ").filter((c) => c.startsWith("lucide-"));
    const icon: Readonly<Record<AnswerMark, string>> = {
      links_to_you: "lucide-link",
      names_you: "lucide-message-square",
      names_others: "lucide-users",
      names_no_one: "lucide-circle-dashed",
      no_answer: "lucide-circle-minus",
      not_measured: "lucide-minus",
    };
    const cells = [...dom.querySelectorAll("[data-mark]")];
    for (const mark of ["links_to_you", "names_you", "no_answer"] as const) expect(cells.some((cell) => cell.getAttribute("data-mark") === mark)).toBe(true);
    for (const cell of cells) expect(glyph(cell)).toEqual([icon[cell.getAttribute("data-mark") as AnswerMark]]);
    const legend = [...(dom.querySelector('[data-testid="answers-legend"]')?.children ?? [])].map(glyph).flat();
    expect(legend).toEqual(expect.arrayContaining(["lucide-link", "lucide-message-square", "lucide-circle-minus"]));
    expect(dom.querySelector(".lucide-link-2, .lucide-tag, .lucide-slash")).toBeNull();
  });

  it("which AI read and sent visits, closed, summed as the reads tile counts them", async () => {
    const [dom, blog] = await Promise.all([render(), readBlogReads()]);
    const who = dom.querySelector('[data-testid="ai-who"]');
    expect(who?.hasAttribute("open")).toBe(false);
    const value = (m: typeof blog.fetches) => (m.kind === "unmeasured" ? "" : formatCount(m.value));
    expect(text(who?.querySelector('[data-testid="ai-who-sum"]'))).toBe(
      copy("overview.answers.who.sum", { reads: value(blog.fetches), visits: value(blog.referrals) })
    );
    expect([...(who?.querySelectorAll("h3") ?? [])].map(text)).toEqual([copy("overview.answers.who.reads"), copy("overview.answers.visits.label")]);
  });

  it("reputation is Overview's month figure, and closes on the grid of the twelve", async () => {
    const [dom, overview] = await Promise.all([render(), readOverview()]);
    const model = await readPromptsAt(overview.months?.reading?.week ?? null);
    expect(model.kind).toBe("measured");
    if (model.kind !== "measured") return;
    const card = dom.querySelector('[data-testid="ai-reputation"]');
    expect(text(card?.querySelector("h2"))).toBe(copy("overview.prompts.rate.title"));
    expect(text(card?.querySelector('[data-testid="ai-reputation-count"]'))).toBe(
      copy("overview.prompts.rate.count", { n: String(model.rate.linked + model.rate.named), m: String(model.rate.samples), weeks: "4" })
    );
    expect([...(card?.querySelectorAll("h3") ?? [])].map(text)).toEqual([
      copy("overview.prompts.share.title"),
      copy("overview.prompts.list.title"),
      copy("overview.answers.grid.title"),
    ]);
    expect(card?.querySelector('[data-testid="answers-grid"]')).not.toBeNull();
  });

  it("every board string is on the screen but for sample data, rulings and the shell's own chrome", async () => {
    const html = renderToStaticMarkup(await AiPage());
    const { missing } = compare(readFileSync(boardFile("AppAI"), "utf8"), segments(html), readAllow("AppAI"));
    // The sidebar and the tab bar are the layouts', which this render does not draw.
    const chrome = ["ReachKit", "Overview", "This week", "Settings", "Publishing on", "Google", "Competitors"];
    expect(missing.filter((s: string) => !chrome.includes(s))).toEqual([]);
  });

  it("the page questions are the answers the pass stored for each page's own address", async () => {
    const [model, published] = await Promise.all([readAnswers(), readPublished()]);
    const pages = aiPagesFor(published.pages!, model.pageQuestions, published.now)!;
    expect(pages.rows.every((row) => row.question !== null)).toBe(true);
  });
});

describe("what is not measured is never 0", () => {
  it("off a hosted site the reads and visits say not measured, and no page asked says when it will show", () => {
    const dom = new DOMParser().parseFromString(
      renderToStaticMarkup(<AiTiles pages={null} reads={reads({ show: false, fetches: { kind: "unmeasured", reason: "undeterminable", at: NOW }, referrals: { kind: "unmeasured", reason: "undeterminable", at: NOW } } as Partial<BlogReadsModel>)} />),
      "text/html"
    );
    for (const id of ["reads", "visits"]) expect(text(dom.querySelector(`[data-testid="ai-tile-${id}-value"]`))).toBe(copy("draft.ladder.unmeasured"));
    expect(text(dom.querySelector('[data-testid="ai-tile-linked-value"]'))).toBe(copy("draft.ladder.unmeasured"));
    expect(text(dom.querySelector('[data-testid="ai-tile-linked-split"]'))).toBe(copy("overview.answers.pages-cited.none"));
    expect(text(dom.body)).not.toMatch(/\b0\b/u);
  });

  it("the linked tile draws linked of asked; unmeasured, none", () => {
    const tile = (pages: { asked: number; linked: number } | null) =>
      new DOMParser()
        .parseFromString(renderToStaticMarkup(<AiTiles pages={pages && { rows: [], mentioned: 0, ...pages }} reads={reads()} />), "text/html")
        .querySelector('[data-testid="ai-tile-linked"]');
    const bar = tile({ asked: 12, linked: 3 })?.querySelector("progress");
    expect([bar?.getAttribute("value"), bar?.getAttribute("max"), bar?.getAttribute("aria-hidden")]).toEqual(["3", "12", "true"]);
    const unmeasured = tile(null);
    expect(unmeasured?.querySelector("progress")).toBeNull();
    expect(text(unmeasured?.querySelector('[data-testid="ai-tile-linked-value"]'))).toBe(copy("draft.ladder.unmeasured"));
    expect(text(unmeasured?.querySelector('[data-testid="ai-tile-linked-split"]'))).toBe(copy("overview.answers.pages-cited.none"));
    expect(tile({ asked: 0, linked: 0 })?.querySelector("progress")).toBeNull();
  });

  it("a hosted site with no visit yet leaves the visits tile out, and reads still show", () => {
    const dom = new DOMParser().parseFromString(
      renderToStaticMarkup(<AiTiles pages={null} reads={reads({ referrals: { kind: "zero", value: 0, at: NOW } } as Partial<BlogReadsModel>)} />),
      "text/html"
    );
    expect(dom.querySelector('[data-testid="ai-tile-visits"]')).toBeNull();
    expect(text(dom.querySelector('[data-testid="ai-tile-reads-value"]'))).toBe("14");
  });

  it("an answer that named no one counts as the answer it relabels: every count is unchanged", () => {
    const q = (marks: AnswerMark[], id: string) => ({ n: 1, wording: fromStored("questions.wording", "Is it good?"), search: "is it good", marks, page: { title: `Page ${id}`, url: `https://example.com/${id}` } });
    const all = [page("a", reading({ linkedBy: ["ai_overview"], reached: { linkedByAi: NOW.toISOString() } })), page("b", reading()), page("c", reading())];
    const before = [q(["names_others", "names_you", "no_answer"], "a"), q(["names_others", "names_others", "not_measured"], "b"), q(["names_you", "names_others", "no_answer"], "c")];
    const after = before.map((x) => ({ ...x, marks: x.marks.map((m) => (m === "names_others" ? "names_no_one" : m)) }));
    const counts = (p: ReturnType<typeof aiPagesFor>) => ({ asked: p?.asked, linked: p?.linked, mentioned: p?.mentioned, rows: p?.rows.map((r) => r.id) });
    expect(counts(aiPagesFor(all, after, NOW))).toEqual(counts(aiPagesFor(all, before, NOW)));
    expect(counts(aiPagesFor(all, before, NOW))).toMatchObject({ asked: 3, linked: 1, mentioned: 1 });
  });

  it("a page AI has not read is not read by AI yet; a page with no question asked is not listed", () => {
    const q = { n: 1, wording: fromStored("questions.wording", "Is it good?"), search: "is it good", marks: ["links_to_you", "no_answer", "not_measured"] as const, page: { title: "Page a", url: "https://example.com/a" } };
    const pages = aiPagesFor([page("a", reading({ linkedBy: ["ai_overview"], reached: { linkedByAi: NOW.toISOString() } })), page("b", reading()), page("c", reading({ linkedBy: null }))], [{ ...q, marks: [...q.marks] }], NOW)!;
    expect(pages.rows.map((row) => row.id)).toEqual(["a", "b"]);
    const dom = new DOMParser().parseFromString(renderToStaticMarkup(<AiPagesCard pages={pages} place={null} />), "text/html");
    const steps = [...dom.querySelectorAll('[data-testid="ai-page-step"]')].map(text);
    expect(steps).toEqual([copy("draft.ladder.linked"), copy("overview.answers.pages.unread")]);
    expect(text(dom.querySelector('[data-testid="ai-pages-lead"]'))).toBe(copy("overview.answers.pages.lead.anywhere"));
  });
});
