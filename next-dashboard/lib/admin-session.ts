import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

export const adminSessionCookieName = 'subscription_admin_session';
export const adminSessionMaxAgeSeconds = 12 * 60 * 60;

type SessionPayload = {
  expiresAt: number;
};

const sessionGlobal = globalThis as typeof globalThis & {
  __subscriptionAdminDevelopmentSecret?: string;
};
const developmentSessionSecret =
  sessionGlobal.__subscriptionAdminDevelopmentSecret ??
  (sessionGlobal.__subscriptionAdminDevelopmentSecret = randomBytes(32).toString('base64url'));

export function isAdminSessionConfigured() {
  return process.env.NODE_ENV !== 'production' || isStrongSecret(process.env.ADMIN_SESSION_SECRET);
}

export function createAdminSessionToken() {
  const payload: SessionPayload = {
    expiresAt: Date.now() + adminSessionMaxAgeSeconds * 1000
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function hasValidAdminSession(request: Request) {
  const token = readCookie(request.headers.get('cookie'), adminSessionCookieName);
  if (!token) return false;

  const [encodedPayload, signature, ...extraParts] = token.split('.');
  if (!encodedPayload || !signature || extraParts.length > 0) return false;
  if (!safeEquals(signature, sign(encodedPayload))) return false;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Partial<SessionPayload>;
    return typeof payload.expiresAt === 'number' && Number.isFinite(payload.expiresAt) && payload.expiresAt > Date.now();
  } catch {
    return false;
  }
}

function sign(payload: string) {
  const secret = getSessionSecret();
  if (!secret) return '';
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function getSessionSecret() {
  if (isStrongSecret(process.env.ADMIN_SESSION_SECRET)) return process.env.ADMIN_SESSION_SECRET;
  return process.env.NODE_ENV === 'production' ? null : developmentSessionSecret;
}

function isStrongSecret(value: string | undefined): value is string {
  return typeof value === 'string' && Buffer.byteLength(value, 'utf8') >= 32;
}

function safeEquals(value: string, expected: string) {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return valueBuffer.length === expectedBuffer.length && timingSafeEqual(valueBuffer, expectedBuffer);
}

function readCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;

  for (const cookie of cookieHeader.split(';')) {
    const separatorIndex = cookie.indexOf('=');
    if (separatorIndex < 0) continue;

    const cookieName = cookie.slice(0, separatorIndex).trim();
    if (cookieName !== name) continue;

    try {
      return decodeURIComponent(cookie.slice(separatorIndex + 1).trim());
    } catch {
      return null;
    }
  }

  return null;
}
