'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, LoaderCircle, Play, RefreshCw } from 'lucide-react';

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

type SchedulerStatus = {
  enabled: boolean;
  intervalMinutes: number;
  cronConfigured: boolean;
  lastRun: ReminderRun | null;
};

export function ReminderSchedulerSetting({ onSessionExpired }: { onSessionExpired: () => void }) {
  const onSessionExpiredRef = useRef(onSessionExpired);
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    onSessionExpiredRef.current = onSessionExpired;
  }, [onSessionExpired]);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/reminders/run', { method: 'GET', cache: 'no-store' });
      const result = (await response.json().catch(() => null)) as (Partial<SchedulerStatus> & { message?: string }) | null;
      if (response.status === 401) {
        onSessionExpiredRef.current();
        throw new Error('管理员会话已失效，请重新登录。');
      }
      if (!response.ok || !result) throw new Error(result?.message || '无法读取定时任务状态。');
      setStatus({
        enabled: result.enabled === true,
        intervalMinutes: typeof result.intervalMinutes === 'number' ? result.intervalMinutes : 0,
        cronConfigured: result.cronConfigured === true,
        lastRun: result.lastRun ?? null
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

  async function runNow() {
    setRunning(true);
    setFeedback(null);
    try {
      const response = await fetch('/api/reminders/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (response.status === 401) {
        onSessionExpiredRef.current();
        throw new Error('管理员会话已失效，请重新登录。');
      }
      if (!response.ok) throw new Error(result?.message || '提醒任务执行失败。');
      setFeedback({ kind: 'success', message: result?.message || '提醒任务执行完成。' });
      await loadStatus();
    } catch (error) {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : '提醒任务执行失败。' });
    } finally {
      setRunning(false);
    }
  }

  const lastRunFailed = status?.lastRun?.status === 'failed';
  const healthy = Boolean(status?.enabled && status.cronConfigured && !lastRunFailed);
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
              {loading ? '正在读取任务状态…' : status?.enabled ? `每 ${status.intervalMinutes} 分钟检查一次到期订阅。` : '定时检查已停用。'}
            </p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${healthy ? 'bg-[#E8F4EC] text-[#16734F]' : 'bg-[#FDF0E5] text-[#B45C16]'}`}>
          {loading ? <LoaderCircle size={12} className="animate-spin" /> : healthy ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
          {loading ? '读取中' : healthy ? '已配置' : lastRunFailed ? '最近失败' : '待配置'}
        </span>
      </div>

      {status?.lastRun ? (
        <div className="mt-4 rounded-lg border border-[#E4E9E6] bg-white px-3 py-2.5 text-xs leading-5 text-muted">
          <div className="font-semibold text-ink">最近执行：{formatDateTime(status.lastRun.startedAt)}</div>
          <div className="mt-1">{status.lastRun.message || `发送 ${status.lastRun.sentCount} 封，失败 ${status.lastRun.failedCount} 封。`}</div>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-[#E4E9E6] bg-white px-3 py-2.5 text-xs font-semibold text-muted">尚无任务执行记录。</div>
      )}

      {feedback ? (
        <div className={`mt-3 text-xs font-semibold leading-5 ${feedback.kind === 'success' ? 'text-success' : 'text-danger'}`} aria-live="polite">
          {feedback.message}
        </div>
      ) : null}

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => void loadStatus()}
          disabled={loading || running}
          className="theme-button inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#DDE4E0] bg-white px-3 text-xs font-semibold text-ink disabled:opacity-60"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          刷新
        </button>
        <button
          type="button"
          onClick={() => void runNow()}
          disabled={loading || running}
          className="theme-primary-action inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold disabled:opacity-60"
        >
          {running ? <LoaderCircle size={14} className="animate-spin" /> : <Play size={14} />}
          {running ? '执行中' : '立即检查'}
        </button>
      </div>
    </section>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}
