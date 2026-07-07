'use client';

import { useState, type FormEvent } from 'react';
import * as motion from 'framer-motion/client';
import { Edit3, Mail, MoreHorizontal, PauseCircle, PlayCircle, Plus, Trash2, UsersRound, X } from 'lucide-react';
import { statusLabels } from '@/lib/data';
import type { Subscription, SubscriptionMember } from '@/lib/data';

const statusMap: Record<Subscription['status'], string> = {
  active: 'bg-success/10 text-success',
  due: 'bg-primary/10 text-primary',
  paused: 'bg-danger/10 text-danger'
};

export function SubscriptionCard({
  subscription,
  index,
  reminderDays,
  onDelete,
  onEdit,
  onTogglePause,
  onAddMember
}: {
  subscription: Subscription;
  index: number;
  reminderDays: number;
  onDelete: (id: string) => void;
  onEdit: (subscription: Subscription) => void;
  onTogglePause: (id: string) => void;
  onAddMember: (subscriptionId: string, member: Omit<SubscriptionMember, 'id'>) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [memberForm, setMemberForm] = useState({ name: '', email: '', expiresAt: subscription.nextBilling });
  const billingDate = parseBillingDate(subscription.nextBilling);
  const daysUntilBilling = billingDate ? getDaysUntil(billingDate) : null;
  const shouldNotify =
    subscription.status !== 'paused' &&
    subscription.memberEmails.length > 0 &&
    (subscription.status === 'due' || (daysUntilBilling !== null && daysUntilBilling <= reminderDays));

  function openMemberDialog() {
    setMemberForm({ name: '', email: '', expiresAt: subscription.nextBilling });
    setMemberDialogOpen(true);
  }

  function closeMemberDialog() {
    setMemberDialogOpen(false);
  }

  function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = memberForm.name.trim();
    const email = memberForm.email.trim().toLowerCase();
    if (!name || !email) return;

    onAddMember(subscription.id, {
      name,
      email,
      expiresAt: memberForm.expiresAt || subscription.nextBilling
    });
    closeMemberDialog();
  }

  return (
    <>
      <motion.article
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 * index, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        whileHover={{ y: -4 }}
        className="theme-card group min-w-0 overflow-visible rounded-[24px] border border-black/[0.05] bg-white p-4 shadow-glow transition hover:border-primary/30 hover:shadow-lift sm:p-5"
      >
        <div className="flex min-w-0 flex-col gap-5">
        <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div
              className={`grid h-14 w-14 shrink-0 place-items-center rounded-[20px] bg-gradient-to-br ${subscription.tone} text-white shadow-[0_18px_36px_rgba(124,92,255,.18)]`}
            >
              <subscription.icon size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h3 className="max-w-full truncate text-lg font-semibold tracking-[-0.02em] text-ink">{subscription.name}</h3>
                <span className="theme-chip max-w-full truncate rounded-full bg-[#F4F1FF] px-2.5 py-1 text-xs font-semibold text-primary">
                  {subscription.tag}
                </span>
              </div>
              <p className="mt-1 truncate text-sm font-medium text-muted">{subscription.plan}</p>
            </div>
          </div>

          <div className="relative flex shrink-0 items-center justify-between gap-3 xl:justify-end">
            <span className={`rounded-full px-3 py-2 text-xs font-semibold ${statusMap[subscription.status]}`}>
              {statusLabels[subscription.status]}
            </span>
            <button
              type="button"
              aria-label={`${subscription.name} 更多操作`}
              onClick={() => setMenuOpen((value) => !value)}
              className="theme-icon-button grid h-11 w-11 shrink-0 place-items-center rounded-[14px] border border-black/[0.05] bg-white text-muted transition hover:border-primary/20 hover:text-primary"
            >
              <MoreHorizontal size={19} />
            </button>

            {menuOpen ? (
              <div className="theme-popover absolute right-0 top-12 z-30 w-44 rounded-[18px] border border-black/[0.05] bg-white/95 p-2 shadow-lift backdrop-blur-xl">
                <button
                  type="button"
                  onClick={() => {
                    onEdit(subscription);
                    setMenuOpen(false);
                  }}
                  className="theme-menu-item flex h-10 w-full items-center gap-2 rounded-[12px] px-3 text-sm font-semibold text-ink hover:bg-[#F7F7FC]"
                >
                  <Edit3 size={16} />
                  编辑
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onTogglePause(subscription.id);
                    setMenuOpen(false);
                  }}
                  className="theme-menu-item flex h-10 w-full items-center gap-2 rounded-[12px] px-3 text-sm font-semibold text-ink hover:bg-[#F7F7FC]"
                >
                  {subscription.status === 'paused' ? <PlayCircle size={16} /> : <PauseCircle size={16} />}
                  {subscription.status === 'paused' ? '恢复订阅' : '暂停订阅'}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(subscription.id)}
                  className="flex h-10 w-full items-center gap-2 rounded-[12px] px-3 text-sm font-semibold text-danger hover:bg-danger/10"
                >
                  <Trash2 size={16} />
                  删除
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,1fr))_minmax(180px,1.2fr)]">
          <Metric label="价格" value={subscription.price} />
          <Metric label="周期" value={subscription.cycle} />
          <Metric label="下一次扣费" value={subscription.nextBilling} />
          <div className="theme-inset min-w-0 rounded-[16px] bg-[#F7F7FC] px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="truncate text-xs font-medium text-muted">成员</div>
              <button
                type="button"
                onClick={openMemberDialog}
                className="theme-button inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[10px] border border-black/[0.05] bg-white px-2.5 text-xs font-semibold text-primary transition hover:border-primary/20"
              >
                <Plus size={13} />
                添加
              </button>
            </div>
            <div className="mt-3 space-y-2">
              <div className="theme-pill inline-flex max-w-full items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-semibold text-ink">
                <UsersRound size={15} className="shrink-0 text-primary" />
                <span className="truncate">{subscription.members}</span>
              </div>
            </div>
            {shouldNotify ? (
              <button
                type="button"
                onClick={() => openReminderEmail(subscription, daysUntilBilling)}
                className="theme-primary-action mt-3 inline-flex h-9 max-w-full items-center justify-center gap-2 rounded-[12px] bg-primary px-3 text-xs font-semibold text-white shadow-[0_12px_24px_rgba(124,92,255,.22)] transition hover:bg-accent"
              >
                <Mail size={14} />
                邮件提醒
              </button>
            ) : null}
          </div>
        </div>
        </div>
      </motion.article>

      {memberDialogOpen ? (
        <div className="theme-overlay fixed inset-0 z-[60] grid place-items-center bg-[#111827]/35 p-4 backdrop-blur-sm" onClick={closeMemberDialog}>
          <form
            className="theme-modal w-full max-w-[420px] rounded-[24px] border border-white/80 bg-white p-5 shadow-[0_30px_120px_rgba(17,24,39,.22)]"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleAddMember}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">Member</div>
                <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-ink">添加成员</h3>
              </div>
              <button
                type="button"
                onClick={closeMemberDialog}
                className="theme-icon-button grid h-10 w-10 place-items-center rounded-[12px] border border-black/[0.05] text-muted hover:text-ink"
                aria-label="关闭"
              >
                <X size={17} />
              </button>
            </div>

            <div className="mt-5 grid gap-4">
              <MemberDialogField
                label="姓名"
                value={memberForm.name}
                onChange={(value) => setMemberForm((current) => ({ ...current, name: value }))}
                placeholder="Alex"
                required
              />
              <MemberDialogField
                label="邮箱"
                value={memberForm.email}
                onChange={(value) => setMemberForm((current) => ({ ...current, email: value }))}
                placeholder="alex@example.com"
                type="email"
                required
              />
              <MemberDialogField
                label="到期时间"
                value={memberForm.expiresAt}
                onChange={(value) => setMemberForm((current) => ({ ...current, expiresAt: value }))}
                placeholder="2026-07-15"
                type="date"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeMemberDialog}
                className="theme-button h-10 rounded-[12px] border border-black/[0.05] bg-white px-4 text-sm font-semibold text-ink"
              >
                取消
              </button>
              <button type="submit" className="theme-primary-action h-10 rounded-[12px] bg-primary px-4 text-sm font-semibold text-white">
                添加成员
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="theme-inset min-w-0 rounded-[16px] bg-[#F7F7FC] px-3 py-3">
      <div className="truncate text-xs font-medium text-muted">{label}</div>
      <div className="mt-2 truncate text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}

