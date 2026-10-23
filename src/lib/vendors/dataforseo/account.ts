// SPEC §6. The account's balance and total deposits in US cents, from the free `GET /v3/appendix/user_data`.
// `src/lib/costs/vendor-days.ts` reads a day's bill as the balance's fall, deposits added back.
// Outside the cost seam on purpose, like `locations.ts`: nothing is bought.
import { sendGet } from "./transport";

export interface AccountReading {
  balanceCents: number;
  depositedCents: number;
}

const cents = (usd: number): number => Math.round(usd * 100 * 10000) / 10000;

/** The vendor's answer as a reading, or `null` where it carries no balance. */
export function accountReadingOf(payload: unknown): AccountReading | null {
  const money = (payload as { tasks?: { result?: { money?: { balance?: unknown; total?: unknown } }[] }[] } | null)?.tasks?.[0]?.result?.[0]
    ?.money;
  const balance = money?.balance;
  const deposited = money?.total;
  if (typeof balance !== "number" || !Number.isFinite(balance) || typeof deposited !== "number" || !Number.isFinite(deposited)) return null;
  return { balanceCents: cents(balance), depositedCents: cents(deposited) };
}

/** One reading, or `null` where the vendor did not answer with one. */
export async function readAccount(): Promise<AccountReading | null> {
  const got = await sendGet<unknown>("/v3/appendix/user_data");
  return got.ok ? accountReadingOf(got.payload) : null;
}
