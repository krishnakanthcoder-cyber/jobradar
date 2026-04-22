import { NextRequest, NextResponse } from 'next/server';
import { runScan } from '@/lib/run-scan';

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runScan({ logPrefix: 'cron' });

    return NextResponse.json({
      ok: true,
      scraped: result.scraped,
      newJobs: result.newJobs,
      expired: result.expired,
    });
  } catch (err) {
    console.error('[cron] error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
