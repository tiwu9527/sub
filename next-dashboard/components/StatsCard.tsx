'use client';

import { ArrowUpRight } from 'lucide-react';
import type { Stat } from '@/lib/data';

const toneMap: Record<Stat['tone'], { icon: string; marker: string }> = {
  violet: { icon: 'bg-[#E5F2EF] text-[#0F766E]', marker: 'bg-[#0F766E]' },
  blue: { icon: 'bg-[#E9F0FC] text-[#2563EB]', marker: 'bg-[#2563EB]' },
  green: { icon: 'bg-[#E8F4EC] text-[#16845B]', marker: 'bg-[#16845B]' },
  rose: { icon: 'bg-[#FDF0E5] text-[#B96220]', marker: 'bg-[#D88945]' }
};

type StatsCardProps = {
  stat: Stat;
  index: number;
  active?: boolean;
  ariaLabel?: string;
  onClick?: () => void;
};

function StatsCardContent({ stat }: { stat: Stat }) {
  const tone = toneMap[stat.tone];

  return (
    <>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tone.icon}`}>
            <stat.icon size={16} />
          </div>
          <div className="truncate text-[13px] font-semibold text-muted">{stat.title}</div>
        </div>
        <ArrowUpRight size={15} className="shrink-0 text-[#9AA49E] transition group-hover:text-primary" />
      </div>
      <div className="mt-4 flex min-w-0 items-end justify-between gap-3">
        <div className="truncate text-[26px] font-bold leading-none text-ink">{stat.value}</div>
        <span className={`mb-1 h-1.5 w-8 shrink-0 rounded-full ${tone.marker}`} />
      </div>
      <div className="mt-2 truncate text-xs font-medium text-muted">{stat.note}</div>
    </>
  );
}

export function StatsCard({ stat, active = false, ariaLabel, onClick }: StatsCardProps) {
  const cardClassName = `theme-card group min-h-[122px] min-w-0 rounded-lg border bg-white p-4 text-left shadow-glow transition hover:border-[#B9CAC2] hover:shadow-soft focus:outline-none ${
    active ? 'border-primary/35 ring-2 ring-primary/10' : 'border-[#E0E6E2]'
  } ${onClick ? 'cursor-pointer' : ''}`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-label={ariaLabel ?? `${stat.title}: ${stat.value}`} className={cardClassName}>
        <StatsCardContent stat={stat} />
      </button>
    );
  }

  return (
    <article className={cardClassName}>
      <StatsCardContent stat={stat} />
    </article>
  );
}
