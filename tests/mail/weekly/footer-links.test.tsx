// Board MondayMail's footer, followed from the mail itself: opening "Pause all
// pages" or "Unsubscribe" changes nothing, because mail scanners open links;
// pressing the page's one button pauses publishing, or switches off only the
// Monday mail. The mail carries RFC 8058's one-click headers, and that POST
// still switches the mail off with no session. The sign-in
// mail still reaches a reader who unsubscribed (ADR-042). Sent through the real
// seam with the vendor's transport stubbed: 0¢.
import { isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../env-fixture";
import { fakeDb } from "../../publish/harness";

applyEnvFixture();

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
vi.mock("@/lib/scan/weekly", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/scan/weekly")>()),
  accountForWeek: async () => ({ kind: "complete", measuredAt: NOW }),
}));
vi.mock("@/lib/opportunities", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/opportunities")>()),
  weeklyDigest: async () => ({ standings: [], weekMeasuredAt: NOW }),
}));

const { sendWeeklyDigest } = await import("@/lib/mail/weekly");
const { sendEmail } = await import("@/lib/mail/send");
const { buildMagicLink } = await import("@/lib/mail/templates/magic-link");
const { __setVendorTransportForTesting } = await import("@/lib/mail/vendor/resend");
const { readUnsubscribeToken } = await import("@/lib/mail/notifications/unsubscribe");
const { readPauseToken } = await import("@/lib/publish/switch/pause-link");
const { COPY } = await import("@/lib/presentation/copy");
const UnsubscribePage = (await import("@/app/(public)/unsubscribe/[token]/page")).default;
const PausePage = (await import("@/app/(public)/pause/[token]/page")).default;
const oneClick = await import("@/app/api/unsubscribe/[token]/route");

const NOW = new Date(Date.UTC(2026, 9, 19, 7, 0, 0));
const WEEK = "2026-10-19";
const APP = "https://reachkit.example";

let payloads: { to: string[]; html: string; headers?: Record<string, string> }[] = [];

