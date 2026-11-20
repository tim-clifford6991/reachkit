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

const native = globalThis.fetch;
let state = { live: false, local: null as string | null };
const loopback = (host: string | undefined): boolean => state.local !== null && (host === "127.0.0.1" || host === "localhost" || host === "::1");

/** Anthropic's three paths, only inside a live transport send; the transport hands this to the SDK, so no other
 *  wrapper of the global `fetch` (the pass replay's) stands between them. */
export const anthropicFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (!state.live || armed === 0 || url.host !== HOST || url.protocol !== "https:" || !PATHS.has(url.pathname)) throw refuse(url.host);
  return native(input, init);
}) as typeof fetch;

/** `live` false allows no host; `live` true allows Anthropic's three paths and nothing else. `local`, an origin on
 *  this box (the pass replay's own database), is reachable in every mode. */
export function isolate(live: boolean, local: string | null = null): void {
  state = { live, local };
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (local !== null && url.origin === local) return realFetch(input, init);
    return anthropicFetch(input, init);
  }) as typeof fetch;
  const realLookup = dns.lookup;
  dns.lookup = ((host: string, ...rest: unknown[]) => {
    const done = rest.at(-1) as (error: Error) => void;
    if ((!live || host !== HOST) && !loopback(host)) return process.nextTick(() => done(refuse(host)));
    return (realLookup as (...a: unknown[]) => unknown)(host, ...rest);
  }) as typeof dns.lookup;
  const realResolve = dns.promises.lookup;
  dns.promises.lookup = ((host: string, ...rest: unknown[]) =>
    (!live || host !== HOST) && !loopback(host) ? Promise.reject(refuse(host)) : (realResolve as (...a: unknown[]) => unknown)(host, ...rest)) as typeof dns.promises.lookup;
  const realConnect = net.Socket.prototype.connect;
  // The wall under every client, whatever its lookup or address: a socket opens only during a live transport send,
  // or to this box's own loopback where the run named a local origin.
  net.Socket.prototype.connect = function (this: net.Socket, ...args: unknown[]) {
    const first = Array.isArray(args[0]) ? args[0][0] : args[0];
    const target = typeof first === "object" && first !== null ? (first as { host?: string; path?: string }) : { host: String(args[1] ?? "") };
    if ((!live || armed === 0) && !loopback(target.host ?? "localhost")) throw refuse(target.host ?? target.path ?? "socket");
    sockets += 1;
    return (realConnect as (...a: unknown[]) => net.Socket).apply(this, args);
  } as typeof net.Socket.prototype.connect;
}
