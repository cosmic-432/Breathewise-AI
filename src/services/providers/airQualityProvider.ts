import type {
  AirQualitySnapshot,
  AqiScale,
  DataQualityStatus,
  HourlyAqiPoint,
  LocationSelection,
  PollutantReading,
  WeatherReading,
} from '../../types/index.ts';
import {
  calculateIndiaNaqiFromPm25,
  evaluateDataFreshness,
  ugPerM3ToMgPerM3,
} from '../../utils/aqi.ts';

export const PRESET_LOCATIONS: LocationSelection[] = [
  {
    id: 'in-delhi-cp',
    name: 'New Delhi',
    neighborhood: 'Connaught Place / Central',
    region: 'Delhi',
    country: 'India',
    countryCode: 'IN',
    latitude: 28.6315,
    longitude: 77.2167,
    source: 'preset',
  },
  {
    id: 'in-delhi-av',
    name: 'New Delhi',
    neighborhood: 'Anand Vihar',
    region: 'Delhi',
    country: 'India',
    countryCode: 'IN',
    latitude: 28.6469,
    longitude: 77.316,
    source: 'preset',
  },
  {
    id: 'in-mumbai-bandra',
    name: 'Mumbai',
    neighborhood: 'Bandra Kurla Complex',
    region: 'Maharashtra',
    country: 'India',
    countryCode: 'IN',
    latitude: 19.0653,
    longitude: 72.8682,
    source: 'preset',
  },
  {
    id: 'in-bengaluru-indiranagar',
    name: 'Bengaluru',
    neighborhood: 'Indiranagar',
    region: 'Karnataka',
    country: 'India',
    countryCode: 'IN',
    latitude: 12.9784,
    longitude: 77.6408,
    source: 'preset',
  },
  {
    id: 'in-pune-shivajinagar',
    name: 'Pune',
    neighborhood: 'Shivajinagar',
    region: 'Maharashtra',
    country: 'India',
    countryCode: 'IN',
    latitude: 18.5308,
    longitude: 73.8475,
    source: 'preset',
  },
  {
    id: 'in-kolkata-ballygunge',
    name: 'Kolkata',
    neighborhood: 'Ballygunge',
    region: 'West Bengal',
    country: 'India',
    countryCode: 'IN',
    latitude: 22.528,
    longitude: 88.3659,
    source: 'preset',
  },
  {
    id: 'gb-london',
    name: 'London',
    neighborhood: 'Westminster',
    region: 'England',
    country: 'United Kingdom',
    countryCode: 'GB',
    latitude: 51.5072,
    longitude: -0.1276,
    source: 'preset',
  },
  {
    id: 'us-los-angeles',
    name: 'Los Angeles',
    neighborhood: 'Downtown',
    region: 'California',
    country: 'United States',
    countryCode: 'US',
    latitude: 34.0522,
    longitude: -118.2437,
    source: 'preset',
  },
];

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

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes freshness policy
const GEOCODE_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes city metadata cache
const MAX_CACHE_ENTRIES = 200;
const FETCH_TIMEOUT_MS = 8500;

async function fetchWithTimeout(
  url: string,
  fetchImpl: typeof fetch,
  timeoutMs: number = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
  } finally {
    clearTimeout(timer);
  }
}

function toNumberOrNull(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val) && val >= 0) {
    return Number(val.toFixed(1));
  }
  return null;
}

function computeShortTermTrend(
  currentAqi: number | null,
  hourly: HourlyAqiPoint[],
): { trend: AirQualitySnapshot['trend']; summary: string } {
  if (currentAqi === null || hourly.length < 4) {
    return {
      trend: 'unavailable',
      summary: 'Short-term trend unavailable from current feed.',
    };
  }
  const upcoming = hourly
    .slice(1, 7)
    .map((p) => p.aqi)
    .filter((v): v is number => v !== null);
  if (upcoming.length === 0) {
    return {
      trend: 'unavailable',
      summary: 'Short-term forecast unavailable.',
    };
  }
  const avgNext6h =
    upcoming.reduce((acc, v) => acc + v, 0) / upcoming.length;
  const delta = Math.round(avgNext6h - currentAqi);
  if (delta <= -12) {
    return {
      trend: 'improving',
      summary: `Forecast suggests easing pollution (~${Math.abs(delta)} AQI lower over next 6h).`,
    };
  }
  if (delta >= 12) {
    return {
      trend: 'worsening',
      summary: `Forecast suggests building pollution (~${delta} AQI higher over next 6h).`,
    };
  }
  return {
    trend: 'stable',
    summary: 'Forecast suggests relatively steady air quality over the next 6 hours.',
  };
}

