import { NextRequest, NextResponse } from 'next/server';
import { getNewJobs, getTodaysJobs, getLastScanTime } from '@/lib/db';
import { getLiveLocationsByUrl } from '@/lib/scraper';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const company = searchParams.get('company') ?? undefined;
    const keyword = searchParams.get('keyword') ?? undefined;
    const [todayJobs, newJobs, lastScanAt] = await Promise.all([
      getTodaysJobs({ company, keyword }),
      getNewJobs({ company, keyword }),
      getLastScanTime(),
    ]);

    let locationsByUrl = new Map<string, string>();
    try {
      locationsByUrl = await getLiveLocationsByUrl(company);
    } catch (locationErr) {
      console.error('[api/jobs] location enrichment failed:', locationErr);
    }

    // Keep one response shape for the frontend tabs.
    const enrichJobs = <T extends { url: string | null }>(jobs: T[]) => jobs.map((job) => ({
      ...job,
      location: job.url ? locationsByUrl.get(job.url) ?? null : null,
    }));

    return NextResponse.json({
      todayJobs: enrichJobs(todayJobs),
      newJobs: enrichJobs(newJobs),
      lastScanAt,
    });
  } catch (err) {
    console.error('[api/jobs] error:', err);
    return NextResponse.json({ error: 'Failed to load jobs' }, { status: 500 });
  }
}
