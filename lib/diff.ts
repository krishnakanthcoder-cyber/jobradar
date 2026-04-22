import type { ScrapedJob } from './scraper';

export const CENTRAL_TIME_ZONE = 'America/Chicago';

function getZonedDateParts(
  date: Date,
  timeZone: string
): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);

  if ([year, month, day].some((value) => Number.isNaN(value))) {
    throw new Error(`Could not resolve calendar date for timezone ${timeZone}`);
  }

  return { year, month, day };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
    hour: '2-digit',
    minute: '2-digit',
  });

  const offsetValue =
    formatter.formatToParts(date).find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';

  if (offsetValue === 'GMT') return 0;

  const match = offsetValue.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) {
    throw new Error(`Unsupported timezone offset format: ${offsetValue}`);
  }

  const [, sign, hours, minutes = '00'] = match;
  const totalMinutes = Number(hours) * 60 + Number(minutes);
  const direction = sign === '-' ? -1 : 1;
  return direction * totalMinutes * 60 * 1000;
}

function getZonedMidnightUtc(
  year: number,
  month: number,
  day: number,
  timeZone: string
): Date {
  const approxUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const offsetMs = getTimeZoneOffsetMs(approxUtc, timeZone);
  return new Date(approxUtc.getTime() - offsetMs);
}

export function getCentralDayBounds(now: Date = new Date()) {
  const { year, month, day } = getZonedDateParts(now, CENTRAL_TIME_ZONE);
  const start = getZonedMidnightUtc(year, month, day, CENTRAL_TIME_ZONE);

  const nextDay = new Date(Date.UTC(year, month - 1, day));
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const end = getZonedMidnightUtc(
    nextDay.getUTCFullYear(),
    nextDay.getUTCMonth() + 1,
    nextDay.getUTCDate(),
    CENTRAL_TIME_ZONE
  );

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

export function isPublishedTodayCentral(
  firstPublished: string | null,
  now: Date = new Date()
): boolean {
  if (!firstPublished) return false;

  const publishedAt = Date.parse(firstPublished);
  if (Number.isNaN(publishedAt)) return false;

  const { startIso, endIso } = getCentralDayBounds(now);
  const startMs = Date.parse(startIso);
  const endMs = Date.parse(endIso);

  return publishedAt >= startMs && publishedAt < endMs;
}

export function filterJobsPublishedTodayCentral(
  scraped: ScrapedJob[],
  now: Date = new Date()
): ScrapedJob[] {
  return scraped.filter((job) => isPublishedTodayCentral(job.first_published, now));
}

// Jobs in the current Central-time day scrape that were not present in the previous
// successful scan → newly discovered and worth storing/notifying
export function findNewJobs(
  scraped: ScrapedJob[],
  previousScanIds: Set<string>
): ScrapedJob[] {
  return scraped.filter((job) => !previousScanIds.has(job.id));
}

// IDs that were active in the DB but are NOT in the current Central-time day scrape
// anymore → expired/removed
export function findExpiredJobs(
  currentIds: Set<string>,
  knownIds: Set<string>
): string[] {
  return [...knownIds].filter((id) => !currentIds.has(id));
}
