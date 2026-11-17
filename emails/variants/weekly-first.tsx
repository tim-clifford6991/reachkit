// A new site's first Monday mail, before its address is connected — a state of the `weekly` kind, not a kind of its own.
import { previewWeek } from "../_preview";

export default async function WeeklyFirstMail() {
  return previewWeek("first");
}