function determineDominantPollutant(pollutants: PollutantReading[]): string | null {
  const pm25 = pollutants.find((p) => p.code === 'PM2.5')?.value;
  const pm10 = pollutants.find((p) => p.code === 'PM10')?.value;
  const o3 = pollutants.find((p) => p.code === 'O3')?.value;
  const no2 = pollutants.find((p) => p.code === 'NO2')?.value;

  const ratios: Array<{ code: string; ratio: number }> = [];
  if (pm25 !== null && pm25 !== undefined) ratios.push({ code: 'PM2.5', ratio: pm25 / 35 });
  if (pm10 !== null && pm10 !== undefined) ratios.push({ code: 'PM10', ratio: pm10 / 100 });
  if (o3 !== null && o3 !== undefined) ratios.push({ code: 'O3', ratio: o3 / 100 });
  if (no2 !== null && no2 !== undefined) ratios.push({ code: 'NO2', ratio: no2 / 80 });

  if (ratios.length === 0) return null;
  ratios.sort((a, b) => b.ratio - a.ratio);
  return ratios[0].code;
}

async function fetchOpenMeteoWeather(
  lat: number,
  lon: number,
  fetchImpl: typeof fetch,
): Promise<WeatherReading> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(
      lat,
    )}&longitude=${encodeURIComponent(
      lon,
    )}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&timezone=auto`;
    const res = await fetchWithTimeout(url, fetchImpl, 6000);
    if (!res.ok) {
      throw new Error(`Weather HTTP ${res.status}`);
    }
    const data = (await res.json()) as {
      current?: {
        time?: string;
        temperature_2m?: number;
        relative_humidity_2m?: number;
        wind_speed_10m?: number;
      };
    };
    const c = data.current;
    if (!c) {
      throw new Error('Weather payload missing current field');
    }
    const temp =
      typeof c.temperature_2m === 'number' && Number.isFinite(c.temperature_2m)
        ? Number(c.temperature_2m.toFixed(1))
        : null;
    const hum =
      typeof c.relative_humidity_2m === 'number' &&
      Number.isFinite(c.relative_humidity_2m)
        ? Math.round(c.relative_humidity_2m)
        : null;
    const wind =
      typeof c.wind_speed_10m === 'number' && Number.isFinite(c.wind_speed_10m)
        ? Number(c.wind_speed_10m.toFixed(1))
        : null;

    const status: DataQualityStatus =
      temp !== null || hum !== null ? 'estimated' : 'unavailable';

    return {
      temperatureC: temp,
      humidityPercent: hum,
      windSpeedKmh: wind,
      status,
      source: 'Open-Meteo Weather Model',
      timestamp: c.time ? new Date(c.time).toISOString() : new Date().toISOString(),
    };
  } catch {
    return {
      temperatureC: null,
      humidityPercent: null,
      windSpeedKmh: null,
      status: 'unavailable',
      source: 'Weather provider unavailable',
      timestamp: null,
    };
  }
}

/**
 * Primary open environmental adapter: Open-Meteo Air Quality API (CAMS atmospheric models + forecasts).
 * Transparently marks readings as model-estimated and handles every pollutant individually.
 */
export class OpenMeteoAirQualityProvider implements AirQualityProvider {
  readonly id = 'open-meteo-cams';
  readonly name = 'Open-Meteo Air Quality (CAMS Atmospheric Model)';

  supportsLocation(): boolean {
    return true;
  }

  async fetchAirQuality(
    location: LocationSelection,
    fetchImpl: typeof fetch = fetch,
  ): Promise<AirQualitySnapshot> {
    const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${encodeURIComponent(
      location.latitude,
    )}&longitude=${encodeURIComponent(
      location.longitude,
    )}&current=us_aqi,pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,ozone&hourly=us_aqi,pm2_5,pm10&forecast_days=2&timezone=auto`;

    const [aqRes, weather] = await Promise.all([
      fetchWithTimeout(aqUrl, fetchImpl),
      fetchOpenMeteoWeather(location.latitude, location.longitude, fetchImpl),
    ]);

    if (!aqRes.ok) {
      throw new Error(`Open-Meteo Air Quality responded with HTTP ${aqRes.status}`);
    }

    const payload = (await aqRes.json()) as {
      current?: {
        time?: string;
        us_aqi?: number | null;
        pm2_5?: number | null;
        pm10?: number | null;
        nitrogen_dioxide?: number | null;
        sulphur_dioxide?: number | null;
        carbon_monoxide?: number | null;
        ozone?: number | null;
      };
      hourly?: {
        time?: string[];
        us_aqi?: Array<number | null>;
        pm2_5?: Array<number | null>;
        pm10?: Array<number | null>;
      };
    };

    const current = payload.current;
    if (!current) {
      throw new Error('Air quality provider returned an empty current reading.');
    }

    const pm25 = toNumberOrNull(current.pm2_5);
    const pm10 = toNumberOrNull(current.pm10);
    const no2 = toNumberOrNull(current.nitrogen_dioxide);
    const so2 = toNumberOrNull(current.sulphur_dioxide);
    const coUg = toNumberOrNull(current.carbon_monoxide);
    const coMg = coUg !== null ? ugPerM3ToMgPerM3(coUg) : null;
    const o3 = toNumberOrNull(current.ozone);

    const pollutants: PollutantReading[] = [
      {
        code: 'PM2.5',
        label: 'Fine Particulate Matter',
        value: pm25,
        unit: 'µg/m³',
        status: pm25 !== null ? 'estimated' : 'unavailable',
      },
      {
        code: 'PM10',
        label: 'Coarse Particulate Matter',
        value: pm10,
        unit: 'µg/m³',
        status: pm10 !== null ? 'estimated' : 'unavailable',
      },
      {
        code: 'NO2',
        label: 'Nitrogen Dioxide',
        value: no2,
        unit: 'µg/m³',
        status: no2 !== null ? 'estimated' : 'unavailable',
      },
      {
        code: 'SO2',
        label: 'Sulfur Dioxide',
        value: so2,
        unit: 'µg/m³',
        status: so2 !== null ? 'estimated' : 'unavailable',
      },
      {
        code: 'CO',
        label: 'Carbon Monoxide',
        value: coMg,
        unit: 'mg/m³',
        status: coMg !== null ? 'estimated' : 'unavailable',
        note: coMg !== null ? 'Converted from µg/m³' : undefined,
      },
      {
        code: 'O3',
        label: 'Ground-Level Ozone',
        value: o3,
        unit: 'µg/m³',
        status: o3 !== null ? 'estimated' : 'unavailable',
      },
    ];

    const isIndia = location.countryCode.toUpperCase() === 'IN';
    const rawUsAqi = toNumberOrNull(current.us_aqi);
    const indiaNaqi = isIndia ? calculateIndiaNaqiFromPm25(pm25) : null;

    let aqi: number | null;
    let aqiScale: AqiScale;
    let notice: string | undefined;

    if (isIndia && indiaNaqi !== null) {
      aqi = indiaNaqi;
      aqiScale = 'INDIA_NAQI';
      notice =
        'Indian CPCB NAQI sub-index calculated deterministically from Open-Meteo CAMS model-estimated PM2.5. Configure WAQI_API_TOKEN on the server to prioritize direct CPCB ground station measurements.';
    } else {
      aqi = rawUsAqi !== null ? Math.round(rawUsAqi) : null;
      aqiScale = 'US_EPA';
      if (isIndia) {
        notice =
          'Displaying US EPA AQI from Open-Meteo CAMS model because PM2.5 was unavailable for CPCB NAQI computation.';
      }
    }

    const hourlyForecast: HourlyAqiPoint[] = [];
    const times = payload.hourly?.time ?? [];
    const usAqis = payload.hourly?.us_aqi ?? [];
    const pm25s = payload.hourly?.pm2_5 ?? [];
    const pm10s = payload.hourly?.pm10 ?? [];

    const nowMs = Date.now();
    for (let i = 0; i < times.length; i++) {
      const tMs = Date.parse(times[i]);
      if (Number.isNaN(tMs) || tMs < nowMs - 60 * 60 * 1000) continue;
      if (hourlyForecast.length >= 24) break;
      const hPm25 = toNumberOrNull(pm25s[i]);
      const hPm10 = toNumberOrNull(pm10s[i]);
      const hAqi =
        aqiScale === 'INDIA_NAQI'
          ? calculateIndiaNaqiFromPm25(hPm25)
          : toNumberOrNull(usAqis[i]);

      hourlyForecast.push({
        time: new Date(tMs).toISOString(),
        aqi: hAqi !== null ? Math.round(hAqi) : null,
        pm25: hPm25,
        pm10: hPm10,
        status: hAqi !== null ? 'estimated' : 'unavailable',
      });
    }

    const lastUpdated = current.time
      ? new Date(current.time).toISOString()
      : new Date().toISOString();
    const fetchedAt = new Date().toISOString();
    const freshness = evaluateDataFreshness(lastUpdated).status;
    const { trend, summary: trendSummary } = computeShortTermTrend(
      aqi,
      hourlyForecast,
    );

    return {
      location,
      aqi,
      aqiScale,
      aqiStatus: aqi !== null ? 'estimated' : 'unavailable',
      dominantPollutant: determineDominantPollutant(pollutants),
      pollutants,
      weather,
      hourlyForecast,
      trend,
      trendSummary,
      dataSource: this.name,
      providerId: this.id,
      lastUpdated,
      fetchedAt,
      cached: false,
      cacheMaxAgeSeconds: Math.round(CACHE_TTL_MS / 1000),
      freshness,
      notice,
    };
  }
}

