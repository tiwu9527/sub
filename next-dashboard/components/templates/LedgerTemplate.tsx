import { CalendarDays, Hash, ReceiptText, UsersRound } from 'lucide-react';
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

function formatMonthlyEquivalent(subscription: Subscription) {
  const amount = parseSubscriptionPrice(subscription.price) / getMonthlyDivisor(subscription.cycle);
  const currency = subscription.price.replace(/[\d\s.,-]/g, '') || '¥';
  return `${currency}${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
}

export function LedgerTemplate({ items = demoSubscriptions, reminderDays = 3 }: { items?: Subscription[]; reminderDays?: number }) {
  const sortedItems = sortSubscriptionsByStatus(items, reminderDays);

  return (
    <section aria-labelledby="subscription-ledger-title" className="min-w-0">
      <header className="max-w-3xl">
        <div className="text-xs font-bold uppercase text-primary">Read-only ledger</div>
        <h2 id="subscription-ledger-title" className="mt-2 text-2xl font-bold text-ink sm:text-[30px]">
          订阅明细台账
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          只读汇总服务标识、方案、状态、账期和全部成员资料；桌面端使用明细表，移动端自动切换为逐项记录。
        </p>
      </header>

      <div className="theme-card mt-6 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--card-shadow)]">
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[1240px] border-collapse text-left">
            <caption className="sr-only">全部订阅字段、账单信息与成员明细</caption>
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-[11px] font-bold text-muted">
                <th scope="col" className="px-4 py-3.5">服务与标识</th>
                <th scope="col" className="px-4 py-3.5">方案 / 分类</th>
                <th scope="col" className="px-4 py-3.5">状态</th>
                <th scope="col" className="px-4 py-3.5">金额 / 周期</th>
                <th scope="col" className="px-4 py-3.5">下次续费</th>
                <th scope="col" className="px-4 py-3.5">成员明细</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {sortedItems.map((subscription) => (
                <LedgerTableRow key={subscription.id} subscription={subscription} reminderDays={reminderDays} />
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-[var(--border)] lg:hidden">
          {sortedItems.map((subscription) => (
            <LedgerMobileRow key={subscription.id} subscription={subscription} reminderDays={reminderDays} />
          ))}
        </div>

        <div className="theme-inset border-t border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-xs font-medium text-muted sm:px-5">
          共 {sortedItems.length} 项订阅；所有金额均保留源数据币种，月度折算仅用于账期对照。
        </div>
      </div>
    </section>
  );
}

function LedgerTableRow({ subscription, reminderDays }: { subscription: Subscription; reminderDays: number }) {
  const Icon = subscription.icon;
  const effectiveStatus = getEffectiveSubscriptionStatus(subscription, reminderDays);
  const status = statusStyles[effectiveStatus];

  return (
    <tr className="align-top text-sm transition hover:bg-[var(--surface-hover)]">
      <th scope="row" className="px-4 py-4 font-normal">
        <div className="flex min-w-0 items-start gap-3">
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${subscription.tone} text-white shadow-sm`}>
            <Icon size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-ink">{subscription.name}</div>
            <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-muted">
              <Hash size={11} aria-hidden="true" />
              <span>{subscription.id}</span>
            </div>
          </div>
        </div>
      </th>
      <td className="px-4 py-4">
        <div className="font-semibold text-ink">{subscription.plan}</div>
        <div className="theme-inset mt-1.5 inline-flex rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] font-semibold text-muted">
          {subscription.tag}
        </div>
      </td>
      <td className="px-4 py-4">
        <span className={`frontend-status inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${status}`}>
          <span className="frontend-status-dot h-1.5 w-1.5 rounded-full" aria-hidden="true" />
          {statusLabels[effectiveStatus]}
        </span>
      </td>
      <td className="px-4 py-4">
        <div className="font-bold text-ink">{subscription.price} / {subscription.cycle}</div>
        <div className="mt-1 text-[11px] font-medium text-muted">月度折算 {formatMonthlyEquivalent(subscription)}</div>
      </td>
      <td className="px-4 py-4">
        <time dateTime={subscription.nextBilling} className="font-semibold text-ink">
          {formatChineseDate(subscription.nextBilling)}
        </time>
        <div className="mt-1 text-[11px] font-medium text-muted">原始值 {subscription.nextBilling}</div>
      </td>
      <td className="max-w-[400px] px-4 py-4">
        <div className="flex items-center gap-2 text-xs font-bold text-ink">
          <UsersRound size={14} className="text-primary" aria-hidden="true" />
          {subscription.members} · {subscription.memberDetails.length} 位具名成员
        </div>
        <div className="mt-2 space-y-2">
          {subscription.memberDetails.map((member) => (
            <div key={member.id} className="theme-inset rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className="text-xs font-bold text-ink">{member.name}</span>
                <time dateTime={member.expiresAt} className="text-[10px] font-semibold text-muted">
                  到期 {formatChineseDate(member.expiresAt)}
                </time>
              </div>
            </div>
          ))}
        </div>
      </td>
    </tr>
  );
}

