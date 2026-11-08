// BUILD §15 — the application's one boot path.
//
// Next calls `register()` **once** when a server instance is initiated, and
// it must complete before that instance handles a request
// (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md`).
// That is the shape BP-005 asks for and `src/lib/config/env.ts` states in
// its own header: "a deployment cannot start half-configured".
//
// **Why the instrumentation hook and not the jobs `serve()` bootstrap.**
// `serve()` is not a separate process: `src/jobs/index.ts` is mounted by
// `src/app/api/jobs/[[...slug]]/route.ts`, one route inside this same Next
// application. Wiring the assertion there would run it when that route's
// module is first loaded, which is neither "at boot" nor everywhere — the
// surfaces that take a payment (`/pricing`, `/api/stripe/webhook`) can be
// served by an instance that never loads the jobs route. It would also put
// an engine-configuration check inside a transport adapter, which
// ARCHITECTURE rule 1 forbids. The hook runs for
// every surface, once, before any of them answers.
//
// **What fails the boot, and what does not.** Boot asks nothing of any
// vendor and loads no mail or publishing module: every check below is local.
//
//  - A binding that does not parse throws out of `register()` — `env` is
//    local, needs nobody, and is BP-005's own promise.
//  - **A real deployment carrying no jobs bindings** throws out of
//    `register()` (issue #315). `INNGEST_SIGNING_KEY` and
//    `INNGEST_EVENT_KEY` are what let the platform verify a delivery to
//    `/api/jobs` and let this process put work on the queue; without them
//    the hourly ticks never run, and the failure is silent — every screen
//    still renders, and nothing publishes. It is a fact this deployment can
//    establish about itself, needing no vendor, so it is asserted like the
//    clock binding and fails the boot. `assertJobsBindings()` is silent
//    where the process is not a deployment (a local build, the layout
//    suite's server), which is where no job is ever triggered.
//  - **Billing's access gate not taking** throws out of `register()`
//    (issue #180). ADR-050 puts "who has active access" in billing, and
//    `src/lib/scan/weekly/access.ts` throws while nothing is registered
//    rather than guess — so a deployment that boots without the
//    registration cannot run a Monday tick for any customer. Registering
//    is local and needs nobody, so it is asserted like `env`.
//  - **The spend seam's alert sink not being registered** is registered
//    here and does not throw (issue #329). `src/lib/costs/daily.ts`
//    publishes a crossing of the product's daily ceiling and cannot reach
//    `src/lib/mail` itself (ARCHITECTURE rule 2 puts costs at the bottom
//    of the dependency order), so boot is what introduces them, through a
//    forwarder that loads the mail module on the first alert. Nothing
//    registered costs the owner an alert and costs the product nothing:
//    the ceiling refuses and holds whether or not anybody is told.
//  - **The deleted-account mail's WordPress place port not being wired**
//    is registered here and does not throw (issue #160). The seam in
//    `src/lib/account/lifecycle/left-in-wordpress.ts` answers "no place"
//    while nothing is registered, which is a true answer rather than a
//    broken one — every sentence still carries its count — so an
//    unregistered port costs one mail its link and nothing else. Its
//    `place` loads the WordPress destination on first use.
//  - **The price is not checked here.** The production build refuses a
//    crossed Stripe price (`scripts/check-price.mjs`, npm's `prebuild`), so
//    a crossed deployment never reaches READY and no boot waits on Stripe.
//
// The module holds no invariant of its own — it calls the ones each module
// owns, and `local/instrumentation-imports` holds what it may load.

/** One structured line, the shape `src/app/api/_log.ts` uses. Every field
 *  is a name from a closed set — never a binding's value. */
function log(
  check: BootCheck,
  outcome: "checked" | "refused",
  reason?: string
): void {
  const line = { event: "boot_invariants", check, outcome, ...(reason === undefined ? {} : { reason }) };
  if (outcome !== "checked") console.error(JSON.stringify(line));
  else console.log(JSON.stringify(line));
}

