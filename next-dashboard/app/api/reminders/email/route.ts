import { createHash } from 'crypto';
import nodemailer from 'nodemailer';
import { NextResponse } from 'next/server';
import { hasValidAdminSession } from '@/lib/admin-session';
import { getEffectiveSubscriptionStatus } from '@/lib/subscription-status';

export const runtime = 'nodejs';

const maxRequestBytes = 32 * 1024;
const maxRecipients = 20;
const rateLimitWindowMs = 60 * 1000;
const maxRequestsPerWindow = 5;
const reminderDedupeMs = 10 * 60 * 1000;
const requestBuckets = new Map<string, number[]>();
const recentRecipientSends = new Map<string, number>();

type ReminderMember = {
  name: string;
  email: string;
};

type ReminderSubscription = {
  name: string;
  plan: string;
  price: string;
  cycle: string;
  nextBilling: string;
  status: 'active' | 'due' | 'paused';
};

export async function POST(request: Request) {
  if (!hasValidAdminSession(request)) {
    return apiError('ADMIN_SESSION_REQUIRED', '管理员会话已失效，请重新登录。', 401);
  }

  if (!hasSameOrigin(request)) {
    return apiError('INVALID_ORIGIN', '请求来源无效。', 403);
  }

  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return apiError('INVALID_CONTENT_TYPE', '请求格式必须为 JSON。', 415);
  }

  const clientKey = getClientKey(request);
  if (!consumeRateLimit(clientKey)) {
    return apiError('RATE_LIMITED', '发送过于频繁，请稍后再试。', 429);
  }

  const payload = await readPayload(request);
  if (!payload.ok) return payload.response;

  const { subscription, members, reminderDays } = payload.value;
  const calendarNow = getCalendarNow(process.env.APP_TIME_ZONE || 'Asia/Shanghai');
  if (getEffectiveSubscriptionStatus(subscription, reminderDays, calendarNow) !== 'due') {
    return apiError('SUBSCRIPTION_NOT_DUE', '该订阅尚未进入扣费提醒时间。', 409);
  }

  const smtpConfig = getSmtpConfig();
  if (!smtpConfig.ok) {
    return apiError('SMTP_NOT_CONFIGURED', smtpConfig.message, 503);
  }

  const now = Date.now();
  pruneRecentSends(now);
  const recipients = members.filter((member) => !wasRecentlySent(subscription, member.email, now));
  const skipped = members.length - recipients.length;

  if (recipients.length === 0) {
    return apiError('REMINDER_RECENTLY_SENT', '这些成员最近已经收到过提醒，请稍后再试。', 409);
  }

  const transport = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: smtpConfig.auth,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000
  });

  let sent = 0;
  let failed = 0;

  for (const member of recipients) {
    try {
      const content = buildReminderContent(subscription, member, calendarNow);
      await transport.sendMail({
        from: smtpConfig.from,
        replyTo: smtpConfig.replyTo || undefined,
        to: { name: member.name, address: member.email },
        subject: content.subject,
        text: content.text,
        html: content.html
      });
      recentRecipientSends.set(getReminderKey(subscription, member.email), Date.now());
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error('Failed to send subscription reminder email.', getSafeErrorMessage(error));
    }
  }

  transport.close();

  if (sent === 0) {
    return apiError('SMTP_SEND_FAILED', '邮件暂时未能送达，请检查 SMTP 配置后重试。', 502, { failed, skipped });
  }

  return NextResponse.json({ ok: true, sent, failed, skipped });
}

async function readPayload(request: Request): Promise<
  | { ok: true; value: { subscription: ReminderSubscription; members: ReminderMember[]; reminderDays: number } }
  | { ok: false; response: NextResponse }
