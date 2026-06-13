const DEFAULT_BRAND_NAME = 'Subscription Desk';
const BRAND_NAME_SETTING_KEY = 'brandName';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ALLOWED_BILLING_CYCLES = new Set(['monthly', 'quarterly', 'yearly']);
const BILLING_CYCLE_LABELS = {
  monthly: 'monthly',
  quarterly: 'quarterly',
  yearly: 'yearly'
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return withCors(request, env, new Response(null, { status: 204 }));
    }

    const url = new URL(request.url);

    try {
      if (url.pathname === '/health') {
        return json(request, env, { ok: true });
      }

      if (url.pathname.startsWith('/api/')) {
        return await handleApiRequest(request, env);
      }

      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }

      return new Response('Static asset binding is not configured.', { status: 404 });
    } catch (error) {
      const statusCode = Number(error?.statusCode || 500);
      const message = statusCode >= 500 && !error?.statusCode ? 'Internal server error' : error.message;
      const body = Array.isArray(error?.errors) ? { message, errors: error.errors } : { message };
      console.error(error);
      return json(request, env, body, { status: statusCode });
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      runReminderCheck(env, 'cron').catch((error) => {
        console.error('Reminder cron failed', error);
      })
    );
  }
};

async function handleApiRequest(request, env) {
  const url = new URL(request.url);
  const pathname = normalizePath(url.pathname);

  if (request.method === 'GET' && pathname === '/api/settings') {
    return json(request, env, await getAppSettings(env));
  }

  if (request.method === 'PUT' && pathname === '/api/settings') {
    await requireAuth(request, env);
    return json(request, env, await updateAppSettings(request, env));
  }

  if (request.method === 'POST' && pathname === '/api/auth/login') {
    return json(request, env, await loginAdmin(request, env));
  }

  if (request.method === 'GET' && pathname === '/api/auth/session') {
    return json(request, env, await requireAuth(request, env));
  }

  if (request.method === 'GET' && pathname === '/api/subscriptions') {
    const session = await optionalAuth(request, env);
    const subscriptions = await listSubscriptions(env);
    return json(request, env, session ? subscriptions : subscriptions.map(toPublicSubscription));
  }

  if (request.method === 'GET' && pathname === '/api/subscriptions/summary') {
    return json(request, env, await getSubscriptionsSummary(env));
  }

  if (request.method === 'POST' && pathname === '/api/subscriptions') {
    await requireAuth(request, env);
    return json(request, env, await createSubscription(request, env), { status: 201 });
  }

  const subscriptionIdMatch = pathname.match(/^\/api\/subscriptions\/(\d+)$/);

  if (subscriptionIdMatch && request.method === 'PUT') {
    await requireAuth(request, env);
    return json(request, env, await updateSubscription(Number(subscriptionIdMatch[1]), request, env));
  }

  if (subscriptionIdMatch && request.method === 'DELETE') {
    await requireAuth(request, env);
    await deleteSubscription(Number(subscriptionIdMatch[1]), env);
    return withCors(request, env, new Response(null, { status: 204 }));
  }

  if (request.method === 'POST' && pathname === '/api/reminders/run') {
    await requireAuth(request, env);
    return json(request, env, await runReminderCheck(env, 'manual'));
  }

  if (request.method === 'POST' && pathname === '/api/reminders/test-email') {
    await requireAuth(request, env);
    return json(request, env, await sendTestEmail(request, env));
  }

  throw createHttpError(404, 'API route not found');
}

async function loginAdmin(request, env) {
  const body = await readJsonBody(request);
  const username = String(body?.username || '').trim();
  const password = String(body?.password || '');

  if (username !== getAdminUsername(env) || !constantTimeEqual(password, getAdminPassword(env))) {
    throw createHttpError(401, 'Invalid username or password');
  }

  return createAuthToken(username, env);
}

async function requireAuth(request, env) {
  const session = await optionalAuth(request, env);

  if (!session) {
    throw createHttpError(401, 'Please sign in again');
  }

  return session;
}

async function optionalAuth(request, env) {
  const [scheme, token] = String(request.headers.get('authorization') || '').split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return verifyAuthToken(token, env);
}

