/** @vitest-environment jsdom */
// Settings went from seven tabs to three (owner R7, docs/spec/decisions/2026-11-03-2127.md). Every old card and
// every settable field is drawn on exactly one of the three, every retired address answers 308 to the card that
// took it in, Facts we can quote moved to the live page's detail, no stored voice value is rewritten, and each tab
// carries its amended board's words. Rendered for the account the layout sweep reads.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import { boardFile, compare, readAllow, segments } from "../../../scripts/design/parity.mjs";
import { fakeDb } from "../../publish/harness";
import { settledMarkup } from "../shell/settled";

applyEnvFixture();

// The reserved account reaches no database; the stored-voice cases sign in a live one against this double.
const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const { default: nextConfig } = await import("../../../next.config");
const { SETTABLE } = await import("@/app/(account)/app/settings/settable");
const { SETTINGS_TABS, SETTINGS_TAB_HREF, SETTINGS_TAB_COPY_KEY } = await import("@/app/(account)/app/settings/tabs");
const { copy } = await import("@/lib/presentation/copy");
const { LIVE_ACCOUNT, resetAccount, signedInAs } = await import("../account-door");
const { default: DraftPage } = await import("@/app/(account)/app/draft/[draftId]/page");
const { FIXTURE_DRAFTS, FIXTURE_PUBLISHED_DRAFT_ID } = await import("@/app/(account)/app/draft/[draftId]/fixture");
const { readBusinessQuotable } = await import("@/app/(account)/app/settings/business-provider");
const { generateStore } = await import("@/lib/generate/store");
const { chooseVoice } = await import("@/lib/generate/voice/register");
const { default: BusinessTab } = await import("@/app/(account)/app/settings/page");
const { default: PagesTab } = await import("@/app/(account)/app/settings/pages/page");
const { default: AccountTab } = await import("@/app/(account)/app/settings/account/page");

type Tab = (typeof SETTINGS_TABS)[number];
const SETTINGS_DIR = path.join(process.cwd(), "src/app/(account)/app/settings");
const SCREEN: Record<Tab, () => Promise<React.JSX.Element> | React.JSX.Element> = { business: BusinessTab, pages: PagesTab, account: AccountTab };
const BOARD: Record<Tab, string> = { business: "SettingsIndex", pages: "SettingsPublishing", account: "SettingsAccount" };

/** Each old card: the tab it stood on, the tab it moved to, and the element only it draws. */
const CARDS: Record<string, { was: string; now: Tab; drawn: string }> = {
  BusinessPanel: { was: "business", now: "business", drawn: "settings-business" },
  KnowledgePanel: { was: "business", now: "business", drawn: "settings-business-knowledge" },
  MarketPanel: { was: "market", now: "business", drawn: "setting-category" },
  CompetitorsPanel: { was: "market", now: "business", drawn: "setting-competitors" },
  VoicePanel: { was: "voice", now: "business", drawn: "setting-voice_text" },
  PublishingPanel: { was: "publishing", now: "pages", drawn: "setting-publishing_enabled" },
  LinkMapPanel: { was: "publishing", now: "pages", drawn: "settings-link-map" },
  NotificationsPanel: { was: "mail", now: "pages", drawn: "setting-notifications" },
  KnownContentPanel: { was: "business", now: "pages", drawn: "settings-known-content" },
  BillingPanel: { was: "billing", now: "account", drawn: "action-cancel" },
  MonthPanel: { was: "billing", now: "account", drawn: "billing-month" },
  AccountPanel: { was: "account", now: "account", drawn: "setting-email" },
  DangerZone: { was: "account", now: "account", drawn: "settings-danger" },
};
/** Files under `panels/` that are rows or forms inside a card, never a card of their own. */
const PARTS: Record<string, keyof typeof CARDS> = { SettingRow: "AccountPanel", LocaleRow: "MarketPanel", ConnectDestination: "PublishingPanel" };

/** Each settable field: the tab whose card draws its control. */
const FIELDS: Record<(typeof SETTABLE)[number], Tab> = {
  category: "business",
  competitors: "business",
  domain: "business",
  locale: "business",
  voice_text: "business",
  writing_voice: "business",
  do_not_claim: "business",
  veto_hours: "pages",
  publish_time: "pages",
  time_zone: "pages",
  publishing_enabled: "pages",
  destinations: "pages",
  notifications: "pages",
  name: "account",
  email: "account",
};

