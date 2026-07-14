import 'server-only';

import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  dashboardIconNames,
  defaultDashboardConfig,
  emptyDashboardState,
  type DashboardIconName,
  type DashboardState,
  type DashboardSubscription,
  type DashboardWorkspaceConfig
} from '@/lib/dashboard-state';
import { isFrontendDisplayMode } from '@/lib/frontend-display-mode';
import { isTemplateSlug } from '@/lib/templates';
import { isDashboardTheme } from '@/lib/themes';

const workspaceId = 'default';
const maximumSubscriptions = 250;
const maximumMembersPerSubscription = 100;

export class DashboardStateConflictError extends Error {
  constructor() {
    super('工作区已在其他页面更新，请刷新后重试。');
    this.name = 'DashboardStateConflictError';
  }
}

export class InvalidDashboardStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDashboardStateError';
  }
}

export async function getDashboardState(options: { publicView?: boolean } = {}): Promise<DashboardState> {
  const workspace = await prisma.workspaceSettings.findUnique({
    where: { id: workspaceId },
    include: {
      subscriptions: {
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        include: { members: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] } }
      }
    }
  });

  if (!workspace) return { ...emptyDashboardState, config: { ...defaultDashboardConfig }, items: [] };

  return {
    initialized: true,
    revision: workspace.revision,
    config: {
      workspaceName: workspace.workspaceName,
      monthlyBudget: workspace.monthlyBudget,
      currency: workspace.currency,
      reminderDays: String(workspace.reminderDays),
      copyrightText: workspace.copyrightText
    },
    theme: isDashboardTheme(workspace.theme) ? workspace.theme : 'forest',
    frontendTemplate: isTemplateSlug(workspace.frontendTemplate) ? workspace.frontendTemplate : 'cards',
    frontendDisplayMode: isFrontendDisplayMode(workspace.frontendDisplayMode) ? workspace.frontendDisplayMode : 'system',
    items: workspace.subscriptions.map((subscription) => ({
      id: subscription.id,
      name: subscription.name,
      plan: subscription.plan,
      tag: subscription.tag,
      price: subscription.price,
      cycle: subscription.cycle,
      nextBilling: subscription.nextBilling,
      members: `${subscription.members.length} 人`,
      memberEmails: options.publicView ? [] : subscription.members.map((member) => member.email),
      memberDetails: subscription.members.map((member) => ({
        id: member.id,
        name: member.name,
        email: options.publicView ? '' : member.email,
        expiresAt: member.expiresAt
      })),
      status: subscription.status === 'paused' ? 'paused' : 'active',
      iconName: isDashboardIconName(subscription.iconName) ? subscription.iconName : 'cloud',
      tone: subscription.tone
    }))
  };
}

export async function replaceDashboardState(value: unknown, expectedRevision: number) {
  const normalized = normalizeDashboardState(value);

  try {
    return await prisma.$transaction(
      async (transaction) => {
        const existingWorkspace = await transaction.workspaceSettings.findUnique({ where: { id: workspaceId } });
        if (!existingWorkspace) {
          if (expectedRevision !== 0) throw new DashboardStateConflictError();
          await transaction.workspaceSettings.create({
            data: {
              id: workspaceId,
              ...toWorkspaceData(normalized.config, normalized),
              revision: 1
            }
          });
        } else {
          const updated = await transaction.workspaceSettings.updateMany({
            where: { id: workspaceId, revision: expectedRevision },
            data: {
              ...toWorkspaceData(normalized.config, normalized),
              revision: { increment: 1 }
            }
          });
          if (updated.count !== 1) throw new DashboardStateConflictError();
        }

        const subscriptionIds: string[] = [];
        for (const [position, subscription] of normalized.items.entries()) {
          subscriptionIds.push(subscription.id);
          await upsertSubscription(transaction, subscription, position);
        }

        await transaction.subscription.deleteMany({
          where: {
            workspaceId,
            ...(subscriptionIds.length > 0 ? { id: { notIn: subscriptionIds } } : {})
          }
        });

        return { revision: expectedRevision + 1 };
      },
      { maxWait: 5_000, timeout: 20_000 }
    );
  } catch (error) {
    if (error instanceof DashboardStateConflictError) throw error;
    if (isUniqueConstraintError(error)) throw new DashboardStateConflictError();
    throw error;
  }
}