async function createAuthToken(username, env) {
  const ttlHours = Math.max(1, Number(env.AUTH_TOKEN_TTL_HOURS || 24));
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  const payload = encodeBase64UrlText(
    JSON.stringify({
      username,
      exp: expiresAt.getTime()
    })
  );
  const signature = await signTokenPayload(payload, env);

  return {
    token: `${payload}.${signature}`,
    username,
    expiresAt: expiresAt.toISOString()
  };
}

async function verifyAuthToken(token, env) {
  const [payload, signature] = String(token || '').split('.');

  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = await signTokenPayload(payload, env);

  if (!constantTimeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const session = JSON.parse(decodeBase64UrlText(payload));
    const expiresAt = Number(session.exp);

    if (
      session.username !== getAdminUsername(env) ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now()
    ) {
      return null;
    }

    return {
      username: session.username,
      expiresAt: new Date(expiresAt).toISOString()
    };
  } catch {
    return null;
  }
}

async function signTokenPayload(payload, env) {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(getAuthTokenSecret(env)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(payload));
  return bytesToBase64Url(new Uint8Array(signature));
}

function getAdminUsername(env) {
  return String(env.ADMIN_USERNAME || 'admin').trim() || 'admin';
}

function getAdminPassword(env) {
  return String(env.ADMIN_PASSWORD || 'admin123456');
}

function getAuthTokenSecret(env) {
  return String(env.AUTH_TOKEN_SECRET || 'change_this_to_a_long_random_secret');
}

async function getAppSettings(env) {
  const setting = await env.DB.prepare(
    'SELECT "value" FROM "AppSetting" WHERE "key" = ? LIMIT 1'
  )
    .bind(BRAND_NAME_SETTING_KEY)
    .first();

  return {
    brandName: setting?.value || env.BRAND_NAME || DEFAULT_BRAND_NAME
  };
}

async function updateAppSettings(request, env) {
  const body = await readJsonBody(request);
  const brandName = normalizeBrandName(body?.brandName);
  const errors = [];

  if (!brandName) errors.push('Brand name is required');
  if (brandName.length > 24) errors.push('Brand name must not exceed 24 characters');

  if (errors.length > 0) {
    throw createValidationError(errors);
  }

  const now = isoNow();

  await env.DB.prepare(
    `
      INSERT INTO "AppSetting" ("key", "value", "createdAt", "updatedAt")
      VALUES (?, ?, ?, ?)
      ON CONFLICT("key") DO UPDATE SET
        "value" = excluded."value",
        "updatedAt" = excluded."updatedAt"
    `
  )
    .bind(BRAND_NAME_SETTING_KEY, brandName, now, now)
    .run();

  return getAppSettings(env);
}

async function listSubscriptions(env) {
  const result = await env.DB.prepare(
    `
      SELECT
        "id",
        "platform",
        "planType",
        "price",
        "billingCycle",
        "nextBillingDate",
        "reminderEnabled",
        "reminderDays",
        "lastReminderSentAt",
        "lastReminderTargetDate",
        "createdAt",
        "updatedAt"
      FROM "Subscription"
      ORDER BY "nextBillingDate" ASC, "id" ASC
    `
  ).all();

  const subscriptions = (result.results || []).map(toSubscriptionRecord);

  if (subscriptions.length === 0) {
    return [];
  }

  const ids = subscriptions.map((subscription) => subscription.id);
  const placeholders = ids.map(() => '?').join(', ');
  const usersResult = await env.DB.prepare(
    `
      SELECT
        "id",
        "subscriptionId",
        "name",
        "email",
        "createdAt",
        "updatedAt"
      FROM "SubscriptionUser"
      WHERE "subscriptionId" IN (${placeholders})
      ORDER BY "id" ASC
    `
  )
    .bind(...ids)
    .all();

  const usersBySubscriptionId = new Map();

  for (const row of usersResult.results || []) {
    const user = toSubscriptionUserRecord(row);
    const users = usersBySubscriptionId.get(user.subscriptionId) || [];
    users.push(user);
    usersBySubscriptionId.set(user.subscriptionId, users);
  }

  return subscriptions.map((subscription) => ({
    ...subscription,
    users: usersBySubscriptionId.get(subscription.id) || []
  }));
}

