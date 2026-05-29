<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import {
  clearAuthSession,
  createSubscription,
  deleteSubscription,
  fetchSubscriptions,
  getApiErrorMessage,
  getStoredAdminUsername,
  getStoredAuthToken,
  isUnauthorizedError,
  loginAdmin,
  runReminderCheck,
  sendTestEmail,
  updateSubscription,
  verifyAdminSession
} from './api';

const THEME_STORAGE_KEY = 'sub.theme.mode';
const BRAND_NAME = '续费管家';
const themeModes = [
  { value: 'system', label: '跟随系统', icon: '◐' },
  { value: 'light', label: '白天', icon: '☀' },
  { value: 'dark', label: '夜间', icon: '☾' }
];
const customPlatformIconPaths = [
  'M7 7h10v10H7z',
  'M4 4h16v16H4z',
  'M9 11h6',
  'M9 15h4'
];
const platformNameOptions = [
  {
    name: 'ChatGPT',
    tone: 'tone-green',
    iconPaths: [
      'M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3z',
      'M5 15l.9 2.1L8 18l-2.1.9L5 21l-.9-2.1L2 18l2.1-.9L5 15z',
      'M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14z'
    ]
  },
  {
    name: 'Netflix',
    tone: 'tone-red',
    iconPaths: [
      'M4 6h16v12H4z',
      'M8 6v12',
      'M16 6v12',
      'M4 10h4',
      'M16 10h4',
      'M4 14h4',
      'M16 14h4'
    ]
  },
  {
    name: 'YouTube Premium',
    tone: 'tone-red',
    iconPaths: ['M5 7.5h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2z', 'M10 9.5l5 2.5-5 2.5z']
  },
  {
    name: 'Spotify',
    tone: 'tone-green',
    iconPaths: ['M7 10.5c3.7-1 7-.7 10 1', 'M8 14c2.8-.7 5.3-.5 7.7.8', 'M9 17c2-.4 3.7-.2 5.4.6', 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z']
  },
  {
    name: 'Apple iCloud',
    tone: 'tone-blue',
    iconPaths: ['M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.3 1.6A3.5 3.5 0 0 0 7 18z']
  },
  {
    name: 'GitHub',
    tone: 'tone-dark',
    iconPaths: ['M8 9l-4 3 4 3', 'M16 9l4 3-4 3', 'M14 5l-4 14']
  },
  {
    name: 'Adobe',
    tone: 'tone-red',
    iconPaths: ['M12 4l8 16h-4l-4-8-4 8H4l8-16z', 'M10 16h4']
  },
  {
    name: '腾讯视频',
    tone: 'tone-blue',
    iconPaths: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M10 8l6 4-6 4z']
  },
  {
    name: '爱奇艺',
    tone: 'tone-green',
    iconPaths: ['M5 6h14v12H5z', 'M9 10h6', 'M9 14h6', 'M7 4h10', 'M7 20h10']
  },
  {
    name: '优酷',
    tone: 'tone-blue',
    iconPaths: ['M5 8l5 4-5 4z', 'M13 8l5 4-5 4z']
  },
  {
    name: '哔哩哔哩',
    tone: 'tone-pink',
    iconPaths: ['M6 8h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z', 'M8 5l2 3', 'M16 5l-2 3', 'M9 13h.01', 'M15 13h.01']
  },
  {
    name: 'WPS',
    tone: 'tone-orange',
    iconPaths: ['M7 3h7l4 4v14H7z', 'M14 3v5h5', 'M9 13h7', 'M9 17h5']
  }
];

const isAdminRoute = ref(window.location.pathname.replace(/\/+$/, '') === '/admin');
const isAuthenticated = ref(Boolean(getStoredAuthToken()));
const sessionChecking = ref(isAdminRoute.value);
const adminUsername = ref(getStoredAdminUsername());
const loginSubmitting = ref(false);
const loginError = ref('');
const subscriptions = ref([]);
const loading = ref(false);
const submitting = ref(false);
const deletingId = ref(null);
const editingId = ref(null);
const subscriptionDialogOpen = ref(false);
const platformDropdownOpen = ref(false);
const actionResultDialogOpen = ref(false);
const actionResultDialog = reactive({
  title: '',
  message: '',
  status: 'success',
  details: []
});
const reminderRunning = ref(false);
const testEmailSending = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const reminderDetails = ref([]);
const systemPrefersDark = ref(false);
const themeMode = ref(readStoredThemeMode());

let systemThemeQuery = null;

const loginForm = reactive({
  username: adminUsername.value || 'admin',
  password: ''
});

function createEmptyUser() {
  return {
    name: '',
    email: ''
  };
}

const form = reactive({
  platform: '',
  planType: '',
  price: '',
  billingCycle: 'monthly',
  nextBillingDate: '',
  reminderEnabled: false,
  reminderDays: 3,
  users: [createEmptyUser()]
});

const currencyFormatter = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  minimumFractionDigits: 2
});

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC'
});

