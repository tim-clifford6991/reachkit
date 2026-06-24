"use client";

/**
 * AutoRefresh — periodically calls router.refresh() so a server-rendered
 * "generating" state (e.g. a paid scan being deepened) swaps to the real report
 * as soon as report_payload lands, without the user manually reloading.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh({ everyMs = 6000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), everyMs);
    return () => clearInterval(t);
  }, [router, everyMs]);
  return null;
}
