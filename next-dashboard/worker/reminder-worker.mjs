const apiUrl = String(process.env.REMINDER_API_URL || 'http://127.0.0.1:3100/api/reminders/run').trim();
const cronSecret = String(process.env.REMINDER_CRON_SECRET || '');
const requestTimeoutMs = 90_000;
const pollIntervalMs = 60_000;

if (Buffer.byteLength(cronSecret, 'utf8') < 32) {
  console.error('[ReminderWorker] REMINDER_CRON_SECRET must contain at least 32 bytes.');
  process.exit(1);
}

let running = false;
let interval = null;
let startupTimer = null;

async function executeReminderJob(trigger) {
  if (running) return;

  running = true;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const headers = {
      Authorization: `Bearer ${cronSecret}`,
      'Content-Type': 'application/json'
    };
    if (trigger === 'startup') headers['X-Reminder-Trigger'] = 'startup';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: '{}',
      signal: controller.signal
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(result?.message || `Reminder API returned HTTP ${response.status}`);
    }
    if (result?.status !== 'skipped') {
      console.log(`[ReminderWorker] ${result?.message || 'Reminder job completed.'}`);
    }
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

console.log(`[ReminderWorker] Polling ${apiUrl} every ${pollIntervalMs / 60_000} minute(s).`);
startupTimer = setTimeout(() => void executeReminderJob('startup'), 5_000);
interval = setInterval(() => void executeReminderJob('scheduled'), pollIntervalMs);

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
