import { CalendarDays, ReceiptText, UsersRound } from 'lucide-react';
import { getMonthlyDivisor, parseSubscriptionPrice } from '@/lib/billing';
import { statusLabels, subscriptions as demoSubscriptions } from '@/lib/data';
import type { Subscription, SubscriptionStatus } from '@/lib/data';
import { getEffectiveSubscriptionStatus, sortSubscriptionsByStatus } from '@/lib/subscription-status';

const statusStyles: Record<SubscriptionStatus, string> = {
  active: 'frontend-status-active',
  due: 'frontend-status-due',
  paused: 'frontend-status-paused'
};

function formatChineseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);

  if (![year, month, day].every(Number.isFinite)) return value;
  return `${year}年${month}月${day}日`;
}

function formatMonthlyEquivalent(price: string, cycle: string) {
  const amount = parseSubscriptionPrice(price) / getMonthlyDivisor(cycle);
  const currency = price.replace(/[\d\s.,-]/g, '') || '¥';
  return `${currency}${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
}

export function CardsTemplate({ items = demoSubscriptions, reminderDays = 3 }: { items?: Subscription[]; reminderDays?: number }) {
  const sortedItems = sortSubscriptionsByStatus(items, reminderDays);

  return (
    <section aria-labelledby="subscription-cards-title" className="min-w-0">
      <header className="max-w-3xl">
        <div className="text-xs font-bold uppercase text-primary">Read-only details</div>
        <h2 id="subscription-cards-title" className="mt-2 text-2xl font-bold text-ink sm:text-[30px]">
          订阅详情卡片
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          只读展示每项服务的方案、账期、续费日期与共享成员，适合快速浏览和逐项核对。
        </p>
      </header>

      <div className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {sortedItems.map((subscription) => {
          const Icon = subscription.icon;
          const effectiveStatus = getEffectiveSubscriptionStatus(subscription, reminderDays);
          const status = statusStyles[effectiveStatus];
          const namedMembers = subscription.memberDetails;

          return (
            <article
              key={subscription.id}
              aria-labelledby={`subscription-card-${subscription.id}`}
              className="theme-card flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--card-shadow)]"
            >
              <div className="theme-track h-1.5 bg-[var(--border)]">
                <div className={`h-full w-2/5 bg-gradient-to-r ${subscription.tone}`} aria-hidden="true" />
              </div>

              <div className="flex flex-1 flex-col p-5 sm:p-6">
                <div className="flex min-w-0 items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${subscription.tone} text-white shadow-sm`}>
                      <Icon size={21} aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <h3 id={`subscription-card-${subscription.id}`} className="truncate text-lg font-bold text-ink">
                        {subscription.name}
                      </h3>
                      <p className="mt-0.5 truncate text-sm font-medium text-muted">{subscription.plan}</p>
                    </div>
                  </div>
                  <span className={`frontend-status inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${status}`}>
                    <span className="frontend-status-dot h-1.5 w-1.5 rounded-full" aria-hidden="true" />
                    {statusLabels[effectiveStatus]}
                  </span>
                </div>

                <div className="mt-5 flex items-center justify-between gap-3 border-y border-[var(--border)] py-4">
                  <div>
                    <div className="text-xs font-semibold text-muted">订阅金额</div>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold text-ink">{subscription.price}</span>
                      <span className="text-xs font-semibold text-muted">/ {subscription.cycle}</span>
                    </div>
                  </div>
                  <div className="theme-inset rounded-xl bg-[var(--surface-muted)] px-3 py-2 text-right">
                    <div className="text-[10px] font-semibold text-muted">月度折算</div>
                    <div className="mt-0.5 text-sm font-bold text-primary">
                      {formatMonthlyEquivalent(subscription.price, subscription.cycle)}
                    </div>
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3">
                  <div className="theme-inset rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3.5">
                    <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
                      <CalendarDays size={14} className="text-primary" aria-hidden="true" />
                      下次续费
                    </dt>
                    <dd className="mt-2 text-sm font-bold text-ink">
                      <time dateTime={subscription.nextBilling}>{formatChineseDate(subscription.nextBilling)}</time>
                    </dd>
                  </div>
                  <div className="theme-inset rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3.5">
                    <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
                      <ReceiptText size={14} className="text-primary" aria-hidden="true" />
                      服务分类
                    </dt>
                    <dd className="mt-2 truncate text-sm font-bold text-ink">{subscription.tag}</dd>
                  </div>
                </dl>

                <section className="theme-inset mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4" aria-labelledby={`card-members-${subscription.id}`}>
                  <div className="flex items-center justify-between gap-3">
                    <h4 id={`card-members-${subscription.id}`} className="flex items-center gap-2 text-xs font-bold text-ink">
                      <UsersRound size={15} className="text-primary" aria-hidden="true" />
                      共享成员
                    </h4>
                    <span className="text-xs font-bold text-primary">{subscription.members}</span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {namedMembers.map((member) => (
                      <span
                        key={member.id}
                        className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-ink"
                      >
                        <span className="theme-icon-chip grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[9px] font-bold text-primary" aria-hidden="true">
                          {member.name.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="truncate">{member.name}</span>
                      </span>
                    ))}
                    {namedMembers.length === 0 ? <span className="text-xs font-medium text-muted">暂无具名成员</span> : null}
                  </div>
                </section>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
