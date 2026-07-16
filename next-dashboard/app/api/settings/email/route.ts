import { NextResponse } from 'next/server';
import { hasValidAdminSession } from '@/lib/admin-session';
import {
  EmailSettingsConflictError,
  getPublicEmailSettings,
  InvalidEmailSettingsError,
  updateEmailSettings,
  type EmailPasswordAction,
  type EmailSettingsUpdate
} from '@/lib/email-settings';
import { hasSameOrigin } from '@/lib/request-security';
import { SecretBoxConfigurationError, SecretBoxDecryptionError } from '@/lib/secret-box';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const maximumBodyBytes = 16 * 1024;

export async function GET(request: Request) {
  if (!(await hasValidAdminSession(request))) {
    return apiError('ADMIN_SESSION_REQUIRED', '管理员会话已失效，请重新登录。', 401);
  }

  try {
    return json({ ok: true, ...(await getPublicEmailSettings()) });
  } catch (error) {
    if (error instanceof SecretBoxConfigurationError || error instanceof SecretBoxDecryptionError) {
      return apiError('EMAIL_SETTINGS_UNAVAILABLE', error.message, 503);
    }
    console.error('Failed to load email settings.', getSafeError(error));
    return apiError('DATABASE_UNAVAILABLE', '暂时无法读取邮件配置。', 503);
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
    return json({ ok: true, ...(await updateEmailSettings(payload.value)) });
  } catch (error) {
    if (error instanceof EmailSettingsConflictError) return apiError('REVISION_CONFLICT', error.message, 409);
    if (error instanceof InvalidEmailSettingsError) return apiError('INVALID_EMAIL_SETTINGS', error.message, 400);
    if (error instanceof SecretBoxConfigurationError) {
      return apiError('SETTINGS_ENCRYPTION_KEY_REQUIRED', error.message, 503);
    }
    console.error('Failed to persist email settings.', getSafeError(error));
    return apiError('EMAIL_SETTINGS_WRITE_FAILED', '暂时无法保存邮件配置。', 503);
  }
}

async function readPayload(
  request: Request
): Promise<{ ok: true; value: EmailSettingsUpdate } | { ok: false; response: NextResponse }> {
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
  if (!isRecord(value) || !hasEmailSettingsFields(value)) {
    return { ok: false, response: apiError('INVALID_PAYLOAD', '邮件配置参数无效。', 400) };
  }

  return {
    ok: true,
    value: {
      enabled: value.enabled,
      host: value.host,
      port: value.port,
      secure: value.secure,
      requireTls: value.requireTls,
      username: value.username,
      passwordAction: value.passwordAction,
      ...(typeof value.password === 'string' ? { password: value.password } : {}),
      mailFrom: value.mailFrom,
      mailReplyTo: value.mailReplyTo,
      testTo: value.testTo,
      revision: value.revision
    }
  };
}

function hasEmailSettingsFields(value: Record<string, unknown>): value is Record<string, unknown> & EmailSettingsUpdate {
  return (
    typeof value.enabled === 'boolean' &&
    typeof value.host === 'string' &&
    typeof value.port === 'number' &&
    typeof value.secure === 'boolean' &&
    typeof value.requireTls === 'boolean' &&
    typeof value.username === 'string' &&
    isPasswordAction(value.passwordAction) &&
    (value.password === undefined || typeof value.password === 'string') &&
    (value.passwordAction !== 'replace' || typeof value.password === 'string') &&
    typeof value.mailFrom === 'string' &&
    typeof value.mailReplyTo === 'string' &&
    typeof value.testTo === 'string' &&
    typeof value.revision === 'number'
  );
}

function isPasswordAction(value: unknown): value is EmailPasswordAction {
  return value === 'keep' || value === 'replace' || value === 'clear';
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
  return error instanceof Error ? error.message.slice(0, 300) : 'Unknown email settings error';
}
