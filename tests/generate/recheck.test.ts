// tests/generate/recheck.test.ts — SPEC §7 (owner O7): a stored page the rules stopped is read again under today's
// rules at 0¢, and the newest that passes enters review. Each page is written by the real pipeline in the database
// double, then stopped as `rest()` stops it; the stored dogfood rows pin the promise-figure hold (OR4).
import "./env";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Row } from "../publish/harness";
import { AT, fakeCost, opportunity, pack, pageParts, prose } from "./fixtures";
import { LOCAL_WORDPRESS, SAAS_HOSTED, measuredText, seedWorld, type LiveSite } from "./live-edit-world";
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
    await recheck(SAAS_HOSTED);
    expect(row(id)).toMatchObject({ state: "needs_attention", rule_failures: [{ rule: "title", detail: { faults: ["specific"] } }] });
    row(id).hard_rule_attempts = 2;
    await recheck(SAAS_HOSTED);
    expect(row(id).state).toBe("in_review");
  });
});

describe("OR4: a promise-figure title never enters review", () => {
  // Five bodies are exported; the other rows' holds read the title and pack, stopped with the reason `rest()` writes.
  const rows = stored.drafts.map((each: Row) => ({
    site_id: "s-dogfood",
    ...{ body_md: each.has_body ? "(not exported)" : null, grounded_fact: { passage: "p", url: "https://reachkit.app/", readAt: null } },
    transitions: [{ from: "generating", to: "needs_attention", at: each.created_at, reason: each.has_body ? `rules:${((each.rule_failures ?? []) as Row[]).map((failure) => failure.rule).join(",")}` : "step_failed:pack" }],
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
    ["bf8de9bf", false, [{ rule: "rival_negative" }, { rule: "title", detail: { faults: ["business"] } }]],
    ["d98284cc", false, [{ rule: "plain_prose", detail: { faults: [{ tell: "repeated_phrase" }] } }]],
    ["5dcc61c2", false, [{ rule: "required_blocks", detail: { block: "question_headings" } }]],
    // One attempt: its title is not settled, so the missing specific still stops it.
    ["f1ec6a58", false, [{ rule: "rival_negative" }, { rule: "required_blocks", detail: { block: "sections" } }, { rule: "title", detail: { faults: ["specific"] } }]],
  ] as const)("%s, replayed on its own stored body under today's rules: passed %s, failing exactly what it prints, at 0¢", async (id, passed, failed) => {
    arrange(SAAS_HOSTED);
    expect(await recheckRow(at(id), dogfood(at(id)))).toMatchObject({ kind: "checked", passed, failed, spentCents: 0 });
  });

  it("the five stored titles that carry the business's promise are held, and no other is", async () => {
    arrange(SAAS_HOSTED);
    const held = await Promise.all(rows.map(async (each) => ((await recheckRow(each, dogfood(at("b03e044f")))).kind === "held" ? [each.id.slice(0, 8)] : [])));
    expect(held.flat().sort()).toEqual(["a6d24b00", "a71279ff", "abe42ff7", "b8c28f61", "fba1d84d"]);
  });

  it("the same page with a promise title makes no move", async () => {
    arrange(SAAS_HOSTED);
    const id = await stopped(SAAS_HOSTED);
    Object.assign(row(id), { title: "Which plan fits a small team: up to 7 pages a week", meta: { ...(row(id).meta as Row), pack: { ...pack(), profile: (at("fba1d84d").meta as { pack: Row }).pack.profile } } });
    await recheck(SAAS_HOSTED);
    expect(row(id).state).toBe("needs_attention");
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
