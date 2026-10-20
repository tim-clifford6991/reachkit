// Settings › Mail (SPEC §8, decision 2026-10-19-1593): three switches and no
// retention kind, the page-ready switch read off once the first Monday mail
// is sent, and the published switch named for the one page it now tells.
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

const USER = "u1";

async function mailTab(digestSentAt: string | null): Promise<string> {
  db.reset();
  db.seed("users", [{ id: USER, notify: {} }]);
  db.seed("sites", [{ id: "s1", user_id: USER }]);
  db.seed("scans", [{ id: "w1", site_id: "s1", digest_sent_at: digestSentAt }]);
  const settings = assembleSettings({ ...FIXTURE_SETTINGS_FACTS, notifyPrefs: await readNotifyPrefs(USER) });
  return renderToStaticMarkup(<NotificationsPanel settings={settings} />);
}

const switches = (html: string) => [...html.matchAll(/data-testid="notification-([a-z-]+)"/g)].map((m) => m[1]);
const pageReadyRow = (html: string) => html.slice(html.indexOf('data-testid="notification-draft-ready"'), html.indexOf('data-testid="notification-published"'));

beforeEach(() => db.reset());

describe("Settings › Mail", () => {
  it("holds the three switches and no retention kind", async () => {
    const html = await mailTab(null);
    expect(switches(html)).toEqual(["draft-ready", "published", "weekly"]);
    expect(html).not.toMatch(/veto-reminder|inactivity/);
    expect(html).toContain(COPY["settings.notifications.published"]);
  });

  it("before the first Monday mail, the page-ready switch is on and says nothing more", async () => {
    const row = pageReadyRow(await mailTab(null));
    expect(row).toMatch(/checked=""/);
    expect(row).not.toContain(COPY["settings.notifications.draft-ready.off"]);
  });

  it("after the first Monday mail, it reads off and says pages still go live", async () => {
    const row = pageReadyRow(await mailTab("2026-10-19T08:00:00Z"));
    expect(row).toContain(COPY["settings.notifications.draft-ready"]);
    expect(row).not.toMatch(/checked=""/);
    expect(row).toContain(COPY["settings.notifications.draft-ready.off"]);
  });
});
