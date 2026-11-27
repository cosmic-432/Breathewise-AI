import { useEffect, useState } from 'react';
import { apiClient } from '../api/client.ts';
import type { LocationSelection } from '../types/index.ts';

let cachedPresets: LocationSelection[] | null = null;

export function resetLocationPresetsCache(): void {
  cachedPresets = null;
}

/**
 * Fetches and caches preset locations across views (LocationSelectorModal, MapPage)
 * so navigating or reopening the modal avoids redundant API requests.
 */
export function useLocationPresets(enabled: boolean = true): {
  presets: LocationSelection[];
  error: string | null;
} {
  const [presets, setPresets] = useState<LocationSelection[]>(() => cachedPresets ?? []);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || cachedPresets !== null) return;

    const controller = new AbortController();
    apiClient
      .fetchPresets(controller.signal)
      .then((list) => {
        cachedPresets = list;
        setPresets(list);
        setError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Unable to load preset locations.');
      });

    return () => {
      controller.abort();
    };
  }, [enabled]);

  return { presets, error };
}
