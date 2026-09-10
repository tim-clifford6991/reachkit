// BUILD §12 — one Resend request, carrying both bodies, that never throws.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV_FIXTURE, applyEnvFixture } from "../env-fixture";

applyEnvFixture();

const { __setVendorTransportForTesting, recipientDigest, sendViaVendor } = await import(
  "../../../src/lib/mail/vendor/resend"
);

const SEND = {
  kind: "report",
  to: "Reader@Example.com",
  subject: "A subject, already rendered",
  html: "<p>the html body</p>",
  text: "the text body",
} as const;

let captured: string[] = [];
let logs: string[] = [];

function respond(status: number, body: string, headers: Record<string, string> = {}) {
  __setVendorTransportForTesting(async (payload) => {
    captured.push(payload);
    return { status, headers, body };
  });
}

beforeEach(() => {
  captured = [];
  logs = [];
  vi.spyOn(console, "log").mockImplementation((line: unknown) => {
    logs.push(String(line));
  });
});

afterEach(() => {
  __setVendorTransportForTesting(null);
  vi.restoreAllMocks();
});

describe("BUILD §12 — the one request", () => {
  it("carries both bodies, the subject and one recipient", async () => {
    respond(200, JSON.stringify({ id: "vendor-1" }));
    await expect(sendViaVendor(SEND)).resolves.toEqual({ ok: true, id: "vendor-1" });

    expect(captured).toHaveLength(1);
    const request = JSON.parse(captured[0] as string) as Record<string, unknown>;
    expect(request.html).toBe(SEND.html);
    expect(request.text).toBe(SEND.text);
    expect(request.subject).toBe(SEND.subject);
    expect(request.to).toEqual([SEND.to]);
    expect(request.from).toBe(ENV_FIXTURE.MAIL_FROM);
  });

  it("the plain-text alternative is a property of the request, not of a second send", async () => {
    respond(200, JSON.stringify({ id: "vendor-1" }));
    await sendViaVendor(SEND);
    const request = JSON.parse(captured[0] as string) as { text?: string };
    expect(request.text).toBeTruthy();
    expect(captured).toHaveLength(1);
  });

  // Issue #81: the From is `MAIL_FROM`, not `hello@{host of
  // NEXT_PUBLIC_APP_URL}`. The fixture binds a mailbox at a host the app
  // URL does not name, so a re-derivation would fail this.
  it("the from-address is the MAIL_FROM binding, not the app URL's host", async () => {
    respond(200, JSON.stringify({ id: "vendor-1" }));
    await sendViaVendor(SEND);
    const request = JSON.parse(captured[0] as string) as { from?: string };
    expect(request.from).toBe("post@mailbox.example");
    expect(request.from).not.toContain(new URL(ENV_FIXTURE.NEXT_PUBLIC_APP_URL as string).hostname);
  });
});

describe("BUILD §12 — every outcome is a value, never an exception", () => {
  it("a thrown transport is retriable", async () => {
    __setVendorTransportForTesting(async () => {
      throw new Error("socket refused");
    });
    await expect(sendViaVendor(SEND)).resolves.toEqual({ ok: false, retriable: true });
  });

  it("a permanent 4xx is not retriable, so a retry window can end early", async () => {
    respond(422, JSON.stringify({ message: "invalid address" }));
    await expect(sendViaVendor(SEND)).resolves.toEqual({ ok: false, retriable: false });
  });

  it("a 429 is retriable and carries the vendor's own retry-after where it gave one", async () => {
    respond(429, "", { "retry-after": "120" });
    const result = await sendViaVendor(SEND);
    expect(result).toMatchObject({ ok: false, retriable: true });
    expect((result as { retryUntil?: Date }).retryUntil).toBeInstanceOf(Date);
  });

  it("a 5xx is retriable", async () => {
    respond(503, "");
    await expect(sendViaVendor(SEND)).resolves.toEqual({ ok: false, retriable: true });
  });

  it("an accepted send we cannot name is permanent — re-sending would duplicate the mail", async () => {
    respond(200, "not json at all");
    await expect(sendViaVendor(SEND)).resolves.toEqual({ ok: false, retriable: false });
  });

  it("no outcome throws", async () => {
    for (const setup of [
      () => respond(200, JSON.stringify({ id: "x" })),
      () => respond(400, ""),
      () => respond(500, ""),
      () =>
        __setVendorTransportForTesting(async () => {
          throw new Error("boom");
        }),
    ]) {
      setup();
      await expect(sendViaVendor(SEND)).resolves.toBeTruthy();
    }
  });
});

describe("BUILD §12 — the log carries no address and no body", () => {
  it("logs the kind, a digest of the recipient and the vendor id, and nothing else about the mail", async () => {
    respond(200, JSON.stringify({ id: "vendor-1" }));
    await sendViaVendor(SEND);

    expect(logs).toHaveLength(1);
    const line = logs[0] as string;
    expect(line).not.toContain(SEND.to);
    expect(line).not.toContain("Example.com");
    expect(line).not.toContain(SEND.html);
    expect(line).not.toContain(SEND.text);
    expect(line).not.toContain(SEND.subject);

    const record = JSON.parse(line) as Record<string, unknown>;
    expect(record).toEqual({
      event: "mail_send",
      kind: "report",
      recipient: recipientDigest(SEND.to),
      outcome: "sent",
      status: 200,
      vendorId: "vendor-1",
    });
  });

  it("the digest is stable under case and whitespace, and is not the address", () => {
    expect(recipientDigest("Reader@Example.com ")).toBe(recipientDigest("reader@example.com"));
    expect(recipientDigest("reader@example.com")).not.toContain("@");
    expect(recipientDigest("reader@example.com")).toHaveLength(12);
  });

  it("a failure logs no address either", async () => {
    respond(422, "");
    await sendViaVendor(SEND);
    expect(logs[0]).not.toContain(SEND.to);
  });
});