async function getSubscriptionById(id, env) {
  const subscription = await env.DB.prepare(
    `
      SELECT
        "id",
        "platform",
        "planType",
        "price",
        "billingCycle",
        "nextBillingDate",
        "reminderEnabled",
        "reminderDays",
        "lastReminderSentAt",
        "lastReminderTargetDate",
        "createdAt",
        "updatedAt"
      FROM "Subscription"
      WHERE "id" = ?
      LIMIT 1
    `
  )
    .bind(id)
    .first();

  if (!subscription) {
    return null;
  }

  const users = await env.DB.prepare(
    `
      SELECT
        "id",
        "subscriptionId",
        "name",
        "email",
        "createdAt",
        "updatedAt"
      FROM "SubscriptionUser"
      WHERE "subscriptionId" = ?
      ORDER BY "id" ASC
    `
  )
    .bind(id)
    .all();

  return {
    ...toSubscriptionRecord(subscription),
    users: (users.results || []).map(toSubscriptionUserRecord)
  };
}

async function createSubscription(request, env) {
  const body = await readJsonBody(request);
  const { errors, data } = parseSubscriptionPayload(body);

  if (errors.length > 0) {
    throw createValidationError(errors);
  }

  const now = isoNow();
  const insertResult = await env.DB.prepare(
    `
      INSERT INTO "Subscription" (
        "platform",
        "planType",
        "price",
        "billingCycle",
        "nextBillingDate",
        "reminderEnabled",
        "reminderDays",
        "createdAt",
        "updatedAt"
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  )
    .bind(
      data.platform,
      data.planType,
      data.price,
      data.billingCycle,
      data.nextBillingDate.toISOString(),
      data.reminderEnabled ? 1 : 0,
      data.reminderDays,
      now,
      now
    )
    .run();

  const id = Number(insertResult.meta?.last_row_id);

  for (const user of data.users) {
    await insertSubscriptionUser(id, user, env, now);
  }

  return getSubscriptionById(id, env);
}

async function updateSubscription(id, request, env) {
  assertValidPositiveId(id);

  const existing = await getSubscriptionById(id, env);

  if (!existing) {
    throw createHttpError(404, 'Subscription record was not found');
  }

  const body = await readJsonBody(request);
  const { errors, data } = parseSubscriptionPayload(body);

  if (errors.length > 0) {
    throw createValidationError(errors);
  }

  const now = isoNow();

  await env.DB.prepare(
    `
      UPDATE "Subscription"
      SET
        "platform" = ?,
        "planType" = ?,
        "price" = ?,
        "billingCycle" = ?,
        "nextBillingDate" = ?,
        "reminderEnabled" = ?,
        "reminderDays" = ?,
        "lastReminderSentAt" = NULL,
        "lastReminderTargetDate" = NULL,
        "updatedAt" = ?
      WHERE "id" = ?
    `
  )
    .bind(
      data.platform,
      data.planType,
      data.price,
      data.billingCycle,
      data.nextBillingDate.toISOString(),
      data.reminderEnabled ? 1 : 0,
      data.reminderDays,
      now,
      id
    )
    .run();

  await env.DB.prepare('DELETE FROM "SubscriptionUser" WHERE "subscriptionId" = ?').bind(id).run();

  for (const user of data.users) {
    await insertSubscriptionUser(id, user, env, now);
  }

  return getSubscriptionById(id, env);
}

async function deleteSubscription(id, env) {
  assertValidPositiveId(id);

  const result = await env.DB.prepare('DELETE FROM "Subscription" WHERE "id" = ?').bind(id).run();

  if (!result.meta?.changes) {
    throw createHttpError(404, 'Subscription record was not found');
  }
}

async function insertSubscriptionUser(subscriptionId, user, env, now = isoNow()) {
  await env.DB.prepare(
    `
      INSERT INTO "SubscriptionUser" (
        "subscriptionId",
        "name",
        "email",
        "createdAt",
        "updatedAt"
      )
      VALUES (?, ?, ?, ?, ?)
    `
  )
    .bind(subscriptionId, user.name, user.email || null, now, now)
    .run();
}

async function getSubscriptionsSummary(env) {
  const subscriptions = await listSubscriptions(env);
  const monthlyTotal = subscriptions.reduce((total, subscription) => {
    return total + getMonthlyEquivalent(subscription);
  }, 0);

  return {
    monthlyTotal: Number(monthlyTotal.toFixed(2)),
    yearlyTotal: Number((monthlyTotal * 12).toFixed(2))
  };
}

function parseSubscriptionPayload(body) {
  const platform = String(body?.platform || '').trim();
  const planType = String(body?.planType || '').trim();
  const billingCycle = String(body?.billingCycle || '').trim();
  const price = Number(body?.price);
  const nextBillingDate = normalizeDate(body?.nextBillingDate);
  const reminderEnabled = parseBoolean(body?.reminderEnabled);
  const reminderDays = Number(body?.reminderDays ?? 3);

  const errors = [];
  const users = normalizeUsers(body?.users, errors);

  if (!platform) errors.push('Platform name is required');
  if (!planType) errors.push('Plan type is required');
  if (!Number.isFinite(price) || price < 0) errors.push('Price must be a number greater than or equal to 0');
  if (!ALLOWED_BILLING_CYCLES.has(billingCycle)) errors.push('Billing cycle must be monthly, quarterly, or yearly');
  if (!body?.nextBillingDate || Number.isNaN(nextBillingDate.getTime())) errors.push('Next billing date is invalid');
  if (!Number.isInteger(reminderDays) || reminderDays < 0 || reminderDays > 365) {
    errors.push('Reminder days must be an integer from 0 to 365');
  }

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

function normalizeUsers(inputUsers, errors) {
  if (inputUsers == null) return [];

  if (!Array.isArray(inputUsers)) {
    errors.push('Users must be an array');
    return [];
  }

  return inputUsers
    .map((user, index) => {
      const name = String(user?.name || '').trim();
      const email = String(user?.email || '').trim().toLowerCase();
      const isEmpty = !name && !email;

      if (isEmpty) return null;
      if (!name) errors.push(`User ${index + 1} name is required`);
      if (email && !isValidEmail(email)) errors.push(`User ${index + 1} email is invalid`);

      return {
        name,
        email: email || null
      };
    })
    .filter(Boolean);
}

async function runReminderCheck(env, source = 'manual') {
  const subscriptions = await listSubscriptions(env);
  const today = startOfTodayUtc();
  const details = [];
  let eligibleCount = 0;
  let sentCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const subscription of subscriptions) {
    if (!subscription.reminderEnabled) {
      continue;
    }

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
      const result = await sendReminderEmails(subscription, env);

      if (result.sentCount > 0) {
        await env.DB.prepare(
          `
            UPDATE "Subscription"
            SET
              "lastReminderSentAt" = ?,
              "lastReminderTargetDate" = ?,
              "updatedAt" = ?
            WHERE "id" = ?
          `
        )
          .bind(isoNow(), targetDate.toISOString(), isoNow(), subscription.id)
          .run();
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
        message: result.skipped || `Sent ${result.sentCount} email(s)`
      });
    } catch (error) {
      errorCount += 1;
      details.push({
        id: subscription.id,
        platform: subscription.platform,
        dueDate: toDateKey(targetDate),
        status: 'error',
        sentCount: 0,
        message: error.message || 'Email send failed'
      });
    }
  }

  const message = `Reminder check finished: checked ${subscriptions.length}, matched ${eligibleCount}, sent ${sentCount}, skipped ${skippedCount}, failed ${errorCount}`;

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
}

async function sendTestEmail(request, env) {
  const body = await readJsonBody(request);
  const recipient = String(body?.to || env.EMAIL_TEST_TO || env.EMAIL_TO || '').trim();

  if (!isEmailConfigured(env)) {
    throw createHttpError(400, getEmailDisabledReason(env));
  }

  if (!isValidEmail(recipient)) {
    throw createHttpError(400, 'A valid test recipient is required. Set EMAIL_TEST_TO or pass { "to": "you@example.com" }.');
  }

  await sendEmail(
    {
      to: recipient,
      subject: '[sub] Test email',
      text: 'This is a test email from the Cloudflare Workers version of sub.',
      html: '<p>This is a test email from the Cloudflare Workers version of sub.</p>'
    },
    env
  );

  return {
    to: recipient,
    message: `Test email was sent to ${recipient}`
  };
}

async function sendReminderEmails(subscription, env) {
  if (!isEmailConfigured(env)) {
    return {
      sentCount: 0,
      skipped: getEmailDisabledReason(env)
    };
  }

  const { recipients, message } = buildReminderEmail(subscription);

  if (recipients.length === 0) {
    return {
      sentCount: 0,
      skipped: 'No user email addresses are configured for this subscription'
    };
  }

  let sentCount = 0;

  for (const recipient of recipients) {
    await sendEmail({ ...message, to: recipient }, env);
    sentCount += 1;
  }

  return { sentCount, skipped: null };
}

function buildReminderEmail(subscription) {
  const dueDateText = formatReminderDate(subscription.nextBillingDate);
  const cycleText = getBillingCycleLabel(subscription.billingCycle);
  const recipients = [...new Set(subscription.users.map((user) => user.email).filter(Boolean))];
  const subject = `[Subscription reminder] ${subscription.platform} renews on ${dueDateText}`;
  const reminderWindowText =
    subscription.reminderDays === 0 ? 'Reminder on the due date' : `Reminder ${subscription.reminderDays} day(s) before due date`;

  const text = [
    'Subscription renewal reminder',
    '',
    `Platform: ${subscription.platform}`,
    `Plan: ${subscription.planType}`,
    `Price: ${subscription.price}`,
    `Billing cycle: ${cycleText}`,
    `Due date: ${dueDateText}`,
    `Rule: ${reminderWindowText}`,
    '',
    'Please confirm whether this subscription should renew.'
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.7;">
      <h2 style="margin-bottom: 12px;">Subscription renewal reminder</h2>
      <p><strong>Platform:</strong> ${escapeHtml(subscription.platform)}</p>
      <p><strong>Plan:</strong> ${escapeHtml(subscription.planType)}</p>
      <p><strong>Price:</strong> ${escapeHtml(String(subscription.price))}</p>
      <p><strong>Billing cycle:</strong> ${escapeHtml(cycleText)}</p>
      <p><strong>Due date:</strong> ${escapeHtml(dueDateText)}</p>
      <p><strong>Rule:</strong> ${escapeHtml(reminderWindowText)}</p>
      <p>Please confirm whether this subscription should renew.</p>
    </div>
  `;

  return {
    recipients,
    message: {
      subject,
      text,
      html
    }
  };
}

async function sendEmail(message, env) {
  const provider = getEmailProvider(env);

  if (provider === 'resend') {
    return sendResendEmail(message, env);
  }

  if (provider === 'sendgrid') {
    return sendSendGridEmail(message, env);
  }

  throw createHttpError(400, getEmailDisabledReason(env));
}

async function sendResendEmail(message, env) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html
    })
  });

  if (!response.ok) {
    throw createHttpError(502, `Resend request failed: ${await readResponseText(response)}`);
  }
}

