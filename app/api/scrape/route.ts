import { NextResponse } from 'next/server';
import { PORTALS } from '@/lib/portals';
import { runScan } from '@/lib/run-scan';
import { setScanProgress, startScanProgress } from '@/lib/scan-progress';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    startScanProgress(PORTALS.length);
    const result = await runScan({
      logPrefix: 'scrape',
      onPortalStart: (portal, index, total) => {
        setScanProgress({
          stage: 'scanning',
          currentPortal: portal.name,
          completedPortals: index,
          message: `Scanning ${portal.name} (${index + 1}/${total})`,
        });
      },
      onPortalComplete: ({ portal, index, total, jobsPublishedToday, totalNewJobsFound }) => {
        setScanProgress({
          stage: 'scanning',
          currentPortal: portal.name,
          completedPortals: index + 1,
          recentJobs: totalNewJobsFound,
          message: `Finished ${portal.name} (${index + 1}/${total}) - ${jobsPublishedToday} job${jobsPublishedToday === 1 ? '' : 's'} posted today`,
        });
      },
      onFinishing: ({ newJobs, expiredJobs }) => {
        setScanProgress({
          stage: 'finishing',
          currentPortal: null,
          expiredJobs,
          recentJobs: newJobs,
          message: 'Finalizing scan results...',
        });
      },
    });

    setScanProgress({
      running: false,
      stage: 'completed',
      currentPortal: null,
      completedPortals: PORTALS.length,
      recentJobs: result.newJobs,
      expiredJobs: result.expired,
      finishedAt: new Date().toISOString(),
      message: `Scan complete. ${result.newJobs} new job${result.newJobs === 1 ? '' : 's'} found.`,
      error: null,
    });

    return NextResponse.json({
      ok: true,
      scraped: result.scraped,
      newJobs: result.newJobs,
      expired: result.expired,
    });
  } catch (err) {
    console.error('[scrape] error:', err);
    const message = String(err);
    setScanProgress({
      running: false,
      stage: 'error',
      finishedAt: new Date().toISOString(),
      message: 'Scan failed.',
      error: message,
    });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
