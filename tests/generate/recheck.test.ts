// tests/generate/recheck.test.ts — SPEC §7 (owner O7): a stored page the rules stopped is read again under today's
// rules at 0¢, and the newest that passes enters review. Each page is written by the real pipeline in the database
// double, then stopped as `rest()` stops it; the stored dogfood rows pin what code mends of each and the promise-figure
// hold (OR4).
import "./env";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Row } from "../publish/harness";
import { AT, fakeCost, opportunity, pack, pageParts, prose } from "./fixtures";
import { LOCAL_WORDPRESS, SAAS_HOSTED, measuredText, seedWorld, snapshot, type LiveSite } from "./live-edit-world";
import stored from "./fixtures/dogfood-drafts-2026-10.min.json";

const db = fakeDb();
const { site, llm } = vi.hoisted(() => ({ site: { current: null as LiveSite | null }, llm: vi.fn() }));
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
vi.mock("@/lib/llm", () => ({ llm }));
vi.mock("@/lib/measure/text", () => ({ readMeasuredText: async () => (site.current === null ? [] : measuredText(site.current)) }));
vi.mock("next/cache", () => ({ revalidateTag: () => undefined, revalidatePath: () => undefined }));

import { generateDayPage } from "@/lib/generate";
import { generateDraft } from "@/lib/generate/pipeline";
import { siteRulesOf } from "@/lib/generate/pipeline/battery";
import { readAllFacts } from "@/lib/generate/pipeline/grounding";
import { candidacy, recheckRow, recheckStopped, type RecheckWorld } from "@/lib/generate/recheck";
import type { ContextPack } from "@/lib/generate/pipeline/pack";
import { promiseFigures } from "@/lib/generate/pipeline/title";
import { answerBoxOf } from "@/lib/generate/rules/blocks";
import { renderOf } from "@/lib/generate/rules/text";
import { generateStore, setGenerateStore, type DraftRow } from "@/lib/generate/store";
import { insertFor } from "@/lib/opportunities/derive/persist";

const DAY = 86_400_000;
const NOW = new Date("2026-10-01T09:00:00.000Z");
/** The date whose window opens at NOW: 24 hours on, at the site's 09:00 UTC. */
const D = "2026-10-02";
const STALE = [
  { rule: "title", detail: { rule: "title", faults: ["description"] } },
  { rule: "fit_claim", detail: { rule: "fit_claim", sentences: ["Acme vs Rival"] } },
];
const row = (id: string): Row => db.rows("drafts").find((each) => each.id === id)!;

