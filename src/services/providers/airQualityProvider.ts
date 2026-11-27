import { openMeteoGeocodeResponseSchema } from '../../schemas/external.ts';
import type { AirQualitySnapshot, LocationSelection } from '../../types/index.ts';
import { evaluateDataFreshness } from '../../utils/aqi.ts';
import { fetchWithTimeout, formatSafeErrorReason } from './httpClient.ts';
import {
  OpenMeteoAirQualityProvider,
  PROVIDER_CACHE_TTL_MS,
} from './openMeteoProvider.ts';
import { PRESET_LOCATIONS } from './presetLocations.ts';
import { WaqiStationProvider } from './waqiProvider.ts';

export { PRESET_LOCATIONS, OpenMeteoAirQualityProvider, WaqiStationProvider };

export interface AirQualityProvider {
  readonly id: string;
  readonly name: string;
  supportsLocation(location: LocationSelection): boolean;
  fetchAirQuality(
    location: LocationSelection,
    fetchImpl?: typeof fetch,
  ): Promise<AirQualitySnapshot>;
}

interface CacheEntry {
  snapshot: AirQualitySnapshot;
  expiresAt: number;
}

interface GeocodeCacheEntry {
  results: LocationSelection[];
  expiresAt: number;
}

const GEOCODE_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes city metadata cache
const MAX_CACHE_ENTRIES = 200;

function createUnavailableSnapshot(
  location: LocationSelection,
  failedProviders: string[],
): AirQualitySnapshot {
  const failureDetail =
    failedProviders.length > 0 ? ` Providers tried: ${failedProviders.join(', ')}.` : '';
  return {
    location,
    aqi: null,
    aqiScale: location.countryCode.toUpperCase() === 'IN' ? 'INDIA_NAQI' : 'US_EPA',
    aqiStatus: 'unavailable',
    dominantPollutant: null,
    pollutants: [
      {
        code: 'PM2.5',
        label: 'Fine Particulate Matter',
        value: null,
        unit: 'µg/m³',
        status: 'unavailable',
      },
      {
        code: 'PM10',
        label: 'Coarse Particulate Matter',
        value: null,
        unit: 'µg/m³',
        status: 'unavailable',
      },
      {
        code: 'NO2',
        label: 'Nitrogen Dioxide',
        value: null,
        unit: 'µg/m³',
        status: 'unavailable',
      },
      {
        code: 'SO2',
        label: 'Sulfur Dioxide',
        value: null,
        unit: 'µg/m³',
        status: 'unavailable',
      },
      {
        code: 'CO',
        label: 'Carbon Monoxide',
        value: null,
        unit: 'mg/m³',
        status: 'unavailable',
      },
      {
        code: 'O3',
        label: 'Ground-Level Ozone',
        value: null,
        unit: 'µg/m³',
        status: 'unavailable',
      },
    ],
    weather: {
      temperatureC: null,
      humidityPercent: null,
      windSpeedKmh: null,
      status: 'unavailable',
      source: 'Unavailable',
      timestamp: null,
    },
    hourlyForecast: [],
    trend: 'unavailable',
    trendSummary: 'Live air-quality providers could not be reached.',
    dataSource: 'Unavailable',
    providerId: 'none',
    lastUpdated: null,
    fetchedAt: new Date().toISOString(),
    cached: false,
    cacheMaxAgeSeconds: 0,
    freshness: 'unavailable',
    notice: `Unable to retrieve air-quality readings for ${location.name}.${failureDetail} BreatheWise AI will not substitute another city's data or fabricate values.`,
  };
}

export class AirQualityService {
  private readonly providers: AirQualityProvider[];
  private readonly cache = new Map<string, CacheEntry>();
  private readonly geocodeCache = new Map<string, GeocodeCacheEntry>();
  private readonly fetchImpl: typeof fetch;
  private readonly onProviderError?: (providerId: string, reason: string) => void;

