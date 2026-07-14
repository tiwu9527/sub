import { NextResponse } from 'next/server';
import { hasValidAdminSession } from '@/lib/admin-session';
import {
  DashboardStateConflictError,
  getDashboardState,
  InvalidDashboardStateError,
  replaceDashboardState
} from '@/lib/dashboard-store';
import { hasSameOrigin } from '@/lib/request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const maximumBodyBytes = 2 * 1024 * 1024;

export async function GET(request: Request) {
  if (!hasValidAdminSession(request)) return apiError('ADMIN_SESSION_REQUIRED', '请先登录管理员账号。', 401);

  try {
    return json({ ok: true, ...(await getDashboardState()) });
  } catch (error) {
    console.error('Failed to load dashboard state.', getSafeError(error));
    return apiError('DATABASE_UNAVAILABLE', '暂时无法读取服务端数据。', 503);
  }
}

export async function PUT(request: Request) {
  if (!hasValidAdminSession(request)) return apiError('ADMIN_SESSION_REQUIRED', '管理员会话已失效，请重新登录。', 401);
  if (!hasSameOrigin(request)) return apiError('INVALID_ORIGIN', '请求来源无效。', 403);
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return apiError('INVALID_CONTENT_TYPE', '请求格式必须为 JSON。', 415);
  }

  const payload = await readPayload(request);
  if (!payload.ok) return payload.response;

  try {
    const result = await replaceDashboardState(payload.value, payload.revision);
    return json({ ok: true, revision: result.revision });
  } catch (error) {
    if (error instanceof DashboardStateConflictError) return apiError('REVISION_CONFLICT', error.message, 409);
    if (error instanceof InvalidDashboardStateError) return apiError('INVALID_DASHBOARD_STATE', error.message, 400);
    console.error('Failed to persist dashboard state.', getSafeError(error));
    return apiError('DATABASE_WRITE_FAILED', '服务端暂时无法保存工作区数据。', 503);
  }
}

async function readPayload(
  request: Request
): Promise<{ ok: true; value: unknown; revision: number } | { ok: false; response: NextResponse }> {
  let rawBody = '';
  try {
    rawBody = await request.text();
  } catch {
    return { ok: false, response: apiError('INVALID_BODY', '无法读取请求内容。', 400) };
  }

  if (!rawBody || Buffer.byteLength(rawBody, 'utf8') > maximumBodyBytes) {
    return { ok: false, response: apiError('INVALID_BODY_SIZE', '工作区数据为空或过大。', 413) };
  }

  let value: unknown;
  try {
    value = JSON.parse(rawBody);
  } catch {
    return { ok: false, response: apiError('INVALID_JSON', '请求内容不是有效的 JSON。', 400) };
  }

  if (!isRecord(value) || !Number.isInteger(value.revision) || Number(value.revision) < 0 || !('state' in value)) {
    return { ok: false, response: apiError('INVALID_PAYLOAD', '工作区版本或数据无效。', 400) };
  }

  return { ok: true, value: value.state, revision: Number(value.revision) };
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

function apiError(code: string, message: string, status: number) {
  return json({ ok: false, code, message }, status);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getSafeError(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 300) : 'Unknown database error';
}
