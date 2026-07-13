'use client';

import { useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  Edit3,
  LoaderCircle,
  Mail,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  Trash2,
  UserPlus,
  UsersRound,
  X
} from 'lucide-react';
import { statusLabels } from '@/lib/data';
import type { Subscription, SubscriptionMember } from '@/lib/data';
import DatePickerField from '@/components/DatePickerField';
import { getEffectiveSubscriptionStatus } from '@/lib/subscription-status';

const statusMap: Record<Subscription['status'], string> = {
  active: 'bg-[#E8F4EC] text-[#16734F]',
  due: 'bg-[#FDF0E5] text-[#B45C16]',
  paused: 'bg-[#EFF1F0] text-[#66716B]'
};

const statusDotMap: Record<Subscription['status'], string> = {
  active: 'bg-[#27A46F]',
  due: 'bg-[#E09245]',
  paused: 'bg-[#8B9690]'
};

export function SubscriptionCard({
  subscription,
  reminderDays,
  onDelete,
  onEdit,
  onTogglePause,
  onAddMember,
  isAdmin,
  onRequireAdmin
}: {
  subscription: Subscription;
  index: number;
  reminderDays: number;
  onDelete: (id: string) => void;
  onEdit: (subscription: Subscription) => void;
  onTogglePause: (id: string) => void;
  onAddMember: (subscriptionId: string, member: Omit<SubscriptionMember, 'id'>) => void;
  isAdmin: boolean;
  onRequireAdmin: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [memberForm, setMemberForm] = useState({ name: '', email: '', expiresAt: subscription.nextBilling });
  const [reminderState, setReminderState] = useState<{
    status: 'idle' | 'sending' | 'success' | 'error';
    message: string;
  }>({ status: 'idle', message: '' });
  const billingDate = parseBillingDate(subscription.nextBilling);
  const daysUntilBilling = billingDate ? getDaysUntil(billingDate) : null;
  const billingHint = getBillingHint(daysUntilBilling);
  const effectiveStatus = getEffectiveSubscriptionStatus(subscription, reminderDays);
  const shouldNotify = effectiveStatus === 'due' && subscription.memberEmails.length > 0;

  async function handleSendReminder() {
    if (!isAdmin) {
      onRequireAdmin();
      return;
    }

    const recipientCount = subscription.memberEmails.length;
    const confirmed = window.confirm(`确定向 ${subscription.name} 的 ${recipientCount} 位成员发送续费提醒邮件吗？`);
    if (!confirmed) return;

    setReminderState({ status: 'sending', message: '正在发送续费提醒…' });

    try {
      const members =
        subscription.memberDetails.length > 0
          ? subscription.memberDetails.map((member) => ({ name: member.name, email: member.email }))
          : subscription.memberEmails.map((email) => ({ name: getMemberNameFromEmail(email), email }));
      const response = await fetch('/api/reminders/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: {
            name: subscription.name,
            plan: subscription.plan,
            price: subscription.price,
            cycle: subscription.cycle,
            nextBilling: subscription.nextBilling,
            status: subscription.status
          },
          members,
          reminderDays
        })
      });
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string; sent?: number; failed?: number; skipped?: number }
        | null;

      if (response.status === 401) {
        setReminderState({ status: 'error', message: '管理员会话已失效，请重新登录。' });
        onRequireAdmin();
        return;
      }
      if (!response.ok) {
        throw new Error(result?.message || '邮件发送失败，请稍后再试。');
      }

      const sent = result?.sent ?? 0;
      const failed = result?.failed ?? 0;
      const skipped = result?.skipped ?? 0;
      const details = [failed > 0 ? `${failed} 封失败` : '', skipped > 0 ? `${skipped} 封近期已发送` : ''].filter(Boolean).join('，');
      setReminderState({
        status: 'success',
        message: `已成功发送 ${sent} 封续费提醒${details ? `，${details}` : ''}。`
      });
    } catch (error) {
      setReminderState({
        status: 'error',
        message: error instanceof Error ? error.message : '邮件发送失败，请稍后再试。'
      });
    }
  }

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
      <article className="theme-card min-w-0 overflow-visible rounded-lg border border-[#E0E6E2] bg-white shadow-glow transition hover:border-[#B8C9C1] hover:shadow-soft">
        <div className="flex min-w-0 items-center justify-between gap-4 p-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${subscription.tone} text-white`}>
              <subscription.icon size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="max-w-full truncate text-[15px] font-bold text-ink">{subscription.name}</h3>
                <span className="text-xs font-medium text-muted">· {subscription.tag}</span>
              </div>
              <p className="mt-1 truncate text-xs font-medium text-muted">{subscription.plan}</p>
            </div>
          </div>

          <div className="relative flex shrink-0 items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold ${statusMap[effectiveStatus]}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${statusDotMap[effectiveStatus]}`} />
              {statusLabels[effectiveStatus]}
            </span>
            <button
              type="button"
              title="更多操作"
              aria-label={`${subscription.name} 更多操作`}
              onClick={() => setMenuOpen((value) => !value)}
              className="theme-icon-button grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#E2E7E4] bg-white text-muted transition hover:text-ink"
            >
              <MoreHorizontal size={18} />
            </button>

            {menuOpen ? (
              <div className="theme-popover absolute right-0 top-11 z-30 w-44 rounded-lg border border-[#DDE4E0] bg-white p-1.5 shadow-lift">
                <MenuAction
                  icon={Edit3}
                  label="编辑订阅"
                  onClick={() => {
                    onEdit(subscription);
                    setMenuOpen(false);
                  }}
                />
                <MenuAction
                  icon={subscription.status === 'paused' ? PlayCircle : PauseCircle}
                  label={subscription.status === 'paused' ? '恢复订阅' : '暂停订阅'}
                  onClick={() => {
                    onTogglePause(subscription.id);
                    setMenuOpen(false);
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    onDelete(subscription.id);
                    setMenuOpen(false);
                  }}
                  className="flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-sm font-semibold text-danger transition hover:bg-danger/10"
                >
                  <Trash2 size={15} />
                  删除订阅
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-2 border-t border-[#E7ECE9] lg:grid-cols-[0.8fr_0.8fr_1.2fr_1.4fr]">
          <Metric label="金额" value={subscription.price} className="border-b border-r lg:border-b-0" />
          <Metric label="账单周期" value={subscription.cycle} className="border-b lg:border-b-0 lg:border-r" />
          <Metric label="下次扣费" value={subscription.nextBilling} note={billingHint} className="border-r lg:border-b-0" />
          <div className="min-w-0 p-4 sm:px-5">
            <div className="text-[11px] font-semibold text-muted">共享成员</div>
            <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <UsersRound size={16} className="shrink-0 text-primary" />
                <span className="truncate text-sm font-bold text-ink">{subscription.members}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {shouldNotify ? (
                  <button
                    type="button"
                    title={reminderState.status === 'sending' ? '正在发送续费提醒' : '发送续费提醒邮件'}
                    aria-label={`提醒 ${subscription.name} 成员`}
                    onClick={handleSendReminder}
                    disabled={reminderState.status === 'sending'}
                    className="theme-icon-button inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[#DDE4E0] bg-white px-2 text-[#B45C16] transition hover:bg-[#FDF0E5]"
                  >
                    {reminderState.status === 'sending' ? (
                      <LoaderCircle size={15} className="animate-spin" />
                    ) : reminderState.status === 'success' ? (
                      <CheckCircle2 size={15} />
                    ) : (
                      <Mail size={15} />
                    )}
                    <span className="hidden text-[11px] font-semibold sm:inline">
                      {reminderState.status === 'sending' ? '发送中' : '续费提醒'}
                    </span>
                  </button>
                ) : null}
                <button
                  type="button"
                  title="添加成员"
                  aria-label={`为 ${subscription.name} 添加成员`}
                  onClick={openMemberDialog}
                  className="theme-icon-button grid h-8 w-8 place-items-center rounded-lg border border-[#DDE4E0] bg-white text-primary transition hover:bg-[#E8F3F1]"
                >
                  <UserPlus size={15} />
                </button>
              </div>
            </div>
            {reminderState.message ? (
              <div
                aria-live="polite"
                className={`mt-2 text-[11px] font-semibold ${
                  reminderState.status === 'error'
                    ? 'text-danger'
                    : reminderState.status === 'success'
                      ? 'text-success'
                      : 'text-muted'
                }`}
              >
                {reminderState.message}
              </div>
            ) : null}
          </div>
        </div>
      </article>

      {memberDialogOpen ? (
        <div className="theme-overlay fixed inset-0 z-[60] grid place-items-center bg-[#17211B]/45 p-4 backdrop-blur-sm" onClick={closeMemberDialog}>
          <form
            className="theme-modal w-full max-w-[420px] rounded-xl border border-[#DDE4E0] bg-white p-5 shadow-[0_24px_70px_rgba(23,33,27,.22)]"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleAddMember}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-primary">成员管理</div>
                <h3 className="mt-1.5 text-xl font-bold text-ink">添加共享成员</h3>
                <p className="mt-2 text-sm text-muted">为 {subscription.name} 添加一位使用成员。</p>
              </div>
              <button
                type="button"
                onClick={closeMemberDialog}
                className="theme-icon-button grid h-9 w-9 place-items-center rounded-lg border border-[#E2E7E4] text-muted hover:text-ink"
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
              <DatePickerField
                label="到期时间"
                value={memberForm.expiresAt}
                onChange={(value) => setMemberForm((current) => ({ ...current, expiresAt: value }))}
                placeholder="选择到期日期"
              />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeMemberDialog}
                className="theme-button h-10 rounded-lg border border-[#DDE4E0] bg-white px-4 text-sm font-semibold text-ink"
              >
                取消
              </button>
              <button type="submit" className="theme-primary-action h-10 rounded-lg px-4 text-sm font-semibold">
                添加成员
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

function MenuAction({ icon: Icon, label, onClick }: { icon: typeof Edit3; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="theme-menu-item flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-sm font-semibold text-ink transition hover:bg-[#F1F4F2]"
    >
      <Icon size={15} />
      {label}
    </button>
  );
}

function Metric({ label, value, note, className = '' }: { label: string; value: string; note?: string; className?: string }) {
  return (
    <div className={`min-w-0 border-[#E7ECE9] p-4 sm:px-5 ${className}`}>
      <div className="truncate text-[11px] font-semibold text-muted">{label}</div>
      <div className="mt-2 truncate text-sm font-bold text-ink">{value}</div>
      {note ? <div className="mt-1 truncate text-[11px] font-medium text-muted">{note}</div> : null}
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
  type?: 'text' | 'email';
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
        className="theme-input h-11 rounded-lg border border-[#DDE4E0] bg-[#F7F9F8] px-3 text-sm font-semibold text-ink outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
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

function getBillingHint(daysUntilBilling: number | null) {
  if (daysUntilBilling === null) return '日期待确认';
  if (daysUntilBilling < 0) return `已逾期 ${Math.abs(daysUntilBilling)} 天`;
  if (daysUntilBilling === 0) return '今天扣费';
  if (daysUntilBilling === 1) return '明天扣费';
  return `${daysUntilBilling} 天后扣费`;
}

function getMemberNameFromEmail(email: string) {
  const localPart = email.split('@')[0]?.replace(/[._-]+/g, ' ').trim();
  return localPart || '成员';
}
