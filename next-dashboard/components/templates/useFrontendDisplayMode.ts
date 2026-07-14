'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  defaultFrontendDisplayMode,
  frontendDisplayModeStorageKey,
  isFrontendDisplayMode,
  type FrontendDisplayMode
} from '@/lib/frontend-display-mode';

export function useFrontendDisplayMode(preferredMode: FrontendDisplayMode = defaultFrontendDisplayMode) {
  const [mode, setModeState] = useState<FrontendDisplayMode>(preferredMode);

  useEffect(() => {
    function restoreMode() {
      try {
        const storedMode = window.localStorage.getItem(frontendDisplayModeStorageKey);
        setModeState(isFrontendDisplayMode(storedMode) ? storedMode : preferredMode);
      } catch {
        setModeState(preferredMode);
      }
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === frontendDisplayModeStorageKey || event.key === null) restoreMode();
    }

    restoreMode();
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [preferredMode]);

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
