import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import cron from 'node-cron';
import { scrapeAll } from '../lib/scraper';
import { getKnownIds, insertNewJobs, markExpired, markNotified, cleanupOldJobs } from '../lib/db';
import { findNewJobs, findExpiredJobs } from '../lib/diff';
import { notifySubscribers } from '../lib/notifier';

let lastCleanupDate = '';

async function run(): Promise<void> {
  const timestamp = new Date().toISOString();
  console.log(`\n[scheduler] ${timestamp} — starting scrape`);

  // Daily cleanup: remove jobs older than 7 days (runs once per day)
  const today = timestamp.slice(0, 10);
  if (lastCleanupDate !== today) {
    const removed = await cleanupOldJobs();
    console.log(`[scheduler] cleanup: removed ${removed} jobs older than 7 days`);
    lastCleanupDate = today;
  }

  const scraped = await scrapeAll();
  console.log(`[scheduler] total scraped: ${scraped.length}`);

  const knownIds = await getKnownIds();

  const newJobs = findNewJobs(scraped, knownIds);
  const expiredIds = findExpiredJobs(scraped, knownIds);

  console.log(`[scheduler] new jobs found: ${newJobs.length}`);
  console.log(`[scheduler] expired/removed: ${expiredIds.length}`);

  if (newJobs.length > 0) {
    const byCompany = new Map<string, number>();
    for (const job of newJobs) {
      const c = job.company ?? 'Unknown';
      byCompany.set(c, (byCompany.get(c) ?? 0) + 1);
    }
    const companiesList = [...byCompany.keys()].join(', ');
    console.log(`[scheduler] companies with new jobs: ${companiesList}`);
    for (const [company, count] of byCompany) {
      console.log(`[scheduler]   ${company}: ${count} new`);
    }

    await insertNewJobs(newJobs);
    await notifySubscribers(newJobs);
    await markNotified(newJobs.map((j) => j.id));
  }

  if (expiredIds.length > 0) {
    await markExpired(expiredIds);
  }
}

// Run once immediately on startup
run().catch(console.error);

// Then every 20 minutes
cron.schedule('*/20 * * * *', () => {
  run().catch(console.error);
});

console.log('[scheduler] running — next cron check in up to 20 minutes');
