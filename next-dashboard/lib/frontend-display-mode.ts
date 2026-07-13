export const frontendDisplayModes = ['light', 'dark', 'system'] as const;

export type FrontendDisplayMode = (typeof frontendDisplayModes)[number];

export const frontendDisplayModeStorageKey = 'subscription-dashboard-frontend-display-mode';
export const defaultFrontendDisplayMode: FrontendDisplayMode = 'system';

export function isFrontendDisplayMode(value: unknown): value is FrontendDisplayMode {
  return typeof value === 'string' && frontendDisplayModes.some((mode) => mode === value);
}
