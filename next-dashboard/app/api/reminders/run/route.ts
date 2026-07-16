import { NextResponse } from 'next/server';
import { hasValidAdminSession } from '@/lib/admin-session';
import { getReminderJobStatus, runReminderJob } from '@/lib/reminder-job';
import { hasSameOrigin, hasValidCronAuthorization } from '@/lib/request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!(await hasValidAdminSession(request))) return apiError('ADMIN_SESSION_REQUIRED', '请先登录管理员账号。', 401);

  try {
    return json({ ok: true, ...(await getReminderJobStatus()) });
  } catch (error) {
    console.error('Failed to load reminder job status.', getSafeError(error));
    return apiError('DATABASE_UNAVAILABLE', '暂时无法读取提醒任务状态。', 503);
  }
}

export async function POST(request: Request) {
  const cronAuthorized = hasValidCronAuthorization(request);
  if (!cronAuthorized) {
    if (!(await hasValidAdminSession(request))) return apiError('REMINDER_AUTH_REQUIRED', '提醒任务认证失败。', 401);
    if (!hasSameOrigin(request)) return apiError('INVALID_ORIGIN', '请求来源无效。', 403);
  }

  const result = await runReminderJob({
    source: cronAuthorized ? 'scheduled' : 'manual',
    startup: cronAuthorized && request.headers.get('x-reminder-trigger')?.trim().toLowerCase() === 'startup'
  });
  if (result.status === 'locked') return json({ code: 'REMINDER_JOB_LOCKED', ...result }, 409);
  if (!result.ok) return json({ code: 'REMINDER_JOB_FAILED', ...result }, 502);
  return json(result);
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

function apiError(code: string, message: string, status: number) {
  return json({ ok: false, code, message }, status);
}

function getSafeError(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 300) : 'Unknown reminder status error';
}
