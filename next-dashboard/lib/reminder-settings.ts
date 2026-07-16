import 'server-only';

import { Prisma, type ReminderSettings as StoredReminderSettings } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const reminderSettingsId = 'default';
const defaultIntervalMinutes = 60;
const maximumUpdateAttempts = 3;

export type ReminderSettingsSource = 'database' | 'environment';

export type EffectiveReminderSettings = {
  enabled: boolean;
  intervalMinutes: number;
  runOnStart: boolean;
  maxAttempts: number;
  nextScheduledAt: string | null;
  revision: number;
  source: ReminderSettingsSource;
};

export type ReminderSettingsUpdate = {
  enabled: boolean;
  intervalMinutes: number;
  runOnStart: boolean;
  maxAttempts: number;
  revision: number;
};

export type ScheduledReminderClaim = {
  due: boolean;
  settings: EffectiveReminderSettings;
  message: string;
};

export class InvalidReminderSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidReminderSettingsError';
  }
}

export class ReminderSettingsConflictError extends Error {
  constructor() {
    super('提醒配置已在其他页面更新，请刷新后重试。');
    this.name = 'ReminderSettingsConflictError';
  }
}

export async function getReminderSettings(): Promise<EffectiveReminderSettings> {
  const stored = await prisma.reminderSettings.findUnique({ where: { id: reminderSettingsId } });
  return stored ? fromStoredReminderSettings(stored) : getEnvironmentReminderSettings();
}

export async function updateReminderSettings(input: ReminderSettingsUpdate): Promise<EffectiveReminderSettings> {
  const normalized = normalizeReminderSettings(input);

  for (let attempt = 0; attempt < maximumUpdateAttempts; attempt += 1) {
    const stored = await prisma.reminderSettings.findUnique({ where: { id: reminderSettingsId } });
    if (stored ? stored.revision !== input.revision : input.revision !== 0) throw new ReminderSettingsConflictError();

    const nextScheduledAt = getNextScheduledAtAfterUpdate(stored, normalized);
    const data = {
      enabled: normalized.enabled,
      intervalMinutes: normalized.intervalMinutes,
      runOnStart: normalized.runOnStart,
      maxAttempts: normalized.maxAttempts,
      nextScheduledAt
    };
    const revision = input.revision + 1;

    if (!stored) {
      try {
        const created = await prisma.reminderSettings.create({
          data: { id: reminderSettingsId, ...data, revision }
        });
        return fromStoredReminderSettings(created);
      } catch (error) {
        if (isUniqueConstraintError(error)) throw new ReminderSettingsConflictError();
        throw error;
      }
    }

    const updated = await prisma.reminderSettings.updateMany({
      where: {
        id: reminderSettingsId,
        revision: input.revision,
        nextScheduledAt: stored.nextScheduledAt
      },
      data: { ...data, revision: { increment: 1 } }
    });
    if (updated.count === 1) {
      return {
        ...normalized,
        nextScheduledAt: nextScheduledAt?.toISOString() ?? null,
        revision,
        source: 'database'
      };
    }
  }

  throw new ReminderSettingsConflictError();
}

export async function claimScheduledReminder(options: { startup: boolean }): Promise<ScheduledReminderClaim> {
  const now = new Date();
  const stored = await prisma.reminderSettings.findUnique({ where: { id: reminderSettingsId } });
  if (stored) return claimStoredReminder(stored, options, now, true);

  const environment = getEnvironmentReminderSettings();
  if (!environment.enabled) {
    return { due: false, settings: environment, message: '自动提醒任务已停用。' };
  }

  const forcedByStartup = options.startup && environment.runOnStart;
  const shouldClaim = !options.startup || forcedByStartup;
  const nextScheduledAt = addMinutes(now, environment.intervalMinutes);
  try {
    const created = await prisma.reminderSettings.create({
      data: {
        id: reminderSettingsId,
        enabled: environment.enabled,
        intervalMinutes: environment.intervalMinutes,
        runOnStart: environment.runOnStart,
        maxAttempts: environment.maxAttempts,
        nextScheduledAt,
        revision: 1
      }
    });
    return {
      due: shouldClaim,
      settings: fromStoredReminderSettings(created),
      message: shouldClaim ? '提醒任务已到达执行时间。' : '尚未到达下一次自动检查时间。'
    };
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
  }

  const concurrent = await prisma.reminderSettings.findUnique({ where: { id: reminderSettingsId } });
  if (!concurrent) {
    return { due: false, settings: environment, message: '提醒配置正在更新，请稍后重试。' };
  }
  return claimStoredReminder(concurrent, { startup: false }, now, false);
}