beforeEach(() => {
  db.reset();
  db.seed("users", [{ id: "user-1", email: "dana@harborplumbing.example", name: "Dana", notify: null }]);
  db.seed("sites", [
    {
      id: "site-1",
      user_id: "user-1",
      domain: "harborplumbing.example",
      created_at: "2026-10-05T12:00:00Z",
      timezone: "America/Chicago",
      publish_time: "16:00",
      publishing_enabled: true,
    },
  ]);
  db.seed("scans", [{ id: "scan-week", site_id: "site-1", tier: "weekly", week_start: WEEK, status: "done", digest_sent_at: null }]);
  payloads = [];
  __setVendorTransportForTesting(async (payload) => {
    payloads.push(JSON.parse(payload));
    return { status: 200, headers: {}, body: JSON.stringify({ id: `vendor-${payloads.length}` }) };
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  __setVendorTransportForTesting(null);
  vi.restoreAllMocks();
});

/** The Monday mail as the vendor received it, and the addresses its footer links to. */
async function monday(): Promise<{ html: string; headers: Record<string, string>; href: (path: string) => string }> {
  db.rows("scans")[0]!.digest_sent_at = null;
  const outcome = await sendWeeklyDigest({ siteId: "site-1", weekStart: WEEK, now: NOW });
  expect(outcome.sent).toBe(true);
  const sent = payloads.at(-1)!;
  const href = (path: string) => {
    const found = new RegExp(`href="(${APP}${path}[^"]*)"`).exec(sent.html);
    if (found === null) throw new Error(`the mail links to no ${path}`);
    return found[1]!;
  };
  return { html: sent.html, headers: sent.headers ?? {}, href };
}
const tokenIn = (href: string, path: string) => decodeURIComponent(new URL(href).pathname.slice(path.length));
const page = async (element: Promise<React.JSX.Element>) => renderToStaticMarkup(await element).replace(/&#x27;/g, "'");
const notify = () => db.rows("users")[0]!.notify as Record<string, boolean> | null;
const writes = (table: string) => db.queries.filter((q) => q.table === table && q.verb === "update").length;
const siteWrites = () => writes("sites");

/** Every form action in a rendered tree: a server action is the page's only POST. */
function formActions(node: unknown): (() => Promise<void>)[] {
  if (Array.isArray(node)) return node.flatMap(formActions);
  if (!isValidElement(node)) return [];
  const props = node.props as Record<string, unknown>;
  const own = node.type === "form" && typeof props.action === "function" ? [props.action as () => Promise<void>] : [];
  return [...own, ...Object.values(props).flatMap(formActions)];
}
/** Presses the page's one button: the action runs, then sends the reader back with `?done=1`. */
async function press(element: Promise<React.JSX.Element>, back: string): Promise<void> {
  const actions = formActions(await element);
  expect(actions).toHaveLength(1);
  await expect(actions[0]!()).rejects.toMatchObject({ digest: expect.stringContaining(`${back}?done=1`) });
}

describe("Unsubscribe: a signed link to the Monday mail's own toggle, and the one-click headers for it", () => {
  it("the footer reads as the board, and the headers carry the same token's one-click address", async () => {
    const mail = await monday();
    for (const label of ["mail.reason.weekly", "mail.weekly.footer.pause", "mail.weekly.footer.settings", "mail.unsubscribe.label"] as const) {
      expect(mail.html).toContain(COPY[label]);
    }
    const token = tokenIn(mail.href("/unsubscribe/"), "/unsubscribe/");
    expect(readUnsubscribeToken(token)).toEqual({ userId: "user-1", kind: "weekly" });
    expect(mail.headers).toEqual({
      "List-Unsubscribe": `<${APP}/api/unsubscribe/${encodeURIComponent(token)}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
    expect(mail.href("/app/settings/mail")).toBe(`${APP}/app/settings/mail`);
  });

  it("opening the link changes nothing: it asks, with one button, and writes no setting", async () => {
    const token = tokenIn((await monday()).href("/unsubscribe/"), "/unsubscribe/");
    for (const query of [{}, { done: "1" }]) {
      const html = await page(UnsubscribePage({ params: { token }, searchParams: query }));
      expect(writes("users"), "a GET writes no setting").toBe(0);
      expect(html).toContain(COPY["optout.head.unresolved"]);
      expect(html).not.toContain(COPY["unsubscribe.head"]);
      expect(formActions(await UnsubscribePage({ params: { token }, searchParams: query }))).toHaveLength(1);
    }
    expect(await page(UnsubscribePage({ params: { token } }))).toContain(COPY["unsubscribe.ask"].replace("{mail}", COPY["settings.notifications.weekly"]));
    expect(notify()).toBeNull();
    expect(writes("users")).toBe(0);
  });

  it("the button turns off the Monday mail only, once, says so with a way to Settings › Mail, and the next Monday is not sent", async () => {
    const token = tokenIn((await monday()).href("/unsubscribe/"), "/unsubscribe/");
    await press(UnsubscribePage({ params: { token } }), `/unsubscribe/${token}`);
    expect(notify()).toEqual({ weekly: false });
    expect(writes("users")).toBe(1);
    const html = await page(UnsubscribePage({ params: { token }, searchParams: { done: "1" } }));
    expect(html).toContain(COPY["unsubscribe.head"]);
    expect(html).toContain(COPY["unsubscribe.done"].replace("{mail}", COPY["settings.notifications.weekly"]));
    expect(html).toContain('href="/app/settings/mail"');
    expect(writes("users")).toBe(1);
    // The next Monday is not sent; the toggle is the seam's to read.
    db.rows("scans")[0]!.digest_sent_at = null;
    expect(await sendWeeklyDigest({ siteId: "site-1", weekStart: WEEK, now: NOW })).toEqual({ sent: false, reason: "mail" });
  });

  it("a forged token changes nothing and says so", async () => {
    const token = tokenIn((await monday()).href("/unsubscribe/"), "/unsubscribe/");
    const forged = `${token.split(".")[0]}.${Buffer.from("not the mac").toString("base64url")}`;
    for (const query of [{}, { done: "1" }]) {
      const html = await page(UnsubscribePage({ params: { token: forged }, searchParams: query }));
      expect(html).toContain(COPY["unsubscribe.invalid"]);
      expect(formActions(await UnsubscribePage({ params: { token: forged }, searchParams: query }))).toEqual([]);
    }
    expect(notify()).toBeNull();
    const [request, context] = post(forged);
    expect((await oneClick.POST(request, context)).status).toBe(404);
    expect(notify()).toBeNull();
  });

  it("the one-click POST switches it off with no session, and a GET is sent to the page", async () => {
    const token = tokenIn((await monday()).href("/unsubscribe/"), "/unsubscribe/");
    const get = await oneClick.GET(new Request(`${APP}/api/unsubscribe/${token}`), { params: Promise.resolve({ token }) });
    expect(get.status).toBe(303);
    expect(get.headers.get("location")).toBe(`/unsubscribe/${token}`);
    expect(writes("users")).toBe(0);
    const [request, context] = post(token);
    expect((await oneClick.POST(request, context)).status).toBe(200);
    expect(notify()).toEqual({ weekly: false });
    expect(writes("users")).toBe(1);
  });

  it("the sign-in mail still reaches a reader who unsubscribed from Monday's", async () => {
    const token = tokenIn((await monday()).href("/unsubscribe/"), "/unsubscribe/");
    await press(UnsubscribePage({ params: { token } }), `/unsubscribe/${token}`);
    const signIn = buildMagicLink({ href: `${APP}/auth/confirm?t=x`, address: "dana@harborplumbing.example" });
    const result = await sendEmail({ kind: "magic-link", to: "dana@harborplumbing.example", subject: signIn.subject, blocks: signIn.blocks, reason: signIn.reason });
    expect(result.sent).toBe(true);
    expect(payloads.at(-1)!.headers).toBeUndefined();
  });
});

describe("Pause all pages: a signed, single-purpose link that pauses publishing once", () => {
  it("opening the link pauses nothing: it asks, with one button, and writes no site", async () => {
    const token = tokenIn((await monday()).href("/pause/"), "/pause/");
    expect(readPauseToken(token)).toBe("site-1");
    for (const query of [{}, { done: "1" }]) {
      const html = await page(PausePage({ params: { token }, searchParams: query }));
      expect(siteWrites(), "a GET writes no site").toBe(0);
      expect(html).toContain(COPY["pause.head.unresolved"]);
      expect(html).not.toContain(COPY["pause.done"]);
      expect(formActions(await PausePage({ params: { token }, searchParams: query }))).toHaveLength(1);
    }
    expect(await page(PausePage({ params: { token } }))).toContain(COPY["pause.ask"]);
    expect(db.rows("sites")[0]!.publishing_enabled).toBe(true);
    expect(siteWrites()).toBe(0);
  });

  it("the button pauses publishing for the mail's site once, says so and how to turn it on, and pressing again writes nothing more", async () => {
    const token = tokenIn((await monday()).href("/pause/"), "/pause/");
    for (const press_ of [1, 2]) {
      await press(PausePage({ params: { token } }), `/pause/${token}`);
      const html = await page(PausePage({ params: { token }, searchParams: { done: "1" } }));
      expect(html, `press ${press_}`).toContain(COPY["pause.head"]);
      expect(html).toContain(COPY["pause.done"]);
      expect(html).toContain('href="/app/settings/publishing"');
    }
    expect(db.rows("sites")[0]).toMatchObject({ publishing_enabled: false, publishing_changed_by: "customer" });
    expect(siteWrites()).toBe(1);
  });

  it("a forged token, or the unsubscribe token, pauses nothing", async () => {
    const mail = await monday();
    const pause = tokenIn(mail.href("/pause/"), "/pause/");
    for (const token of [`${pause.split(".")[0]}.${Buffer.from("not the mac").toString("base64url")}`, tokenIn(mail.href("/unsubscribe/"), "/unsubscribe/")]) {
      for (const query of [{}, { done: "1" }]) {
        const html = await page(PausePage({ params: { token }, searchParams: query }));
        expect(html).toContain(COPY["pause.invalid"]);
        expect(formActions(await PausePage({ params: { token }, searchParams: query }))).toEqual([]);
      }
    }
    expect(db.rows("sites")[0]!.publishing_enabled).toBe(true);
    expect(siteWrites()).toBe(0);
  });
});

function post(token: string): [Request, { params: Promise<{ token: string }> }] {
  return [
    new Request(`${APP}/api/unsubscribe/${token}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "List-Unsubscribe=One-Click",
    }),
    { params: Promise.resolve({ token }) },
  ];
}
