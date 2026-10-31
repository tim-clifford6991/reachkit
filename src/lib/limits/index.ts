// The one door to `take_rate_limits`: every abuse limit is counted in Postgres, so it holds across instances
// and cold starts. Keys are HMACs, so no raw email, address or id is stored. A dead limiter allows.
import { createHmac, hkdfSync } from "node:crypto";
import { env } from "@/lib/config/env";
import { dbAdmin } from "@/lib/db";
import type { NetworkKey } from "@/lib/scan/admission";

type KeyName = "network" | "email" | "scanId";

interface Limit {
  readonly key: KeyName;
  readonly windowS: number;
  readonly max: number;
}

const MINUTE_S = 60;
const HOUR_S = 60 * MINUTE_S;
const DAY_S = 24 * HOUR_S;

const RULES = {
  sign_in: [
    { key: "email", windowS: 15 * MINUTE_S, max: 3 },
    { key: "email", windowS: DAY_S, max: 10 },
    { key: "network", windowS: HOUR_S, max: 20 },
  ],
  lead: [
    { key: "email", windowS: DAY_S, max: 3 },
    { key: "network", windowS: HOUR_S, max: 10 },
    { key: "scanId", windowS: DAY_S, max: 5 },
  ],
  tool_check: [{ key: "network", windowS: HOUR_S, max: 30 }],
} as const satisfies Record<string, readonly Limit[]>;

export type LimitRule = keyof typeof RULES;

export interface LimitKeys {
  readonly network: NetworkKey;
  readonly email?: string;
  readonly scanId?: string;
}

interface RpcClient {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

/** Its own HKDF label, so a count key is never a key any other feature derives. */
const HKDF_INFO = "rate-limit-v1";
let hashSecret: Buffer | null = null;

function hashOf(name: KeyName, value: string): string {
  hashSecret ??= Buffer.from(hkdfSync("sha256", env.IP_HASH_SALT, "", HKDF_INFO, 32));
  const normal = name === "email" ? value.trim().toLowerCase() : value;
  return createHmac("sha256", hashSecret).update(`${name}:${normal}`).digest("hex");
}

/** Counts this attempt against every limit of `rule` the request has a key for; `false` once any is over. */
export async function takeLimits(rule: LimitRule, keys: LimitKeys): Promise<boolean> {
  const limits = RULES[rule].flatMap((limit) => {
    const value = keys[limit.key];
    return value === undefined ? [] : [{ ...limit, hash: hashOf(limit.key, value) }];
  });
  try {
    const { data, error } = await (dbAdmin() as unknown as RpcClient).rpc("take_rate_limits", {
      p_scopes: limits.map((l) => `${rule}.${l.key}.${l.windowS}`),
      p_keys: limits.map((l) => l.hash),
      p_window_s: limits.map((l) => l.windowS),
      p_max: limits.map((l) => l.max),
    });
    if (error === null && typeof data === "boolean") return data;
  } catch {
    // Falls through to the log line below; the cause can carry request detail.
  }
  console.warn(JSON.stringify({ event: "rate_limit_unavailable", rule }));
  return true;
}
