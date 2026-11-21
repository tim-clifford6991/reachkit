// SPEC §4 *Overview's four tiles* — a page's place on its own search, said one way on every Overview detail.
import { copy } from "@/lib/presentation/copy";
import type { PageReading } from "@/lib/measure/page-reading";
import { formatCount } from "../_shell/format";

/** `weeks` is how long the place has held, for "same for {k} weeks". */
export function placeWords(reading: Pick<PageReading, "place" | "prev"> | null, weeks: number): string {
  const place = reading?.place ?? null;
  if (place === null) return copy("overview.place.none");
  const n = formatCount(place.value);
  if (place.source === "gsc") return copy("overview.place.gsc", { n });
  const prev = reading?.prev ?? null;
  if (prev === null) return copy("overview.place.new", { n });
  if (prev > place.value) return copy("overview.place.up", { n, k: formatCount(prev - place.value) });
  if (prev < place.value) return copy("overview.place.down", { n, k: formatCount(place.value - prev) });
  // Equal to the reading before, so it has held at least two weeks.
  return copy("overview.place.same", { n, k: formatCount(Math.max(weeks, 2)) });
}
