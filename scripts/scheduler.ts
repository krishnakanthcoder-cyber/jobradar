import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import cron from 'node-cron';
import { scrapeAll } from '../lib/scraper';
import { getNewJobs } from '../lib/diff';
import { getKnownIds, insertJobs, markNotified } from '../lib/db';
import { notifySubscribers } from '../lib/notifier';

async function run(): Promise<void> {
  const timestamp = new Date().toISOString();
  console.log(`\n[scheduler] ${timestamp} — starting scrape across all portals`);

  const scraped = await scrapeAll();
  console.log(`[scheduler] total scraped: ${scraped.length} jobs`);

  const knownIds = getKnownIds();
  const newJobs = getNewJobs(scraped, knownIds);
  console.log(`[scheduler] new jobs: ${newJobs.length}`);

  if (newJobs.length > 0) {
    // Log which companies had new jobs
    const byCompany = new Map<string, number>();
    for (const job of newJobs) {
      const c = job.company ?? 'Unknown';
      byCompany.set(c, (byCompany.get(c) ?? 0) + 1);
    }
    for (const [company, count] of byCompany) {
      console.log(`[scheduler]   ${company}: ${count} new`);
    }

    insertJobs(newJobs);
    await notifySubscribers(newJobs);
    markNotified(newJobs.map((j) => j.id));
  }
}

// Run once immediately on startup
run().catch(console.error);

// Then every 20 minutes
cron.schedule('*/20 * * * *', () => {
  run().catch(console.error);
});

console.log('[scheduler] running — next cron check in up to 20 minutes');
