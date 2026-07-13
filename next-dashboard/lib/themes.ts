export const dashboardThemeIds = [
  'forest',
  'ocean',
  'graphite',
  'violet',
  'coral',
  'amber',
  'sky',
  'dark'
] as const;

export type DashboardTheme = (typeof dashboardThemeIds)[number];

export type DashboardThemeDefinition = {
  id: DashboardTheme;
  label: string;
  swatches: readonly [string, string, string];
};

export const dashboardThemes = [
  { id: 'forest', label: '青岚', swatches: ['#0F766E', '#163B36', '#F4F6F5'] },
  { id: 'ocean', label: '海岸', swatches: ['#2563EB', '#183B68', '#F3F6FA'] },
  { id: 'graphite', label: '石墨', swatches: ['#B45309', '#292D2A', '#F5F5F4'] },
  { id: 'violet', label: '紫藤', swatches: ['#7457C8', '#312653', '#F6F2FF'] },
  { id: 'coral', label: '珊瑚', swatches: ['#D95D4B', '#5A2D28', '#FFF3F0'] },
  { id: 'amber', label: '琥珀', swatches: ['#C67A16', '#4B341C', '#FFF8E8'] },
  { id: 'sky', label: '晴空', swatches: ['#1686C7', '#1D4964', '#F0F9FE'] },
  { id: 'dark', label: '夜间', swatches: ['#4CC6B7', '#16413A', '#111613'] }
] as const satisfies readonly DashboardThemeDefinition[];

export const dashboardThemeStorageKey = 'subscription-dashboard-theme';

export function isDashboardTheme(value: unknown): value is DashboardTheme {
  return typeof value === 'string' && dashboardThemeIds.some((theme) => theme === value);
}
