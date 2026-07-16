'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, LoaderCircle, Play, RefreshCw, Save } from 'lucide-react';

type ReminderRun = {
  id: string;
  status: string;
  checkedCount: number;
  eligibleCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  message?: string | null;
  startedAt: string;
  completedAt?: string | null;
};

type ReminderSettings = {
  enabled: boolean;
  intervalMinutes: number;
  runOnStart: boolean;
  maxAttempts: number;
  nextScheduledAt: string | null;
  revision: number;
  source: 'database' | 'environment';
};

type SettingsDraft = {
  enabled: boolean;
  intervalMinutes: string;
  runOnStart: boolean;
  maxAttempts: string;
};

type SchedulerStatus = {
  cronConfigured: boolean;
  lastRun: ReminderRun | null;
};

type Feedback = { kind: 'success' | 'error'; message: string } | null;

export function ReminderSchedulerSetting({ onSessionExpired }: { onSessionExpired: () => void }) {
  const onSessionExpiredRef = useRef(onSessionExpired);
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    onSessionExpiredRef.current = onSessionExpired;
  }, [onSessionExpired]);

  const loadStatus = useCallback(async (clearFeedback = true) => {
    setLoading(true);
    if (clearFeedback) setFeedback(null);

    try {
      const [settingsResponse, statusResponse] = await Promise.all([
        fetch('/api/settings/reminders', { method: 'GET', cache: 'no-store' }),
        fetch('/api/reminders/run', { method: 'GET', cache: 'no-store' })
      ]);
      const [settingsResult, statusResult] = await Promise.all([
        settingsResponse.json().catch(() => null),
        statusResponse.json().catch(() => null)
      ]);

      if (settingsResponse.status === 401 || statusResponse.status === 401) {
        onSessionExpiredRef.current();
        throw new Error('管理员会话已失效，请重新登录。');
      }
      if (!settingsResponse.ok) throw new Error(getApiMessage(settingsResult, '无法读取自动提醒配置。'));
      if (!statusResponse.ok) throw new Error(getApiMessage(statusResult, '无法读取定时任务状态。'));

      const nextSettings = normalizeSettings(settingsResult);
      if (!nextSettings) throw new Error('自动提醒配置格式无效。');

      setSettings(nextSettings);
      setDraft(toDraft(nextSettings));
      setStatus({
        cronConfigured: isRecord(statusResult) && statusResult.cronConfigured === true,
        lastRun: isRecord(statusResult) && isReminderRun(statusResult.lastRun) ? statusResult.lastRun : null
      });
    } catch (error) {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : '无法读取定时任务状态。' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function saveSettings() {
    if (!settings || !draft) return;

    const intervalMinutes = Number(draft.intervalMinutes);
    const maxAttempts = Number(draft.maxAttempts);
    if (!Number.isInteger(intervalMinutes) || intervalMinutes < 1 || intervalMinutes > 1440) {
      setFeedback({ kind: 'error', message: '检查间隔必须是 1～1440 之间的整数。' });
      return;
    }
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) {
      setFeedback({ kind: 'error', message: '最大尝试次数必须是 1～10 之间的整数。' });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const response = await fetch('/api/settings/reminders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: draft.enabled,
          intervalMinutes,
          runOnStart: draft.runOnStart,
          maxAttempts,
          revision: settings.revision
        })
      });
      const result = await response.json().catch(() => null);

      if (response.status === 401) {
        onSessionExpiredRef.current();
        throw new Error('管理员会话已失效，请重新登录。');
      }
      if (response.status === 409) {
        await loadStatus(false);
        throw new Error(getApiMessage(result, '配置已在其他页面更新，已为你刷新最新值。'));
      }
      if (!response.ok) throw new Error(getApiMessage(result, '无法保存自动提醒配置。'));

      const nextSettings = normalizeSettings(result);
      if (!nextSettings) throw new Error('服务端返回的自动提醒配置格式无效。');
      setSettings(nextSettings);
      setDraft(toDraft(nextSettings));
      setFeedback({ kind: 'success', message: '自动提醒配置已保存，调度器将在一分钟内应用。' });
    } catch (error) {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : '无法保存自动提醒配置。' });
    } finally {
      setSaving(false);
    }
  }

  async function runNow() {
    setRunning(true);
    setFeedback(null);
    try {
      const response = await fetch('/api/reminders/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
      const result = await response.json().catch(() => null);
      if (response.status === 401) {
        onSessionExpiredRef.current();
        throw new Error('管理员会话已失效，请重新登录。');
      }
      if (!response.ok) throw new Error(getApiMessage(result, '提醒任务执行失败。'));
      setFeedback({ kind: 'success', message: getApiMessage(result, '提醒任务执行完成。') });
      await loadStatus(false);
    } catch (error) {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : '提醒任务执行失败。' });
    } finally {
      setRunning(false);
    }
  }

  const lastRunFailed = status?.lastRun?.status === 'failed';
  const healthy = Boolean(settings?.enabled && status?.cronConfigured && !lastRunFailed);
  const busy = loading || saving || running;

  return (
    <section className="theme-inset rounded-xl border border-[#E1E7E3] bg-[#F7F9F8] p-4" aria-labelledby="reminder-scheduler-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#E8F3F1] text-primary">
            <Clock3 size={19} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h4 id="reminder-scheduler-title" className="text-sm font-bold text-ink">自动提醒任务</h4>
            <p className="mt-1 text-xs leading-5 text-muted">
              {loading
                ? '正在读取任务状态…'
                : settings?.enabled
                  ? `每 ${settings.intervalMinutes} 分钟检查一次到期订阅。`
                  : '定时检查已停用，仍可手动立即检查。'}
            </p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${healthy ? 'bg-[#E8F4EC] text-[#16734F]' : 'bg-[#FDF0E5] text-[#B45C16]'}`}>
          {loading ? <LoaderCircle size={12} className="animate-spin" /> : healthy ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
          {loading ? '读取中' : healthy ? '运行中' : settings && !settings.enabled ? '已停用' : lastRunFailed ? '最近失败' : '待配置'}
        </span>
      </div>

      {draft ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ToggleField
            label="启用自动提醒"
            description="关闭后不再启动新的定时检查。"
            checked={draft.enabled}
            disabled={busy}
            onChange={(enabled) => setDraft((current) => current ? { ...current, enabled } : current)}
          />
          <ToggleField
            label="启动时立即检查"
            description="worker 启动后先执行一次到期检查。"
            checked={draft.runOnStart}
            disabled={busy}
            onChange={(runOnStart) => setDraft((current) => current ? { ...current, runOnStart } : current)}
          />
          <NumberField
            label="检查间隔（分钟）"
            description="允许 1～1440 分钟。"
            value={draft.intervalMinutes}
            min={1}
            max={1440}
            disabled={busy}
            onChange={(intervalMinutes) => setDraft((current) => current ? { ...current, intervalMinutes } : current)}
          />
          <NumberField
            label="失败最大尝试次数"
            description="允许 1～10 次，下一轮检查生效。"
            value={draft.maxAttempts}
            min={1}
            max={10}
            disabled={busy}
            onChange={(maxAttempts) => setDraft((current) => current ? { ...current, maxAttempts } : current)}
          />
        </div>
      ) : null}

      {settings ? (
        <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          <Detail
            label="下次计划检查"
            value={settings.enabled ? formatOptionalDateTime(settings.nextScheduledAt) : '已停用'}
          />
          <Detail label="配置来源" value={settings.source === 'database' ? '管理后台' : '环境变量默认值'} />
        </dl>
      ) : null}

      {status?.lastRun ? (
        <div className="mt-3 rounded-lg border border-[#E4E9E6] bg-white px-3 py-2.5 text-xs leading-5 text-muted">
          <div className="font-semibold text-ink">最近执行：{formatDateTime(status.lastRun.startedAt)}</div>
          <div className="mt-1">{status.lastRun.message || `发送 ${status.lastRun.sentCount} 封，失败 ${status.lastRun.failedCount} 封。`}</div>
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-[#E4E9E6] bg-white px-3 py-2.5 text-xs font-semibold text-muted">尚无任务执行记录。</div>
      )}

      {feedback ? (
        <div className={`mt-3 text-xs font-semibold leading-5 ${feedback.kind === 'success' ? 'text-success' : 'text-danger'}`} aria-live="polite">
          {feedback.message}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => void loadStatus()}
          disabled={busy}
          className="theme-button inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#DDE4E0] bg-white px-3 text-xs font-semibold text-ink disabled:opacity-60"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          刷新
        </button>
        <button
          type="button"
          onClick={() => void saveSettings()}
          disabled={busy || !settings || !draft}
          className="theme-button inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#DDE4E0] bg-white px-3 text-xs font-semibold text-ink disabled:opacity-60"
        >
          {saving ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? '保存中' : '保存配置'}
        </button>
        <button
          type="button"
          onClick={() => void runNow()}
          disabled={busy}
          className="theme-primary-action inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold disabled:opacity-60"
        >
          {running ? <LoaderCircle size={14} className="animate-spin" /> : <Play size={14} />}
          {running ? '执行中' : '立即检查'}
        </button>
      </div>
    </section>
  );
}

function ToggleField({
  label,
  description,
  checked,
  disabled,
  onChange
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-20 items-start gap-3 rounded-lg border border-[#E4E9E6] bg-white px-3 py-3">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
        className="mt-0.5 h-4 w-4 accent-primary disabled:opacity-60"
      />
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-ink">{label}</span>
        <span className="mt-1 block text-[11px] leading-4 text-muted">{description}</span>
      </span>
    </label>
  );
}

function NumberField({
  label,
  description,
  value,
  min,
  max,
  disabled,
  onChange
}: {
  label: string;
  description: string;
  value: string;
  min: number;
  max: number;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid min-h-20 gap-1.5 rounded-lg border border-[#E4E9E6] bg-white px-3 py-2.5">
      <span className="text-xs font-semibold text-ink">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={1}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="theme-input h-9 rounded-lg border border-[#DDE4E0] bg-white px-3 text-sm font-semibold text-ink outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10 disabled:opacity-60"
      />
      <span className="text-[11px] leading-4 text-muted">{description}</span>
    </label>
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

function normalizeSettings(value: unknown): ReminderSettings | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.enabled !== 'boolean'
    || !Number.isInteger(value.intervalMinutes)
    || typeof value.runOnStart !== 'boolean'
    || !Number.isInteger(value.maxAttempts)
    || !Number.isInteger(value.revision)
  ) {
    return null;
  }

  return {
    enabled: value.enabled,
    intervalMinutes: Number(value.intervalMinutes),
    runOnStart: value.runOnStart,
    maxAttempts: Number(value.maxAttempts),
    nextScheduledAt: typeof value.nextScheduledAt === 'string' ? value.nextScheduledAt : null,
    revision: Number(value.revision),
    source: value.source === 'environment' ? 'environment' : 'database'
  };
}

function toDraft(settings: ReminderSettings): SettingsDraft {
  return {
    enabled: settings.enabled,
    intervalMinutes: String(settings.intervalMinutes),
    runOnStart: settings.runOnStart,
    maxAttempts: String(settings.maxAttempts)
  };
}

function isReminderRun(value: unknown): value is ReminderRun {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.status === 'string'
    && typeof value.startedAt === 'string'
    && typeof value.sentCount === 'number'
    && typeof value.failedCount === 'number';
}

function getApiMessage(value: unknown, fallback: string) {
  return isRecord(value) && typeof value.message === 'string' && value.message.trim() ? value.message : fallback;
}

function formatOptionalDateTime(value: string | null) {
  return value ? formatDateTime(value) : '等待调度器领取';
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
