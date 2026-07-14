import type { Subscription, SubscriptionStatus } from '@/lib/data';

const millisecondsPerDay = 24 * 60 * 60 * 1000;

export function getEffectiveSubscriptionStatus(
  subscription: Pick<Subscription, 'status' | 'nextBilling'>,
  reminderDays: number,
  now = new Date()
): SubscriptionStatus {
  if (subscription.status === 'paused') return 'paused';

  const billingDate = parseLocalDate(subscription.nextBilling);
  if (!billingDate) return 'active';

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const billingStart = new Date(billingDate.getFullYear(), billingDate.getMonth(), billingDate.getDate()).getTime();
  const daysUntilBilling = Math.round((billingStart - todayStart) / millisecondsPerDay);

  return daysUntilBilling <= Math.max(reminderDays, 0) ? 'due' : 'active';
}

export function sortSubscriptionsByStatus<T extends Pick<Subscription, 'status' | 'nextBilling'>>(
  subscriptions: readonly T[],
  reminderDays: number
) {
  const statusOrder: Record<SubscriptionStatus, number> = {
    active: 0,
    due: 1,
    paused: 2
  };

  return subscriptions
    .map((subscription, index) => ({ subscription, index }))
    .sort((left, right) => {
      const statusDifference =
        statusOrder[getEffectiveSubscriptionStatus(left.subscription, reminderDays)] -
        statusOrder[getEffectiveSubscriptionStatus(right.subscription, reminderDays)];

      return statusDifference || left.index - right.index;
    })
    .map(({ subscription }) => subscription);
}

function parseLocalDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}
