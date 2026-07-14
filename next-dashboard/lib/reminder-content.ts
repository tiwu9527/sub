import 'server-only';

import { escapeEmailHtml } from '@/lib/email-service';

export type ReminderContentSubscription = {
  name: string;
  plan: string;
  price: string;
  cycle: string;
  nextBilling: string;
};

export type ReminderContentMember = {
  name: string;
  email: string;
  expiresAt: string;
};

export function buildReminderContent(
  subscription: ReminderContentSubscription,
  member: ReminderContentMember,
  today: Date
) {
  const daysUntil = getDaysUntil(subscription.nextBilling, today);
  const dueText =
    daysUntil < 0
      ? `已逾期 ${Math.abs(daysUntil)} 天`
      : daysUntil === 0
        ? '今天扣费'
        : daysUntil === 1
          ? '明天扣费'
          : `还有 ${daysUntil} 天扣费`;
  const subject = `续费提醒：${subscription.name} 将于 ${subscription.nextBilling} 扣费`;
  const memberExpiryLine = member.expiresAt !== subscription.nextBilling ? `成员到期：${member.expiresAt}` : '';
  const lines = [
    `${member.name}，您好：`,
    '',
    `您正在使用的订阅「${subscription.name}」即将续费，请及时确认并完成续费。`,
    '',
    `订阅方案：${subscription.plan}`,
    `续费金额：${subscription.price} / ${subscription.cycle}`,
    `扣费日期：${subscription.nextBilling}（${dueText}）`,
    ...(memberExpiryLine ? [memberExpiryLine] : []),
    '',
    '如您不再使用该服务，请及时联系管理员调整订阅成员。',
    '',
    '此邮件由续费管家管理员发送。'
  ];

  return {
    subject,
    text: lines.join('\n'),
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;color:#17211b;line-height:1.7;max-width:620px;margin:0 auto;padding:24px">
        <div style="font-size:12px;font-weight:700;color:#0f766e;margin-bottom:8px">续费管家 · 订阅提醒</div>
        <h1 style="font-size:22px;line-height:1.35;margin:0 0 18px">${escapeEmailHtml(subscription.name)} 即将续费</h1>
        <p>${escapeEmailHtml(member.name)}，您好：</p>
        <p>您正在使用的订阅「<strong>${escapeEmailHtml(subscription.name)}</strong>」即将续费，请及时确认并完成续费。</p>
        <div style="background:#f4f7f5;border:1px solid #dde4e0;border-radius:12px;padding:16px 18px;margin:20px 0">
          <div><strong>订阅方案：</strong>${escapeEmailHtml(subscription.plan)}</div>
          <div><strong>续费金额：</strong>${escapeEmailHtml(subscription.price)} / ${escapeEmailHtml(subscription.cycle)}</div>
          <div><strong>扣费日期：</strong>${escapeEmailHtml(subscription.nextBilling)}（${escapeEmailHtml(dueText)}）</div>
          ${memberExpiryLine ? `<div><strong>成员到期：</strong>${escapeEmailHtml(member.expiresAt)}</div>` : ''}
        </div>
        <p style="color:#68746d">如您不再使用该服务，请及时联系管理员调整订阅成员。</p>
        <p style="font-size:12px;color:#89948e;margin-top:28px">此邮件由续费管家管理员发送。</p>
      </div>
    `.trim()
  };
}

export function getCalendarNow(timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return new Date(Number(values.year), Number(values.month) - 1, Number(values.day), 12);
  } catch {
    return new Date();
  }
}

function getDaysUntil(value: string, today: Date) {
  const [year, month, day] = value.split('-').map(Number);
  const target = new Date(year, month - 1, day).getTime();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((target - todayStart) / (24 * 60 * 60 * 1000));
}
