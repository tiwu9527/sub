'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, LoaderCircle, MailCheck, RefreshCw, Save, Send } from 'lucide-react';

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

type EmailSettingsForm = {
  enabled: boolean;
  host: string;
  port: string;
  secure: boolean;
  requireTls: boolean;
  username: string;
  mailFrom: string;
  mailReplyTo: string;
  testTo: string;
};

type EmailSettingsResponse = Partial<{
  ok: boolean;
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  requireTls: boolean;
  username: string;
  passwordConfigured: boolean;
  mailFrom: string;
  mailReplyTo: string;
  testTo: string;
  revision: number;
  source: string;
  message: string;
}>;

type Feedback = {
  kind: 'success' | 'error';
  message: string;
} | null;

type PasswordAction = 'keep' | 'replace' | 'clear';

const emptySettingsForm: EmailSettingsForm = {
  enabled: false,
  host: '',
  port: '587',
  secure: false,
  requireTls: true,
  username: '',
  mailFrom: '',
  mailReplyTo: '',
  testTo: ''
};

export function EmailDeliverySetting({ onSessionExpired }: { onSessionExpired: () => void }) {
  const onSessionExpiredRef = useRef(onSessionExpired);
  const [status, setStatus] = useState<EmailServiceStatus | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [settingsForm, setSettingsForm] = useState<EmailSettingsForm>(emptySettingsForm);
  const [settingsRevision, setSettingsRevision] = useState(0);
  const [settingsSource, setSettingsSource] = useState('none');
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [passwordConfigured, setPasswordConfigured] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordAction, setPasswordAction] = useState<PasswordAction>('keep');
  const [configFeedback, setConfigFeedback] = useState<Feedback>(null);
  const [testEmail, setTestEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [testFeedback, setTestFeedback] = useState<Feedback>(null);

  const loadSettings = useCallback(async () => {
    setIsLoadingSettings(true);
    setConfigFeedback(null);

    try {
      const response = await fetch('/api/settings/email', { method: 'GET', cache: 'no-store' });
      const result = (await response.json().catch(() => null)) as EmailSettingsResponse | null;

      if (response.status === 401) {
        onSessionExpiredRef.current();
        setPassword('');
        setPasswordAction('keep');
        throw new Error('管理员会话已失效，请重新登录。');
      }
      if (!response.ok || !result || result.ok === false) {
        throw new Error(result?.message || '无法读取邮件投递配置。');
      }
      if (!Number.isInteger(result.revision) || Number(result.revision) < 0) {
        throw new Error('服务端返回的邮件投递配置无效。');
      }

      setSettingsForm({
        enabled: result.enabled === true,
        host: typeof result.host === 'string' ? result.host : '',
        port: typeof result.port === 'number' && Number.isInteger(result.port) ? String(result.port) : '587',
        secure: result.secure === true,
        requireTls: result.requireTls === true,
        username: typeof result.username === 'string' ? result.username : '',
        mailFrom: typeof result.mailFrom === 'string' ? result.mailFrom : '',
        mailReplyTo: typeof result.mailReplyTo === 'string' ? result.mailReplyTo : '',
        testTo: typeof result.testTo === 'string' ? result.testTo : ''
      });
      setSettingsRevision(Number(result.revision));
      setSettingsSource(typeof result.source === 'string' ? result.source : 'none');
      setPasswordConfigured(result.passwordConfigured === true);
      setPassword('');
      setPasswordAction('keep');
      setSettingsLoaded(true);
      return true;
    } catch (error) {
      setConfigFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : '无法读取邮件投递配置。'
      });
      return false;
    } finally {
      setIsLoadingSettings(false);
    }
  }, []);

  const checkStatus = useCallback(async () => {
    setIsChecking(true);

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
    void loadSettings();
    void checkStatus();
  }, [checkStatus, loadSettings]);

  async function handleSaveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settingsLoaded || isLoadingSettings || isSaving) return;

    const port = Number(settingsForm.port);
    const username = settingsForm.username.trim();
    const nextPassword = password;

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      setConfigFeedback({ kind: 'error', message: 'SMTP 端口必须是 1 到 65535 之间的整数。' });
      return;
    }
    if (settingsForm.enabled && (!settingsForm.host.trim() || !settingsForm.mailFrom.trim())) {
      setConfigFeedback({ kind: 'error', message: '启用邮件投递时必须填写 SMTP 主机和发件人。' });
      return;
    }
    if (passwordAction === 'replace' && !nextPassword) {
      setConfigFeedback({ kind: 'error', message: '请输入新的 SMTP 密码。' });
      return;
    }
    if (passwordAction === 'replace' && !username) {
      setConfigFeedback({ kind: 'error', message: '配置 SMTP 密码时必须同时填写用户名。' });
      return;
    }
    if (passwordAction === 'clear' && username) {
      setConfigFeedback({ kind: 'error', message: '清除 SMTP 密码时请同时清空用户名。' });
      return;
    }
    if (passwordAction === 'keep' && passwordConfigured && !username) {
      setConfigFeedback({ kind: 'error', message: '清空用户名时也需要明确清除已保存的 SMTP 密码。' });
      return;
    }
    if (passwordAction === 'keep' && !passwordConfigured && username) {
      setConfigFeedback({ kind: 'error', message: '填写 SMTP 用户名后还需要输入密码。' });
      return;
    }

    setIsSaving(true);
    setConfigFeedback(null);

    try {
      const response = await fetch('/api/settings/email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: settingsForm.enabled,
          host: settingsForm.host.trim(),
          port,
          secure: settingsForm.secure,
          requireTls: settingsForm.secure ? false : settingsForm.requireTls,
          username,
          mailFrom: settingsForm.mailFrom.trim(),
          mailReplyTo: settingsForm.mailReplyTo.trim(),
          testTo: settingsForm.testTo.trim(),
          revision: settingsRevision,
          passwordAction,
          ...(passwordAction === 'replace' ? { password: nextPassword } : {})
        })
      });
      const result = (await response.json().catch(() => null)) as EmailSettingsResponse | null;

      if (response.status === 401) {
        onSessionExpiredRef.current();
        setPassword('');
        setPasswordAction('keep');
        throw new Error('管理员会话已失效，请重新登录。');
      }
      if (response.status === 409) {
        const refreshed = await loadSettings();
        if (refreshed) {
          setConfigFeedback({ kind: 'error', message: '配置已在其他页面更新，已刷新为最新内容，请重新修改后保存。' });
        }
        return;
      }
      if (!response.ok || !result || result.ok === false) {
        throw new Error(result?.message || '邮件投递配置保存失败。');
      }

      setPassword('');
      setPasswordAction('keep');
      const refreshed = await loadSettings();
      if (refreshed) {
        setConfigFeedback({ kind: 'success', message: result.message || '邮件投递配置已保存。' });
        void checkStatus();
      }
    } catch (error) {
      setConfigFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : '邮件投递配置保存失败。'
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSendTestEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSending(true);
    setTestFeedback(null);

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

      setTestFeedback({ kind: 'success', message: result?.message || '测试邮件已发送。' });
    } catch (error) {
      setTestFeedback({ kind: 'error', message: error instanceof Error ? error.message : '测试邮件发送失败。' });
    } finally {
      setIsSending(false);
    }
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    setPasswordAction(value ? 'replace' : 'keep');
    setConfigFeedback(null);
  }

  function togglePasswordClear() {
    setPassword('');
    setPasswordAction((current) => (current === 'clear' ? 'keep' : 'clear'));
    setConfigFeedback(null);
  }

  const badge = getStatusBadge(status, isChecking);
  const canUseDefaultRecipient = status?.defaultTestRecipientConfigured === true;
  const formDisabled = isLoadingSettings || isSaving || !settingsLoaded;
  const sourceLabel = getSettingsSourceLabel(settingsSource);

  return (
    <section
      className="theme-inset rounded-xl border border-[#E1E7E3] bg-[#F7F9F8] p-4"
      aria-labelledby="email-service-title"
      aria-busy={isLoadingSettings || isSaving || isChecking}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#E8F3F1] text-primary">
            <MailCheck size={19} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h4 id="email-service-title" className="text-sm font-bold text-ink">邮件投递服务</h4>
            <p className="mt-1 text-xs leading-5 text-muted">在后台保存 SMTP 配置，并在发送真实提醒前完成检测。</p>
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
          disabled={isChecking || isSaving}
          className="theme-button inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#DDE4E0] bg-white px-3 text-xs font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={14} className={isChecking ? 'animate-spin' : ''} />
          重新检测
        </button>
      </div>

      <form className="mt-4 border-t border-[#E1E7E3] pt-4" onSubmit={handleSaveSettings}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h5 className="text-xs font-bold text-ink">SMTP 配置</h5>
            <p className="mt-1 text-[11px] leading-5 text-muted">
              {isLoadingSettings ? '正在读取配置…' : `当前来源：${sourceLabel}`}
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink">
            <input
              type="checkbox"
              checked={settingsForm.enabled}
              onChange={(event) => setSettingsForm((current) => ({ ...current, enabled: event.target.checked }))}
              disabled={formDisabled}
              className="h-4 w-4 rounded border-[#C9D3CD] text-primary focus:ring-primary/20"
            />
            启用邮件投递
          </label>
        </div>

        <fieldset disabled={formDisabled} className="mt-4 grid gap-3 disabled:opacity-60">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
            <ConfigField label="SMTP 主机" htmlFor="smtp-host">
              <input
                id="smtp-host"
                type="text"
                value={settingsForm.host}
                onChange={(event) => setSettingsForm((current) => ({ ...current, host: event.target.value }))}
                required={settingsForm.enabled}
                maxLength={253}
                autoComplete="off"
                placeholder="smtp.example.com"
                className={inputClassName}
              />
            </ConfigField>
            <ConfigField label="端口" htmlFor="smtp-port">
              <input
                id="smtp-port"
                type="number"
                value={settingsForm.port}
                onChange={(event) => setSettingsForm((current) => ({ ...current, port: event.target.value }))}
                required
                min={1}
                max={65535}
                step={1}
                inputMode="numeric"
                className={inputClassName}
              />
            </ConfigField>
          </div>

          <div className="grid gap-2 rounded-lg border border-[#E4E9E6] bg-white px-3 py-2.5 sm:grid-cols-2">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-ink">
              <input
                type="checkbox"
                checked={settingsForm.secure}
                onChange={(event) =>
                  setSettingsForm((current) => ({
                    ...current,
                    secure: event.target.checked,
                    requireTls: event.target.checked ? false : current.requireTls
                  }))
                }
                className="h-4 w-4 rounded border-[#C9D3CD] text-primary focus:ring-primary/20"
              />
              SMTPS（隐式 TLS）
            </label>
            <label className={`inline-flex items-center gap-2 text-xs font-semibold ${settingsForm.secure ? 'text-muted' : 'text-ink'}`}>
              <input
                type="checkbox"
                checked={settingsForm.requireTls}
                onChange={(event) => setSettingsForm((current) => ({ ...current, requireTls: event.target.checked }))}
                disabled={formDisabled || settingsForm.secure}
                className="h-4 w-4 rounded border-[#C9D3CD] text-primary focus:ring-primary/20"
              />
              强制 STARTTLS
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ConfigField label="SMTP 用户名" htmlFor="smtp-username">
              <input
                id="smtp-username"
                type="text"
                value={settingsForm.username}
                onChange={(event) => setSettingsForm((current) => ({ ...current, username: event.target.value }))}
                maxLength={320}
                autoComplete="username"
                placeholder="mailer@example.com"
                className={inputClassName}
              />
            </ConfigField>
            <ConfigField label="SMTP 密码" htmlFor="smtp-password">
              <div className="flex gap-2">
                <input
                  id="smtp-password"
                  type="password"
                  value={password}
                  onChange={(event) => handlePasswordChange(event.target.value)}
                  disabled={formDisabled || passwordAction === 'clear'}
                  maxLength={512}
                  autoComplete="new-password"
                  spellCheck={false}
                  aria-describedby="smtp-password-help"
                  placeholder={passwordConfigured ? '留空保留现有密码' : '请输入 SMTP 密码'}
                  className={`${inputClassName} min-w-0 flex-1`}
                />
                {passwordConfigured ? (
                  <button
                    type="button"
                    onClick={togglePasswordClear}
                    aria-pressed={passwordAction === 'clear'}
                    className={`shrink-0 rounded-lg border px-3 text-[11px] font-semibold transition ${
                      passwordAction === 'clear'
                        ? 'border-[#E8C7C7] bg-[#FFF5F5] text-danger'
                        : 'border-[#DDE4E0] bg-white text-muted hover:text-danger'
                    }`}
                  >
                    {passwordAction === 'clear' ? '取消清除' : '清除密码'}
                  </button>
                ) : null}
              </div>
            </ConfigField>
          </div>

          <p id="smtp-password-help" className={`text-[11px] leading-5 ${passwordAction === 'clear' ? 'text-danger' : 'text-muted'}`}>
            {getPasswordHelp(passwordConfigured, passwordAction)}
          </p>

          <ConfigField label="发件人" htmlFor="smtp-mail-from">
            <input
              id="smtp-mail-from"
              type="text"
              value={settingsForm.mailFrom}
              onChange={(event) => setSettingsForm((current) => ({ ...current, mailFrom: event.target.value }))}
              required={settingsForm.enabled}
              maxLength={320}
              autoComplete="off"
              placeholder="续费管家 <mailer@example.com>"
              className={inputClassName}
            />
          </ConfigField>

          <div className="grid gap-3 sm:grid-cols-2">
            <ConfigField label="回复地址（可选）" htmlFor="smtp-reply-to">
              <input
                id="smtp-reply-to"
                type="email"
                value={settingsForm.mailReplyTo}
                onChange={(event) => setSettingsForm((current) => ({ ...current, mailReplyTo: event.target.value }))}
                maxLength={254}
                autoComplete="email"
                placeholder="reply@example.com"
                className={inputClassName}
              />
            </ConfigField>
            <ConfigField label="默认测试收件人（可选）" htmlFor="smtp-test-to">
              <input
                id="smtp-test-to"
                type="email"
                value={settingsForm.testTo}
                onChange={(event) => setSettingsForm((current) => ({ ...current, testTo: event.target.value }))}
                maxLength={254}
                autoComplete="email"
                placeholder="test@example.com"
                className={inputClassName}
              />
            </ConfigField>
          </div>
        </fieldset>

        {configFeedback ? (
          <div
            className={`mt-3 text-xs font-semibold leading-5 ${configFeedback.kind === 'success' ? 'text-success' : 'text-danger'}`}
            role={configFeedback.kind === 'error' ? 'alert' : 'status'}
            aria-live="polite"
          >
            {configFeedback.message}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => void loadSettings()}
            disabled={isLoadingSettings || isSaving}
            className="theme-button inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#DDE4E0] bg-white px-3 text-xs font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={14} className={isLoadingSettings ? 'animate-spin' : ''} />
            重新加载
          </button>
          <button
            type="submit"
            disabled={formDisabled}
            className="theme-primary-action inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />}
            {isSaving ? '保存中' : '保存邮件配置'}
          </button>
        </div>
      </form>

      <form className="mt-4 border-t border-[#E1E7E3] pt-4" onSubmit={handleSendTestEmail}>
        <label className="grid gap-2">
          <span className="text-xs font-semibold text-muted">测试收件邮箱</span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              value={testEmail}
              onChange={(event) => setTestEmail(event.target.value)}
              required={!canUseDefaultRecipient}
              placeholder={canUseDefaultRecipient ? '留空使用已保存的默认测试收件人' : 'name@example.com'}
              className="theme-input h-10 min-w-0 flex-1 rounded-lg border border-[#DDE4E0] bg-white px-3 text-sm font-semibold text-ink outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
            />
            <button
              type="submit"
              disabled={isSending || isChecking || isSaving || !status?.configured}
              className="theme-primary-action inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSending ? <LoaderCircle size={14} className="animate-spin" /> : <Send size={14} />}
              {isSending ? '发送中' : '发送测试邮件'}
            </button>
          </div>
        </label>

        {testFeedback ? (
          <div
            className={`mt-3 text-xs font-semibold leading-5 ${testFeedback.kind === 'success' ? 'text-success' : 'text-danger'}`}
            role={testFeedback.kind === 'error' ? 'alert' : 'status'}
            aria-live="polite"
          >
            {testFeedback.message}
          </div>
        ) : null}
      </form>
    </section>
  );
}

const inputClassName =
  'theme-input h-10 w-full rounded-lg border border-[#DDE4E0] bg-white px-3 text-sm font-semibold text-ink outline-none transition placeholder:font-medium placeholder:text-muted/70 focus:border-primary/40 focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed';

function ConfigField({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-2">
      <label htmlFor={htmlFor} className="text-xs font-semibold text-muted">{label}</label>
      {children}
    </div>
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

function getPasswordHelp(passwordConfigured: boolean, passwordAction: PasswordAction) {
  if (passwordAction === 'clear') return '保存后将清除已保存的密码；如无需认证，请同时清空 SMTP 用户名。';
  if (passwordAction === 'replace') return '新密码只会提交到服务端保存，不会在页面或接口中回显。';
  if (passwordConfigured) return '服务端已保存密码。此处留空会保留原密码，密码不会回显。';
  return '密码仅在保存时提交，不会写入浏览器本地存储。无需认证时可留空。';
}

function getSettingsSourceLabel(source: string) {
  if (source === 'database') return '后台已保存配置';
  if (source === 'environment') return '服务器环境变量';
  return source && source !== 'none' ? source : '尚未保存';
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
