// A fixture, not product code. Three files, no forbidden import.
import { rank } from "./rank";
export function entry(domains: readonly string[]): readonly string[] {
  return rank(domains);
}
