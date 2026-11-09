// The same three files, one of which reaches the mail seam — transitively,
// which is the case a one-level check would miss.
import { rank } from "./rank";
export function entry(domains: readonly string[]): readonly string[] {
  return rank(domains);
}
