'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, LoaderCircle, MailCheck, RefreshCw, Send } from 'lucide-react';

type EmailServiceStatus = {
  configured: boolean;
  verified: boolean;
  message: string;
  host?: string;
  port?: number;
  secure?: boolean;
  requireTls?: boolean;
  from?: string;
  authenticated?: boolean;
  defaultTestRecipientConfigured?: boolean;
  checkedAt?: string;
};

type Feedback = {
  kind: 'success' | 'error';
  message: string;
} | null;

export function EmailDeliverySetting({ onSessionExpired }: { onSessionExpired: () => void }) {
  const onSessionExpiredRef = useRef(onSessionExpired);
  const [status, setStatus] = useState<EmailServiceStatus | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [testEmail, setTestEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const checkStatus = useCallback(async () => {
    setIsChecking(true);
    setFeedback(null);

    try {
      const response = await fetch('/api/reminders/email/status', { method: 'GET', cache: 'no-store' });
      const result = (await response.json().catch(() => null)) as
        | (Partial<EmailServiceStatus> & { ok?: boolean; message?: string })
        | null;

      if (response.status === 401) {
        onSessionExpiredRef.current();
        throw new Error('管理员会话已失效，请重新登录。');
      }
      if (!response.ok || !result) {
        throw new Error(result?.message || '无法读取邮件服务状态。');
      }

      setStatus({
        configured: result.configured === true,
        verified: result.verified === true,
        message: result.message || '邮件服务状态未知。',
        host: result.host,
        port: result.port,
        secure: result.secure,
        requireTls: result.requireTls,
        from: result.from,
        authenticated: result.authenticated,
        defaultTestRecipientConfigured: result.defaultTestRecipientConfigured,
        checkedAt: result.checkedAt
      });
    } catch (error) {
      setStatus({
        configured: false,
        verified: false,
        message: error instanceof Error ? error.message : '无法读取邮件服务状态。'
      });
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    onSessionExpiredRef.current = onSessionExpired;
  }, [onSessionExpired]);

  useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  async function handleSendTestEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSending(true);
    setFeedback(null);

    try {
      const response = await fetch('/api/reminders/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail.trim() })
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;

      if (response.status === 401) {
        onSessionExpiredRef.current();
        throw new Error('管理员会话已失效，请重新登录。');
      }
      if (!response.ok) {
        throw new Error(result?.message || '测试邮件发送失败。');
      }

      setFeedback({ kind: 'success', message: result?.message || '测试邮件已发送。' });
    } catch (error) {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : '测试邮件发送失败。' });
    } finally {
      setIsSending(false);
    }
  }

  const badge = getStatusBadge(status, isChecking);
  const canUseDefaultRecipient = status?.defaultTestRecipientConfigured === true;

  return (
    <section className="theme-inset rounded-xl border border-[#E1E7E3] bg-[#F7F9F8] p-4" aria-labelledby="email-service-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#E8F3F1] text-primary">
            <MailCheck size={19} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h4 id="email-service-title" className="text-sm font-bold text-ink">邮件投递服务</h4>
            <p className="mt-1 text-xs leading-5 text-muted">检测服务端 SMTP 配置，并在发送真实提醒前完成测试。</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.className}`}>
          {isChecking ? <LoaderCircle size={12} className="animate-spin" /> : badge.ok ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
          {badge.label}
        </span>
      </div>

      <div className={`mt-4 rounded-lg border px-3 py-2.5 text-xs font-semibold leading-5 ${badge.messageClassName}`} aria-live="polite">
        {isChecking ? '正在连接 SMTP 服务并验证认证信息…' : status?.message || '尚未检测邮件服务。'}
      </div>

      {status?.configured ? (
        <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          <Detail label="服务器" value={`${status.host || '—'}:${status.port || '—'}`} />
          <Detail label="连接方式" value={getTransportLabel(status)} />
          <Detail label="身份认证" value={status.authenticated ? '已配置' : '无需认证'} />
          <Detail label="发件人" value={status.from || '—'} />
        </dl>
      ) : null}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => void checkStatus()}
          disabled={isChecking}
          className="theme-button inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#DDE4E0] bg-white px-3 text-xs font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={14} className={isChecking ? 'animate-spin' : ''} />
          重新检测
        </button>
      </div>

      <form className="mt-4 border-t border-[#E1E7E3] pt-4" onSubmit={handleSendTestEmail}>
        <label className="grid gap-2">
          <span className="text-xs font-semibold text-muted">测试收件邮箱</span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              value={testEmail}
              onChange={(event) => setTestEmail(event.target.value)}
              required={!canUseDefaultRecipient}
              placeholder={canUseDefaultRecipient ? '留空使用服务端 SMTP_TEST_TO' : 'name@example.com'}
              className="theme-input h-10 min-w-0 flex-1 rounded-lg border border-[#DDE4E0] bg-white px-3 text-sm font-semibold text-ink outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
            />
            <button
              type="submit"
              disabled={isSending || isChecking || !status?.configured}
              className="theme-primary-action inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSending ? <LoaderCircle size={14} className="animate-spin" /> : <Send size={14} />}
              {isSending ? '发送中' : '发送测试邮件'}
            </button>
          </div>
        </label>

        {feedback ? (
          <div
            className={`mt-3 text-xs font-semibold leading-5 ${feedback.kind === 'success' ? 'text-success' : 'text-danger'}`}
            aria-live="polite"
          >
            {feedback.message}
          </div>
        ) : null}
      </form>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-[#E4E9E6] bg-white px-3 py-2">
      <dt className="text-[10px] font-semibold text-muted">{label}</dt>
      <dd className="mt-1 truncate font-semibold text-ink" title={value}>{value}</dd>
    </div>
  );
}

function getTransportLabel(status: EmailServiceStatus) {
  if (status.secure) return 'SMTPS（隐式 TLS）';
  if (status.requireTls) return 'SMTP + STARTTLS';
  return 'SMTP';
}

function getStatusBadge(status: EmailServiceStatus | null, isChecking: boolean) {
  if (isChecking) {
    return {
      ok: false,
      label: '检测中',
      className: 'bg-[#EEF1EF] text-muted',
      messageClassName: 'border-[#DFE5E1] bg-white text-muted'
    };
  }
  if (status?.verified) {
    return {
      ok: true,
      label: '连接正常',
      className: 'bg-[#E8F4EC] text-[#16734F]',
      messageClassName: 'border-[#CFE6D8] bg-[#F1F9F4] text-[#16734F]'
    };
  }
  if (status?.configured) {
    return {
      ok: false,
      label: '连接失败',
      className: 'bg-[#FDECEC] text-danger',
      messageClassName: 'border-[#F1D2D2] bg-[#FFF7F7] text-danger'
    };
  }
  return {
    ok: false,
    label: '未配置',
    className: 'bg-[#FDF0E5] text-[#B45C16]',
    messageClassName: 'border-[#F1DDC7] bg-[#FFF9F3] text-[#9A551C]'
  };
}
