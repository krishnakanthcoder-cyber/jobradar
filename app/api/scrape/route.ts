import { NextResponse } from 'next/server';
import { scrapePortal } from '@/lib/scraper';
import { PORTALS, KEYWORDS } from '@/lib/portals';
import { getKnownIds, insertNewJobs, markExpired, markNotified, cleanupOldJobs } from '@/lib/db';
import { notifySubscribers } from '@/lib/notifier';
import type { ScrapedJob } from '@/lib/scraper';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const cleaned = await cleanupOldJobs();
    if (cleaned > 0) console.log(`[scrape] cleanup: removed ${cleaned} old jobs`);

    // Fetch known IDs once upfront
    const knownIds = await getKnownIds();

    const allNewJobs: ScrapedJob[] = [];
    const allScrapedIds = new Set<string>();
    const seen = new Set<string>();

    for (const portal of PORTALS) {
      for (const keyword of KEYWORDS) {
        const url = portal.buildUrl(keyword);
        console.log(`[scrape] fetching: ${url}`);
        const jobs = await scrapePortal(portal.name, url, keyword, portal.selector);

        // Deduplicate within this run
        const unique = jobs.filter((j) => {
          if (seen.has(j.id)) return false;
          seen.add(j.id);
          return true;
        });

        // Track all scraped IDs for expired detection later
        for (const j of unique) allScrapedIds.add(j.id);

        // Find jobs not yet in DB
        const newJobs = unique.filter((j) => !knownIds.has(j.id));

        if (newJobs.length > 0) {
          await insertNewJobs(newJobs);
          console.log(`[scrape] ${portal.name} "${keyword}" → inserted ${newJobs.length} new jobs`);
          // Add to knownIds so later portals don't re-insert the same listing
          for (const j of newJobs) knownIds.add(j.id);
          allNewJobs.push(...newJobs);
        }

        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // Mark jobs that vanished from all portals as expired
    const expiredIds = [...knownIds].filter((id) => !allScrapedIds.has(id));
    if (expiredIds.length > 0) {
      await markExpired(expiredIds);
      console.log(`[scrape] marked ${expiredIds.length} jobs as expired`);
    }

    // Send one notification email for all new jobs found this run
    if (allNewJobs.length > 0) {
      await notifySubscribers(allNewJobs);
      await markNotified(allNewJobs.map((j) => j.id));
    }

    console.log(`[scrape] done — ${allNewJobs.length} new, ${expiredIds.length} expired`);

    return NextResponse.json({
      ok: true,
      scraped: allScrapedIds.size,
      newJobs: allNewJobs.length,
      expired: expiredIds.length,
    });
  } catch (err) {
    console.error('[scrape] error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
