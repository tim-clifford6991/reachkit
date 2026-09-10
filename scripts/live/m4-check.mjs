// scripts/live/m4-check.mjs — §16 milestone 4's check, run against a live
// deployment: "12 SERPs stored with their `ai_overview` references; draft
// only after email".
//
// `m4-check.sh` is the entry point; this file is the run. Like
// `free-scan.mjs` it is kept out of `src/` on purpose — nothing the product
// serves imports it, and it holds no engine logic (ARCHITECTURE rule 1). It
// reads what a real pass wrote, submits an address the way a visitor
// submits one, and reads back what the deployment did with it.
//
// Milestone 4 is stated as three observable facts, so this script is three
// checks, run one at a time because they fall due at different hours:
//
//   serps <domain>              the twelve, their AI Overviews and their
//                               references, and the matrix built over them
//   mail <domain> <address>     one real capture, and what the deployment
//                               did with the page it owes
//   nurture <address>           the sequence, one hour after the tick that
//                               should have moved it
//
// **What "the 12 stored SERPs" means, and where they are read from.** The
// stored SERPs are `scans.report`'s own `serps` member — "the bought
// top-tens, one per question, in question order" — not the `fetches` rows.
// The two are different populations and only one of them is the milestone's:
// §6.4's cache serves a SERP the deployment already holds without writing a
// `fetches` row at all, so a scan of a domain whose searches another scan
// already bought stores twelve SERPs and ledgers fewer than twelve rows.
// Reading the ledger as the answer would report that correct behaviour as
// eight missing SERPs. The ledger is read anyway and printed beside the
// answer, because the difference is exactly the number served from cache
// and a reader should see it rather than infer it.
//
// **`ai_overview.references` reaches the blob as `referenceDomains`.**
// `parseSerp` folds the vendor's top-level `references` and every
// `ai_overview_element`'s own `references` into one deduplicated list of
// domains, which is what `SerpAiOverview.referenceDomains` holds and what
// the card's cited-domain line is built from. So "carries its references"
// is read here as: Google served an AI Overview (`present`) and the stored
// SERP carries at least one reference domain under it.
//
// **The matrix is checked against the SERPs, not admired on its own.** A
// card that renders twelve cells is not evidence that the twelve SERPs
// under it were read: a cell says `answered` exactly where its SERP says
// `present`, and its cited domains are that SERP's reference domains. Both
// are asserted per question, so "the matrix renders them" is mechanical.
//
// **Nothing here is pinned locally.** `BATTERY.QUESTIONS`, `NURTURE_H`,
// `NURTURE_MAX_TOUCHES`, `SEQUENCE_START_DEADLINE_DAYS` and
// `FIRST_PAGE_RETRY_WINDOW_H` are read out of `src/lib/config/constants.ts`
// at run time (ARCHITECTURE rule 5), and the owner-owed copy keys are read
// out of the registry's own partition the way the registry derives them —
// a key is owed exactly when its value is the empty string.
// `tests/scan/live/m4-check-script.test.ts` is what holds both readings
// honest, and it holds the copy reading against the send seam itself: the
// keys this script names are the keys `sendEmail` actually refuses on.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");
const CONSTANTS = path.join(ROOT, "src", "lib", "config", "constants.ts");
const MAIL_COPY = path.join(ROOT, "src", "lib", "presentation", "copy", "keys", "mail.ts");

/** How often a row is re-read while a job is expected to move it. */
const POLL_MS = 2000;

/** How long the `mail` check watches a freshly captured lead before
 *  reporting the state it reached. The page is written and sent by a job,
 *  never on the visitor's request, so a run that sees no attempt inside
 *  this window reports "nothing attempted" rather than waiting for one —
 *  and a second run on the same address reads the row without capturing
 *  again. */
const FIRST_PAGE_WATCH_S = 180;

/** How late a due touch may be before it is a finding rather than the
 *  clock. The tick is hourly, so one hour is the whole of the slack the
 *  schedule itself accounts for. */