const billingCycleMeta = {
  monthly: {
    label: '月付',
    tagClass: 'tag-blue',
    monthlyDivisor: 1
  },
  quarterly: {
    label: '季付',
    tagClass: 'tag-green',
    monthlyDivisor: 3
  },
  yearly: {
    label: '年付',
    tagClass: 'tag-indigo',
    monthlyDivisor: 12
  }
};

const resolvedTheme = computed(() => {
  if (themeMode.value === 'system') {
    return systemPrefersDark.value ? 'dark' : 'light';
  }

  return themeMode.value;
});

const themeModeLabel = computed(() => {
  return themeModes.find((mode) => mode.value === themeMode.value)?.label || '跟随系统';
});

const monthlyTotal = computed(() => {
  return subscriptions.value.reduce((total, subscription) => {
    return total + getMonthlyEquivalent(subscription);
  }, 0);
});

const yearlyTotal = computed(() => monthlyTotal.value * 12);

const upcomingCount = computed(() => {
  const now = new Date();
  const nextThirtyDays = new Date(now);
  nextThirtyDays.setDate(now.getDate() + 30);
  const todayKey = getLocalDateKey(now);
  const nextThirtyDaysKey = getLocalDateKey(nextThirtyDays);

  return subscriptions.value.filter((subscription) => {
    const billingDateKey = getDateOnlyKey(subscription.nextBillingDate);
    return billingDateKey >= todayKey && billingDateKey <= nextThirtyDaysKey;
  }).length;
});

const reminderEnabledCount = computed(() => {
  return subscriptions.value.filter((subscription) => subscription.reminderEnabled).length;
});

const isEditing = computed(() => editingId.value !== null);

const subscriptionDialogTitle = computed(() => (isEditing.value ? '修改订阅' : '新增订阅'));

const subscriptionDialogSubmitLabel = computed(() => {
  if (submitting.value) return '提交中...';
  return isEditing.value ? '保存修改' : '添加订阅';
});

const selectedPlatformOption = computed(() => {
  return platformNameOptions.find((platform) => platform.name === form.platform);
});

const dashboardStats = computed(() => [
  {
    label: '本月预估',
    value: formatCurrency(monthlyTotal.value),
    note: '已按月均摊',
    accent: 'accent-blue'
  },
  {
    label: '全年预估',
    value: formatCurrency(yearlyTotal.value),
    note: '当前组合估算',
    accent: 'accent-indigo'
  },
  {
    label: '30 天内扣费',
    value: `${upcomingCount.value} 项`,
    note: '按下次扣费日',
    accent: 'accent-green'
  },
  {
    label: '已启用提醒',
    value: `${reminderEnabledCount.value} 项`,
    note: '邮件提醒规则',
    accent: 'accent-amber'
  }
]);

function readStoredThemeMode() {
  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return themeModes.some((mode) => mode.value === storedTheme) ? storedTheme : 'system';
  } catch {
    return 'system';
  }
}

function writeStoredThemeMode(value) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, value);
  } catch {
    // Theme persistence is optional.
  }
}

function setThemeMode(value) {
  themeMode.value = value;
  writeStoredThemeMode(value);
}

