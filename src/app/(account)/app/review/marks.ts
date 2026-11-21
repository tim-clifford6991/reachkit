// The owner's OK or Flag on a committed row of `/app/review`, kept as append-only `ops_events` rows: the latest per
// (site, opportunity, week) wins. Only this file reads or writes them.
import { revalidatePath } from "next/cache";
import { now } from "@/lib/config/now";
import { isOwner } from "@/lib/account/owner";
import { dbAdmin } from "@/lib/db";
import { weekStartFor } from "@/lib/scan/weekly/week";
import { appAccountForWrite } from "../_session/account";
import { markKey, type Mark, type MarkResult, type MarkValue, type Marks } from "./model";

const KIND = "review_mark";
const NOTE_MAX = 280;
const CODE_MAX = 40;

/** The review's week, as its UTC Monday: the owner reviews every site at once, whatever its zone. */
export const reviewWeekOf = (at: Date): string => weekStartFor({ at, zone: "UTC" });

function encode(week: string, mark: MarkValue, note: string | null): string {
  return JSON.stringify(note === null ? { week, mark } : { week, mark, note });
}

function decode(read: string): { week: string; mark: MarkValue; note: string | null } | null {
  try {
    const value = JSON.parse(read) as { week?: unknown; mark?: unknown; note?: unknown };
    if (typeof value.week !== "string" || (value.mark !== "ok" && value.mark !== "flag")) return null;
    return { week: value.week, mark: value.mark, note: typeof value.note === "string" ? value.note : null };
  } catch {
    return null;
  }
}

/** The latest mark per row of `week`, from rows in any order. Pure. */
export function latestMarks(rows: readonly { site_id: string | null; code: string; read: string; at: string }[], week: string): Marks {
  const marks = new Map<string, Mark>();
  for (const row of [...rows].sort((a, b) => a.at.localeCompare(b.at))) {
    const value = decode(row.read);
    if (row.site_id === null || value === null || value.week !== week) continue;
    marks.set(markKey(row.site_id, row.code), { mark: value.mark, note: value.note, at: row.at });
  }
  return marks;
}

export async function readMarks(siteIds: readonly string[], week: string): Promise<Marks> {
  if (siteIds.length === 0) return new Map();
  // A week's marks are written from its Monday on; the day before covers any zone's Monday.
  const from = new Date(Date.parse(`${week}T00:00:00.000Z`) - 86_400_000).toISOString();
  const { data, error } = await dbAdmin().from("ops_events").select("site_id, code, read, at").eq("kind", KIND).in("site_id", [...siteIds]).gte("at", from);
  if (error !== null) throw new Error(`review.marks: ${error.message}`);
  return latestMarks(data ?? [], week);
}

async function record(form: FormData): Promise<void> {
  const asking = await appAccountForWrite();
  if (!asking.ok || !(await isOwner(asking.account.userId))) throw new Error("review.mark: not the owner");
  const siteId = String(form.get("site") ?? ""), code = String(form.get("opportunity") ?? ""), mark = form.get("mark");
  if (siteId === "" || code === "" || code.length > CODE_MAX || (mark !== "ok" && mark !== "flag")) throw new Error("review.mark: bad request");
  const note = String(form.get("note") ?? "").trim().slice(0, NOTE_MAX);
  const read = encode(reviewWeekOf(now()), mark, note === "" ? null : note);
  const { error } = await dbAdmin().from("ops_events").insert({ kind: KIND, site_id: siteId, code, read });
  if (error !== null) throw new Error(`review.mark: ${error.message}`);
}

/** Records the owner's press, awaited: a press that did not land answers `failed` beside its row and is never shown as
 *  landed, and the screen stays. */
export async function markRow(_prev: MarkResult, form: FormData): Promise<MarkResult> {
  "use server";
  try {
    await record(form);
  } catch (failure) {
    console.warn(JSON.stringify({ event: "review_mark_failed", detail: String(failure) }));
    return "failed";
  }
  revalidatePath("/app/review");
  return "saved";
}
