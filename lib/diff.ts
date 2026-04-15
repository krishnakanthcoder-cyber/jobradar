import type { ScrapedJob } from './scraper';

export function getNewJobs(
  scraped: ScrapedJob[],
  knownIds: Set<string>
): ScrapedJob[] {
  return scraped.filter((job) => !knownIds.has(job.id));
}
