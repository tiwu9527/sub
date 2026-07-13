'use client';

import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import type { FrontendDisplayMode } from '@/lib/frontend-display-mode';

type DisplayModeOption = {
  value: FrontendDisplayMode;
  label: string;
  icon: LucideIcon;
};

const displayModeOptions: readonly DisplayModeOption[] = [
  { value: 'light', label: '白天', icon: Sun },
  { value: 'dark', label: '夜间', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor }
];

type FrontendDisplayModeControlProps = {
  value: FrontendDisplayMode;
  onChange: (value: FrontendDisplayMode) => void;
  compact?: boolean;
};

export function FrontendDisplayModeControl({ value, onChange, compact = false }: FrontendDisplayModeControlProps) {
  return (
    <div
      className="grid w-full grid-cols-3 gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-1 sm:w-auto"
      role="group"
      aria-label="前台显示模式"
    >
      {displayModeOptions.map((option) => {
        const Icon = option.icon;
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            title={`切换为${option.label}模式`}
            onClick={() => onChange(option.value)}
            className={`inline-flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border font-bold transition ${
              compact ? 'min-h-8 px-2 text-[11px]' : 'min-h-9 px-2.5 text-xs sm:min-w-[76px]'
            } ${
              selected
                ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-primary shadow-sm'
                : 'border-transparent text-muted hover:bg-[var(--surface-hover)] hover:text-ink'
            }`}
          >
            <Icon size={14} className="shrink-0" aria-hidden="true" />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
