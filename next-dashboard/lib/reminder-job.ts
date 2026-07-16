import 'server-only';

import { randomUUID } from 'crypto';
import { Prisma, type ReminderDelivery, type Subscription, type SubscriptionMember } from '@prisma/client';
import { createSmtpTransport, getSmtpConfig, getSmtpErrorMessage } from '@/lib/email-service';
import { prisma } from '@/lib/prisma';
import { buildReminderContent, getCalendarNow } from '@/lib/reminder-content';
import { claimScheduledReminder, getReminderSettings } from '@/lib/reminder-settings';
import { getEffectiveSubscriptionStatus } from '@/lib/subscription-status';

const schedulerLeaseKey = 'reminder-delivery-job';
const schedulerLeaseMs = 30 * 60 * 1000;
const staleDeliveryMs = 35 * 60 * 1000;

export type ReminderJobSource = 'manual' | 'scheduled';

export type ReminderJobResult = {
  ok: boolean;
  status: 'completed' | 'failed' | 'locked' | 'skipped';
  runId?: string;
  checked: number;
  eligible: number;
  sent: number;
  failed: number;
  skipped: number;
  message: string;
};

type SubscriptionWithMembers = Subscription & { members: SubscriptionMember[] };

type ClaimedRecipient = {
  delivery: ReminderDelivery;
  subscription: SubscriptionWithMembers;
  member: SubscriptionMember;
};

