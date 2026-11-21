// src/lib/egress/deadline.ts — a fetch that gives up after `ms`, for a fixed-host client that must not wait forever.

/** `fetch`, aborted after `ms` as well as on the caller's own signal. */
export function fetchWithin(ms: number): typeof fetch {
  return (input, init) => {
    const deadline = AbortSignal.timeout(ms);
    return fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, deadline]) : deadline });
  };
}
