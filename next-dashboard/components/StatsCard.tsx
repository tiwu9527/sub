'use client';

import * as motion from 'framer-motion/client';
import type { Stat } from '@/lib/data';

const toneMap: Record<Stat['tone'], string> = {
  violet: 'from-[#7C5CFF]/16 to-[#A98BFF]/8 text-primary',
  blue: 'from-[#5E8CFF]/16 to-[#BFD1FF]/10 text-[#4F72E9]',
  green: 'from-[#34C759]/16 to-[#B9F2CC]/10 text-success',
  rose: 'from-[#FF5A5F]/14 to-[#FFD0D2]/10 text-danger'
};

type StatsCardProps = {
  stat: Stat;
  index: number;
  active?: boolean;
  ariaLabel?: string;
  onClick?: () => void;
};

function StatsCardContent({ stat }: { stat: Stat }) {
  return (
    <>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-[16px] bg-gradient-to-br ${toneMap[stat.tone]} sm:h-9 sm:w-9`}>
          <stat.icon size={18} />
        </div>
        <div className="h-2 w-2 shrink-0 rounded-full bg-primary/30 opacity-0 transition group-hover:opacity-100" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium leading-tight text-muted sm:text-[13px]">{stat.title}</div>
        <div className="mt-1 truncate text-[28px] font-semibold leading-none tracking-[-0.045em] text-ink sm:text-[24px]">
          {stat.value}
        </div>
        <div className="mt-1.5 truncate text-xs font-medium leading-tight text-muted">{stat.note}</div>
      </div>
    </>
  );
}

export function StatsCard({ stat, index, active = false, ariaLabel, onClick }: StatsCardProps) {
  const cardClassName = `theme-card group flex h-full min-h-[122px] min-w-0 flex-col justify-between overflow-hidden rounded-[24px] border bg-white p-4 text-left shadow-glow transition hover:border-primary/20 hover:shadow-lift focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 sm:min-h-0 sm:p-3.5 ${
    active ? 'border-primary/30 ring-4 ring-primary/10' : 'border-black/[0.05]'
  } ${onClick ? 'cursor-pointer' : ''}`;

  if (onClick) {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel ?? `${stat.title}: ${stat.value}`}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 * index, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        whileHover={{ y: -5 }}
        className={cardClassName}
      >
        <StatsCardContent stat={stat} />
      </motion.button>
    );
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 * index, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -5 }}
      className={cardClassName}
    >
      <StatsCardContent stat={stat} />
    </motion.article>
  );
}
