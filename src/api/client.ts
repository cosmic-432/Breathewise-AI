import type {
  AirQualitySnapshot,
  CommunityChallenge,
  CommunityReport,
  HouseholdProfile,
  IndoorConditions,
  LocationSelection,
  RoutineActivity,
  StructuredAIResponse,
} from '../types/index.ts';

export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiClientError(
      'Received an invalid response from the server.',
      res.status,
    );
  }
  if (!res.ok) {
    const errObj = data as { error?: string; code?: string };
    throw new ApiClientError(
      errObj.error ?? `Request failed (${res.status})`,
      res.status,
      errObj.code,
    );
  }
  return data as T;
}

const inflightAirQuality = new Map<string, Promise<AirQualitySnapshot>>();

export const apiClient = {
  async fetchPresets(signal?: AbortSignal): Promise<LocationSelection[]> {
    const res = await fetch('/api/locations/presets', { signal });
    const data = await parseJsonResponse<{ locations: LocationSelection[] }>(res);
    return data.locations;
  },

  async searchLocations(
    query: string,
    signal?: AbortSignal,
  ): Promise<LocationSelection[]> {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, {
      signal,
    });
    const data = await parseJsonResponse<{ results: LocationSelection[] }>(res);
    return data.results;
  },

  async fetchAirQuality(
    location: LocationSelection,
    options?: { refresh?: boolean; signal?: AbortSignal },
  ): Promise<AirQualitySnapshot> {
    const key = `${location.latitude.toFixed(3)},${location.longitude.toFixed(3)},${
      options?.refresh ? '1' : '0'
    }`;
    if (!options?.signal && inflightAirQuality.has(key)) {
      return inflightAirQuality.get(key)!;
    }

    const params = new URLSearchParams({
      lat: String(location.latitude),
      lon: String(location.longitude),
      name: location.name,
      country: location.country,
      countryCode: location.countryCode,
      source: location.source,
    });
    if (location.neighborhood) params.set('neighborhood', location.neighborhood);
    if (location.region) params.set('region', location.region);
    if (options?.refresh) params.set('refresh', '1');

    const promise = fetch(`/api/air-quality?${params.toString()}`, {
      signal: options?.signal,
    }).then((res) => parseJsonResponse<AirQualitySnapshot>(res));

    if (!options?.signal) {
      inflightAirQuality.set(key, promise);
      promise.finally(() => inflightAirQuality.delete(key));
    }
    return promise;
  },

  async askAssistant(
    payload: {
      question: string;
      mode?:
        | 'assistant'
        | 'routine'
        | 'indoor'
        | 'sustainable'
        | 'family'
        | 'community'
        | 'explain';
      history?: Array<{ role: 'user' | 'assistant'; text: string }>;
      snapshot: AirQualitySnapshot | null;
      household?: HouseholdProfile;
      indoor?: IndoorConditions;
      routines?: RoutineActivity[];
    },
    signal?: AbortSignal,
  ): Promise<StructuredAIResponse> {
    const body = {
      question: payload.question,
      mode: payload.mode ?? 'assistant',
      history: payload.history,
      airQuality: payload.snapshot
        ? {
            locationName: payload.snapshot.location.neighborhood
              ? `${payload.snapshot.location.name}, ${payload.snapshot.location.neighborhood}`
              : payload.snapshot.location.name,
            country: payload.snapshot.location.country,
            aqi: payload.snapshot.aqi,
            aqiScale: payload.snapshot.aqiScale,
            aqiStatus: payload.snapshot.aqiStatus,
            dominantPollutant: payload.snapshot.dominantPollutant,
            pollutants: payload.snapshot.pollutants.map((p) => ({
              code: p.code,
              value: p.value,
              unit: p.unit,
              status: p.status,
            })),
            temperatureC: payload.snapshot.weather.temperatureC,
            humidityPercent: payload.snapshot.weather.humidityPercent,
            windSpeedKmh: payload.snapshot.weather.windSpeedKmh,
            trendSummary: payload.snapshot.trendSummary,
            dataSource: payload.snapshot.dataSource,
            lastUpdated: payload.snapshot.lastUpdated,
            freshness: payload.snapshot.freshness,
          }
        : null,
      household: payload.household,
      indoor: payload.indoor,
      routines: payload.routines,
    };

    const res = await fetch('/api/ai/assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });

    const data = await parseJsonResponse<{ response: StructuredAIResponse }>(res);
    return data.response;
  },

  async fetchCommunity(signal?: AbortSignal): Promise<{
    challenges: CommunityChallenge[];
    reports: CommunityReport[];
    totalVerifiedParticipants: number;
    totalLoggedActions: number;
  }> {
    const res = await fetch('/api/community', { signal });
    return parseJsonResponse(res);
  },

  async participateInChallenge(payload: {
    challengeId: string;
    action: 'join' | 'log_action';
    clientToken: string;
  }): Promise<{
    challenge: CommunityChallenge;
    summary: {
      challenges: CommunityChallenge[];
      reports: CommunityReport[];
      totalVerifiedParticipants: number;
      totalLoggedActions: number;
    };
  }> {
    const res = await fetch('/api/community/participate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonResponse(res);
  },

  async submitCommunityReport(payload: {
    areaLabel: string;
    category: CommunityReport['category'];
    title: string;
    description: string;
  }): Promise<{
    report: CommunityReport;
    summary: {
      challenges: CommunityChallenge[];
      reports: CommunityReport[];
      totalVerifiedParticipants: number;
      totalLoggedActions: number;
    };
  }> {
    const res = await fetch('/api/community/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonResponse(res);
  },
};
