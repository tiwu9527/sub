'use client';

import Link from 'next/link';
import type { ComponentType, CSSProperties } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  LayoutDashboard,
  LayoutTemplate,
  Sparkles
} from 'lucide-react';
import { templates } from '@/lib/templates';
import type { TemplateDefinition } from '@/lib/templates';
import { CardsTemplate } from './CardsTemplate';
import { FrontendDisplayModeControl } from './FrontendDisplayModeControl';
import { LedgerTemplate } from './LedgerTemplate';
import { PassTemplate } from './PassTemplate';
import { ReceiptTemplate } from './ReceiptTemplate';
import { useFrontendDisplayMode } from './useFrontendDisplayMode';

const templateComponents: Record<TemplateDefinition['slug'], ComponentType> = {
  cards: CardsTemplate,
  ledger: LedgerTemplate,
  receipt: ReceiptTemplate,
  pass: PassTemplate
};

const templatePalettes: Record<
  TemplateDefinition['slug'],
  { glow: string; mark: string }
> = {
  cards: {
    glow: 'bg-[#9DDBCB]',
    mark: 'bg-[#153D35] text-white'
  },
  ledger: {
    glow: 'bg-[#BFD1E2]',
    mark: 'bg-[#23394C] text-white'
  },
  receipt: {
    glow: 'bg-[#F2C987]',
    mark: 'bg-[#4C321A] text-white'
  },
  pass: {
    glow: 'bg-[#D7C2F0]',
    mark: 'bg-[#332044] text-white'
  }
};

export function TemplateDashboard({ template }: { template: TemplateDefinition }) {
  const { mode: displayMode, setMode: setDisplayMode } = useFrontendDisplayMode();
  const TemplateContent = templateComponents[template.slug];
  const palette = templatePalettes[template.slug];
  const currentIndex = templates.findIndex((item) => item.slug === template.slug);
  const nextTemplate = templates[(currentIndex + 1) % templates.length];
  const templateVariables = {
    '--frontend-light-canvas': template.accent.surface,
    '--frontend-light-surface': '#FFFFFF',
    '--frontend-light-surface-muted': `${template.accent.primary}0D`,
    '--frontend-light-surface-hover': `${template.accent.primary}14`,
    '--frontend-light-border': `${template.accent.primary}26`,
    '--frontend-light-border-strong': `${template.accent.primary}59`,
    '--frontend-light-ink': template.accent.ink,
    '--frontend-light-muted': '#68746D',
    '--primary': template.accent.primary,
    '--primary-hover': template.accent.primary,
    '--primary-action': template.accent.primary,
    '--primary-action-hover': template.accent.ink,
    '--primary-soft': `${template.accent.primary}17`,
    '--primary-ring': `${template.accent.primary}33`,
    '--frontend-dark-primary': template.accent.secondary,
    '--frontend-dark-primary-hover': template.accent.secondary,
    '--frontend-dark-primary-action': template.accent.primary,
    '--frontend-dark-primary-action-hover': template.accent.ink,
    '--action-shadow': `0 5px 14px ${template.accent.primary}30`,
    '--card-radius': '10px',
    '--control-radius': '9px',
    '--brand-bg': template.accent.ink
  } as CSSProperties;

  return (
    <main
      style={templateVariables}
      data-color-mode={displayMode}
      className="frontend-shell dashboard-shell relative min-h-screen overflow-hidden text-ink"
    >
      <div className={`pointer-events-none absolute -left-24 top-24 h-80 w-80 rounded-full opacity-35 blur-3xl ${palette.glow}`} />
      <div className="pointer-events-none absolute right-[-120px] top-[420px] h-96 w-96 rounded-full bg-[var(--surface)] opacity-70 blur-3xl" />

      <header className="theme-nav sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-[1520px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link
            href="/templates"
            aria-label="返回前端展示模板库"
            className="flex min-w-0 items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary-ring)]"
          >
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${palette.mark}`}>
              <LayoutTemplate size={18} aria-hidden="true" />
            </span>
            <span className="hidden min-w-0 sm:block">
              <span className="block truncate text-sm font-extrabold text-ink">续费管家</span>
              <span className="block truncate text-[10px] font-bold uppercase text-muted">Frontend views</span>
            </span>
          </Link>

          <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="模板切换">
            {templates.map((item) => {
              const active = item.slug === template.slug;

              return (
                <Link
                  key={item.slug}
                  href={`/templates/${item.slug}`}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-lg border px-3 py-2 text-xs font-bold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary-ring)] ${
                    active
                      ? 'theme-active-tab border-primary/30 bg-primary/10 text-primary'
                      : 'theme-menu-item border-transparent text-muted hover:border-[var(--border)] hover:bg-[var(--surface-hover)] hover:text-ink'
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <Link
            href="/templates"
            aria-label="返回模板库"
            className="theme-button ml-auto inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold text-ink shadow-sm transition lg:ml-3"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            <span className="hidden sm:inline">模板库</span>
          </Link>
          <Link
            href="/admin"
            aria-label="打开后台管理"
            className="theme-primary-action inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-bold shadow-sm transition"
          >
            <LayoutDashboard size={14} aria-hidden="true" />
            <span className="hidden sm:inline">后台管理</span>
          </Link>
        </div>

        <div className="border-t border-[var(--border)] px-4 py-2 lg:hidden">
          <FrontendDisplayModeControl value={displayMode} onChange={setDisplayMode} compact />
        </div>

        <nav className="flex gap-2 overflow-x-auto border-t border-[var(--border)] px-4 py-2 lg:hidden" aria-label="移动端模板切换">
          {templates.map((item) => {
            const active = item.slug === template.slug;

            return (
              <Link
                key={item.slug}
                href={`/templates/${item.slug}`}
                aria-current={active ? 'page' : undefined}
                className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-bold ${
                  active
                    ? 'theme-active-tab border-primary/30 bg-primary/10 text-primary'
                    : 'theme-button border-[var(--border)] bg-[var(--surface)] text-muted'
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>
      </header>

      <div className="relative z-10 mx-auto w-full max-w-[1520px] px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pb-20">
        <div className="mb-6 hidden justify-end lg:flex">
          <FrontendDisplayModeControl value={displayMode} onChange={setDisplayMode} compact />
        </div>

        <section className="mb-7 flex flex-col gap-5 border-b border-[var(--border)] pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="theme-chip inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-[11px] font-extrabold text-primary">
              <Sparkles size={13} aria-hidden="true" />
              只读订阅明细模板
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-[-0.04em] text-ink sm:text-4xl lg:text-[44px]">
              {template.name}
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-7 text-muted sm:text-base">{template.description}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-bold text-muted">
            <span className="theme-surface inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <Sparkles size={14} className="text-primary" aria-hidden="true" />
              演示数据 · 仅展示，无管理操作
            </span>
            <span className="theme-surface inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <CheckCircle2 size={14} className="text-success" aria-hidden="true" />
              响应式布局
            </span>
            <span className="theme-surface inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <CheckCircle2 size={14} className="text-success" aria-hidden="true" />
              只读明细视图
            </span>
          </div>
        </section>

        <TemplateContent />

        <footer className="theme-surface mt-10 flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-extrabold uppercase text-muted">Next template</div>
            <div className="mt-1 text-base font-extrabold text-ink">继续查看「{nextTemplate.name}」</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/templates" className="theme-button inline-flex h-10 items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-bold text-ink">
              全部模板
            </Link>
            <Link
              href={`/templates/${nextTemplate.slug}`}
              className="theme-primary-action inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-bold transition"
            >
              下一套
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
