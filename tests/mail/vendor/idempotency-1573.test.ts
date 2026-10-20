// tests/mail/vendor/idempotency-1573.test.ts — every Resend request carries
// `Idempotency-Key: {template}:{subject}:{period}`, read off the request the
// real https transport writes, so a retried send is one mail.
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../env-fixture";

applyEnvFixture();

const requests = vi.hoisted(() => [] as { headers: Record<string, unknown>; body: string }[]);
vi.mock("node:https", () => {
  const request = (options: { headers: Record<string, unknown> }, onResponse: (response: EventEmitter & { statusCode: number; headers: object }) => void) => {
    const req = new EventEmitter() as EventEmitter & { setTimeout(): void; end(body: string): void };
    req.setTimeout = () => {};
    req.end = (body: string) => {
      requests.push({ headers: options.headers, body });
      const response = Object.assign(new EventEmitter(), { statusCode: 200, headers: {} });
      onResponse(response);
      response.emit("data", Buffer.from(JSON.stringify({ id: `vendor-${requests.length}` })));
      response.emit("end");
    };
    return req;
  };
  return { default: { request }, request };
});

const { sendViaVendor } = await import("../../../src/lib/mail/vendor/resend");
const { MAIL_KINDS } = await import("../../../src/lib/mail/kinds");
type MailKind = import("../../../src/lib/mail/kinds").MailKind;

const KINDS = Object.keys(MAIL_KINDS) as MailKind[];
const mail = (kind: MailKind, text = "the text body") => ({
  kind,
  to: "reader@example.com",
  subject: "A subject",
  html: "<p>the html body</p>",
  text,
});

beforeEach(() => {
  requests.length = 0;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-19T09:30:00Z"));
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Idempotency-Key on every send", () => {
  it.each(KINDS)("%s carries {template}:{subject}:{period}", async (kind) => {
    await expect(sendViaVendor(mail(kind))).resolves.toMatchObject({ ok: true });
    expect(requests).toHaveLength(1);
    expect(requests[0]!.headers["Idempotency-Key"]).toMatch(new RegExp(`^${kind}:[0-9a-f]{32}:2026-10-19$`));
  });

  it("the same mail sent again that day carries the same key; another mail, or the next day, does not", async () => {
    await sendViaVendor(mail("ops"));
    await sendViaVendor(mail("ops"));
    await sendViaVendor(mail("ops", "another body"));
    vi.setSystemTime(new Date("2026-10-20T09:30:00Z"));
    await sendViaVendor(mail("ops"));
    const keys = requests.map((request) => request.headers["Idempotency-Key"]);
    expect(keys[1]).toBe(keys[0]);
    expect(new Set(keys).size).toBe(3);
  });
});
