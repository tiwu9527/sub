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
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const credentials = payload as Partial<{ username: unknown; password: unknown }>;
  const username = typeof credentials.username === 'string' ? credentials.username : '';
  const password = typeof credentials.password === 'string' ? credentials.password : '';
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (process.env.NODE_ENV === 'production' && (!configuredPassword || !isAdminSessionConfigured())) {
    return NextResponse.json({ ok: false, error: 'ADMIN_AUTH_NOT_CONFIGURED' }, { status: 503 });
  }

  const expectedUsername = process.env.ADMIN_USERNAME || defaultAdminUsername;
  const expectedPassword = configuredPassword || defaultAdminPassword;

  if (safeEquals(username, expectedUsername) && safeEquals(password, expectedPassword)) {
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
