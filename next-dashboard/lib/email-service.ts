import 'server-only';

import nodemailer from 'nodemailer';
import { getEmailSettings } from '@/lib/email-settings';
import { SecretBoxConfigurationError, SecretBoxDecryptionError } from '@/lib/secret-box';

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

export async function getSmtpConfig(): Promise<SmtpConfigResult> {
  let settings: Awaited<ReturnType<typeof getEmailSettings>>;
  try {
    settings = await getEmailSettings();
  } catch (error) {
    if (error instanceof SecretBoxConfigurationError || error instanceof SecretBoxDecryptionError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }

  const { enabled, host, port, secure, requireTls, username: user, password: pass, mailFrom: from, mailReplyTo: replyTo, testTo } = settings;

  if (!enabled) return { ok: false, message: '邮件投递服务已停用。' };
  if (!host || !from || !Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false, message: '邮件服务尚未配置，请填写 SMTP 主机、端口和发件人。' };
  }
  if ((user && !pass) || (!user && pass)) {
    return { ok: false, message: 'SMTP 用户名与密码必须同时配置。' };
  }
  if (settings.source === 'environment' && process.env.SMTP_TEST_TO?.trim() && !testTo) {
    return { ok: false, message: 'SMTP_TEST_TO 不是有效的邮箱地址。' };
  }

  return {
    ok: true,
    value: {
      host,
      port,
      secure,
      requireTls: secure ? false : requireTls,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
