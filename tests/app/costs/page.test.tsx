// /app/costs as board AppCosts draws it: the rows a week of the ledger holds,
// read through the page the owner opens, in the board's sections, order and
// words. The shell's own strings are the layout's, not this page's.
import "../../generate/env";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { parse } from "node-html-parser";
import { boardFile, compare, readAllow, segments } from "../../../scripts/design/parity.mjs";

const { tables } = vi.hoisted(() => ({ tables: new Map<string, unknown[]>() }));

/** Each table answers its rows, whatever the filter. */
vi.mock("@/lib/db", () => {
  const query = (table: string) => {
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "gte", "in", "or", "limit"]) builder[method] = () => builder;
    builder.then = (resolve: (value: unknown) => unknown) => resolve({ data: tables.get(table) ?? [], error: null });
    return builder;
  };
  return { dbAdmin: () => ({ from: query }) };
});

const { env } = await import("@/lib/config/env");
const { PLAN_NET_EUR_CENTS } = await import("@/lib/config/constants");
const { copy } = await import("@/lib/presentation/copy");
const { default: CostsPage } = await import("@/app/(account)/app/costs/page");
const { LIVE_ACCOUNT, resetAccount, signedInAs } = await import("../account-door");

/** The board's week: judged euros a day, Tuesday 13 to Monday 19 October. */
const WEEK = { "2026-10-13": 0.88, "2026-10-14": 2.31, "2026-10-15": 0.92, "2026-10-16": 1.58, "2026-10-17": 0.71, "2026-10-18": 0.64, "2026-10-19": 1.12 };
const USD_CENTS_PER_EUR = 112.06;

function row(day: string, eur: number, who: { site_id: string | null; segment: string | null }) {
  const cents = Math.round(eur * USD_CENTS_PER_EUR * 100) / 100;
  return { day, ...who, vendor: "dataforseo", activity: who.site_id === null ? "free_scan" : "weekly", calls: 10, estimated_cents: cents, billed_cents: cents, billed_calls: 9, judged_cents: cents, failed_calls: 0, timeout_calls: 0 };
}

let html = "";

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-19T12:00:00Z"));
  tables.set("users", [{ email: env.OWNER_EMAILS[0] }]);
  tables.set("sites", [{ id: "harbor", domain: "harborplumbing.example" }]);
  tables.set("cost_site_day", [
    ...Object.entries(WEEK).map(([day, eur]) => row(day, eur * 0.8, { site_id: "harbor", segment: null })),
    ...Object.entries(WEEK).map(([day, eur]) => row(day, eur * 0.2, { site_id: null, segment: "free" })),
    { ...row("2026-10-19", 0, { site_id: null, segment: "smoke" }), activity: "smoke", estimated_cents: 4.2, billed_cents: null, billed_calls: 0 },
  ]);
  tables.set("vendor_days", [{ vendor: "stripe", day: "2026-09-01", kind: "fixed", domain: "", billed_cents: 99, currency: "eur", estimated_cents: null }]);
  signedInAs(LIVE_ACCOUNT);
  html = renderToStaticMarkup(await CostsPage());
});

afterAll(() => {
  vi.useRealTimers();
  resetAccount();
});

function at(text: string): number {
  const i = html.indexOf(text);
  expect(i, text).toBeGreaterThan(-1);
  return i;
}