  constructor(options?: {
    waqiToken?: string;
    providers?: AirQualityProvider[];
    fetchImpl?: typeof fetch;
    onProviderError?: (providerId: string, reason: string) => void;
  }) {
    this.fetchImpl = options?.fetchImpl ?? fetch;
    this.onProviderError = options?.onProviderError;
    if (options?.providers) {
      this.providers = options.providers;
    } else {
      const list: AirQualityProvider[] = [];
      if (options?.waqiToken && options.waqiToken.trim().length > 0) {
        list.push(new WaqiStationProvider(options.waqiToken));
      }
      list.push(new OpenMeteoAirQualityProvider());
      this.providers = list;
    }
  }

  private setBoundedCache<T>(map: Map<string, T>, key: string, value: T): void {
    if (map.has(key)) {
      map.delete(key);
    } else if (map.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = map.keys().next().value;
      if (oldestKey) map.delete(oldestKey);
    }
    map.set(key, value);
  }

  private getCacheKey(location: LocationSelection): string {
    return `${location.latitude.toFixed(3)},${location.longitude.toFixed(3)},${location.countryCode.toUpperCase()}`;
  }

  async getSnapshot(
    location: LocationSelection,
    bypassCache: boolean = false,
  ): Promise<AirQualitySnapshot> {
    const key = this.getCacheKey(location);
    const now = Date.now();
    if (!bypassCache) {
      const entry = this.cache.get(key);
      if (entry && entry.expiresAt > now) {
        const refreshedFreshness = evaluateDataFreshness(
          entry.snapshot.lastUpdated,
          now,
        ).status;
        return {
          ...entry.snapshot,
          location,
          cached: true,
          freshness: refreshedFreshness,
        };
      }
      if (entry) {
        this.cache.delete(key);
      }
    }

    const failedProviders: string[] = [];
    for (const provider of this.providers) {
      if (!provider.supportsLocation(location)) continue;
      try {
        const snapshot = await provider.fetchAirQuality(location, this.fetchImpl);
        this.setBoundedCache(this.cache, key, {
          snapshot,
          expiresAt: Date.now() + PROVIDER_CACHE_TTL_MS,
        });
        return snapshot;
      } catch (err: unknown) {
        const reason = formatSafeErrorReason(err);
        failedProviders.push(provider.id);
        this.onProviderError?.(provider.id, reason);
        // Try next configured provider; never silently substitute another city
      }
    }

    return createUnavailableSnapshot(location, failedProviders);
  }

  async searchLocations(query: string): Promise<LocationSelection[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];
    const cacheKey = trimmed.toLowerCase();
    const now = Date.now();
    const cached = this.geocodeCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.results;
    }

    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      trimmed,
    )}&count=8&language=en&format=json`;
    const res = await fetchWithTimeout(url, this.fetchImpl, 6500);
    if (!res.ok) {
      throw new Error(`Geocoding service responded with HTTP ${res.status}`);
    }

    const raw: unknown = await res.json();
    const validated = openMeteoGeocodeResponseSchema.safeParse(raw);
    if (!validated.success) {
      throw new Error('Geocoding service returned an invalid payload.');
    }

    const results: LocationSelection[] = (validated.data.results ?? []).map((item) => ({
      id: `geo-${item.id ?? `${item.latitude.toFixed(2)}-${item.longitude.toFixed(2)}`}`,
      name: item.name,
      neighborhood: item.admin2 && item.admin2 !== item.name ? item.admin2 : undefined,
      region: item.admin1,
      country: item.country ?? 'Unknown',
      countryCode: item.country_code ?? 'XX',
      latitude: item.latitude,
      longitude: item.longitude,
      source: 'search',
    }));

    this.setBoundedCache(this.geocodeCache, cacheKey, {
      results,
      expiresAt: now + GEOCODE_CACHE_TTL_MS,
    });
    return results;
  }

  clearCache(): void {
    this.cache.clear();
    this.geocodeCache.clear();
  }
}
