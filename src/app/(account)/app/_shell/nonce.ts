// Issue #331, read a second time (#911) — this request's CSP nonce.
//
// `src/middleware.ts` mints a nonce per request and sets it on the
// `Content-Security-Policy` header it forwards; the root layout reads it
// back off that header to stamp the theme script. The shell's own inline
// script (`drawer.ts`) needs the same nonce for the same reason, and reads
// it the same way rather than being handed a second header
// (`src/middleware.ts`: "an unread header is a claim nothing checks").
//
// **It answers `undefined` outside a request, deliberately.** Layouts are
// rendered directly by several suites — the shell's own, the presentation
// sweeps, the stopped-work sweep — with no request store behind them, and
// `headers()` throws there. Outside a request there *is* no nonce, and a
// script tag with no nonce is exactly what a policy with no nonce expects;
// the alternative is a frame that cannot be rendered by a test at all.
import { headers } from "next/headers";

const NONCE = /'nonce-([A-Za-z0-9+/_-]+={0,2})'/;

export async function cspNonce(): Promise<string | undefined> {
  try {
    const policy = (await headers()).get("content-security-policy") ?? "";
    return NONCE.exec(policy)?.[1];
  } catch {
    return undefined;
  }
}
