'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Cloud,
  CreditCard,
  Film,
  LockKeyhole,
  Music2,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  X
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AdminPasswordDialog } from '@/components/AdminPasswordDialog';
import { HeroCard } from '@/components/HeroCard';
import DatePickerField from '@/components/DatePickerField';
import { EmailDeliverySetting } from '@/components/EmailDeliverySetting';
import { QuickPanel } from '@/components/QuickPanel';
import { ReminderSchedulerSetting } from '@/components/ReminderSchedulerSetting';
import { Sidebar } from '@/components/Sidebar';
import type { DashboardNotification, NavView } from '@/components/Sidebar';
import { StatsCard } from '@/components/StatsCard';
import { SubscriptionCard } from '@/components/SubscriptionCard';
import { FrontendDisplayModeSetting } from '@/components/templates/FrontendDisplayModeSetting';
import { FrontendTemplateSetting } from '@/components/templates/FrontendTemplateSetting';
import { statusLabels, subscriptions as initialSubscriptions } from '@/lib/data';
import type { Stat, Subscription, SubscriptionMember, SubscriptionStatus } from '@/lib/data';
import {
  defaultDashboardConfig,
  type DashboardState,
  type DashboardSubscription,
  type DashboardWorkspaceConfig
} from '@/lib/dashboard-state';
import { frontendTemplateStorageKey, isTemplateSlug } from '@/lib/templates';
import type { TemplateSlug } from '@/lib/templates';
import { dashboardThemeStorageKey, isDashboardTheme } from '@/lib/themes';
import type { DashboardTheme } from '@/lib/themes';
import { getEffectiveSubscriptionStatus, sortSubscriptionsByStatus } from '@/lib/subscription-status';
import {
  defaultFrontendDisplayMode,
  frontendDisplayModeStorageKey,
  isFrontendDisplayMode
} from '@/lib/frontend-display-mode';
import type { FrontendDisplayMode } from '@/lib/frontend-display-mode';

type NewSubscriptionForm = {
  name: string;
  plan: string;
  tag: string;
  price: string;
  cycle: string;
  nextBilling: string;
  members: string;
  memberEmails: string;
  memberDetails: SubscriptionMember[];
};

type LoginForm = {
  username: string;
  password: string;
};

type WorkspaceConfig = DashboardWorkspaceConfig;
type PersistedSubscription = DashboardSubscription;

type OverviewStatAction = 'analytics' | 'subscriptions' | 'nextBilling' | 'due';

type OverviewStatItem = {
  stat: Stat;
  action: OverviewStatAction;
  ariaLabel: string;
  targetQuery?: string;
};

const authStorageKey = 'subscription-dashboard-admin-session';
const subscriptionStorageKey = 'subscription-dashboard-items';
const configStorageKey = 'subscription-dashboard-workspace-config';
const serverMigrationStorageKey = 'subscription-dashboard-server-migrated';

const emptyForm: NewSubscriptionForm = {
  name: '',
  plan: '',
  tag: 'SaaS',
  price: '',
  cycle: '月付',
  nextBilling: '',
  members: '1 人',
  memberEmails: '',
  memberDetails: []
};

const defaultConfig: WorkspaceConfig = defaultDashboardConfig;

const billingCycleOptions = [
  { value: '月付', months: 1 },
  { value: '季付', months: 3 },
  { value: '年付', months: 12 }
] as const;

type BillingCycle = (typeof billingCycleOptions)[number]['value'];

const subscriptionNameOptions = [
  'Apple One',
  'Netflix',
  'Spotify',
  'YouTube Premium',
  'ChatGPT Plus',
  'iCloud+',
  'Notion',
  'Figma',
  'GitHub Copilot',
  'Microsoft 365'
];

const subscriptionPlanOptions = [
  '个人版',
  '家庭版',
  '团队版',
  '基础版',
  '标准版',
  '专业版',
  'Premium',
  'Family Plan',
  'Pro Plan',
  'Annual Plan'
];

const iconRegistry = {
  cloud: Cloud,
  film: Film,
  music: Music2
} satisfies Record<string, LucideIcon>;

type IconName = keyof typeof iconRegistry;

const iconPool: Array<{ iconName: IconName; icon: LucideIcon; tone: string }> = [
  { iconName: 'cloud', icon: Cloud, tone: 'from-[#7C5CFF] via-[#9275FF] to-[#C8B8FF]' },
  { iconName: 'film', icon: Film, tone: 'from-[#FF5A5F] via-[#FF7A84] to-[#FFB0B5]' },
  { iconName: 'music', icon: Music2, tone: 'from-[#34C759] via-[#63D981] to-[#A7EEC0]' }
];

const millisecondsPerDay = 24 * 60 * 60 * 1000;

function parseAmount(value: string) {
  const match = value.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function isBillingCycle(value: string): value is BillingCycle {
  return billingCycleOptions.some((option) => option.value === value);
}

function normalizeBillingCycle(cycle: string): BillingCycle {
  const trimmedCycle = cycle.trim();
  const normalizedCycle = trimmedCycle.toLowerCase();

  if (isBillingCycle(trimmedCycle)) return trimmedCycle;
  if (normalizedCycle.includes('年') || normalizedCycle.includes('annual') || normalizedCycle.includes('year')) return '年付';
  if (normalizedCycle.includes('季') || normalizedCycle.includes('quarter')) return '季付';

  return '月付';
}

function getBillingCycleMonths(cycle: string) {
  const normalizedCycle = normalizeBillingCycle(cycle);
  return billingCycleOptions.find((option) => option.value === normalizedCycle)?.months ?? 1;
}

function getMonthlyCostFromPrice(price: string, cycle: string) {
  return parseAmount(price) / getBillingCycleMonths(cycle);
}

function getMonthlyCost(subscription: Subscription) {
  return getMonthlyCostFromPrice(subscription.price, subscription.cycle);
}

function parseBillingDate(value: string) {
  const billingDate = new Date(`${value}T00:00:00`);
  return Number.isNaN(billingDate.getTime()) ? null : billingDate;
}

function getDaysUntil(date: Date) {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

  return Math.round((targetStart - todayStart) / millisecondsPerDay);
}

function formatMoney(amount: number, currency: string) {
  const normalizedAmount = amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2);
  return `${currency}${normalizedAmount}`;
}

function formatBillingDate(date: Date) {
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

function getReminderDays(value: string) {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isFinite(parsedValue) ? Math.max(parsedValue, 0) : 3;
}

function getBillingNote(subscriptionName: string, daysUntil: number) {
  if (daysUntil < 0) return `${subscriptionName} 已逾期 ${Math.abs(daysUntil)} 天`;
  if (daysUntil === 0) return `${subscriptionName} 今天扣费`;
  if (daysUntil === 1) return `${subscriptionName} 明天扣费`;

  return `${subscriptionName} 还有 ${daysUntil} 天`;
}

function parseMemberEmails(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\s,;，；]+/)
        .map((email) => email.trim().toLowerCase())
        .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    )
  );
}

function formatMemberEmails(emails: string[] | undefined) {
  return Array.isArray(emails) ? emails.join(', ') : '';
}

function getMemberNameFromEmail(email: string) {
  const localPart = email.split('@')[0]?.replace(/[._-]+/g, ' ').trim();
  return localPart || '成员';
}

function getMemberCountLabel(count: number) {
  return `${count} 人`;
}

function buildMemberDetails(memberEmails: string[], expiresAt: string): SubscriptionMember[] {
  return memberEmails.map((email, index) => ({
    id: `${email.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'member'}-${index}`,
    name: getMemberNameFromEmail(email),
    email,
    expiresAt
  }));
}

