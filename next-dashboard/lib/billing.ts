import type { Subscription } from './data';

export function getBillableSubscriptions(subscriptions: Subscription[]) {
  return subscriptions.filter((subscription) => subscription.status !== 'paused');
}

export function parseSubscriptionPrice(price: string) {
  const amount = Number(price.replace(/[^\d.-]/g, ''));
  return Number.isFinite(amount) ? amount : 0;
}

export function getAnnualMultiplier(cycle: string) {
  const normalizedCycle = cycle.trim().toLowerCase();

  if (normalizedCycle.includes('年') || normalizedCycle.includes('annual') || normalizedCycle.includes('year')) return 1;
  if (normalizedCycle.includes('季') || normalizedCycle.includes('quarter')) return 4;
  if (normalizedCycle.includes('周') || normalizedCycle.includes('week')) return 52;
  if (normalizedCycle.includes('日') || normalizedCycle.includes('day')) return 365;

  return 12;
}

export function getMonthlyDivisor(cycle: string) {
  const normalizedCycle = cycle.trim().toLowerCase();

  if (normalizedCycle.includes('年') || normalizedCycle.includes('annual') || normalizedCycle.includes('year')) return 12;
  if (normalizedCycle.includes('季') || normalizedCycle.includes('quarter')) return 3;

  return 1;
}

export function calculateCurrentPayable(subscriptions: Subscription[]) {
  return getBillableSubscriptions(subscriptions).reduce((sum, subscription) => sum + parseSubscriptionPrice(subscription.price), 0);
}

export function calculateMonthlySpend(subscriptions: Subscription[]) {
  return getBillableSubscriptions(subscriptions).reduce(
    (sum, subscription) => sum + parseSubscriptionPrice(subscription.price) / getMonthlyDivisor(subscription.cycle),
    0
  );
}

export function calculateAnnualizedSpend(subscriptions: Subscription[]) {
  return getBillableSubscriptions(subscriptions).reduce(
    (sum, subscription) => sum + parseSubscriptionPrice(subscription.price) * getAnnualMultiplier(subscription.cycle),
    0
  );
}