/** Each retired address: where it now answers, and the control the anchored card holds. */
const MOVED: Record<string, { to: Tab; anchor: string; holds: string }> = {
  "/app/settings/market": { to: "business", anchor: "market", holds: "setting-category" },
  "/app/settings/voice": { to: "business", anchor: "voice", holds: "setting-voice_text" },
  "/app/settings/publishing": { to: "pages", anchor: "publishing", holds: "setting-publishing_enabled" },
  "/app/settings/mail": { to: "pages", anchor: "mail", holds: "setting-notifications" },
  "/app/settings/billing": { to: "account", anchor: "billing", holds: "action-cancel" },
};

const html: Partial<Record<Tab, string>> = {};
const doc: Partial<Record<Tab, Document>> = {};
beforeAll(async () => {
  signedInAs();
  for (const tab of SETTINGS_TABS) {
    html[tab] = await settledMarkup(await SCREEN[tab]());
    doc[tab] = settle(new DOMParser().parseFromString(html[tab]!, "text/html"));
  }
});
afterAll(() => resetAccount());

/** Moves each streamed segment into its boundary, as React's inline `$RC` swap does in the browser. */
function settle(page: Document): Document {
  const swaps = [...page.querySelectorAll("script")].flatMap((script) => [...(script.textContent ?? "").matchAll(/\$RC\("([^"]+)","([^"]+)"\)/g)]);
  for (const [, boundary, segment] of swaps) {
    const template = page.getElementById(boundary!);
    const content = page.getElementById(segment!);
    if (template === null || content === null) continue;
    let fallback = template.nextSibling;
    while (fallback !== null && !(fallback.nodeType === 8 && fallback.textContent === "/$")) {
      const next = fallback.nextSibling;
      fallback.remove();
      fallback = next;
    }
    template.replaceWith(...content.childNodes);
    content.remove();
  }
  return page;
}

const drawnOn = (testId: string): Tab[] => SETTINGS_TABS.filter((tab) => doc[tab]!.querySelector(`[data-testid="${testId}"]`) !== null);

describe("every old setting is mapped to exactly one of the three tabs", () => {
  it("the map names every file under panels/ and every field settable.ts accepts, and nothing else", () => {
    const panels = readdirSync(path.join(SETTINGS_DIR, "panels")).filter((f) => /^[A-Z]\w*\.tsx$/.test(f)).map((f) => f.slice(0, -4));
    expect([...Object.keys(CARDS), ...Object.keys(PARTS)].sort()).toEqual(panels.sort());
    expect(Object.keys(FIELDS).sort()).toEqual([...SETTABLE].sort());
    for (const host of Object.values(PARTS)) expect(CARDS[host]).toBeDefined();
  });

  it.each(Object.entries(CARDS))("%s is drawn on its new tab and on no other", (_card, { now, drawn }) => {
    expect(drawnOn(drawn)).toEqual([now]);
  });

  it.each(Object.entries(FIELDS))("the %s control is drawn on its tab and on no other", (key, tab) => {
    expect(drawnOn(`setting-${key}`)).toEqual([tab]);
  });

  it("the bar's three words are Your business, Pages and Account", () => {
    expect(SETTINGS_TABS.map((tab) => copy(SETTINGS_TAB_COPY_KEY[tab]))).toEqual(["Your business", "Pages", "Account"]);
  });
});

describe("every retired address answers 308 to the card that took it in", () => {
  it.each(Object.entries(MOVED))("%s", async (from, { to, anchor, holds }) => {
    const rules = (await nextConfig.redirects!()).filter((rule) => rule.source === from);
    expect(rules).toEqual([{ source: from, destination: `${SETTINGS_TAB_HREF[to]}#${anchor}`, permanent: true }]);
    // No page is left behind the redirect, and the anchor holds the moved card.
    expect(existsSync(path.join(SETTINGS_DIR, from.split("/").pop()!, "page.tsx"))).toBe(false);
    expect(doc[to]!.getElementById(anchor)?.querySelector(`[data-testid="${holds}"]`)).not.toBeNull();
  });
});

describe("each tab carries its amended board's words", () => {
  // Drawn by the shell and the Settings layout, not by the tab.
  const frame = ["ReachKit", "Overview", "This week", "Settings", "Publishing on", ...SETTINGS_TABS.map((tab) => copy(SETTINGS_TAB_COPY_KEY[tab]))];
  it.each(SETTINGS_TABS)("%s: every board string is on the screen but for sample data, rulings and the frame", (tab) => {
    const { missing } = compare(readFileSync(boardFile(BOARD[tab]), "utf8"), segments(html[tab]!), readAllow(BOARD[tab]));
    expect(missing.filter((s: string) => !frame.includes(s))).toEqual([]);
  });
});

