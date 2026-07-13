import {
  CalendarClock,
  CircleDollarSign,
  Fingerprint,
  IdCard,
  UsersRound
} from 'lucide-react';
import { parseSubscriptionPrice } from '@/lib/billing';
import { subscriptions as demoSubscriptions } from '@/lib/data';
import type { Subscription, SubscriptionStatus } from '@/lib/data';
import { getEffectiveSubscriptionStatus, sortSubscriptionsByStatus } from '@/lib/subscription-status';

type PassTheme = {
  shell: string;
  border: string;
  glow: string;
  accent: string;
  muted: string;
  panel: string;
};

const passThemes: Record<string, PassTheme> = {
  'apple-one': {
    shell: 'bg-[#211B3D]',
    border: 'border-[#675E98]',
    glow: 'bg-[#8F79FF]',
    accent: 'text-[#D9D0FF]',
    muted: 'text-[#B7AEDB]',
    panel: 'border-[#8275B5]/45 bg-[#7565B0]/15'
  },
  netflix: {
    shell: 'bg-[#421B22]',
    border: 'border-[#9B4D59]',
    glow: 'bg-[#FF6471]',
    accent: 'text-[#FFD0D5]',
    muted: 'text-[#E6ADB5]',
    panel: 'border-[#B65B68]/45 bg-[#A53D4C]/15'
  },
  spotify: {
    shell: 'bg-[#153827]',
    border: 'border-[#39825D]',
    glow: 'bg-[#48D17B]',
    accent: 'text-[#B9F2CD]',
    muted: 'text-[#9DD0AF]',
    panel: 'border-[#54A875]/45 bg-[#36895A]/15'
  }
};

const fallbackTheme: PassTheme = {
  shell: 'bg-[#1D2924]',
  border: 'border-[#60766B]',
  glow: 'bg-[#6DC1A0]',
  accent: 'text-[#CDE9DE]',
  muted: 'text-[#AFC6BB]',
  panel: 'border-white/20 bg-white/[0.06]'
};

const statusPresentation: Record<SubscriptionStatus, { label: string; className: string }> = {
  active: { label: '有效', className: 'border-white/20 bg-white/10 text-white' },
  due: { label: '即将续费', className: 'border-[#FFD2AD]/35 bg-[#F28C45]/20 text-[#FFE1C8]' },
  paused: { label: '已暂停', className: 'border-white/15 bg-black/15 text-white/70' }
};

function formatChineseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return `${year}年${month}月${day}日`;
}

function formatMoney(subscription: Subscription) {
  const currency = subscription.price.replace(/[\d\s.,-]/g, '') || '¥';
  return `${currency}${parseSubscriptionPrice(subscription.price).toFixed(2)}`;
}

function getPassCode(subscription: Subscription) {
  return `PASS-${subscription.id.replace(/[^a-z0-9]/gi, '').toUpperCase()}`;
}

function buildDecorativePattern(seed: string) {
  const seedValue = seed.split('').reduce((total, character) => total + character.charCodeAt(0), 0);

  return Array.from({ length: 48 }, (_, index) => {
    const row = Math.floor(index / 8);
    return (seedValue + index * 7 + row * 11) % 5 < 2;
  });
}