const TOUCH_GRACE_H = 1;

/** Exit codes, in `free-scan.mjs`'s vocabulary so two live checks read the
 *  same way. `OVER` is a real measurement that failed the milestone's own
 *  criterion; `NO_MEASUREMENT` means the run produced no answer at all. */
export const EXIT = Object.freeze({ WITHIN: 0, OVER: 1, NO_MEASUREMENT: 2 });

// ── The pins, read rather than copied ───────────────────────────────────

/**
 * One pinned number, read out of `constants.ts` by name.
 *
 * The name must resolve exactly once: a constant renamed, moved or
 * duplicated stops this script rather than letting it measure against a
 * number nobody pinned. Same rule, same reason and same shape as
 * `free-scan.mjs`'s `pin`.
 */
/** @param {string} name @param {string} [source] @returns {number} */
export function pin(name, source = readFileSync(CONSTANTS, "utf8")) {
  const matches = [...source.matchAll(new RegExp(`\\b${name}\\s*[:=]\\s*(\\d+(?:\\.\\d+)?)`, "g"))];
  if (matches.length !== 1) {
    throw new Error(
      `scripts/live/m4-check.mjs: expected exactly one \`${name}\` in src/lib/config/constants.ts, found ${matches.length}.`
    );
  }
  return Number(matches[0][1]);
}

/**
 * One pinned list of numbers — `NURTURE_H`'s three offsets.
 *
 * Read by its own name and not by its contents: `[24, 72, 168]` is written
 * twice in `constants.ts` (the setup reminders keep the same cadence), so a
 * reader that matched the numbers would have no way to tell which list it
 * had found.
 */
/** @param {string} name @param {string} [source] @returns {number[]} */
export function pinList(name, source = readFileSync(CONSTANTS, "utf8")) {
  const matches = [
    ...source.matchAll(new RegExp(`\\b${name}\\s*=\\s*Object\\.freeze\\(\\[([^\\]]*)\\]`, "g")),
  ];
  if (matches.length !== 1) {
    throw new Error(
      `scripts/live/m4-check.mjs: expected exactly one \`${name}\` list in src/lib/config/constants.ts, found ${matches.length}.`
    );
  }
  return matches[0][1]
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isFinite(n));
}

// ── The copy the owner still owes ───────────────────────────────────────

/**
 * Every `mail.*` key the owner has not written yet.
 *
 * Derived exactly as the registry derives `OWNER_OWED` — "a key is
 * owner-owed exactly when its value is the empty string" — applied to the
 * one partition file that holds the mail keys. `copy()` throws on such a
 * key, `sendEmail` catches that throw and answers `not-composable`, so this
 * list is the whole of what stands between a composed mail and an
 * uncomposed one.
 *
 * Not the same list as `AWAITING_COPY`: a `TODO(copy)` marker renders, and
 * a screen carrying one still works. Only the empty value stops a mail.
 */
/** @param {string} [source] @returns {string[]} */
export function owedMailKeys(source = readFileSync(MAIL_COPY, "utf8")) {
  const owed = [...source.matchAll(/"(mail\.[^"]+)":\s*\[\s*""\s*,/g)].map((m) => m[1]);
  if (owed.length === 0) {
    throw new Error(
      "scripts/live/m4-check.mjs: read no owner-owed key out of src/lib/presentation/copy/keys/mail.ts — the file's shape has changed and this reading is no longer the registry's."
    );
  }
  return owed;
}

/** The keys every lead mail speaks through the shell (`mail/shell/compose.ts`),
 *  whichever template built its blocks.
 *
 *  `mail.shell.imprint` is deliberately **not** here. The composer reads it
 *  straight off the registry rather than through `copy()`, precisely so an
 *  unwritten imprint does not stop every mail in the product on a footer
 *  band; it appears the day it is written and not before. Naming it as a
 *  blocker would send the owner to write a line that blocks nothing.
 *
 *  `mail.optout.label` is here because both mails this milestone sends
 *  carry an opt-out — `optOut` is a required field of what a lead template
 *  returns (REQ-010 c11, "any of these emails") — and the label is rendered
 *  through `copy()`. */
