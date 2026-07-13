'use client';

import { useEffect, useState, type ComponentType } from 'react';
import { Cloud, Eye, Film, Music2, PackageOpen, ReceiptText } from 'lucide-react';
import { subscriptions as demoSubscriptions, type Subscription, type SubscriptionMember, type SubscriptionStatus } from '@/lib/data';
import {
  frontendTemplateStorageKey,
  isTemplateSlug,
  type TemplateSlug
} from '@/lib/templates';
import { dashboardThemeStorageKey, isDashboardTheme } from '@/lib/themes';
import type { DashboardTheme } from '@/lib/themes';
import { defaultFrontendDisplayMode } from '@/lib/frontend-display-mode';
import { CardsTemplate } from './CardsTemplate';
import { FrontendDisplayModeControl } from './FrontendDisplayModeControl';
import { LedgerTemplate } from './LedgerTemplate';
import { PassTemplate } from './PassTemplate';
import { ReceiptTemplate } from './ReceiptTemplate';
import { useFrontendDisplayMode } from './useFrontendDisplayMode';

const defaultTemplate: TemplateSlug = 'cards';
const subscriptionStorageKey = 'subscription-dashboard-items';
const workspaceConfigStorageKey = 'subscription-dashboard-workspace-config';
const defaultCopyrightText = '© 2026 续费管家. 保留所有权利。';

type TemplateContentProps = {
  items?: Subscription[];
  reminderDays?: number;
};

type DisplayState = {
  selectedSlug: TemplateSlug;
  selectedTheme: DashboardTheme;
  items: Subscription[];
  copyrightText: string;
  reminderDays: number;
};

const iconRegistry = {
  cloud: {
    icon: Cloud,
    tone: 'from-[#7C5CFF] via-[#9275FF] to-[#C8B8FF]'
  },
  film: {
    icon: Film,
    tone: 'from-[#FF5A5F] via-[#FF7A84] to-[#FFB0B5]'
  },
  music: {
    icon: Music2,
    tone: 'from-[#34C759] via-[#63D981] to-[#A7EEC0]'
  }
} as const;

type IconName = keyof typeof iconRegistry;

const allowedStatuses = new Set<SubscriptionStatus>(['active', 'due', 'paused']);
const allowedTones = new Set<string>(Object.values(iconRegistry).map((entry) => entry.tone));

const templateComponents: Record<TemplateSlug, ComponentType<TemplateContentProps>> = {
  cards: CardsTemplate,
  ledger: LedgerTemplate,
  receipt: ReceiptTemplate,
  pass: PassTemplate
};

