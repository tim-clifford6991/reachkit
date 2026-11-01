// The six kinds of business, each with its word and icon: one vocabulary for
// the Free scans filter and the landing's "any business" row.
import { Briefcase, Laptop, Store, Utensils, Video, Wrench, type LucideIcon } from "lucide-react";
import type { CopyKey } from "@/lib/presentation/copy";
import type { BusinessKind } from "@/lib/market/kinds";

export const KIND_WORD: Readonly<Record<BusinessKind, CopyKey>> = {
  "local-service": "gallery.kind.local-service",
  shop: "gallery.kind.shop",
  hospitality: "gallery.kind.hospitality",
  "professional-services": "gallery.kind.professional-services",
  software: "gallery.kind.software",
  creator: "gallery.kind.creator",
};

export const KIND_ICON: Readonly<Record<BusinessKind, LucideIcon>> = {
  "local-service": Wrench,
  shop: Store,
  hospitality: Utensils,
  "professional-services": Briefcase,
  software: Laptop,
  creator: Video,
};
