import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';

const defaultAdminUsername = 'admin';

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
  const expectedUsername = process.env.ADMIN_USERNAME || defaultAdminUsername;
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedPassword) {
    return NextResponse.json({ ok: false, error: 'ADMIN_PASSWORD is not configured' }, { status: 503 });
  }

  if (safeEquals(username, expectedUsername) && safeEquals(password, expectedPassword)) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false }, { status: 401 });
}