const LEAD_SHELL_KEYS = Object.freeze([
  "mail.shell.wordmark",
  "mail.shell.plaintext_note",
  "mail.optout.label",
]);

const TEMPLATE_DIRS = Object.freeze({ "first-page": "first-page", nurture: "nurture" });

/**
 * Every copy key one mail kind speaks: its template's own, plus the shell's.
 *
 * The template's keys are read as the literals in its file, which is the
 * convention those files are written to — "the keys this template speaks,
 * named once each", hoisted out of the block literals precisely so they can
 * be read in one place.
 *
 * `touch` narrows the nurture template to the one touch being sent: the
 * file names all three subjects and all three bodies, but touch 2 speaks
 * only its own pair, and reporting the other four as owed would send the
 * owner after copy that is not what stopped this mail.
 *
 * @param {string} kind
 * @param {number | null} [touch]
 * @param {string | null} [source]
 * @returns {string[]}
 */
export function keysSpokenBy(kind, touch = null, source = null) {
  const dir = TEMPLATE_DIRS[kind];
  if (dir === undefined) throw new Error(`scripts/live/m4-check.mjs: no template directory for mail kind ${kind}.`);
  const text = source ?? readFileSync(path.join(ROOT, "src", "lib", "mail", "templates", dir, "index.ts"), "utf8");
  const named = [...text.matchAll(/"(mail\.[^"]+)"/g)].map((m) => m[1]);
  const spoken = named.filter((key) => {
    const numbered = /^mail\.nurture\.(?:subject|body)\.(\d+)$/.exec(key);
    if (numbered === null || touch === null) return true;
    return Number(numbered[1]) === touch;
  });
  return [...new Set([...spoken, ...LEAD_SHELL_KEYS])];
}

/** The keys this mail cannot be composed without and does not have. An
 *  empty answer means the seam will compose it.
 *
 *  @param {string} kind
 *  @param {number | null} [touch]
 *  @param {readonly string[]} [owed]
 *  @returns {string[]} */
export function owedBy(kind, touch = null, owed = owedMailKeys()) {
  const spoken = new Set(keysSpokenBy(kind, touch));
  return owed.filter((key) => spoken.has(key));
}

// ── Reading the deployment ──────────────────────────────────────────────

function required(name) {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`m4-check needs ${name}. See docs/DEPLOYMENT.md §2 for where it lives.`);
  }
  return value;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** PostgREST, with the service role's two headers. `scans`, `fetches` and
 *  `leads` are all read here as the deployment's own writer sees them:
 *  `fetches` grants no policy at all (§10 default-deny) and `leads` grants
 *  `select` only to the owning site's user, which an anonymous lead has
 *  none of. */
