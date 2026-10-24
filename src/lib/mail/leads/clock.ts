// BUILD §4.2 — hours and days as milliseconds, once. Unit conversions, not tunables: every cadence comes from `src/lib/config/constants.ts`.
const MS_PER_HOUR = 3_600_000;
const HOURS_PER_DAY = 24;

export function hoursAfter(at: Date, hours: number): Date {
  return new Date(at.getTime() + hours * MS_PER_HOUR);
}

export function daysAfter(at: Date, days: number): Date {
  return hoursAfter(at, days * HOURS_PER_DAY);
}

export function minutesAfter(at: Date, minutes: number): Date {
  return new Date(at.getTime() + (minutes * MS_PER_HOUR) / 60);
}