> {
  let rawBody = '';

  try {
    rawBody = await request.text();
  } catch {
    return { ok: false, response: apiError('INVALID_BODY', '无法读取请求内容。', 400) };
  }

  if (!rawBody || Buffer.byteLength(rawBody, 'utf8') > maxRequestBytes) {
    return { ok: false, response: apiError('INVALID_BODY_SIZE', '请求内容为空或过大。', 413) };
  }

  let value: unknown;
  try {
    value = JSON.parse(rawBody);
  } catch {
    return { ok: false, response: apiError('INVALID_JSON', '请求内容不是有效的 JSON。', 400) };
  }

  if (!isRecord(value) || !isRecord(value.subscription) || !Array.isArray(value.members)) {
    return { ok: false, response: apiError('INVALID_PAYLOAD', '订阅或成员信息不完整。', 400) };
  }

  const subscription = normalizeSubscription(value.subscription);
  if (!subscription) {
    return { ok: false, response: apiError('INVALID_SUBSCRIPTION', '订阅信息无效。', 400) };
  }

  const reminderDays = normalizeReminderDays(value.reminderDays);
  if (reminderDays === null) {
    return { ok: false, response: apiError('INVALID_REMINDER_DAYS', '提前提醒天数无效。', 400) };
  }

  const members: ReminderMember[] = [];
  const seenEmails = new Set<string>();
  for (const candidate of value.members) {
    if (!isRecord(candidate)) {
      return { ok: false, response: apiError('INVALID_MEMBER', '成员信息无效。', 400) };
    }

    const email = normalizeEmail(candidate.email);
    if (!email) {
      return { ok: false, response: apiError('INVALID_EMAIL', '成员邮箱格式无效。', 400) };
    }
    if (seenEmails.has(email)) continue;

    seenEmails.add(email);
    members.push({
      name: normalizeSingleLine(candidate.name, 80) || '成员',
      email
    });
  }

  if (members.length === 0 || members.length > maxRecipients) {
    return {
      ok: false,
      response: apiError('INVALID_RECIPIENT_COUNT', `每次只能向 1 至 ${maxRecipients} 位成员发送提醒。`, 400)
    };
  }

  return { ok: true, value: { subscription, members, reminderDays } };
}

function normalizeSubscription(value: Record<string, unknown>): ReminderSubscription | null {
  const name = normalizeSingleLine(value.name, 120);
  const plan = normalizeSingleLine(value.plan, 160) || '标准方案';
  const price = normalizeSingleLine(value.price, 40) || '待确认';
  const cycle = normalizeSingleLine(value.cycle, 40) || '待确认';
  const nextBilling = normalizeDate(value.nextBilling);
  const status = value.status;

  if (!name || !nextBilling || (status !== 'active' && status !== 'due' && status !== 'paused')) return null;
  return { name, plan, price, cycle, nextBilling, status };
}

function normalizeDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? value : '';
}

function normalizeReminderDays(value: unknown) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 365 ? parsed : null;
}

function normalizeEmail(value: unknown) {
  if (typeof value !== 'string') return '';
  const email = value.trim().toLowerCase();
  if (email.length > 254 || /[\r\n,;<>]/.test(email)) return '';
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(email)
    ? email
    : '';
}

