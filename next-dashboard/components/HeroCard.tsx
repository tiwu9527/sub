'use client';

import { ArrowUpRight, CircleDollarSign, TrendingUp } from 'lucide-react';
import { calculateAnnualizedSpend, calculateMonthlySpend, getBillableSubscriptions } from '@/lib/billing';
import { trendPoints } from '@/lib/data';
import type { Subscription } from '@/lib/data';

const chartWidth = 720;
const chartHeight = 240;
const chartPaddingX = 36;
const chartTop = 30;
const chartBottom = 184;

function buildTrendChart() {
  const values = trendPoints.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = Math.max(maxValue - minValue, 1);
  const step = (chartWidth - chartPaddingX * 2) / Math.max(trendPoints.length - 1, 1);
  const points = trendPoints.map((point, index) => {
    const x = chartPaddingX + index * step;
    const y = chartBottom - ((point.value - minValue) / range) * (chartBottom - chartTop);
    return { ...point, x, y };
  });
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)} ${chartBottom} L${points[0].x.toFixed(1)} ${chartBottom} Z`;

  return { points, linePath, areaPath };
}

function formatCurrency(value: number, currency: string) {
  return `${currency}${value.toFixed(2)}`;
}

export function HeroCard({ subscriptions, currency = '¥' }: { subscriptions: Subscription[]; currency?: string }) {
  const { points, linePath, areaPath } = buildTrendChart();
  const billableSubscriptions = getBillableSubscriptions(subscriptions);
  const monthlySpend = calculateMonthlySpend(subscriptions);
  const yearlySpend = calculateAnnualizedSpend(subscriptions);

  return (
    <section className="spend-hero relative min-h-[280px] overflow-hidden rounded-lg border p-5 text-white shadow-soft sm:p-6">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="spend-hero-icon grid h-9 w-9 shrink-0 place-items-center rounded-lg">
            <CircleDollarSign size={18} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">月度支出</div>
            <div className="mt-0.5 text-xs text-white/60">按账单周期折算</div>
          </div>
        </div>
        <div className="spend-hero-badge inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-bold">
          <TrendingUp size={14} />
          预算追踪中
        </div>
      </div>

      <div className="mt-6 grid min-w-0 gap-6 md:grid-cols-[minmax(190px,0.75fr)_minmax(0,1.55fr)] md:items-end">
        <div className="min-w-0 pb-1">
          <div className="text-[13px] font-medium text-white/62">本月预计</div>
          <div className="mt-2 text-[44px] font-bold leading-none text-white sm:text-[52px]">
            {formatCurrency(monthlySpend, currency)}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/12 pt-4">
            <div>
              <div className="text-xs text-white/52">活跃订阅</div>
              <div className="mt-1 flex items-center gap-1 text-sm font-semibold text-white">
                {billableSubscriptions.length} 项
                <ArrowUpRight size={14} className="spend-hero-accent" />
              </div>
            </div>
            <div>
              <div className="text-xs text-white/52">预计年支出</div>
              <div className="mt-1 truncate text-sm font-semibold text-white">{formatCurrency(yearlySpend, currency)}</div>
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-1 flex items-center justify-between text-xs font-medium text-white/52">
            <span>近 6 个月趋势</span>
            <span>单位：{currency}</span>
          </div>
          <svg className="h-[150px] w-full md:h-auto md:aspect-[3/1]" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" role="img" aria-label="近六个月订阅支出趋势图">
            <defs>
              <linearGradient id="trendArea" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--hero-line)" stopOpacity="0.34" />
                <stop offset="100%" stopColor="var(--hero-line)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[48, 92, 136, 180].map((y) => (
              <line key={y} x1="0" x2={chartWidth} y1={y} y2={y} stroke="rgba(255,255,255,.10)" strokeDasharray="4 8" strokeWidth="1" />
            ))}
            <path d={areaPath} fill="url(#trendArea)" />
            <path d={linePath} fill="none" stroke="var(--hero-line)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
            {points.map((point, index) => (
              <g key={point.month}>
                <circle cx={point.x} cy={point.y} r={index === points.length - 1 ? 7 : 4.5} fill="var(--hero-bg)" stroke="var(--hero-point)" strokeWidth="3" />
                <text x={point.x} y="222" fill="rgba(255,255,255,.52)" fontSize="12" fontWeight="600" textAnchor="middle">
                  {point.month}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </section>
  );
}