export async function runReminderJob(options: {
  source: ReminderJobSource;
  subscriptionId?: string;
  startup?: boolean;
}): Promise<ReminderJobResult> {
  const owner = randomUUID();
  const leaseAcquired = await acquireSchedulerLease(owner);
  if (!leaseAcquired) {
    return {
      ok: false,
      status: 'locked',
      checked: 0,
      eligible: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      message: '另一项提醒任务正在执行，请稍后重试。'
    };
  }

  let runId = '';
  try {
    const scheduler = options.source === 'scheduled'
      ? await claimScheduledReminder({ startup: options.startup === true })
      : { due: true, settings: await getReminderSettings(), message: '' };

    if (!scheduler.due) {
      return {
        ok: true,
        status: 'skipped',
        checked: 0,
        eligible: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
        message: scheduler.message
      };
    }

    const maximumAttempts = scheduler.settings.maxAttempts;
    const run = await prisma.reminderRun.create({ data: { source: options.source } });
    runId = run.id;
    const workspace = await prisma.workspaceSettings.findUnique({ where: { id: 'default' } });
    const subscriptions = workspace
      ? await prisma.subscription.findMany({
          where: {
            workspaceId: workspace.id,
            status: { not: 'paused' },
            ...(options.subscriptionId ? { id: options.subscriptionId } : {})
          },
          include: { members: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] } },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
        })
      : [];

    const calendarNow = getCalendarNow(process.env.APP_TIME_ZONE || 'Asia/Shanghai');
    const reminderDays = workspace?.reminderDays ?? 3;
    const eligibleSubscriptions = subscriptions.filter(
      (subscription) =>
        getEffectiveSubscriptionStatus(
          { status: subscription.status === 'paused' ? 'paused' : 'active', nextBilling: subscription.nextBilling },
          reminderDays,
          calendarNow
        ) === 'due'
    );

    if (eligibleSubscriptions.length === 0) {
      const message = options.subscriptionId
        ? subscriptions.length === 0
          ? '订阅不存在或已暂停。'
          : '该订阅尚未进入提醒时间。'
        : '当前没有进入提醒时间的订阅。';
      await completeRun(runId, {
        status: 'completed',
        checkedCount: subscriptions.length,
        eligibleCount: 0,
        sentCount: 0,
        failedCount: 0,
        skippedCount: 0,
        message
      });
      return {
        ok: true,
        status: 'completed',
        runId,
        checked: subscriptions.length,
        eligible: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
        message
      };
    }

    const recipientCount = eligibleSubscriptions.reduce((total, subscription) => total + subscription.members.length, 0);
    if (recipientCount === 0) {
      const message = '已找到待提醒订阅，但没有配置有效收件人。';
      await completeRun(runId, {
        status: 'completed',
        checkedCount: subscriptions.length,
        eligibleCount: eligibleSubscriptions.length,
        sentCount: 0,
        failedCount: 0,
        skippedCount: 0,
        message
      });
      return {
        ok: true,
        status: 'completed',
        runId,
        checked: subscriptions.length,
        eligible: eligibleSubscriptions.length,
        sent: 0,
        failed: 0,
        skipped: 0,
        message
      };
    }

    const smtpConfig = await getSmtpConfig();
    if (!smtpConfig.ok) {
      await completeRun(runId, {
        status: 'failed',
        checkedCount: subscriptions.length,
        eligibleCount: eligibleSubscriptions.length,
        sentCount: 0,
        failedCount: 0,
        skippedCount: 0,
        message: smtpConfig.message
      });
      return {
        ok: false,
        status: 'failed',
        runId,
        checked: subscriptions.length,
        eligible: eligibleSubscriptions.length,
        sent: 0,
        failed: 0,
        skipped: 0,
        message: smtpConfig.message
      };
    }

    const claims: ClaimedRecipient[] = [];
    let skipped = 0;
    for (const subscription of eligibleSubscriptions) {
      for (const member of subscription.members) {
        const delivery = await claimDelivery(subscription, member, options.source, maximumAttempts);
        if (delivery) claims.push({ delivery, subscription, member });
        else skipped += 1;
      }
    }

    let sent = 0;
    let failed = 0;
    let firstFailure = '';
    if (claims.length > 0) {
      const transport = createSmtpTransport(smtpConfig.value, { maxConnections: 3, maxMessages: 100 });
      try {
        await Promise.all(
          claims.map(async ({ delivery, subscription, member }) => {
            try {
              const content = buildReminderContent(subscription, member, calendarNow);
              await transport.sendMail({
                from: smtpConfig.value.from,
                replyTo: smtpConfig.value.replyTo || undefined,
                to: { name: member.name, address: member.email },
                subject: content.subject,
                text: content.text,
                html: content.html
              });
              await prisma.reminderDelivery.update({
                where: { id: delivery.id },
                data: { status: 'sent', sentAt: new Date(), lastError: null }
              });
              sent += 1;
            } catch (error) {
              const message = getSmtpErrorMessage(error);
              firstFailure ||= message;
              failed += 1;
              await prisma.reminderDelivery.update({
                where: { id: delivery.id },
                data: { status: 'failed', lastError: message.slice(0, 500) }
              });
              console.error('Failed to deliver persisted subscription reminder.', message);
            }
          })
        );
      } finally {
        transport.close();
      }
    }

    const status = failed > 0 && sent === 0 ? 'failed' : 'completed';
    const message = buildRunMessage({
      checked: subscriptions.length,
      eligible: eligibleSubscriptions.length,
      sent,
      failed,
      skipped,
      firstFailure
    });
    await completeRun(runId, {
      status,
      checkedCount: subscriptions.length,
      eligibleCount: eligibleSubscriptions.length,
      sentCount: sent,
      failedCount: failed,
      skippedCount: skipped,
      message
    });

    return {
      ok: status === 'completed',
      status,
      runId,
      checked: subscriptions.length,
      eligible: eligibleSubscriptions.length,
      sent,
      failed,
      skipped,
      message
    };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : '提醒任务执行失败。';
    if (runId) {
      await completeRun(runId, {
        status: 'failed',
        checkedCount: 0,
        eligibleCount: 0,
        sentCount: 0,
        failedCount: 0,
        skippedCount: 0,
        message
      }).catch(() => undefined);
    }
    console.error('Reminder job failed.', message);
    return {
      ok: false,
      status: 'failed',
      runId: runId || undefined,
      checked: 0,
      eligible: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      message: '提醒任务执行失败，请检查数据库和邮件服务日志。'
    };
  } finally {
    await releaseSchedulerLease(owner).catch(() => undefined);
  }
}

