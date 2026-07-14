import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import {
  adminSessionCookieName,
  adminSessionMaxAgeSeconds,
  createAdminSessionToken,
  hasValidAdminSession,
  isAdminSessionConfigured
} from '@/lib/admin-session';

const defaultAdminUsername = 'admin';
const defaultAdminPassword = 'admin';
const maxLoginBodyBytes = 4 * 1024;
const loginFailureWindowMs = 15 * 60 * 1000;
const maxLoginFailuresPerWindow = 8;
const maxLoginFailureBuckets = 1000;
const loginFailureBuckets = new Map<string, number[]>();

function safeEquals(value: string, expected: string) {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);

  if (valueBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(valueBuffer, expectedBuffer);
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    const rawBody = await request.text();
    if (!rawBody || Buffer.byteLength(rawBody, 'utf8') > maxLoginBodyBytes) {
      return NextResponse.json({ ok: false, error: 'INVALID_BODY_SIZE' }, { status: 413 });
    }
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const credentials = payload as Partial<{ username: unknown; password: unknown }>;
  const username = typeof credentials.username === 'string' ? credentials.username : '';
  const password = typeof credentials.password === 'string' ? credentials.password : '';
  const clientKey = getClientKey(request);
  const retryAfterSeconds = getLoginRetryAfterSeconds(clientKey);
  if (retryAfterSeconds > 0) {
    return NextResponse.json(
      { ok: false, error: 'TOO_MANY_ATTEMPTS', retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
    );
  }

  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (process.env.NODE_ENV === 'production' && (!configuredPassword || !isAdminSessionConfigured())) {
    return NextResponse.json({ ok: false, error: 'ADMIN_AUTH_NOT_CONFIGURED' }, { status: 503 });
  }

  const expectedUsername = process.env.ADMIN_USERNAME || defaultAdminUsername;
  const expectedPassword = configuredPassword || defaultAdminPassword;

  if (safeEquals(username, expectedUsername) && safeEquals(password, expectedPassword)) {
    loginFailureBuckets.delete(clientKey);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(adminSessionCookieName, createAdminSessionToken(), {
      httpOnly: true,
      sameSite: 'strict',
      secure: shouldUseSecureCookie(request),
      maxAge: adminSessionMaxAgeSeconds,
      path: '/'
    });
    return response;
  }

  recordLoginFailure(clientKey);
  return NextResponse.json({ ok: false }, { status: 401 });
}

export function GET(request: Request) {
  const valid = hasValidAdminSession(request);
  return NextResponse.json({ ok: valid }, { status: valid ? 200 : 401 });
}

export function DELETE(request: Request) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(adminSessionCookieName, '', {
    httpOnly: true,
    sameSite: 'strict',
    secure: shouldUseSecureCookie(request),
    expires: new Date(0),
    path: '/'
  });
  return response;
}

function shouldUseSecureCookie(request: Request) {
  const configured = process.env.ADMIN_COOKIE_SECURE?.trim().toLowerCase();
  if (configured === 'true') return true;
  if (configured === 'false') return false;

  const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  return forwardedProtocol ? forwardedProtocol === 'https' : new URL(request.url).protocol === 'https:';
}

function getClientKey(request: Request) {
  return request.headers.get('x-real-ip')?.trim() || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
}

function getLoginRetryAfterSeconds(key: string) {
  const now = Date.now();
  pruneLoginFailureBuckets(now);
  const failures = loginFailureBuckets.get(key) || [];
  if (failures.length < maxLoginFailuresPerWindow) return 0;
  return Math.max(1, Math.ceil((loginFailureWindowMs - (now - failures[0])) / 1000));
}

function recordLoginFailure(key: string) {
  const now = Date.now();
  const failures = (loginFailureBuckets.get(key) || []).filter((timestamp) => now - timestamp < loginFailureWindowMs);
  failures.push(now);
  loginFailureBuckets.set(key, failures);
  while (loginFailureBuckets.size > maxLoginFailureBuckets) {
    const oldestKey = loginFailureBuckets.keys().next().value as string | undefined;
    if (!oldestKey) break;
    loginFailureBuckets.delete(oldestKey);
  }
}

function pruneLoginFailureBuckets(now: number) {
  for (const [key, failures] of loginFailureBuckets) {
    if (!failures.some((timestamp) => now - timestamp < loginFailureWindowMs)) loginFailureBuckets.delete(key);
  }
}
