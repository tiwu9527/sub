'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  defaultFrontendDisplayMode,
  frontendDisplayModeStorageKey,
  isFrontendDisplayMode,
  type FrontendDisplayMode
} from '@/lib/frontend-display-mode';

export function useFrontendDisplayMode() {
  const [mode, setModeState] = useState<FrontendDisplayMode>(defaultFrontendDisplayMode);

  useEffect(() => {
    function restoreMode() {
      try {
        const storedMode = window.localStorage.getItem(frontendDisplayModeStorageKey);
        setModeState(isFrontendDisplayMode(storedMode) ? storedMode : defaultFrontendDisplayMode);
      } catch {
        setModeState(defaultFrontendDisplayMode);
      }
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === frontendDisplayModeStorageKey || event.key === null) restoreMode();
    }

    restoreMode();
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setMode = useCallback((nextMode: FrontendDisplayMode) => {
    setModeState(nextMode);

    try {
      window.localStorage.setItem(frontendDisplayModeStorageKey, nextMode);
    } catch {
      // The selected mode still applies for this page when storage is unavailable.
    }
  }, []);

  return { mode, setMode } as const;
}