describe("/app/costs against board AppCosts", () => {
  it("leads as the board: owner only, the week's last day written out", () => {
    expect(at(copy("overview.costs.eyebrow"))).toBeLessThan(at(">Costs</h1>"));
    at(">The seven UTC days to Monday 19 October.</p>");
  });

  it("draws the sections in the board's order", () => {
    const order = [
      "Today against the cap",
      'data-testid="costs-week-figures"',
      'data-testid="costs-cap"',
      'data-testid="costs-week"',
      'data-testid="costs-days"',
      'data-testid="costs-activities"',
      'data-testid="costs-vendors"',
      'data-testid="costs-fixed"',
    ].map(at);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    at(">warning at €1.50</p>");
    at("A month, against €49");
  });

  it("marks the warning on the today bar at its share of the cap", () => {
    const bar = parse(html).querySelector('[data-testid="costs-today-bar"]')!;
    expect(bar.querySelector("progress")).not.toBeNull();
    expect(bar.querySelector('[data-testid="costs-today-warn"]')!.getAttribute("style")).toContain("left:75%");
  });

  it("puts estimated and billed in one This week card, each the sum of the ledger's rows", () => {
    const card = html.slice(at('data-testid="costs-week-figures"'), at('data-testid="costs-cap"'));
    const rows = tables.get("cost_site_day") as { estimated_cents: number; billed_cents: number | null; calls: number; billed_calls: number }[];
    const sum = (pick: (r: (typeof rows)[number]) => number) => rows.reduce((n, r) => n + pick(r), 0);
    const cents = (n: number) => `${new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}¢`;
    expect(card).toContain(">This week</p>");
    expect(card).toContain(`>${cents(sum((r) => r.estimated_cents))}</p>`);
    expect(card).toContain(">estimated, our price list</p>");
    expect(card).toContain(`>${cents(sum((r) => r.billed_cents ?? 0))}</p>`);
    expect(card).toContain(`>billed, on ${sum((r) => r.billed_calls)} of ${sum((r) => r.calls)} calls</p>`);
  });

  it("stacks the site table on a phone: no heads, the month behind its own label, no dash for a row it does not apply to", () => {
    const week = parse(html).querySelector('[data-testid="costs-week"]')!;
    const table = week.querySelector("table")!;
    const classes = table.getAttribute("class")!.split(/\s+/);
    for (const cls of ["max-sm:block", "max-sm:[&_thead]:hidden", "max-sm:[&_tr]:block", "max-sm:[&_td]:block"]) expect(classes, cls).toContain(cls);
    const rows = table.querySelectorAll("tbody tr");
    const site = rows.find((r) => r.text.includes("harborplumbing"))!;
    const label = site.querySelectorAll("td").at(-1)!.querySelector(".sm\\:hidden")!;
    expect(label.text).toBe("Month vs €49");
    const free = rows.find((r) => r.text.includes("Free scans"))!.querySelectorAll("td").at(-1)!;
    expect(free.text).toBe("—");
    expect(free.classList.contains("max-sm:hidden!")).toBe(true);
    // The per-column figures the stacked line repeats are dropped on a phone, over the stack's block.
    for (const cell of site.querySelectorAll("td").slice(1, 3)) expect(cell.classList.contains("max-sm:hidden!")).toBe(true);
    const net = (PLAN_NET_EUR_CENTS / 100).toFixed(2);
    expect(week.text).toContain(`A month is this week × 4.35 plus a share of fixed costs, against €${net} net. A free scan counts to the site it became.`);
  });

  it("summarises the cap and keeps its days behind a table toggle", () => {
    const cap = html.slice(at('data-testid="costs-cap"'), at('data-testid="costs-week"'));
    expect(cap).toContain("1 day over, 1 day past the warning");
    expect(cap).toMatch(/<details[^>]*><summary[^>]*><svg[^>]*lucide-chevron-down[^>]*>.*?<\/svg>Show the days as a table<\/summary>/);
    for (const day of ["Mon 19 Oct", "Wed 14 Oct", "Tue 13 Oct"]) expect(cap).toContain(day);
    expect(cap).toContain("Over €2");
    expect(cap).toContain("Past €1.50");
    // The key a phone reads instead of the on-line labels, each in its line's colour.
    expect(cap).toMatch(/<span class="[^"]*text-error[^"]*">solid line: cap €2<\/span>/);
    expect(cap).toMatch(/<span class="[^"]*text-warning[^"]*">dashed line: warning €1.50<\/span>/);
  });

  it("closes the four lower sections, each with the board's line under its title", () => {
    for (const [id, title, sub] of [
      ["costs-days", "Each site, each day", "One row per site and day."],
      ["costs-activities", "This week by activity", "Writing, measuring, scans and checks."],
      ["costs-vendors", "Against the vendors", "Our estimate against each vendor&#x27;s bill."],
      ["costs-fixed", "Fixed costs, September", "Hosting, mail and the rest, per month."],
    ] as const) {
      expect(html).toMatch(new RegExp(`<details[^>]*data-testid="${id}"[^>]*><summary[^>]*>${title}</summary><div[^>]*><p[^>]*>${sub}</p>`));
    }
  });

  it("leaves no board string missing but the shell's, with no allow line needed for the page's own words", () => {
    const own = readAllow("AppCosts").filter((line: { reason: string }) => !line.reason.includes("tests/app/costs/page.test.tsx"));
    const result = compare(readFileSync(boardFile("AppCosts"), "utf8"), segments(html), own);
    // The nav's "This week" is matched by the page's own "This week by activity", so only these shell strings miss.
    expect(result.missing).toEqual(["ReachKit", "Overview", "Settings", "Publishing on"]);
  });
});

describe("/app/costs with no bill read", () => {
  it("says the week is not billed, never 0", async () => {
    const billed = tables.get("cost_site_day")!;
    tables.set("cost_site_day", billed.map((r) => ({ ...(r as object), billed_cents: null, billed_calls: 0 })));
    vi.setSystemTime(new Date("2026-10-19T12:00:00Z"));
    signedInAs(LIVE_ACCOUNT);
    const unbilled = renderToStaticMarkup(await CostsPage());
    tables.set("cost_site_day", billed);
    const card = unbilled.slice(unbilled.indexOf('data-testid="costs-week-figures"'), unbilled.indexOf('data-testid="costs-cap"'));
    expect(card).toContain(">Not billed</p>");
    expect(card).not.toMatch(/>0\.00¢</);
  });
});
