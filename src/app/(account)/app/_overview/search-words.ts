// SPEC §4 — the icon each status and each week's action draws before its word: one icon per concept across the product.
import { Calendar, CircleCheck, CircleMinus, Clock, Clock4, List, RefreshCw, TrendingUp, type LucideIcon } from "lucide-react";
import type { Doing, SearchStatus } from "./search-model";

export const STATUS_ICON: Readonly<Record<SearchStatus, LucideIcon>> = Object.freeze({
  live: CircleCheck,
  your_review: Clock,
  up_next: List,
  too_big: CircleMinus,
});

export const DOING_ICON: Readonly<Record<Doing["kind"], LucideIcon>> = Object.freeze({
  today: Clock4,
  page: Calendar,
  update: RefreshCw,
  climbing: TrendingUp,
});
