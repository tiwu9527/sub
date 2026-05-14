import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();

const port = Number(process.env.PORT || 3001);
const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const billingCycleLabels = {
  monthly: '月付',
  quarterly: '季付',
  yearly: '年付'
};
const allowedBillingCycles = new Set(Object.keys(billingCycleLabels));
const reminderCheckIntervalMinutes = Math.max(0, Number(process.env.REMINDER_CHECK_INTERVAL_MINUTES || 60));
const oneDayMs = 24 * 60 * 60 * 1000;
const reminderTransporter = createReminderTransporter();

let reminderJobTimer = null;
let reminderJobRunning = false;

app.use(cors({ origin: frontendOrigin }));
app.use(express.json());

function createReminderTransporter() {
  const host = String(process.env.SMTP_HOST || '').trim();
  const portValue = Number(process.env.SMTP_PORT || 0);
  const from = String(process.env.SMTP_FROM || '').trim();

  if (!host || !Number.isInteger(portValue) || portValue <= 0 || !from) {
    return null;
  }

  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();
  const secure = String(process.env.SMTP_SECURE || 'false').trim().toLowerCase() === 'true';

  return nodemailer.createTransport({
    host,
    port: portValue,
    secure,
    auth: user ? { user, pass } : undefined
  });
}

function getSubscriptionInclude() {
  return {
    users: {
      orderBy: { id: 'asc' }
    }
  };
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1' || value === 'on';
}

function normalizeDate(value) {
  return new Date(`${String(value || '').trim()}T00:00:00.000Z`);
}

function toDateKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function startOfTodayUtc() {
  return normalizeDate(new Date().toISOString().slice(0, 10));
}

function addDays(date, days) {
  return new Date(date.getTime() + days * oneDayMs);
}

function formatReminderDate(value) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(value));
}

function getMonthlyEquivalent(subscription) {
  if (subscription.billingCycle === 'yearly') return subscription.price / 12;
  if (subscription.billingCycle === 'quarterly') return subscription.price / 3;
  return subscription.price;
}

function getBillingCycleLabel(billingCycle) {
  return billingCycleLabels[billingCycle] || billingCycle;
}

function normalizeUsers(inputUsers, errors) {
  if (inputUsers == null) return [];

  if (!Array.isArray(inputUsers)) {
    errors.push('使用人员必须是数组');
    return [];
  }

  return inputUsers
    .map((user, index) => {
      const name = String(user?.name || '').trim();
      const email = String(user?.email || '').trim().toLowerCase();
      const isEmpty = !name && !email;

      if (isEmpty) return null;
      if (!name) errors.push(`第 ${index + 1} 位使用人员名称不能为空`);
      if (email && !isValidEmail(email)) errors.push(`第 ${index + 1} 位使用人员邮箱格式无效`);

      return {
        name,
        email: email || null
      };
    })
    .filter(Boolean);
}

function parseSubscriptionPayload(body) {
  const platform = String(body.platform || '').trim();
  const planType = String(body.planType || '').trim();
  const billingCycle = String(body.billingCycle || '').trim();
  const price = Number(body.price);
  const nextBillingDate = normalizeDate(body.nextBillingDate);
  const reminderEnabled = parseBoolean(body.reminderEnabled);
  const reminderDays = Number(body.reminderDays ?? 3);

  const errors = [];
  const users = normalizeUsers(body.users, errors);

  if (!platform) errors.push('平台名称不能为空');
  if (!planType) errors.push('订阅种类不能为空');
  if (!Number.isFinite(price) || price < 0) errors.push('订阅价格必须是大于或等于 0 的数字');
  if (!allowedBillingCycles.has(billingCycle)) errors.push('计费周期只能是 monthly、quarterly 或 yearly');
  if (!body.nextBillingDate || Number.isNaN(nextBillingDate.getTime())) errors.push('下次扣费日期格式无效');
  if (!Number.isInteger(reminderDays) || reminderDays < 0 || reminderDays > 365) errors.push('提醒天数必须是 0 到 365 之间的整数');

  return {
    errors,
    data: {
      platform,
      planType,
      price,
      billingCycle,
      nextBillingDate,
      reminderEnabled,
      reminderDays,
      users
    }
  };
}

