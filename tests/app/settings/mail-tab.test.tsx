// Settings › Mail (board SettingsMail; SPEC §8, decision 2026-10-19-1593, Q10):
// the Monday mail and page-ready switches, each with what it sends and a
// preview, the week strip, and the page-ready switch read off once the first
// Monday mail is sent. Rendered from stored rows.
/** @vitest-environment jsdom */
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "../../publish/harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
vi.mock("@/app/(account)/app/settings/panel-actions", () => ({ setNotificationAction: async () => null }));

const { COPY } = await import("@/lib/presentation/copy");
const { readNotifyPrefs } = await import("@/lib/mail/notifications");
const { assembleSettings } = await import("@/app/(account)/app/settings/model");
const { FIXTURE_SETTINGS_FACTS } = await import("@/app/(account)/app/settings/fixture");
const { NotificationsPanel } = await import("@/app/(account)/app/settings/panels/NotificationsPanel");
const { SETTINGS_TAB_COPY_KEY } = await import("@/app/(account)/app/settings/tabs");
const { nextPageOf } = await import("@/app/(account)/app/settings/next-page");

const USER = "u1";
const NEXT = nextPageOf(
  {
    timeZone: "America/Chicago",
    review: { draftId: "d1", title: "Emergency plumber in Austin: what to do in the first hour", goesLiveAt: new Date("2026-10-19T21:00:00.000Z") },
    publishing: { mode: "autopilot", next: new Date("2026-10-19T21:00:00.000Z") },
  },
  24
);

async function mailTab(a: { digestSentAt?: string | null; notify?: Record<string, boolean>; climbing?: number } = {}): Promise<Document> {
  db.reset();
  db.seed("users", [{ id: USER, notify: a.notify ?? {} }]);
  db.seed("sites", [{ id: "s1", user_id: USER }]);
  db.seed("scans", [{ id: "w1", site_id: "s1", digest_sent_at: a.digestSentAt ?? null }]);
  const settings = assembleSettings({ ...FIXTURE_SETTINGS_FACTS, notifyPrefs: await readNotifyPrefs(USER) });
  const html = renderToStaticMarkup(<NotificationsPanel settings={settings} next={NEXT} climbing={a.climbing} />);
  return new DOMParser().parseFromString(html, "text/html");
}

/** An element's text nodes, word-separated as a reader hears them. */
const text = (el: Element | null | undefined): string => {
  if (!el) return "";
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) parts.push(node.textContent ?? "");
  return parts.map((part) => part.trim()).filter(Boolean).join(" ").replace(/ ([,.;:!?])/g, "$1");
};
const row = (doc: Document, kind: string) => doc.querySelector(`[data-testid="notification-${kind}"]`);
const switches = (doc: Document) => [...doc.querySelectorAll('[data-testid^="notification-"][class*="border-t"]')].map((el) => el.getAttribute("data-testid"));
const caption = (doc: Document) => text(doc.querySelector('[data-testid="notifications-week"] p'));

beforeEach(() => db.reset());

