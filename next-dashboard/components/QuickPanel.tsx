'use client';

import { CalendarClock, Gauge, Settings2, TrendingUp, UsersRound } from 'lucide-react';
import { calculateMonthlySpend } from '@/lib/billing';
import { trendPoints } from '@/lib/data';
import type { Subscription } from '@/lib/data';

type PanelIcon = typeof CalendarClock;

function getClosestSubscription(subscriptions: Subscription[]) {
  const now = Date.now();

  return subscriptions
    .filter((subscription) => subscription.status !== 'paused')
    .map((subscription) => ({ subscription, distance: Math.abs(new Date(`${subscription.nextBilling}T00:00:00`).getTime() - now) }))
    .sort((first, second) => first.distance - second.distance)[0]?.subscription;
}

export function QuickPanel({
  config,
  subscriptions,
  onOpenSettings
}: {
  config: {
    monthlyBudget: string;
    currency: string;
    reminderDays: string;
  };
  subscriptions: Subscription[];
  onOpenSettings: () => void;
}) {
  const maxValue = Math.max(...trendPoints.map((point) => point.value));
  const budget = Number(config.monthlyBudget) || 40;
  const currentSpend = calculateMonthlySpend(subscriptions);
  const budgetPercent = Math.round((currentSpend / budget) * 100);
  const budgetProgress = Math.min(100, budgetPercent);
  const budgetHealthy = budgetPercent <= 100;
  const closestSubscription = getClosestSubscription(subscriptions);

  return (
    <aside className="quick-panel min-w-0 space-y-4">
      <PanelShell>
        <PanelHeader icon={CalendarClock} title="最近账单" onOpenSettings={onOpenSettings} />
        {closestSubscription ? (
          <div className="mt-5">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${closestSubscription.tone} text-white`}>
                  <closestSubscription.icon size={19} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-ink">{closestSubscription.name}</div>
                  <div className="mt-1 truncate text-xs text-muted">{closestSubscription.nextBilling} · {closestSubscription.cycle}</div>
                </div>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${closestSubscription.status === 'due' ? 'bg-[#FDF0E5] text-[#B96220]' : 'bg-[#E8F4EC] text-success'}`}>
                {closestSubscription.status === 'due' ? '待确认' : '已同步'}
              </span>
            </div>
            <div className="mt-5 border-y border-[#E7ECE9] py-4">
              <div className="text-xs font-medium text-muted">本期金额</div>
              <div className="mt-1 text-[30px] font-bold leading-none text-ink">{closestSubscription.price}</div>
            </div>
            <div className="mt-4 flex min-w-0 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-muted">
                <UsersRound size={15} className="shrink-0" />
                <span className="truncate">{closestSubscription.members}共同使用</span>
              </div>
              <div className="flex -space-x-1.5">
                {closestSubscription.memberDetails.slice(0, 4).map((member, index) => (
                  <div
                    key={member.id}
                    title={member.name}
                    className={`grid h-7 w-7 place-items-center rounded-full border-2 border-white text-[10px] font-bold text-white ${
                      ['bg-[#0F766E]', 'bg-[#2563EB]', 'bg-[#B96220]', 'bg-[#68746D]'][index % 4]
                    }`}
                  >
                    {member.name.slice(0, 1).toUpperCase()}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 text-sm text-muted">暂无活跃账单</div>
        )}
      </PanelShell>

      <PanelShell>
        <PanelHeader icon={Gauge} title="预算使用" onOpenSettings={onOpenSettings} />
        <div className="mt-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[32px] font-bold leading-none text-ink">{budgetPercent}%</div>
              <div className="mt-2 text-xs font-medium text-muted">已使用 {config.currency}{currentSpend.toFixed(2)}</div>
            </div>
            <div className={`rounded-full px-2.5 py-1 text-xs font-semibold ${budgetHealthy ? 'bg-[#E8F4EC] text-success' : 'bg-[#FCEBEC] text-danger'}`}>
              {budgetHealthy ? '预算健康' : '超出预算'}
            </div>
          </div>
          <div className="theme-track mt-5 h-2 overflow-hidden rounded-full bg-[#E9EEEB]">
            <div
              style={{ width: `${budgetProgress}%` }}
              className={`h-full rounded-full transition-[width] duration-700 ${budgetHealthy ? 'bg-primary' : 'bg-danger'}`}
            />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs font-medium text-muted">
            <span>月预算 {config.currency}{budget}</span>
            <span>提前 {config.reminderDays} 天提醒</span>
          </div>
        </div>
      </PanelShell>

      <PanelShell>
        <PanelHeader icon={TrendingUp} title="消费趋势" onOpenSettings={onOpenSettings} />
        <div className="mt-5 flex h-32 items-end gap-2" aria-label="近六个月消费趋势柱状图">
          {trendPoints.map((point, index) => (
            <div key={point.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
              <div
                style={{ height: `${Math.max(22, (point.value / maxValue) * 96)}px` }}
                className={`w-full max-w-7 rounded-sm ${index === trendPoints.length - 1 ? 'bg-primary' : 'bg-[#CFD8D3]'}`}
                title={`${point.month}: ${point.value}`}
              />
              <div className="text-[10px] font-semibold text-muted">{point.month}</div>
            </div>
          ))}
        </div>
      </PanelShell>
    </aside>
  );
}

function PanelShell({ children }: { children: React.ReactNode }) {
  return <section className="theme-surface min-w-0 rounded-lg border border-[#E0E6E2] bg-white p-5 shadow-glow">{children}</section>;
}

function PanelHeader({ icon: Icon, title, onOpenSettings }: { icon: PanelIcon; title: string; onOpenSettings: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="theme-icon-chip grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#E8F3F1] text-primary">
          <Icon size={16} />
        </div>
        <div className="truncate text-sm font-bold text-ink">{title}</div>
      </div>
      <button
        type="button"
        title="打开工作区设置"
        onClick={onOpenSettings}
        className="theme-icon-button grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-transparent text-muted transition hover:border-[#DDE4E0] hover:text-primary"
        aria-label={`${title}设置`}
      >
        <Settings2 size={15} />
      </button>
    </div>
  );
}