async function sendSendGridEmail(message, env) {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: message.to }]
        }
      ],
      from: { email: env.EMAIL_FROM },
      subject: message.subject,
      content: [
        {
          type: 'text/plain',
          value: message.text
        },
        {
          type: 'text/html',
          value: message.html
        }
      ]
    })
  });

  if (!response.ok) {
    throw createHttpError(502, `SendGrid request failed: ${await readResponseText(response)}`);
  }
}

function getEmailProvider(env) {
  const configuredProvider = String(env.EMAIL_PROVIDER || '').trim().toLowerCase();

  if (configuredProvider) {
    return configuredProvider;
  }

  if (env.RESEND_API_KEY) return 'resend';
  if (env.SENDGRID_API_KEY) return 'sendgrid';
  return '';
}

function isEmailConfigured(env) {
  const provider = getEmailProvider(env);

  if (!env.EMAIL_FROM || !isValidEmail(env.EMAIL_FROM)) {
    return false;
  }

  if (provider === 'resend') return Boolean(env.RESEND_API_KEY);
  if (provider === 'sendgrid') return Boolean(env.SENDGRID_API_KEY);

  return false;
}

function getEmailDisabledReason(env) {
  const provider = getEmailProvider(env);

  if (!provider) {
    return 'Email provider is not configured. Set EMAIL_PROVIDER plus a provider API key, or set RESEND_API_KEY / SENDGRID_API_KEY.';
  }

  if (!env.EMAIL_FROM || !isValidEmail(env.EMAIL_FROM)) {
    return 'EMAIL_FROM must be a valid sender address.';
  }

  if (provider === 'resend' && !env.RESEND_API_KEY) {
    return 'RESEND_API_KEY is required for Resend.';
  }

  if (provider === 'sendgrid' && !env.SENDGRID_API_KEY) {
    return 'SENDGRID_API_KEY is required for SendGrid.';
  }

  return `Unsupported EMAIL_PROVIDER: ${provider}`;
}

