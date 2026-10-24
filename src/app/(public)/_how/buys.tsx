// What the one plan buys, as figures: Pricing and the landing draw the same tiles.
// The guarantee tile waits for the launch gate (owner 2026-10-20, Q13).
import type React from "react";
import { WEEK_PLAN } from "@/lib/config/constants";
import { copy } from "@/lib/presentation/copy";
import { HOW_FACTS as F } from "./facts";

export function PlanBuys(): React.JSX.Element {
  const tiles = [
    [copy("pricing.buys.pages", { weekPages: WEEK_PLAN.days }), copy("pricing.buys.pages.what")],
    [copy("pricing.buys.rivals", { rivals: F.rivals }), copy("pricing.buys.rivals.what")],
    [copy("pricing.buys.mail"), copy("pricing.buys.mail.what")],
    [copy("pricing.buys.time", { minutes: F.setupMinutes }), copy("pricing.buys.time.what")],
  ] as const;
  const label = copy("pricing.buys", { price: copy("price.amount") });
  return (
    <div className="flex flex-col gap-3">
      <p className="eyebrow">{label}</p>
      <ul aria-label={label} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(([value, what]) => (
          <li key={value} className="card card-border bg-base-100 min-w-0 gap-1 p-4">
            <span className="num text-xl font-bold">{value}</span>
            <span className="text-base-content/70 text-sm">{what}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
