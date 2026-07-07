'use client';

import * as motion from 'framer-motion/client';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { calculateAnnualizedSpend, calculateMonthlySpend, getBillableSubscriptions } from '@/lib/billing';
import { trendPoints } from '@/lib/data';
import type { Subscription } from '@/lib/data';

const chartWidth = 720;
const chartHeight = 260;
const chartPaddingX = 48;
const chartTop = 56;
const chartBottom = 220;

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
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)} ${chartHeight} L${points[0].x.toFixed(1)} ${chartHeight} Z`;
  const latestPoint = points[points.length - 1];
  const peakPoint = points.reduce((peak, point) => (point.value > peak.value ? point : peak), points[0]);

  return { points, linePath, areaPath, latestPoint, peakPoint };
}

function formatCurrency(value: number, currency: string) {
  return `${currency}${value.toFixed(2)}`;
}

export function HeroCard({ subscriptions, currency = '¥' }: { subscriptions: Subscription[]; currency?: string }) {
  const { points, linePath, areaPath, latestPoint, peakPoint } = buildTrendChart();
  const billableSubscriptions = getBillableSubscriptions(subscriptions);
  const monthlySpend = calculateMonthlySpend(subscriptions);
  const yearlySpend = calculateAnnualizedSpend(subscriptions);

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative min-h-[240px] overflow-hidden rounded-[28px] border border-white/60 bg-gradient-to-br from-primary via-[#9275FF] to-[#D9CEFF] p-6 text-white shadow-[0_28px_90px_rgba(124,92,255,.30)] sm:h-[260px] sm:min-h-0 sm:p-8"
    >
      <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/25 blur-2xl" />
      <div className="absolute left-8 top-8 h-28 w-28 rounded-full bg-[#6E4BFF]/25 blur-3xl" />
      <div className="absolute bottom-[-72px] right-8 h-40 w-40 rounded-full border border-white/35 bg-white/15 shadow-[inset_0_1px_24px_rgba(255,255,255,.42)] backdrop-blur-xl sm:right-20 sm:h-44 sm:w-44" />
      <div className="absolute bottom-10 right-36 hidden h-16 w-16 rounded-full border border-white/35 bg-white/18 shadow-[inset_0_1px_18px_rgba(255,255,255,.34)] backdrop-blur-xl sm:block" />

      <svg className="absolute inset-0 h-full w-full opacity-[.58]" viewBox="0 0 720 260" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="heroTrendArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,.30)" />
            <stop offset="70%" stopColor="rgba(255,255,255,.08)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <linearGradient id="heroTrendLine" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,.40)" />
            <stop offset="52%" stopColor="rgba(255,255,255,.86)" />
            <stop offset="100%" stopColor="rgba(255,255,255,.52)" />
          </linearGradient>
        </defs>
        <g opacity=".42">
          {[72, 112, 152, 192].map((y) => (
            <line key={y} x1="24" x2="696" y1={y} y2={y} stroke="rgba(255,255,255,.22)" strokeDasharray="5 12" strokeWidth="1" />
          ))}
        </g>
        <path d={areaPath} fill="url(#heroTrendArea)" />
        <path d={linePath} fill="none" stroke="rgba(38,28,92,.20)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="10" />
        <path d={linePath} fill="none" stroke="url(#heroTrendLine)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" />
        {points.map((point) => (
          <g key={point.month}>
            <circle cx={point.x} cy={point.y} r="8" fill="rgba(255,255,255,.18)" />
            <circle cx={point.x} cy={point.y} r="3.5" fill="white" />
          </g>
        ))}
        <g>
          <line
            x1={latestPoint.x}
            x2={latestPoint.x}
            y1={latestPoint.y}
            y2="230"
            stroke="rgba(255,255,255,.30)"
            strokeDasharray="4 8"
            strokeWidth="1.5"
          />
          <circle cx={latestPoint.x} cy={latestPoint.y} r="13" fill="rgba(255,255,255,.22)" stroke="rgba(255,255,255,.55)" strokeWidth="1.5" />
          <circle cx={latestPoint.x} cy={latestPoint.y} r="5" fill="white" />
        </g>
        <text x={peakPoint.x} y={Math.max(28, peakPoint.y - 18)} fill="rgba(255,255,255,.82)" fontSize="13" fontWeight="700" textAnchor="middle">
          Peak {peakPoint.month}
        </text>
      </svg>

      <div className="relative z-10 flex h-full min-w-0 flex-col justify-between">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="inline-flex h-10 min-w-0 items-center gap-2 rounded-full border border-white/30 bg-white/18 px-3 text-sm font-medium text-white/90 backdrop-blur-xl">
            <Sparkles size={16} className="shrink-0" />
            <span className="truncate">本月预计支出</span>
          </div>
          <button
            type="button"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] border border-white/30 bg-white/18 text-white backdrop-blur-xl transition hover:bg-white/25"
            aria-label="查看详情"
          >
            <ArrowUpRight size={19} />
          </button>
        </div>

        <div className="min-w-0">
          <div className="text-[52px] font-semibold leading-none tracking-[-0.055em] sm:text-[64px] md:text-[76px]">
            {formatCurrency(monthlySpend, currency)}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm font-medium text-white/84">
            <span className="rounded-full bg-white/16 px-3 py-2 backdrop-blur-xl">{billableSubscriptions.length} 项订阅</span>
            <span className="rounded-full bg-white/16 px-3 py-2 backdrop-blur-xl">年化约 {formatCurrency(yearlySpend, currency)}</span>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
