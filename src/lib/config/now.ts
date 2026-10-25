// BUILD §15 — the one clock the render path reads.
//
// Every module under `src/lib/` takes its `now` as an argument: "no clock is
// read here" is written into a dozen headers, and it is what makes the engine
// testable. The surfaces are where a clock had to be read, and each of them
// read `new Date()` for itself. This module is that read, named once.
//
// **Why one instant.** Overview draws a twelve-week window ending at this week
// and `/app/calendar` marks today's cell, so a test seed written against the
// wall clock drifts out of what the screens draw. Pinning the seed alone walks
// its weeks out of the window. So one instant is read by both halves: the seed
// writes its weeks against it and the render path reads the same value back.
//
// **`RK_FIXED_NOW` is not a deployment binding, which is why it is not in
// `env.ts`.** That schema requires every member, with no default and no
// fallback, so a deployment cannot start half-configured.
// This is the opposite kind of thing: a binding a real deployment must never
// carry. It is honoured only where the deployment is not real, and
// `assertClockBinding()` — called from `src/instrumentation.ts`, the one boot
// path — refuses the boot outright when a real deployment sets it. A
// production build cannot serve a frozen clock: it does not start.
//
// **What "not real" means, and why it fails closed.** A deployment is real
// when it runs on the platform (`VERCEL`, set on every Vercel build and
// runtime) or when it tells customers to reach it at an address that is not
// this machine (`NEXT_PUBLIC_APP_URL`'s host is not a loopback name). Both
// are read here as raw strings rather than through `env`: `env` parses the
// deployment's whole contract and throws on any missing member, and this
// question has to be answerable on a half-configured process too — that is
// where an unset or unparsable app URL counts as **real**, so the refusal is
// what happens when the answer is not clear.
//
// No caching: the value is read on every call, so a test can change it
// without a module reset, and the cost is one `process.env` lookup and one
// date parse against reads that touch a database.

/** The binding, named once. */
export const FIXED_NOW_BINDING = "RK_FIXED_NOW";

/** A `RK_FIXED_NOW` that a real deployment set. The boot refuses it, so no
 *  instance that carries one ever answers a request. */
export class FixedClockRefused extends Error {
  constructor(reason: "real-deployment" | "unparsable") {
    super(
      reason === "real-deployment"
        ? `${FIXED_NOW_BINDING} is set on a real deployment. It is a test binding: ` +
            "it freezes what every surface calls today, so a deployment carrying one " +
            "would serve a date that is not the date. Unset it."
        : `${FIXED_NOW_BINDING} is set but is not an instant this runtime can read. ` +
            "Expected something `new Date(...)` parses, such as 2026-09-08T12:00:00.000Z."
    );
    this.name = "FixedClockRefused";
  }
}

/** Whether this process is a deployment customers reach. Fails closed — see
 *  the header: an app URL that is absent or unparsable answers `true`. */
export function isRealDeployment(): boolean {
  if (process.env.VERCEL !== undefined) return true;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl === undefined) return true;
  try {
    const { hostname } = new URL(appUrl);
    return hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "[::1]";
  } catch {
    return true;
  }
}

/**
 * The frozen instant in force, or `null` where the clock is the wall clock.
 *
 * `null` on a real deployment even when the binding is set: the boot has
 * already refused such a process, and a reader that fell back to the binding
 * anyway would make this module's promise depend on the boot having run.
 */
export function fixedNow(): Date | null {
  const raw = process.env[FIXED_NOW_BINDING];
  if (raw === undefined || raw === "") return null;
  if (isRealDeployment()) return null;
  const at = new Date(raw);
  return Number.isNaN(at.getTime()) ? null : at;
}

/**
 * What every surface means by "now".
 *
 * The render path calls this and nothing else; `src/lib/**` still takes its
 * `now` as an argument, so the engine is unchanged and one call site per
 * surface decides what the argument is.
 */
export function now(): Date {
  return fixedNow() ?? new Date();
}

/** The Europe/Berlin calendar day of `at`, as `YYYY-MM-DD`: the owner's day, whatever the server's zone. */
export function berlinDay(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/**
 * The boot invariant. Throws when `RK_FIXED_NOW` is set on a
 * real deployment, and when it is set to something that is not an instant.
 *
 * Silent otherwise: a process with no binding is the ordinary case, and one
 * that legitimately carries a frozen clock has already said so by being a
 * local build.
 */
export function assertClockBinding(): void {
  const raw = process.env[FIXED_NOW_BINDING];
  if (raw === undefined || raw === "") return;
  if (isRealDeployment()) throw new FixedClockRefused("real-deployment");
  if (Number.isNaN(new Date(raw).getTime())) throw new FixedClockRefused("unparsable");
}
