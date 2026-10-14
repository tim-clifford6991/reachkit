// src/lib/egress/offline.ts — refuse every network call this process would
// make. The test corpus installs it for every test (`tests/setup.ts`), and
// `npm run rescore` before it reads a stored scan (issue 1426), so neither
// can reach a vendor, a model or a site: a call throws, naming `who` and the
// door it tried.
import dns from "node:dns";
import http from "node:http";
import https from "node:https";

export function refuseNetwork(who: string, advice: string): void {
  const refuse = (via: string): never => {
    throw new Error(`${who}: a real network call was attempted via ${via}. ${advice}`);
  };
  globalThis.fetch = (() => refuse("fetch()")) as unknown as typeof fetch;
  // Issue 760: the NS lookup beside the CNAME record is real DNS traffic.
  dns.promises.resolveNs = (() => refuse("dns.promises.resolveNs()")) as unknown as typeof dns.promises.resolveNs;
  for (const [mod, name] of [
    [http, "http"],
    [https, "https"],
  ] as const) {
    mod.request = (() => refuse(`${name}.request()`)) as unknown as typeof mod.request;
    mod.get = (() => refuse(`${name}.get()`)) as unknown as typeof mod.get;
  }
}
