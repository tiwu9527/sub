'use client';

import * as motion from 'framer-motion/client';
import { ArrowUpRight, CalendarClock, Gauge, TrendingUp } from 'lucide-react';
import { calculateMonthlySpend } from '@/lib/billing';
import { quickPanelMembers, trendPoints } from '@/lib/data';
import type { Subscription } from '@/lib/data';

type PanelIcon = typeof CalendarClock;

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
  const budgetProgress = Math.min(100, Math.round((currentSpend / budget) * 100));

  return (
    <aside className="min-w-0 space-y-5">
      <PanelShell delay={0}>
        <PanelHeader icon={CalendarClock} title="最近扣费" onOpenSettings={onOpenSettings} />
        <div className="theme-accent-panel mt-5 rounded-[22px] bg-gradient-to-br from-[#F3EFFF] to-white p-4">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-ink">Apple One</div>
              <div className="mt-1 truncate text-xs font-medium text-muted">2026-05-18 · 季付</div>
            </div>
            <div className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">已同步</div>
          </div>
          <div className="mt-5 text-[32px] font-semibold tracking-[-0.045em] text-ink">¥21.00</div>
          <div className="mt-4 flex -space-x-2">
            {quickPanelMembers.map((member) => (
              <div
                key={member.name}
                title={member.name}
                className={`grid h-8 w-8 place-items-center rounded-full border-2 border-white/80 text-[10px] font-semibold text-white ${member.color}`}
              >
                {member.name.slice(0, 1)}
              </div>
            ))}
          </div>
        </div>
      </PanelShell>

      <PanelShell delay={0.08}>
        <PanelHeader icon={Gauge} title="预算完成度" onOpenSettings={onOpenSettings} />
        <div className="mt-5">
          <div className="flex items-end justify-between">
            <div className="text-[38px] font-semibold leading-none tracking-[-0.055em] text-ink">{budgetProgress}%</div>
            <div className="rounded-full bg-success/10 px-3 py-1.5 text-xs font-semibold text-success">健康</div>
          </div>
          <div className="theme-track mt-5 h-3 overflow-hidden rounded-full bg-[#EFEAFD]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${budgetProgress}%` }}
              transition={{ delay: 0.25, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="h-full rounded-full bg-gradient-to-r from-primary to-secondary shadow-[0_0_18px_rgba(124,92,255,.45)]"
            />
          </div>
          <div className="mt-3 text-xs font-medium text-muted">
            月预算 {config.currency}
            {budget}，当前预计 {config.currency}
            {currentSpend}，提前 {config.reminderDays} 天提醒
          </div>
        </div>
      </PanelShell>

      <PanelShell delay={0.16}>
        <PanelHeader icon={TrendingUp} title="消费趋势" onOpenSettings={onOpenSettings} />
        <div className="mt-5 flex h-32 items-end gap-2">
          {trendPoints.map((point, index) => (
            <div key={point.month} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <motion.div
                initial={{ height: 18 }}
                animate={{ height: Math.max(22, (point.value / maxValue) * 112) }}
                transition={{ delay: 0.05 * index, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="w-full rounded-full bg-gradient-to-t from-primary to-secondary shadow-[0_8px_24px_rgba(124,92,255,.18)]"
              />
              <div className="text-[10px] font-semibold text-muted">{point.month}</div>
            </div>
          ))}
        </div>
      </PanelShell>
    </aside>
  );
}

function PanelShell({ children, delay }: { children: React.ReactNode; delay: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="theme-surface min-w-0 rounded-[28px] border border-black/[0.05] bg-white/74 p-5 shadow-glow backdrop-blur-2xl"
    >
      {children}
    </motion.section>
  );
}

function PanelHeader({ icon: Icon, title, onOpenSettings }: { icon: PanelIcon; title: string; onOpenSettings: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <div className="theme-icon-chip grid h-9 w-9 shrink-0 place-items-center rounded-[14px] bg-[#F1ECFF] text-primary">
          <Icon size={17} />
        </div>
        <div className="truncate text-sm font-semibold text-ink">{title}</div>
      </div>
      <button
        type="button"
        onClick={onOpenSettings}
        className="shrink-0 text-muted transition hover:text-primary"
        aria-label={`${title}详情`}
      >
        <ArrowUpRight size={17} />
      </button>
    </div>
  );
}
