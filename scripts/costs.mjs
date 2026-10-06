#!/usr/bin/env node
// scripts/costs.mjs — `npm run costs`. SPEC §6 (owner, D57, issue 1286).
//
//   npm run costs                       # today and the last 7 days, by issue
//   npm run costs -- --log <file>       # another log than the box's
//
// Reads the test spend log (`scripts/spend-log.mjs`) and prints it against
// D34's €2 a day, warning at €1.50. It reads no database and spends nothing:
// production spend is the `fetches` ledger, reported in the Monday owner
// digest.
import process from "node:process";
import { readSpend, report, spendLogPath, summarize } from "./spend-log.mjs";

const at = process.argv.indexOf("--log");
const file = at === -1 || at + 1 >= process.argv.length ? spendLogPath() : process.argv[at + 1];
const rows = readSpend(file);
console.log(`${file}: ${rows.length} paid calls recorded\n`);
console.log(report(summarize(rows)));
