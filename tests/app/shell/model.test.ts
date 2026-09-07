// tests/app/shell/model.test.ts — BUILD §4.4, REQ-040 criteria 2, 3, 4, 6, 7
//
// WO-154 `## Goal`: "Assemble `ShellModel` … the domain, a week count that
// counts measured weeks only, the waiting count, and either the next publish
// time or the first-match reason there is none."
//
// The assembly is pure (facts in, model out), so every arm below is decided
// with no database and no clock. The reading of those facts is `provider.ts`,
// asserted at the bottom against this issue's fixture.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assembleShell, type ShellFacts } from "@/app/(account)/app/_shell/model";
import { readShell } from "@/app/(account)/app/_shell/provider";
import { FIXTURE_SHELL_FACTS } from "@/app/(account)/app/_shell/fixture";

// BUILD §4.4–§4.6, issue #169 — the surfaces under test now resolve who is
// asking through `_session/account.ts`, which reads a signed cookie and a
// `sites` row. This suite has neither, so it signs in as the reserved
// fixture account: the surfaces then take the same fixture branch they
// always took, and what changed is only how they learned whose it is.
import { resetAccount, signedInAs } from "../account-door";

beforeEach(() => signedInAs());
afterEach(() => resetAccount());


const MONDAY = (day: number): Date => new Date(Date.UTC(2026, 8, day, 6, 0, 0));

const BASE: ShellFacts = {
  domain: "example.com",
  timeZone: "America/New_York",
  mode: "autopilot",
  weeks: [
    { domain: "example.com", weekStart: MONDAY(7), measured: true },
    { domain: "example.com", weekStart: MONDAY(14), measured: true },
  ],
  firstDueOn: MONDAY(7),
  waiting: 0,
  next: new Date(Date.UTC(2026, 8, 16, 13, 0, 0)),
  stopped: null,
  noPublishCauses: {
    reachkit_stopped: false,
    publishing_paused: false,
    nothing_approved: false,
    nothing_planned: false,
  },
};

const facts = (over: Partial<ShellFacts>): ShellFacts => ({ ...BASE, ...over });

describe("REQ-040 c6/c7 — the model carries the domain and its measured weeks", () => {
  it("states the domain being measured and the counted weeks", () => {
    const shell = assembleShell(BASE);
    expect(shell.domain).toBe("example.com");
    expect(shell.weeks).toEqual({ kind: "counted", weeks: 2, lastMeasuredOn: MONDAY(14) });
  });

  it("a never-measured domain carries no count and the date its first measurement is due", () => {
    const shell = assembleShell(facts({ weeks: [], firstDueOn: MONDAY(21) }));
    expect(shell.weeks).toEqual({ kind: "none", firstDueOn: MONDAY(21) });
  });

  it("the zone every stated time is expressed in travels with the model (REQ-073 c1)", () => {
    expect(assembleShell(facts({ timeZone: "Europe/Dublin" })).timeZone).toBe("Europe/Dublin");
  });
});

describe("REQ-040 c2 — the waiting count", () => {
  it("carries the number of items waiting on the customer", () => {
    expect(assembleShell(facts({ waiting: 4 })).waiting).toBe(4);
  });

  it("is 0 when none wait — a number, not an absent field the renderer must guess about", () => {
    const shell = assembleShell(facts({ waiting: 0 }));
    expect(shell.waiting).toBe(0);
    expect(Object.hasOwn(shell, "waiting")).toBe(true);
  });
});