async function rest(base, key, query) {
  const response = await fetch(new URL(`/rest/v1/${query}`, base), {
    headers: { apikey: key, authorization: `Bearer ${key}`, accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`m4-check: ${query} returned ${response.status} ${await response.text()}`);
  }
  return response.json();
}

const SCAN_COLUMNS = "id,domain,tier,status,stopped_reason,created_at,finished_at,is_current,report";
const LEAD_COLUMNS =
  "id,scan_id,email,domain,first_page_state,first_page_attempts,first_page_first_attempt_at," +
  "first_page_failure,page_delivered_at,sequence_state,sequence_started_at,next_touch_at,touch_count," +
  "dropped_at,converted_at";

/** The scan `GET /scan/{domain}` serves — the one flagged current, which is
 *  the row the matrix on that address is rendered from. */
async function currentScan(db, key, domain) {
  const rows = await rest(db, key, `scans?domain=eq.${encodeURIComponent(domain)}&is_current=is.true&select=${SCAN_COLUMNS}&limit=1`);
  return rows[0] ?? null;
}

function iso(value) {
  return value === null || value === undefined ? "not stamped" : value;
}

function hoursBetween(from, to) {
  return (new Date(to).getTime() - new Date(from).getTime()) / 3_600_000;
}

// ── Check 1 — the twelve, their references, and the card over them ──────

/** One stored SERP, read down to the three facts this check is about. A
 *  `Measured<SerpResult>` has three arms and only two of them carry a
 *  value; `zero` is the vendor's own empty SERP and is a measurement, not
 *  an absence. */
function readSerp(entry) {
  if (entry === undefined || entry === null || typeof entry !== "object") {
    return { kind: "missing", present: false, references: [] };
  }
  if (entry.kind === "unmeasured") {
    return { kind: "unmeasured", reason: entry.reason, present: false, references: [] };
  }
  const overview = entry.value?.aiOverview ?? null;
  return {
    kind: entry.kind,
    present: overview?.present === true,
    references: Array.isArray(overview?.referenceDomains) ? overview.referenceDomains : [],
  };
}

function describeCell(cell) {
  if (cell === undefined || cell === null) return "no cell";
  if (cell.kind === "answered") {
    return cell.namesCustomer ? "answered · names you" : "answered · not you";
  }
  if (cell.kind === "no_answer") return "no answer";
  if (cell.kind === "unmeasured") return `unmeasured · ${cell.reason}`;
  return `unknown · ${String(cell.kind)}`;
}

/** What the cell should say, given the SERP under it. The card's own rule,
 *  read the one direction this check needs it. */
function expectedCellKind(serp) {
  if (serp.kind === "unmeasured" || serp.kind === "missing") return "unmeasured";
  return serp.present ? "answered" : "no_answer";
}

function sameDomains(a, b) {
  return a.length === b.length && a.every((domain, index) => domain === b[index]);
}

export async function checkSerps({ db, key, domain, questions, log }) {
  log(`--- ${domain}`);

  const scan = await currentScan(db, key, domain);
  if (scan === null) {
    log(`no measurement   no current scan for ${domain} on this deployment`);
    log(`                 run scripts/live/free-scan.sh ${domain} first`);
    return EXIT.NO_MEASUREMENT;
  }
  log(`scan             ${scan.id}  tier ${scan.tier}  status ${scan.status}  stopped ${scan.stopped_reason}`);
  log(`pass             claimed ${scan.created_at}  finished ${iso(scan.finished_at)}`);

  const report = scan.report;
  if (report === null || typeof report !== "object") {
    log("no measurement   the current scan stored no report");
    return EXIT.NO_MEASUREMENT;
  }
  const serps = Array.isArray(report.serps) ? report.serps : null;
  if (serps === null || serps.length === 0) {
    log("no measurement   the stored report carries no SERPs — nothing to read references out of");
    return EXIT.NO_MEASUREMENT;
  }
  const card = report.aiAnswers ?? null;
  if (card === null || !Array.isArray(card.rows)) {
    log("no measurement   the stored report carries no AI-answers card, so no matrix was built over the SERPs");
    return EXIT.NO_MEASUREMENT;
  }

  const readings = serps.map(readSerp);
  const served = readings.filter((serp) => serp.present);
  const withReferences = served.filter((serp) => serp.references.length > 0);

  const figure = (n) => String(n).padEnd(6);
  log(`report           version ${report.version}  complete ${report.complete}  coverage ${card.coverage}`);
  log(`stored SERPs     ${figure(serps.length)}    the battery asks ${questions}`);
  log(`AI Overviews     ${figure(served.length)}    Google served one on ${served.length} of ${serps.length}`);
  log(`with references  ${figure(withReferences.length)}    of the ${served.length} it served`);
  log(`matrix rows      ${figure(card.rows.length)}    card counts ${card.answeredSearches} of ${card.measuredSearches}, ${card.customerCitations} naming ${card.ownDomain}`);

  // The ledger, printed beside the answer and never as it: a SERP served
  // from §6.4's cache wrote no row for this scan and is still stored.
  const ledger = await rest(
    db,
    key,
    `fetches?scan_id=eq.${scan.id}&source=eq.serp/google/organic&select=cache_key,cost_cents,created_at&order=created_at.asc`
  );
  const battery = new Set(ledger.filter((row) => row.cache_key.includes("|aio:async|")).map((row) => row.cache_key));
  log(
    `ledger           ${battery.size} of the ${serps.length} were bought on this pass ` +
      `(${serps.length - battery.size} served from §6.4's cache, which writes no row and is not a missing SERP)`
  );

  log("");
  log("#   AI Overview   refs   matrix cell            search");
  const findings = [];
  for (let index = 0; index < serps.length; index += 1) {
    const serp = readings[index];
    const row = card.rows[index] ?? null;
    const cell = row?.cell ?? null;
    const search = row?.question?.search ?? "no question on this row";
    const state = serp.kind === "unmeasured" ? `unmeasured` : serp.present ? "served" : "none";
    log(
      `${String(index + 1).padStart(2, "0")}  ${state.padEnd(12)}${String(serp.references.length).padStart(5)}   ` +
        `${describeCell(cell).padEnd(22)} ${search}`
    );

    if (row === null) {
      findings.push(`question ${index + 1}: a SERP was stored and the card has no row for it`);
      continue;
    }
    if (serp.present && serp.references.length === 0) {
      findings.push(`question ${index + 1}: Google served an AI Overview and the stored SERP carries no reference domain`);
    }
    const expected = expectedCellKind(serp);
    if (cell?.kind !== expected) {
      findings.push(
        `question ${index + 1}: the SERP says ${expected} and the matrix cell says ${describeCell(cell)}`
      );
    } else if (cell.kind === "answered" && !sameDomains([...(cell.citedDomains ?? [])], [...serp.references])) {
      findings.push(
        `question ${index + 1}: the cell cites ${JSON.stringify(cell.citedDomains)} and its SERP's references are ${JSON.stringify(serp.references)}`
      );
    }
  }
  if (card.rows.length > serps.length) {
    findings.push(`the card has ${card.rows.length} rows over ${serps.length} stored SERPs`);
  }

  log("");
  if (findings.length > 0) {
    for (const finding of findings) log(`FINDING          ${finding}`);
    return EXIT.OVER;
  }
  if (serps.length < questions) {
    // Never a failure: `selectTwelve` pads nothing, so a market that
    // yielded nine questions stores nine SERPs and the card says nine.
    log(`fewer than ${questions}   the market yielded ${serps.length} searches; the card counts against that, not against ${questions}`);
  }
  log(`ok               every AI Overview Google served carries its references, and the matrix says what the SERPs say`);
  return EXIT.WITHIN;
}

// ── Check 2 — one real capture, and the page it buys ────────────────────

async function leadRow(db, key, scanId, address) {
  const rows = await rest(
    db,
    key,
    `leads?scan_id=eq.${scanId}&email=eq.${encodeURIComponent(address)}&select=${LEAD_COLUMNS}&limit=1`
  );
  return rows[0] ?? null;
}

/** The capture the report's own control makes: two fields and no third,
 *  answered 202 when the address was taken. */
async function capture(app, scanId, address) {
  const response = await fetch(new URL("/api/lead", app), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scanId, email: address }),
  });
  const body = await response.json().catch(() => null);
  if (response.status === 202 && body?.ok === true) return { captured: true };
  return { captured: false, because: `POST /api/lead answered ${response.status} ${JSON.stringify(body)}` };
}

