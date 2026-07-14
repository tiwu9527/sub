import type { SubscriptionMember, SubscriptionStatus } from '@/lib/data';
import type { FrontendDisplayMode } from '@/lib/frontend-display-mode';
import type { TemplateSlug } from '@/lib/templates';
import type { DashboardTheme } from '@/lib/themes';

export const dashboardIconNames = ['cloud', 'film', 'music'] as const;
export type DashboardIconName = (typeof dashboardIconNames)[number];

export type DashboardSubscription = {
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
  iconName: DashboardIconName;
  tone: string;
};

export type DashboardWorkspaceConfig = {
  workspaceName: string;
  monthlyBudget: string;
  currency: string;
  reminderDays: string;
  copyrightText: string;
};

export type DashboardState = {
  initialized: boolean;
  revision: number;
  items: DashboardSubscription[];
  config: DashboardWorkspaceConfig;
  theme: DashboardTheme;
  frontendTemplate: TemplateSlug;
  frontendDisplayMode: FrontendDisplayMode;
};

export const defaultDashboardConfig: DashboardWorkspaceConfig = {
  workspaceName: 'Personal workspace',
  monthlyBudget: '40',
  currency: '¥',
  reminderDays: '3',
  copyrightText: '© 2026 续费管家. 保留所有权利。'
};

export const emptyDashboardState: DashboardState = {
  initialized: false,
  revision: 0,
  items: [],
  config: defaultDashboardConfig,
  theme: 'forest',
  frontendTemplate: 'cards',
  frontendDisplayMode: 'system'
};
