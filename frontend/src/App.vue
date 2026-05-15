<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import {
  createSubscription,
  deleteSubscription,
  fetchSubscriptions,
  getApiErrorMessage,
  runReminderCheck,
  updateSubscription
} from './api';

const subscriptions = ref([]);
const loading = ref(false);
const submitting = ref(false);
const deletingId = ref(null);
const editingId = ref(null);
const reminderRunning = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const reminderDetails = ref([]);

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
    tagClass: 'bg-cyan-400/10 text-cyan-200 ring-cyan-300/30',
    monthlyDivisor: 1
  },
  quarterly: {
    label: '季付',
    tagClass: 'bg-emerald-400/10 text-emerald-200 ring-emerald-300/30',
    monthlyDivisor: 3
  },
  yearly: {
    label: '年付',
    tagClass: 'bg-violet-400/10 text-violet-200 ring-violet-300/30',
    monthlyDivisor: 12
  }
};

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
  if (status === 'sent') return 'border-emerald-300/20 bg-emerald-500/10 text-emerald-100';
  if (status === 'error') return 'border-red-300/20 bg-red-500/10 text-red-100';
  return 'border-amber-300/20 bg-amber-500/10 text-amber-100';
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
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
    subscriptions.value = await fetchSubscriptions();
  } catch (error) {
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

    resetForm();
    await loadSubscriptions();
  } catch (error) {
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
      resetForm();
    }

    successMessage.value = '订阅已删除';
    await loadSubscriptions();
  } catch (error) {
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
    if (result.errorCount > 0) {
      errorMessage.value = result.message;
    } else {
      successMessage.value = result.message;
    }

    reminderDetails.value = Array.isArray(result.details) ? result.details : [];
    await loadSubscriptions();
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error);
  } finally {
    reminderRunning.value = false;
  }
}

onMounted(loadSubscriptions);
</script>

