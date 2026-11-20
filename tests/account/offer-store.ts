// The offer table in memory, with its two unique keys: one held row per place, one row per subscription.
import type { OfferStore } from "@/lib/account/offer/spots";

export const memoryOfferStore = (rows: { place: number; user_id: string; subscription_id: string; taken_at: Date; freed_at: Date | null }[], fail = { next: false }): OfferStore => ({
  heldPlaces: async () => (fail.next ? null : rows.filter((r) => r.freed_at === null).map((r) => r.place)),
  insert: async (row) =>
    rows.some((r) => r.subscription_id === row.subscription_id) ? "subscription"
    : rows.some((r) => r.place === row.place && r.freed_at === null) ? "place"
    : (rows.push({ ...row, taken_at: new Date(), freed_at: null }), "taken"),
  free: async (userId, since, at) => (rows.forEach((r) => r.user_id === userId && !r.freed_at && r.taken_at >= since && (r.freed_at = at)), true),
});
