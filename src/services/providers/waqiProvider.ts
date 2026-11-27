import { waqiStationResponseSchema } from '../../schemas/external.ts';
import type {
  AirQualitySnapshot,
  LocationSelection,
  PollutantReading,
} from '../../types/index.ts';
import { evaluateDataFreshness } from '../../utils/aqi.ts';
import type { AirQualityProvider } from './airQualityProvider.ts';
import { fetchWithTimeout, toNumberOrNull } from './httpClient.ts';
import { fetchOpenMeteoWeather, PROVIDER_CACHE_TTL_MS } from './openMeteoProvider.ts';

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

    const raw: unknown = await res.json();
    const validated = waqiStationResponseSchema.safeParse(raw);
    if (!validated.success || validated.data.status !== 'ok' || !validated.data.data) {
      throw new Error('WAQI returned non-ok or schema-invalid response');
    }

    const station = validated.data.data;
    const rawAqi =
      typeof station.aqi === 'number'
        ? station.aqi
        : Number.isFinite(Number(station.aqi))
          ? Number(station.aqi)
          : null;

    const iaqi = station.iaqi ?? {};
    const readIaqi = (key: string): number | null => toNumberOrNull(iaqi[key]?.v);

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

    const lastUpdated = station.time?.iso ?? null;
    const attributionNames =
      station.attributions
        ?.map((a) => a.name)
        .filter((n): n is string => Boolean(n))
        .join(' · ') || this.name;

    return {
      location,
      aqi: rawAqi,
      aqiScale: 'US_EPA',
      aqiStatus: rawAqi !== null ? 'measured' : 'unavailable',
      dominantPollutant: station.dominentpol?.toUpperCase() ?? null,
      pollutants,
      weather,
      hourlyForecast: [],
      trend: 'unavailable',
      trendSummary:
        'Ground station feed reports current measurements without hourly forecast.',
      dataSource: attributionNames,
      providerId: this.id,
      stationName: station.city?.name,
      lastUpdated,
      fetchedAt: new Date().toISOString(),
      cached: false,
      cacheMaxAgeSeconds: Math.round(PROVIDER_CACHE_TTL_MS / 1000),
      freshness: evaluateDataFreshness(lastUpdated).status,
    };
  }
}
