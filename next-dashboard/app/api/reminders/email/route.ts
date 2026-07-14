import { NextResponse } from 'next/server';
import { hasValidAdminSession } from '@/lib/admin-session';
import { runReminderJob } from '@/lib/reminder-job';
import { getClientKey, hasSameOrigin } from '@/lib/request-security';

export const runtime = 'nodejs';

const maximumBodyBytes = 4 * 1024;
const rateLimitWindowMs = 60 * 1000;
const maxRequestsPerWindow = 5;
const maxRequestBuckets = 1000;
const requestBuckets = new Map<string, number[]>();

export async function POST(request: Request) {
  if (!(await hasValidAdminSession(request))) {
    return apiError('ADMIN_SESSION_REQUIRED', '管理员会话已失效，请重新登录。', 401);
  }
  if (!hasSameOrigin(request)) return apiError('INVALID_ORIGIN', '请求来源无效。', 403);
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return apiError('INVALID_CONTENT_TYPE', '请求格式必须为 JSON。', 415);
  }
  if (!consumeRateLimit(getClientKey(request))) {
    return apiError('RATE_LIMITED', '发送过于频繁，请稍后再试。', 429);
  }

  const payload = await readPayload(request);
  if (!payload.ok) return payload.response;

  const result = await runReminderJob({ source: 'manual', subscriptionId: payload.subscriptionId });
  if (result.status === 'locked') return apiError('REMINDER_JOB_LOCKED', result.message, 409);
  if (!result.ok) {
    return apiError('REMINDER_JOB_FAILED', result.message, 502, {
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped
    });
  }
  if (result.eligible === 0) {
    return apiError('SUBSCRIPTION_NOT_DUE', result.message, 409);
  }

  return NextResponse.json({
    ok: true,
    runId: result.runId,
    sent: result.sent,
    failed: result.failed,
    skipped: result.skipped,
    message: result.message
  });
}

async function readPayload(
  request: Request
): Promise<{ ok: true; subscriptionId: string } | { ok: false; response: NextResponse }> {
  let rawBody = '';
  try {
    rawBody = await request.text();
  } catch {
    return { ok: false, response: apiError('INVALID_BODY', '无法读取请求内容。', 400) };
  }

  if (!rawBody || Buffer.byteLength(rawBody, 'utf8') > maximumBodyBytes) {
    return { ok: false, response: apiError('INVALID_BODY_SIZE', '请求内容为空或过大。', 413) };
  }

  let value: unknown;
  try {
    value = JSON.parse(rawBody);
  } catch {
    return { ok: false, response: apiError('INVALID_JSON', '请求内容不是有效的 JSON。', 400) };
  }

  if (!isRecord(value) || typeof value.subscriptionId !== 'string') {
    return { ok: false, response: apiError('INVALID_PAYLOAD', '缺少订阅 ID。', 400) };
  }
  const subscriptionId = value.subscriptionId.replace(/[\u0000-\u001f\u007f]+/g, '').trim().slice(0, 160);
  if (!subscriptionId) return { ok: false, response: apiError('INVALID_SUBSCRIPTION_ID', '订阅 ID 无效。', 400) };

  return { ok: true, subscriptionId };
}

function consumeRateLimit(key: string) {
  const now = Date.now();
  for (const [bucketKey, timestamps] of requestBuckets) {
    if (!timestamps.some((timestamp) => now - timestamp < rateLimitWindowMs)) requestBuckets.delete(bucketKey);
  }

  const recent = (requestBuckets.get(key) || []).filter((timestamp) => now - timestamp < rateLimitWindowMs);
  if (recent.length >= maxRequestsPerWindow) return false;
  recent.push(now);
  requestBuckets.set(key, recent);

  while (requestBuckets.size > maxRequestBuckets) {
    const oldestKey = requestBuckets.keys().next().value as string | undefined;
    if (!oldestKey) break;
    requestBuckets.delete(oldestKey);
  }
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function apiError(
  code: string,
  message: string,
  status: number,
  details: Record<string, string | number | undefined> = {}
) {
  return NextResponse.json({ ok: false, code, message, ...details }, { status });
}
