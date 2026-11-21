// src/lib/account/offer/spots.ts — the first-50 offer's spots: taken by the first paid checkout, kept on cancel, freed only by a full refund in the first 14 days.
import type { SupabaseClient } from "@supabase/supabase-js";
import { OFFER_ENDS_AT, OFFER_ENDS_ON, OFFER_FEW_LEFT, OFFER_FREE_REFUND_DAYS, OFFER_SHOWN_DAYS, OFFER_SPOTS } from "@/lib/config/constants";
import { env } from "@/lib/config/env";
import { dbAdmin } from "@/lib/db";

export interface OfferStore {
  /** The spots held now (not freed), or `null` where the table could not be read. */
  heldPlaces(): Promise<{ place: number; takenAt: Date }[] | null>;
  /** `taken`, or which unique key refused it, or `failed`. */
  insert(row: { place: number; user_id: string; subscription_id: string }): Promise<"taken" | "place" | "subscription" | "failed">;
  /** Frees the account's held spots taken at or after `takenSince`; false where the write failed. */
  free(userId: string, takenSince: Date, at: Date): Promise<boolean>;
}

const spots = () => (dbAdmin() as unknown as SupabaseClient).from("offer_spots");

function supabaseOfferStore(): OfferStore {
  return {
    async heldPlaces() {
      const { data, error } = await spots().select("place, taken_at").is("freed_at", null);
      return error === null ? (data ?? []).map((row: { place: number; taken_at: string }) => ({ place: row.place, takenAt: new Date(row.taken_at) })) : null;
    },
    async insert(row) {
      const { error } = await spots().insert(row);
      if (error === null) return "taken";
      if (error.code !== "23505") return "failed";
      return error.message.includes("offer_spots_place_held_key") ? "place" : "subscription";
    },
    async free(userId, takenSince, at) {
      const { error } = await spots()
        .update({ freed_at: at.toISOString() })
        .eq("user_id", userId)
        .is("freed_at", null)
        .gte("taken_at", takenSince.toISOString());
      return error === null;
    },
  };
}

let store: OfferStore | null = null;
const offerStore = (): OfferStore => (store ??= supabaseOfferStore());

/** Swaps the store. The suites' one door in; `null` restores the real one. */
export function setOfferStore(next: OfferStore | null): void {
  store = next;
}

/** The account's held spot, or `null` without one or where the read failed: a screen never guesses a spot. */
export async function spotOf(userId: string): Promise<{ place: number; takenAt: Date } | null> {
  try {
    const { data, error } = await spots().select("place, taken_at").eq("user_id", userId).is("freed_at", null).order("taken_at").limit(1).maybeSingle();
    const row = data as { place: number; taken_at: string } | null;
    return error === null && row !== null ? { place: row.place, takenAt: new Date(row.taken_at) } : null;
  } catch {
    return null;
  }
}

export type SpotOutcome = "taken" | "held" | "excluded" | "full" | "ended" | "failed";

/** The lowest free place for this checkout's subscription. Never throws: provisioning goes on whatever this returns. */
export async function takeSpot(a: {
  userId: string;
  subscriptionId: string | null;
  email: string;
  livemode: boolean;
  at?: Date;
}): Promise<SpotOutcome> {
  const owner = env.OWNER_EMAILS.some((address) => address.toLowerCase() === a.email.toLowerCase());
  if (!a.livemode || owner || a.subscriptionId === null) return "excluded";
  if ((a.at ?? new Date()).getTime() >= Date.parse(OFFER_ENDS_AT)) return "ended";
  try {
    // A place another checkout took between the read and the insert is read again.
    for (let attempt = 0; attempt < OFFER_SPOTS; attempt++) {
      const held = await offerStore().heldPlaces();
      if (held === null) return "failed";
      const place = Array.from({ length: OFFER_SPOTS }, (_, i) => i + 1).find((p) => !held.some((spot) => spot.place === p));
      if (place === undefined) return "full";
      const inserted = await offerStore().insert({ place, user_id: a.userId, subscription_id: a.subscriptionId });
      if (inserted === "taken") return "taken";
      if (inserted === "subscription") return "held";
      if (inserted === "failed") return "failed";
    }
    return "failed";
  } catch {
    return "failed";
  }
}

/** A full refund within the first 14 days of the spot gives it back; a later one, a partial one or a cancel frees nothing. */
export async function freeSpotOnRefund(userId: string, refundedAt: Date): Promise<boolean> {
  const takenSince = new Date(refundedAt.getTime() - OFFER_FREE_REFUND_DAYS * 86_400_000);
  try {
    return await offerStore().free(userId, takenSince, refundedAt);
  } catch {
    return false;
  }
}

export interface SpotsLeft {
  /** Only where the count is drawn: `open`, `few` and `full`. */
  readonly left?: number;
  readonly of: number;
  /** The offer's last day in UTC, as printed: "31 Jan 2027". */
  readonly endsOn: string;
  /** `over` is 30 days after the last spot was taken or the offer ended, whichever came first: nothing is drawn. */
  readonly state: "open" | "few" | "full" | "ended" | "over";
}

/** The count every screen reads; `null` where the table could not be read, never `left: 0`. */
export async function spotsLeft(now: Date = new Date()): Promise<SpotsLeft | null> {
  const held = await offerStore().heldPlaces().catch(() => null);
  if (held === null) return null;
  const left = Math.max(0, OFFER_SPOTS - held.length);
  const endsAt = Date.parse(OFFER_ENDS_AT);
  const endsOn = OFFER_ENDS_ON;
  const closedAt = Math.min(endsAt, left === 0 ? Math.max(...held.map((spot) => spot.takenAt.getTime())) : Infinity);
  if (now.getTime() >= closedAt + OFFER_SHOWN_DAYS * 86_400_000) return { of: OFFER_SPOTS, endsOn, state: "over" };
  // "All taken" only when it is true; an end by date with spots free says the offer ended.
  if (left > 0 && now.getTime() >= endsAt) return { of: OFFER_SPOTS, endsOn, state: "ended" };
  return { left, of: OFFER_SPOTS, endsOn, state: left === 0 ? "full" : left <= OFFER_FEW_LEFT ? "few" : "open" };
}