/**
 * Optional station-level provider prioritizing CPCB / DPCC / EPA ground monitoring feeds via WAQI
 * when WAQI_API_TOKEN is supplied in server environment variables.
 */
export class WaqiStationProvider implements AirQualityProvider {
  readonly id = 'waqi-station';
  readonly name = 'WAQI Ground Monitoring Network (CPCB / Official Stations)';
  private readonly token: string;

  constructor(token: string) {
    this.token = token;
  }

  supportsLocation(): boolean {
    return this.token.trim().length > 0;
  }

  async fetchAirQuality(
    location: LocationSelection,
    fetchImpl: typeof fetch = fetch,
  ): Promise<AirQualitySnapshot> {
    const url = `https://api.waqi.info/feed/geo:${encodeURIComponent(
      location.latitude,
    )};${encodeURIComponent(location.longitude)}/?token=${encodeURIComponent(
      this.token,
    )}`;
    const [res, weather] = await Promise.all([
      fetchWithTimeout(url, fetchImpl),
      fetchOpenMeteoWeather(location.latitude, location.longitude, fetchImpl),
    ]);

    if (!res.ok) {
      throw new Error(`WAQI responded with HTTP ${res.status}`);
    }

    const body = (await res.json()) as {
      status?: string;
      data?: {
        aqi?: number | string;
        dominentpol?: string;
        city?: { name?: string };
        attributions?: Array<{ name?: string }>;
        time?: { iso?: string };
        iaqi?: Record<string, { v?: number }>;
      };
    };

    if (body.status !== 'ok' || !body.data) {
      throw new Error('WAQI returned non-ok status');
    }

    const rawAqi =
      typeof body.data.aqi === 'number'
        ? body.data.aqi
        : Number.isFinite(Number(body.data.aqi))
        ? Number(body.data.aqi)
        : null;

    const iaqi = body.data.iaqi ?? {};
    const readIaqi = (key: string): number | null =>
      toNumberOrNull(iaqi[key]?.v);

    const pollutants: PollutantReading[] = [
      {
        code: 'PM2.5',
        label: 'Fine Particulate Matter',
        value: readIaqi('pm25'),
        unit: 'µg/m³',
        status: readIaqi('pm25') !== null ? 'measured' : 'unavailable',
      },
      {
        code: 'PM10',
        label: 'Coarse Particulate Matter',
        value: readIaqi('pm10'),
        unit: 'µg/m³',
        status: readIaqi('pm10') !== null ? 'measured' : 'unavailable',
      },
      {
        code: 'NO2',
        label: 'Nitrogen Dioxide',
        value: readIaqi('no2'),
        unit: 'µg/m³',
        status: readIaqi('no2') !== null ? 'measured' : 'unavailable',
      },
      {
        code: 'SO2',
        label: 'Sulfur Dioxide',
        value: readIaqi('so2'),
        unit: 'µg/m³',
        status: readIaqi('so2') !== null ? 'measured' : 'unavailable',
      },
      {
        code: 'CO',
        label: 'Carbon Monoxide',
        value: readIaqi('co'),
        unit: 'mg/m³',
        status: readIaqi('co') !== null ? 'measured' : 'unavailable',
      },
      {
        code: 'O3',
        label: 'Ground-Level Ozone',
        value: readIaqi('o3'),
        unit: 'µg/m³',
        status: readIaqi('o3') !== null ? 'measured' : 'unavailable',
      },
    ];

    const lastUpdated = body.data.time?.iso ?? null;
    const attributionNames =
      body.data.attributions
        ?.map((a) => a.name)
        .filter((n): n is string => Boolean(n))
        .join(' · ') || this.name;

    return {
      location,
      aqi: rawAqi,
      aqiScale: 'US_EPA',
      aqiStatus: rawAqi !== null ? 'measured' : 'unavailable',
      dominantPollutant: body.data.dominentpol?.toUpperCase() ?? null,
      pollutants,
      weather,
      hourlyForecast: [],
      trend: 'unavailable',
      trendSummary: 'Ground station feed reports current measurements without hourly forecast.',
      dataSource: attributionNames,
      providerId: this.id,
      stationName: body.data.city?.name,
      lastUpdated,
      fetchedAt: new Date().toISOString(),
      cached: false,
      cacheMaxAgeSeconds: Math.round(CACHE_TTL_MS / 1000),
      freshness: evaluateDataFreshness(lastUpdated).status,
    };
  }
}