describe("Facts we can quote leaves Settings for the live page's detail", () => {
  const draft = async (draftId: string): Promise<Document> =>
    settle(new DOMParser().parseFromString(await settledMarkup(await DraftPage({ params: { draftId } })), "text/html"));

  it("no Settings tab draws it", () => {
    expect(drawnOn("settings-business-facts")).toEqual([]);
    for (const tab of SETTINGS_TABS) expect(segments(html[tab]!)).not.toContain(copy("settings.business.facts.title"));
  });

  it("the live page draws it, over the same read and the same rows Settings drew", async () => {
    signedInAs();
    const card = (await draft(FIXTURE_PUBLISHED_DRAFT_ID)).querySelector('[data-testid="settings-business-facts"]');
    expect(card?.querySelector("summary")?.textContent).toBe(copy("settings.business.facts.title"));
    const rows = [...card!.querySelectorAll('[data-testid="business-fact"]')].map((row) => row.querySelector("p")?.textContent);
    const read = await readBusinessQuotable();
    expect(read.length).toBeGreaterThan(0);
    expect(rows).toEqual(read.map((fact) => copy("settings.business.facts.quote", { passage: fact.passage }) + (fact.pages > 1 ? ` ${copy("settings.business.facts.pages", { count: String(fact.pages) })}` : "")));
  });

  it("a page not yet live draws no facts", async () => {
    signedInAs();
    const waiting = Object.keys(FIXTURE_DRAFTS).find((id) => FIXTURE_DRAFTS[id]!.live == null)!;
    const page = await draft(waiting);
    expect(page.querySelector('[data-testid="draft-title"]')?.textContent).toBe(FIXTURE_DRAFTS[waiting]!.title);
    expect(page.querySelector('[data-testid="settings-business-facts"], [data-testid="draft-facts-skeleton"]')).toBeNull();
  });
});

describe("stored voice values: none is lost or rewritten, and generation reads the same row", () => {
  const SITE = { id: LIVE_ACCOUNT.siteId, user_id: LIVE_ACCOUNT.userId, domain: LIVE_ACCOUNT.domain, mode: "autopilot", veto_hours: 24, publish_time: "09:00", timezone: "America/New_York", publishing_enabled: true, voice_text: "Plain and formal." };
  /** The page voice generation would choose for one question, from the stored row. */
  const generationInput = async () => {
    const setting = await generateStore().writingVoice(LIVE_ACCOUNT.siteId);
    return { setting, voice: chooseVoice({ setting, voiceText: SITE.voice_text, category: "plumber", question: "is a leaking tap urgent", type: "qa", language: "en" }) };
  };
  afterAll(() => resetAccount());

  // `null` is "let ReachKit choose" (auto); `short` is the length the card no longer offers.
  it.each([null, "ours", "guide", "short"] as const)("stored %s: the tab writes nothing, the row and generation's input stay byte-equal", async (stored) => {
    db.reset();
    db.seed("sites", [{ ...SITE, writing_voice: stored }]);
    signedInAs(LIVE_ACCOUNT);
    const row = JSON.stringify(db.rows("sites"));
    const input = JSON.stringify(await generationInput());
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const page = settle(new DOMParser().parseFromString(await settledMarkup(await BusinessTab()), "text/html"));
    vi.restoreAllMocks();
    // A read the double cannot answer is logged to ops_events; nothing else is written.
    expect(db.queries.filter((query) => query.verb !== "select" && query.table !== "ops_events")).toEqual([]);
    expect(JSON.stringify(db.rows("sites"))).toBe(row);
    expect(JSON.stringify(await generationInput())).toBe(input);
    // The card shows the stored choice; one it no longer offers checks nothing rather than a default.
    expect(page.querySelectorAll('[data-testid="setting-writing_voice"] input[type="radio"]')).toHaveLength(2);
    const checked = [...page.querySelectorAll<HTMLInputElement>('[data-testid="setting-writing_voice"] input[type="radio"]')].filter((radio) => radio.hasAttribute("checked"));
    expect(checked.map((radio) => radio.value)).toEqual(stored === "ours" || stored === "guide" ? [stored] : []);
  });
});
