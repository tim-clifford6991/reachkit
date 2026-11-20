// Spent, left and calls by model, read from the ledger alone: the daily comment on the evaluation issue.
import config from "./models.json";
import { readRows, spentCents } from "./ledger";

export function report(file: string): string {
  const rows = readRows(file);
  const spent = spentCents(rows);
  const byModel = new Map<string, { calls: number; cents: number; refused: number; failed: number }>();
  for (const row of rows) {
    const model = byModel.get(row.model) ?? { calls: 0, cents: 0, refused: 0, failed: 0 };
    if (row.kind === "settle") {
      model.calls += 1;
      model.cents += row.cents;
      if (row.outcome !== "answered") model.failed += 1;
    }
    if (row.kind === "refused") model.refused += 1;
    byModel.set(row.model, model);
  }
  const cents = (n: number) => `${(n / 100).toFixed(2)}`;
  return [
    `Spent $${cents(spent)} of $${cents(config.capCents)}; left $${cents(config.capCents - spent)}. Ledger: ${file}`,
    "",
    "| Model | Calls | Spent | Failed | Refused |",
    "|---|---|---|---|---|",
    ...[...byModel].map(([model, m]) => `| ${model} | ${m.calls} | $${cents(m.cents)} | ${m.failed} | ${m.refused} |`),
  ].join("\n");
}
