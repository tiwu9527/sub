import { NextResponse } from 'next/server';
import { hasValidAdminSession } from '@/lib/admin-session';
import {
  createSmtpTransport,
  escapeEmailHtml,
  getSmtpConfig,
  getSmtpErrorMessage,
  normalizeEmailAddress
} from '@/lib/email-service';

export const runtime = 'nodejs';

const maxRequestBytes = 4 * 1024;
const rateLimitWindowMs = 60 * 1000;
const maxRequestsPerWindow = 3;
const maxRequestBuckets = 1000;
const requestBuckets = new Map<string, number[]>();

export async function POST(request: Request) {
  if (!(await hasValidAdminSession(request))) {
    return apiError('ADMIN_SESSION_REQUIRED', '管理员会话已失效，请重新登录。', 401);
  }
  if (!hasSameOrigin(request)) {
    return apiError('INVALID_ORIGIN', '请求来源无效。', 403);
  }
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return apiError('INVALID_CONTENT_TYPE', '请求格式必须为 JSON。', 415);
  }
  if (!consumeRateLimit(getClientKey(request))) {
    return apiError('RATE_LIMITED', '测试邮件发送过于频繁，请稍后再试。', 429);
  }

  const payload = await readPayload(request);
  if (!payload.ok) return payload.response;

  let smtpConfig: Awaited<ReturnType<typeof getSmtpConfig>>;
  try {
    smtpConfig = await getSmtpConfig();
  } catch (error) {
    console.error('Failed to load SMTP configuration for test email.', getSafeError(error));
    return apiError('EMAIL_SETTINGS_UNAVAILABLE', '暂时无法读取邮件投递配置。', 503);
  }
  if (!smtpConfig.ok) {
    return apiError('SMTP_NOT_CONFIGURED', smtpConfig.message, 503);
  }

  const recipient = payload.email || smtpConfig.value.testTo;
  if (!recipient) {
    return apiError('TEST_RECIPIENT_REQUIRED', '请输入测试收件邮箱，或在服务端配置 SMTP_TEST_TO。', 400);
  }

  const transport = createSmtpTransport(smtpConfig.value);
  const timeZone = process.env.APP_TIME_ZONE || 'Asia/Shanghai';
  const sentAt = formatDateTime(new Date(), timeZone);

  try {
    await transport.verify();
    await transport.sendMail({
      from: smtpConfig.value.from,
      replyTo: smtpConfig.value.replyTo || undefined,
      to: recipient,
      subject: '续费管家 · 邮件服务测试',
      text: [
        '邮件服务测试成功',
        '',
        '这是一封来自续费管家的 SMTP 测试邮件。',
        `发送时间：${sentAt}`,
        '',
        '收到此邮件说明当前 SMTP 连接、认证和发件配置可以正常工作。'
      ].join('\n'),
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;color:#17211b;line-height:1.7;max-width:620px;margin:0 auto;padding:24px">
          <div style="font-size:12px;font-weight:700;color:#0f766e;margin-bottom:8px">续费管家 · 配置检测</div>
          <h1 style="font-size:22px;line-height:1.35;margin:0 0 18px">邮件服务测试成功</h1>
          <p>这是一封来自续费管家的 SMTP 测试邮件。</p>
          <div style="background:#f4f7f5;border:1px solid #dde4e0;border-radius:12px;padding:16px 18px;margin:20px 0">
            <div><strong>发送时间：</strong>${escapeEmailHtml(sentAt)}</div>
          </div>
          <p style="color:#68746d">收到此邮件说明当前 SMTP 连接、认证和发件配置可以正常工作。</p>
        </div>
      `.trim()
    });

    return NextResponse.json({ ok: true, message: `测试邮件已发送到 ${recipient}。`, sentAt: new Date().toISOString() });
  } catch (error) {
    const message = getSmtpErrorMessage(error);
    console.error('Failed to send SMTP test email.', message);
    return apiError('SMTP_TEST_FAILED', message, 502);
  } finally {
    transport.close();
  }
}

async function readPayload(
  request: Request
): Promise<{ ok: true; email: string } | { ok: false; response: NextResponse }> {
  let rawBody = '';

  try {
    rawBody = await request.text();
  } catch {
    return { ok: false, response: apiError('INVALID_BODY', '无法读取请求内容。', 400) };
  }

  if (Buffer.byteLength(rawBody, 'utf8') > maxRequestBytes) {
    return { ok: false, response: apiError('INVALID_BODY_SIZE', '请求内容过大。', 413) };
  }

  let value: unknown;
  try {
    value = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return { ok: false, response: apiError('INVALID_JSON', '请求内容不是有效的 JSON。', 400) };
  }

  if (!isRecord(value)) {
    return { ok: false, response: apiError('INVALID_PAYLOAD', '测试邮件参数无效。', 400) };
  }

  const rawEmail = typeof value.email === 'string' ? value.email.trim() : '';
  const email = normalizeEmailAddress(rawEmail);
  if (rawEmail && !email) {
    return { ok: false, response: apiError('INVALID_EMAIL', '测试收件邮箱格式无效。', 400) };
  }

  return { ok: true, email };
}

function formatDateTime(date: Date, timeZone: string) {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

function hasSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;

  try {
    const expectedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || request.headers.get('host');
    return Boolean(expectedHost) && new URL(origin).host.toLowerCase() === expectedHost?.toLowerCase();
  } catch {
    return false;
  }
}

function consumeRateLimit(key: string) {
  const now = Date.now();
  pruneRequestBuckets(now);
  const recent = (requestBuckets.get(key) || []).filter((timestamp) => now - timestamp < rateLimitWindowMs);
  if (recent.length >= maxRequestsPerWindow) {
    requestBuckets.set(key, recent);
    return false;
  }

  recent.push(now);
  requestBuckets.set(key, recent);
  trimOldestRequestBuckets();
  return true;
}

function pruneRequestBuckets(now: number) {
  for (const [key, timestamps] of requestBuckets) {
    if (!timestamps.some((timestamp) => now - timestamp < rateLimitWindowMs)) requestBuckets.delete(key);
  }
}

function trimOldestRequestBuckets() {
  while (requestBuckets.size > maxRequestBuckets) {
    const oldestKey = requestBuckets.keys().next().value as string | undefined;
    if (!oldestKey) return;
    requestBuckets.delete(oldestKey);
  }
}

function getClientKey(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'local';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function apiError(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

function getSafeError(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 300) : 'Unknown email settings error';
}