function normalizeDashboardState(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.items) || !isRecord(value.config)) {
    throw new InvalidDashboardStateError('工作区数据格式无效。');
  }
  if (value.items.length > maximumSubscriptions) {
    throw new InvalidDashboardStateError(`订阅数量不能超过 ${maximumSubscriptions} 条。`);
  }

  const items: DashboardSubscription[] = [];
  const seenSubscriptionIds = new Set<string>();
  for (const candidate of value.items) {
    const subscription = normalizeSubscription(candidate);
    if (seenSubscriptionIds.has(subscription.id)) throw new InvalidDashboardStateError('订阅 ID 不能重复。');
    seenSubscriptionIds.add(subscription.id);
    items.push(subscription);
  }

  const config = normalizeConfig(value.config);
  return {
    items,
    config,
    theme: isDashboardTheme(value.theme) ? value.theme : 'forest',
    frontendTemplate: typeof value.frontendTemplate === 'string' && isTemplateSlug(value.frontendTemplate) ? value.frontendTemplate : 'cards',
    frontendDisplayMode: isFrontendDisplayMode(value.frontendDisplayMode) ? value.frontendDisplayMode : 'system'
  };
}

function normalizeSubscription(value: unknown): DashboardSubscription {
  if (!isRecord(value)) throw new InvalidDashboardStateError('订阅数据格式无效。');
  const id = normalizeText(value.id, 160);
  const name = normalizeText(value.name, 120);
  const nextBilling = normalizeDate(value.nextBilling);
  if (!id || !name || !nextBilling) throw new InvalidDashboardStateError('订阅名称或扣费日期无效。');

  const memberValues = Array.isArray(value.memberDetails) ? value.memberDetails : [];
  if (memberValues.length > maximumMembersPerSubscription) {
    throw new InvalidDashboardStateError(`每项订阅最多包含 ${maximumMembersPerSubscription} 位成员。`);
  }

  const members = [];
  const seenEmails = new Set<string>();
  for (const candidate of memberValues) {
    if (!isRecord(candidate)) throw new InvalidDashboardStateError('成员数据格式无效。');
    const email = normalizeEmail(candidate.email);
    if (!email) throw new InvalidDashboardStateError('成员邮箱格式无效。');
    if (seenEmails.has(email)) continue;
    seenEmails.add(email);
    members.push({
      id: createMemberId(id, email),
      name: normalizeText(candidate.name, 80) || getMemberNameFromEmail(email),
      email,
      expiresAt: normalizeDate(candidate.expiresAt) || nextBilling
    });
  }

  const iconName = isDashboardIconName(value.iconName) ? value.iconName : 'cloud';
  return {
    id,
    name,
    plan: normalizeText(value.plan, 160) || '标准方案',
    tag: normalizeText(value.tag, 80) || 'SaaS',
    price: normalizeText(value.price, 40) || '¥0.00',
    cycle: normalizeText(value.cycle, 40) || '月付',
    nextBilling,
    members: `${members.length} 人`,
    memberEmails: members.map((member) => member.email),
    memberDetails: members,
    status: value.status === 'paused' ? 'paused' : 'active',
    iconName,
    tone: normalizeText(value.tone, 160) || getDefaultTone(iconName)
  };
}

