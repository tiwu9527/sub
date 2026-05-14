import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api',
  timeout: 10000
});

export async function fetchSubscriptions() {
  const { data } = await api.get('/subscriptions');
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

export function getApiErrorMessage(error) {
  const data = error.response?.data;

  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return data.errors.join('；');
  }

  return data?.message || error.message || '请求失败，请稍后重试';
}
