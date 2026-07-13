'use client';

import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import type { FrontendDisplayMode } from '@/lib/frontend-display-mode';

const displayModeOptions: Array<{
  value: FrontendDisplayMode;
  label: string;
  icon: LucideIcon;
}> = [
  { value: 'light', label: '白天', icon: Sun },
  { value: 'dark', label: '夜间', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor }
];

export function FrontendDisplayModeSetting({
  value,
  onChange
}: {
  value: FrontendDisplayMode;
  onChange: (value: FrontendDisplayMode) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-bold text-ink">前台显示模式</legend>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="前台显示模式">
        {displayModeOptions.map((option) => {
          const Icon = option.icon;
          const selected = option.value === value;
          const inputId = `frontend-display-mode-${option.value}`;

          return (
            <label key={option.value} htmlFor={inputId} className="cursor-pointer">
              <input
                id={inputId}
                type="radio"
                name="frontend-display-mode"
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="peer sr-only"
              />
              <span
                className={`flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary/30 ${
                  selected
                    ? 'theme-active-tab border-primary bg-primary/10 text-primary shadow-[0_0_0_2px_var(--primary-ring)]'
                    : 'theme-button border-[#DDE4E0] bg-white text-ink hover:border-[#B8C9C1]'
                }`}
              >
                <Icon size={16} className="shrink-0" aria-hidden="true" />
                <span>{option.label}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
