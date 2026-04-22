import { NextResponse } from 'next/server';
import { getScanProgress } from '@/lib/scan-progress';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(getScanProgress());
}