function normalizeSingleLine(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function buildReminderContent(subscription: ReminderSubscription, member: ReminderMember, today: Date) {
  const daysUntil = getDaysUntil(subscription.nextBilling, today);
  const dueText =
    daysUntil < 0
      ? `已逾期 ${Math.abs(daysUntil)} 天`
      : daysUntil === 0
        ? '今天扣费'
        : daysUntil === 1
          ? '明天扣费'
          : `还有 ${daysUntil} 天扣费`;
  const subject = `续费提醒：${subscription.name} 将于 ${subscription.nextBilling} 扣费`;
  const lines = [
    `${member.name}，您好：`,
    '',
    `您正在使用的订阅「${subscription.name}」即将续费，请及时确认并完成续费。`,
    '',
    `订阅方案：${subscription.plan}`,
    `续费金额：${subscription.price} / ${subscription.cycle}`,
    `扣费日期：${subscription.nextBilling}（${dueText}）`,
    '',
    '如您不再使用该服务，请及时联系管理员调整订阅成员。',
    '',
    '此邮件由续费管家管理员发送。'
  ];

  return {
    subject,
    text: lines.join('\n'),
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;color:#17211b;line-height:1.7;max-width:620px;margin:0 auto;padding:24px">
        <div style="font-size:12px;font-weight:700;color:#0f766e;margin-bottom:8px">续费管家 · 订阅提醒</div>
        <h1 style="font-size:22px;line-height:1.35;margin:0 0 18px">${escapeHtml(subscription.name)} 即将续费</h1>
        <p>${escapeHtml(member.name)}，您好：</p>
        <p>您正在使用的订阅「<strong>${escapeHtml(subscription.name)}</strong>」即将续费，请及时确认并完成续费。</p>
        <div style="background:#f4f7f5;border:1px solid #dde4e0;border-radius:12px;padding:16px 18px;margin:20px 0">
          <div><strong>订阅方案：</strong>${escapeHtml(subscription.plan)}</div>
          <div><strong>续费金额：</strong>${escapeHtml(subscription.price)} / ${escapeHtml(subscription.cycle)}</div>
          <div><strong>扣费日期：</strong>${escapeHtml(subscription.nextBilling)}（${escapeHtml(dueText)}）</div>
        </div>
        <p style="color:#68746d">如您不再使用该服务，请及时联系管理员调整订阅成员。</p>
        <p style="font-size:12px;color:#89948e;margin-top:28px">此邮件由续费管家管理员发送。</p>
      </div>
    `.trim()
  };
}

function getDaysUntil(value: string, today: Date) {
  const [year, month, day] = value.split('-').map(Number);
  const target = new Date(year, month - 1, day).getTime();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((target - todayStart) / (24 * 60 * 60 * 1000));
}

function getCalendarNow(timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return new Date(Number(values.year), Number(values.month) - 1, Number(values.day), 12);
  } catch {
    return new Date();
  }
}

function getSmtpConfig():
  | {
      ok: true;
      host: string;
      port: number;
      secure: boolean;
      auth?: { user: string; pass: string };
      from: string;
      replyTo: string;
    }
  | { ok: false; message: string } {
  const host = process.env.SMTP_HOST?.trim() || '';
  const from = process.env.MAIL_FROM?.trim() || '';
  const user = process.env.SMTP_USER?.trim() || '';
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '';
  const port = Number.parseInt(process.env.SMTP_PORT || '587', 10);

  if (!host || !from || !Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false, message: '邮件服务尚未配置，请设置 SMTP_HOST、SMTP_PORT 和 MAIL_FROM。' };
  }
  if ((user && !pass) || (!user && pass)) {
    return { ok: false, message: 'SMTP_USER 与 SMTP_PASS 必须同时配置。' };
  }

  const secureSetting = process.env.SMTP_SECURE?.trim().toLowerCase();
  const secure = secureSetting === 'true' || (secureSetting !== 'false' && port === 465);

  return {
    ok: true,
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
    from,
    replyTo: process.env.MAIL_REPLY_TO?.trim() || ''
  };
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
  const recent = (requestBuckets.get(key) || []).filter((timestamp) => now - timestamp < rateLimitWindowMs);
  if (recent.length >= maxRequestsPerWindow) {
    requestBuckets.set(key, recent);
    return false;
  }

  recent.push(now);
  requestBuckets.set(key, recent);
  return true;
}

function getClientKey(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'local';
}

function wasRecentlySent(subscription: ReminderSubscription, email: string, now: number) {
  const sentAt = recentRecipientSends.get(getReminderKey(subscription, email));
  return typeof sentAt === 'number' && now - sentAt < reminderDedupeMs;
}

function getReminderKey(subscription: ReminderSubscription, email: string) {
  return createHash('sha256')
    .update(`${subscription.name}\u0000${subscription.nextBilling}\u0000${email}`)
    .digest('hex');
}

function pruneRecentSends(now: number) {
  for (const [key, sentAt] of recentRecipientSends) {
    if (now - sentAt >= reminderDedupeMs) recentRecipientSends.delete(key);
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const replacements: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return replacements[character];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getSafeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 300) : 'Unknown SMTP error';
}

function apiError(code: string, message: string, status: number, details: Record<string, number> = {}) {
  return NextResponse.json({ ok: false, code, message, ...details }, { status });
}