function reportOwed(log, kind, touch, owed) {
  const which = touch === null ? kind : `${kind} touch ${touch}`;
  if (owed.length === 0) {
    log(`copy             the ${which} mail composes: every key it speaks is written`);
    return;
  }
  log(`copy             the ${which} mail cannot compose — ${owed.length} key(s) it speaks are still the owner's:`);
  for (const key of owed) log(`                   ${key}`);
}

export async function checkMail({ db, key, app, domain, address, windowH, log, watchS = FIRST_PAGE_WATCH_S }) {
  log(`--- ${domain} → ${address}`);

  const scan = await currentScan(db, key, domain);
  if (scan === null) {
    log(`no measurement   no current scan for ${domain} on this deployment`);
    log(`                 run scripts/live/free-scan.sh ${domain} first — the page is written from its report`);
    return EXIT.NO_MEASUREMENT;
  }
  const offered = scan.report?.freePage ?? null;
  log(`scan             ${scan.id}  status ${scan.status}  free page ${offered === null ? "none offered" : `page 1 of ${offered.totalPages}`}`);

  const owed = owedBy("first-page");
  reportOwed(log, "first-page", null, owed);

  let lead = await leadRow(db, key, scan.id, address);
  if (lead === null) {
    // Captured once, never twice: a second submission for the same scan
    // and address writes a second row and tells us nothing the first did
    // not.
    const taken = await capture(app, scan.id, address);
    if (!taken.captured) {
      log(`no measurement   ${taken.because}`);
      return EXIT.NO_MEASUREMENT;
    }
    log(`capture          202 — the address was accepted`);
  } else {
    log(`capture          a lead for this scan and address already exists; read, not re-captured`);
  }

  const watchUntil = Date.now() + watchS * 1000;
  for (;;) {
    lead = await leadRow(db, key, scan.id, address);
    if (lead === null) {
      log("no measurement   the capture was accepted and no lead row appeared");
      return EXIT.NO_MEASUREMENT;
    }
    if (lead.first_page_state !== "pending" || lead.first_page_attempts > 0) break;
    if (Date.now() > watchUntil) break;
    await sleep(POLL_MS);
  }

  log(
    `lead             ${lead.id}  state ${lead.first_page_state}  attempts ${lead.first_page_attempts}  ` +
      `failure ${lead.first_page_failure ?? "none"}`
  );
  log(
    `delivery         first attempt ${iso(lead.first_page_first_attempt_at)}  delivered ${iso(lead.page_delivered_at)}  ` +
      `window ${windowH} h from the first attempt`
  );
  log(`sequence         ${lead.sequence_state ?? "not scheduled"}  next touch ${iso(lead.next_touch_at)}  touches ${lead.touch_count}`);

  log("");
  if (lead.first_page_state === "sent") {
    log("ok               the first page left, to the address that asked for it");
    return EXIT.WITHIN;
  }
  if (lead.first_page_attempts === 0) {
    log(`no measurement   nothing attempted in ${watchS} s: the lead is still \`pending\` and no attempt is stamped`);
    log("                 the page is written and sent by a job, never on the visitor's request — so this says the delivery");
    log("                 path did not run, not that it failed. Re-run this check to read the row again.");
    return EXIT.NO_MEASUREMENT;
  }
  if (owed.length > 0) {
    log(`not delivered    the send was attempted ${lead.first_page_attempts} time(s) and composed none of them`);
    log("                 the cause is the copy named above, which is the owner's debt and not a defect");
    return EXIT.OVER;
  }
  log(`not delivered    the send was attempted ${lead.first_page_attempts} time(s), every key it speaks is written,`);
  log(`                 and the row records ${lead.first_page_failure ?? "no failure"} — a defect, not owed copy`);
  return EXIT.OVER;
}