export function FrontendDisplay() {
  const [displayState, setDisplayState] = useState<DisplayState | null>(null);
  const { mode: displayMode, setMode: setDisplayMode } = useFrontendDisplayMode();

  useEffect(() => {
    function loadDisplayState() {
      try {
        const storedSlug = window.localStorage.getItem(frontendTemplateStorageKey);
        const requestedSlug = new URLSearchParams(window.location.search).get('template');
        const storedTheme = window.localStorage.getItem(dashboardThemeStorageKey);
        const restoredItems = restoreSubscriptions(window.localStorage.getItem(subscriptionStorageKey));
        const frontendConfig = restoreFrontendConfig(window.localStorage.getItem(workspaceConfigStorageKey));

        setDisplayState({
          selectedSlug:
            requestedSlug && isTemplateSlug(requestedSlug)
              ? requestedSlug
              : storedSlug && isTemplateSlug(storedSlug)
                ? storedSlug
                : defaultTemplate,
          selectedTheme: isDashboardTheme(storedTheme) ? storedTheme : 'forest',
          items: restoredItems ?? demoSubscriptions,
          copyrightText: frontendConfig.copyrightText,
          reminderDays: frontendConfig.reminderDays
        });
      } catch {
        setDisplayState({
          selectedSlug: defaultTemplate,
          selectedTheme: 'forest',
          items: demoSubscriptions,
          copyrightText: defaultCopyrightText,
          reminderDays: 3
        });
      }
    }

    function handleStorage(event: StorageEvent) {
      if (
        event.key === frontendTemplateStorageKey ||
        event.key === dashboardThemeStorageKey ||
        event.key === subscriptionStorageKey ||
        event.key === workspaceConfigStorageKey
      ) {
        loadDisplayState();
      }
    }

    loadDisplayState();
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  if (!displayState) return <DisplayLoadingState />;

  const { selectedSlug, selectedTheme, items, copyrightText, reminderDays } = displayState;
  const TemplateContent = templateComponents[selectedSlug];

  return (
    <main
      data-theme={selectedTheme}
      data-color-mode={displayMode}
      className="frontend-shell dashboard-shell min-h-screen bg-[var(--canvas)] text-ink"
    >
      <header className="theme-nav border-b border-[var(--border)] bg-[var(--surface)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 w-full max-w-[1520px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:flex-nowrap sm:px-6 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3" aria-label="续费管家只读前台">
            <span className="brand-mark grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white shadow-sm">
              <ReceiptText size={19} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-extrabold text-ink">续费管家</span>
              <span className="block truncate text-[10px] font-bold uppercase tracking-[0.14em] text-muted">订阅公开展示</span>
            </span>
          </div>

          <div className="order-3 w-full sm:order-none sm:w-auto">
            <FrontendDisplayModeControl value={displayMode} onChange={setDisplayMode} compact />
          </div>

          <div className="hidden shrink-0 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary xl:inline-flex">
            <Eye size={14} aria-hidden="true" />
            只读展示
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1520px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        {items.length > 0 ? <TemplateContent items={items} reminderDays={reminderDays} /> : <EmptyDisplayState />}

        <footer className="mt-12 border-t border-[var(--border)] py-6 text-center text-xs font-medium text-muted">{copyrightText}</footer>
      </div>
    </main>
  );
}

function EmptyDisplayState() {
  return (
    <section className="theme-card rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-6 py-14 text-center" role="status">
      <PackageOpen size={28} className="mx-auto text-primary" aria-hidden="true" />
      <h2 className="mt-4 text-lg font-bold text-ink">暂无订阅明细</h2>
      <p className="mt-2 text-sm font-medium text-muted">后台添加订阅后，明细会自动显示在这里。</p>
    </section>
  );
}

function DisplayLoadingState() {
  return (
    <main
      data-theme="forest"
      data-color-mode={defaultFrontendDisplayMode}
      className="frontend-shell dashboard-shell min-h-screen bg-[var(--canvas)] text-ink"
      aria-busy="true"
    >
      <div className="sr-only" role="status" aria-live="polite">正在加载订阅展示模板</div>
      <header className="theme-nav border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex min-h-16 w-full max-w-[1520px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:flex-nowrap sm:px-6 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-[var(--primary-soft)]" />
            <span>
              <span className="block h-3 w-20 animate-pulse rounded-full bg-[var(--surface-hover)]" />
              <span className="mt-2 block h-2 w-28 animate-pulse rounded-full bg-[var(--surface-muted)]" />
            </span>
          </div>
          <span className="order-3 h-10 w-full animate-pulse rounded-xl bg-[var(--surface-muted)] sm:order-none sm:w-[268px]" />
        </div>
      </header>
      <div className="mx-auto w-full max-w-[1520px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <div className="h-3 w-36 animate-pulse rounded-full bg-[var(--surface-hover)]" />
        <div className="mt-4 h-9 w-64 max-w-full animate-pulse rounded-lg bg-[var(--surface-hover)]" />
        <div className="mt-4 h-3 w-full max-w-xl animate-pulse rounded-full bg-[var(--surface-muted)]" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-64 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]" />
          ))}
        </div>
      </div>
    </main>
  );
}

function restoreSubscriptions(rawValue: string | null): Subscription[] | null {
  if (!rawValue) return null;

  try {
    const parsed: unknown = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return null;
    if (parsed.length === 0) return [];

    const restored = parsed
      .slice(0, 250)
      .map((value, index) => normalizeSubscription(value, index))
      .filter((subscription): subscription is Subscription => subscription !== null);

    return restored.length > 0 ? restored : null;
  } catch {
    return null;
  }
}

