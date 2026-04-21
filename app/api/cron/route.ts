import { NextRequest, NextResponse } from 'next/server';
import { scrapeAll } from '@/lib/scraper';
import { getKnownIds, insertNewJobs, markExpired, markNotified, cleanupOldJobs } from '@/lib/db';
import { findNewJobs, findExpiredJobs } from '@/lib/diff';
import { notifySubscribers } from '@/lib/notifier';

// Requires Vercel Pro for full scrape (300s)
// On Hobby plan (60s), some portals may time out — still works partially
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  // Verify request is from Vercel cron, not a random visitor
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Remove jobs older than 7 days
    const cleaned = await cleanupOldJobs();
    if (cleaned > 0) console.log(`[cron] cleanup: removed ${cleaned} old jobs`);

    const scraped = await scrapeAll();
    console.log(`[cron] total scraped: ${scraped.length}`);

    const knownIds = await getKnownIds();
    const newJobs = findNewJobs(scraped, knownIds);
    const expiredIds = findExpiredJobs(scraped, knownIds);

    console.log(`[cron] new: ${newJobs.length}, expired: ${expiredIds.length}`);

    if (newJobs.length > 0) {
      await insertNewJobs(newJobs);
      await notifySubscribers(newJobs);
      await markNotified(newJobs.map((j) => j.id));
    }

    if (expiredIds.length > 0) {
      await markExpired(expiredIds);
    }

    return NextResponse.json({
      ok: true,
      scraped: scraped.length,
      newJobs: newJobs.length,
      expired: expiredIds.length,
    });
  } catch (err) {
    console.error('[cron] error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