export function PassTemplate({ items = demoSubscriptions, reminderDays = 3 }: { items?: Subscription[]; reminderDays?: number }) {
  const sortedItems = sortSubscriptionsByStatus(items, reminderDays);

  return (
    <section className="min-w-0" aria-labelledby="pass-template-title">
      <header className="min-w-0">
        <div className="flex items-center gap-2 text-xs font-semibold text-primary">
          <IdCard size={15} aria-hidden="true" />
          数字会员凭证
        </div>
        <h2 id="pass-template-title" className="mt-2 text-2xl font-bold text-ink sm:text-[28px]">订阅通行证</h2>
        <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-muted">
          将服务身份、续费信息和成员资料集中呈现在一张可辨识的会员卡中。
        </p>
      </header>

      <div className="mt-6 grid min-w-0 gap-5 xl:grid-cols-2">
        {sortedItems.map((subscription) => {
          const theme = passThemes[subscription.id] ?? fallbackTheme;
          const status = statusPresentation[getEffectiveSubscriptionStatus(subscription, reminderDays)];
          const memberNames = subscription.memberDetails.map((member) => member.name);
          const pattern = buildDecorativePattern(subscription.id);
          const titleId = `pass-${subscription.id}-title`;

          return (
            <article
              key={subscription.id}
              aria-labelledby={titleId}
              className={`relative min-w-0 overflow-hidden rounded-[26px] border p-5 text-white shadow-[var(--pass-card-shadow)] sm:p-6 ${theme.shell} ${theme.border}`}
            >
              <div className={`pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-30 blur-3xl ${theme.glow}`} aria-hidden="true" />
              <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.09),transparent_38%,rgba(255,255,255,0.03))]" aria-hidden="true" />

              <div className="relative">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className={`flex min-w-0 items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] ${theme.accent}`}>
                    <Fingerprint size={14} className="shrink-0" aria-hidden="true" />
                    Membership pass
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${status.className}`}>
                    {status.label}
                  </span>
                </div>

                <div className="mt-6 flex min-w-0 items-center gap-4">
                  <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${subscription.tone} text-white shadow-[0_12px_28px_rgba(0,0,0,0.20)]`}>
                    <subscription.icon size={25} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h3 id={titleId} className="truncate text-2xl font-bold tracking-[-0.02em]">{subscription.name}</h3>
                    <p className={`mt-1 truncate text-sm font-semibold ${theme.muted}`}>{subscription.plan}</p>
                  </div>
                </div>

                <dl className={`mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border ${theme.panel}`}>
                  <div className="bg-black/10 p-3.5">
                    <dt className={`flex items-center gap-1.5 text-[11px] font-semibold ${theme.muted}`}>
                      <CalendarClock size={13} aria-hidden="true" />
                      下次续费
                    </dt>
                    <dd className="mt-2 text-sm font-bold">
                      <time dateTime={subscription.nextBilling}>{formatChineseDate(subscription.nextBilling)}</time>
                    </dd>
                  </div>
                  <div className="bg-black/10 p-3.5">
                    <dt className={`flex items-center gap-1.5 text-[11px] font-semibold ${theme.muted}`}>
                      <CircleDollarSign size={13} aria-hidden="true" />
                      账单金额
                    </dt>
                    <dd className="mt-2 text-sm font-bold">{formatMoney(subscription)} · {subscription.cycle}</dd>
                  </div>
                </dl>

                <div className="mt-5 grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_132px] sm:items-end">
                  <div className="min-w-0">
                    <div className={`flex items-center gap-2 text-[11px] font-semibold ${theme.muted}`}>
                      <UsersRound size={14} aria-hidden="true" />
                      成员信息 · {subscription.members}
                    </div>
                    <div className="mt-3 flex min-w-0 items-center gap-3">
                      <div className="flex shrink-0 -space-x-2" aria-hidden="true">
                        {subscription.memberDetails.slice(0, 4).map((member) => (
                          <span
                            key={member.id}
                            className="grid h-8 w-8 place-items-center rounded-full border-2 border-white/60 bg-white/15 text-[10px] font-bold text-white backdrop-blur"
                          >
                            {member.name.slice(0, 1).toUpperCase()}
                          </span>
                        ))}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold">{memberNames.length > 0 ? memberNames.join('、') : '尚未登记成员'}</div>
                        <div className={`mt-1 text-[11px] font-medium ${theme.muted}`}>
                          已登记 {memberNames.length} 位具名成员
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={`rounded-xl border p-3 ${theme.panel}`}>
                    <div className={`text-[9px] font-bold uppercase tracking-[0.14em] ${theme.muted}`}>装饰纹样</div>
                    <div className="mt-2 grid grid-cols-8 gap-1" aria-hidden="true">
                      {pattern.map((filled, index) => (
                        <span key={index} className={`h-1.5 rounded-[1px] ${filled ? 'bg-white' : 'bg-white/15'}`} />
                      ))}
                    </div>
                    <span className="sr-only">装饰性编码图案，不提供扫描功能。</span>
                  </div>
                </div>

                <div className={`mt-5 flex min-w-0 items-center justify-between gap-3 border-t pt-4 text-[10px] font-semibold uppercase tracking-[0.12em] ${theme.border} ${theme.muted}`}>
                  <span className="truncate">{getPassCode(subscription)}</span>
                  <span className="shrink-0">Subscription Desk</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