function toSubscriptionRecord(row) {
  return {
    id: Number(row.id),
    platform: row.platform,
    planType: row.planType,
    price: Number(row.price),
    billingCycle: row.billingCycle,
    nextBillingDate: row.nextBillingDate,
    reminderEnabled: Boolean(row.reminderEnabled),
    reminderDays: Number(row.reminderDays),
    lastReminderSentAt: row.lastReminderSentAt || null,
    lastReminderTargetDate: row.lastReminderTargetDate || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function toSubscriptionUserRecord(row) {
  return {
    id: Number(row.id),
    subscriptionId: Number(row.subscriptionId),
    name: row.name,
    email: row.email || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function toPublicSubscription(subscription) {
  return {
    ...subscription,
    lastReminderSentAt: null,
    lastReminderTargetDate: null,
    users: subscription.users.map((user) => ({
      id: user.id,
      subscriptionId: user.subscriptionId,
      name: user.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }))
  };
}

function getMonthlyEquivalent(subscription) {
  if (subscription.billingCycle === 'yearly') return subscription.price / 12;
  if (subscription.billingCycle === 'quarterly') return subscription.price / 3;
  return subscription.price;
}

function getBillingCycleLabel(billingCycle) {
  return BILLING_CYCLE_LABELS[billingCycle] || billingCycle;
}

async function readJsonBody(request) {
  const text = await request.text();

  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    throw createHttpError(400, 'Request body must be valid JSON');
  }
}

async function readResponseText(response) {
  const text = await response.text();
  return text.replace(/\s+/g, ' ').trim().slice(0, 300) || `${response.status} ${response.statusText}`;
}

function normalizePath(pathname) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

function normalizeBrandName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeDate(value) {
  const raw = String(value || '').trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T00:00:00.000Z`);
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return date;
  }

  return new Date(`${date.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function toDateKey(value) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function startOfTodayUtc() {
  return normalizeDate(new Date().toISOString().slice(0, 10));
}

function addDays(date, days) {
  return new Date(date.getTime() + days * ONE_DAY_MS);
}

function formatReminderDate(value) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(value));
}

function parseBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1' || value === 'on';
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
}

function isoNow() {
  return new Date().toISOString();
}

function assertValidPositiveId(id) {
  if (!Number.isInteger(id) || id <= 0) {
    throw createHttpError(400, 'Subscription ID is invalid');
  }
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function createValidationError(errors) {
  return Object.assign(createHttpError(400, 'Request validation failed'), { errors });
}

function json(request, env, body, init = {}) {
  const response = new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(init.headers || {})
    }
  });

  return withCors(request, env, response);
}

function withCors(request, env, response) {
  const origin = request.headers.get('origin');
  const allowedOrigin = String(env.FRONTEND_ORIGIN || '').trim();
  const responseHeaders = new Headers(response.headers);

  if (origin && (!allowedOrigin || allowedOrigin === '*' || origin === allowedOrigin || origin === new URL(request.url).origin)) {
    responseHeaders.set('Access-Control-Allow-Origin', origin);
    responseHeaders.set('Vary', 'Origin');
  }

  responseHeaders.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  responseHeaders.set('Access-Control-Max-Age', '86400');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders
  });
}

function bytesToBase64Url(bytes) {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const base64 = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function encodeBase64UrlText(value) {
  return bytesToBase64Url(textEncoder.encode(value));
}

function decodeBase64UrlText(value) {
  return textDecoder.decode(base64UrlToBytes(value));
}

function constantTimeEqual(left, right) {
  const leftBytes = textEncoder.encode(String(left || ''));
  const rightBytes = textEncoder.encode(String(right || ''));
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] || 0) ^ (rightBytes[index] || 0);
  }

  return difference === 0;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