<template>
  <main class="min-h-screen bg-slate-950 text-slate-100">
    <div class="absolute inset-0 overflow-hidden">
      <div class="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-500/20 blur-3xl"></div>
      <div class="absolute right-0 top-32 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl"></div>
    </div>

    <section class="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header class="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p class="mb-2 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">sub</p>
          <h1 class="text-3xl font-bold tracking-tight text-white sm:text-5xl">sub</h1>
          <p class="mt-3 max-w-2xl text-slate-400">集中管理平台订阅、使用人员和到期提醒，避免重复付费和遗漏续费。</p>
        </div>
        <div class="flex flex-wrap gap-3">
          <button
            class="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-5 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-60"
            type="button"
            :disabled="reminderRunning"
            @click="handleRunReminderCheck"
          >
            {{ reminderRunning ? '提醒执行中...' : '执行到期提醒' }}
          </button>
          <button
            class="rounded-full border border-white/10 bg-white/10 px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-white/15"
            type="button"
            @click="loadSubscriptions"
          >
            刷新列表
          </button>
        </div>
      </header>

      <div class="mb-6 grid gap-4 md:grid-cols-4">
        <article class="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur">
          <p class="text-sm text-slate-400">本月预估总支出</p>
          <p class="mt-3 text-3xl font-bold text-white">{{ formatCurrency(monthlyTotal) }}</p>
          <p class="mt-2 text-xs text-cyan-200">季付、年付订阅已均摊到每月</p>
        </article>
        <article class="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur">
          <p class="text-sm text-slate-400">全年预估总支出</p>
          <p class="mt-3 text-3xl font-bold text-white">{{ formatCurrency(yearlyTotal) }}</p>
          <p class="mt-2 text-xs text-violet-200">按当前订阅组合估算</p>
        </article>
        <article class="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur">
          <p class="text-sm text-slate-400">30 天内将扣费</p>
          <p class="mt-3 text-3xl font-bold text-white">{{ upcomingCount }} 项</p>
          <p class="mt-2 text-xs text-emerald-200">按下次扣费日期统计</p>
        </article>
        <article class="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur">
          <p class="text-sm text-slate-400">已启用提醒</p>
          <p class="mt-3 text-3xl font-bold text-white">{{ reminderEnabledCount }} 项</p>
          <p class="mt-2 text-xs text-amber-200">按订阅维度发送到期邮件</p>
        </article>
      </div>

      <div v-if="errorMessage" class="mb-5 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
        {{ errorMessage }}
      </div>
      <div v-if="successMessage" class="mb-5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
        {{ successMessage }}
      </div>
      <div v-if="reminderDetails.length > 0" class="mb-5 grid gap-2">
        <div
          v-for="detail in reminderDetails"
          :key="`${detail.id}-${detail.dueDate}`"
          :class="getReminderDetailClass(detail.status)"
          class="rounded-2xl border px-4 py-3 text-sm"
        >
          <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span class="font-semibold">{{ detail.platform }} · {{ detail.dueDate }}</span>
            <span>{{ detail.message }}</span>
          </div>
        </div>
      </div>

      <div class="grid gap-6 lg:grid-cols-[420px_1fr]">
        <section class="rounded-3xl border border-white/10 bg-white/[0.07] p-6 shadow-2xl backdrop-blur">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-xl font-bold text-white">{{ isEditing ? '编辑订阅' : '新增订阅' }}</h2>
              <p class="mt-1 text-sm text-slate-400">维护订阅信息、可用人员和到期提醒规则。</p>
            </div>
            <button
              v-if="isEditing"
              class="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/10"
              type="button"
              @click="resetForm"
            >
              取消编辑
            </button>
          </div>

          <form class="mt-6 space-y-5" @submit.prevent="handleSubmit">
            <label class="block">
              <span class="text-sm font-medium text-slate-300">平台名称</span>
              <input v-model.trim="form.platform" class="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300" placeholder="Netflix" required />
            </label>

            <label class="block">
              <span class="text-sm font-medium text-slate-300">订阅种类</span>
              <input v-model.trim="form.planType" class="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300" placeholder="4K 家庭套餐" required />
            </label>

            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block">
                <span class="text-sm font-medium text-slate-300">价格</span>
                <input v-model="form.price" class="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300" min="0" step="0.01" type="number" placeholder="68" required />
              </label>

              <label class="block">
                <span class="text-sm font-medium text-slate-300">计费周期</span>
                <select v-model="form.billingCycle" class="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition focus:border-cyan-300">
                  <option value="monthly">月付</option>
                  <option value="quarterly">季付</option>
                  <option value="yearly">年付</option>
                </select>
              </label>
            </div>

            <label class="block">
              <span class="text-sm font-medium text-slate-300">下次扣费日期</span>
              <input v-model="form.nextBillingDate" class="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition focus:border-cyan-300" type="date" required />
            </label>

            <div class="rounded-3xl border border-white/10 bg-slate-900/40 p-4">
              <div class="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 class="font-semibold text-white">使用人员</h3>
                  <p class="mt-1 text-xs text-slate-400">支持为同一个订阅维护多位使用人员和邮箱。</p>
                </div>
                <button class="rounded-full border border-cyan-300/20 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-400/10" type="button" @click="addUser">
                  添加人员
                </button>
              </div>

              <div class="space-y-3">
                <div v-for="(user, index) in form.users" :key="index" class="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                  <div class="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <label class="block">
                      <span class="text-xs font-medium text-slate-400">姓名</span>
                      <input v-model.trim="user.name" class="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300" placeholder="张三" />
                    </label>
                    <label class="block">
                      <span class="text-xs font-medium text-slate-400">邮箱</span>
                      <input v-model.trim="user.email" class="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300" placeholder="zhangsan@example.com" type="email" />
                    </label>
                    <button class="rounded-full border border-red-300/20 px-3 py-1.5 text-sm font-semibold text-red-200 transition hover:bg-red-500/10" type="button" @click="removeUser(index)">
                      删除
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="rounded-3xl border border-white/10 bg-slate-900/40 p-4">
              <div class="flex items-center justify-between gap-4">
                <div>
                  <h3 class="font-semibold text-white">到期邮件提醒</h3>
                  <p class="mt-1 text-xs text-slate-400">启用后系统会在到期前按设定天数检查并向使用人员邮箱发送提醒。</p>
                </div>
                <label class="inline-flex items-center gap-2 text-sm font-medium text-slate-200">
                  <input v-model="form.reminderEnabled" class="h-4 w-4 rounded border-white/20 bg-slate-900 text-cyan-400 focus:ring-cyan-300" type="checkbox" />
                  启用
                </label>
              </div>

              <label class="mt-4 block">
                <span class="text-sm font-medium text-slate-300">提前提醒天数</span>
                <input v-model="form.reminderDays" class="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300 disabled:opacity-50" :disabled="!form.reminderEnabled" min="0" max="365" step="1" type="number" />
              </label>
            </div>

            <button class="w-full rounded-2xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60" :disabled="submitting" type="submit">
              {{ submitting ? '提交中...' : isEditing ? '保存订阅' : '添加订阅' }}
            </button>
          </form>
        </section>

        <section class="rounded-3xl border border-white/10 bg-white/[0.07] p-6 shadow-2xl backdrop-blur">
          <div class="mb-6 flex items-center justify-between gap-4">
            <div>
              <h2 class="text-xl font-bold text-white">订阅明细</h2>
              <p class="mt-1 text-sm text-slate-400">支持查看使用人员、提醒状态，并可直接编辑。</p>
            </div>
            <span class="rounded-full bg-white/10 px-3 py-1 text-sm text-slate-300">{{ subscriptions.length }} 项</span>
          </div>

          <div v-if="loading" class="rounded-2xl border border-white/10 bg-slate-900/70 p-8 text-center text-slate-400">
            正在加载订阅数据...
          </div>

          <div v-else-if="subscriptions.length === 0" class="rounded-2xl border border-dashed border-white/20 bg-slate-900/50 p-8 text-center">
            <p class="font-semibold text-white">暂无订阅记录</p>
            <p class="mt-2 text-sm text-slate-400">从左侧添加你的第一个会员订阅。</p>
          </div>

          <div v-else class="space-y-4">
            <article
              v-for="subscription in subscriptions"
              :key="subscription.id"
              class="rounded-3xl border border-white/10 bg-slate-950/40 p-5 transition hover:bg-slate-900/70"
            >
              <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="text-lg font-semibold text-white">{{ subscription.platform }}</p>
                    <span :class="getBillingCycleTagClass(subscription.billingCycle)" class="inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1">
                      {{ getBillingCycleLabel(subscription.billingCycle) }}
                    </span>
                    <span v-if="subscription.reminderEnabled" class="inline-flex rounded-full bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-200 ring-1 ring-amber-300/30">
                      已启用提醒
                    </span>
                  </div>
                  <p class="mt-2 text-sm text-slate-300">{{ subscription.planType }}</p>
                </div>

                <div class="flex flex-wrap gap-3">
                  <button class="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10" type="button" @click="fillForm(subscription)">
                    编辑
                  </button>
                  <button class="rounded-full border border-red-300/20 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/10 disabled:opacity-50" :disabled="deletingId === subscription.id" type="button" @click="handleDelete(subscription)">
                    {{ deletingId === subscription.id ? '删除中' : '删除' }}
                  </button>
                </div>
              </div>

              <div class="mt-5 grid gap-4 md:grid-cols-4">
                <div class="rounded-2xl bg-slate-900/60 p-4">
                  <p class="text-xs uppercase tracking-wider text-slate-500">价格</p>
                  <p class="mt-2 font-semibold text-white">{{ formatCurrency(subscription.price) }}</p>
                </div>
                <div class="rounded-2xl bg-slate-900/60 p-4">
                  <p class="text-xs uppercase tracking-wider text-slate-500">下次扣费</p>
                  <p class="mt-2 font-semibold text-white">{{ formatDate(subscription.nextBillingDate) }}</p>
                </div>
                <div class="rounded-2xl bg-slate-900/60 p-4">
                  <p class="text-xs uppercase tracking-wider text-slate-500">使用人员</p>
                  <p class="mt-2 font-semibold text-white">{{ subscription.users.length }} 人</p>
                  <p class="mt-1 text-sm text-slate-400">
                    {{ subscription.users.map((user) => user.name).join('、') || '未填写' }}
                  </p>
                </div>
                <div class="rounded-2xl bg-slate-900/60 p-4">
                  <p class="text-xs uppercase tracking-wider text-slate-500">提醒状态</p>
                  <p class="mt-2 font-semibold text-white">{{ formatReminderStatus(subscription) }}</p>
                  <p class="mt-1 text-sm text-slate-400">
                    {{ subscription.reminderEnabled ? `目标到期前 ${subscription.reminderDays} 天` : '当前不会发送邮件' }}
                  </p>
                </div>
              </div>

              <div v-if="subscription.users.length > 0" class="mt-4 rounded-2xl border border-white/10 bg-slate-900/50 p-4">
                <p class="text-sm font-semibold text-white">人员邮箱</p>
                <div class="mt-3 flex flex-wrap gap-2">
                  <span
                    v-for="user in subscription.users"
                    :key="user.id"
                    class="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300"
                  >
                    {{ user.name }}<span v-if="user.email"> · {{ user.email }}</span>
                  </span>
                </div>
              </div>
            </article>
          </div>
        </section>
      </div>
    </section>
  </main>
</template>