/**
 * Next's boot hook. Called in every runtime, so the work is guarded on the
 * Node.js one: the assertions read server-only bindings, which do not belong
 * in an edge bundle. The imports are inside the guard for the same reason —
 * the guide's own recommendation, and here it is load-bearing.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Issue 330: a refused boot is visible in the deployment log with a
  // one-line cause — the check and the error's class, never its message —
  // and, on a real deployment, told to `OWNER_EMAILS`. Then it is rethrown:
  // telling the owner never lets the deployment start.
  const current: { check: BootCheck } = { check: "clock" };
  try {
    await assertInvariants(current);
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "unknown";
    log(current.check, "refused", errorName);
    await tellOwnersOfRefusal(current.check, errorName);
    throw error;
  }
}

type BootCheck = "access-gate" | "stamp-place" | "clock" | "jobs" | "spend-alerts";

/** Never throws: a boot refused because `env` does not parse cannot reach
 *  the mail seam at all, and the log line above is then the whole telling. */
async function tellOwnersOfRefusal(check: BootCheck, errorName: string): Promise<void> {
  try {
    const { isRealDeployment } = await import("@/lib/config/now");
    if (!isRealDeployment()) return;
    const { reportIncident } = await import("@/lib/mail/ops");
    await reportIncident({ occasion: "boot-refused", check, errorName });
  } catch {
    console.error(JSON.stringify({ event: "ops_incident_alert", occasion: "boot-refused", outcome: "unreachable" }));
  }
}

async function assertInvariants(current: { check: BootCheck }): Promise<void> {
  // The clock binding, before anything else asserts anything (issue #305).
  // `RK_FIXED_NOW` freezes what every surface calls today — it is what lets
  // the layout sweep photograph screens whose content is a function of the
  // date — and a real deployment carrying one would serve a date that is not
  // the date. It is local and needs nobody, so it is asserted like `env`:
  // the process does not start.
  current.check = "clock";
  const { assertClockBinding } = await import("@/lib/config/now");
  assertClockBinding();
  log("clock", "checked");

  // The jobs bindings, next and for the same reason (issue #315): local,
  // needing nobody, and about whether this process may run at all rather
  // than about anything a vendor answers. It sits beside the clock check
  // because both ask the same question of the environment — is this a real
  // deployment, and is it configured like one.
  current.check = "jobs";
  const { assertJobsBindings } = await import("@/lib/config/env");
  assertJobsBindings();
  log("jobs", "checked");

  // ADR-050's gate: local and needing nobody. Imported by file, since the
  // billing barrel loads the mail and the payment vendor's SDK.
  current.check = "access-gate";
  const { installActiveAccessGate } = await import("@/lib/account/billing/access-gate");
  await installActiveAccessGate();
  log("access-gate", "checked");

  // ADR-083 Decision 4's port; the WordPress destination loads on first use.
  current.check = "stamp-place";
  const { setStampCapability } = await import("@/lib/account/lifecycle/left-in-wordpress");
  setStampCapability({ place: async (destinationId) => (await wordpressPlace()).stampPlace(destinationId) });
  log("stamp-place", "checked");

  // The cost seam's crossings, introduced to the side that can mail them.
  // Synchronous, as the seam expects: the mail module loads on the first
  // alert and the send is started, never awaited.
  current.check = "spend-alerts";
  const { registerLedgerUnreadableSink, registerSpendAlertSink } = await import("@/lib/costs/sinks");
  registerSpendAlertSink((alert) => {
    opsMail().then((ops) => ops.spendAlertSink(alert), (error: unknown) => alertNotLoaded(alert.crossed, error));
  });
  registerLedgerUnreadableSink((unreadable) => {
    opsMail().then((ops) => ops.ledgerUnreadableSink(unreadable), (error: unknown) => alertNotLoaded("unreadable", error));
  });
  log("spend-alerts", "checked");
}

/** Loaded on the first alert, never at boot. */
function opsMail(): Promise<typeof import("@/lib/mail/ops")> {
  return import("@/lib/mail/ops");
}

/** Loaded on the first deleted-account mail that asks, never at boot. */
function wordpressPlace(): Promise<typeof import("@/lib/publish/destinations/wordpress/stamp-place")> {
  return import("@/lib/publish/destinations/wordpress/stamp-place");
}

/** The same line the seam logs for a sink that throws. */
function alertNotLoaded(crossed: string, error: unknown): void {
  console.warn(JSON.stringify({ event: "spend_alert_failed", crossed, detail: String(error) }));
}