export class AirQualityService {
  private readonly providers: AirQualityProvider[];
  private readonly cache = new Map<string, CacheEntry>();
  private readonly geocodeCache = new Map<string, GeocodeCacheEntry>();
  private readonly fetchImpl: typeof fetch;

  constructor(options?: {
    waqiToken?: string;
    providers?: AirQualityProvider[];
    fetchImpl?: typeof fetch;
  }) {
    this.fetchImpl = options?.fetchImpl ?? fetch;
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

    const errors: string[] = [];
    for (const provider of this.providers) {
      if (!provider.supportsLocation(location)) continue;
      try {
        const snapshot = await provider.fetchAirQuality(
          location,
          this.fetchImpl,
        );
        this.setBoundedCache(this.cache, key, {
          snapshot,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
        return snapshot;
      } catch (err) {
        errors.push(
          `${provider.id}: ${err instanceof Error ? err.message : 'unknown error'}`,
        );
      }
    }

    // Never invent or substitute another city's AQI: return explicit unavailable state.
    return {
      location,
      aqi: null,
      aqiScale: location.countryCode.toUpperCase() === 'IN' ? 'INDIA_NAQI' : 'US_EPA',
      aqiStatus: 'unavailable',
      dominantPollutant: null,
      pollutants: [
        { code: 'PM2.5', label: 'Fine Particulate Matter', value: null, unit: 'µg/m³', status: 'unavailable' },
        { code: 'PM10', label: 'Coarse Particulate Matter', value: null, unit: 'µg/m³', status: 'unavailable' },
        { code: 'NO2', label: 'Nitrogen Dioxide', value: null, unit: 'µg/m³', status: 'unavailable' },
        { code: 'SO2', label: 'Sulfur Dioxide', value: null, unit: 'µg/m³', status: 'unavailable' },
        { code: 'CO', label: 'Carbon Monoxide', value: null, unit: 'mg/m³', status: 'unavailable' },
        { code: 'O3', label: 'Ground-Level Ozone', value: null, unit: 'µg/m³', status: 'unavailable' },
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
      notice: `Unable to retrieve air-quality readings for ${location.name}. BreatheWise AI will not substitute another city's data or fabricate values.`,
    };
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
    const data = (await res.json()) as {
      results?: Array<{
        id?: number;
        name: string;
        admin1?: string;
        admin2?: string;
        country?: string;
        country_code?: string;
        latitude: number;
        longitude: number;
      }>;
    };

    const results: LocationSelection[] = (data.results ?? []).map((item) => ({
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