async function claimStoredReminder(
  stored: StoredReminderSettings,
  options: { startup: boolean },
  now: Date,
  allowStartupForce: boolean
): Promise<ScheduledReminderClaim> {
  const settings = fromStoredReminderSettings(stored);
  if (!stored.enabled) return { due: false, settings, message: '自动提醒任务已停用。' };

  const forcedByStartup = allowStartupForce && options.startup && stored.runOnStart;
  const due = forcedByStartup || !stored.nextScheduledAt || stored.nextScheduledAt.getTime() <= now.getTime();
  if (!due) return { due: false, settings, message: '尚未到达下一次自动检查时间。' };

  const nextScheduledAt = addMinutes(now, stored.intervalMinutes);
  const claimed = await prisma.reminderSettings.updateMany({
    where: {
      id: reminderSettingsId,
      enabled: true,
      intervalMinutes: stored.intervalMinutes,
      runOnStart: stored.runOnStart,
      revision: stored.revision,
      nextScheduledAt: stored.nextScheduledAt
    },
    data: { nextScheduledAt }
  });
  if (claimed.count !== 1) {
    return { due: false, settings, message: '提醒任务已被其他进程领取。' };
  }

  return {
    due: true,
    settings: { ...settings, nextScheduledAt: nextScheduledAt.toISOString() },
    message: '提醒任务已到达执行时间。'
  };
}

function getEnvironmentReminderSettings(): EffectiveReminderSettings {
  const configuredInterval = parseEnvironmentInteger(process.env.REMINDER_CHECK_INTERVAL_MINUTES, defaultIntervalMinutes, 0, 1440);
  return {
    enabled: configuredInterval > 0,
    intervalMinutes: configuredInterval > 0 ? configuredInterval : defaultIntervalMinutes,
    runOnStart: parseEnvironmentBoolean(process.env.REMINDER_RUN_ON_START, true),
    maxAttempts: parseEnvironmentInteger(process.env.REMINDER_MAX_ATTEMPTS, 3, 1, 10),
    nextScheduledAt: null,
    revision: 0,
    source: 'environment'
  };
}

function normalizeReminderSettings(input: ReminderSettingsUpdate) {
  if (typeof input.enabled !== 'boolean' || typeof input.runOnStart !== 'boolean') {
    throw new InvalidReminderSettingsError('提醒任务开关无效。');
  }
  if (!Number.isInteger(input.intervalMinutes) || input.intervalMinutes < 1 || input.intervalMinutes > 1440) {
    throw new InvalidReminderSettingsError('检查间隔必须是 1 到 1440 之间的整数。');
  }
  if (!Number.isInteger(input.maxAttempts) || input.maxAttempts < 1 || input.maxAttempts > 10) {
    throw new InvalidReminderSettingsError('最大尝试次数必须是 1 到 10 之间的整数。');
  }
  if (!Number.isInteger(input.revision) || input.revision < 0) {
    throw new InvalidReminderSettingsError('提醒配置版本无效。');
  }

  return {
    enabled: input.enabled,
    intervalMinutes: input.intervalMinutes,
    runOnStart: input.runOnStart,
    maxAttempts: input.maxAttempts
  };
}

function getNextScheduledAtAfterUpdate(
  stored: StoredReminderSettings | null,
  settings: ReturnType<typeof normalizeReminderSettings>
) {
  if (!settings.enabled) return null;
  if (stored?.enabled && stored.intervalMinutes === settings.intervalMinutes && stored.nextScheduledAt) {
    return stored.nextScheduledAt;
  }
  return addMinutes(new Date(), settings.intervalMinutes);
}

function fromStoredReminderSettings(stored: StoredReminderSettings): EffectiveReminderSettings {
  return {
    enabled: stored.enabled,
    intervalMinutes: stored.intervalMinutes,
    runOnStart: stored.runOnStart,
    maxAttempts: stored.maxAttempts,
    nextScheduledAt: stored.nextScheduledAt?.toISOString() ?? null,
    revision: stored.revision,
    source: 'database'
  };
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function parseEnvironmentInteger(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, minimum), maximum) : fallback;
}

function parseEnvironmentBoolean(value: string | undefined, fallback: boolean) {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return fallback;
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