// ── Check 3 — the sequence, one tick later ──────────────────────────────

export async function checkNurture({ db, key, address, offsets, maxTouches, deadlineD, log }) {
  log(`--- ${address}`);
  log(`bounds           touches at ${offsets.join(", ")} h from the start, at most ${maxTouches}, dropped ${deadlineD} days after delivery`);

  const leads = await rest(
    db,
    key,
    `leads?email=eq.${encodeURIComponent(address)}&select=${LEAD_COLUMNS}&order=page_delivered_at.asc`
  );
  if (leads.length === 0) {
    log("no measurement   this address has no lead on this deployment");
    return EXIT.NO_MEASUREMENT;
  }

  const sequenced = leads.filter((lead) => lead.sequence_state !== null);
  if (sequenced.length === 0) {
    log(`no measurement   ${leads.length} lead(s), none with a sequence: no page has been delivered to this address`);
    return EXIT.NO_MEASUREMENT;
  }

  const findings = [];
  let moved = 0;
  let due = 0;

  log("");
  log("domain                          state      touches  started                   next touch");
  for (const lead of sequenced) {
    log(
      `${lead.domain.padEnd(32)}${lead.sequence_state.padEnd(11)}${String(lead.touch_count).padStart(7)}  ` +
        `${iso(lead.sequence_started_at).padEnd(26)}${iso(lead.next_touch_at)}`
    );
    if (lead.touch_count > 0) moved += 1;
    if (lead.touch_count > maxTouches) {
      findings.push(`${lead.domain}: ${lead.touch_count} touches against a bound of ${maxTouches}`);
    }
    if (lead.sequence_state !== "running" || lead.next_touch_at === null) continue;
    const lateH = hoursBetween(lead.next_touch_at, new Date().toISOString());
    if (lateH <= TOUCH_GRACE_H) {
      due += 1;
      continue;
    }
    findings.push(
      `${lead.domain}: touch ${lead.touch_count + 1} came due ${lateH.toFixed(1)} h ago and the row has not moved`
    );
  }

  const owed = owedBy("nurture", 1);
  log("");
  reportOwed(log, "nurture", 1, owed);

  log("");
  if (findings.length > 0) {
    for (const finding of findings) log(`FINDING          ${finding}`);
    log(
      owed.length > 0
        ? "                 the cause is the copy named above: a touch the seam cannot compose records nothing and stays owed"
        : "                 every key the touch speaks is written, so this is a defect and not owed copy"
    );
    return EXIT.OVER;
  }
  if (moved > 0) {
    log(`ok               ${moved} of ${sequenced.length} sequence(s) have advanced; the tick is moving them`);
    return EXIT.WITHIN;
  }
  log(`no measurement   ${sequenced.length} sequence(s), none due yet (${due} waiting on the clock) — nothing has come round to advance`);
  return EXIT.NO_MEASUREMENT;
}

