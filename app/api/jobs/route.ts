import { NextRequest, NextResponse } from 'next/server';
import { getRecentJobs } from '@/lib/db';

export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const company = searchParams.get('company') ?? undefined;
    const keyword = searchParams.get('keyword') ?? undefined;
    const jobs = getRecentJobs(50, { company, keyword });
    return NextResponse.json(jobs);
  } catch (err) {
    console.error('[api/jobs] error:', err);
    return NextResponse.json({ error: 'Failed to load jobs' }, { status: 500 });
  }
}
