import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { decryptSecret, encryptSecret } from '@/lib/secret-box';

const emailSettingsId = 'default';
const maximumPasswordBytes = 4 * 1024;

export type EmailSettingsSource = 'database' | 'environment';
export type EmailPasswordAction = 'keep' | 'replace' | 'clear';

export type EffectiveEmailSettings = {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  requireTls: boolean;
  username: string;
  password: string;
  passwordConfigured: boolean;
  mailFrom: string;
  mailReplyTo: string;
  testTo: string;
  revision: number;
  source: EmailSettingsSource;
};

export type PublicEmailSettings = Omit<EffectiveEmailSettings, 'password'>;

export type EmailSettingsUpdate = {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  requireTls: boolean;
  username: string;
  passwordAction: EmailPasswordAction;
  password?: string;
  mailFrom: string;
  mailReplyTo: string;
  testTo: string;
  revision: number;
};

export class InvalidEmailSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEmailSettingsError';
  }
}

export class EmailSettingsConflictError extends Error {
  constructor() {
    super('邮件配置已在其他页面更新，请刷新后重试。');
    this.name = 'EmailSettingsConflictError';
  }
}

export async function getEmailSettings(): Promise<EffectiveEmailSettings> {
  const stored = await prisma.emailSettings.findUnique({ where: { id: emailSettingsId } });
  if (!stored) return getEnvironmentEmailSettings();

  const password = stored.passwordEncrypted ? decryptSecret(stored.passwordEncrypted) : '';
  return {
    enabled: stored.enabled,
    host: stored.host,
    port: stored.port,
    secure: stored.secure,
    requireTls: stored.requireTls,
    username: stored.username,
    password,
    passwordConfigured: Boolean(password),
    mailFrom: stored.mailFrom,
    mailReplyTo: stored.mailReplyTo,
    testTo: stored.testTo,
    revision: stored.revision,
    source: 'database'
  };
}

export async function getPublicEmailSettings(): Promise<PublicEmailSettings> {
  const stored = await prisma.emailSettings.findUnique({ where: { id: emailSettingsId } });
  if (!stored) return toPublicEmailSettings(getEnvironmentEmailSettings());

  return {
    enabled: stored.enabled,
    host: stored.host,
    port: stored.port,
    secure: stored.secure,
    requireTls: stored.requireTls,
    username: stored.username,
    passwordConfigured: Boolean(stored.passwordEncrypted),
    mailFrom: stored.mailFrom,
    mailReplyTo: stored.mailReplyTo,
    testTo: stored.testTo,
    revision: stored.revision,
    source: 'database'
  };
}

export async function updateEmailSettings(input: EmailSettingsUpdate): Promise<PublicEmailSettings> {
  if (!Number.isInteger(input.revision) || input.revision < 0) throw new InvalidEmailSettingsError('邮件配置版本无效。');
  if (!isPasswordAction(input.passwordAction)) throw new InvalidEmailSettingsError('邮件密码操作无效。');

  const stored = await prisma.emailSettings.findUnique({ where: { id: emailSettingsId } });
  if (stored ? stored.revision !== input.revision : input.revision !== 0) throw new EmailSettingsConflictError();

  const environment = stored ? null : getEnvironmentEmailSettings();
  const normalized = normalizeEmailSettings(input);
  const passwordEncrypted = getUpdatedPasswordEnvelope(input, stored?.passwordEncrypted ?? null, environment?.password || '');
  validateAuthenticationPair(normalized.username, Boolean(passwordEncrypted));

  const data = {
    enabled: normalized.enabled,
    host: normalized.host,
    port: normalized.port,
    secure: normalized.secure,
    requireTls: normalized.requireTls,
    username: normalized.username,
    passwordEncrypted,
    mailFrom: normalized.mailFrom,
    mailReplyTo: normalized.mailReplyTo,
    testTo: normalized.testTo
  };

  const revision = input.revision + 1;
  if (!stored) {
    try {
      await prisma.emailSettings.create({ data: { id: emailSettingsId, ...data, revision } });
    } catch (error) {
      if (isUniqueConstraintError(error)) throw new EmailSettingsConflictError();
      throw error;
    }
  } else {
    const updated = await prisma.emailSettings.updateMany({
      where: { id: emailSettingsId, revision: input.revision },
      data: { ...data, revision: { increment: 1 } }
    });
    if (updated.count !== 1) throw new EmailSettingsConflictError();
  }

  return {
    ...normalized,
    passwordConfigured: Boolean(passwordEncrypted),
    revision,
    source: 'database'
  };
}