// ── The run ─────────────────────────────────────────────────────────────

const USAGE =
  "usage: m4-check.sh serps <domain> | m4-check.sh mail <domain> <address> | m4-check.sh nurture <address>";

export async function main(argv, log = (line) => console.log(line)) {
  const [check, ...args] = argv;
  const source = readFileSync(CONSTANTS, "utf8");
  const db = required("SUPABASE_URL");
  const key = required("SUPABASE_SERVICE_ROLE_KEY");
  const app = process.env.RK_LIVE_APP_URL ?? "https://dev.reachkit.app";

  if (check === "serps") {
    const [domain] = args;
    if (domain === undefined) throw new Error(USAGE);
    const questions = pin("QUESTIONS", source);
    log(`bounds           ${questions} questions, each with its own SERP and its own matrix row`);
    return checkSerps({ db, key, domain: domain.toLowerCase(), questions, log });
  }

  if (check === "mail") {
    const [domain, address] = args;
    if (domain === undefined || address === undefined) throw new Error(USAGE);
    log(`app              ${app}`);
    return checkMail({
      db,
      key,
      app,
      domain: domain.toLowerCase(),
      address: address.trim().toLowerCase(),
      windowH: pin("FIRST_PAGE_RETRY_WINDOW_H", source),
      log,
    });
  }

  if (check === "nurture") {
    const [address] = args;
    if (address === undefined) throw new Error(USAGE);
    return checkNurture({
      db,
      key,
      address: address.trim().toLowerCase(),
      offsets: pinList("NURTURE_H", source),
      maxTouches: pin("NURTURE_MAX_TOUCHES", source),
      deadlineD: pin("SEQUENCE_START_DEADLINE_DAYS", source),
      log,
    });
  }

  throw new Error(USAGE);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = EXIT.NO_MEASUREMENT;
    });
}