describe("REQ-040 c3 — the mode and the next scheduled publish", () => {
  it("a scheduled publish carries the mode and the time, and no reason", () => {
    const shell = assembleShell(facts({ mode: "copilot" }));
    expect(shell.publishing.mode).toBe("copilot");
    expect(shell.publishing.next).toEqual(new Date(Date.UTC(2026, 8, 16, 13, 0, 0)));
    expect(shell.publishing).not.toHaveProperty("because");
  });

  it("a scheduled publish outranks a cause that also happens to be true", () => {
    // The four causes describe why there is *no* publish. With one, there is
    // no reason to state — the time is the answer.
    const shell = assembleShell(
      facts({ noPublishCauses: { ...BASE.noPublishCauses, nothing_planned: true } })
    );
    expect(shell.publishing.next).not.toBeNull();
    expect(shell.publishing).not.toHaveProperty("because");
  });
});

describe("REQ-040 c4 — no publish scheduled carries exactly one resolved reason", () => {
  it("resolves by precedence, not by which cause the caller listed first", () => {
    const shell = assembleShell(
      facts({
        next: null,
        noPublishCauses: {
          reachkit_stopped: true,
          publishing_paused: true,
          nothing_approved: true,
          nothing_planned: true,
        },
      })
    );
    expect(shell.publishing).toEqual({ mode: "autopilot", next: null, because: "reachkit_stopped" });
  });

  it("nothing approved, alone, is the reason stated", () => {
    const shell = assembleShell(
      facts({
        next: null,
        noPublishCauses: { ...BASE.noPublishCauses, nothing_approved: true },
      })
    );
    expect(shell.publishing).toEqual({ mode: "autopilot", next: null, because: "nothing_approved" });
  });

  it("no time and no cause at all is ReachKit's own stop (ADR-061), never a blank", () => {
    // "An unattributed empty day is ReachKit's own stop." There is no arm of
    // PublishingState with neither a time nor a reason.
    const shell = assembleShell(facts({ next: null }));
    expect(shell.publishing).toEqual({ mode: "autopilot", next: null, because: "reachkit_stopped" });
  });
});

// ── REQ-092 c3 and c7 (issue #20) ───────────────────────────────────────
describe("REQ-092 — a stop is carried, and no publish is scheduled while it stands", () => {
  const STOP = {
    since: MONDAY(14),
    resumes: { promised: false },
    needs: { kind: "nothing" },
    partial: false,
  } as const;

  it("the model carries the stop, so every app screen can state it (c3)", () => {
    const shell = assembleShell(facts({ stopped: STOP }));
    expect(shell.stopped).toEqual(STOP);
  });

  it("with no stop the field is null — that is the whole of 'it stops stating it' (c3)", () => {
    expect(assembleShell(BASE).stopped).toBeNull();
  });

  it("a stop outranks a time still on the row: no publish is scheduled (c7)", () => {
    // The row says a publish is due on the 16th and ReachKit has stopped.
    // Carrying that time over would tell the customer the work is coming.
    const shell = assembleShell(facts({ stopped: STOP }));
    expect(shell.publishing).toEqual({ mode: "autopilot", next: null, because: "reachkit_stopped" });
  });

  it("a stop outranks every other cause that is also true (ADR-011)", () => {
    const shell = assembleShell(
      facts({
        next: null,
        stopped: STOP,
        noPublishCauses: { ...BASE.noPublishCauses, publishing_paused: true },
      })
    );
    expect(shell.publishing).toEqual({ mode: "autopilot", next: null, because: "reachkit_stopped" });
  });
});

describe("the provider is the one read, and it reads the fixture", () => {
  it("readShell() returns the model assembled from FIXTURE_SHELL_FACTS", async () => {
    await expect(readShell()).resolves.toEqual(assembleShell(FIXTURE_SHELL_FACTS));
  });

  it("the fixture's own state is a measured site with a scheduled publish", () => {
    const shell = assembleShell(FIXTURE_SHELL_FACTS);
    expect(shell.weeks.kind).toBe("counted");
    expect(shell.publishing.next).not.toBeNull();
    expect(shell.waiting).toBeGreaterThan(0);
  });

  it("the fixture does not move: two reads return the same values", async () => {
    const [a, b] = await Promise.all([readShell(), readShell()]);
    expect(a).toEqual(b);
  });
});
