import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Cloud,
  CreditCard,
  Film,
  LineChart,
  Music2,
  Settings,
  Sparkles
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type SubscriptionStatus = 'active' | 'due' | 'paused';

export type Stat = {
  title: string;
  value: string;
  note: string;
  icon: LucideIcon;
  tone: 'violet' | 'blue' | 'green' | 'rose';
};

export type SubscriptionMember = {
  id: string;
  name: string;
  email: string;
  expiresAt: string;
};

export type Subscription = {
  id: string;
  name: string;
  plan: string;
  tag: string;
  price: string;
  cycle: string;
  nextBilling: string;
  members: string;
  memberEmails: string[];
  memberDetails: SubscriptionMember[];
  status: SubscriptionStatus;
  icon: LucideIcon;
  tone: string;
};

export const statusLabels: Record<SubscriptionStatus, string> = {
  active: '正常',
  due: '即将扣费',
  paused: '暂停'
};

export const stats: Stat[] = [
  {
    title: '月均支出',
    value: '¥7.00',
    note: '较上月保持稳定',
    icon: CreditCard,
    tone: 'violet'
  },
  {
    title: '订阅数量',
    value: '1',
    note: '1 项活跃服务',
    icon: Sparkles,
    tone: 'blue'
  },
  {
    title: '下一次扣费',
    value: '5月18日',
    note: 'Apple One 家庭组',
    icon: CalendarDays,
    tone: 'green'
  },
  {
    title: '待处理项目',
    value: '0',
    note: '没有逾期提醒',
    icon: CheckCircle2,
    tone: 'rose'
  }
];

export const subscriptions: Subscription[] = [
  {
    id: 'apple-one',
    name: 'Apple One',
    plan: '印度家庭组',
    tag: 'Entertainment',
    price: '¥21.00',
    cycle: '季付',
    nextBilling: '2026-08-18',
    members: '1 人',
    memberEmails: ['alex@example.com'],
    memberDetails: [{ id: 'apple-one-alex', name: 'Alex', email: 'alex@example.com', expiresAt: '2026-08-18' }],
    status: 'active',
    icon: Cloud,
    tone: 'from-[#7C5CFF] via-[#9275FF] to-[#C8B8FF]'
  },
  {
    id: 'netflix',
    name: 'Netflix',
    plan: 'Premium 4K',
    tag: 'Video',
    price: '¥68.00',
    cycle: '月付',
    nextBilling: '2026-07-14',
    members: '4 人',
    memberEmails: ['mia@example.com', 'lin@example.com'],
    memberDetails: [
      { id: 'netflix-mia', name: 'Mia', email: 'mia@example.com', expiresAt: '2026-07-14' },
      { id: 'netflix-lin', name: 'Lin', email: 'lin@example.com', expiresAt: '2026-07-14' }
    ],
    status: 'active',
    icon: Film,
    tone: 'from-[#FF5A5F] via-[#FF7A84] to-[#FFB0B5]'
  },
  {
    id: 'spotify',
    name: 'Spotify',
    plan: 'Family Plan',
    tag: 'Music',
    price: '¥18.00',
    cycle: '月付',
    nextBilling: '2026-08-08',
    members: '5 人',
    memberEmails: ['kai@example.com', 'you@example.com'],
    memberDetails: [
      { id: 'spotify-kai', name: 'Kai', email: 'kai@example.com', expiresAt: '2026-08-08' },
      { id: 'spotify-you', name: 'You', email: 'you@example.com', expiresAt: '2026-08-08' }
    ],
    status: 'active',
    icon: Music2,
    tone: 'from-[#34C759] via-[#63D981] to-[#A7EEC0]'
  }
];

export const trendPoints = [
  { month: 'Feb', value: 42 },
  { month: 'Mar', value: 56 },
  { month: 'Apr', value: 49 },
  { month: 'May', value: 71 },
  { month: 'Jun', value: 64 },
  { month: 'Jul', value: 78 }
];

export const sidebarItems = [
  { id: 'overview', label: '概览', icon: Activity },
  { id: 'subscriptions', label: '订阅管理', icon: CreditCard },
  { id: 'billing', label: '账单日历', icon: CalendarDays },
  { id: 'analytics', label: '统计分析', icon: LineChart },
  { id: 'settings', label: '设置', icon: Settings }
];

export const quickPanelMembers = [
  { name: 'Alex', color: 'bg-[#7C5CFF]' },
  { name: 'Mia', color: 'bg-[#A98BFF]' },
  { name: 'Lin', color: 'bg-[#34C759]' },
  { name: 'Kai', color: 'bg-[#FF5A5F]' },
  { name: 'You', color: 'bg-[#111827]' }
];
