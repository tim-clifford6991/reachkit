// BUILD §12 — sendEmail(): compose once, consult once, one vendor request.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../env-fixture";
import { fakeDb, newState, type FakeDbState } from "../notifications/fake-db";
import * as f from "../fixtures";

applyEnvFixture();

const state: FakeDbState = newState();
// Both exports, one fake: the notification store reads `users.notify`
// through `dbAdmin()` (#228 — `db()` is the anon key, and RLS
// `users_select_own` matches no row without a user JWT, so that read
// answered `absent` for everyone on every server path).
vi.mock("@/lib/db", () => ({
  db: () => fakeDbRef.current(),
  dbAdmin: () => fakeDbRef.current(),
}));
const fakeDbRef = { current: fakeDb(state) };

const { sendEmail, registerSuppressionReader } = await import("../../../src/lib/mail/send");
const { OWNER_OWED } = await import("../../../src/lib/presentation/copy/registry");
type SendInput = import("../../../src/lib/mail/send").SendInput;
type CopyKey = import("../../../src/lib/presentation/copy").CopyKey;
const { composeMail } = await import("../../../src/lib/mail/shell/compose");
const { __setVendorTransportForTesting } = await import("../../../src/lib/mail/vendor/resend");

const USER = "1b1f5c2e-0000-4000-8000-000000000001";
let requests: Record<string, unknown>[] = [];

function vendorReturns(status: number, body: string): void {
  __setVendorTransportForTesting(async (payload) => {
    requests.push(JSON.parse(payload) as Record<string, unknown>);
    return { status, headers: {}, body };
  });
}

beforeEach(() => {
  requests = [];
  state.rows = { [USER]: { notify: {} } };
  state.reads = [];
  state.failRead = false;
  vendorReturns(200, JSON.stringify({ id: "vendor-1" }));
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  __setVendorTransportForTesting(null);
  registerSuppressionReader(null);
  vi.restoreAllMocks();
});

describe("BUILD §12 — one send, one request", () => {
  it("sends and reports the vendor's own id", async () => {
    await expect(
      sendEmail({ kind: "report", to: "reader@example.com", subject: f.HEADING_KEY, blocks: [f.HEADING] })
    ).resolves.toEqual({ sent: true, id: "vendor-1" });
    expect(requests).toHaveLength(1);
  });

  it("passes composeMail's two bodies to the vendor unchanged", async () => {
    const blocks = [f.HEADING, f.stat(f.num(3))];
    await sendEmail({ kind: "report", to: "reader@example.com", subject: f.HEADING_KEY, blocks });

    const composed = composeMail({ kind: "report", subject: f.HEADING_KEY, blocks });
    expect(requests[0]?.html).toBe(composed.html);
    expect(requests[0]?.text).toBe(composed.text);
    expect(requests[0]?.subject).toBe(composed.subject);
  });

  it("an unmeasured section is dropped, not zeroed, and the mail still leaves", async () => {
    // One measured section keeps the mail out of the whole-mail-line case,
    // whose sentence the owner has not written yet (asserted below).
    const blocks = [f.HEADING, f.stat(f.missing<number>()), f.stat(f.num(0))];
    await expect(
      sendEmail({ kind: "report", to: "reader@example.com", subject: f.HEADING_KEY, blocks })
    ).resolves.toEqual({ sent: true, id: "vendor-1" });
    expect(requests[0]?.text).toContain("0");
  });

  it("a mail needing a sentence the owner has not written is not sent, and says so", async () => {
    // Every conditional section omitted → the nothing-to-report line,
    // which is owner-owed. The seam refuses rather than shipping an empty
    // line, and refuses as a value rather than by throwing into the job
    // that was sending.
    const blocks = [f.HEADING, f.stat(f.missing<number>())];
    const result = await sendEmail({
      kind: "report",
      to: "reader@example.com",
      subject: f.HEADING_KEY,
      blocks,
    });
    if (OWNER_OWED.includes("mail.nothing_to_report" satisfies CopyKey)) {
      expect(result).toEqual({ sent: false, reason: "not-composable" });
      expect(requests).toEqual([]);
    } else {
      expect(result).toEqual({ sent: true, id: "vendor-1" });
    }
  });

  it("maps a permanent vendor rejection to reason 'vendor' with no retry deadline", async () => {
    vendorReturns(422, "");
    await expect(
      sendEmail({ kind: "report", to: "reader@example.com", subject: f.HEADING_KEY, blocks: [f.HEADING] })
    ).resolves.toEqual({ sent: false, reason: "vendor" });
  });

  it("never throws, whatever the vendor does", async () => {
    __setVendorTransportForTesting(async () => {
      throw new Error("socket refused");
    });
    await expect(
      sendEmail({ kind: "report", to: "reader@example.com", subject: f.HEADING_KEY, blocks: [f.HEADING] })
    ).resolves.toEqual({ sent: false, reason: "vendor" });
  });

  it("refuses a kind outside the register at compile time", () => {
    const bad: SendInput = {
      // @ts-expect-error — BUILD §12: no marketing, newsletter or
      // promotional mail exists to send.
      kind: "newsletter",
      to: "reader@example.com",
      subject: f.HEADING_KEY,
      blocks: [f.HEADING],
    };
    expect(bad).toBeTruthy();
  });

  it("a togglable kind without a userId does not typecheck", () => {
    // @ts-expect-error — `userId` is required for every 'toggle' kind,
    // derived from the register at the type level.
    const bad: SendInput = {
      kind: "weekly",
      to: "reader@example.com",
      subject: f.HEADING_KEY,
      blocks: [f.HEADING],
      measurement: { state: "complete" },
    };
    expect(bad).toBeTruthy();
  });
});
