import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import cron from 'node-cron';
import { scrapePortal } from '../lib/scraper';
import { insertJobs, removeJobs, getJobIdsBySource } from '../lib/db';
import { notifySubscribers } from '../lib/notifier';
import { PORTALS, KEYWORDS } from '../lib/portals';
import type { ScrapedJob } from '../lib/scraper';

async function run(): Promise<void> {
  const timestamp = new Date().toISOString();
  console.log(`\n[scheduler] ${timestamp} — starting scrape`);

  const allNewJobs: ScrapedJob[] = [];

  for (const portal of PORTALS) {
    for (const keyword of KEYWORDS) {
      try {
        const url = portal.buildUrl(keyword);
        const scraped = await scrapePortal(portal.name, url, keyword);
        const scrapedIds = new Set(scraped.map((j) => j.id));

        // Jobs stored in DB for this portal+keyword from the previous run
        const storedIds = await getJobIdsBySource(portal.name, keyword);

        // New = appeared since last run
        const newJobs = scraped.filter((j) => !storedIds.has(j.id));

        // Removed = were stored but no longer on the page
        const removedIds = [...storedIds].filter((id) => !scrapedIds.has(id));

        if (removedIds.length > 0) {
          await removeJobs(removedIds);
          console.log(`[${portal.name}/${keyword}] removed ${removedIds.length} stale jobs`);
        }

        if (newJobs.length > 0) {
          await insertJobs(newJobs);
          allNewJobs.push(...newJobs);
          console.log(`[${portal.name}/${keyword}] ${newJobs.length} new jobs`);
        }

        if (newJobs.length === 0 && removedIds.length === 0) {
          console.log(`[${portal.name}/${keyword}] no changes (${scraped.length} jobs)`);
        }
      } catch (err) {
        console.error(`[scheduler] error on ${portal.name}/"${keyword}":`, err);
      }

      // Rate limit between requests
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log(`[scheduler] done — ${allNewJobs.length} new jobs this run`);

  if (allNewJobs.length > 0) {
    await notifySubscribers(allNewJobs);
  }
}

// Run once immediately on startup
run().catch(console.error);

// Then every 20 minutes
cron.schedule('*/20 * * * *', () => {
  run().catch(console.error);
});

console.log('[scheduler] running — next cron check in up to 20 minutes');