function LedgerMobileRow({ subscription, reminderDays }: { subscription: Subscription; reminderDays: number }) {
  const Icon = subscription.icon;
  const effectiveStatus = getEffectiveSubscriptionStatus(subscription, reminderDays);
  const status = statusStyles[effectiveStatus];

  return (
    <article aria-labelledby={`ledger-mobile-${subscription.id}`} className="p-4 sm:p-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${subscription.tone} text-white`}>
            <Icon size={19} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 id={`ledger-mobile-${subscription.id}`} className="truncate text-base font-bold text-ink">
              {subscription.name}
            </h3>
            <p className="mt-0.5 truncate text-xs font-medium text-muted">{subscription.plan}</p>
          </div>
        </div>
        <span className={`frontend-status inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-bold ${status}`}>
          <span className="frontend-status-dot h-1.5 w-1.5 rounded-full" aria-hidden="true" />
            {statusLabels[effectiveStatus]}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--border)] text-xs">
        <MobileDetail label="服务标识" value={subscription.id} icon={Hash} />
        <MobileDetail label="分类" value={subscription.tag} icon={ReceiptText} />
        <MobileDetail label="金额 / 周期" value={`${subscription.price} / ${subscription.cycle}`} icon={ReceiptText} />
        <MobileDetail label="月度折算" value={formatMonthlyEquivalent(subscription)} icon={ReceiptText} />
        <MobileDetail label="下次续费" value={formatChineseDate(subscription.nextBilling)} icon={CalendarDays} />
        <MobileDetail label="成员数量" value={subscription.members} icon={UsersRound} />
      </dl>

      <section className="theme-inset mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3.5" aria-labelledby={`ledger-members-${subscription.id}`}>
        <div className="flex items-center justify-between gap-3">
          <h4 id={`ledger-members-${subscription.id}`} className="text-xs font-bold text-ink">
            全部成员资料
          </h4>
          <span className="text-[11px] font-semibold text-muted">{subscription.memberDetails.length} 位具名成员</span>
        </div>
        <div className="mt-3 space-y-2">
          {subscription.memberDetails.map((member) => (
            <div key={member.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold text-ink">{member.name}</span>
                <time dateTime={member.expiresAt} className="text-[10px] font-semibold text-muted">
                  到期 {formatChineseDate(member.expiresAt)}
                </time>
              </div>
            </div>
          ))}
        </div>
      </section>
    </article>
  );
}

function MobileDetail({
  label,
  value,
  icon: Icon
}: {
  label: string;
  value: string;
  icon: typeof Hash;
}) {
  return (
    <div className="min-w-0 bg-[var(--surface)] p-3">
      <dt className="flex items-center gap-1.5 text-[10px] font-semibold text-muted">
        <Icon size={12} aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-1.5 break-words font-bold text-ink">{value}</dd>
    </div>
  );
}
