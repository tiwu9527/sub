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
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { HeroCard } from '@/components/HeroCard';
import { QuickPanel } from '@/components/QuickPanel';
import { Sidebar } from '@/components/Sidebar';
import type { NavView } from '@/components/Sidebar';
import { StatsCard } from '@/components/StatsCard';
import { SubscriptionCard } from '@/components/SubscriptionCard';
import { statusLabels, subscriptions as initialSubscriptions } from '@/lib/data';
import type { Stat, Subscription, SubscriptionMember, SubscriptionStatus } from '@/lib/data';

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

type WorkspaceConfig = {
  workspaceName: string;
  monthlyBudget: string;
  currency: string;
  reminderDays: string;
};

type PersistedSubscription = Omit<Subscription, 'icon'> & {
  iconName: IconName;
};

type OverviewStatAction = 'analytics' | 'subscriptions' | 'nextBilling' | 'due';

type OverviewStatItem = {
  stat: Stat;
  action: OverviewStatAction;
  ariaLabel: string;
  targetQuery?: string;
};

const authStorageKey = 'subscription-dashboard-admin-session';
const subscriptionStorageKey = 'subscription-dashboard-items';

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

const defaultConfig: WorkspaceConfig = {
  workspaceName: 'Personal workspace',
  monthlyBudget: '40',
  currency: '¥',
  reminderDays: '3'
};

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
  const status: SubscriptionStatus =
    subscription.status === 'due' || subscription.status === 'paused' || subscription.status === 'active'
      ? subscription.status
      : 'active';
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

