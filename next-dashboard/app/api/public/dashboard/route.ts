import { NextResponse } from 'next/server';
import { getDashboardState } from '@/lib/dashboard-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const state = await getDashboardState({ publicView: true });
    return NextResponse.json(
      { ok: true, ...state },
      { headers: { 'Cache-Control': 'public, max-age=15, stale-while-revalidate=30' } }
    );
  } catch (error) {
    console.error('Failed to load public dashboard state.', error instanceof Error ? error.message.slice(0, 300) : 'Unknown error');
    return NextResponse.json(
      { ok: false, code: 'DATABASE_UNAVAILABLE', message: '暂时无法读取订阅数据。' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
