// src/lib/locale — a site's country and language (SPEC §6, owner D66,
// issue 1311): the closed list, the reading, and each language's pack.
export * from "./locales";
export { marketsServed, readLocale, readLocaleSignals } from "./read";