export default function DashboardPage() {
  const [items, setItems] = useState<Subscription[]>(initialSubscriptions);
  const [itemsStorageReady, setItemsStorageReady] = useState(false);
  const [activeView, setActiveView] = useState<NavView>('overview');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SubscriptionStatus>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoginPending, setIsLoginPending] = useState(false);
  const [loginForm, setLoginForm] = useState<LoginForm>({ username: '', password: '' });
  const [form, setForm] = useState<NewSubscriptionForm>(emptyForm);
  const [config, setConfig] = useState<WorkspaceConfig>(defaultConfig);
  const [configForm, setConfigForm] = useState<WorkspaceConfig>(defaultConfig);
  const pendingAdminAction = useRef<(() => void) | null>(null);
  const overviewRef = useRef<HTMLElement | null>(null);
  const subscriptionsRef = useRef<HTMLDivElement | null>(null);
  const analyticsRef = useRef<HTMLDivElement | null>(null);
  const formCycle = normalizeBillingCycle(form.cycle);
  const formMonthlyPrice = formatMoney(getMonthlyCostFromPrice(form.price, formCycle), config.currency);
  const formCycleMonths = getBillingCycleMonths(formCycle);

  useEffect(() => {
    setIsAdmin(window.localStorage.getItem(authStorageKey) === 'true');
  }, []);

  useEffect(() => {
    const storedItems = restoreSubscriptions(window.localStorage.getItem(subscriptionStorageKey));
    if (storedItems) {
      setItems(storedItems);
    }
    setItemsStorageReady(true);
  }, []);

  useEffect(() => {
    if (!itemsStorageReady) return;

    window.localStorage.setItem(subscriptionStorageKey, JSON.stringify(serializeSubscriptions(items)));
  }, [items, itemsStorageReady]);

  const filteredSubscriptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((subscription) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [subscription.name, subscription.plan, subscription.tag, subscription.cycle]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesStatus = statusFilter === 'all' || subscription.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [items, query, statusFilter]);

  const overviewStats = useMemo<OverviewStatItem[]>(() => {
    const reminderDays = getReminderDays(config.reminderDays);
    const activeSubscriptions = items.filter((subscription) => subscription.status !== 'paused');
    const dueSubscriptions = activeSubscriptions.filter((subscription) => {
      const billingDate = parseBillingDate(subscription.nextBilling);
      if (!billingDate) return subscription.status === 'due';

      return subscription.status === 'due' || getDaysUntil(billingDate) <= reminderDays;
    });
    const nextSubscription = activeSubscriptions
      .map((subscription) => {
        const billingDate = parseBillingDate(subscription.nextBilling);
        return billingDate ? { subscription, billingDate, daysUntil: getDaysUntil(billingDate) } : null;
      })
      .filter((entry): entry is { subscription: Subscription; billingDate: Date; daysUntil: number } => Boolean(entry))
      .sort((first, second) => first.billingDate.getTime() - second.billingDate.getTime())[0];
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
        setLoginError('账号或密码不正确');
        return;
      }

      const action = pendingAdminAction.current;
      pendingAdminAction.current = null;
      window.localStorage.setItem(authStorageKey, 'true');
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
    window.localStorage.removeItem(authStorageKey);
    setIsAdmin(false);
    setLoginOpen(false);
    closeEditor();
    setConfigOpen(false);
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
      const memberDetails =
        subscription.memberDetails.length > 0 ? subscription.memberDetails : buildMemberDetails(subscription.memberEmails, subscription.nextBilling);

      setEditingId(subscription.id);
      setForm({
        name: subscription.name,
        plan: subscription.plan,
        tag: subscription.tag,
        price: subscription.price,
        cycle: normalizeBillingCycle(subscription.cycle),
        nextBilling: subscription.nextBilling,
        members: subscription.members,
        memberEmails: formatMemberEmails(subscription.memberEmails),
        memberDetails
      });
      setCreateOpen(true);
    });
  }

  function openConfigDialog() {
    requireAdmin(() => {
      setConfigForm(config);
      setConfigOpen(true);
    });
  }

  function scrollToSection(targetRef: React.RefObject<HTMLElement | HTMLDivElement>) {
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
            memberDetails
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
      reminderDays: configForm.reminderDays.trim() || defaultConfig.reminderDays
    });
    setConfigOpen(false);
  }

  return (
    <main
      data-theme={darkMode ? 'dark' : 'light'}
      className="dashboard-shell relative min-h-screen overflow-x-hidden bg-canvas text-ink transition-colors duration-300"
    >
      <div className="ambient-grid" />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1440px] flex-col gap-5 px-4 py-4 lg:px-6 lg:py-6">
        <Sidebar
          isAdmin={isAdmin}
          workspaceName={config.workspaceName}
          activeView={activeView}
          query={query}
          onQueryChange={setQuery}
          darkMode={darkMode}
          notificationOpen={notificationOpen}
          onToggleDarkMode={() => setDarkMode((value) => !value)}
          onToggleNotifications={() => setNotificationOpen((value) => !value)}
          onNavigate={handleNavigate}
          onOpenLogin={openLoginDialog}
          onOpenSettings={openConfigDialog}
          onOpenCreate={openCreateDialog}
          onLogout={handleLogout}
        />

        <section className="dashboard-frame min-w-0 overflow-hidden rounded-[28px] border border-white/80 bg-white/45 px-4 py-5 shadow-[0_24px_90px_rgba(124,92,255,.10)] backdrop-blur-3xl sm:px-6 md:px-8 xl:px-10">
          <section ref={overviewRef} className="scroll-mt-28 grid min-w-0 items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
            <HeroCard subscriptions={items} currency={config.currency} />

            <div className="grid min-w-0 grid-cols-1 gap-4 overflow-hidden sm:h-[260px] sm:min-h-0 sm:grid-cols-2 sm:grid-rows-2">
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

          <section className="mt-8 grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
            <div ref={subscriptionsRef} className="min-w-0 scroll-mt-28">
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">Subscription List</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <h2 className="text-[26px] font-semibold tracking-[-0.04em] text-ink">订阅列表</h2>
                    {statusFilter !== 'all' ? (
                      <span className="theme-chip rounded-full bg-[#F4F1FF] px-2.5 py-1 text-xs font-semibold text-primary">
                        {statusLabels[statusFilter]}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="relative flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setFilterOpen((value) => !value)}
                    className="theme-button inline-flex h-11 items-center justify-center gap-2 rounded-[14px] border border-black/[0.05] bg-white/78 px-4 text-sm font-semibold text-ink shadow-glow backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-primary/25 hover:text-primary"
                  >
                    <SlidersHorizontal size={17} />
                    筛选
                  </button>
                  <button
                    type="button"
                    onClick={openConfigDialog}
                    className="theme-button inline-flex h-11 items-center justify-center gap-2 rounded-[14px] border border-black/[0.05] bg-white/78 px-4 text-sm font-semibold text-ink shadow-glow backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-primary/25 hover:text-primary"
                  >
                    <Settings size={17} />
                    配置
                  </button>
                  <button
                    type="button"
                    onClick={openCreateDialog}
                    className={`inline-flex h-11 items-center justify-center gap-2 rounded-[14px] px-4 text-sm font-semibold shadow-[0_18px_38px_rgba(124,92,255,.26)] transition hover:-translate-y-0.5 ${
                      isAdmin ? 'theme-primary-action bg-primary text-white hover:bg-accent' : 'theme-button bg-[#111827] text-white hover:bg-[#374151]'
                    }`}
                    aria-label="添加订阅"
                  >
                    <Plus size={17} />
                    添加订阅
                  </button>

                  {filterOpen ? (
                    <div className="theme-popover absolute right-0 top-14 z-20 w-56 rounded-[20px] border border-black/[0.05] bg-white/95 p-2 shadow-lift backdrop-blur-xl">
                      {(['all', 'active', 'due', 'paused'] as const).map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => {
                            setStatusFilter(status);
                            setFilterOpen(false);
                          }}
                          className={`flex h-10 w-full items-center justify-between rounded-[14px] px-3 text-sm font-semibold transition ${
                            statusFilter === status ? 'theme-active-tab bg-[#F0ECFF] text-primary' : 'theme-menu-item text-muted hover:bg-[#F7F7FC] hover:text-ink'
                          }`}
                        >
                          <span>{status === 'all' ? '全部状态' : statusLabels[status]}</span>
                          <span>{statusFilter === status ? '●' : ''}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-4">
                {filteredSubscriptions.map((subscription, index) => (
                  <SubscriptionCard
                    key={subscription.id}
                    subscription={subscription}
                    index={index}
                    reminderDays={getReminderDays(config.reminderDays)}
                    onDelete={handleDeleteSubscription}
                    onEdit={openEditDialog}
                    onTogglePause={handlePauseSubscription}
                    onAddMember={handleAddSubscriptionMember}
                  />
                ))}

                {filteredSubscriptions.length === 0 ? (
                  <div className="theme-card rounded-[24px] border border-dashed border-primary/25 bg-white/70 p-10 text-center shadow-glow">
                    <div className="text-base font-semibold text-ink">没有匹配的订阅</div>
                    <div className="mt-2 text-sm text-muted">调整搜索关键词或筛选条件后再试。</div>
                  </div>
                ) : null}
              </div>
            </div>

            <div ref={analyticsRef} className="min-w-0 scroll-mt-28">
              <QuickPanel config={config} subscriptions={items} onOpenSettings={openConfigDialog} />
            </div>
          </section>
        </section>
      </div>

      {createOpen ? (
        <div className="theme-overlay fixed inset-0 z-50 grid place-items-center bg-[#111827]/35 p-4 backdrop-blur-sm" onClick={closeEditor}>
          <section
            className="theme-modal w-full max-w-[520px] rounded-[28px] border border-white/80 bg-white p-6 shadow-[0_30px_120px_rgba(17,24,39,.22)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">New Subscription</div>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-ink">
                  {editingId ? '编辑订阅' : '添加订阅'}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="theme-icon-button grid h-11 w-11 place-items-center rounded-[14px] border border-black/[0.05] text-muted hover:text-ink"
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
              <div className="theme-inset rounded-[16px] bg-[#F7F7FC] px-3 py-3">
                <div className="text-xs font-medium text-muted">折合月付</div>
                <div className="mt-1 text-base font-semibold text-ink">{formMonthlyPrice}</div>
                <div className="mt-1 text-xs font-medium text-muted">
                  {formCycleMonths === 1 ? '按月付价格计入月均支出' : `${formCycle}价格按 ${formCycleMonths} 个月平均`}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="标签" value={form.tag} onChange={(value) => setForm((current) => ({ ...current, tag: value }))} placeholder="SaaS" />
                <Field label="下一次扣费" value={form.nextBilling} onChange={(value) => setForm((current) => ({ ...current, nextBilling: value }))} placeholder="2026-07-15" />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeEditor}
                className="theme-button h-11 rounded-[14px] border border-black/[0.05] bg-white px-4 text-sm font-semibold text-ink"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveSubscription}
                className="theme-primary-action h-11 rounded-[14px] bg-primary px-4 text-sm font-semibold text-white shadow-[0_18px_38px_rgba(124,92,255,.26)]"
              >
                {editingId ? '保存修改' : '保存订阅'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {configOpen ? (
        <div className="theme-overlay fixed inset-0 z-50 grid place-items-center bg-[#111827]/35 p-4 backdrop-blur-sm" onClick={closeConfigEditor}>
          <section
            className="theme-modal w-full max-w-[520px] rounded-[28px] border border-white/80 bg-white p-6 shadow-[0_30px_120px_rgba(17,24,39,.22)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">Workspace Config</div>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-ink">修改配置</h3>
              </div>
              <button
                type="button"
                onClick={closeConfigEditor}
                className="theme-icon-button grid h-11 w-11 place-items-center rounded-[14px] border border-black/[0.05] text-muted hover:text-ink"
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
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeConfigEditor}
                className="theme-button h-11 rounded-[14px] border border-black/[0.05] bg-white px-4 text-sm font-semibold text-ink"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveConfig}
                className="theme-primary-action h-11 rounded-[14px] bg-primary px-4 text-sm font-semibold text-white shadow-[0_18px_38px_rgba(124,92,255,.26)]"
              >
                保存配置
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {loginOpen ? (
        <div className="theme-overlay fixed inset-0 z-[60] grid place-items-center bg-[#111827]/40 p-4 backdrop-blur-sm" onClick={closeLoginDialog}>
          <form
            className="theme-modal w-full max-w-[420px] rounded-[28px] border border-white/80 bg-white p-6 shadow-[0_30px_120px_rgba(17,24,39,.24)]"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleLogin}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="theme-icon-chip grid h-12 w-12 shrink-0 place-items-center rounded-[18px] bg-[#F0ECFF] text-primary">
                  <ShieldCheck size={22} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">Admin Access</div>
                  <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-ink">管理员登录</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={closeLoginDialog}
                className="theme-icon-button grid h-11 w-11 place-items-center rounded-[14px] border border-black/[0.05] text-muted hover:text-ink"
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mt-4 text-sm leading-6 text-muted">登录后可以添加订阅、编辑订阅和修改配置。</p>
            <div className="theme-inset mt-3 rounded-[16px] bg-[#F7F7FC] px-3 py-2 text-xs font-semibold text-muted">
              管理员账号与密码由部署环境变量配置
            </div>

            <div className="mt-5 grid gap-4">
              <Field
                label="管理员账号"
                value={loginForm.username}
                onChange={(value) => setLoginForm((current) => ({ ...current, username: value }))}
                placeholder="admin"
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
              className="theme-primary-action mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-primary px-4 text-sm font-semibold text-white shadow-[0_18px_38px_rgba(124,92,255,.26)]"
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
              className={`theme-button h-11 rounded-[14px] border px-3 text-sm font-semibold outline-none transition focus:ring-4 focus:ring-primary/10 ${
                selected
                  ? 'theme-active-tab border-primary/25 bg-[#F0ECFF] text-primary'
                  : 'border-black/[0.05] bg-[#F7F7FC] text-ink hover:border-primary/20 hover:bg-white hover:text-primary'
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
              className="theme-input flex min-h-11 min-w-0 items-center gap-3 rounded-[14px] border border-black/[0.05] bg-[#F7F7FC] px-3 py-2 text-sm font-semibold text-ink"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate">{member.name}</div>
                <div className="mt-0.5 truncate text-xs font-medium text-muted">{member.email}</div>
              </div>
              <div className="shrink-0 text-xs font-semibold text-muted">{member.expiresAt || '--'}</div>
              <button
                type="button"
                onClick={() => onDelete(member.id)}
                className="theme-icon-button grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border border-black/[0.05] bg-white text-danger transition hover:bg-danger/10"
                aria-label={`删除 ${member.name}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        ) : (
          <div className="theme-input flex min-h-11 items-center rounded-[14px] border border-black/[0.05] bg-[#F7F7FC] px-3 text-sm font-semibold text-muted">
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
        className="theme-input h-11 rounded-[14px] border border-black/[0.05] bg-[#F7F7FC] px-3 text-sm font-semibold text-ink outline-none transition focus:border-primary/30 focus:bg-white focus:ring-4 focus:ring-primary/10"
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
        className="theme-input h-11 rounded-[14px] border border-black/[0.05] bg-[#F7F7FC] px-3 text-sm font-semibold text-ink outline-none transition focus:border-primary/30 focus:bg-white focus:ring-4 focus:ring-primary/10"
      />

      {open ? (
        <div className="theme-popover absolute left-0 right-0 top-[76px] z-[70] max-h-56 overflow-y-auto rounded-[16px] border border-black/[0.05] bg-white/95 p-1.5 shadow-lift backdrop-blur-xl">
          {visibleOptions.map((option) => (
            <button
              key={option}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className={`theme-menu-item flex h-10 w-full items-center rounded-[12px] px-3 text-left text-sm font-semibold transition hover:bg-[#F7F7FC] hover:text-primary ${
                value === option ? 'theme-active-tab bg-[#F0ECFF] text-primary' : 'text-ink'
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
