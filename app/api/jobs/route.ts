import { NextRequest, NextResponse } from 'next/server';
import { getTodaysJobs, getAllActiveJobs } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const company = searchParams.get('company') ?? undefined;
    const keyword = searchParams.get('keyword') ?? undefined;
    const all = searchParams.get('all') === 'true';

    const jobs = all
      ? await getAllActiveJobs({ company, keyword })
      : await getTodaysJobs({ company, keyword });

    return NextResponse.json(jobs);
  } catch (err) {
    console.error('[api/jobs] error:', err);
    return NextResponse.json({ error: 'Failed to load jobs' }, { status: 500 });
  }
}
