import type { ScrapedJob } from './scraper';

// Jobs in the current scrape that are NOT in the DB → freshly posted
export function findNewJobs(
  scraped: ScrapedJob[],
  knownIds: Set<string>
): ScrapedJob[] {
  return scraped.filter((job) => !knownIds.has(job.id));
}

// IDs that were in the DB but are NOT in the current scrape → expired/removed
export function findExpiredJobs(
  scraped: ScrapedJob[],
  knownIds: Set<string>
): string[] {
  const scrapedIds = new Set(scraped.map((j) => j.id));
  return [...knownIds].filter((id) => !scrapedIds.has(id));
}
