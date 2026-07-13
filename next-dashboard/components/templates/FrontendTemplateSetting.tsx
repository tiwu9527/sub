'use client';

import { Check, ExternalLink } from 'lucide-react';
import { templates, type TemplateSlug } from '@/lib/templates';

export function FrontendTemplateSetting({
  value,
  onChange
}: {
  value: TemplateSlug;
  onChange: (value: TemplateSlug) => void;
}) {
  return (
    <fieldset>
      <legend className="sr-only">前台展示模板</legend>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm font-bold text-ink">前台展示模板</div>
        <a
          href={`/?template=${value}`}
          target="_blank"
          rel="noreferrer"
          className="theme-button inline-flex h-9 w-fit shrink-0 items-center gap-2 rounded-lg border border-[#DDE4E0] bg-white px-3 text-xs font-semibold text-ink transition hover:text-primary"
        >
          预览所选样式
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="前台展示模板">
        {templates.map((template) => {
          const selected = template.slug === value;
          const inputId = `frontend-template-${template.slug}`;

          return (
            <label key={template.slug} htmlFor={inputId} className="cursor-pointer">
              <input
                id={inputId}
                type="radio"
                name="frontend-template"
                value={template.slug}
                checked={selected}
                onChange={() => onChange(template.slug)}
                className="peer sr-only"
              />
              <span
                className={`flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary/30 ${
                  selected
                    ? 'theme-active-tab border-primary bg-primary/10 text-primary shadow-[0_0_0_2px_var(--primary-ring)]'
                    : 'theme-button border-[#DDE4E0] bg-white text-ink hover:border-[#B8C9C1]'
                }`}
              >
                <span className="min-w-0 break-words leading-5">{template.name}</span>
                {selected ? <Check size={15} className="shrink-0" strokeWidth={3} aria-hidden="true" /> : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