function setupSystemTheme() {
  if (!window.matchMedia) {
    systemPrefersDark.value = false;
    return;
  }

  systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  systemPrefersDark.value = systemThemeQuery.matches;

  const handleChange = (event) => {
    systemPrefersDark.value = event.matches;
  };

  systemThemeQuery.addEventListener?.('change', handleChange);
  systemThemeQuery.addListener?.(handleChange);

  onBeforeUnmount(() => {
    systemThemeQuery?.removeEventListener?.('change', handleChange);
    systemThemeQuery?.removeListener?.(handleChange);
  });
}

function getDateOnlyKey(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

function getLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatCurrency(value) {
  return currencyFormatter.format(value || 0);
}

function formatDate(value) {
  const dateKey = getDateOnlyKey(value);

  if (!dateKey) return '-';

  return dateFormatter.format(new Date(`${dateKey}T00:00:00.000Z`));
}

function getBillingCycleMeta(billingCycle) {
  return billingCycleMeta[billingCycle] || billingCycleMeta.monthly;
}

function getBillingCycleLabel(billingCycle) {
  return getBillingCycleMeta(billingCycle).label;
}

function getBillingCycleTagClass(billingCycle) {
  return getBillingCycleMeta(billingCycle).tagClass;
}

function getMonthlyEquivalent(subscription) {
  const divisor = getBillingCycleMeta(subscription.billingCycle).monthlyDivisor;
  return subscription.price / divisor;
}

function formatReminderStatus(subscription) {
  if (!subscription.reminderEnabled) return '未启用提醒';
  if (subscription.lastReminderSentAt) {
    return `已提醒 ${formatDate(subscription.lastReminderSentAt)}`;
  }
  return `提前 ${subscription.reminderDays} 天提醒`;
}

function getReminderDetailClass(status) {
  if (status === 'sent') return 'notice-success';
  if (status === 'error') return 'notice-error';
  return 'notice-warning';
}

function applySession(session) {
  isAuthenticated.value = true;
  adminUsername.value = session.username || loginForm.username;
  loginForm.username = adminUsername.value;
  loginForm.password = '';
  loginError.value = '';
}

function handleUnauthorized(error) {
  if (!isUnauthorizedError(error)) return false;

  clearAuthSession();
  isAuthenticated.value = false;
  subscriptions.value = [];
  loginError.value = getApiErrorMessage(error);
  return true;
}

function setUsers(users = []) {
  const nextUsers = users.length > 0 ? users : [createEmptyUser()];
  form.users.splice(
    0,
    form.users.length,
    ...nextUsers.map((user) => ({
      name: user.name || '',
      email: user.email || ''
    }))
  );
}

function resetForm() {
  editingId.value = null;
  form.platform = '';
  form.planType = '';
  form.price = '';
  form.billingCycle = 'monthly';
  form.nextBillingDate = '';
  form.reminderEnabled = false;
  form.reminderDays = 3;
  setUsers();
}

function buildPayload() {
  return {
    platform: form.platform,
    planType: form.planType,
    price: Number(form.price),
    billingCycle: form.billingCycle,
    nextBillingDate: form.nextBillingDate,
    reminderEnabled: form.reminderEnabled,
    reminderDays: Number(form.reminderDays),
    users: form.users
      .map((user) => ({
        name: user.name.trim(),
        email: user.email.trim()
      }))
      .filter((user) => user.name || user.email)
  };
}

function fillForm(subscription) {
  editingId.value = subscription.id;
  form.platform = subscription.platform;
  form.planType = subscription.planType;
  form.price = subscription.price;
  form.billingCycle = subscription.billingCycle;
  form.nextBillingDate = getDateOnlyKey(subscription.nextBillingDate);
  form.reminderEnabled = subscription.reminderEnabled;
  form.reminderDays = subscription.reminderDays;
  setUsers(subscription.users || []);
}

function openCreateSubscriptionDialog() {
  resetForm();
  platformDropdownOpen.value = false;
  subscriptionDialogOpen.value = true;
}

function openEditSubscriptionDialog(subscription) {
  fillForm(subscription);
  platformDropdownOpen.value = false;
  subscriptionDialogOpen.value = true;
}

function closeSubscriptionDialog() {
  if (submitting.value) return;
  subscriptionDialogOpen.value = false;
  platformDropdownOpen.value = false;
  resetForm();
}

function handleSubscriptionDialogKeydown(event) {
  if (event.key === 'Escape') {
    closeSubscriptionDialog();
  }
}

function openActionResultDialog({ title, message, status = 'success', details = [] }) {
  actionResultDialog.title = title;
  actionResultDialog.message = message;
  actionResultDialog.status = status;
  actionResultDialog.details = Array.isArray(details) ? details : [];
  actionResultDialogOpen.value = true;
}

function closeActionResultDialog() {
  actionResultDialogOpen.value = false;
  actionResultDialog.details = [];
}

function handleActionResultDialogKeydown(event) {
  if (event.key === 'Escape') {
    closeActionResultDialog();
  }
}

function togglePlatformDropdown() {
  platformDropdownOpen.value = !platformDropdownOpen.value;
}

function selectPlatformName(platformName = '') {
  if (!platformName) return;
  form.platform = platformName;
  platformDropdownOpen.value = false;
}

function addUser() {
  form.users.push(createEmptyUser());
}

function removeUser(index) {
  if (form.users.length === 1) {
    form.users.splice(0, 1, createEmptyUser());
    return;
  }

  form.users.splice(index, 1);
}

async function loadSubscriptions() {
  loading.value = true;
  errorMessage.value = '';

  try {
    subscriptions.value = await fetchSubscriptions({
      publicOnly: !isAdminRoute.value || !isAuthenticated.value
    });
  } catch (error) {
    if (isAdminRoute.value && handleUnauthorized(error)) return;
    errorMessage.value = getApiErrorMessage(error);
  } finally {
    loading.value = false;
  }
}

async function handleSubmit() {
  submitting.value = true;
  errorMessage.value = '';
  successMessage.value = '';
  reminderDetails.value = [];

  try {
    if (isEditing.value) {
      await updateSubscription(editingId.value, buildPayload());
      successMessage.value = '订阅已更新';
    } else {
      await createSubscription(buildPayload());
      successMessage.value = '订阅已添加';
    }

    subscriptionDialogOpen.value = false;
    resetForm();
    await loadSubscriptions();
  } catch (error) {
    if (handleUnauthorized(error)) return;
    errorMessage.value = getApiErrorMessage(error);
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(subscription) {
  const confirmed = window.confirm(`确认删除 ${subscription.platform} 的订阅吗？`);
  if (!confirmed) return;

  deletingId.value = subscription.id;
  errorMessage.value = '';
  successMessage.value = '';
  reminderDetails.value = [];

  try {
    await deleteSubscription(subscription.id);

    if (editingId.value === subscription.id) {
      subscriptionDialogOpen.value = false;
      resetForm();
    }

    successMessage.value = '订阅已删除';
    await loadSubscriptions();
  } catch (error) {
    if (handleUnauthorized(error)) return;
    errorMessage.value = getApiErrorMessage(error);
  } finally {
    deletingId.value = null;
  }
}

async function handleRunReminderCheck() {
  reminderRunning.value = true;
  errorMessage.value = '';
  successMessage.value = '';
  reminderDetails.value = [];

  try {
    const result = await runReminderCheck();
    const details = Array.isArray(result.details) ? result.details : [];
    openActionResultDialog({
      title: '到期提醒执行结果',
      message: result.message,
      status: result.errorCount > 0 ? 'error' : 'success',
      details
    });
    await loadSubscriptions();
  } catch (error) {
    if (handleUnauthorized(error)) return;
    openActionResultDialog({
      title: '到期提醒执行失败',
      message: getApiErrorMessage(error),
      status: 'error'
    });
  } finally {
    reminderRunning.value = false;
  }
}

async function handleSendTestEmail() {
  testEmailSending.value = true;
  errorMessage.value = '';
  successMessage.value = '';
  reminderDetails.value = [];

  try {
    const result = await sendTestEmail();
    openActionResultDialog({
      title: '测试邮件发送结果',
      message: result.message || '测试邮件已发送',
      status: 'success'
    });
  } catch (error) {
    if (handleUnauthorized(error)) return;
    openActionResultDialog({
      title: '测试邮件发送失败',
      message: getApiErrorMessage(error),
      status: 'error'
    });
  } finally {
    testEmailSending.value = false;
  }
}

async function handleLogin() {
  loginSubmitting.value = true;
  loginError.value = '';

  try {
    const session = await loginAdmin({
      username: loginForm.username,
      password: loginForm.password
    });

    applySession(session);
    await loadSubscriptions();
  } catch (error) {
    loginError.value = getApiErrorMessage(error);
  } finally {
    loginSubmitting.value = false;
  }
}

function handleLogout() {
  clearAuthSession();
  isAuthenticated.value = false;
  subscriptions.value = [];
  resetForm();
  errorMessage.value = '';
  successMessage.value = '';
  reminderDetails.value = [];
}

function goToAdmin() {
  window.location.href = '/admin';
}

function goToPublic() {
  window.location.href = '/';
}

async function initializePublicPage() {
  sessionChecking.value = false;
  await loadSubscriptions();
}

async function initializeAdminPage() {
  if (!getStoredAuthToken()) {
    sessionChecking.value = false;
    return;
  }

  try {
    const session = await verifyAdminSession();
    applySession(session);
    await loadSubscriptions();
  } catch (error) {
    if (!handleUnauthorized(error)) {
      clearAuthSession();
      isAuthenticated.value = false;
      subscriptions.value = [];
      loginError.value = getApiErrorMessage(error);
    }
  } finally {
    sessionChecking.value = false;
  }
}

onMounted(() => {
  setupSystemTheme();

  if (isAdminRoute.value) {
    void initializeAdminPage();
    return;
  }

  void initializePublicPage();
});
</script>

<template>
  <div class="app-shell" :data-theme="resolvedTheme">
    <div class="page-shell">
      <header class="topbar">
        <button class="brand-lockup" type="button" @click="goToPublic">
          <span class="brand-mark">续</span>
          <span>
            <span class="brand-name">{{ BRAND_NAME }}</span>
            <span class="brand-subtitle">Subscription Desk</span>
          </span>
        </button>

        <div class="topbar-actions">
          <template v-if="isAdminRoute && isAuthenticated">
            <span class="account-pill">{{ adminUsername }}</span>
            <button class="btn btn-secondary" type="button" :disabled="reminderRunning" @click="handleRunReminderCheck">
              {{ reminderRunning ? '提醒执行中...' : '执行到期提醒' }}
            </button>
            <button class="btn btn-secondary" type="button" :disabled="testEmailSending" @click="handleSendTestEmail">
              {{ testEmailSending ? '发送中...' : '发送测试邮件' }}
            </button>
            <button class="btn btn-secondary" type="button" @click="loadSubscriptions">
              刷新列表
            </button>
            <button class="btn btn-danger" type="button" @click="handleLogout">
              退出登录
            </button>
          </template>

          <div class="theme-switch" role="group" :aria-label="`主题：${themeModeLabel}`">
            <button
              v-for="mode in themeModes"
              :key="mode.value"
              class="theme-option"
              :class="{ active: themeMode === mode.value }"
              :title="mode.label"
              :aria-label="mode.label"
              type="button"
              @click="setThemeMode(mode.value)"
            >
              <span aria-hidden="true">{{ mode.icon }}</span>
            </button>
          </div>

          <button v-if="!isAdminRoute" class="btn btn-primary" type="button" @click="goToAdmin">
            管理后台
          </button>
          <button v-else class="btn btn-secondary" type="button" @click="goToPublic">
            展示页
          </button>
        </div>
      </header>

      <main v-if="!isAdminRoute" class="page-content">
        <div v-if="errorMessage" class="notice notice-error">
          {{ errorMessage }}
        </div>

        <section class="content-grid">
          <div class="panel data-panel">
            <div class="panel-header list-header">
              <h2>订阅</h2>
              <div class="panel-actions">
                <span class="count-pill">{{ subscriptions.length }} 项</span>
                <button class="btn btn-secondary" type="button" @click="loadSubscriptions">
                  刷新
                </button>
              </div>
            </div>

            <div v-if="loading" class="empty-state">
              正在加载订阅数据...
            </div>

            <div v-else-if="subscriptions.length === 0" class="empty-state">
              <strong>暂无订阅记录</strong>
              <span>进入管理后台添加第一条订阅后，这里会自动展示。</span>
            </div>

            <div v-else class="subscription-table">
              <article v-for="subscription in subscriptions" :key="subscription.id" class="subscription-row">
                <div class="subscription-main">
                  <span class="platform-dot">{{ subscription.platform.slice(0, 1).toUpperCase() }}</span>
                  <div>
                    <div class="title-line">
                      <h3>{{ subscription.platform }}</h3>
                      <span class="tag" :class="getBillingCycleTagClass(subscription.billingCycle)">
                        {{ getBillingCycleLabel(subscription.billingCycle) }}
                      </span>
                    </div>
                    <p>{{ subscription.planType }}</p>
                  </div>
                </div>

                <div class="row-metric">
                  <span>价格</span>
                  <strong>{{ formatCurrency(subscription.price) }}</strong>
                </div>
                <div class="row-metric">
                  <span>月均</span>
                  <strong>{{ formatCurrency(getMonthlyEquivalent(subscription)) }}</strong>
                </div>
                <div class="row-metric">
                  <span>下次扣费</span>
                  <strong>{{ formatDate(subscription.nextBillingDate) }}</strong>
                </div>
                <div class="row-metric">
                  <span>使用人员</span>
                  <strong>{{ subscription.users.length }} 人</strong>
                </div>
              </article>
            </div>
          </div>

        </section>
      </main>

      <main v-else-if="sessionChecking" class="center-screen">
        <div class="panel login-card">
          <span class="eyebrow">sub</span>
          <p class="muted-text">正在校验登录状态...</p>
        </div>
      </main>

      <main v-else-if="!isAuthenticated" class="center-screen">
        <section class="panel login-card">
          <div class="panel-header">
            <div>
              <span class="section-kicker">Admin</span>
              <h1>管理登录</h1>
            </div>
          </div>

          <div v-if="loginError" class="notice notice-error">
            {{ loginError }}
          </div>

          <form class="form-stack" @submit.prevent="handleLogin">
            <label class="field">
              <span>账号</span>
              <input v-model.trim="loginForm.username" autocomplete="username" placeholder="admin" required />
            </label>

            <label class="field">
              <span>密码</span>
              <input v-model="loginForm.password" autocomplete="current-password" placeholder="请输入密码" required type="password" />
            </label>

            <button class="btn btn-primary full-width" :disabled="loginSubmitting" type="submit">
              {{ loginSubmitting ? '登录中...' : '登录' }}
            </button>
          </form>
        </section>
      </main>

      <main v-else class="page-content">
        <section class="stats-grid">
          <article v-for="stat in dashboardStats" :key="stat.label" class="stat-card" :class="stat.accent">
            <span>{{ stat.label }}</span>
            <strong>{{ stat.value }}</strong>
            <small>{{ stat.note }}</small>
          </article>
        </section>

        <div v-if="errorMessage" class="notice notice-error">
          {{ errorMessage }}
        </div>
        <div v-if="successMessage" class="notice notice-success">
          {{ successMessage }}
        </div>

        <section class="admin-workspace">
          <div class="panel data-panel">
            <div class="panel-header list-header">
              <h2>订阅</h2>
              <div class="panel-actions">
                <span class="count-pill">{{ subscriptions.length }} 项</span>
                <button class="btn btn-primary" type="button" @click="openCreateSubscriptionDialog">
                  添加订阅
                </button>
              </div>
            </div>

            <div v-if="loading" class="empty-state">
              正在加载订阅数据...
            </div>

            <div v-else-if="subscriptions.length === 0" class="empty-state">
              <strong>暂无订阅记录</strong>
              <button class="btn btn-primary" type="button" @click="openCreateSubscriptionDialog">
                添加订阅
              </button>
            </div>

            <div v-else class="admin-record-list">
              <article v-for="subscription in subscriptions" :key="subscription.id" class="record-card">
                <div class="record-card-header">
                  <div>
                    <div class="title-line">
                      <h3>{{ subscription.platform }}</h3>
                      <span class="tag" :class="getBillingCycleTagClass(subscription.billingCycle)">
                        {{ getBillingCycleLabel(subscription.billingCycle) }}
                      </span>
                      <span v-if="subscription.reminderEnabled" class="tag tag-amber">
                        已启用提醒
                      </span>
                    </div>
                    <p>{{ subscription.planType }}</p>
                  </div>

                  <div class="record-actions">
                    <button class="btn btn-secondary" type="button" @click="openEditSubscriptionDialog(subscription)">
                      编辑
                    </button>
                    <button class="btn btn-danger" :disabled="deletingId === subscription.id" type="button" @click="handleDelete(subscription)">
                      {{ deletingId === subscription.id ? '删除中' : '删除' }}
                    </button>
                  </div>
                </div>

                <div class="record-metrics">
                  <div>
                    <span>价格</span>
                    <strong>{{ formatCurrency(subscription.price) }}</strong>
                  </div>
                  <div>
                    <span>下次扣费</span>
                    <strong>{{ formatDate(subscription.nextBillingDate) }}</strong>
                  </div>
                  <div>
                    <span>使用人员</span>
                    <strong>{{ subscription.users.length }} 人</strong>
                    <small>{{ subscription.users.map((user) => user.name).join('、') || '未填写' }}</small>
                  </div>
                  <div>
                    <span>提醒状态</span>
                    <strong>{{ formatReminderStatus(subscription) }}</strong>
                    <small>{{ subscription.reminderEnabled ? `目标到期前 ${subscription.reminderDays} 天` : '当前不会发送邮件' }}</small>
                  </div>
                </div>

                <div v-if="subscription.users.length > 0" class="user-chips">
                  <span v-for="user in subscription.users" :key="user.id">
                    {{ user.name }}<template v-if="user.email"> · {{ user.email }}</template>
                  </span>
                </div>
              </article>
            </div>
          </div>
        </section>
      </main>
    </div>

    <div
      v-if="subscriptionDialogOpen"
      class="modal-backdrop"
      role="presentation"
      @click.self="closeSubscriptionDialog"
      @keydown="handleSubscriptionDialogKeydown"
    >
      <section class="modal-panel" aria-modal="true" role="dialog" :aria-labelledby="'subscription-dialog-title'">
        <div class="modal-header">
          <div>
            <span class="section-kicker">Editor</span>
            <h2 id="subscription-dialog-title">{{ subscriptionDialogTitle }}</h2>
          </div>
          <button class="icon-btn" type="button" aria-label="关闭弹窗" :disabled="submitting" @click="closeSubscriptionDialog">
            ×
          </button>
        </div>

        <form class="form-stack" @submit.prevent="handleSubmit">
          <div class="field">
            <span>平台名称</span>
            <div class="platform-select-grid">
              <div class="platform-select">
                <button class="platform-select-button" type="button" @click="togglePlatformDropdown">
                  <span class="platform-icon" :class="selectedPlatformOption?.tone || 'tone-neutral'">
                    <svg aria-hidden="true" viewBox="0 0 24 24">
                      <path
                        v-for="path in selectedPlatformOption?.iconPaths || customPlatformIconPaths"
                        :key="path"
                        :d="path"
                      />
                    </svg>
                  </span>
                  <span>{{ selectedPlatformOption?.name || '选择常用平台' }}</span>
                  <span class="select-caret" aria-hidden="true">⌄</span>
                </button>

                <div v-if="platformDropdownOpen" class="platform-menu">
                  <button
                    v-for="platform in platformNameOptions"
                    :key="platform.name"
                    class="platform-option"
                    :class="{ active: form.platform === platform.name }"
                    type="button"
                    @click="selectPlatformName(platform.name)"
                  >
                    <span class="platform-icon" :class="platform.tone">
                      <svg aria-hidden="true" viewBox="0 0 24 24">
                        <path v-for="path in platform.iconPaths" :key="path" :d="path" />
                      </svg>
                    </span>
                    <span>{{ platform.name }}</span>
                  </button>
                </div>
              </div>

              <input v-model.trim="form.platform" placeholder="或输入自定义平台名称" required />
            </div>
            <div v-if="form.platform" class="selected-platform">
              <span class="platform-icon" :class="selectedPlatformOption?.tone || 'tone-neutral'">
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path
                    v-for="path in selectedPlatformOption?.iconPaths || customPlatformIconPaths"
                    :key="path"
                    :d="path"
                  />
                </svg>
              </span>
              <strong>{{ form.platform }}</strong>
            </div>
          </div>

          <label class="field">
            <span>订阅种类</span>
            <input v-model.trim="form.planType" placeholder="4K 家庭套餐" required />
          </label>

          <div class="form-grid">
            <label class="field">
              <span>价格</span>
              <input v-model="form.price" min="0" step="0.01" type="number" placeholder="68" required />
            </label>

            <label class="field">
              <span>计费周期</span>
              <select v-model="form.billingCycle">
                <option value="monthly">月付</option>
                <option value="quarterly">季付</option>
                <option value="yearly">年付</option>
              </select>
            </label>
          </div>

          <label class="field">
            <span>下次扣费日期</span>
            <input v-model="form.nextBillingDate" type="date" required />
          </label>

          <div class="form-section">
            <div class="form-section-header">
              <div>
                <h3>使用人员</h3>
                <p>可为同一个订阅维护多位使用人员和邮箱。</p>
              </div>
              <button class="btn btn-secondary" type="button" @click="addUser">
                添加人员
              </button>
            </div>

            <div class="user-list">
              <div v-for="(user, index) in form.users" :key="index" class="user-row">
                <label class="field">
                  <span>姓名</span>
                  <input v-model.trim="user.name" placeholder="张三" />
                </label>
                <label class="field">
                  <span>邮箱</span>
                  <input v-model.trim="user.email" placeholder="zhangsan@example.com" type="email" />
                </label>
                <button class="btn btn-danger" type="button" @click="removeUser(index)">
                  删除
                </button>
              </div>
            </div>
          </div>

          <div class="form-section">
            <div class="form-section-header">
              <div>
                <h3>到期邮件提醒</h3>
                <p>启用后会在到期前按设定天数发送提醒。</p>
              </div>
              <label class="toggle-field">
                <input v-model="form.reminderEnabled" type="checkbox" />
                <span>启用</span>
              </label>
            </div>

            <label class="field">
              <span>提前提醒天数</span>
              <input v-model="form.reminderDays" :disabled="!form.reminderEnabled" min="0" max="365" step="1" type="number" />
            </label>
          </div>

          <div class="modal-actions">
            <button class="btn btn-secondary" type="button" :disabled="submitting" @click="closeSubscriptionDialog">
              取消
            </button>
            <button class="btn btn-primary" :disabled="submitting" type="submit">
              {{ subscriptionDialogSubmitLabel }}
            </button>
          </div>
        </form>
      </section>
    </div>

    <div
      v-if="actionResultDialogOpen"
      class="modal-backdrop"
      role="presentation"
      @click.self="closeActionResultDialog"
      @keydown="handleActionResultDialogKeydown"
    >
      <section class="modal-panel result-modal" aria-modal="true" role="dialog" :aria-labelledby="'action-result-dialog-title'">
        <div class="modal-header">
          <div>
            <span class="section-kicker">Result</span>
            <h2 id="action-result-dialog-title">{{ actionResultDialog.title }}</h2>
          </div>
          <button class="icon-btn" type="button" aria-label="关闭弹窗" @click="closeActionResultDialog">
            ×
          </button>
        </div>

        <div class="result-summary" :class="`result-${actionResultDialog.status}`">
          <strong>{{ actionResultDialog.status === 'error' ? '操作未完成' : '操作完成' }}</strong>
          <span>{{ actionResultDialog.message }}</span>
        </div>

        <div v-if="actionResultDialog.details.length > 0" class="result-details">
          <div
            v-for="detail in actionResultDialog.details"
            :key="`${detail.id}-${detail.dueDate}-${detail.status}`"
            class="notice"
            :class="getReminderDetailClass(detail.status)"
          >
            <strong>{{ detail.platform }} · {{ detail.dueDate }}</strong>
            <span>{{ detail.message }}</span>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-primary" type="button" @click="closeActionResultDialog">
            知道了
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
