import { PORTALS } from './portals';
import { scrapePortal } from './scraper';
import {
  cleanupOldJobs,
  getPreviousSuccessfulScanIds,
  replaceLatestNewJobs,
  replaceTodayJobs,
  setPreviousSuccessfulScanIds,
} from './db';
import {
  filterJobsPublishedTodayCentral,
  findNewJobs,
} from './diff';
import { notifySubscribers } from './notifier';
import type { Portal } from './portals';
import type { ScrapedJob } from './scraper';

interface PortalScanUpdate {
  portal: Portal;
  index: number;
  total: number;
  jobsPublishedToday: number;
  newJobsFound: number;
  totalNewJobsFound: number;
}

interface RunScanOptions {
  logPrefix: string;
  onPortalStart?: (portal: Portal, index: number, total: number) => void | Promise<void>;
  onPortalComplete?: (update: PortalScanUpdate) => void | Promise<void>;
  onFinishing?: (summary: {
    newJobs: number;
    expiredJobs: number;
    trackedJobs: number;
  }) => void | Promise<void>;
}

export interface RunScanResult {
  scraped: number;
  newJobs: number;
  expired: number;
}

export async function runScan({
  logPrefix,
  onPortalStart,
  onPortalComplete,
  onFinishing,
}: RunScanOptions): Promise<RunScanResult> {
  const cleaned = await cleanupOldJobs();
  if (cleaned > 0) console.log(`[${logPrefix}] cleanup: removed ${cleaned} old jobs`);

  const previousScanIds = await getPreviousSuccessfulScanIds();
  const currentTodayJobs: ScrapedJob[] = [];
  const currentTodayIds = new Set<string>();
  const allNewJobs: ScrapedJob[] = [];
  const seen = new Set<string>();

  for (const [index, portal] of PORTALS.entries()) {
    await onPortalStart?.(portal, index, PORTALS.length);

    const jobs = await scrapePortal(portal);
    const unique = jobs.filter((job) => {
      if (seen.has(job.id)) return false;
      seen.add(job.id);
      return true;
    });

    const todayJobs = filterJobsPublishedTodayCentral(unique);
    currentTodayJobs.push(...todayJobs);
    for (const job of todayJobs) {
      currentTodayIds.add(job.id);
    }

    const jobsToInsert = findNewJobs(todayJobs, previousScanIds);
    if (jobsToInsert.length > 0) {
      console.log(
        `[${logPrefix}] ${portal.name} -> found ${jobsToInsert.length} new job${jobsToInsert.length === 1 ? '' : 's'} in this scan`
      );
      allNewJobs.push(...jobsToInsert);
    }

    await onPortalComplete?.({
      portal,
      index,
      total: PORTALS.length,
      jobsPublishedToday: todayJobs.length,
      newJobsFound: jobsToInsert.length,
      totalNewJobsFound: allNewJobs.length,
    });

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  await replaceTodayJobs(currentTodayJobs);
  await replaceLatestNewJobs(allNewJobs);

  await onFinishing?.({
    newJobs: allNewJobs.length,
    expiredJobs: 0,
    trackedJobs: currentTodayIds.size,
  });

  if (allNewJobs.length > 0) {
    await notifySubscribers(allNewJobs);
  }

  await setPreviousSuccessfulScanIds(currentTodayIds);

  console.log(
    `[${logPrefix}] done - ${allNewJobs.length} new, ${currentTodayIds.size} tracked today`
  );

  return {
    scraped: currentTodayIds.size,
    newJobs: allNewJobs.length,
    expired: 0,
  };
}