function MemberDialogField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: 'text' | 'email' | 'date';
  required?: boolean;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-muted">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="theme-input h-11 rounded-[14px] border border-black/[0.05] bg-[#F7F7FC] px-3 text-sm font-semibold text-ink outline-none transition focus:border-primary/30 focus:bg-white focus:ring-4 focus:ring-primary/10"
      />
    </label>
  );
}


function parseBillingDate(value: string) {
  const billingDate = new Date(`${value}T00:00:00`);
  return Number.isNaN(billingDate.getTime()) ? null : billingDate;
}

function getDaysUntil(date: Date) {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

  return Math.round((targetStart - todayStart) / (24 * 60 * 60 * 1000));
}

function getReminderSubject(subscription: Subscription) {
  return `订阅到期提醒：${subscription.name}`;
}

function getReminderBody(subscription: Subscription, daysUntilBilling: number | null) {
  const dueText =
    daysUntilBilling === null
      ? '即将到期'
      : daysUntilBilling < 0
        ? `已逾期 ${Math.abs(daysUntilBilling)} 天`
        : daysUntilBilling === 0
          ? '今天到期'
          : `还有 ${daysUntilBilling} 天到期`;

  return [
    `订阅服务：${subscription.name}`,
    `方案：${subscription.plan}`,
    `金额：${subscription.price}`,
    `扣费日期：${subscription.nextBilling}（${dueText}）`,
    '',
    '请确认是否继续使用或调整成员分摊。'
  ].join('\n');
}

function openReminderEmail(subscription: Subscription, daysUntilBilling: number | null) {
  const subject = encodeURIComponent(getReminderSubject(subscription));
  const body = encodeURIComponent(getReminderBody(subscription, daysUntilBilling));
  const recipients = subscription.memberEmails.join(',');

  window.location.href = `mailto:${recipients}?subject=${subject}&body=${body}`;
}
