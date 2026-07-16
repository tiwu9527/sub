import { NextResponse } from 'next/server';
import { hasValidAdminSession } from '@/lib/admin-session';
import {
  getReminderSettings,
  InvalidReminderSettingsError,
  ReminderSettingsConflictError,
  updateReminderSettings,
  type ReminderSettingsUpdate
} from '@/lib/reminder-settings';
import { hasSameOrigin } from '@/lib/request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const maximumBodyBytes = 8 * 1024;

export async function GET(request: Request) {
  if (!(await hasValidAdminSession(request))) {
    return apiError('ADMIN_SESSION_REQUIRED', '管理员会话已失效，请重新登录。', 401);
  }

  try {
    return json({ ok: true, ...(await getReminderSettings()) });
  } catch (error) {
    console.error('Failed to load reminder settings.', getSafeError(error));
    return apiError('DATABASE_UNAVAILABLE', '暂时无法读取提醒配置。', 503);
  }
}

export async function PUT(request: Request) {
  if (!(await hasValidAdminSession(request))) {
    return apiError('ADMIN_SESSION_REQUIRED', '管理员会话已失效，请重新登录。', 401);
  }
  if (!hasSameOrigin(request)) return apiError('INVALID_ORIGIN', '请求来源无效。', 403);
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return apiError('INVALID_CONTENT_TYPE', '请求格式必须为 JSON。', 415);
  }

  const payload = await readPayload(request);
  if (!payload.ok) return payload.response;

  try {
    return json({ ok: true, ...(await updateReminderSettings(payload.value)) });
  } catch (error) {
    if (error instanceof ReminderSettingsConflictError) return apiError('REVISION_CONFLICT', error.message, 409);
    if (error instanceof InvalidReminderSettingsError) return apiError('INVALID_REMINDER_SETTINGS', error.message, 400);
    console.error('Failed to persist reminder settings.', getSafeError(error));
    return apiError('REMINDER_SETTINGS_WRITE_FAILED', '暂时无法保存提醒配置。', 503);
  }
}

async function readPayload(
  request: Request
): Promise<{ ok: true; value: ReminderSettingsUpdate } | { ok: false; response: NextResponse }> {
  let rawBody = '';
  try {
    rawBody = await request.text();
  } catch {
    return { ok: false, response: apiError('INVALID_BODY', '无法读取请求内容。', 400) };
  }

  if (!rawBody) return { ok: false, response: apiError('INVALID_BODY', '请求内容不能为空。', 400) };
  if (Buffer.byteLength(rawBody, 'utf8') > maximumBodyBytes) {
    return { ok: false, response: apiError('INVALID_BODY_SIZE', '请求内容过大。', 413) };
  }

  let value: unknown;
  try {
    value = JSON.parse(rawBody);
  } catch {
    return { ok: false, response: apiError('INVALID_JSON', '请求内容不是有效的 JSON。', 400) };
  }
  if (!isRecord(value) || !hasReminderSettingsFields(value)) {
    return { ok: false, response: apiError('INVALID_PAYLOAD', '提醒配置参数无效。', 400) };
  }

  return {
    ok: true,
    value: {
      enabled: value.enabled,
      intervalMinutes: value.intervalMinutes,
      runOnStart: value.runOnStart,
      maxAttempts: value.maxAttempts,
      revision: value.revision
    }
  };
}

function hasReminderSettingsFields(value: Record<string, unknown>): value is Record<string, unknown> & ReminderSettingsUpdate {
  return (
    typeof value.enabled === 'boolean' &&
    typeof value.intervalMinutes === 'number' &&
    typeof value.runOnStart === 'boolean' &&
    typeof value.maxAttempts === 'number' &&
    typeof value.revision === 'number'
  );
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
  return error instanceof Error ? error.message.slice(0, 300) : 'Unknown reminder settings error';
}
