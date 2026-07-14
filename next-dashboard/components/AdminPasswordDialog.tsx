'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { KeyRound, LoaderCircle, ShieldCheck, X } from 'lucide-react';

const minimumPasswordLength = 8;
const maximumPasswordLength = 128;

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const emptyForm: PasswordForm = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
};

type Feedback = {
  kind: 'success' | 'error';
  message: string;
} | null;

export function AdminPasswordDialog({
  open,
  onClose,
  onSessionExpired
}: {
  open: boolean;
  onClose: () => void;
  onSessionExpired: () => void;
}) {
  const [form, setForm] = useState<PasswordForm>(emptyForm);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
      setFeedback(null);
      setIsSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const validationMessage = validatePasswordForm(form);
    if (validationMessage) {
      setFeedback({ kind: 'error', message: validationMessage });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword
        })
      });
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; code?: string; message?: string }
        | null;

      if (response.status === 401 && result?.code === 'ADMIN_SESSION_REQUIRED') {
        onClose();
        onSessionExpired();
        return;
      }
      if (!response.ok) {
        throw new Error(result?.message || '暂时无法修改管理员密码，请稍后再试。');
      }

      setForm(emptyForm);
      setFeedback({ kind: 'success', message: result?.message || '管理员密码已更新。' });
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : '暂时无法修改管理员密码，请稍后再试。'
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="theme-overlay fixed inset-0 z-[70] grid place-items-center bg-[#17211B]/50 p-4 backdrop-blur-sm"
      onClick={isSubmitting ? undefined : onClose}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-password-dialog-title"
        className="theme-modal w-full max-w-[440px] rounded-xl border border-[#DDE4E0] bg-white p-6 shadow-[0_24px_70px_rgba(23,33,27,.24)]"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="theme-icon-chip grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#E8F3F1] text-primary">
              <ShieldCheck size={22} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-primary">账户安全</div>
              <h3 id="admin-password-dialog-title" className="mt-1.5 text-2xl font-bold text-ink">修改管理员密码</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="theme-icon-button grid h-9 w-9 place-items-center rounded-lg border border-[#DDE4E0] text-muted hover:text-ink disabled:opacity-50"
            aria-label="关闭"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted">
          新密码至少 {minimumPasswordLength} 个字符。修改成功后，当前窗口保持登录，其他设备上的旧会话会立即失效。
        </p>

        <div className="mt-5 grid gap-4">
          <PasswordField
            id="current-admin-password"
            label="当前密码"
            value={form.currentPassword}
            onChange={(value) => setForm((current) => ({ ...current, currentPassword: value }))}
            autoComplete="current-password"
            maxLength={4096}
            autoFocus
          />
          <PasswordField
            id="new-admin-password"
            label="新密码"
            value={form.newPassword}
            onChange={(value) => setForm((current) => ({ ...current, newPassword: value }))}
            autoComplete="new-password"
            maxLength={maximumPasswordLength}
          />
          <PasswordField
            id="confirm-admin-password"
            label="确认新密码"
            value={form.confirmPassword}
            onChange={(value) => setForm((current) => ({ ...current, confirmPassword: value }))}
            autoComplete="new-password"
            maxLength={maximumPasswordLength}
          />
        </div>

        {feedback ? (
          <div
            className={`mt-4 rounded-lg border px-3 py-2.5 text-sm font-semibold leading-5 ${
              feedback.kind === 'success'
                ? 'border-[#CFE6D8] bg-[#F1F9F4] text-[#16734F]'
                : 'border-[#F1D2D2] bg-[#FFF7F7] text-danger'
            }`}
            role={feedback.kind === 'error' ? 'alert' : 'status'}
            aria-live="polite"
          >
            {feedback.message}
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="theme-button h-10 rounded-lg border border-[#DDE4E0] bg-white px-4 text-sm font-semibold text-ink disabled:opacity-50"
          >
            {feedback?.kind === 'success' ? '关闭' : '取消'}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="theme-primary-action inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? <LoaderCircle size={16} className="animate-spin" /> : <KeyRound size={16} />}
            {isSubmitting ? '更新中' : '更新密码'}
          </button>
        </div>
      </form>
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  maxLength,
  autoFocus = false
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  maxLength: number;
  autoFocus?: boolean;
}) {
  return (
    <label htmlFor={id} className="grid gap-2">
      <span className="text-sm font-semibold text-muted">{label}</span>
      <input
        id={id}
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        required
        maxLength={maxLength}
        className="theme-input h-11 rounded-lg border border-[#DDE4E0] bg-[#F7F9F8] px-3 text-sm font-semibold text-ink outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
      />
    </label>
  );
}

function validatePasswordForm(form: PasswordForm) {
  if (!form.currentPassword) return '请输入当前密码。';
  if (form.newPassword.length < minimumPasswordLength) {
    return `新密码至少需要 ${minimumPasswordLength} 个字符。`;
  }
  if (form.newPassword.length > maximumPasswordLength) {
    return `新密码不能超过 ${maximumPasswordLength} 个字符。`;
  }
  if (!/\S/.test(form.newPassword)) return '新密码不能全部为空格。';
  if (form.currentPassword === form.newPassword) return '新密码不能与当前密码相同。';
  if (form.newPassword !== form.confirmPassword) return '两次输入的新密码不一致。';
  return null;
}
