// The run's network: Anthropic's messages, token-count and model-list paths when live, nothing at all otherwise.
// Any other host throws `EvalIsolation` before a socket opens, so no DataForSEO or Supabase call can leave the box.
import dns from "node:dns";
import net from "node:net";

const HOST = "api.anthropic.com";
const PATHS = new Set(["/v1/messages", "/v1/messages/count_tokens", "/v1/models"]);

export class EvalIsolation extends Error {
  constructor(readonly host: string) {
    super(`eval isolation: ${host} is not reachable from this run`);
    this.name = "EvalIsolation";
  }
}

export const blocked: string[] = [];
let sockets = 0;
export const socketsOpened = (): number => sockets;
let armed = 0;

/** Anthropic is reachable only inside this, which only the eval transport calls: an SDK the swap missed sends nothing. */
export async function throughTransport<T>(send: () => Promise<T>): Promise<T> {
  armed += 1;
  try {
    return await send();
  } finally {
    armed -= 1;
  }
}

function refuse(host: string): EvalIsolation {
  blocked.push(host);
  return new EvalIsolation(host);
}

/** `live` false allows no host; `live` true allows Anthropic's three paths and nothing else. */
export function isolate(live: boolean): void {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (!live || armed === 0 || url.host !== HOST || url.protocol !== "https:" || !PATHS.has(url.pathname)) throw refuse(url.host);
    return realFetch(input, init);
  }) as typeof fetch;
  const realLookup = dns.lookup;
  dns.lookup = ((host: string, ...rest: unknown[]) => {
    const done = rest.at(-1) as (error: Error) => void;
    if (!live || host !== HOST) return process.nextTick(() => done(refuse(host)));
    return (realLookup as (...a: unknown[]) => unknown)(host, ...rest);
  }) as typeof dns.lookup;
  const realResolve = dns.promises.lookup;
  dns.promises.lookup = ((host: string, ...rest: unknown[]) =>
    !live || host !== HOST ? Promise.reject(refuse(host)) : (realResolve as (...a: unknown[]) => unknown)(host, ...rest)) as typeof dns.promises.lookup;
  const realConnect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (this: net.Socket, ...args: unknown[]) {
    sockets += 1;
    return (realConnect as (...a: unknown[]) => net.Socket).apply(this, args);
  } as typeof net.Socket.prototype.connect;
}