describe("Settings › Mail", () => {
  it("the card is titled with the tab's own word, and says where mail goes and where to change it", async () => {
    const doc = await mailTab();
    expect(text(doc.querySelector("h2"))).toBe("Mail");
    expect(text(doc.querySelector("h2"))).toBe(COPY[SETTINGS_TAB_COPY_KEY.mail]);
    expect(text(doc.querySelector('[data-testid="notifications-to"]'))).toBe("Mail goes to dana@example.com. Change it under Account.");
    expect(doc.querySelector('[data-testid="notifications-to"] a')?.getAttribute("href")).toBe("/app/settings/account");
  });

  it("every customer sentence that points into Settings names a tab that exists", () => {
    const tabs = new Set(Object.values(SETTINGS_TAB_COPY_KEY).map((key) => COPY[key]));
    const pointers = Object.entries(COPY as Record<string, string>).flatMap(([key, value]) =>
      [...value.matchAll(/Settings › ([^.,;:]+)/g)].map((m) => [key, m[1]?.trim()] as const)
    );
    expect(pointers.length).toBeGreaterThan(0);
    expect(pointers.filter(([, tab]) => !tabs.has(tab ?? ""))).toEqual([]);
  });

  it("holds the board's two switches, the Monday mail first, and no published or retention kind", async () => {
    const doc = await mailTab();
    expect(switches(doc)).toEqual(["notification-weekly", "notification-draft-ready"]);
    expect(doc.body.innerHTML).not.toMatch(/notification-published|veto-reminder|inactivity/);
    expect(doc.body.textContent).not.toContain(COPY["settings.notifications.published"]);
  });

  it("the Monday mail row says what it sends and previews the week", async () => {
    const weekly = row(await mailTab(), "weekly");
    expect(text(weekly?.querySelector("label"))).toBe("Monday mail: your week’s pages");
    expect(text(weekly)).toContain("What went live, what moved, and the 7 pages planned next.");
    expect(text(weekly?.querySelector('[data-testid="notification-weekly-preview"]'))).toBe("Your week: 7 pages planned Mondays");
  });

  it.each([
    ["nothing read yet", undefined, "Your week: 7 pages planned Mondays"],
    ["read, none climbing", 0, "Your week: 7 pages planned Mondays"],
    ["one page climbing", 1, "Your week: 7 pages planned, 1 page climbing Mondays"],
    ["three pages climbing", 3, "Your week: 7 pages planned, 3 pages climbing Mondays"],
  ])("the week line with %s says how many pages climb, never 0, and names no send time", async (_, climbing, line) => {
    const weekly = row(await mailTab({ climbing }), "weekly");
    const preview = text(weekly?.querySelector('[data-testid="notification-weekly-preview"]'));
    expect(preview).toBe(line);
    expect(preview).not.toMatch(/\b0 (page|climbing)/);
    expect(text(weekly)).not.toMatch(/\d{1,2}:\d{2}|\b(AM|PM)\b/);
  });

  it("before the first Monday mail, the page-ready row is on, says it runs until that mail, and previews the next page", async () => {
    const ready = row(await mailTab(), "draft-ready");
    expect(ready?.querySelector("input")?.hasAttribute("checked")).toBe(true);
    expect(text(ready)).toContain(
      "One mail per page, 1 day before it goes live, until your first Monday mail. Turn this on to keep getting them."
    );
    expect(text(ready?.querySelector('[data-testid="notification-draft-ready-preview"]'))).toBe(
      "Your next page is written: Emergency plumber in Austin: what to do in the first hour Sun, Oct 18, 4:00 PM · goes live Mon, Oct 19, 4:00 PM"
    );
    expect(text(ready)).not.toContain(COPY["settings.notifications.draft-ready.off"]);
  });

  it("after the first Monday mail, it reads off, says pages still go live, and the strip shows no page-ready mail", async () => {
    const doc = await mailTab({ digestSentAt: "2026-10-19T08:00:00Z" });
    const ready = row(doc, "draft-ready");
    expect(ready?.querySelector("input")?.hasAttribute("checked")).toBe(false);
    expect(text(ready)).toContain(COPY["settings.notifications.draft-ready.off"]);
    expect(ready?.querySelector('[data-testid="notification-draft-ready-preview"]')).toBeNull();
    expect(caption(doc)).toBe("Monday mail No page-ready mail. Pages still go live.");
  });

  it("the week strip heads Monday to Sunday and names the mail each day brings", async () => {
    const doc = await mailTab();
    const week = doc.querySelector('[data-testid="notifications-week"]')!;
    expect(text(week.querySelector("figcaption"))).toBe("Your week of mail");
    expect([...week.querySelectorAll(".grid > div > span:first-child")].map((el) => el.textContent)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(caption(doc)).toBe("Monday mail A page is ready, one per page");
  });

  it("each mail carries its icon: Inbox for the Monday mail, MailCheck for page-ready, Info on switched off", async () => {
    const on = await mailTab();
    const weekly = row(on, "weekly")!;
    const ready = row(on, "draft-ready")!;
    expect(weekly.querySelector('[data-testid="notification-weekly-preview"] > svg.lucide-inbox')).not.toBeNull();
    expect(ready.querySelector('[data-testid="notification-draft-ready-preview"] > svg.lucide-mail-check')).not.toBeNull();
    const week = on.querySelector('[data-testid="notifications-week"]')!;
    expect(week.querySelectorAll("svg.lucide-inbox").length).toBeGreaterThan(0);
    expect(week.querySelectorAll("svg.lucide-mail-check").length).toBeGreaterThan(0);
    expect(week.querySelectorAll("svg.lucide-mail, svg.lucide-file-text")).toHaveLength(0);
    for (const svg of on.querySelectorAll("svg")) expect(svg.getAttribute("aria-hidden")).toBe("true");

    const off = row(await mailTab({ digestSentAt: "2026-10-19T08:00:00Z" }), "draft-ready")!;
    expect(off.querySelector('[data-testid="notification-draft-ready-off"] > svg.lucide-info')).not.toBeNull();
  });

  it("with both switched off, the strip draws no mail and says only sign-in and account mail still come", async () => {
    const doc = await mailTab({ notify: { weekly: false, "draft-ready": false } });
    expect(doc.querySelectorAll('[data-testid="notifications-week"] .grid svg')).toHaveLength(0);
    expect(caption(doc)).toBe("You get no ReachKit mail except sign-in and account mail. Pages still go live on their day.");
  });
});