function normalizeConfig(value: Record<string, unknown>): DashboardWorkspaceConfig {
  const parsedReminderDays = typeof value.reminderDays === 'string' ? Number(value.reminderDays) : value.reminderDays;
  const reminderDays = typeof parsedReminderDays === 'number' && Number.isInteger(parsedReminderDays)
    ? Math.min(Math.max(parsedReminderDays, 0), 365)
    : 3;

  return {
    workspaceName: normalizeText(value.workspaceName, 120) || defaultDashboardConfig.workspaceName,
    monthlyBudget: normalizeText(value.monthlyBudget, 40) || defaultDashboardConfig.monthlyBudget,
    currency: normalizeText(value.currency, 12) || defaultDashboardConfig.currency,
    reminderDays: String(reminderDays),
    copyrightText: normalizeText(value.copyrightText, 200) || defaultDashboardConfig.copyrightText
  };
}

async function upsertSubscription(
  transaction: Prisma.TransactionClient,
  subscription: DashboardSubscription,
  position: number
) {
  await transaction.subscription.upsert({
    where: { id: subscription.id },
    create: {
      id: subscription.id,
      workspaceId,
      name: subscription.name,
      plan: subscription.plan,
      tag: subscription.tag,
      price: subscription.price,
      cycle: subscription.cycle,
      nextBilling: subscription.nextBilling,
      status: subscription.status === 'paused' ? 'paused' : 'active',
      iconName: subscription.iconName,
      tone: subscription.tone,
      position
    },
    update: {
      workspaceId,
      name: subscription.name,
      plan: subscription.plan,
      tag: subscription.tag,
      price: subscription.price,
      cycle: subscription.cycle,
      nextBilling: subscription.nextBilling,
      status: subscription.status === 'paused' ? 'paused' : 'active',
      iconName: subscription.iconName,
      tone: subscription.tone,
      position
    }
  });

  const memberIds: string[] = [];
  for (const [memberPosition, member] of subscription.memberDetails.entries()) {
    memberIds.push(member.id);
    await transaction.subscriptionMember.upsert({
      where: { id: member.id },
      create: {
        id: member.id,
        subscriptionId: subscription.id,
        name: member.name,
        email: member.email,
        expiresAt: member.expiresAt,
        position: memberPosition
      },
      update: {
        subscriptionId: subscription.id,
        name: member.name,
        email: member.email,
        expiresAt: member.expiresAt,
        position: memberPosition
      }
    });
  }

  await transaction.subscriptionMember.deleteMany({
    where: {
      subscriptionId: subscription.id,
      ...(memberIds.length > 0 ? { id: { notIn: memberIds } } : {})
    }
  });
}

function toWorkspaceData(config: DashboardWorkspaceConfig, state: ReturnType<typeof normalizeDashboardState>) {
  return {
    workspaceName: config.workspaceName,
    monthlyBudget: config.monthlyBudget,
    currency: config.currency,
    reminderDays: Number(config.reminderDays),
    copyrightText: config.copyrightText,
    theme: state.theme,
    frontendTemplate: state.frontendTemplate,
    frontendDisplayMode: state.frontendDisplayMode
  };
}

function createMemberId(subscriptionId: string, email: string) {
  return `member_${createHash('sha256').update(`${subscriptionId}\u0000${email}`).digest('hex').slice(0, 32)}`;
}

function normalizeText(value: unknown, maximumLength: number) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maximumLength);
}

function normalizeDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? value : '';
}

function normalizeEmail(value: unknown) {
  if (typeof value !== 'string') return '';
  const email = value.trim().toLowerCase();
  if (email.length > 254 || /[\r\n,;<>]/.test(email)) return '';
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(email)
    ? email
    : '';
}

function getMemberNameFromEmail(email: string) {
  const localPart = email.split('@')[0]?.replace(/[._-]+/g, ' ').trim();
  return localPart || '成员';
}

function isDashboardIconName(value: unknown): value is DashboardIconName {
  return typeof value === 'string' && dashboardIconNames.some((name) => name === value);
}

function getDefaultTone(iconName: DashboardIconName) {
  if (iconName === 'film') return 'from-[#FF5A5F] via-[#FF7A84] to-[#FFB0B5]';
  if (iconName === 'music') return 'from-[#34C759] via-[#63D981] to-[#A7EEC0]';
  return 'from-[#7C5CFF] via-[#9275FF] to-[#C8B8FF]';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