export async function getReminderJobStatus() {
  const [settings, lastRun, recentDeliveries] = await Promise.all([
    getReminderSettings(),
    prisma.reminderRun.findFirst({ orderBy: { startedAt: 'desc' } }),
    prisma.reminderDelivery.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        recipientName: true,
        recipientEmail: true,
        targetDate: true,
        status: true,
        attemptCount: true,
        sentAt: true,
        lastError: true,
        updatedAt: true
      }
    })
  ]);

  return {
    ...settings,
    cronConfigured: Buffer.byteLength(process.env.REMINDER_CRON_SECRET || '', 'utf8') >= 32,
    lastRun,
    recentDeliveries
  };
}

async function claimDelivery(
  subscription: SubscriptionWithMembers,
  member: SubscriptionMember,
  source: ReminderJobSource,
  maximumAttempts: number
) {
  const uniqueKey = {
    subscriptionId: subscription.id,
    targetDate: subscription.nextBilling,
    recipientEmail: member.email
  };

  try {
    return await prisma.reminderDelivery.create({
      data: {
        ...uniqueKey,
        memberId: member.id,
        recipientName: member.name,
        status: 'sending',
        source
      }
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
  }

  const existing = await prisma.reminderDelivery.findUnique({
    where: { subscriptionId_targetDate_recipientEmail: uniqueKey }
  });
  if (!existing || existing.status === 'sent') return null;

  if (existing.attemptCount >= maximumAttempts) return null;
  const staleBefore = new Date(Date.now() - staleDeliveryMs);
  const claimed = await prisma.reminderDelivery.updateMany({
    where: {
      id: existing.id,
      attemptCount: existing.attemptCount,
      OR: [{ status: 'failed' }, { status: 'sending', claimedAt: { lt: staleBefore } }]
    },
    data: {
      status: 'sending',
      attemptCount: { increment: 1 },
      claimedAt: new Date(),
      memberId: member.id,
      recipientName: member.name,
      source,
      lastError: null
    }
  });
  if (claimed.count !== 1) return null;
  return prisma.reminderDelivery.findUnique({ where: { id: existing.id } });
}

async function acquireSchedulerLease(owner: string) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + schedulerLeaseMs);
  const updated = await prisma.schedulerLease.updateMany({
    where: { key: schedulerLeaseKey, expiresAt: { lt: now } },
    data: { owner, expiresAt }
  });
  if (updated.count === 1) return true;

  try {
    await prisma.schedulerLease.create({ data: { key: schedulerLeaseKey, owner, expiresAt } });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return false;
    throw error;
  }
}

async function releaseSchedulerLease(owner: string) {
  await prisma.schedulerLease.updateMany({
    where: { key: schedulerLeaseKey, owner },
    data: { expiresAt: new Date(0) }
  });
}

async function completeRun(
  runId: string,
  data: {
    status: string;
    checkedCount: number;
    eligibleCount: number;
    sentCount: number;
    failedCount: number;
    skippedCount: number;
    message: string;
  }
) {
  await prisma.reminderRun.update({ where: { id: runId }, data: { ...data, completedAt: new Date() } });
  try {
    await prisma.reminderRun.deleteMany({
      where: {
        id: { not: runId },
        startedAt: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
      }
    });
  } catch (error) {
    console.error('Failed to prune old reminder runs.', error instanceof Error ? error.message.slice(0, 300) : 'Unknown error');
  }
}

function buildRunMessage(result: {
  checked: number;
  eligible: number;
  sent: number;
  failed: number;
  skipped: number;
  firstFailure: string;
}) {
  const summary = `提醒检查完成：检查 ${result.checked} 项，命中 ${result.eligible} 项，发送 ${result.sent} 封，失败 ${result.failed} 封，跳过 ${result.skipped} 封。`;
  return result.firstFailure ? `${summary} ${result.firstFailure}` : summary;
}