function buildReminderEmail(subscription) {
  const dueDateText = formatReminderDate(subscription.nextBillingDate);
  const cycleText = getBillingCycleLabel(subscription.billingCycle);
  const recipients = [...new Set(subscription.users.map((user) => user.email).filter(Boolean))];
  const subject = `[订阅到期提醒] ${subscription.platform} 将于 ${dueDateText} 到期`;
  const userList = subscription.users.map((user) => user.name).join('、') || '未填写';
  const reminderWindowText = subscription.reminderDays === 0 ? '到期当天提醒' : `提前 ${subscription.reminderDays} 天提醒`;

  const text = [
    '订阅到期提醒',
    '',
    `平台：${subscription.platform}`,
    `订阅：${subscription.planType}`,
    `价格：${subscription.price}`,
    `周期：${cycleText}`,
    `到期日：${dueDateText}`,
    `提醒规则：${reminderWindowText}`,
    `使用人员：${userList}`,
    '',
    '请及时确认是否续费。'
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.7;">
      <h2 style="margin-bottom: 12px;">订阅到期提醒</h2>
      <p><strong>平台：</strong>${subscription.platform}</p>
      <p><strong>订阅：</strong>${subscription.planType}</p>
      <p><strong>价格：</strong>${subscription.price}</p>
      <p><strong>周期：</strong>${cycleText}</p>
      <p><strong>到期日：</strong>${dueDateText}</p>
      <p><strong>提醒规则：</strong>${reminderWindowText}</p>
      <p><strong>使用人员：</strong>${userList}</p>
      <p>请及时确认是否续费。</p>
    </div>
  `;

  return {
    recipients,
    message: {
      from: process.env.SMTP_FROM,
      subject,
      text,
      html
    }
  };
}

async function sendReminderEmails(subscription) {
  if (!reminderTransporter) {
    return {
      sentCount: 0,
      skipped: '未配置 SMTP，已跳过邮件发送'
    };
  }

  const { recipients, message } = buildReminderEmail(subscription);

  if (recipients.length === 0) {
    return {
      sentCount: 0,
      skipped: '使用人员未配置邮箱，已跳过邮件发送'
    };
  }

  let sentCount = 0;

  for (const recipient of recipients) {
    await reminderTransporter.sendMail({
      ...message,
      to: recipient
    });
    sentCount += 1;
  }

  return { sentCount, skipped: null };
}

async function runReminderCheck(source = 'manual') {
  if (reminderJobRunning) {
    return {
      message: '提醒任务正在执行中，请稍后重试',
      checkedCount: 0,
      eligibleCount: 0,
      sentCount: 0,
      skippedCount: 0,
      errorCount: 0,
      details: []
    };
  }

  reminderJobRunning = true;

  try {
    const subscriptions = await prisma.subscription.findMany({
      where: { reminderEnabled: true },
      include: getSubscriptionInclude(),
      orderBy: { nextBillingDate: 'asc' }
    });

    const today = startOfTodayUtc();
    const details = [];
    let eligibleCount = 0;
    let sentCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const subscription of subscriptions) {
      const targetDate = normalizeDate(toDateKey(subscription.nextBillingDate));
      const reminderDeadline = addDays(today, subscription.reminderDays);
      const alreadySentForTarget =
        subscription.lastReminderTargetDate &&
        toDateKey(subscription.lastReminderTargetDate) === toDateKey(targetDate);

      if (targetDate < today || targetDate > reminderDeadline || alreadySentForTarget) {
        continue;
      }

      eligibleCount += 1;

      try {
        const result = await sendReminderEmails(subscription);

        if (result.sentCount > 0) {
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: {
              lastReminderSentAt: new Date(),
              lastReminderTargetDate: targetDate
            }
          });
        }

        sentCount += result.sentCount;

        if (result.skipped) {
          skippedCount += 1;
        }

        details.push({
          id: subscription.id,
          platform: subscription.platform,
          dueDate: toDateKey(targetDate),
          status: result.sentCount > 0 ? 'sent' : 'skipped',
          sentCount: result.sentCount,
          message: result.skipped || `已发送 ${result.sentCount} 封邮件`
        });
      } catch (error) {
        errorCount += 1;
        details.push({
          id: subscription.id,
          platform: subscription.platform,
          dueDate: toDateKey(targetDate),
          status: 'error',
          sentCount: 0,
          message: error.message || '邮件发送失败'
        });
      }
    }

    const message = `提醒检查完成：检查 ${subscriptions.length} 条，命中 ${eligibleCount} 条，发送 ${sentCount} 封，跳过 ${skippedCount} 条，失败 ${errorCount} 条`;

    if (source !== 'manual') {
      console.log(`[ReminderJob:${source}] ${message}`);
    }

    return {
      message,
      checkedCount: subscriptions.length,
      eligibleCount,
      sentCount,
      skippedCount,
      errorCount,
      details
    };
  } finally {
    reminderJobRunning = false;
  }
}

function toSubscriptionResponseInclude() {
  return {
    include: getSubscriptionInclude()
  };
}

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/subscriptions', async (req, res, next) => {
  try {
    const subscriptions = await prisma.subscription.findMany({
      ...toSubscriptionResponseInclude(),
      orderBy: { nextBillingDate: 'asc' }
    });

    res.json(subscriptions);
  } catch (error) {
    next(error);
  }
});

app.get('/api/subscriptions/summary', async (req, res, next) => {
  try {
    const subscriptions = await prisma.subscription.findMany();
    const monthlyTotal = subscriptions.reduce((total, subscription) => total + getMonthlyEquivalent(subscription), 0);

    res.json({
      monthlyTotal: Number(monthlyTotal.toFixed(2)),
      yearlyTotal: Number((monthlyTotal * 12).toFixed(2))
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/subscriptions', async (req, res, next) => {
  try {
    const { errors, data } = parseSubscriptionPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({ message: '请求数据校验失败', errors });
    }

    const subscription = await prisma.subscription.create({
      data: {
        platform: data.platform,
        planType: data.planType,
        price: data.price,
        billingCycle: data.billingCycle,
        nextBillingDate: data.nextBillingDate,
        reminderEnabled: data.reminderEnabled,
        reminderDays: data.reminderDays,
        users: {
          create: data.users
        }
      },
      include: getSubscriptionInclude()
    });

    return res.status(201).json(subscription);
  } catch (error) {
    return next(error);
  }
});

app.put('/api/subscriptions/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: '订阅 ID 无效' });
    }

    const { errors, data } = parseSubscriptionPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({ message: '请求数据校验失败', errors });
    }

    const subscription = await prisma.subscription.update({
      where: { id },
      data: {
        platform: data.platform,
        planType: data.planType,
        price: data.price,
        billingCycle: data.billingCycle,
        nextBillingDate: data.nextBillingDate,
        reminderEnabled: data.reminderEnabled,
        reminderDays: data.reminderDays,
        lastReminderSentAt: null,
        lastReminderTargetDate: null,
        users: {
          deleteMany: {},
          create: data.users
        }
      },
      include: getSubscriptionInclude()
    });

    return res.json(subscription);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: '订阅记录不存在或已删除' });
    }

    return next(error);
  }
});

app.post('/api/reminders/run', async (req, res, next) => {
  try {
    const result = await runReminderCheck('manual');
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

app.delete('/api/subscriptions/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: '订阅 ID 无效' });
    }

    await prisma.subscription.delete({ where: { id } });
    return res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: '订阅记录不存在或已删除' });
    }

    return next(error);
  }
});

app.use((req, res) => {
  res.status(404).json({ message: '接口不存在' });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ message: '服务器内部错误，请稍后重试' });
});

function startReminderScheduler() {
  if (reminderCheckIntervalMinutes <= 0) {
    console.log('Reminder scheduler disabled');
    return;
  }

  const intervalMs = reminderCheckIntervalMinutes * 60 * 1000;
  reminderJobTimer = setInterval(() => {
    void runReminderCheck('interval').catch((error) => {
      console.error('Reminder job failed', error);
    });
  }, intervalMs);

  void runReminderCheck('startup').catch((error) => {
    console.error('Reminder startup check failed', error);
  });
}

async function shutdown() {
  try {
    if (reminderJobTimer) {
      clearInterval(reminderJobTimer);
      reminderJobTimer = null;
    }

    await prisma.$disconnect();
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => {
  void shutdown();
});

process.on('SIGTERM', () => {
  void shutdown();
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Subscription API listening on http://localhost:${port}`);
  startReminderScheduler();
});