function normalizeSubscription(value: unknown, index: number): Subscription | null {
  if (!isRecord(value)) return null;

  const fallback = demoSubscriptions[index % demoSubscriptions.length];
  const id = normalizeText(value.id, '', 120);
  const name = normalizeText(value.name, '', 120);
  if (!id || !name) return null;

  const iconName = isIconName(value.iconName) ? value.iconName : getFallbackIconName(index);
  const iconEntry = iconRegistry[iconName];
  const nextBilling = normalizeDate(value.nextBilling, fallback?.nextBilling ?? '2026-08-18');
  const memberDetails = normalizeMembers(value.memberDetails, value.memberEmails, nextBilling, id);
  const status = isSubscriptionStatus(value.status) ? value.status : 'active';
  const storedTone = normalizeText(value.tone, '', 120);

  return {
    id,
    name,
    plan: normalizeText(value.plan, fallback?.plan ?? '标准方案', 160),
    tag: normalizeText(value.tag, fallback?.tag ?? 'Subscription', 80),
    price: normalizeText(value.price, fallback?.price ?? '¥0.00', 40),
    cycle: normalizeText(value.cycle, fallback?.cycle ?? '月付', 40),
    nextBilling,
    members: normalizeText(value.members, `${memberDetails.length} 人`, 40),
    memberEmails: memberDetails.map((member) => member.email),
    memberDetails,
    status,
    icon: iconEntry.icon,
    tone: allowedTones.has(storedTone) ? storedTone : iconEntry.tone
  };
}

function normalizeMembers(
  memberDetailsValue: unknown,
  memberEmailsValue: unknown,
  fallbackExpiresAt: string,
  subscriptionId: string
): SubscriptionMember[] {
  const members: SubscriptionMember[] = [];
  const seenEmails = new Set<string>();

  if (Array.isArray(memberDetailsValue)) {
    memberDetailsValue.slice(0, 100).forEach((value, index) => {
      if (!isRecord(value)) return;

      const email = normalizeEmail(value.email);
      if (!email || seenEmails.has(email)) return;

      seenEmails.add(email);
      members.push({
        id: normalizeText(value.id, `${subscriptionId}-member-${index + 1}`, 160),
        name: normalizeText(value.name, getMemberNameFromEmail(email), 120),
        email,
        expiresAt: normalizeDate(value.expiresAt, fallbackExpiresAt)
      });
    });
  }

  if (Array.isArray(memberEmailsValue)) {
    memberEmailsValue.slice(0, 100).forEach((value, index) => {
      const email = normalizeEmail(value);
      if (!email || seenEmails.has(email)) return;

      seenEmails.add(email);
      members.push({
        id: `${subscriptionId}-email-${index + 1}`,
        name: getMemberNameFromEmail(email),
        email,
        expiresAt: fallbackExpiresAt
      });
    });
  }

  return members;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIconName(value: unknown): value is IconName {
  return typeof value === 'string' && value in iconRegistry;
}

function isSubscriptionStatus(value: unknown): value is SubscriptionStatus {
  return typeof value === 'string' && allowedStatuses.has(value as SubscriptionStatus);
}

function getFallbackIconName(index: number): IconName {
  return (['cloud', 'film', 'music'] as const)[index % 3];
}

function normalizeText(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== 'string') return fallback;

  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : fallback;
}

function normalizeEmail(value: unknown) {
  if (typeof value !== 'string') return '';

  const normalized = value.trim().toLowerCase().slice(0, 254);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : '';
}

function getMemberNameFromEmail(email: string) {
  const localPart = email.split('@')[0]?.replace(/[._-]+/g, ' ').trim();
  return localPart || '成员';
}

function normalizeDate(value: unknown, fallback: string) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? fallback : value;
}

function restoreFrontendConfig(rawValue: string | null) {
  if (!rawValue) return { copyrightText: defaultCopyrightText, reminderDays: 3 };

  try {
    const parsed: unknown = JSON.parse(rawValue);
    if (!isRecord(parsed)) return { copyrightText: defaultCopyrightText, reminderDays: 3 };

    const parsedReminderDays =
      typeof parsed.reminderDays === 'string' ? Number.parseInt(parsed.reminderDays, 10) : Number.NaN;

    return {
      copyrightText: normalizeText(parsed.copyrightText, defaultCopyrightText, 200),
      reminderDays: Number.isFinite(parsedReminderDays) ? Math.max(parsedReminderDays, 0) : 3
    };
  } catch {
    return { copyrightText: defaultCopyrightText, reminderDays: 3 };
  }
}
