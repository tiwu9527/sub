import {
  CalendarDays,
  CircleDollarSign,
  Hash,
  ReceiptText,
  RefreshCw,
  UsersRound
} from 'lucide-react';
import { getMonthlyDivisor, parseSubscriptionPrice } from '@/lib/billing';
import { subscriptions as demoSubscriptions } from '@/lib/data';
import type { Subscription, SubscriptionStatus } from '@/lib/data';
import { getEffectiveSubscriptionStatus, sortSubscriptionsByStatus } from '@/lib/subscription-status';

const statusPresentation: Record<SubscriptionStatus, { label: string; className: string }> = {
  active: { label: '正常', className: 'frontend-status-active' },
  due: { label: '即将扣费', className: 'frontend-status-due' },
  paused: { label: '已暂停', className: 'frontend-status-paused' }
};

function formatChineseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return `${year}年${month}月${day}日`;
}

function formatMoney(value: number, sourcePrice: string) {
  const currency = sourcePrice.replace(/[\d\s.,-]/g, '') || '¥';
  return `${currency}${value.toFixed(2)}`;
}

function getReferenceId(subscription: Subscription) {
  const dateCode = subscription.nextBilling.replaceAll('-', '');
  const serviceCode = subscription.id.replace(/[^a-z0-9]/gi, '').slice(0, 10).toUpperCase();
  return `RCPT-${dateCode}-${serviceCode}`;
}

function getMemberNames(subscription: Subscription) {
  if (subscription.memberDetails.length === 0) return '未登记具名成员';
  return subscription.memberDetails.map((member) => member.name).join('、');
}

export function ReceiptTemplate({ items = demoSubscriptions, reminderDays = 3 }: { items?: Subscription[]; reminderDays?: number }) {
  const sortedItems = sortSubscriptionsByStatus(items, reminderDays);

  return (
    <section className="min-w-0" aria-labelledby="receipt-template-title">
      <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-primary">
            <ReceiptText size={15} aria-hidden="true" />
            订阅账单明细
          </div>
          <h2 id="receipt-template-title" className="mt-2 text-2xl font-bold text-ink sm:text-[28px]">续费收据</h2>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-muted">
            以逐项凭证核对服务方案、账单周期、扣费日期与共享成员。
          </p>
        </div>
        <div className="theme-surface inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-muted shadow-glow">
          <CircleDollarSign size={15} className="text-primary" aria-hidden="true" />
          按订阅原始币种展示
        </div>
      </header>

      <div className="mt-6 grid min-w-0 gap-5 md:grid-cols-2 2xl:grid-cols-3">
        {sortedItems.map((subscription) => {
          const status = statusPresentation[getEffectiveSubscriptionStatus(subscription, reminderDays)];
          const amount = parseSubscriptionPrice(subscription.price);
          const monthlyEquivalent = amount / getMonthlyDivisor(subscription.cycle);
          const referenceId = getReferenceId(subscription);
          const titleId = `receipt-${subscription.id}-title`;

          return (
            <article
              key={subscription.id}
              aria-labelledby={titleId}
              className="relative min-w-0 overflow-hidden rounded-[20px] border border-[var(--receipt-card-border)] bg-[var(--receipt-card-bg)] shadow-[var(--receipt-card-shadow)]"
            >
              <div className="p-5 sm:p-6">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                    Subscription receipt
                  </div>
                  <span className={`frontend-status shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${status.className}`}>
                    {status.label}
                  </span>
                </div>

                <div className="mt-5 flex min-w-0 items-center gap-3">
                  <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${subscription.tone} text-white shadow-sm`}>
                    <subscription.icon size={21} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h3 id={titleId} className="truncate text-xl font-bold text-ink">{subscription.name}</h3>
                    <p className="mt-1 truncate text-sm font-medium text-muted">{subscription.plan}</p>
                  </div>
                </div>

                <div className="mt-5 rounded-xl border border-[var(--receipt-inset-border)] bg-[var(--receipt-inset-bg)] p-4">
                  <div className="text-xs font-semibold text-muted">本期账单金额</div>
                  <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                    <div className="text-[34px] font-bold leading-none text-ink">{formatMoney(amount, subscription.price)}</div>
                    <div className="rounded-md bg-[var(--surface)] px-2.5 py-1.5 text-xs font-bold text-primary shadow-sm">{subscription.cycle}</div>
                  </div>
                  <div className="mt-3 border-t border-dashed border-[var(--border-strong)] pt-3 text-xs font-medium text-muted">
                    月度等效 {formatMoney(monthlyEquivalent, subscription.price)}
                  </div>
                </div>
              </div>

              <div className="relative border-t border-dashed border-[var(--border-strong)]" aria-hidden="true">
                <span className="absolute -left-2.5 -top-2.5 h-5 w-5 rounded-full border border-[var(--border)] bg-[var(--canvas)]" />
                <span className="absolute -right-2.5 -top-2.5 h-5 w-5 rounded-full border border-[var(--border)] bg-[var(--canvas)]" />
              </div>

              <div className="px-5 py-5 sm:px-6">
                <dl className="divide-y divide-[var(--border)]">
                  <div className="flex items-start justify-between gap-4 py-3 first:pt-0">
                    <dt className="flex shrink-0 items-center gap-2 text-xs font-semibold text-muted">
                      <RefreshCw size={14} aria-hidden="true" />
                      账单周期
                    </dt>
                    <dd className="text-right text-sm font-bold text-ink">{subscription.cycle}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4 py-3">
                    <dt className="flex shrink-0 items-center gap-2 text-xs font-semibold text-muted">
                      <CalendarDays size={14} aria-hidden="true" />
                      扣费日期
                    </dt>
                    <dd className="text-right text-sm font-bold text-ink">
                      <time dateTime={subscription.nextBilling}>{formatChineseDate(subscription.nextBilling)}</time>
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4 py-3">
                    <dt className="flex shrink-0 items-center gap-2 text-xs font-semibold text-muted">
                      <UsersRound size={14} aria-hidden="true" />
                      成员数量
                    </dt>
                    <dd className="text-right text-sm font-bold text-ink">{subscription.members}</dd>
                  </div>
                  <div className="flex flex-col gap-2 py-3 last:pb-0">
                    <dt className="text-xs font-semibold text-muted">登记成员</dt>
                    <dd className="break-words text-sm font-bold leading-6 text-ink">{getMemberNames(subscription)}</dd>
                  </div>
                </dl>

                <div className="mt-5 rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-3 py-3">
                  <div className="flex min-w-0 items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                    <Hash size={13} className="shrink-0" aria-hidden="true" />
                    Reference ID
                  </div>
                  <div className="mt-1.5 break-all font-mono text-xs font-bold text-ink">{referenceId}</div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
