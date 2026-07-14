import 'server-only';

import nodemailer from 'nodemailer';

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  requireTls: boolean;
  auth?: { user: string; pass: string };
  from: string;
  replyTo: string;
  testTo: string;
};

export type SmtpConfigResult = { ok: true; value: SmtpConfig } | { ok: false; message: string };

export function getSmtpConfig(): SmtpConfigResult {
  const host = process.env.SMTP_HOST?.trim() || '';
  const from = normalizeSingleLine(process.env.MAIL_FROM, 320);
  const replyTo = normalizeSingleLine(process.env.MAIL_REPLY_TO, 254);
  const testTo = normalizeEmailAddress(process.env.SMTP_TEST_TO);
  const user = process.env.SMTP_USER?.trim() || '';
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '';
  const port = Number.parseInt(process.env.SMTP_PORT || '587', 10);
  const secureSetting = normalizeBooleanSetting(process.env.SMTP_SECURE);
  const requireTlsSetting = normalizeBooleanSetting(process.env.SMTP_REQUIRE_TLS);

  if (!host || !from || !Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false, message: '邮件服务尚未配置，请设置 SMTP_HOST、SMTP_PORT 和 MAIL_FROM。' };
  }
  if (secureSetting === null) {
    return { ok: false, message: 'SMTP_SECURE 只能设置为 true 或 false。' };
  }
  if (requireTlsSetting === null) {
    return { ok: false, message: 'SMTP_REQUIRE_TLS 只能设置为 true 或 false。' };
  }
  if ((user && !pass) || (!user && pass)) {
    return { ok: false, message: 'SMTP_USER 与 SMTP_PASS 必须同时配置。' };
  }
  if (process.env.SMTP_TEST_TO?.trim() && !testTo) {
    return { ok: false, message: 'SMTP_TEST_TO 不是有效的邮箱地址。' };
  }

  const secure = secureSetting ?? port === 465;
  const requireTls = secure ? false : (requireTlsSetting ?? port === 587);

  return {
    ok: true,
    value: {
      host,
      port,
      secure,
      requireTls,
      auth: user && pass ? { user, pass } : undefined,
      from,
      replyTo,
      testTo
    }
  };
}

export function createSmtpTransport(
  config: SmtpConfig,
  poolOptions: false | { maxConnections: number; maxMessages: number } = false
) {
  const transportOptions = {
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: config.requireTls,
    auth: config.auth,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000
  };

  if (poolOptions) {
    return nodemailer.createTransport({
      ...transportOptions,
      pool: true,
      maxConnections: poolOptions.maxConnections,
      maxMessages: poolOptions.maxMessages
    });
  }

  return nodemailer.createTransport(transportOptions);
}

export function normalizeEmailAddress(value: unknown) {
  if (typeof value !== 'string') return '';
  const email = value.trim().toLowerCase();
  if (email.length > 254 || /[\r\n,;<>]/.test(email)) return '';
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(email)
    ? email
    : '';
}

export function normalizeSingleLine(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function escapeEmailHtml(value: string) {
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

export function getSmtpErrorMessage(error: unknown) {
  const candidate = isRecord(error) ? error : {};
  const code = typeof candidate.code === 'string' ? candidate.code.trim().toUpperCase() : '';
  const responseCode = typeof candidate.responseCode === 'number' ? candidate.responseCode : 0;
  const rawResponse =
    typeof candidate.response === 'string'
      ? candidate.response
      : error instanceof Error
        ? error.message
        : '';
  const response = rawResponse.replace(/\s+/g, ' ').trim();

  if (code === 'EAUTH' || responseCode === 535 || /invalid login|authentication failed|username and password not accepted/i.test(response)) {
    return 'SMTP 认证失败，请检查账号和授权码；部分邮箱服务不能使用网页登录密码。';
  }
  if (responseCode === 530 || /authentication required/i.test(response)) {
    return 'SMTP 服务要求认证，请同时配置 SMTP_USER 和 SMTP_PASS。';
  }
  if (['ECONNECTION', 'ESOCKET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND'].includes(code)) {
    return '无法连接 SMTP 服务，请检查主机、端口、加密方式和服务器网络。';
  }
  if (code === 'ETLS' || /certificate|tls|ssl|starttls/i.test(response)) {
    return 'SMTP TLS 连接失败，请检查 SMTP_SECURE、SMTP_REQUIRE_TLS 和服务端证书。';
  }
  if ([550, 551, 553].includes(responseCode)) {
    return 'SMTP 拒绝发件人或收件人地址，请检查 MAIL_FROM 和收件邮箱。';
  }

  return response ? `邮件服务返回错误：${response.slice(0, 240)}` : '邮件服务暂时不可用，请稍后重试。';
}

function normalizeBooleanSetting(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
