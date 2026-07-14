import 'server-only';

import { timingSafeEqual } from 'crypto';

export function hasSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;

  try {
    const expectedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || request.headers.get('host');
    return Boolean(expectedHost) && new URL(origin).host.toLowerCase() === expectedHost?.toLowerCase();
  } catch {
    return false;
  }
}

export function hasValidCronAuthorization(request: Request) {
  const secret = process.env.REMINDER_CRON_SECRET || '';
  if (Buffer.byteLength(secret, 'utf8') < 32) return false;

  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  return safeEquals(token, secret);
}

export function isCronAuthorizationConfigured() {
  return Buffer.byteLength(process.env.REMINDER_CRON_SECRET || '', 'utf8') >= 32;
}

export function getClientKey(request: Request) {
  return request.headers.get('x-real-ip')?.trim() || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
}

function safeEquals(value: string, expected: string) {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return valueBuffer.length === expectedBuffer.length && timingSafeEqual(valueBuffer, expectedBuffer);
}