function restoreMemberDetails(value: unknown, memberEmails: string[], fallbackExpiresAt: string): SubscriptionMember[] {
  if (!Array.isArray(value)) return buildMemberDetails(memberEmails, fallbackExpiresAt);

  const restoredMembers = value
    .map((member, index) => {
      if (!member || typeof member !== 'object') return null;

      const candidate = member as Partial<SubscriptionMember>;
      if (typeof candidate.email !== 'string' || candidate.email.trim().length === 0) return null;

      const email = candidate.email.trim().toLowerCase();
      return {
        id: typeof candidate.id === 'string' && candidate.id.trim().length > 0 ? candidate.id : `${email.replace(/[^a-z0-9]+/g, '-')}-${index}`,
        name: typeof candidate.name === 'string' && candidate.name.trim().length > 0 ? candidate.name.trim() : getMemberNameFromEmail(email),
        email,
        expiresAt:
          typeof candidate.expiresAt === 'string' && candidate.expiresAt.trim().length > 0 ? candidate.expiresAt.trim() : fallbackExpiresAt
      };
    })
    .filter((member): member is SubscriptionMember => Boolean(member));

  return restoredMembers.length > 0 ? restoredMembers : buildMemberDetails(memberEmails, fallbackExpiresAt);
}

function mergeMemberDetailsFromEmails(existingMembers: SubscriptionMember[], memberEmails: string[], fallbackExpiresAt: string) {
  return memberEmails.map((email, index) => {
    const normalizedEmail = email.trim().toLowerCase();
    const existingMember = existingMembers.find((member) => member.email.toLowerCase() === normalizedEmail);

    return (
      existingMember ?? {
        id: `${normalizedEmail.replace(/[^a-z0-9]+/g, '-') || 'member'}-${index}`,
        name: getMemberNameFromEmail(normalizedEmail),
        email: normalizedEmail,
        expiresAt: fallbackExpiresAt
      }
    );
  });
}

function normalizeFormMemberDetails(memberDetails: SubscriptionMember[], fallbackExpiresAt: string) {
  return memberDetails
    .map((member, index) => {
      const email = member.email.trim().toLowerCase();
      if (!email) return null;

      return {
        id: member.id || `${email.replace(/[^a-z0-9]+/g, '-') || 'member'}-${index}`,
        name: member.name.trim() || getMemberNameFromEmail(email),
        email,
        expiresAt: member.expiresAt || fallbackExpiresAt
      };
    })
    .filter((member): member is SubscriptionMember => Boolean(member));
}

function isIconName(value: unknown): value is IconName {
  return typeof value === 'string' && value in iconRegistry;
}

function resolveIconName(subscription: Subscription, index: number): IconName {
  const match = (Object.entries(iconRegistry) as Array<[IconName, LucideIcon]>).find(([, icon]) => icon === subscription.icon);
  return match?.[0] ?? iconPool[index % iconPool.length].iconName;
}

function serializeSubscriptions(subscriptions: Subscription[]): PersistedSubscription[] {
  return subscriptions.map((subscription, index) => {
    const { icon: _icon, ...serializable } = subscription;
    return {
      ...serializable,
      status: subscription.status === 'paused' ? 'paused' : 'active',
      iconName: resolveIconName(subscription, index)
    };
  });
}

function restoreSubscription(value: unknown, index: number): Subscription | null {
  if (!value || typeof value !== 'object') return null;

  const subscription = value as Partial<PersistedSubscription>;
  if (typeof subscription.id !== 'string' || typeof subscription.name !== 'string') return null;

  const fallbackIcon = iconPool[index % iconPool.length];
  const iconName = isIconName(subscription.iconName) ? subscription.iconName : fallbackIcon.iconName;
  const status: SubscriptionStatus = subscription.status === 'paused' ? 'paused' : 'active';
  const nextBilling = typeof subscription.nextBilling === 'string' ? subscription.nextBilling : '2026-07-15';
  const storedMemberEmails = Array.isArray(subscription.memberEmails)
    ? subscription.memberEmails.filter((email): email is string => typeof email === 'string').map((email) => email.trim().toLowerCase())
    : [];
  const memberDetails = restoreMemberDetails(subscription.memberDetails, storedMemberEmails, nextBilling);
  const memberEmails = memberDetails.length > 0 ? memberDetails.map((member) => member.email) : storedMemberEmails;

  return {
    id: subscription.id,
    name: subscription.name,
    plan: typeof subscription.plan === 'string' ? subscription.plan : '',
    tag: typeof subscription.tag === 'string' ? subscription.tag : 'SaaS',
    price: typeof subscription.price === 'string' ? subscription.price : '¥0.00',
    cycle: normalizeBillingCycle(typeof subscription.cycle === 'string' ? subscription.cycle : '月付'),
    nextBilling,
    members: typeof subscription.members === 'string' ? subscription.members : getMemberCountLabel(memberDetails.length),
    memberEmails,
    memberDetails,
    status,
    icon: iconRegistry[iconName],
    tone: typeof subscription.tone === 'string' ? subscription.tone : fallbackIcon.tone
  };
}

function restoreSubscriptions(rawValue: string | null): Subscription[] | null {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return null;

    return parsed
      .map((subscription, index) => restoreSubscription(subscription, index))
      .filter((subscription): subscription is Subscription => Boolean(subscription));
  } catch {
    return null;
  }
}

function restoreWorkspaceConfig(rawValue: string | null): WorkspaceConfig | null {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as Partial<WorkspaceConfig>;
    if (!parsed || typeof parsed !== 'object') return null;

    return {
      workspaceName: typeof parsed.workspaceName === 'string' && parsed.workspaceName.trim() ? parsed.workspaceName : defaultConfig.workspaceName,
      monthlyBudget: typeof parsed.monthlyBudget === 'string' && parsed.monthlyBudget.trim() ? parsed.monthlyBudget : defaultConfig.monthlyBudget,
      currency: typeof parsed.currency === 'string' && parsed.currency.trim() ? parsed.currency : defaultConfig.currency,
      reminderDays: typeof parsed.reminderDays === 'string' && parsed.reminderDays.trim() ? parsed.reminderDays : defaultConfig.reminderDays,
      copyrightText:
        typeof parsed.copyrightText === 'string' && parsed.copyrightText.trim()
          ? parsed.copyrightText.trim().slice(0, 200)
          : defaultConfig.copyrightText
    };
  } catch {
    return null;
  }
}

function restoreDashboardState(value: unknown): DashboardState | null {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Partial<DashboardState>;
  if (!Array.isArray(candidate.items) || !Number.isInteger(candidate.revision)) return null;
  const restoredItems = candidate.items
    .map((subscription, index) => restoreSubscription(subscription, index))
    .filter((subscription): subscription is Subscription => Boolean(subscription));
  const restoredConfig = restoreWorkspaceConfig(JSON.stringify(candidate.config ?? null)) ?? defaultConfig;

  return {
    initialized: candidate.initialized === true,
    revision: Number(candidate.revision),
    items: serializeSubscriptions(restoredItems),
    config: restoredConfig,
    theme: isDashboardTheme(candidate.theme) ? candidate.theme : 'forest',
    frontendTemplate:
      typeof candidate.frontendTemplate === 'string' && isTemplateSlug(candidate.frontendTemplate)
        ? candidate.frontendTemplate
        : 'cards',
    frontendDisplayMode: isFrontendDisplayMode(candidate.frontendDisplayMode)
      ? candidate.frontendDisplayMode
      : defaultFrontendDisplayMode
  };
}

