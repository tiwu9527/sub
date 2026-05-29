import axios from 'axios';

const AUTH_TOKEN_STORAGE_KEY = 'sub.admin.authToken';
const AUTH_USERNAME_STORAGE_KEY = 'sub.admin.username';
const AUTH_EXPIRES_AT_STORAGE_KEY = 'sub.admin.expiresAt';
const EMAIL_REQUEST_TIMEOUT_MS = 60000;

let authToken = getStoredAuthToken();

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api',
  timeout: 10000
});

api.interceptors.request.use((config) => {
  if (authToken && !config.skipAuth) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (isUnauthorizedError(error)) {
      clearAuthSession();
    }

    return Promise.reject(error);
  }
);

function readLocalStorage(key) {
  try {
    return window.localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function writeLocalStorage(key, value) {
  try {
    if (value) {
      window.localStorage.setItem(key, value);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage failures so the app still works in restricted browsers.
  }
}

export function getStoredAuthToken() {
  return readLocalStorage(AUTH_TOKEN_STORAGE_KEY);
}

export function getStoredAdminUsername() {
  return readLocalStorage(AUTH_USERNAME_STORAGE_KEY);
}

export function setAuthSession(session) {
  authToken = session?.token || '';
  writeLocalStorage(AUTH_TOKEN_STORAGE_KEY, authToken);
  writeLocalStorage(AUTH_USERNAME_STORAGE_KEY, session?.username || '');
  writeLocalStorage(AUTH_EXPIRES_AT_STORAGE_KEY, session?.expiresAt || '');
}

export function clearAuthSession() {
  authToken = '';
  writeLocalStorage(AUTH_TOKEN_STORAGE_KEY, '');
  writeLocalStorage(AUTH_USERNAME_STORAGE_KEY, '');
  writeLocalStorage(AUTH_EXPIRES_AT_STORAGE_KEY, '');
}

export async function loginAdmin(payload) {
  const { data } = await api.post('/auth/login', payload);
  setAuthSession(data);
  return data;
}

export async function verifyAdminSession() {
  const { data } = await api.get('/auth/session');
  return data;
}

export async function fetchSubscriptions(options = {}) {
  const { data } = await api.get('/subscriptions', {
    skipAuth: options.publicOnly === true
  });
  return data;
}

export async function fetchSettings(options = {}) {
  const { data } = await api.get('/settings', {
    skipAuth: options.publicOnly === true
  });
  return data;
}

export async function updateSettings(payload) {
  const { data } = await api.put('/settings', payload);
  return data;
}

export async function createSubscription(payload) {
  const { data } = await api.post('/subscriptions', payload);
  return data;
}

export async function updateSubscription(id, payload) {
  const { data } = await api.put(`/subscriptions/${id}`, payload);
  return data;
}

export async function deleteSubscription(id) {
  await api.delete(`/subscriptions/${id}`);
}

export async function runReminderCheck() {
  const { data } = await api.post('/reminders/run');
  return data;
}

export async function sendTestEmail() {
  const { data } = await api.post('/reminders/test-email', undefined, {
    timeout: EMAIL_REQUEST_TIMEOUT_MS
  });
  return data;
}

export function isUnauthorizedError(error) {
  return error.response?.status === 401;
}

export function getApiErrorMessage(error) {
  const data = error.response?.data;

  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return data.errors.join('，');
  }

  return data?.message || error.message || '请求失败，请稍后重试';
}
