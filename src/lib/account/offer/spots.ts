// src/lib/account/offer/spots.ts — the first-50 offer's spots: taken by the first paid checkout, kept on cancel, freed only by a full refund in the first 14 days.
import type { SupabaseClient } from "@supabase/supabase-js";
import { OFFER_ENDS_AT, OFFER_FEW_LEFT, OFFER_FREE_REFUND_DAYS, OFFER_SPOTS } from "@/lib/config/constants";
import { env } from "@/lib/config/env";
import { dbAdmin } from "@/lib/db";

export interface OfferStore {
  /** The places held now (not freed), or `null` where the table could not be read. */
  heldPlaces(): Promise<number[] | null>;
  /** `taken`, or which unique key refused it, or `failed`. */
  insert(row: { place: number; user_id: string; subscription_id: string }): Promise<"taken" | "place" | "subscription" | "failed">;
  /** Frees the account's held spots taken at or after `takenSince`; false where the write failed. */
  free(userId: string, takenSince: Date, at: Date): Promise<boolean>;
}

const spots = () => (dbAdmin() as unknown as SupabaseClient).from("offer_spots");

function supabaseOfferStore(): OfferStore {
  return {
    async heldPlaces() {
      const { data, error } = await spots().select("place").is("freed_at", null);
      return error === null ? (data ?? []).map((row: { place: number }) => row.place) : null;
    },
    async insert(row) {
      const { error } = await spots().insert(row);
      if (error === null) return "taken";
      if (error.code !== "23505") return "failed";
      return error.message.includes("subscription_id") ? "subscription" : "place";
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
      const place = Array.from({ length: OFFER_SPOTS }, (_, i) => i + 1).find((p) => !held.includes(p));
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
  readonly left: number;
  readonly of: number;
  /** The offer's last day, `YYYY-MM-DD` in UTC. */
  readonly endsOn: string;
  readonly state: "open" | "few" | "full" | "ended";
}

/** The count every screen reads; `null` where the table could not be read, never `left: 0`. */
export async function spotsLeft(now: Date = new Date()): Promise<SpotsLeft | null> {
  const held = await offerStore().heldPlaces().catch(() => null);
  if (held === null) return null;
  const left = Math.max(0, OFFER_SPOTS - held.length);
  const endsOn = new Date(Date.parse(OFFER_ENDS_AT) - 1).toISOString().slice(0, 10);
  const state =
    now.getTime() >= Date.parse(OFFER_ENDS_AT) ? "ended" : left === 0 ? "full" : left <= OFFER_FEW_LEFT ? "few" : "open";
  return { left, of: OFFER_SPOTS, endsOn, state };
}
