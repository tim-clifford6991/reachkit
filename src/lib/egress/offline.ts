// src/lib/egress/offline.ts — refuse every network call this process would
// make. The test corpus installs it for every test (`tests/setup.ts`), and
// the production re-score runs each of its computations inside `offline`
// (issue 1433), so neither can reach a vendor, a model or a site: a call
// throws, naming `who` and the door it tried.
import dns from "node:dns";
import http from "node:http";
import https from "node:https";

/** Refuses the network until the returned function puts it back. */
export function refuseNetwork(who: string, advice: string): () => void {
  const refuse = (via: string): never => {
    throw new Error(`${who}: a real network call was attempted via ${via}. ${advice}`);
  };
  const saved = {
    fetch: globalThis.fetch,
    resolveNs: dns.promises.resolveNs,
    http: { request: http.request, get: http.get },
    https: { request: https.request, get: https.get },
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
  return () => {
    globalThis.fetch = saved.fetch;
    dns.promises.resolveNs = saved.resolveNs;
    Object.assign(http, saved.http);
    Object.assign(https, saved.https);
  };
}

/**
 * Runs `body` with the network refused, and puts it back after. `body` must
 * be synchronous: inside one synchronous run no other request's code can
 * run, so a server process that serves other requests can refuse the
 * network for this one computation and no one else's.
 */
export function offline<T>(who: string, advice: string, body: () => T): T {
  const restore = refuseNetwork(who, advice);
  try {
    const out = body();
    if (out instanceof Promise) throw new Error(`${who}: offline() runs synchronous work only.`);
    return out;
  } finally {
    restore();
  }
}
