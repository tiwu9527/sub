import { NextResponse } from 'next/server';
import {
  adminSessionCookieName,
  createAdminSessionToken,
  getAdminSessionCookieOptions,
  hasValidAdminSession
} from '@/lib/admin-session';
import {
  AdminCredentialConflictError,
  getAdminPasswordValidationError,
  replaceAdminPassword,
  verifyAdminPassword
} from '@/lib/admin-credentials';
import { getClientKey, hasSameOrigin } from '@/lib/request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const maximumBodyBytes = 8 * 1024;
const failureWindowMs = 15 * 60 * 1000;
const maximumFailuresPerWindow = 6;
const maximumFailureBuckets = 1000;
const passwordFailureBuckets = new Map<string, number[]>();

export async function PATCH(request: Request) {
  if (!(await hasValidAdminSession(request))) {
    return apiError('ADMIN_SESSION_REQUIRED', '管理员会话已失效，请重新登录。', 401);
  }
  if (!hasSameOrigin(request)) return apiError('INVALID_ORIGIN', '请求来源无效。', 403);
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return apiError('INVALID_CONTENT_TYPE', '请求格式必须为 JSON。', 415);
  }

  const payload = await readPayload(request);
  if (!payload.ok) return payload.response;

  const { currentPassword, newPassword } = payload.value;
  const validationError = getAdminPasswordValidationError(newPassword);
  if (validationError) return apiError('INVALID_NEW_PASSWORD', validationError, 400);
  if (currentPassword === newPassword) {
    return apiError('PASSWORD_UNCHANGED', '新密码不能与当前密码相同。', 400);
  }

  const clientKey = getClientKey(request);
  const retryAfterSeconds = getRetryAfterSeconds(clientKey);
  if (retryAfterSeconds > 0) {
    return apiError('TOO_MANY_ATTEMPTS', '当前密码验证失败次数过多，请稍后再试。', 429, {
      'Retry-After': String(retryAfterSeconds)
    });
  }

  try {
    const verification = await verifyAdminPassword(currentPassword);
    if (!verification.configured) {
      return apiError('ADMIN_AUTH_NOT_CONFIGURED', '管理员认证尚未完成服务端配置。', 503);
    }
    if (!verification.valid) {
      recordFailure(clientKey);
      return apiError('CURRENT_PASSWORD_INCORRECT', '当前密码不正确。', 403);
    }
    if (!verification.sessionGeneration) {
      return apiError('CREDENTIAL_STATE_CHANGED', '管理员凭据状态已变化，请重新登录后再试。', 409);
    }

    const sessionGeneration = await replaceAdminPassword(newPassword, verification.sessionGeneration);
    passwordFailureBuckets.delete(clientKey);
    const response = json({ ok: true, message: '管理员密码已更新，其他设备上的旧会话已失效。' });
    response.cookies.set(
      adminSessionCookieName,
      createAdminSessionToken(sessionGeneration),
      getAdminSessionCookieOptions(request)
    );
    return response;
  } catch (error) {
    if (error instanceof AdminCredentialConflictError) {
      return apiError('CREDENTIAL_CONFLICT', '管理员凭据刚刚发生变化，请重新登录后再试。', 409);
    }
    console.error('Failed to update administrator password.', getSafeError(error));
    return apiError('PASSWORD_UPDATE_FAILED', '暂时无法更新管理员密码，请稍后再试。', 503);
  }
}

async function readPayload(
  request: Request
): Promise<
  | { ok: true; value: { currentPassword: string; newPassword: string } }
  | { ok: false; response: NextResponse }
> {
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

  if (!isRecord(value) || typeof value.currentPassword !== 'string' || typeof value.newPassword !== 'string') {
    return { ok: false, response: apiError('INVALID_PAYLOAD', '当前密码和新密码均为必填项。', 400) };
  }
  if (
    !value.currentPassword ||
    value.currentPassword.length > 4096 ||
    Buffer.byteLength(value.currentPassword, 'utf8') > 4096
  ) {
    return { ok: false, response: apiError('INVALID_CURRENT_PASSWORD', '当前密码格式无效。', 400) };
  }

  return { ok: true, value: { currentPassword: value.currentPassword, newPassword: value.newPassword } };
}

function getRetryAfterSeconds(key: string) {
  const now = Date.now();
  pruneFailureBuckets(now);
  const failures = passwordFailureBuckets.get(key) || [];
  if (failures.length < maximumFailuresPerWindow) return 0;
  return Math.max(1, Math.ceil((failureWindowMs - (now - failures[0])) / 1000));
}

function recordFailure(key: string) {
  const now = Date.now();
  const failures = (passwordFailureBuckets.get(key) || []).filter((timestamp) => now - timestamp < failureWindowMs);
  failures.push(now);
  passwordFailureBuckets.set(key, failures);
  while (passwordFailureBuckets.size > maximumFailureBuckets) {
    const oldestKey = passwordFailureBuckets.keys().next().value as string | undefined;
    if (!oldestKey) break;
    passwordFailureBuckets.delete(oldestKey);
  }
}

function pruneFailureBuckets(now: number) {
  for (const [key, failures] of passwordFailureBuckets) {
    if (!failures.some((timestamp) => now - timestamp < failureWindowMs)) passwordFailureBuckets.delete(key);
  }
}

function json(body: Record<string, unknown>, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0', ...headers }
  });
}

function apiError(code: string, message: string, status: number, headers: Record<string, string> = {}) {
  return json({ ok: false, code, message }, status, headers);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getSafeError(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 300) : 'Unknown password update error';
}
