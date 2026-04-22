import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import cron from 'node-cron';
import { runScan } from '../lib/run-scan';

let lastCleanupDate = '';

async function run(): Promise<void> {
  const timestamp = new Date().toISOString();
  console.log(`\n[scheduler] ${timestamp} — starting scrape`);

  const today = timestamp.slice(0, 10);
  if (lastCleanupDate !== today) {
    console.log('[scheduler] daily cleanup is handled inside the shared scan runner');
    lastCleanupDate = today;
  }

  const result = await runScan({
    logPrefix: 'scheduler',
    onPortalComplete: ({ portal, jobsPublishedToday, newJobsFound }) => {
      console.log(
        `[scheduler] ${portal.name}: ${jobsPublishedToday} job${jobsPublishedToday === 1 ? '' : 's'} posted today, ${newJobsFound} new since previous scan`
      );
    },
  });

  console.log(`[scheduler] total tracked today: ${result.scraped}`);
  console.log(`[scheduler] new jobs found: ${result.newJobs}`);
  console.log(`[scheduler] expired/removed: ${result.expired}`);
}

// Run once immediately on startup
run().catch(console.error);

// Then every 20 minutes
cron.schedule('*/20 * * * *', () => {
  run().catch(console.error);
});

console.log('[scheduler] running — next cron check in up to 20 minutes');
