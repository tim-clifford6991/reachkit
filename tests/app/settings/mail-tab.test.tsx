// Settings › Mail (board SettingsMail; SPEC §8, decision 2026-10-19-1593, Q10):
// the Monday mail and page-ready switches, each with what it sends, and the
// page-ready switch read off once the first Monday mail is sent. Rendered from stored rows.
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

const USER = "u1";

async function mailTab(a: { digestSentAt?: string | null; notify?: Record<string, boolean>; vetoHours?: number } = {}): Promise<Document> {
  db.reset();
  db.seed("users", [{ id: USER, notify: a.notify ?? {} }]);
  db.seed("sites", [{ id: "s1", user_id: USER }]);
  db.seed("scans", [{ id: "w1", site_id: "s1", digest_sent_at: a.digestSentAt ?? null }]);
  const settings = assembleSettings({ ...FIXTURE_SETTINGS_FACTS, vetoHours: a.vetoHours ?? 24, notifyPrefs: await readNotifyPrefs(USER) });
  return new DOMParser().parseFromString(renderToStaticMarkup(<NotificationsPanel settings={settings} />), "text/html");
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

beforeEach(() => db.reset());

describe("Settings › Mail", () => {
  it("the card is titled with the tab's own word, and says where mail goes, the address in mono", async () => {
    const doc = await mailTab();
    expect(text(doc.querySelector("h2"))).toBe("Mail");
    expect(text(doc.querySelector("h2"))).toBe(COPY[SETTINGS_TAB_COPY_KEY.mail]);
    expect(text(doc.querySelector('[data-testid="notifications-to"]'))).toBe("Sent to dana@example.com");
    expect(doc.querySelector('[data-testid="notifications-to"] .num')?.textContent).toBe("dana@example.com");
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

  it("the Monday mail row says what it sends, the week's count from the plan, and names no send time (owner R29)", async () => {
    const weekly = row(await mailTab(), "weekly");
    expect(text(weekly)).toBe("Monday mail Mondays. What went live, what moved, and the next 7 pages.");
    expect(text(weekly)).not.toMatch(/\d{1,2}:\d{2}|\b(AM|PM)\b/);
  });

  it.each([
    [24, "1 day"],
    [48, "2 days"],
  ])("before the first Monday mail, the page-ready row is on and states the stop window of %s hours", async (vetoHours, window) => {
    const ready = row(await mailTab({ vetoHours }), "draft-ready");
    expect(ready?.querySelector("input")?.hasAttribute("checked")).toBe(true);
    expect(text(ready)).toBe(`A page is ready One mail per page, ${window} before it goes live, until your first Monday mail. Turn on to keep getting them.`);
  });

  it("after the first Monday mail, it reads off and says pages still go live, This week linked to the calendar", async () => {
    const ready = row(await mailTab({ digestSentAt: "2026-10-19T08:00:00Z" }), "draft-ready")!;
    expect(ready.querySelector("input")?.hasAttribute("checked")).toBe(false);
    expect(text(ready)).toBe("A page is ready Pages still go live on their day. You can stop them from This week.");
    expect(ready.querySelector("a")?.getAttribute("href")).toBe("/app/calendar");
    expect(ready.querySelector('[data-testid="notification-draft-ready-off"] > svg.lucide-info')?.getAttribute("aria-hidden")).toBe("true");
  });

  it("closes on the mail that can't be switched off, and with both off says only that mail still comes", async () => {
    const on = await mailTab();
    expect(text(on.querySelector('[data-testid="notifications-always-on"]'))).toBe("Sign-in and account mail can’t be switched off.");
    expect(on.querySelector('[data-testid="notifications-none"]')).toBeNull();
    const off = await mailTab({ notify: { weekly: false, "draft-ready": false } });
    expect(text(off.querySelector('[data-testid="notifications-none"]'))).toBe(
      "You get no ReachKit mail except sign-in and account mail. Pages still go live on their day."
    );
  });
});
