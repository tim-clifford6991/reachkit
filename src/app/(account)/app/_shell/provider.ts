// BUILD §4.4 — the one read the shell makes.
//
// The typed seam WO-154 calls `readShell`. Every app screen's layout calls
// it and nothing else; what it reads behind the type is now the signed-in
// account's own rows (`store.ts`) and this issue's fixture (`fixture.ts`)
// for the reserved fixture account and nothing else — one request-cached
// read, no second caller, no second shape.
//
// **Which account.** The session's, through `_session/account.ts` (issue
// #169). A request with no session never reaches the store: `readShell`
// asks `requireSetUpAccount()` first, which answers §4.3's refusal — back
// to `/signin`, saying nothing about whether an account or a payment
// exists (REQ-020 c5) — and a session whose account has not finished setup
// goes to `/setup` rather than being drawn with facts it has not stated
// yet.
//
// **The fixture answers for the reserved fixture account and nothing
// else.** `example.com` is IANA-reserved and can never be a customer's
// domain (DECISIONS 2026-09-06: "`*.example.com` fixtures answer only for
// reserved names"), so "a real site never reaches the fixture" is a fact
// about the name rather than a flag someone has to remember to unset. The
// two are different branches of one `if`, and the branch a customer takes
// reads rows or reads nothing.
//
// **`./store` is reached through `await import`, and that is not style.**
// It resolves `@/lib/db`, which parses the deployment's own bindings at
// module load. The reserved fixture account's shell reaches no database at
// all, and a static import would make rendering it — in the layout
// conformance build, the presentation sweeps and `next build`'s own
// page-data collection — depend on bindings it never uses. The same reason
// `calendar/provider.ts` and `settings/provider.ts` defer theirs.
//
// `React.cache` is what makes it one read per request even though the
// layout, the sidebar and the tab bar each ask: the layout asks once and
// passes the model down today, and a later screen that asks again gets the
// same object rather than a second query.
import { cache } from "react";
import { isReservedFixtureAccount, requireSetUpAccount } from "../_session/account";
import { assembleShell, type ShellModel } from "./model";
import { FIXTURE_SHELL_FACTS } from "./fixture";

export const readShell = cache(async function readShell(): Promise<ShellModel> {
  const account = await requireSetUpAccount();
  if (isReservedFixtureAccount(account)) return assembleShell(FIXTURE_SHELL_FACTS);

  const { readShellFacts } = await import("./store");
  return assembleShell(
    await readShellFacts({
      siteId: account.siteId,
      domain: account.domain,
      timeZone: account.timeZone,
      mode: account.mode,
      createdAt: account.createdAt,
    })
  );
});
