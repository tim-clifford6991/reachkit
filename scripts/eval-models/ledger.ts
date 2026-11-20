// The evaluation's own money, outside production's `fetches` caps: a reserve row before each send, a settle row after.
// The total counts a reservation that never settled as spent, so a crash can only overstate what was used.
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, unlinkSync, writeSync } from "node:fs";
import path from "node:path";
import config from "./models.json";

/** ¢ per million tokens, read off `source` on `checkedAt`; a price with neither is not used. */
export type ModelPrice = { in: number; out: number; longAbove?: number; longIn?: number | null; longOut?: number | null; source?: string; checkedAt?: string };
export type Row =
  | { kind: "reserve"; id: string; at: string; model: string; site: string; cents: number }
  | { kind: "settle"; id: string; at: string; model: string; site: string; cents: number; tokensIn: number | null; tokensOut: number | null; ms: number; stop: string | null; outcome: string }
  | { kind: "refused"; id: string; at: string; model: string; site: string; cents: number; why: string };

export const HARD_CAP_CENTS = config.capCents - config.marginCents;

/** Cents for the tokens at the model's list price, or `null` where the price for that prompt size is not known or the
 *  price says nowhere where it was read. */
export function priceCents(price: ModelPrice, tokensIn: number, tokensOut: number): number | null {
  if (!price.source || !price.checkedAt) return null;
  const long = price.longAbove !== undefined && tokensIn > price.longAbove;
  const inRate = long ? price.longIn : price.in;
  const outRate = long ? price.longOut : price.out;
  if (inRate == null || outRate == null) return null;
  return (tokensIn * inRate + tokensOut * outRate) / 1_000_000;
}

export function readRows(file: string): Row[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8").split("\n").filter((line) => line.trim() !== "").map((line) => JSON.parse(line) as Row);
}

/** Settled cents, plus every reservation with no settle row. */
export function spentCents(rows: readonly Row[]): number {
  const settled = new Map<string, number>();
  for (const row of rows) if (row.kind === "settle") settled.set(row.id, row.cents);
  return rows.reduce((sum, row) => (row.kind === "reserve" ? sum + (settled.get(row.id) ?? row.cents) : sum), 0);
}

export class Ledger {
  private rows: Row[];
  private fd: number;
  private next = 0;
  readonly limitCents: number;

  constructor(readonly file: string, capCents: number, private readonly enforceUntil: boolean) {
    mkdirSync(path.dirname(file), { recursive: true });
    const lock = `${file}.lock`;
    try {
      closeSync(openSync(lock, "wx"));
    } catch {
      throw new Error(`${lock} exists: another run holds this ledger, or one died. Delete it once no run is going.`);
    }
    process.on("exit", () => existsSync(lock) && unlinkSync(lock));
    this.rows = readRows(file);
    this.fd = openSync(file, "a");
    this.limitCents = Number.isFinite(capCents) && capCents >= 0 ? Math.min(capCents, HARD_CAP_CENTS) : HARD_CAP_CENTS;
  }

  spent(): number {
    return spentCents(this.rows);
  }

  private write(row: Row): void {
    writeSync(this.fd, `${JSON.stringify(row)}\n`);
    fsyncSync(this.fd);
    this.rows.push(row);
  }

  /** The call's id, or a refusal row's reason when the reservation would pass the cap or the deadline. */
  reserve(model: string, site: string, cents: number | null): { id: string } | { refused: string } {
    const id = `${process.pid}-${Date.now()}-${this.next++}`;
    const at = new Date().toISOString();
    const why =
      cents === null || !Number.isFinite(cents) ? "unpriced"
      : !Number.isFinite(this.limitCents) ? "cap"
      : this.enforceUntil && Date.now() > Date.parse(config.until) ? "deadline"
      : this.spent() + cents > this.limitCents ? "cap"
      : null;
    if (why !== null) {
      this.write({ kind: "refused", id, at, model, site, cents: cents ?? 0, why });
      return { refused: why };
    }
    this.write({ kind: "reserve", id, at, model, site, cents: cents as number });
    return { id };
  }

  settle(row: Omit<Extract<Row, { kind: "settle" }>, "kind" | "at">): void {
    this.write({ kind: "settle", at: new Date().toISOString(), ...row });
  }
}
