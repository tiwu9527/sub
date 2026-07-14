const intervalMinutes = normalizeInteger(process.env.REMINDER_CHECK_INTERVAL_MINUTES, 60, 0, 24 * 60);
const runOnStart = String(process.env.REMINDER_RUN_ON_START || 'true').trim().toLowerCase() !== 'false';
const apiUrl = String(process.env.REMINDER_API_URL || 'http://127.0.0.1:3100/api/reminders/run').trim();
const cronSecret = String(process.env.REMINDER_CRON_SECRET || '');
const requestTimeoutMs = 90_000;

if (Buffer.byteLength(cronSecret, 'utf8') < 32) {
  console.error('[ReminderWorker] REMINDER_CRON_SECRET must contain at least 32 bytes.');
  process.exit(1);
}

let running = false;
let interval = null;
let startupTimer = null;

async function executeReminderJob(trigger) {
  if (running) {
    console.log(`[ReminderWorker] Skipped ${trigger} tick because the previous request is still running.`);
    return;
  }

  running = true;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        'Content-Type': 'application/json'
      },
      body: '{}',
      signal: controller.signal
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(result?.message || `Reminder API returned HTTP ${response.status}`);
    }
    console.log(`[ReminderWorker] ${result?.message || 'Reminder job completed.'}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ReminderWorker] ${trigger} run failed: ${message}`);
  } finally {
    clearTimeout(timeout);
    running = false;
  }
}

function shutdown() {
  if (interval) clearInterval(interval);
  if (startupTimer) clearTimeout(startupTimer);
  process.exit(0);
}

if (intervalMinutes <= 0) {
  console.log('[ReminderWorker] Scheduled reminders are disabled.');
  interval = setInterval(() => undefined, 24 * 60 * 60 * 1000);
} else {
  console.log(`[ReminderWorker] Checking ${apiUrl} every ${intervalMinutes} minute(s).`);
  if (runOnStart) startupTimer = setTimeout(() => void executeReminderJob('startup'), 5_000);
  interval = setInterval(() => void executeReminderJob('scheduled'), intervalMinutes * 60 * 1000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function normalizeInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, minimum), maximum) : fallback;
}
