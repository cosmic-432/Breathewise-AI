import { useEffect, useRef, useState } from 'react';
import { LocateFixed, MapPin, Search, X } from 'lucide-react';
import { apiClient } from '../api/client.ts';
import { useFocusTrap } from '../hooks/useFocusTrap.ts';
import type { LocationSelection } from '../types/index.ts';

interface LocationSelectorModalProps {
  isOpen: boolean;
  currentLocation: LocationSelection;
  onSelect: (location: LocationSelection) => void;
  onClose: () => void;
}

export function LocationSelectorModal({
  isOpen,
  currentLocation,
  onSelect,
  onClose,
}: LocationSelectorModalProps) {
  const [query, setQuery] = useState('');
  const [presets, setPresets] = useState<LocationSelection[]>([]);
  const [results, setResults] = useState<LocationSelection[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap(dialogRef, isOpen, onClose);

  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();

    const controller = new AbortController();
    apiClient
      .fetchPresets(controller.signal)
      .then(setPresets)
      .catch(() => {
        // Ignore abort errors
      });

    return () => {
      controller.abort();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const list = await apiClient.searchLocations(trimmed, controller.signal);
        setResults(list);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(
          err instanceof Error ? err.message : 'Unable to search locations right now.',
        );
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, isOpen]);

  const handleUseDeviceLocation = () => {
    if (!('geolocation' in navigator)) {
      setError('Device geolocation is not supported in this browser. Choose a city manually below.');
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(4));
        const lon = Number(pos.coords.longitude.toFixed(4));
        setLocating(false);
        onSelect({
          id: `geo-device-${lat}-${lon}`,
          name: 'Current Device Location',
          neighborhood: `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`,
          country: 'Detected Coordinates',
          countryCode: 'XX',
          latitude: lat,
          longitude: lon,
          source: 'geolocation',
        });
        onClose();
      },
      (geoErr) => {
        setLocating(false);
        setError(
          geoErr.code === geoErr.PERMISSION_DENIED
            ? 'Location permission was declined. Location sharing is completely optional — pick any city or neighborhood below.'
            : 'Unable to determine device coordinates. Please select a city manually.',
        );
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#20332B]/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-xl rounded-xl border border-[#E1EAE4] bg-white shadow-lg overflow-hidden"
      >
        <div className="flex items-center justify-between gap-4 border-b border-[#E1EAE4] px-6 py-4">
          <div>
            <h2
              id="location-modal-title"
              className="text-lg font-semibold text-[#20332B]"
            >
              Choose Your Location
            </h2>
            <p className="text-xs text-[#66786E] mt-0.5">
              Search any city or neighborhood manually, or opt in to device location.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close location selector"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#66786E] hover:bg-[#F5F8F6] hover:text-[#20332B] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          <div className="space-y-3">
            <label
              htmlFor="city-search-input"
              className="block text-sm font-medium text-[#20332B]"
            >
              Search city, town, or district
            </label>
            <div className="relative">
              <Search
                className="w-4 h-4 text-[#66786E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                ref={inputRef}
                id="city-search-input"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., Delhi, Gurugram, Pune, Bengaluru, London..."
                className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] pl-10 pr-4 py-2.5 text-sm text-[#20332B] placeholder:text-[#66786E] focus:bg-white focus:border-[#237A57] focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={handleUseDeviceLocation}
                disabled={locating}
                className="inline-flex items-center gap-2 rounded-lg border border-[#E1EAE4] bg-white px-4 py-2 text-xs font-medium text-[#18543F] hover:bg-[#DDF1E6]/60 disabled:opacity-60 transition-colors whitespace-nowrap"
              >
                <LocateFixed className="w-4 h-4" aria-hidden="true" />
                {locating ? 'Requesting location...' : 'Use device location (optional)'}
              </button>
              <span className="text-xs text-[#66786E]">
                Coordinates are used only to query air quality and are never published.
              </span>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-[#C94D53]/30 bg-[#FBECEE] px-4 py-3 text-xs text-[#962D32]"
            >
              {error}
            </div>
          )}

          {query.trim().length >= 2 && (
            <div>
              <h3 className="text-xs font-semibold text-[#66786E] mb-2">
                {searching ? 'Searching locations...' : `Search Results (${results.length})`}
              </h3>
              {!searching && results.length === 0 ? (
                <p className="text-sm text-[#66786E] py-3">
                  No matching cities found for &ldquo;{query.trim()}&rdquo;. Try a broader city name.
                </p>
              ) : (
                <ul className="divide-y divide-[#E1EAE4] border border-[#E1EAE4] rounded-lg overflow-hidden">
                  {results.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(item);
                          onClose();
                        }}
                        className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left hover:bg-[#F5F8F6] transition-colors"
                      >
                        <div>
                          <div className="text-sm font-medium text-[#20332B]">
                            {item.name}
                            {item.neighborhood ? ` — ${item.neighborhood}` : ''}
                          </div>
                          <div className="text-xs text-[#66786E]">
                            {[item.region, item.country].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        <span className="text-xs font-mono tabular-nums text-[#66786E] shrink-0">
                          {item.latitude.toFixed(2)}, {item.longitude.toFixed(2)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold text-[#66786E] mb-2">
              Quick-Select Cities &amp; Neighborhoods
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {presets.map((loc) => {
                const isSelected = loc.id === currentLocation.id;
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => {
                      onSelect(loc);
                      onClose();
                    }}
                    className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-left transition-colors ${
                      isSelected
                        ? 'border-[#237A57] bg-[#DDF1E6]/50'
                        : 'border-[#E1EAE4] bg-white hover:bg-[#F5F8F6]'
                    }`}
                  >
                    <MapPin
                      className="w-4 h-4 text-[#237A57] mt-0.5 shrink-0"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[#20332B] truncate">
                        {loc.name}
                      </div>
                      <div className="text-xs text-[#66786E] truncate">
                        {loc.neighborhood ? `${loc.neighborhood} · ` : ''}
                        {loc.country}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