function readLegacyDashboardState(): DashboardState {
  const storedItems = restoreSubscriptions(window.localStorage.getItem(subscriptionStorageKey));
  const storedConfig = restoreWorkspaceConfig(window.localStorage.getItem(configStorageKey));
  const storedTheme = window.localStorage.getItem(dashboardThemeStorageKey);
  const storedFrontendTemplate = window.localStorage.getItem(frontendTemplateStorageKey);
  const storedFrontendDisplayMode = window.localStorage.getItem(frontendDisplayModeStorageKey);

  return {
    initialized: true,
    revision: 0,
    items: serializeSubscriptions(storedItems ?? initialSubscriptions),
    config: storedConfig ?? defaultConfig,
    theme: isDashboardTheme(storedTheme) ? storedTheme : 'forest',
    frontendTemplate:
      storedFrontendTemplate && isTemplateSlug(storedFrontendTemplate) ? storedFrontendTemplate : 'cards',
    frontendDisplayMode: isFrontendDisplayMode(storedFrontendDisplayMode)
      ? storedFrontendDisplayMode
      : defaultFrontendDisplayMode
  };
}

export default function AdminDashboard() {
  const [items, setItems] = useState<Subscription[]>([]);
  const [itemsStorageReady, setItemsStorageReady] = useState(false);
  const [activeView, setActiveView] = useState<NavView>('overview');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SubscriptionStatus>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [theme, setTheme] = useState<DashboardTheme>('forest');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoginPending, setIsLoginPending] = useState(false);
  const [loginForm, setLoginForm] = useState<LoginForm>({ username: '', password: '' });
  const [form, setForm] = useState<NewSubscriptionForm>(emptyForm);
  const [config, setConfig] = useState<WorkspaceConfig>(defaultConfig);
  const [configForm, setConfigForm] = useState<WorkspaceConfig>(defaultConfig);
  const [frontendTemplate, setFrontendTemplate] = useState<TemplateSlug>('cards');
  const [frontendTemplateForm, setFrontendTemplateForm] = useState<TemplateSlug>('cards');
  const [frontendDisplayMode, setFrontendDisplayMode] = useState<FrontendDisplayMode>(defaultFrontendDisplayMode);
  const [frontendDisplayModeForm, setFrontendDisplayModeForm] = useState<FrontendDisplayMode>(defaultFrontendDisplayMode);
  const [serverSyncError, setServerSyncError] = useState('');
  const [isServerSyncing, setIsServerSyncing] = useState(false);
  const pendingAdminAction = useRef<(() => void) | null>(null);
  const itemsRef = useRef<Subscription[]>([]);
  const configRef = useRef<WorkspaceConfig>(defaultConfig);
  const frontendTemplateRef = useRef<TemplateSlug>('cards');
  const frontendDisplayModeRef = useRef<FrontendDisplayMode>(defaultFrontendDisplayMode);
  const revisionRef = useRef(0);
  const queuedServerStateRef = useRef<DashboardState | null>(null);
  const serverSyncInProgressRef = useRef(false);
  const skipNextServerSyncRef = useRef(false);
  const overviewRef = useRef<HTMLElement | null>(null);
  const subscriptionsRef = useRef<HTMLDivElement | null>(null);
  const analyticsRef = useRef<HTMLDivElement | null>(null);
  const formCycle = normalizeBillingCycle(form.cycle);
  const formMonthlyPrice = formatMoney(getMonthlyCostFromPrice(form.price, formCycle), config.currency);
  const formCycleMonths = getBillingCycleMonths(formCycle);

  function applyDashboardState(state: DashboardState) {
    const restoredItems = state.items
      .map((subscription, index) => restoreSubscription(subscription, index))
      .filter((subscription): subscription is Subscription => Boolean(subscription));

    skipNextServerSyncRef.current = true;
    revisionRef.current = state.revision;
    itemsRef.current = restoredItems;
    configRef.current = state.config;
    frontendTemplateRef.current = state.frontendTemplate;
    frontendDisplayModeRef.current = state.frontendDisplayMode;
    setItems(restoredItems);
    setConfig(state.config);
    setConfigForm(state.config);
    setTheme(state.theme);
    setFrontendTemplate(state.frontendTemplate);
    setFrontendTemplateForm(state.frontendTemplate);
    setFrontendDisplayMode(state.frontendDisplayMode);
    setFrontendDisplayModeForm(state.frontendDisplayMode);
    setItemsStorageReady(true);
  }

  async function requestDashboardSave(state: DashboardState) {
    const response = await fetch('/api/dashboard', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revision: revisionRef.current, state })
    });
    const result = (await response.json().catch(() => null)) as
      | { ok?: boolean; revision?: number; message?: string; code?: string }
      | null;

    if (response.status === 401) {
      window.localStorage.removeItem(authStorageKey);
      setIsAdmin(false);
      setLoginOpen(true);
      throw new Error('管理员会话已失效，请重新登录。');
    }
    if (!response.ok || !Number.isInteger(result?.revision)) {
      throw new Error(result?.message || '服务端暂时无法保存工作区数据。');
    }

    revisionRef.current = Number(result?.revision);
  }

  async function flushQueuedServerState() {
    if (serverSyncInProgressRef.current) return;
    serverSyncInProgressRef.current = true;
    setIsServerSyncing(true);

    try {
      while (queuedServerStateRef.current) {
        const state = queuedServerStateRef.current;
        queuedServerStateRef.current = null;
        await requestDashboardSave(state);
        setServerSyncError('');
      }
    } catch (error) {
      queuedServerStateRef.current = null;
      setServerSyncError(error instanceof Error ? error.message : '服务端同步失败。');
    } finally {
      serverSyncInProgressRef.current = false;
      if (queuedServerStateRef.current) void flushQueuedServerState();
      else setIsServerSyncing(false);
    }
  }

  async function loadDashboardState() {
    const response = await fetch('/api/dashboard', { method: 'GET', cache: 'no-store' });
    const result = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      const message = result && typeof result === 'object' && 'message' in result && typeof result.message === 'string'
        ? result.message
        : '暂时无法读取服务端数据。';
      throw new Error(message);
    }

    let state = restoreDashboardState(result);
    if (!state) throw new Error('服务端返回的工作区数据无效。');

    if (!state.initialized) {
      state = readLegacyDashboardState();
      revisionRef.current = 0;
      await requestDashboardSave(state);
      state.revision = revisionRef.current;
      window.localStorage.setItem(serverMigrationStorageKey, new Date().toISOString());
    }

    applyDashboardState(state);
    setServerSyncError('');
    setIsServerSyncing(false);
  }

  useEffect(() => {
    let active = true;
    window.localStorage.removeItem('subscription-dashboard-density');
    window.localStorage.removeItem('subscription-dashboard-layout');

    void fetch('/api/auth', { method: 'GET', cache: 'no-store' })
      .then(async (response) => {
        if (!active) return;
        if (!response.ok) {
          window.localStorage.removeItem(authStorageKey);
          setIsAdmin(false);
          setItems([]);
          setItemsStorageReady(true);
          setLoginOpen(true);
          return;
        }

        window.localStorage.setItem(authStorageKey, 'true');
        setIsAdmin(true);
        await loadDashboardState();
      })
      .catch((error) => {
        if (!active) return;
        setItems([]);
        setItemsStorageReady(true);
        setServerSyncError(error instanceof Error ? error.message : '暂时无法连接服务端数据库。');
      });

    return () => {
      active = false;
    };
    // Authentication bootstrap intentionally runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!itemsStorageReady || !isAdmin) return;
    if (skipNextServerSyncRef.current) {
      skipNextServerSyncRef.current = false;
      return;
    }

    const timeout = window.setTimeout(() => {
      queuedServerStateRef.current = {
        initialized: true,
        revision: revisionRef.current,
        items: serializeSubscriptions(items),
        config,
        theme,
        frontendTemplate,
        frontendDisplayMode
      };
      void flushQueuedServerState();
    }, 0);

    return () => window.clearTimeout(timeout);
    // Save only when the serialized workspace inputs change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, frontendDisplayMode, frontendTemplate, isAdmin, items, itemsStorageReady, theme]);

  useEffect(() => {
    itemsRef.current = items;
    configRef.current = config;
    frontendTemplateRef.current = frontendTemplate;
    frontendDisplayModeRef.current = frontendDisplayMode;
  }, [config, frontendDisplayMode, frontendTemplate, items]);

  const filteredSubscriptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const reminderDays = getReminderDays(config.reminderDays);

    const matchedSubscriptions = items.filter((subscription) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [subscription.name, subscription.plan, subscription.tag, subscription.cycle]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      const effectiveStatus = getEffectiveSubscriptionStatus(subscription, reminderDays);
      const matchesStatus = statusFilter === 'all' || effectiveStatus === statusFilter;
      return matchesQuery && matchesStatus;
    });

    return sortSubscriptionsByStatus(matchedSubscriptions, reminderDays);
  }, [config.reminderDays, items, query, statusFilter]);

  const overviewStats = useMemo<OverviewStatItem[]>(() => {
    const reminderDays = getReminderDays(config.reminderDays);
    const activeSubscriptions = items.filter((subscription) => subscription.status !== 'paused');
    const dueSubscriptions = activeSubscriptions.filter(
      (subscription) => getEffectiveSubscriptionStatus(subscription, reminderDays) === 'due'
    );
    const nextSubscription = activeSubscriptions
      .map((subscription) => {
        const billingDate = parseBillingDate(subscription.nextBilling);
        return billingDate ? { subscription, billingDate, daysUntil: getDaysUntil(billingDate) } : null;
      })
      .filter((entry): entry is { subscription: Subscription; billingDate: Date; daysUntil: number } => Boolean(entry))
      .sort((first, second) => {
        const firstIsUpcoming = first.daysUntil >= 0;
        const secondIsUpcoming = second.daysUntil >= 0;

        if (firstIsUpcoming !== secondIsUpcoming) return firstIsUpcoming ? -1 : 1;
        return Math.abs(first.daysUntil) - Math.abs(second.daysUntil);
      })[0];
    const monthlyTotal = activeSubscriptions.reduce((total, subscription) => total + getMonthlyCost(subscription), 0);

    return [
      {
        stat: {
          title: '月均支出',
          value: formatMoney(monthlyTotal, config.currency),
          note: activeSubscriptions.length > 0 ? `${activeSubscriptions.length} 项服务计入预算` : '暂无活跃订阅',
          icon: CreditCard,
          tone: 'violet'
        },
        action: 'analytics',
        ariaLabel: '查看支出分析'
      },
      {
        stat: {
          title: '订阅数量',
          value: String(items.length),
          note: `${activeSubscriptions.length} 项活跃，${items.length - activeSubscriptions.length} 项暂停`,
          icon: Sparkles,
          tone: 'blue'
        },
        action: 'subscriptions',
        ariaLabel: '查看全部订阅'
      },
      {
        stat: {
          title: '下一次扣费',
          value: nextSubscription ? formatBillingDate(nextSubscription.billingDate) : '--',
          note: nextSubscription ? getBillingNote(nextSubscription.subscription.name, nextSubscription.daysUntil) : '暂无扣费计划',
          icon: CalendarDays,
          tone: 'green'
        },
        action: 'nextBilling',
        ariaLabel: '查看下一次扣费订阅',
        targetQuery: nextSubscription?.subscription.name
      },
      {
        stat: {
          title: '待处理项目',
          value: String(dueSubscriptions.length),
          note: dueSubscriptions.length > 0 ? `${dueSubscriptions.length} 项需要关注` : '没有到期提醒',
          icon: CheckCircle2,
          tone: 'rose'
        },
        action: 'due',
        ariaLabel: '查看待处理订阅'
      }
    ];
  }, [config.currency, config.reminderDays, items]);

  const notifications = useMemo<DashboardNotification[]>(() => {
    const reminderDays = getReminderDays(config.reminderDays);
    const activeSubscriptions = items.filter((subscription) => subscription.status !== 'paused');
    const billingNotifications = activeSubscriptions
      .map((subscription) => {
        const billingDate = parseBillingDate(subscription.nextBilling);
        if (!billingDate) return null;

        const daysUntil = getDaysUntil(billingDate);
        if (subscription.status !== 'due' && daysUntil > reminderDays) return null;

        const title =
          daysUntil < 0
            ? `${subscription.name} 已逾期 ${Math.abs(daysUntil)} 天`
            : daysUntil === 0
              ? `${subscription.name} 今天扣费`
              : daysUntil === 1
                ? `${subscription.name} 明天扣费`
                : `${subscription.name} 将在 ${daysUntil} 天后扣费`;

        return {
          notification: {
            id: `billing:${subscription.id}:${subscription.nextBilling}`,
            title,
            note: `${subscription.nextBilling} · ${subscription.price} / ${subscription.cycle}`,
            kind: 'billing' as const,
            severity: daysUntil < 0 ? ('danger' as const) : ('warning' as const),
            action: 'subscription' as const,
            targetQuery: subscription.name
          },
          daysUntil
        };
      })
      .filter((entry) => entry !== null)
      .sort((first, second) => {
        const firstIsUpcoming = first.daysUntil >= 0;
        const secondIsUpcoming = second.daysUntil >= 0;
        if (firstIsUpcoming !== secondIsUpcoming) return firstIsUpcoming ? -1 : 1;
        return Math.abs(first.daysUntil) - Math.abs(second.daysUntil);
      })
      .map((entry) => entry.notification);

    const monthlyTotal = activeSubscriptions.reduce((total, subscription) => total + getMonthlyCost(subscription), 0);
    const monthlyBudget = Number(config.monthlyBudget);
    const budgetRatio = monthlyBudget > 0 ? monthlyTotal / monthlyBudget : 0;
    const budgetNotification: DashboardNotification | null =
      budgetRatio >= 0.8
        ? {
            id: `budget:${config.monthlyBudget}:${Math.round(monthlyTotal * 100)}`,
            title: budgetRatio > 1 ? '本月预计支出已超预算' : '本月预算即将用完',
            note: `预计 ${formatMoney(monthlyTotal, config.currency)}，月预算 ${formatMoney(monthlyBudget, config.currency)}`,
            kind: 'budget',
            severity: budgetRatio > 1 ? 'danger' : 'info',
            action: 'analytics'
          }
        : null;

    return budgetNotification ? [...billingNotifications, budgetNotification] : billingNotifications;
  }, [config.currency, config.monthlyBudget, config.reminderDays, items]);

  function requireAdmin(action: () => void) {
    if (isAdmin) {
      action();
      return;
    }

    pendingAdminAction.current = action;
    setLoginError('');
    setLoginOpen(true);
  }

  function openLoginDialog() {
    pendingAdminAction.current = null;
    setLoginError('');
    setLoginOpen(true);
  }

  function closeLoginDialog() {
    pendingAdminAction.current = null;
    setLoginError('');
    setLoginOpen(false);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoginError('');
    setIsLoginPending(true);

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: loginForm.username.trim(),
          password: loginForm.password
        })
      });

      if (!response.ok) {
        setLoginError(
          response.status === 503
            ? '管理员登录尚未完成服务端配置'
            : response.status === 429
              ? '登录尝试次数过多，请稍后再试'
              : '账号或密码不正确'
        );
        return;
      }

      const action = pendingAdminAction.current;
      pendingAdminAction.current = null;
      window.localStorage.setItem(authStorageKey, 'true');
      try {
        await loadDashboardState();
      } catch (error) {
        setLoginError(error instanceof Error ? error.message : '暂时无法读取服务端数据库');
        return;
      }
      setIsAdmin(true);
      setLoginOpen(false);
      setLoginForm({ username: '', password: '' });
      action?.();
    } catch {
      setLoginError('登录服务暂时不可用');
    } finally {
      setIsLoginPending(false);
    }
  }

  function handleLogout() {
    pendingAdminAction.current = null;
    void fetch('/api/auth', { method: 'DELETE' });
    window.localStorage.removeItem(authStorageKey);
    setIsAdmin(false);
    revisionRef.current = 0;
    queuedServerStateRef.current = null;
    skipNextServerSyncRef.current = true;
    itemsRef.current = [];
    configRef.current = defaultConfig;
    frontendTemplateRef.current = 'cards';
    frontendDisplayModeRef.current = defaultFrontendDisplayMode;
    setItems([]);
    setConfig(defaultConfig);
    setConfigForm(defaultConfig);
    setServerSyncError('');
    setLoginOpen(false);
    setPasswordDialogOpen(false);
    closeEditor();
    closeConfigEditor();
  }

  function openCreateDialog() {
    requireAdmin(() => {
      setEditingId(null);
      setForm(emptyForm);
      setCreateOpen(true);
    });
  }

  function openEditDialog(subscription: Subscription) {
    requireAdmin(() => {
      const currentSubscription = itemsRef.current.find((item) => item.id === subscription.id) ?? subscription;
      const memberDetails =
        currentSubscription.memberDetails.length > 0
          ? currentSubscription.memberDetails
          : buildMemberDetails(currentSubscription.memberEmails, currentSubscription.nextBilling);

      setEditingId(currentSubscription.id);
      setForm({
        name: currentSubscription.name,
        plan: currentSubscription.plan,
        tag: currentSubscription.tag,
        price: currentSubscription.price,
        cycle: normalizeBillingCycle(currentSubscription.cycle),
        nextBilling: currentSubscription.nextBilling,
        members: currentSubscription.members,
        memberEmails: formatMemberEmails(currentSubscription.memberEmails),
        memberDetails
      });
      setCreateOpen(true);
    });
  }

  function openConfigDialog() {
    requireAdmin(() => {
      setConfigForm(configRef.current);
      setFrontendTemplateForm(frontendTemplateRef.current);
      setFrontendDisplayModeForm(frontendDisplayModeRef.current);
      setConfigOpen(true);
    });
  }

  function openPasswordDialog() {
    requireAdmin(() => {
      setPasswordDialogOpen(true);
    });
  }

  function handlePasswordSessionExpired() {
    window.localStorage.removeItem(authStorageKey);
    setIsAdmin(false);
    setPasswordDialogOpen(false);
    openLoginDialog();
  }

  function scrollToSection<T extends HTMLElement>(targetRef: React.RefObject<T | null>) {
    targetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleNavigate(view: NavView) {
    setActiveView(view);
    setNotificationOpen(false);

    if (view === 'overview') {
      setStatusFilter('all');
      scrollToSection(overviewRef);
      return;
    }

    if (view === 'subscriptions') {
      setStatusFilter('all');
      scrollToSection(subscriptionsRef);
      return;
    }

    if (view === 'billing') {
      setStatusFilter('due');
      scrollToSection(subscriptionsRef);
      return;
    }

    if (view === 'analytics') {
      scrollToSection(analyticsRef);
      return;
    }

    openConfigDialog();
  }

  function handleNotificationSelect(notification: DashboardNotification) {
    setNotificationOpen(false);

    if (notification.action === 'analytics') {
      setActiveView('analytics');
      scrollToSection(analyticsRef);
      return;
    }

    setActiveView('billing');
    setQuery(notification.targetQuery ?? '');
    setStatusFilter('all');
    scrollToSection(subscriptionsRef);
  }

  function handleOverviewStatClick(item: OverviewStatItem) {
    setNotificationOpen(false);

    if (item.action === 'analytics') {
      setActiveView('analytics');
      scrollToSection(analyticsRef);
      return;
    }

    if (item.action === 'subscriptions') {
      setActiveView('subscriptions');
      setQuery('');
      setStatusFilter('all');
      scrollToSection(subscriptionsRef);
      return;
    }

    if (item.action === 'nextBilling') {
      setActiveView('billing');
      setQuery(item.targetQuery ?? '');
      setStatusFilter('all');
      scrollToSection(subscriptionsRef);
      return;
    }

    setActiveView('billing');
    setQuery('');
    setStatusFilter('due');
    scrollToSection(subscriptionsRef);
  }

  function closeEditor() {
    setCreateOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function closeConfigEditor() {
    setConfigOpen(false);
    setConfigForm(config);
    setFrontendTemplateForm(frontendTemplate);
    setFrontendDisplayModeForm(frontendDisplayMode);
  }

  function handleSaveSubscription() {
    if (!isAdmin) return;

    const name = form.name.trim();
    if (!name) return;
    const nextBilling = form.nextBilling || '2026-07-15';
    const formMemberDetails = normalizeFormMemberDetails(form.memberDetails, nextBilling);
    const memberEmails = formMemberDetails.length > 0 ? formMemberDetails.map((member) => member.email) : parseMemberEmails(form.memberEmails);

    if (editingId) {
      setItems((current) =>
        current.map((subscription) => {
          if (subscription.id !== editingId) return subscription;

          const memberDetails =
            formMemberDetails.length > 0 || form.memberEmails.trim().length === 0
              ? formMemberDetails
              : mergeMemberDetailsFromEmails(subscription.memberDetails, memberEmails, nextBilling);

          return {
            ...subscription,
            name,
            plan: form.plan.trim() || '标准方案',
            tag: form.tag.trim() || 'SaaS',
            price: form.price.trim() || '¥0.00',
            cycle: normalizeBillingCycle(form.cycle),
            nextBilling,
            members: getMemberCountLabel(memberDetails.length),
            memberEmails: memberDetails.map((member) => member.email),
            memberDetails,
            status: subscription.status === 'paused' ? 'paused' : 'active'
          };
        })
      );
      closeEditor();
      return;
    }

    const iconConfig = iconPool[items.length % iconPool.length];
    const memberDetails = formMemberDetails.length > 0 ? formMemberDetails : buildMemberDetails(memberEmails, nextBilling);
    const nextItem: Subscription = {
      id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'subscription'}-${Date.now()}`,
      name,
      plan: form.plan.trim() || '标准方案',
      tag: form.tag.trim() || 'SaaS',
      price: form.price.trim() || '¥0.00',
      cycle: normalizeBillingCycle(form.cycle),
      nextBilling,
      members: getMemberCountLabel(memberDetails.length),
      memberEmails: memberDetails.map((member) => member.email),
      memberDetails,
      status: 'active',
      icon: iconConfig.icon,
      tone: iconConfig.tone
    };

    setItems((current) => [nextItem, ...current]);
    closeEditor();
  }

  function handleDeleteSubscription(id: string) {
    requireAdmin(() => {
      setItems((current) => current.filter((subscription) => subscription.id !== id));
    });
  }

  function handlePauseSubscription(id: string) {
    requireAdmin(() => {
      setItems((current) =>
        current.map((subscription) =>
          subscription.id === id
            ? { ...subscription, status: subscription.status === 'paused' ? 'active' : 'paused' }
            : subscription
        )
      );
    });
  }

  function handleAddSubscriptionMember(subscriptionId: string, member: Omit<SubscriptionMember, 'id'>) {
    requireAdmin(() => {
      setItems((current) =>
        current.map((subscription) => {
          if (subscription.id !== subscriptionId) return subscription;

          const email = member.email.trim().toLowerCase();
          if (!email) return subscription;

          const nextMember: SubscriptionMember = {
            id: `${subscriptionId}-${email.replace(/[^a-z0-9]+/g, '-') || 'member'}-${Date.now()}`,
            name: member.name.trim() || getMemberNameFromEmail(email),
            email,
            expiresAt: member.expiresAt || subscription.nextBilling
          };
          const memberDetails = [...subscription.memberDetails.filter((item) => item.email.toLowerCase() !== email), nextMember];

          return {
            ...subscription,
            members: getMemberCountLabel(memberDetails.length),
            memberEmails: memberDetails.map((item) => item.email),
            memberDetails
          };
        })
      );
    });
  }

  function handleSaveConfig() {
    if (!isAdmin) return;

    setConfig({
      workspaceName: configForm.workspaceName.trim() || defaultConfig.workspaceName,
      monthlyBudget: configForm.monthlyBudget.trim() || defaultConfig.monthlyBudget,
      currency: configForm.currency.trim() || defaultConfig.currency,
      reminderDays: configForm.reminderDays.trim() || defaultConfig.reminderDays,
      copyrightText: configForm.copyrightText.trim().slice(0, 200) || defaultConfig.copyrightText
    });
    setFrontendTemplate(frontendTemplateForm);
    setFrontendDisplayMode(frontendDisplayModeForm);
    setConfigOpen(false);
  }

  return (
    <main
      data-theme={theme}
      data-density="standard"
      data-layout="panorama"
      className="dashboard-shell relative min-h-screen overflow-x-hidden bg-canvas text-ink transition-colors duration-300"
    >
      <div className="ambient-grid" />
      <div className="dashboard-grid relative z-10 mx-auto min-h-screen w-full max-w-[1680px] lg:grid">
        <Sidebar
          isAdmin={isAdmin}
          workspaceName={itemsStorageReady ? config.workspaceName : '工作区'}
          activeView={activeView}
          query={query}
          onQueryChange={setQuery}
          theme={theme}
          notificationOpen={notificationOpen}
          notifications={itemsStorageReady ? notifications : []}
          onThemeChange={setTheme}
          onToggleNotifications={() => setNotificationOpen((value) => !value)}
          onNotificationSelect={handleNotificationSelect}
          onNavigate={handleNavigate}
          onOpenLogin={openLoginDialog}
          onOpenChangePassword={openPasswordDialog}
          onOpenSettings={openConfigDialog}
          onOpenCreate={openCreateDialog}
          onLogout={handleLogout}
        />

        {itemsStorageReady ? (
        <div className="dashboard-content min-w-0 px-4 py-5 sm:px-6 lg:px-8 lg:py-7 xl:px-10">
          <header className="dashboard-page-header mb-6 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-primary">工作区 / {config.workspaceName}</div>
              <h1 className="mt-2 text-[28px] font-bold leading-tight text-ink sm:text-[32px]">订阅总览</h1>
              <p className="mt-2 text-sm font-medium text-muted">
                {items.filter((subscription) => subscription.status !== 'paused').length} 项活跃服务 ·{' '}
                {overviewStats[3]?.stat.value ?? '0'} 项需要关注
              </p>
              {serverSyncError ? (
                <div className="mt-3 max-w-2xl rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-xs font-semibold text-danger" role="alert">
                  {serverSyncError}
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                title="工作区设置"
                onClick={openConfigDialog}
                className="theme-icon-button grid h-10 w-10 place-items-center rounded-lg border border-[#DDE4E0] bg-white text-muted shadow-glow transition hover:text-primary"
                aria-label="工作区设置"
              >
                <Settings size={17} />
              </button>
              <button
                type="button"
                onClick={openCreateDialog}
                className="theme-primary-action inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold"
              >
                <Plus size={17} />
                新建订阅
              </button>
            </div>
          </header>

          <section ref={overviewRef} className="overview-grid scroll-mt-24 grid min-w-0 items-stretch gap-4 xl:grid">
            <HeroCard subscriptions={items} currency={config.currency} />

            <div className="overview-stats grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-rows-2">
              {overviewStats.map((item, index) => (
                <StatsCard
                  key={item.stat.title}
                  stat={item.stat}
                  index={index}
                  active={
                    (item.action === 'subscriptions' && activeView === 'subscriptions' && statusFilter === 'all' && !query) ||
                    (item.action === 'due' && activeView === 'billing' && statusFilter === 'due') ||
                    (item.action === 'analytics' && activeView === 'analytics') ||
                    (item.action === 'nextBilling' && Boolean(query) && query === item.targetQuery)
                  }
                  ariaLabel={item.ariaLabel}
                  onClick={() => handleOverviewStatClick(item)}
                />
              ))}
            </div>
          </section>

          <section className="content-grid mt-8 grid min-w-0 items-start gap-5 xl:grid">
            <div ref={subscriptionsRef} className="subscriptions-panel min-w-0 scroll-mt-24">
              <div className="mb-4 flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-ink">订阅明细</h2>
                  <div className="mt-1 text-sm font-medium text-muted">共 {filteredSubscriptions.length} 项服务</div>
                </div>

                <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1" role="tablist" aria-label="订阅状态筛选">
                  <div className="theme-surface flex shrink-0 items-center rounded-lg border border-[#DDE4E0] bg-white p-1 shadow-glow">
                    {(['all', 'active', 'due', 'paused'] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        role="tab"
                        aria-selected={statusFilter === status}
                        onClick={() => setStatusFilter(status)}
                        className={`h-8 rounded-md px-3 text-xs font-semibold transition ${
                          statusFilter === status ? 'theme-active-tab bg-[#E8F3F1] text-primary' : 'theme-menu-item text-muted hover:text-ink'
                        }`}
                      >
                        {status === 'all' ? '全部' : statusLabels[status]}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    title="工作区设置"
                    onClick={openConfigDialog}
                    className="theme-icon-button grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#DDE4E0] bg-white text-muted shadow-glow hover:text-primary"
                    aria-label="工作区设置"
                  >
                    <Settings size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {filteredSubscriptions.map((subscription, index) => (
                  <SubscriptionCard
                    key={subscription.id}
                    subscription={subscription}
                    index={index}
                    reminderDays={getReminderDays(config.reminderDays)}
                    isAdmin={isAdmin}
                    dataSyncing={isServerSyncing}
                    onRequireAdmin={openLoginDialog}
                    onDelete={handleDeleteSubscription}
                    onEdit={openEditDialog}
                    onTogglePause={handlePauseSubscription}
                    onAddMember={handleAddSubscriptionMember}
                  />
                ))}

                {filteredSubscriptions.length === 0 ? (
                  <div className="theme-card rounded-lg border border-dashed border-[#B8C9C1] bg-white p-10 text-center shadow-glow">
                    <div className="text-base font-bold text-ink">没有匹配的订阅</div>
                    <div className="mt-2 text-sm text-muted">调整搜索关键词或筛选条件后再试。</div>
                  </div>
                ) : null}
              </div>
            </div>

            <div ref={analyticsRef} className="analytics-panel min-w-0 scroll-mt-24">
              <QuickPanel config={config} subscriptions={items} onOpenSettings={openConfigDialog} />
            </div>
          </section>
        </div>
        ) : (
          <DashboardLoadingState />
        )}
      </div>

      {createOpen ? (
        <div className="theme-overlay fixed inset-0 z-50 grid place-items-center bg-[#17211B]/45 p-4 backdrop-blur-sm" onClick={closeEditor}>
          <section
            className="theme-modal max-h-[calc(100vh-2rem)] w-full max-w-[560px] overflow-y-auto rounded-xl border border-[#DDE4E0] bg-white p-6 shadow-[0_24px_70px_rgba(23,33,27,.22)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-primary">订阅管理</div>
                <h3 className="mt-1.5 text-2xl font-bold text-ink">
                  {editingId ? '编辑订阅' : '添加订阅'}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="theme-icon-button grid h-9 w-9 place-items-center rounded-lg border border-[#DDE4E0] text-muted hover:text-ink"
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              <ComboField
                label="名称"
                value={form.name}
                onChange={(value) => setForm((current) => ({ ...current, name: value }))}
                placeholder="例如 YouTube Premium"
                options={subscriptionNameOptions}
              />
              <ComboField
                label="方案"
                value={form.plan}
                onChange={(value) => setForm((current) => ({ ...current, plan: value }))}
                placeholder="例如 Family Plan"
                options={subscriptionPlanOptions}
              />
              <Field label="成员" value={form.members} onChange={(value) => setForm((current) => ({ ...current, members: value }))} placeholder="1 人" />
              <MemberInfoRows
                label="成员信息"
                members={form.memberDetails}
                onDelete={(memberId) =>
                  setForm((current) => {
                    const memberDetails = current.memberDetails.filter((member) => member.id !== memberId);

                    return {
                      ...current,
                      members: getMemberCountLabel(memberDetails.length),
                      memberEmails: formatMemberEmails(memberDetails.map((member) => member.email)),
                      memberDetails
                    };
                  })
                }
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="价格" value={form.price} onChange={(value) => setForm((current) => ({ ...current, price: value }))} placeholder="¥30.00" />
                <CycleSelect label="周期" value={formCycle} onChange={(value) => setForm((current) => ({ ...current, cycle: value }))} />
              </div>
              <div className="theme-inset rounded-lg border border-[#E4E9E6] bg-[#F7F9F8] px-3 py-3">
                <div className="text-xs font-medium text-muted">折合月付</div>
                <div className="mt-1 text-base font-semibold text-ink">{formMonthlyPrice}</div>
                <div className="mt-1 text-xs font-medium text-muted">
                  {formCycleMonths === 1 ? '按月付价格计入月均支出' : `${formCycle}价格按 ${formCycleMonths} 个月平均`}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="标签" value={form.tag} onChange={(value) => setForm((current) => ({ ...current, tag: value }))} placeholder="SaaS" />
                <DatePickerField
                  label="下一次扣费"
                  value={form.nextBilling}
                  onChange={(value) => setForm((current) => ({ ...current, nextBilling: value }))}
                  placeholder="选择扣费日期"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEditor}
                className="theme-button h-10 rounded-lg border border-[#DDE4E0] bg-white px-4 text-sm font-semibold text-ink"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveSubscription}
                className="theme-primary-action h-10 rounded-lg px-4 text-sm font-semibold"
              >
                {editingId ? '保存修改' : '保存订阅'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {configOpen ? (
        <div className="theme-overlay fixed inset-0 z-50 grid place-items-center bg-[#17211B]/45 p-4 backdrop-blur-sm" onClick={closeConfigEditor}>
          <section
            className="theme-modal max-h-[calc(100vh-2rem)] w-full max-w-[520px] overflow-y-auto rounded-xl border border-[#DDE4E0] bg-white p-6 shadow-[0_24px_70px_rgba(23,33,27,.22)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="theme-icon-chip grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#E8F3F1] text-primary">
                  <Settings size={20} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-primary">工作区</div>
                  <h3 className="mt-1.5 text-2xl font-bold text-ink">工作区设置</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={closeConfigEditor}
                className="theme-icon-button grid h-9 w-9 place-items-center rounded-lg border border-[#DDE4E0] text-muted hover:text-ink"
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              <Field
                label="工作区名称"
                value={configForm.workspaceName}
                onChange={(value) => setConfigForm((current) => ({ ...current, workspaceName: value }))}
                placeholder="Personal workspace"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="月预算"
                  value={configForm.monthlyBudget}
                  onChange={(value) => setConfigForm((current) => ({ ...current, monthlyBudget: value }))}
                  placeholder="40"
                />
                <Field
                  label="货币符号"
                  value={configForm.currency}
                  onChange={(value) => setConfigForm((current) => ({ ...current, currency: value }))}
                  placeholder="¥"
                />
              </div>
              <Field
                label="提前提醒天数"
                value={configForm.reminderDays}
                onChange={(value) => setConfigForm((current) => ({ ...current, reminderDays: value }))}
                placeholder="3"
              />
              <EmailDeliverySetting onSessionExpired={openLoginDialog} />
              <ReminderSchedulerSetting onSessionExpired={openLoginDialog} />
              <div className="grid gap-2">
                <Field
                  label="前台版权信息"
                  value={configForm.copyrightText}
                  onChange={(value) => setConfigForm((current) => ({ ...current, copyrightText: value }))}
                  placeholder={'© 2026 <a href="https://example.com">续费管家</a>'}
                />
                <p className="text-xs font-medium leading-5 text-muted">
                  支持 <code>{'<a href="https://example.com">链接文字</a>'}</code>，链接将在新窗口打开。
                </p>
              </div>
              <div className="my-1 h-px bg-[#E7ECE9]" />
              <FrontendDisplayModeSetting value={frontendDisplayModeForm} onChange={setFrontendDisplayModeForm} />
              <div className="my-1 h-px bg-[#E7ECE9]" />
              <FrontendTemplateSetting value={frontendTemplateForm} onChange={setFrontendTemplateForm} />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeConfigEditor}
                className="theme-button h-10 rounded-lg border border-[#DDE4E0] bg-white px-4 text-sm font-semibold text-ink"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveConfig}
                className="theme-primary-action h-10 rounded-lg px-4 text-sm font-semibold"
              >
                保存配置
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <AdminPasswordDialog
        open={passwordDialogOpen}
        onClose={() => setPasswordDialogOpen(false)}
        onSessionExpired={handlePasswordSessionExpired}
      />

      {loginOpen ? (
        <div className="theme-overlay fixed inset-0 z-[60] grid place-items-center bg-[#17211B]/50 p-4 backdrop-blur-sm" onClick={closeLoginDialog}>
          <form
            className="theme-modal w-full max-w-[420px] rounded-xl border border-[#DDE4E0] bg-white p-6 shadow-[0_24px_70px_rgba(23,33,27,.24)]"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleLogin}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="theme-icon-chip grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#E8F3F1] text-primary">
                  <ShieldCheck size={22} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-primary">安全访问</div>
                  <h3 className="mt-1.5 text-2xl font-bold text-ink">管理员登录</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={closeLoginDialog}
                className="theme-icon-button grid h-9 w-9 place-items-center rounded-lg border border-[#DDE4E0] text-muted hover:text-ink"
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mt-4 text-sm leading-6 text-muted">受保护的工作区操作需要管理员身份。</p>
            <div className="theme-inset mt-3 rounded-lg border border-[#E4E9E6] bg-[#F7F9F8] px-3 py-2 text-xs font-semibold text-muted">
              管理员账号由部署环境变量配置，密码可在登录后的账户菜单中修改
            </div>

            <div className="mt-5 grid gap-4">
              <Field
                label="管理员账号"
                value={loginForm.username}
                onChange={(value) => setLoginForm((current) => ({ ...current, username: value }))}
                placeholder="请输入管理员账号"
              />
              <Field
                label="密码"
                value={loginForm.password}
                onChange={(value) => setLoginForm((current) => ({ ...current, password: value }))}
                placeholder="请输入密码"
                type="password"
              />
            </div>

            {loginError ? <div className="mt-3 text-sm font-semibold text-danger">{loginError}</div> : null}

            <button
              type="submit"
              disabled={isLoginPending}
              className="theme-primary-action mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold"
            >
              <LockKeyhole size={17} />
              {isLoginPending ? '登录中' : '登录'}
            </button>
          </form>
        </div>
      ) : null}
    </main>
  );
}

function DashboardLoadingState() {
  return (
    <div className="dashboard-content min-w-0 px-4 py-5 sm:px-6 lg:px-8 lg:py-7 xl:px-10" role="status" aria-busy="true" aria-label="正在加载工作区">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="theme-inset h-3 w-36 rounded bg-[#E2E8E4]" />
          <div className="theme-inset mt-3 h-9 w-40 rounded bg-[#D9E1DC]" />
          <div className="theme-inset mt-3 h-4 w-48 rounded bg-[#E5EAE7]" />
        </div>
        <div className="flex shrink-0 gap-2">
          <div className="theme-inset h-10 w-10 rounded-lg bg-[#E2E8E4]" />
          <div className="theme-inset h-10 w-28 rounded-lg bg-[#D9E1DC]" />
        </div>
      </div>

      <div className="overview-grid grid min-w-0 gap-4 xl:grid">
        <div className="theme-card h-[280px] rounded-lg border border-[#E0E6E2] bg-white p-6 shadow-glow">
          <div className="theme-inset h-8 w-32 rounded bg-[#E3E9E5]" />
          <div className="theme-inset mt-10 h-12 w-44 rounded bg-[#D9E1DC]" />
          <div className="theme-inset mt-8 h-px w-full bg-[#E5EAE7]" />
          <div className="mt-6 flex items-end gap-3">
            {[38, 62, 48, 84, 70, 96].map((height, index) => (
              <div key={index} style={{ height }} className="theme-inset flex-1 rounded-sm bg-[#E2E8E4]" />
            ))}
          </div>
        </div>
        <div className="overview-stats grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="theme-card min-h-[122px] rounded-lg border border-[#E0E6E2] bg-white p-4 shadow-glow">
              <div className="theme-inset h-8 w-8 rounded-lg bg-[#E2E8E4]" />
              <div className="theme-inset mt-4 h-6 w-20 rounded bg-[#D9E1DC]" />
              <div className="theme-inset mt-2 h-3 w-full max-w-28 rounded bg-[#E7ECE9]" />
            </div>
          ))}
        </div>
      </div>

      <div className="content-grid mt-8 grid min-w-0 gap-5 xl:grid">
        <div>
          <div className="theme-inset h-7 w-28 rounded bg-[#D9E1DC]" />
          <div className="theme-card mt-4 h-40 rounded-lg border border-[#E0E6E2] bg-white shadow-glow" />
          <div className="theme-card mt-3 h-40 rounded-lg border border-[#E0E6E2] bg-white shadow-glow" />
        </div>
        <div className="theme-card h-64 rounded-lg border border-[#E0E6E2] bg-white shadow-glow" />
      </div>
      <span className="sr-only">正在恢复订阅和工作区配置</span>
    </div>
  );
}

function CycleSelect({
  label,
  value,
  onChange
}: {
  label: string;
  value: BillingCycle;
  onChange: (value: BillingCycle) => void;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-semibold text-muted">{label}</legend>
      <div className="grid grid-cols-3 gap-2">
        {billingCycleOptions.map((option) => {
          const selected = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={`theme-button h-11 rounded-lg border px-3 text-sm font-semibold outline-none transition focus:ring-4 focus:ring-primary/10 ${
                selected
                  ? 'theme-active-tab border-primary/25 bg-[#E8F3F1] text-primary'
                  : 'border-[#DDE4E0] bg-[#F7F9F8] text-ink hover:border-primary/25 hover:bg-white hover:text-primary'
              }`}
            >
              {option.value}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function MemberInfoRows({
  label,
  members,
  onDelete
}: {
  label: string;
  members: SubscriptionMember[];
  onDelete: (memberId: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <div className="text-sm font-semibold text-muted">{label}</div>
      <div className="grid gap-2">
        {members.length > 0 ? (
          members.map((member) => (
            <div
              key={member.id}
              className="theme-input flex min-h-11 min-w-0 items-center gap-3 rounded-lg border border-[#DDE4E0] bg-[#F7F9F8] px-3 py-2 text-sm font-semibold text-ink"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate">{member.name}</div>
                <div className="mt-0.5 truncate text-xs font-medium text-muted">{member.email}</div>
              </div>
              <div className="shrink-0 text-xs font-semibold text-muted">{member.expiresAt || '--'}</div>
              <button
                type="button"
                onClick={() => onDelete(member.id)}
                className="theme-icon-button grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#DDE4E0] bg-white text-danger transition hover:bg-danger/10"
                aria-label={`删除 ${member.name}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        ) : (
          <div className="theme-input flex min-h-11 items-center rounded-lg border border-[#DDE4E0] bg-[#F7F9F8] px-3 text-sm font-semibold text-muted">
            暂无成员信息
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text'
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: 'text' | 'password';
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="theme-input h-11 rounded-lg border border-[#DDE4E0] bg-[#F7F9F8] px-3 text-sm font-semibold text-ink outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
      />
    </label>
  );
}

function ComboField({
  label,
  value,
  onChange,
  placeholder,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: string[];
}) {
  const [open, setOpen] = useState(false);
  const normalizedValue = value.trim().toLowerCase();
  const filteredOptions = options.filter((option) => option.toLowerCase().includes(normalizedValue));
  const visibleOptions = filteredOptions.length > 0 ? filteredOptions : options;

  return (
    <label className="relative grid gap-2">
      <span className="text-sm font-semibold text-muted">{label}</span>
      <input
        type="text"
        value={value}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        placeholder={placeholder}
        className="theme-input h-11 rounded-lg border border-[#DDE4E0] bg-[#F7F9F8] px-3 text-sm font-semibold text-ink outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
      />

      {open ? (
        <div className="theme-popover absolute left-0 right-0 top-[76px] z-[70] max-h-56 overflow-y-auto rounded-lg border border-[#DDE4E0] bg-white p-1.5 shadow-lift">
          {visibleOptions.map((option) => (
            <button
              key={option}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className={`theme-menu-item flex h-10 w-full items-center rounded-md px-3 text-left text-sm font-semibold transition hover:bg-[#F1F4F2] hover:text-primary ${
                value === option ? 'theme-active-tab bg-[#E8F3F1] text-primary' : 'text-ink'
              }`}
            >
              <span className="truncate">{option}</span>
            </button>
          ))}
        </div>
      ) : null}
    </label>
  );
}
