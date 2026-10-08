// §6.7 step 4's mechanical question forms over a keyword.
// Split out of `phrase.ts` (which buys a model call beside them) so a
// caller that only words a search reaches no model seam at all.
//
// The forms are each language's own (SPEC §6, owner D66, issue 1311):
// `src/lib/locale/language/` holds them.
import { languagePack } from "@/lib/locale/language";
import type { Language } from "@/lib/locale/locales";

/** Total over every keyword: the language's shapes where one matches,
 *  otherwise the search itself as a question. Absent, the language is
 *  English. */
export function templateQuestion(keyword: string, language: Language = "en"): string {
  return languagePack(language).question(keyword);
}