beforeEach(() => {
  llm.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

function arrange(live: LiveSite): void {
  site.current = live;
  seedWorld(db, live);
  setGenerateStore(null);
  const written = opportunity({ siteId: live.siteId });
  db.seed("opportunities", [...db.rows("opportunities"), { ...(insertFor(written) as unknown as Row), id: written.id, status: "open", created_at: AT.toISOString() }]);
}

/** A page the pipeline wrote and the rules then stopped as `rest()` does; every later model call throws. */
async function stopped(live: LiveSite, a: { topic?: string; failed?: Row[]; attempts?: number; builtAt?: Date; first?: string } = {}): Promise<string> {
  const topic = a.topic ?? "seats";
  llm.mockResolvedValue({ kind: "measured", value: pageParts(`${a.first ?? ""}${prose(topic, 300, 4)}\n\nTeams on the starter plan get 25 seats and unlimited projects for a flat monthly fee, per [the pricing page](${live.sourceUrl}).`, {}, topic), at: AT });
  const store = generateStore();
  const world = { site: siteRulesOf((await store.siteFacts(live.siteId))!, (await store.latestReport(live.siteId))!), facts: await readAllFacts({ siteId: live.siteId, scanId: "scan-1" }), opportunity: opportunity({ siteId: live.siteId }) };
  const outcome = await generateDraft(fakeCost(), { ...world, siteId: live.siteId, scheduledFor: "2026-09-20", pack: pack({ builtAt: (a.builtAt ?? AT).toISOString() }), links: [] });
  llm.mockReset().mockRejectedValue(new Error("the re-check asks no model"));
  const id = outcome.draftId!;
  const failed = a.failed ?? (outcome.ok ? STALE : (row(id).rule_failures as Row[]));
  const rested = { from: "generating", to: "needs_attention", at: AT.toISOString(), actor: { kind: "system", job: "draft/generate" }, reason: `rules:${failed.map((each) => each.rule).join(",")}` };
  Object.assign(row(id), { state: "needs_attention", hard_rules_passed: false, hard_rule_attempts: a.attempts ?? 2, rule_failures: failed, transitions: [rested] });
  return id;
}

const recheck = (live: LiveSite) => recheckStopped({ siteId: live.siteId, publishDate: D, now: NOW });

describe("a stored page that passes today's rules enters review by itself, at 0¢", () => {
  it.each([
    [SAAS_HOSTED.kind, SAAS_HOSTED, STALE, "recheck:title,fit_claim"],
    // A local business stopped on a menu heading the demo-text rule no longer reads.
    [LOCAL_WORDPRESS.kind, LOCAL_WORDPRESS, [{ rule: "no_demo_text", detail: { rule: "no_demo_text", sentences: ["## How it works"] } }], "recheck:no_demo_text"],
  ] as const)("for %s, the day's date, its window, one record, and the day's write then answers already_drafted", async (_, live, failed, reason) => {
    arrange(live);
    const id = await stopped(live, { failed: [...failed] });
    const before = row(id).transitions as Row[];
    await recheck(live);
    expect(row(id)).toMatchObject({ state: "in_review", scheduled_for: D, hard_rules_passed: true, rule_failures: [], veto_deadline: new Date(NOW.getTime() + DAY).toISOString() });
    expect(row(id).transitions).toEqual([...before, { from: "needs_attention", to: "in_review", actor: { kind: "system", job: "draft/recheck" }, reason, at: NOW.toISOString() }]);
    expect(await generateDayPage({ siteId: live.siteId, publishDate: D, now: NOW })).toEqual({ ok: false, because: "already_drafted" });
    expect(llm).not.toHaveBeenCalled();
  });
});

describe("a page that still fails stays stopped", () => {
  it("a stored fit failure stands while today's reading still asks about its sentence", async () => {
    arrange(SAAS_HOSTED);
    const id = await stopped(SAAS_HOSTED, { first: "Example keeps every seat on one bill. ", failed: [{ rule: "fit_claim", detail: { rule: "fit_claim", sentences: ["Example keeps every seat on one bill."] } }] });
    await recheck(SAAS_HOSTED);
    expect(row(id)).toMatchObject({ state: "needs_attention", rule_failures: [{ rule: "fit_claim" }] });
  });

  it("a title whose only fault is its specific is held until the fix call has settled it, and then passes", async () => {
    arrange(SAAS_HOSTED);
    const id = await stopped(SAAS_HOSTED, { attempts: 1 });
    row(id).title = "Project management software plan that fits a small team";
    (row(id).meta as Row).titles = [{ title: row(id).title }];
    await recheck(SAAS_HOSTED);
    expect(row(id)).toMatchObject({ state: "needs_attention", rule_failures: [{ rule: "title", detail: { faults: ["specific"] } }] });
    row(id).hard_rule_attempts = 2;
    await recheck(SAAS_HOSTED);
    expect(row(id).state).toBe("in_review");
  });
});

describe("OR4: a promise-figure title never enters review", () => {
  // The two rows short of their pack hold no body, and are stopped with the reason `rest()` writes.
  const rows = stored.drafts.map((each: Row) => ({
    site_id: "s-dogfood",
    ...{ body_md: null, grounded_fact: { passage: "p", url: "https://reachkit.app/", readAt: null } },
    transitions: [{ from: "generating", to: "needs_attention", at: each.created_at, reason: "step_failed:pack" }],
    ...each,
  })) as unknown as DraftRow[];
  const at = (id: string) => rows.find((each) => each.id.startsWith(id))!;
  /** The dogfood site as its pack records it; each passage stands for the page it was read off word for word. */
  const dogfood = ({ meta, grounded_fact }: DraftRow) => {
    const { pack: p } = meta as { pack: Row & { business: { rivals: string[]; name: string } } };
    const facts = [grounded_fact as Row, ...(p.facts as Row[])].map((fact) => ({ fact: { ...fact, readAt: new Date(fact.readAt as string) }, sourceText: fact.passage }));
    return { site: { businessName: p.business.name, domain: "reachkit.app", doNotClaim: [], rivals: p.business.rivals }, facts, opportunity: opportunity({ type: "comparison_page", targetQuery: (p.target as { searches: string[] }).searches[0], pageType: null }), now: new Date("2026-10-31T08:00:00.000Z") } as unknown as RecheckWorld;
  };

  it.each([
    ["b03e044f", true, []],
    // Its FAQ pair denying a rival is dropped and "17" clears today; no clean candidate names the business.
    ["bf8de9bf", false, [{ rule: "title", detail: { faults: ["business"] } }]],
    ["d98284cc", false, [{ rule: "plain_prose", detail: { faults: [{ tell: "repeated_phrase" }] } }]],
    ["5dcc61c2", false, [{ rule: "required_blocks", detail: { block: "question_headings" } }]],
    // Its FAQ pair denying a rival is dropped. One attempt: its title is not settled, so the missing specific still
    // stops it, and its sections take a writer.
    ["f1ec6a58", false, [{ rule: "required_blocks", detail: { block: "sections" } }, { rule: "title", detail: { faults: ["specific"] } }]],
  ] as const)("%s, replayed on its own stored body under today's rules: passed %s, failing exactly what it prints, at 0¢", async (id, passed, failed) => {
    arrange(SAAS_HOSTED);
    expect(await recheckRow(at(id), dogfood(at(id)))).toMatchObject({ kind: "checked", passed, failed, spentCents: 0 });
  });

  const checked = async (id: string) => {
    const outcome = await recheckRow(at(id), dogfood(at(id)));
    if (outcome.kind !== "checked") throw new Error(`${id} was ${outcome.kind}`);
    return { ...outcome, meta: outcome.patch.meta as Row & { recheck?: Row } };
  };

  it.each([
    ["fba1d84d", "What is AEO? Answer engine optimization in one page", true],
    // Its stored title carries the business's own "€49 a month"; the one clean candidate still fails its wording.
    ["b8c28f61", "Answer engine optimization vs generative engine optimization (2026)", false],
    // "12" is in no promise, but it is the business's figure beside a rival's name: the settled title still stops.
    ["a71279ff", "Profound answer engine optimization: 12 Google searches weekly", false],
  ] as const)("re-pick never takes a promise-figure title: %s takes %j, its H1 follows, the stored title is kept, at 0¢", async (id, title, passed) => {
    arrange(SAAS_HOSTED);
    const outcome = await checked(id);
    expect(outcome).toMatchObject({ passed, spentCents: 0, patch: { title }, meta: { recheck: { titleBefore: at(id).title, title } } });
    if (id === "a71279ff") expect(outcome.failed).toEqual([{ rule: "title", detail: { rule: "title", faults: ["specific", "figure_owner"] } }]);
    expect(promiseFigures(title, (at(id).meta as { pack: ContextPack }).pack)).toEqual([]);
    expect(outcome.meta).not.toHaveProperty("heading");
    expect((at(id).meta as { titles: Row[] }).titles.map((each) => each.title)).toContain(title);
  });

  it.each([
    ["a6d24b00", ["7"]],
    // Both its other candidates carry a "1" #2134's classifier reads as the business's "1 email every Monday".
    ["abe42ff7", ["7"]],
  ] as const)("re-pick never takes a promise-figure title: %s has no clean candidate, so it is held and nothing is written", async (id, figures) => {
    arrange(SAAS_HOSTED);
    expect(await recheckRow(at(id), dogfood(at(id)))).toEqual({ kind: "held", reason: "title_promise_figure", figures });
  });

  it("no other stored row is held", async () => {
    arrange(SAAS_HOSTED);
    const held = await Promise.all(rows.map(async (each) => ((await recheckRow(each, dogfood(each))).kind === "held" ? [each.id.slice(0, 8)] : [])));
    expect(held.flat().sort()).toEqual(["a6d24b00", "abe42ff7"]);
  });

  it.each(["5dcc61c2", "a71279ff", "b03e044f"])("%s: its description is cut to 155 or fewer at a word, every word its own", async (id) => {
    arrange(SAAS_HOSTED);
    const before = (at(id).meta as Row).description as string;
    const { meta } = await checked(id);
    const after = meta.description as string;
    expect([[...before].length > 155, [...after].length <= 155, before.startsWith(after), /^[\s.,;:]/.test(before.slice(after.length))]).toEqual([true, true, true, true]);
    expect(meta.recheck).toMatchObject({ descriptionBefore: before, description: after });
  });

  it("a page stored with no description takes its short answer's first sentences, fitted", async () => {
    arrange(SAAS_HOSTED);
    const b03 = at("b03e044f");
    const outcome = await recheckRow({ ...b03, meta: { ...(b03.meta as Row), description: "" } }, dogfood(b03));
    const after = (outcome as { patch: { meta: Row } }).patch.meta.description as string;
    expect([after.length >= 120, after.length <= 155, renderOf(answerBoxOf(b03.body_md!)!).replace(/\s+/g, " ").startsWith(after)]).toEqual([true, true, true]);
  });

  it.each([
    ["f1ec6a58", "Do these tools work for a local or small business, not just enterprise brands?"],
    ["bf8de9bf", "Is Peec AI or Otterly cheaper?"],
  ])("%s: the FAQ pair whose answer denies a rival is dropped, the FAQ keeping its least", async (id, question) => {
    arrange(SAAS_HOSTED);
    const faq = (at(id).meta as { faq: Row[] }).faq;
    const { meta, failed } = await checked(id);
    expect(meta.faq).toEqual(faq.filter((entry) => entry.question !== question));
    expect(meta.recheck).toMatchObject({ faqDropped: [question] });
    expect(failed.map((failure) => failure.rule)).not.toContain("rival_negative");
  });

  it("bf8de9bf with its FAQ already at the least keeps every pair, and the rival-negative stop stands", async () => {
    arrange(SAAS_HOSTED);
    const bf8 = at("bf8de9bf");
    const faq = (bf8.meta as { faq: Row[] }).faq.slice(1);
    const outcome = await recheckRow({ ...bf8, meta: { ...(bf8.meta as Row), faq } }, dogfood(bf8));
    expect(outcome).toMatchObject({ kind: "checked", passed: false, failed: [{ rule: "rival_negative" }, { rule: "title" }], patch: { meta: { faq } } });
    expect((outcome as { patch: { meta: { recheck?: Row } } }).patch.meta.recheck?.faqDropped).toBeUndefined();
  });

  it.each([
    [SAAS_HOSTED.kind, SAAS_HOSTED, "up to 7 pages a week", { job: null, products: [], promises: ["Up to 7 pages a week, written for you"] }],
    // A local business whose profile states its price, on a page that informs.
    [LOCAL_WORDPRESS.kind, LOCAL_WORDPRESS, "from £89 a visit", { job: null, products: ["Boiler service"], promises: ["Boiler service from £89 a visit"] }],
  ] as const)("for %s, a candidate carrying the business's own figure is never picked: the clean one enters review, and with none the page makes no move", async (_, live, figure, profile) => {
    arrange(live);
    const id = await stopped(live);
    const clean = row(id).title as string;
    const promised = `Which plan fits a small team: ${figure}`;
    Object.assign(row(id), { title: promised, meta: { ...(row(id).meta as Row), pack: { ...pack(), profile }, titles: [{ title: promised }, { title: clean }] } });
    await recheck(live);
    expect(row(id)).toMatchObject({ state: "in_review", title: clean, meta: { recheck: { titleBefore: promised, title: clean } } });
    expect(llm).not.toHaveBeenCalled();

    const other = await stopped(live, { topic: "billing" });
    Object.assign(row(other), { title: promised, meta: { ...(row(other).meta as Row), pack: { ...pack(), profile }, titles: [{ title: promised }] } });
    row(id).scheduled_for = "2026-09-12";
    const before = snapshot(db, "drafts", other);
    await recheck(live);
    expect(snapshot(db, "drafts", other)).toBe(before);
  });

  it("pages short of their pack, edited, or older than a topic's rest are not candidates", () => {
    expect([at("a9ac66a2"), at("86083a2b")].map((each) => candidacy(each, NOW))).toEqual(["no_page", "no_page"]);
    const b03 = at("b03e044f");
    const built = Date.parse((b03.meta as { pack: { builtAt: string } }).pack.builtAt);
    expect(candidacy(b03, new Date(built + 28 * DAY))).toBeNull();
    expect(candidacy(b03, new Date(built + 29 * DAY))).toBe("stale");
    expect(candidacy({ ...b03, meta: { ...(b03.meta as object), first_edited_at: NOW.toISOString() } }, new Date(built))).toBe("edited");
  });
});

describe("only a stopped page no one has touched is mended", () => {
  it("a page in review and a page the customer edited are left byte for byte, however much code could mend", async () => {
    arrange(SAAS_HOSTED);
    const long = "A small team picks the plan whose seats cover everyone who opens the tool each day, and checks its limits first. ".repeat(2);
    const reviewed = await stopped(SAAS_HOSTED);
    const edited = await stopped(SAAS_HOSTED, { topic: "billing" });
    for (const id of [reviewed, edited]) Object.assign(row(id), { title: "Which plan fits a small team: up to 7 pages a week", meta: { ...(row(id).meta as Row), description: long } });
    Object.assign(row(reviewed), { state: "in_review", transitions: [...(row(reviewed).transitions as Row[]), { from: "needs_attention", to: "in_review", at: AT.toISOString() }] });
    (row(edited).meta as Row).first_edited_at = AT.toISOString();
    const before = [snapshot(db, "drafts", reviewed), snapshot(db, "drafts", edited)];
    await recheck(SAAS_HOSTED);
    expect([snapshot(db, "drafts", reviewed), snapshot(db, "drafts", edited)]).toEqual(before);
  });

  it("the sentence carrying a do-not-claim entry word for word is dropped, and the battery decides: it passes", async () => {
    arrange(SAAS_HOSTED);
    const id = await stopped(SAAS_HOSTED, { first: "Acme also ships a desktop app for every seat. ", failed: [{ rule: "do_not_claim", detail: { rule: "do_not_claim", matchedEntry: "desktop app" } }] });
    db.rows("sites")[0]!.do_not_claim = ["desktop app"];
    await recheck(SAAS_HOSTED);
    expect(row(id)).toMatchObject({ state: "in_review", meta: { recheck: { sentenceDropped: ["Acme also ships a desktop app for every seat."] } } });
    expect(row(id).body_md).not.toContain("desktop app");
    expect(llm).not.toHaveBeenCalled();
  });
});

describe("one page per date", () => {
  it("a date that holds a page rescues nothing; of two that pass, the newest pack is rescued and the other stays; a second call rescues nothing", async () => {
    arrange(SAAS_HOSTED);
    const older = await stopped(SAAS_HOSTED);
    row("d-live").scheduled_for = D;
    await recheck(SAAS_HOSTED);
    expect(row(older).state).toBe("needs_attention");
    row("d-live").scheduled_for = "2026-09-12";
    const newer = await stopped(SAAS_HOSTED, { topic: "billing", builtAt: new Date(AT.getTime() + DAY) });
    await recheck(SAAS_HOSTED);
    expect([row(newer).state, row(older).state]).toEqual(["in_review", "needs_attention"]);
    expect(await recheck(SAAS_HOSTED)).toBeNull();
    expect(row(older).state).toBe("needs_attention");
  });
});
