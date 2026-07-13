import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Columns3,
  LayoutGrid,
  ListTree,
  ReceiptText,
  type LucideIcon
} from 'lucide-react';
import { templates, type TemplateSlug } from '@/lib/templates';

export const metadata: Metadata = {
  title: '前台展示模板 | 续费管家',
  description: '浏览卡片陈列、明细清单、账单票据和会员通行证四套只读订阅详情模板。'
};

const templateIcons: Record<TemplateSlug, LucideIcon> = {
  cards: Columns3,
  ledger: ListTree,
  receipt: ReceiptText,
  pass: BadgeCheck
};

export default function TemplatesPage() {
  return (
    <main className="min-h-screen bg-[#F4F5F3] text-[#17211B]">
      <div className="mx-auto w-full max-w-[1480px] px-4 py-5 sm:px-7 sm:py-8 lg:px-10 lg:py-10">
        <nav className="flex items-center justify-between gap-4" aria-label="模板导航">
          <Link
            href="/admin"
            className="inline-flex h-10 items-center gap-2 rounded-full border border-[#DCE2DE] bg-white px-4 text-sm font-semibold text-[#445149] shadow-sm transition hover:-translate-y-0.5 hover:border-[#BBC8C0] hover:text-[#17211B]"
          >
            <ArrowLeft size={16} />
            返回后台管理
          </Link>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#738078]">
            <LayoutGrid size={15} />
            Read-only templates
          </div>
        </nav>

        <header className="max-w-3xl pb-9 pt-14 sm:pb-12 sm:pt-20">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#0F766E]">只读前台 · 演示数据</div>
          <h1 className="mt-5 text-[42px] font-bold leading-[1.05] tracking-[-0.045em] text-[#17211B] sm:text-[58px]">
            四种订阅明细展示方式
          </h1>
          <p className="mt-6 max-w-2xl text-base font-medium leading-7 text-[#68746D] sm:text-lg sm:leading-8">
            卡片、清单、票据或会员通行证。这里的模板只负责展示订阅详情，全部使用演示数据，不提供新增、编辑、删除或登录入口。
          </p>
        </header>

        <section className="grid gap-5 md:grid-cols-2" aria-label="可用模板">
          {templates.map((template, index) => {
            const Icon = templateIcons[template.slug];

            return (
              <Link
                key={template.slug}
                href={`/templates/${template.slug}`}
                className="group relative min-h-[430px] overflow-hidden rounded-[28px] border border-black/5 bg-white p-5 shadow-[0_18px_50px_rgba(30,42,35,0.07)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(30,42,35,0.13)] sm:p-7"
              >
                <div
                  className="absolute inset-x-0 top-0 h-[210px] opacity-[0.055] transition-opacity duration-300 group-hover:opacity-[0.09]"
                  style={{ background: template.accent.gradient }}
                />

                <div className="relative flex items-start justify-between gap-4">
                  <div
                    className="grid h-12 w-12 place-items-center rounded-2xl text-white shadow-lg"
                    style={{ background: template.accent.gradient }}
                  >
                    <Icon size={21} />
                  </div>
                  <span
                    className="grid h-10 w-10 place-items-center rounded-full border transition group-hover:scale-105"
                    style={{
                      borderColor: `${template.accent.primary}2E`,
                      backgroundColor: template.accent.surface,
                      color: template.accent.primary
                    }}
                  >
                    <ArrowUpRight size={18} />
                  </span>
                </div>

                <div className="relative mt-8">
                  <div className="text-[11px] font-bold uppercase tracking-[0.19em] text-[#7B8780]">
                    0{index + 1} · {template.eyebrow}
                  </div>
                  <h2 className="mt-3 text-[28px] font-bold tracking-[-0.025em] text-[#17211B] sm:text-[32px]">{template.name}</h2>
                  <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-[#6D7972]">{template.description}</p>
                </div>

                <TemplatePreview slug={template.slug} color={template.accent.primary} surface={template.accent.surface} />
              </Link>
            );
          })}
        </section>

        <footer className="flex flex-col gap-2 pb-2 pt-10 text-sm text-[#7A867F] sm:flex-row sm:items-center sm:justify-between">
          <span>所有模板均为只读前台展示。</span>
          <span>演示内容不会修改后台订阅数据。</span>
        </footer>
      </div>
    </main>
  );
}

function TemplatePreview({ slug, color, surface }: { slug: TemplateSlug; color: string; surface: string }) {
  return (
    <div className="relative mt-7 overflow-hidden rounded-2xl border border-black/[0.06] p-3" style={{ backgroundColor: surface }} aria-hidden="true">
      <div className="h-[154px] rounded-xl border border-black/[0.05] bg-white/[0.86] p-3 shadow-sm backdrop-blur">
        {slug === 'cards' ? <CardsPreview color={color} /> : null}
        {slug === 'ledger' ? <LedgerPreview color={color} /> : null}
        {slug === 'receipt' ? <ReceiptPreview color={color} /> : null}
        {slug === 'pass' ? <PassPreview color={color} /> : null}
      </div>
    </div>
  );
}

function CardsPreview({ color }: { color: string }) {
  return (
    <div className="grid h-full grid-cols-2 gap-2.5">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="rounded-lg border border-black/[0.06] bg-white p-2.5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="h-6 w-6 shrink-0 rounded-md" style={{ backgroundColor: color, opacity: 0.9 - item * 0.12 }} />
            <span className="h-2 flex-1 rounded-full bg-[#CBD4CF]" />
          </div>
          <div className="mt-2.5 flex items-end justify-between gap-2">
            <span className="h-2 w-10 rounded-full bg-[#E0E5E2]" />
            <span className="h-3 w-12 rounded-full" style={{ backgroundColor: color, opacity: 0.2 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function LedgerPreview({ color }: { color: string }) {
  return (
    <div className="h-full overflow-hidden rounded-lg border border-black/[0.06] bg-white">
      <div className="grid grid-cols-[1.5fr_1fr_0.8fr_0.7fr] gap-2 border-b border-black/[0.06] bg-[#EDF2F5] px-3 py-2">
        {[74, 58, 62, 48].map((width) => (
          <span key={width} className="h-1.5 rounded-full bg-[#9DAEB9]" style={{ width: `${width}%` }} />
        ))}
      </div>
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="grid grid-cols-[1.5fr_1fr_0.8fr_0.7fr] items-center gap-2 border-b border-black/[0.05] px-3 py-[6px] last:border-b-0">
          <div className="flex items-center gap-2">
            <span className="h-4 w-4 shrink-0 rounded" style={{ backgroundColor: color, opacity: 0.9 - row * 0.12 }} />
            <span className="h-1.5 flex-1 rounded-full bg-[#CCD4D9]" />
          </div>
          <span className="h-1.5 w-4/5 rounded-full bg-[#E0E5E8]" />
          <span className="h-1.5 w-3/5 rounded-full bg-[#CBD4D9]" />
          <span className="h-3 w-full rounded-full" style={{ backgroundColor: color, opacity: 0.13 }} />
        </div>
      ))}
    </div>
  );
}

function ReceiptPreview({ color }: { color: string }) {
  return (
    <div className="flex h-full items-stretch justify-center gap-3">
      {[0, 1, 2].map((receipt) => (
        <div key={receipt} className={`relative w-[30%] max-w-[112px] bg-[#FFFDF8] px-2.5 py-3 shadow-sm ${receipt === 1 ? '-translate-y-1' : 'translate-y-1'}`}>
          <div className="mx-auto h-5 w-5 rounded-full" style={{ backgroundColor: color, opacity: 0.88 - receipt * 0.12 }} />
          <div className="mx-auto mt-2 h-1.5 w-3/4 rounded-full bg-[#CFC3B5]" />
          <div className="mt-3 border-t border-dashed border-[#D8CBBB] pt-2">
            <div className="h-1 w-full rounded-full bg-[#E8DED2]" />
            <div className="mt-1.5 h-1 w-2/3 rounded-full bg-[#E8DED2]" />
          </div>
          <div className="mx-auto mt-3 h-3 w-2/3 rounded-full" style={{ backgroundColor: color, opacity: 0.2 }} />
          <div className="absolute inset-x-0 -bottom-1 flex justify-around">
            {[0, 1, 2, 3].map((notch) => <span key={notch} className="h-2 w-2 rounded-full bg-white" />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function PassPreview({ color }: { color: string }) {
  return (
    <div className="relative h-full">
      {[0, 1, 2].map((pass) => (
        <div
          key={pass}
          className="absolute left-1/2 top-1/2 h-[78px] w-[72%] max-w-[250px] rounded-xl border border-white/45 p-3 text-white shadow-lg"
          style={{
            background: `linear-gradient(125deg, ${color}, ${pass === 0 ? '#312653' : pass === 1 ? '#8C72D2' : '#B19DE8'})`,
            transform: `translate(-50%, -50%) translateY(${(pass - 1) * 22}px) rotate(${(pass - 1) * 2.5}deg)`,
            zIndex: 3 - Math.abs(pass - 1),
            opacity: pass === 1 ? 1 : 0.72
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <span className="h-6 w-6 rounded-lg bg-white/25" />
            <span className="h-1.5 w-14 rounded-full bg-white/50" />
          </div>
          <div className="mt-4 flex items-end justify-between gap-3">
            <span className="h-2 w-20 rounded-full bg-white/80" />
            <span className="h-4 w-8 rounded-full bg-white/20" />
          </div>
        </div>
      ))}
    </div>
  );
}