function getEnvironmentEmailSettings(): EffectiveEmailSettings {
  const host = normalizeLegacySingleLine(process.env.SMTP_HOST, 253);
  const mailFrom = normalizeLegacySingleLine(process.env.MAIL_FROM, 320);
  const username = normalizeLegacySingleLine(process.env.SMTP_USER, 320);
  const password = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '';
  const port = parseEnvironmentInteger(process.env.SMTP_PORT, 587, 1, 65_535);
  const secure = parseEnvironmentBoolean(process.env.SMTP_SECURE, port === 465);

  return {
    enabled: Boolean(host && mailFrom),
    host,
    port,
    secure,
    requireTls: secure ? false : parseEnvironmentBoolean(process.env.SMTP_REQUIRE_TLS, port === 587),
    username,
    password,
    passwordConfigured: Boolean(password),
    mailFrom,
    mailReplyTo: normalizeOptionalEnvironmentEmail(process.env.MAIL_REPLY_TO),
    testTo: normalizeOptionalEnvironmentEmail(process.env.SMTP_TEST_TO),
    revision: 0,
    source: 'environment'
  };
}

function normalizeEmailSettings(input: EmailSettingsUpdate) {
  if (typeof input.enabled !== 'boolean' || typeof input.secure !== 'boolean' || typeof input.requireTls !== 'boolean') {
    throw new InvalidEmailSettingsError('邮件服务开关或加密选项无效。');
  }
  if (!Number.isInteger(input.port) || input.port < 1 || input.port > 65_535) {
    throw new InvalidEmailSettingsError('SMTP 端口必须是 1 到 65535 之间的整数。');
  }

  const host = normalizeHost(input.host);
  const username = normalizeSingleLine(input.username, 320, 'SMTP 用户名');
  const mailFrom = normalizeSingleLine(input.mailFrom, 320, '发件人');
  const mailReplyTo = normalizeOptionalEmail(input.mailReplyTo, '回复邮箱');
  const testTo = normalizeOptionalEmail(input.testTo, '测试收件邮箱');
  if (input.enabled && (!host || !mailFrom)) {
    throw new InvalidEmailSettingsError('启用邮件投递时必须填写 SMTP 主机和发件人。');
  }

  return {
    enabled: input.enabled,
    host,
    port: input.port,
    secure: input.secure,
    requireTls: input.secure ? false : input.requireTls,
    username,
    mailFrom,
    mailReplyTo,
    testTo
  };
}

function getUpdatedPasswordEnvelope(input: EmailSettingsUpdate, storedEnvelope: string | null, environmentPassword: string) {
  if (input.passwordAction === 'clear') return null;
  if (input.passwordAction === 'keep') {
    if (storedEnvelope) return storedEnvelope;
    return environmentPassword ? encryptSecret(validatePassword(environmentPassword)) : null;
  }
  return encryptSecret(validatePassword(input.password));
}

function validatePassword(value: unknown) {
  if (typeof value !== 'string' || !value || Buffer.byteLength(value, 'utf8') > maximumPasswordBytes) {
    throw new InvalidEmailSettingsError(`SMTP 密码必须为非空字符串，且不能超过 ${maximumPasswordBytes} 字节。`);
  }
  return value;
}

function validateAuthenticationPair(username: string, passwordConfigured: boolean) {
  if (Boolean(username) !== passwordConfigured) {
    throw new InvalidEmailSettingsError('SMTP 用户名与密码必须同时配置或同时清除。');
  }
}

function normalizeHost(value: unknown) {
  const host = normalizeSingleLine(value, 253, 'SMTP 主机');
  if (host && /[\s/?#@]/.test(host)) throw new InvalidEmailSettingsError('SMTP 主机格式无效。');
  return host;
}

function normalizeSingleLine(value: unknown, maximumLength: number, label: string) {
  if (typeof value !== 'string') throw new InvalidEmailSettingsError(`${label}格式无效。`);
  if (/[\u0000-\u001f\u007f]/.test(value)) throw new InvalidEmailSettingsError(`${label}不能包含控制字符。`);
  const normalized = value.trim();
  if (normalized.length > maximumLength) throw new InvalidEmailSettingsError(`${label}过长。`);
  return normalized;
}

function normalizeOptionalEmail(value: unknown, label: string) {
  const email = normalizeSingleLine(value, 254, label).toLowerCase();
  if (email && !isEmailAddress(email)) throw new InvalidEmailSettingsError(`${label}格式无效。`);
  return email;
}

function normalizeOptionalEnvironmentEmail(value: string | undefined) {
  const email = value?.trim().toLowerCase() || '';
  return isEmailAddress(email) ? email : '';
}

function isEmailAddress(value: string) {
  if (!value || value.length > 254 || /[\r\n,;<>]/.test(value)) return false;
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(value);
}

function normalizeLegacySingleLine(value: string | undefined, maximumLength: number) {
  return (value || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maximumLength);
}

function parseEnvironmentInteger(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function parseEnvironmentBoolean(value: string | undefined, fallback: boolean) {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return fallback;
}

function toPublicEmailSettings(settings: EffectiveEmailSettings): PublicEmailSettings {
  return {
    enabled: settings.enabled,
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    requireTls: settings.requireTls,
    username: settings.username,
    passwordConfigured: settings.passwordConfigured,
    mailFrom: settings.mailFrom,
    mailReplyTo: settings.mailReplyTo,
    testTo: settings.testTo,
    revision: settings.revision,
    source: settings.source
  };
}

function isPasswordAction(value: unknown): value is EmailPasswordAction {
  return value === 'keep' || value === 'replace' || value === 'clear';
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
